# Singray

A personal desktop karaoke app. Build a local song library from YouTube links
or local files, split each track into vocal/instrumental stems, author
per-syllable lyric timing with a tap-along creator, and perform with synced
highlighted lyrics, pitch/tempo control, and a **dual-mix output** — the
audience (stream) hears the instrumental only, while your monitor hears the
instrumental plus a guide vocal.

Windows-first. Electron + React + TypeScript, with a Python pipeline for
download and stem separation. Built to drive a Yamaha AG06 + online singing
website streaming setup, but works standalone.

> **Status:** active development. See [`SPEC.md`](SPEC.md) for the full
> design and [`BACKLOG.md`](BACKLOG.md) for current state.

## Screenshots

<!-- Drop PNGs in docs/screenshots/ and reference them here. -->
_Library · Player · Lyric creator — screenshots coming with the first release._

## Features

- **Library** — fully local, folder-per-song, searchable and filterable by
  language. Sort by date added, most sung, or recently sung. Sing history is
  tracked (≥60% playback = one logged sing).
- **Add songs** three ways — paste a YouTube URL, search YouTube in-app, or
  import a local file (anything ffmpeg decodes: mp4, flac, wav, mp3, m4a, ogg…).
- **Automatic stem separation** — UVR karaoke model via `audio-separator`,
  GPU-accelerated. Outputs lossless FLAC stems by default (M4A optional).
- **Lyric creator** — paste lyrics and tap along to map per-syllable timing,
  import `.lrc` (plain + enhanced word-level), find synced lyrics via LRCLIB,
  or clean up messy lyrics with an LLM.
- **Karaoke player** — scrolling lyrics with per-syllable color wipe,
  click-to-seek, guide-vocal toggle, pitch shift (±semitones), tempo presets,
  and a Ken Burns / waveform stage backdrop.
- **Dual-mix output** — independent sink routing so stream and monitor get
  different mixes (Web Audio `setSinkId`).
- **LLM assist** (optional) — any OpenAI-compatible endpoint (local Ollama or
  hosted) for metadata cleanup and lyric tidy-up.
- **Localized** — English + 简体中文, follows OS locale. Adding a language is
  one folder (see [CONTRIBUTING](CONTRIBUTING.md)).

## Install (use the app)

> A packaged installer ships with the first GitHub Release. Until then, run
> from source (below).

The app needs a Python pipeline for download + separation. The dev path sets
this up via `pipeline/setup.ps1`; an app-managed first-run bootstrapper is on
the roadmap (see `BACKLOG.md` R4.3).

## Develop (run from source)

### Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.13 or 3.11, reachable via the `py` launcher
- **ffmpeg** on `PATH` (`winget install ffmpeg`)
- **NVIDIA GPU** with recent drivers for GPU separation (CPU works but is slow).
  The pinned pipeline targets CUDA 12.8 (cu128) wheels.

### App

```powershell
npm install
npm run dev        # launch with HMR
npm run check      # Biome + tsc --noEmit (pre-commit hook runs this)
npm run build:win  # NSIS installer via electron-builder
```

### Python pipeline

```powershell
pipeline\setup.ps1            # creates pipeline\.venv with pinned deps (one time)
pipeline\setup.ps1 -Update    # bumps yt-dlp only
```

This installs `torch` (cu128), `audio-separator[gpu]`, `yt-dlp`, and `whisperx`
into `pipeline\.venv`, then verifies CUDA is available. See `SPEC.md` §2.1 for
why versions are pinned the way they are.

## Architecture

Electron main process owns `fs`, the import job queue, settings, and a typed
IPC contract. The renderer (React) never touches `fs` or `child_process` — it
talks only through that contract. The audio engine lives in the renderer (Web
Audio). Python is spawned per import job (not a long-running server) and streams
JSON-lines progress back to main.

```
main (TS): library · import queue · settings · IPC
  │ IPC (contextBridge)          │ spawn, stdout JSON-lines
renderer (React): library ·      python pipeline.py:
  player · creator · settings ·    yt-dlp → audio-separator → ffmpeg → library
  audio engine
```

Full detail, data model, pipeline contract, and audio routing: [`SPEC.md`](SPEC.md).

## Third-party tools & usage notice

Singray orchestrates external tools that you install yourself:

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** downloads audio from YouTube
  and other sites. Downloading copyrighted content may violate the source
  site's Terms of Service and/or copyright law in your jurisdiction. This app
  is for **personal use** with content you have the right to use. You are
  responsible for how you use it.
- **UVR / [audio-separator](https://github.com/nomadkaraoke/python-audio-separator)**
  and the underlying separation models have their own licenses — review them
  before redistributing separated stems.
- **ffmpeg**, **PyTorch**, **WhisperX**, and **LRCLIB** are likewise governed
  by their respective licenses and terms.

No copyrighted audio, models, or downloaded content ship with this repository.

## License

MIT — see [LICENSE](LICENSE).
