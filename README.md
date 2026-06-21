# Singray

![Singray logo](resources/icon.png)

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
> design and [GitHub Issues](https://github.com/ngtongsheng/Singray/issues)
> for current work.

## Demo

**Library, browse & sing** — grid/list browse, search, open a song, pitch shift, guide vocal toggle

https://github.com/user-attachments/assets/6c56b56b-8c38-4758-b8ac-f2607033e0b4

**Manage a song** — edit title/artist & thumbnail crop, lyric creator text/tap/review steps

https://github.com/user-attachments/assets/d13bfa66-9cbe-43f2-be29-2a5d288462e4

**Add a song** — search YouTube in-app, real download + GPU stem separation, play the finished song

https://github.com/user-attachments/assets/a1ebf3a9-7a0b-401e-b031-5af6756087f0

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

> **v0.1.0 is released.** Download `singray-0.1.0-setup.exe` (Windows) or `singray-0.1.0.dmg`
> (macOS) from the [GitHub Releases page](https://github.com/ngtongsheng/Singray/releases).
>
> Windows SmartScreen will warn "Windows protected your PC" — click **More info → Run anyway**
> (expected for unsigned installers). macOS: right-click the app → **Open** → confirm, or run
> `xattr -dr com.apple.quarantine /Applications/Singray.app`.

The app manages its own Python pipeline on first launch (no manual setup needed). Advanced
users can point it at a dev venv via Settings → Pipeline. If the managed install fails or
you want to run from source, follow the steps below.

## Develop (run from source)

### Prerequisites

- **Node.js** 24+ and npm — run `mise install` to get the exact version pinned in
  `.tool-versions` ([mise](https://mise.jdx.dev/) manages it; install mise itself first).
- **Python** 3.13 or 3.11, reachable via the `py` launcher
- **ffmpeg** on `PATH` (`winget install ffmpeg`)
- **NVIDIA GPU** with recent drivers for GPU separation (CPU works but is slow).
  The pinned pipeline targets CUDA 12.8 (cu128) wheels.

### App

```powershell
mise install       # one-time: installs the Node version pinned in .tool-versions
npm install
npm run dev        # launch with HMR
npm run check      # Biome + tsc --noEmit (pre-commit hook runs this)
npm run build:win  # NSIS installer via electron-builder
```

### Python pipeline

```powershell
pipeline\setup.ps1            # Windows: creates pipeline\.venv with pinned deps (one time)
pipeline\setup.ps1 -Update    # bumps yt-dlp only
```

On macOS / Linux use the bash equivalent:

```bash
pipeline/setup.sh             # picks CUDA (Linux+NVIDIA), CPU, or MPS (macOS) torch
pipeline/setup.sh --update    # bumps yt-dlp only
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

## Platform status

Windows is the primary, tested target. The installer ships **unsigned** (no
code-signing certificate — not worth the cost for a personal app), so Windows
SmartScreen shows a blue **"Windows protected your PC — unknown publisher"**
warning on first run. To proceed: click **More info**, then **Run anyway**.
This is expected for unsigned software; it appears once, not on later launches.

**macOS builds are community-tested** —
the release workflow produces an **unsigned** `.dmg`, so on first launch macOS
will refuse to open it: right-click the app → **Open** → confirm, or run
`xattr -dr com.apple.quarantine /Applications/Singray.app`. Separation runs on
Apple Silicon (MPS) or CPU. Linux is supported for the pipeline/dev but has no
packaged build yet.

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
