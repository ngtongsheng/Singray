"""Singray media pipeline: YouTube download + UVR stem separation.

Contract (SPEC §5.2): JSON to stdout. `probe` prints one object; `process`
streams JSON-lines progress. Non-zero exit + {"stage": "error"} on failure.
"""

import argparse
import json
import sys


def cmd_probe(args: argparse.Namespace) -> int:
    _ = args.url
    print(json.dumps({"stage": "error", "message": "probe not implemented (S1.1)"}))
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
