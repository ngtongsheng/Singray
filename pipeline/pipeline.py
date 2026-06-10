"""Singray media pipeline: YouTube download + UVR stem separation.

Contract (SPEC §5.2): JSON to stdout. `probe` prints one object; `process`
streams JSON-lines progress. Non-zero exit + {"stage": "error"} on failure.
"""

import argparse
import json
import logging
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yt_dlp

SCRIPT_DIR = Path(__file__).resolve().parent
MODELS_DIR = SCRIPT_DIR / "models"
DEFAULT_MODEL = "6_HP-Karaoke-UVR.pth"
TARGET_LUFS = -14.0
MAX_GAIN_DB = 20.0

# UVR VR-architecture params (carried over from the reference implementation)
VR_PARAMS = {
    "batch_size": 1,
    "window_size": 320,
    "aggression": 5,
    "enable_tta": False,
    "enable_post_process": False,
    "post_process_threshold": 0.2,
    "high_end_process": False,
}

AUDIO_EXTS = {".m4a", ".webm", ".opus", ".mp3", ".mp4", ".ogg", ".flac", ".wav"}
IMAGE_EXTS = {".webp", ".jpg", ".jpeg", ".png"}


def emit(obj: dict) -> None:
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def cmd_probe(args: argparse.Namespace) -> int:
    """Print one JSON object: {title, channel, track, artist, duration, thumbnailUrl}."""
    try:
        opts = {"quiet": True, "no_warnings": True, "noprogress": True, "noplaylist": True}
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(args.url, download=False)
        artists = info.get("artists") or ([info["artist"]] if info.get("artist") else [])
        print(
            json.dumps(
                {
                    "title": info.get("title") or "",
                    "channel": info.get("channel") or info.get("uploader") or "",
                    "track": info.get("track"),
                    "artist": ", ".join(artists) if artists else None,
                    "duration": float(info.get("duration") or 0),
                    "thumbnailUrl": info.get("thumbnail") or "",
                },
                ensure_ascii=False,
            )
        )
        return 0
    except Exception as exc:  # noqa: BLE001 — any failure becomes the error contract
        print(json.dumps({"stage": "error", "message": str(exc)}, ensure_ascii=False))
        return 1


def _download(url: str, dl_dir: Path) -> tuple[Path, Path | None, float]:
    """Best-audio download + thumbnail. Returns (audio, thumb_or_none, durationSec)."""
    last_emitted = -1.0

    def hook(d: dict) -> None:
        nonlocal last_emitted
        if d.get("status") != "downloading":
            return
        total = d.get("total_bytes") or d.get("total_bytes_estimate")
        if not total:
            return
        p = round(d.get("downloaded_bytes", 0) / total, 2)
        if p > last_emitted:
            last_emitted = p
            emit({"stage": "download", "progress": p})

    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(dl_dir / "audio.%(ext)s"),
        "noplaylist": True,
        "writethumbnail": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "progress_hooks": [hook],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)

    audio = next((f for f in dl_dir.iterdir() if f.suffix.lower() in AUDIO_EXTS), None)
    thumb = next((f for f in dl_dir.iterdir() if f.suffix.lower() in IMAGE_EXTS), None)
    if audio is None:
        raise RuntimeError("yt-dlp did not produce an audio file")
    emit({"stage": "download", "progress": 1.0})
    return audio, thumb, float(info.get("duration") or 0)


def _separate(audio: Path, stems_dir: Path, model: str) -> tuple[Path, Path]:
    """UVR separation. Returns (vocals_wav, instrumental_wav)."""
    from audio_separator.separator import Separator

    emit({"stage": "separate", "progress": 0.0})
    MODELS_DIR.mkdir(exist_ok=True)
    sep = Separator(
        log_level=logging.WARNING,
        output_dir=str(stems_dir),
        output_format="WAV",
        model_file_dir=str(MODELS_DIR),
        vr_params=VR_PARAMS,
    )
    sep.load_model(model_filename=model)
    outputs = sep.separate(str(audio))

    vocals = instrumental = None
    for name in outputs:
        path = stems_dir / Path(name).name
        if "(Vocals)" in path.name:
            vocals = path
        elif "(Instrumental)" in path.name:
            instrumental = path
    if vocals is None or instrumental is None:
        raise RuntimeError(f"unexpected separator outputs: {outputs}")
    emit({"stage": "separate", "progress": 1.0})
    return vocals, instrumental


def _measure_input_lufs(path: Path) -> float:
    """Integrated loudness of a file via ffmpeg loudnorm (measure pass)."""
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-nostats",
            "-i", str(path),
            "-af", f"loudnorm=I={TARGET_LUFS}:print_format=json",
            "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )  # fmt: skip
    start = proc.stderr.rfind("{")
    end = proc.stderr.rfind("}")
    if start == -1 or end == -1:
        raise RuntimeError("loudnorm measurement produced no JSON")
    return float(json.loads(proc.stderr[start : end + 1])["input_i"])


def _encode_m4a(src: Path, dst: Path, gain_db: float) -> None:
    """AAC 256k with the shared linear gain applied (same gain on all three files)."""
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(src),
                "-af", f"volume={gain_db:.2f}dB",
                "-c:a", "aac", "-b:a", "256k",
                "-movflags", "+faststart",
                str(dst),
            ],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=True,
        )  # fmt: skip
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ffmpeg encode failed for {src.name}: {exc.stderr.strip()}") from exc


def _encode_thumb(src: Path, dst: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), str(dst)],
        stdin=subprocess.DEVNULL,
        capture_output=True,
        check=True,
    )


def cmd_process(args: argparse.Namespace) -> int:
    """Download → separate → loudness-matched AAC ×3 (+thumb) into --out."""
    out_dir = Path(args.out)
    try:
        with tempfile.TemporaryDirectory(prefix="singray_") as tmp_str:
            tmp = Path(tmp_str)
            dl_dir, stems_dir, m4a_dir = tmp / "download", tmp / "stems", tmp / "m4a"
            for d in (dl_dir, stems_dir, m4a_dir):
                d.mkdir()

            audio, thumb, duration = _download(args.url, dl_dir)
            vocals_wav, instrumental_wav = _separate(audio, stems_dir, args.model)

            # One gain for all three files: preserves vocal/instrumental balance,
            # levels songs against each other at -14 LUFS (SPEC §5.2).
            gain_db = TARGET_LUFS - _measure_input_lufs(audio)
            gain_db = max(-MAX_GAIN_DB, min(MAX_GAIN_DB, gain_db))

            emit({"stage": "convert", "progress": 0.0})
            _encode_m4a(audio, m4a_dir / "original.m4a", gain_db)
            emit({"stage": "convert", "progress": 0.33})
            _encode_m4a(instrumental_wav, m4a_dir / "instrumental.m4a", gain_db)
            emit({"stage": "convert", "progress": 0.67})
            _encode_m4a(vocals_wav, m4a_dir / "vocals.m4a", gain_db)
            emit({"stage": "convert", "progress": 1.0})

            files = {
                "original": "original.m4a",
                "instrumental": "instrumental.m4a",
                "vocals": "vocals.m4a",
            }
            out_dir.mkdir(parents=True, exist_ok=True)
            for name in files.values():
                shutil.move(str(m4a_dir / name), str(out_dir / name))
            if thumb is not None:
                _encode_thumb(thumb, out_dir / "thumb.jpg")
                files["thumb"] = "thumb.jpg"

            emit({"stage": "done", "files": files, "durationSec": duration})
        return 0
    except Exception as exc:  # noqa: BLE001 — any failure becomes the error contract
        emit({"stage": "error", "message": str(exc)})
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="Singray media pipeline (yt-dlp + audio-separator + ffmpeg)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    probe = sub.add_parser("probe", help="fetch YouTube metadata as one JSON object")
    probe.add_argument("--url", required=True)
    probe.set_defaults(func=cmd_probe)

    process = sub.add_parser("process", help="download, separate, transcode into --out")
    process.add_argument("--url", required=True)
    process.add_argument("--out", required=True)
    process.add_argument("--model", default=DEFAULT_MODEL)
    process.set_defaults(func=cmd_process)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
