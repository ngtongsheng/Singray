"""Singray media pipeline: YouTube download + UVR stem separation.

Contract (SPEC §5.2): JSON to stdout. `probe` prints one object; `process`
streams JSON-lines progress. Non-zero exit + {"stage": "error"} on failure.
"""

import argparse
import json
import sys

import yt_dlp


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


def cmd_process(args: argparse.Namespace) -> int:
    _ = (args.url, args.out, args.model)
    print(json.dumps({"stage": "error", "message": "process not implemented (S1.2)"}))
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
    process.add_argument("--model", default="6_HP-Karaoke-UVR.pth")
    process.set_defaults(func=cmd_process)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
