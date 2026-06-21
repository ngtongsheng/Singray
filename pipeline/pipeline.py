"""Singray media pipeline: YouTube download + UVR stem separation + alignment.

Contract (SPEC §5.2): JSON to stdout. `probe` prints one object; `process`
and `align` stream JSON-lines progress. Non-zero exit + {"stage": "error"}
on failure.
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

# Browser cookie fallback order per platform (for bot-detection retry)
_BROWSER_ORDER: list[str] = {
    "darwin": ["safari", "chrome", "chromium", "firefox"],
    "win32": ["chrome", "chromium", "firefox"],
}.get(sys.platform, ["firefox", "chrome", "chromium"])
_BOT_HINT = "Sign in to confirm"


def _yt_extract(opts: dict, url: str, *, download: bool = False):
    """Run yt-dlp extract_info; on bot-detection, retry with each installed browser's cookies."""
    last_exc: Exception | None = None
    for browser in [None, *_BROWSER_ORDER]:
        cookie = {"cookiesfrombrowser": (browser, None, None, None)} if browser else {}
        try_opts = {**opts, **cookie}
        try:
            with yt_dlp.YoutubeDL(try_opts) as ydl:
                return ydl.extract_info(url, download=download)
        except Exception as exc:
            last_exc = exc
            if _BOT_HINT not in str(exc):
                raise
    raise last_exc  # type: ignore[misc]

# Languages where alignment is consumed per character (matches the app's
# CJK-char-equals-unit tokenization rule, SPEC §4.4).
CHAR_ALIGN_LANGS = {"zh", "ja", "ko"}
WHISPERX_SAMPLE_RATE = 16000

# Windows consoles default to cp1252; the JSON contract is UTF-8 (CJK lyrics).
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

# Captured at import so emit() survives the stdout→stderr swap in cmd_align
# (whisperx/transformers print to stdout, which would corrupt the JSON stream).
_STDOUT = sys.stdout


def emit(obj: dict) -> None:
    print(json.dumps(obj, ensure_ascii=False), file=_STDOUT, flush=True)


def _ffprobe(path: Path) -> dict:
    """Run ffprobe → parsed JSON (format + streams)."""
    proc = subprocess.run(
        [
            "ffprobe", "-hide_banner", "-loglevel", "error",
            "-show_format", "-show_streams", "-of", "json", str(path),
        ],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )  # fmt: skip
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {proc.stderr.strip() or 'unreadable file'}")
    return json.loads(proc.stdout or "{}")


def _local_meta(path: Path) -> dict:
    """Probe a local media file: duration, tag title/artist, and thumbnail source flags."""
    info = _ffprobe(path)
    fmt = info.get("format") or {}
    tags = {str(k).lower(): v for k, v in (fmt.get("tags") or {}).items()}
    streams = info.get("streams") or []
    # Stream-level tags too (some containers stash title/artist on the audio stream).
    for s in streams:
        for k, v in (s.get("tags") or {}).items():
            tags.setdefault(str(k).lower(), v)

    def is_pic(s: dict) -> bool:
        return bool((s.get("disposition") or {}).get("attached_pic"))

    return {
        "title": (tags.get("title") or path.stem).strip(),
        "artist": (tags.get("artist") or tags.get("album_artist") or "").strip(),
        "track": tags.get("title"),
        "duration": float(fmt.get("duration") or 0),
        "has_attached": any(s.get("codec_type") == "video" and is_pic(s) for s in streams),
        "has_video": any(s.get("codec_type") == "video" and not is_pic(s) for s in streams),
    }


def _extract_local_thumb(src: Path, meta: dict, dl_dir: Path) -> Path | None:
    """Embedded cover art → else a frame ~20% into the video → else None (placeholder)."""
    out = dl_dir / "thumb_src.jpg"
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    if meta["has_attached"]:
        cmd += ["-i", str(src), "-map", "0:v:0", "-frames:v", "1", str(out)]
    elif meta["has_video"]:
        cmd += ["-ss", f"{meta['duration'] * 0.2:.2f}", "-i", str(src), "-frames:v", "1", str(out)]
    else:
        return None
    try:
        subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, check=True)
    except subprocess.CalledProcessError:
        return None
    return out if out.exists() else None


def cmd_probe(args: argparse.Namespace) -> int:
    """Print one JSON object: {title, channel, track, artist, duration, thumbnailUrl}."""
    if args.file:
        try:
            m = _local_meta(Path(args.file))
            print(
                json.dumps(
                    {
                        "title": m["title"],
                        "channel": "",
                        "track": m["track"],
                        "artist": m["artist"] or None,
                        "duration": m["duration"],
                        "thumbnailUrl": "",
                    },
                    ensure_ascii=False,
                )
            )
            return 0
        except Exception as exc:  # noqa: BLE001 — any failure becomes the error contract
            print(json.dumps({"stage": "error", "message": str(exc)}, ensure_ascii=False))
            return 1
    try:
        opts = {"quiet": True, "no_warnings": True, "noprogress": True, "noplaylist": True}
        info = _yt_extract(opts, args.url)
        artists = info.get("artists") or ([info.get("artist")] if info.get("artist") else [])
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


def cmd_search(args: argparse.Namespace) -> int:
    """Stream up to 10 `ytsearch` hits as JSON-lines: {title, channel, duration, thumbnailUrl, url}.

    Uses flat extraction (no per-video metadata fetch) so the whole query
    returns in a couple of seconds — the result list only needs enough to
    pick from; the full probe runs when the user chooses one.
    """
    try:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "extract_flat": True,
            "skip_download": True,
        }
        info = _yt_extract(opts, f"ytsearch10:{args.query}")
        for entry in info.get("entries") or []:
            if not entry:
                continue
            vid = entry.get("id") or ""
            thumbs = entry.get("thumbnails") or []
            thumb = entry.get("thumbnail") or (thumbs[-1]["url"] if thumbs else "")
            if not thumb and vid:
                thumb = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
            url = f"https://www.youtube.com/watch?v={vid}" if vid else (entry.get("url") or "")
            emit(
                {
                    "title": entry.get("title") or "",
                    "channel": entry.get("channel") or entry.get("uploader") or "",
                    "duration": float(entry.get("duration") or 0),
                    "thumbnailUrl": thumb,
                    "url": url,
                }
            )
        return 0
    except Exception as exc:  # noqa: BLE001 — any failure becomes the error contract
        emit({"stage": "error", "message": str(exc)})
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
    info = _yt_extract(opts, url, download=True)

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
    stderr = proc.stderr
    start = stderr.rfind("{")
    if start == -1:
        raise RuntimeError("loudnorm measurement produced no JSON")
    depth, end = 0, -1
    for i, ch in enumerate(stderr[start:]):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = start + i
                break
    if end == -1:
        raise RuntimeError("loudnorm measurement produced no JSON")
    return float(json.loads(stderr[start : end + 1])["input_i"])


def _encode_audio(src: Path, dst: Path, gain_db: float, fmt: str) -> None:
    """Encode with the shared linear gain (same gain on all three files).

    fmt="flac" → lossless (no second lossy encode after separation); "m4a" → AAC 256k.
    """
    codec = (
        ["-c:a", "flac"]
        if fmt == "flac"
        else ["-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart"]
    )
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(src),
                "-vn",  # drop any video stream (local-file imports can be mp4)
                "-af", f"volume={gain_db:.2f}dB",
                *codec,
                str(dst),
            ],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=True,
        )  # fmt: skip
    except subprocess.CalledProcessError as exc:
        msg = f"ffmpeg encode failed for {src.name}: {exc.stderr.strip() or '(see logs)'}"
        raise RuntimeError(msg) from exc


def _encode_thumb(src: Path, dst: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), str(dst)],
        stdin=subprocess.DEVNULL,
        capture_output=True,
        check=True,
    )


def cmd_process(args: argparse.Namespace) -> int:
    """Download (or use a local --file) → separate → loudness-matched AAC ×3 (+thumb) into --out."""
    out_dir = Path(args.out)
    try:
        with tempfile.TemporaryDirectory(prefix="singray_") as tmp_str:
            tmp = Path(tmp_str)
            dl_dir, stems_dir, enc_dir = tmp / "download", tmp / "stems", tmp / "encoded"
            for d in (dl_dir, stems_dir, enc_dir):
                d.mkdir()

            if args.file:
                # Local import: no download stage. Probe-equivalent + thumb via ffmpeg.
                src = Path(args.file)
                if not src.exists():
                    raise RuntimeError(f"file not found: {src}")
                m = _local_meta(src)
                audio, duration = src, m["duration"]
                thumb = _extract_local_thumb(src, m, dl_dir)
            else:
                audio, thumb, duration = _download(args.url, dl_dir)
            vocals_wav, instrumental_wav = _separate(audio, stems_dir, args.model)

            # One gain for all three files: preserves vocal/instrumental balance,
            # levels songs against each other at -14 LUFS (SPEC §5.2).
            gain_db = TARGET_LUFS - _measure_input_lufs(audio)
            gain_db = max(-MAX_GAIN_DB, min(MAX_GAIN_DB, gain_db))

            ext = "flac" if args.format == "flac" else "m4a"
            emit({"stage": "convert", "progress": 0.0})
            _encode_audio(audio, enc_dir / f"original.{ext}", gain_db, args.format)
            emit({"stage": "convert", "progress": 0.33})
            _encode_audio(instrumental_wav, enc_dir / f"instrumental.{ext}", gain_db, args.format)
            emit({"stage": "convert", "progress": 0.67})
            _encode_audio(vocals_wav, enc_dir / f"vocals.{ext}", gain_db, args.format)
            emit({"stage": "convert", "progress": 1.0})

            files = {
                "original": f"original.{ext}",
                "instrumental": f"instrumental.{ext}",
                "vocals": f"vocals.{ext}",
            }
            out_dir.mkdir(parents=True, exist_ok=True)
            for name in files.values():
                shutil.move(str(enc_dir / name), str(out_dir / name))
            if thumb is not None:
                _encode_thumb(thumb, out_dir / "thumb.jpg")
                files["thumb"] = "thumb.jpg"

            emit({"stage": "done", "files": files, "durationSec": duration})
        return 0
    except Exception as exc:  # noqa: BLE001 — any failure becomes the error contract
        emit({"stage": "error", "message": str(exc)})
        return 1


def _align_tokens(vocals: Path, text: str, lang: str) -> list[dict]:
    """WhisperX forced alignment of `text` against the vocals stem (SPEC §6.6).

    Returns ordered tokens {text, start, score}; start/score are None when the
    aligner could not place that token. Char-level for CJK languages, else
    word-level — mirrors the app's unit tokenization granularity.
    """
    import torch
    import whisperx

    audio = whisperx.load_audio(str(vocals))
    duration = len(audio) / WHISPERX_SAMPLE_RATE
    # Whole lyric as one segment spanning the song: real per-line times are
    # exactly what alignment is being asked to discover.
    segments = [{"text": text, "start": 0.0, "end": duration}]
    char_mode = lang in CHAR_ALIGN_LANGS

    def run(device: str) -> dict:
        model, metadata = whisperx.load_align_model(language_code=lang, device=device)
        emit({"stage": "align", "progress": 0.3})
        return whisperx.align(
            segments, model, metadata, audio, device, return_char_alignments=char_mode
        )

    # Device preference: CUDA (Windows/Linux NVIDIA) → MPS (Apple Silicon) → CPU.
    mps = getattr(torch.backends, "mps", None)
    if torch.cuda.is_available():
        device = "cuda"
    elif mps is not None and mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    try:
        result = run(device)
    except (torch.cuda.OutOfMemoryError, RuntimeError):
        # OOM (cuda) or an unsupported-op error (mps) → fall back to CPU.
        if device == "cpu":
            raise
        if device == "cuda":
            torch.cuda.empty_cache()
        emit({"stage": "align", "progress": 0.3})
        result = run("cpu")

    tokens: list[dict] = []
    for seg in result["segments"]:
        if char_mode:
            for ch in seg.get("chars", []):
                t = (ch.get("char") or "").strip()
                if t:
                    tokens.append({"text": t, "start": ch.get("start"), "score": ch.get("score")})
        else:
            for w in seg.get("words", []):
                t = (w.get("word") or "").strip()
                if t:
                    tokens.append({"text": t, "start": w.get("start"), "score": w.get("score")})
    return tokens


def cmd_align(args: argparse.Namespace) -> int:
    """Forced alignment: lyric text vs the vocals stem → token timestamps (SPEC §6.6)."""
    try:
        song_dir = Path(args.song)
        vocals = next(
            (p for e in ("flac", "m4a") if (p := song_dir / f"vocals.{e}").exists()),
            None,
        )
        if vocals is None:
            raise RuntimeError(f"vocals stem not found in {song_dir}")

        raw = Path(args.text).read_text(encoding="utf-8")
        text = " ".join(line.strip() for line in raw.splitlines() if line.strip())
        if not text:
            raise RuntimeError("lyric text is empty")

        meta = json.loads((song_dir / "meta.json").read_text(encoding="utf-8"))
        lang = meta.get("language") or "en"
        if lang == "unknown":
            lang = "en"

        emit({"stage": "align", "progress": 0.0})
        sys.stdout = sys.stderr  # ML libs print to stdout; keep the JSON stream clean
        tokens = _align_tokens(vocals, text, lang)
        if not tokens:
            raise RuntimeError("alignment produced no tokens")
        emit({"stage": "done", "tokens": tokens})
        return 0
    except Exception as exc:  # noqa: BLE001 — any failure becomes the error contract
        emit({"stage": "error", "message": str(exc)})
        return 1


def cmd_list_models(args: argparse.Namespace) -> int:
    """List available separation models from registry + local MODELS_DIR.

    Scans the on-disk models directory for any downloaded model files, then
    augments with audio-separator's registry list (if reachable). Merges and
    deduplicates so manually-added and registry models both appear.
    Emits {"stage": "done", "models": ["name1.pth", "name2.onnx", ...]}.
    Falls back to DEFAULT_MODEL when no models are found.
    """
    models: set[str] = set()

    # Scan the local models directory for downloaded / manually-added model files
    if MODELS_DIR.exists():
        for f in MODELS_DIR.iterdir():
            if f.suffix.lower() in (".pth", ".onnx", ".ckpt"):
                models.add(f.name)

    # Augment with registry models (best-effort — registry may be unreachable)
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "audio_separator", "--list_models"]
            + (["--list_filter", args.filter] if args.filter else [])
            + ["--list_limit", str(args.limit)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        for line in (proc.stdout or "").split("\n"):
            line = line.strip()
            for ext in (".pth", ".onnx", ".ckpt"):
                if ext in line:
                    parts = line.split()
                    if parts and parts[0]:
                        models.add(parts[0])
                    break
    except Exception:
        pass  # Registry failure is non-fatal — local models still included

    result = sorted(models) if models else [DEFAULT_MODEL]
    emit({"stage": "done", "models": result})
    return 0


def cmd_clear_models(args: argparse.Namespace) -> int:
    """Remove all downloaded models from the models directory."""
    if MODELS_DIR.exists():
        shutil.rmtree(MODELS_DIR)
        MODELS_DIR.mkdir(exist_ok=True)
    emit({"stage": "done", "message": "models cleared"})
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="Singray media pipeline (yt-dlp + audio-separator + ffmpeg)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    probe = sub.add_parser("probe", help="fetch YouTube or local-file metadata as one JSON object")
    probe_src = probe.add_mutually_exclusive_group(required=True)
    probe_src.add_argument("--url")
    probe_src.add_argument("--file", help="local media file to probe instead of a URL")
    probe.set_defaults(func=cmd_probe)

    search = sub.add_parser("search", help="ytsearch10 → JSON-lines result list")
    search.add_argument("--query", required=True)
    search.set_defaults(func=cmd_search)

    process = sub.add_parser("process", help="download or use a local file, separate, transcode")
    process_src = process.add_mutually_exclusive_group(required=True)
    process_src.add_argument("--url")
    process_src.add_argument("--file", help="local media file to import instead of a URL")
    process.add_argument("--out", required=True)
    process.add_argument("--model", default=DEFAULT_MODEL)
    process.add_argument("--format", choices=("flac", "m4a"), default="flac")
    process.set_defaults(func=cmd_process)

    align = sub.add_parser("align", help="forced-align lyric text against the vocals stem")
    align.add_argument("--song", required=True, help="song directory (vocals stem + meta.json)")
    align.add_argument("--text", required=True, help="path to a UTF-8 lyric text file")
    align.set_defaults(func=cmd_align)

    list_m = sub.add_parser("list-models", help="list available separation model filenames")
    list_m.add_argument("--filter", default="", help="optional model filter (vocals, inst, etc.)")
    list_m.add_argument("--limit", type=int, default=50, help="max models to list")
    list_m.set_defaults(func=cmd_list_models)

    clear_m = sub.add_parser("clear-models", help="delete all downloaded models")
    clear_m.set_defaults(func=cmd_clear_models)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
