# Singray — Personal Desktop Karaoke App

**Spec & Development Plan** · v1.0 · 2026-06-10

A personal-use desktop app: build a karaoke library from YouTube links (download → vocal/instrumental stem split), author per-syllable lyric timing with a tap-along creator, and perform with synced highlighted lyrics, a private guide-vocal monitor mix, and pitch control — integrated with a Yamaha AG06 mixer + online singing website streaming setup.

---

## 1. Goals & Non-Goals

### Goals
- Search/filterable song library, fully local.
- Add songs by pasting a YouTube URL; automatic download + stem separation in the background.
- Interactive lyric timing creator: paste text, tap Space along with the song to map per-syllable timing.
- Karaoke player: scrolling lyrics with per-syllable color wipe, click-to-seek, guide-vocal toggle, pitch shift.
- **Dual-mix output**: audience (stream) hears instrumental only; performer's monitor hears instrumental + guide vocal.
- Windows first; architecture keeps a clean path to macOS.

### Non-Goals (v1)
- No unit tests.
- No multi-user features, no cloud sync, no scoring.
- No auto lyric fetching or LLM metadata enrichment (was deferred from MVP; landed in Round 3 — see §12).

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | Electron | Windows now, macOS later |
| Frontend | React 18 + TypeScript + Vite | via `electron-vite` |
| Main process | TypeScript | fs, spawn, job queue, IPC |
| Audio engine | Web Audio API (renderer) | `AudioContext.setSinkId` for device routing (Chromium ✓) |
| Pitch/tempo | SoundTouch WASM (vendored `soundtouch.js` + `soundtouch-processor.js`) | AudioWorklet-based; vendored into `src/renderer/public/worklets/` |
| Stem split pipeline | Python (native Windows, 3.13 or 3.11) | port of `audio_stems.py`, WSL paths removed |
| Separation model | UVR `6_HP-Karaoke-UVR.pth` via `audio-separator[gpu]` | torch cu128, RTX 5060 Ti |
| Download | `yt-dlp` | metadata via `--dump-json` |
| Transcode | `ffmpeg` | WAV → M4A AAC 256k |
| Packaging | `electron-builder` | NSIS installer; dmg later |
| Storage | Folder-per-song + JSON files | no database |
| Lint/format (TS) | Biome | replaces ESLint + Prettier, one fast binary |
| Lint/format (Python) | ruff (in pipeline venv) | `ruff check` + `ruff format` |
| Type safety | `tsc --noEmit` in strict mode | vibe-coding guardrail #1 |

### 2.1 Pinned versions (latest as of 2026-06-10, verified against npm/PyPI)

| Package | Version |
|---|---|
| react / react-dom | ^19.2.7 |
| electron | ^42.4.0 |
| electron-vite | ^5.0.0 |
| vite | ^8.0.16 |
| electron-builder | ^26.15.2 |
| typescript | ^6.0.3 |
| @types/react | ^19.2.17 |
| tailwindcss | ^4.3.0 |
| motion | ^12.40.0 (R2.2) |
| @biomejs/biome | ^2.4.16 |
| yt-dlp (pip) | 2026.6.9 |
| audio-separator[gpu] (pip) | 0.44.2 |
| torch (pip, cu128 index) | 2.8.0+cu128 (+ torchvision 0.23.0+cu128, torchaudio 2.8.0+cu128) — whisperx 3.8.6 pins torch~=2.8.0; the +cu128 tag is required or pip "satisfies" the pin with a CPU build |
| whisperx (pip, Phase 2 alignment) | 3.8.6 |

Policy: scaffold with these; npm deps use caret ranges, Python deps pinned exact in `setup.ps1` (torch/CUDA churn is the fragile axis). `setup.ps1 -Update` bumps yt-dlp only. Note TypeScript 6.x and Vite 8 are current majors — if electron-vite 5 templates lag behind either, prefer the template's working combination over forcing the newest major, then bump.

### 2.2 Code quality guardrails (vibe-coding safety net)

No unit tests, so static tooling carries the weight:

- **Biome** (`biome.json`): formatter + linter for TS/TSX/JSON, recommended ruleset + `noExplicitAny` as warning, organize-imports on. One binary, instant.
- **TypeScript strict**: `"strict": true`, `"noUncheckedIndexedAccess": true`. IPC layer fully typed end-to-end — the contract in §8 is the single source of types shared by main/preload/renderer.
- **ruff** (in pipeline venv): `ruff check` + `ruff format` for `pipeline.py`.
- **npm scripts**: `check` = `biome check . && tsc --noEmit` (and `check:py` = ruff). Run green before every story commit (CLAUDE.md rule).
- **Pre-commit hook** via `simple-git-hooks`: runs `npm run check`. Small app — full check stays fast; drop to lint-staged only if it ever drags.

**Existing asset:** `C:\Users\PC\Documents\Skills\skills\audio-stems\scripts\audio_stems.py` — reference implementation. It targets WSL (`python3.12`, `/mnt/c/...` paths, WSL→exe bridging, Ollama renaming). The app gets a **ported, simplified** `pipeline.py`: native Windows paths, no Ollama, JSON-lines progress protocol.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Electron Main (TypeScript)                              │
│  • Library service: scan/read/write song folders        │
│  • Import queue: one job at a time, spawns Python       │
│  • Settings store (JSON in userData)                    │
│  • IPC handlers (typed contract, §8)                    │
└──────────────┬───────────────────────────┬──────────────┘
               │ IPC (contextBridge)       │ spawn, stdout JSON-lines
┌──────────────▼──────────────┐  ┌─────────▼──────────────┐
│ Renderer (React + TS)       │  │ Python pipeline.py     │
│  • Library screen           │  │  1. yt-dlp metadata    │
│  • Import dialog/queue UI   │  │  2. yt-dlp download    │
│  • Lyric creator            │  │  3. audio-separator    │
│  • Karaoke player           │  │  4. ffmpeg → M4A ×3    │
│  • Audio engine (§9)        │  │  5. move into library  │
│  • Settings screen          │  └────────────────────────┘
└─────────────────────────────┘
```

- Renderer never touches `fs` directly; everything via typed IPC.
- Audio decoding/playback lives in the renderer (Web Audio); main process only serves file paths (`file://` or custom `karaoke://` protocol for media).
- Python is spawned per import job; not a long-running server.

---

## 4. Data Model

### 4.1 Library layout

```
C:\Users\PC\Karaoke\               ← library root (configurable in settings)
  <song-id>\                       ← e.g. 20260610-183022-a1b2 (timestamp + rand)
    original.m4a                   ← full mix, reference for timing creator
    instrumental.m4a               ← stem
    vocals.m4a                     ← stem
    meta.json
    lyrics.json                    ← absent until lyrics authored
    thumb.jpg                      ← YouTube thumbnail
```

### 4.2 `meta.json`

```jsonc
{
  "schemaVersion": 1,
  "id": "20260610-183022-a1b2",
  "title": "光辉岁月",
  "artist": "Beyond",
  "language": "zh",              // "zh" | "en" | "ja" | ... | "unknown"
  "youtubeUrl": "https://youtu.be/abc123",
  "youtubeTitle": "Beyond - 光辉岁月【官方MV】",   // raw, kept for re-enrichment
  "durationSec": 312.4,
  "addedAt": "2026-06-10T18:30:22+08:00",
  "favorite": false,
  "tags": [],
  "playCount": 0,
  "lastPlayedAt": null,
  "separationModel": "6_HP-Karaoke-UVR",
  "enrichment": null             // reserved: future LLM metadata enrichment (§12)
}
```

### 4.3 `lyrics.json`

```jsonc
{
  "schemaVersion": 1,
  "language": "zh",
  "lines": [
    {
      "start": 26.488,             // seconds (float), line start
      "end": 32.419,               // line end (= next line start, capped; see §6.4)
      "text": "不是想怎么来就怎么活",
      "units": [
        { "text": "不", "t": 26.488 },   // t = unit start, seconds
        { "text": "是", "t": 26.639 },
        // ... unit end = next unit's t; last unit ends at line end
      ]
    },
    { "start": null, "end": null, "text": "", "units": [] }   // break marker (instrumental gap)
  ]
}
```

Conversion note: the legacy `karaoke.add('00:26.488','00:32.419','不是…','151,215,…')` format (per-char *durations* in ms) maps losslessly to this model (cumulative sums). No importer in v1, but the model is compatible if one is wanted later.

### 4.4 Tokenization rule (text → units)

- Each CJK character (Han, Kana, Hangul) → one unit.
- Each contiguous Latin/digit run (word) → one unit.
- Punctuation/whitespace attaches to the preceding unit's display text but is never a unit itself.
- Implemented with `Intl.Segmenter` granularity `grapheme` + script classification; one shared TS function used by both creator and player.

### 4.5 `settings.json` (Electron `userData`)

```jsonc
{
  "libraryDir": "C:\\Users\\PC\\Karaoke",
  "pythonPath": "C:\\Users\\PC\\Projects\\singray\\pipeline\\.venv\\Scripts\\python.exe",
  // Audio routing
  "audioOutputMode": "single",    // "single" | "dual"
  "monitorDeviceId": "",          // AG06 USB output
  "streamDeviceId": "",           // VB-Cable input
  // Player UI
  "playerBarPinned": true,        // R1.2: control bar pinned vs 3s auto-hide
  "showWaveform": false,          // stage top-strip waveform
  "showBars": false,              // stage live analyser bars
  "libraryView": "grid",          // "grid" | "list" — library layout
  // Pipeline / import
  "stemFormat": "flac",           // R3.8: "flac" | "m4a" — encode for new imports
  "separationModel": "6_HP-Karaoke-UVR.pth",
  // Language list (R2.4): drives import form, filter chips, alignment
  "languages": [
    { "code": "zh", "label": "中文" },
    { "code": "en", "label": "English" }
  ],                              // "unknown" always offered implicitly; removing never touches song metas
  "uiLanguage": "",               // R2.5: locale folder name, '' = follow OS
  // LLM assist (R3.1, R3.2)
  "llmProvider": "ollama",        // provider preset — selects base URL + auth shape
  "llmBaseUrl": "http://localhost:11434/v1", // Ollama-only override
  "llmModel": "",                 // model name, e.g. "gemma4:12b-it-qat" or "gpt-4o-mini"
  "llmApiKey": "",                // bearer token for cloud providers, '' = none
  // Microphone (R3.MIC*)
  "micDeviceId": "",              // audioinput device, '' = system default
  "micEnabled": false,            // build mic graph when player loads
  "micMonitor": false,            // R3.MIC2: monitor leg audible (false = AG06 hardware-monitor)
  "micVolume": 0.8,               // R3.MIC2: gain 0..1
  "micFxPreset": "none",          // R3.MIC3: FX preset
  "micFxAmount": 0.3,             // R3.MIC3: wet/dry 0..1
  // Recordings (R3.REC1)
  "recordingFormat": "webm",      // "webm" | "wav"
  // Playback
  "countdownLead": 3              // lead-in countdown seconds (0 = off)
}
```

---

## 5. Import Pipeline

### 5.1 User flow

1. Library screen → **Add Song** → paste YouTube URL.
2. App fetches metadata (`yt-dlp --dump-json --no-download`) → form prefilled with parsed title/artist (use `track`/`artist` fields when present, else split `title` on `-`/`–`/`「」` heuristics), thumbnail preview, language dropdown.
3. User corrects fields → **Add** → job enters queue, dialog closes.
4. Library shows the song card immediately with status badge: `downloading` → `separating` → `converting` → `ready` (or `error` with retry button).
5. Multiple URLs can be queued; jobs run **one at a time** (GPU serialization).

### 5.2 `pipeline.py` contract

```
python pipeline.py probe   (--url <url> | --file <path>)
python pipeline.py search  --query <text>                          # ytsearch10 result list
python pipeline.py process (--url <url> | --file <path>) --out <songDir> [--model 6_HP-Karaoke-UVR.pth]
python pipeline.py align   --song <songDir> --text <lyrics.txt>     # forced alignment (§6.6)
```

- `probe`: prints one JSON object to stdout — `{title, channel, track, artist, duration, thumbnailUrl}`. With `--file` (R3.7) it ffprobes a local media file: duration + tag title/artist (title falls back to the filename stem), `channel`/`thumbnailUrl` empty.
- `search`: streams up to 10 `ytsearch10` hits as JSON-lines — `{title, channel, duration, thumbnailUrl, url}` per line, then exits. Uses yt-dlp **flat extraction** (`extract_flat`, no per-video metadata fetch) so the whole query returns in ~2s; the full `probe` runs only when the user picks a result. Errors use the same `{"stage": "error", "message": …}` + non-zero exit contract. Renderer's Add Song dialog shows the result list alongside the URL-paste box; picking a hit fills the URL field and runs the existing probe/prefill flow.
- `process`: streams JSON-lines progress to stdout:

```json
{"stage": "download",  "progress": 0.42}
{"stage": "separate",  "progress": 0.10}
{"stage": "convert",   "progress": 0.66}
{"stage": "done", "files": {"original": "original.m4a", "instrumental": "instrumental.m4a", "vocals": "vocals.m4a", "thumb": "thumb.jpg"}, "durationSec": 312.4}
{"stage": "error", "message": "..."}        // on failure, exit code != 0
```

- `align`: streams JSON-lines like `process` (`{"stage": "align", "progress": …}`); final line `{"stage": "done", "tokens": [{"text", "start", "score"}]}` — one token per CJK char or Latin word, `start`/`score` null when the aligner could not place it. Language read from the song's `meta.json` (`unknown` → `en`). All pipeline stdout is UTF-8 (`sys.stdout.reconfigure` — Windows defaults to cp1252, which cannot encode CJK tokens).
- `process --file <path>` (R3.7): skips the download stage — the local file is the source audio (duration via ffprobe; thumbnail from embedded cover art, else a video frame ~20% in, else placeholder). Accepts anything ffmpeg decodes (mp4/m4a/mp3/flac/wav/ogg/…); `-vn` drops video on encode. The renderer's "From file" picker uses a native `dialog.showOpenDialog`; the chosen path rides `ImportRequest.filePath` and is stored as `SongMeta.sourceFile` for retry.
- `process --format flac|m4a` (R3.8, default **flac**): chooses the stem encode. flac = lossless (no second lossy encode after separation); m4a = AAC 256k. Files are `original/instrumental/vocals.<ext>`. The renderer requests stems extensionless (`karaoke://<id>/<track>`); the protocol handler resolves to whichever encode exists (flac-first), so a library mixing both formats — and pre-R3.8 m4a songs — all play with no per-song metadata. `stemFormat` lives in Settings (Pipeline fieldset). Loudness/gain path is identical for both formats.
- Steps inside `process`: yt-dlp best-audio download (+ thumbnail) → audio-separator (VR arch, window 320, aggression 5, GPU) → **loudness normalization**: measure integrated loudness of the original (ffmpeg `loudnorm` print_format json, target −14 LUFS), apply the *same linear gain* to original + both stems (preserves vocal/instrumental balance — never per-file loudnorm on stems) → ffmpeg encode (flac lossless, or AAC 256k `-movflags +faststart`) for all three → write files into `--out`.
- Temp work in `%TEMP%`, cleaned on success and on failure.
- Cookies: reuse the existing yt-dlp cookie setup if age-restricted videos fail; native Windows yt-dlp can use `--cookies-from-browser` directly (no WSL DPAPI workaround needed).

### 5.2.1 App-managed pipeline environment (R4.3)

For end users (no dev checkout), the app installs and owns the pipeline env under `userData/pipeline-env/` so a fresh machine needs zero manual Python setup:

- **uv** standalone (downloaded from the GitHub release matching the platform/arch) is the package manager. It installs a managed CPython 3.13 (into `pipeline-env/python`) and creates the venv (`pipeline-env/venv`).
- **GPU detect**: `nvidia-smi -L` succeeds → CUDA wheels (`torch 2.8.0` + torchvision/torchaudio from the `cu128` index, `audio-separator[gpu]`); else CPU wheels (`cpu` index, `audio-separator[cpu]`). Versions match `setup.ps1`.
- **ffmpeg**: if not already on PATH, a static build is fetched into `pipeline-env/ffmpeg` and prepended to the child process PATH when spawning the pipeline — Windows: gyan.dev essentials zip; Linux: johnvansickle static; macOS (R5.1): evermeet.cx single-binary zips (ffmpeg + ffprobe fetched separately).
- **Resume / clean retry**: each install step is recorded in `pipeline-env/.install-state.json` and skipped on re-run; downloads write to a `<file>.part` and rename on completion, so an interrupted transfer is re-fetched cleanly. `verify` always re-runs (imports torch, checks CUDA on GPU boxes).
- **Path resolution** (`pipelineEnv.ts`): `effectivePythonPath()` = an existing `settings.pythonPath` (advanced override) wins, else the managed venv interpreter. So `pythonPath` becomes an optional override only; the dev `setup.ps1` venv default still works in a checkout. All pipeline spawns use `effectivePythonPath()` + `pipelineSpawnOptions()` (ffmpeg PATH injection).
- **UI**: IPC `pipeline:status` / `pipeline:install` (streams `pipeline:install:progress` events) / `pipeline:cancelInstall`. A first-run gate screen (shown when `status.ready` is false, dismissible via "Skip for now") and a Pipeline-fieldset installer in Settings both render `PipelineInstaller` (status chips + per-step progress + install/cancel).
- `setup.ps1` stays for dev (Windows). `setup.sh` (R5.1) is the macOS/Linux dev equivalent: macOS installs PyPI torch (MPS+CPU), Linux picks CUDA vs CPU index by `nvidia-smi`. Forced alignment (`cmd_align`) selects device CUDA → MPS → CPU with a runtime fallback to CPU on OOM/unsupported-op.
- **Release (R4.4/R5.2):** push to `main` → CI builds the NSIS `.exe` (Windows) and, in a dependent macOS job, an unsigned `.dmg`, both attached to a GitHub Release tagged `v<package.json version>` with notes auto-generated from merged PR titles. A separate manual/path-triggered `pipeline-macos` workflow smoke-tests `setup.sh` + probe + a short CPU separation on a macOS runner. macOS builds are labeled community-tested.

### 5.3 Main-process import queue

- FIFO queue persisted in memory only (crash = re-add manually; acceptable for personal use).
- Spawns the pipeline via `effectivePythonPath() pipeline.py process ...` (R4.3; was `settings.pythonPath`), parses stdout lines, forwards progress to renderer via IPC event `import:progress`.
- On `done`: writes `meta.json`, notifies renderer `library:changed`.
- On non-zero exit: song folder marked with `error.json` (message + timestamp); card shows retry/delete.

---

## 6. Lyric Creator

### 6.1 Entry

Song card → **Edit Lyrics**. Two-step screen: **(a) text**, **(b) timing**.

### 6.2 Text step

- Textarea, one lyric line per row; empty row = instrumental-break marker.
- On continue: tokenize each line (§4.4), persist draft text into `lyrics.json` (`units` with `t: null`).
- Re-entering text step after timing exists: warn that edited lines lose their timing (line-level diff keeps timing for untouched lines).
- **Find lyrics (R3.5):** "Find lyrics" searches LRCLIB (`src/main/lyricsFinder.ts`, keyless `GET /api/search` by title/artist) and lists candidates; a synced hit feeds the LRC import path (auto-timed), a plain-only hit fills the textarea. Fetched in main (renderer CSP blocks cross-origin).
- **LRC import (R3.4):** "Import LRC" loads a `.lrc` file (`src/shared/lrc.ts`). Plain LRC → line starts; per-unit times linearly interpolated within each line (`LyricUnit.estimated = true`), span capped so words don't stretch across instrumentals, `≥5s` gaps become break markers. Enhanced `<mm:ss.xx>` word timestamps anchor units. `[offset:±ms]` honored. Ends filled by `inferEnds`; existing timing prompts a replace confirm; malformed files rejected without touching the creator.

### 6.3 Timing step (tap-along)

Layout: waveform-less, pragmatic — top: audio transport; middle: large current line with per-unit state coloring (done / current / pending); bottom: full line list, current auto-centered.

Plays **`original.m4a`** (cleanest timing reference).

| Key | Action |
|---|---|
| `Space` (keydown) | Stamp current unit start = playback time; advance cursor. First unit of a line also sets line `start`. |
| `Backspace` | Undo last stamp, move cursor back one unit (works across line boundary). |
| `Enter` | Play/pause. |
| `←` / `→` | Seek −5s / +5s. When seeking back before already-stamped units, cursor follows (re-tap from there). |
| `↑` / `↓` | Playback rate cycle 1.0 / 0.85 / 0.7 / 0.5 (pitch-preserved via `preservesPitch`). |
| Click a line in list | Move cursor to that line's first unit and seek to just before it (its `start` − 2s if stamped, else current position). |

- Break markers are skipped automatically by the cursor.
- Auto-save `lyrics.json` after every stamp (debounced 1s). Crash-safe.

### 6.4 End inference (chosen model: tap = start only)

- `unit.end` (implicit) = next unit's `t`.
- Line `end` = next non-break line's `start`, **capped at line `start` of next + nothing… concretely**: `end = min(nextLine.start, lastUnit.t + MAX_TAIL)` where `MAX_TAIL = 5s`; if a break marker or end-of-song follows, `end = lastUnit.t + min(MAX_TAIL, gap)`.
- Last line of song: `end = min(lastUnit.t + MAX_TAIL, songDuration)`.

### 6.5 Waveform strip

Timing step shows a waveform of **`vocals.m4a`** (not the full mix) under the transport — vocal phrase onsets are visually obvious, so seeking to "just before the next phrase" is one click. Rendered once to a canvas from decoded peaks; playhead + stamped-unit ticks drawn over it. Click = seek.

### 6.6 Auto-align (forced alignment) — "Align" button in text step

`pipeline.py align`: runs WhisperX (3.8.6) on `vocals.m4a` (clean separated vocal = ideal ASR input, GPU reused) in **alignment mode** against the user-pasted lyric text → per-word/char timestamps → stdout JSON. App merges into `lyrics.json`: matched units get `t`, low-confidence or unmatched units stay `null`. Creator then opens timing step in **fix-up mode**: cursor jumps between null/suspect units; full re-tap of any line still available.

- Expectation: near-perfect for English, decent-to-rough for Chinese (CJK alignment varies by model) — tap mode remains the refiner, alignment kills the cold start.
- Failure (no GPU memory, model download fail, gibberish confidence): non-fatal, creator proceeds as pure tap mode.

### 6.7 Review mode

Toggle in timing step: plays song with the real player renderer (§7) inline so timing can be eyeballed; `Space` and `Enter` both play/pause (Player muscle memory) — stamping is fully disabled in review. Leaving review (via the Tap/Review switch, or Ctrl+Tab once the creator step-tabs land) re-enters tap mode at the line currently playing. No separate per-unit nudge editor in v1 — re-tapping a line is the correction tool.

---

## 7. Karaoke Player

### 7.1 Screen

- Launched from song card **Sing**. Near-fullscreen view, `Esc` exits.
- Background: blurred `thumb.jpg`. Foreground: scrolling centered lyric list.
- Current line: enlarged, per-unit color wipe (smooth gradient sweep across the current unit interpolated between `t` and unit end — not per-unit blink).
- Past lines dimmed, future lines normal; auto-scroll keeps current line vertically centered (smooth).
- Break markers render as a dot-countdown (● ● ●) during gaps ≥ 5s.
- Click any line → seek to its `start`.

### 7.2 Controls (bottom bar, auto-hide)

- Play/pause (`Space`), seek bar, elapsed/total.
- **Guide vocal toggle** (`V`) + vocal volume slider — affects monitor mix only (dual mode).
- Instrumental volume.
- **Key**: − / 0 / + semitone stepper, range ±6 (`[` / `]`).
- **Tempo**: 0.75–1.25, pitch-preserved (rarely used; hidden behind a small menu).

### 7.3 Sync rule

Lyric clock = audio engine's authoritative playback position (derived from `AudioContext.currentTime` − start offset, adjusted for rate). UI ticks on `requestAnimationFrame`. Pitch shift (semitones) does not alter the clock; tempo change scales it.

---

## 8. IPC Contract (preload, typed)

Full type source: `src/shared/types.ts` (`SingrayApi`, `IpcMap`). Below is the readable summary.

```ts
// ── Library ──────────────────────────────────────────────────────────────────
library.list(): SongListItem[]           // SongMeta + derived {hasLyrics, error}
library.delete(id): void
library.updateMeta(id, patch): SongMeta
library.openFolder(id): void             // open song folder in Explorer
library.uploadThumb(id, bytes): void     // save ArrayBuffer as thumb.jpg (R3.TH*)
library.setThumbFromUrl(id, url): void   // download URL → thumb.jpg
library.searchArtwork(query): ArtworkResult[]  // iTunes artwork search

// ── Lyrics ───────────────────────────────────────────────────────────────────
lyrics.get(id): Lyrics | null
lyrics.save(id, lyrics): void
lyrics.align(id, text): AlignToken[]    // forced alignment §6.6, slow, rejects on failure
lyrics.findLyrics(query): LrclibHit[]   // LRCLIB search (R3.5)

// ── Import ───────────────────────────────────────────────────────────────────
import.probe(url): ProbeResult
import.probeFile(path): ProbeResult     // local file probe (R3.7)
import.pickFile(): string | null        // native open dialog, null = cancelled
import.getPathForFile(file: File): string  // drag-drop File → FS path (webUtils)
import.search(query): SearchResult[]    // ytsearch10 (R3.SNG1)
import.start(req: ImportRequest): jobId
import.retry(id): void

// ── Settings ─────────────────────────────────────────────────────────────────
settings.get(): Settings
settings.set(patch): Settings

// ── Pipeline (R4.3) ──────────────────────────────────────────────────────────
pipeline.status(): PipelineStatus
pipeline.install(): void                // streams pipeline:install:progress events
pipeline.cancelInstall(): void
pipeline.onInstallProgress(cb): unsubFn
pipeline.listModels(force?): string[]   // available separation models

// ── LLM assist (R3.1/R3.2/R3.6) ─────────────────────────────────────────────
llm.test(): LlmTestResult
llm.listModels(provider, baseUrl, apiKey): string[]
llm.enrichProbe(probe): EnrichResult    // import prefill cleanup, never rejects
llm.cleanMeta(input): EnrichResult      // "Clean up with AI" for existing song
llm.cleanLyrics(input): string          // strip section tags / credits (R3.6)

// ── Audio ────────────────────────────────────────────────────────────────────
audio.url(id, track): string    // karaoke://<id>/<track> — extensionless, flac-first
audio.thumbUrl(id, version?): string  // karaoke://<id>/thumb.jpg[?v=N] for cache-busting

// ── Recordings (R3.REC1) ─────────────────────────────────────────────────────
recordings.save(songId, bytes, ext): string  // save ArrayBuffer under recordings/; returns path
recordings.list(songId?): RecordingItem[]    // omit songId = all library recordings
recordings.delete(path): void
recordings.reveal(path): void               // open containing folder in Explorer

// ── Window (NAV1 custom titlebar) ────────────────────────────────────────────
window.minimize(): void
window.toggleMaximize(): void
window.close(): void
window.isMaximized(): boolean
window.onMaximizedChange(cb): unsubFn
window.openExternal(url): void    // system browser

// ── Events (main → renderer) ─────────────────────────────────────────────────
import:progress          {jobId, songId, stage, progress}
library:changed          ()
pipeline:install:progress InstallEvent
window:maximized-changed boolean
```

Media served via custom `karaoke://` protocol handler (registered privileged, supports range requests) — avoids `file://` CORS/security weirdness with Web Audio `fetch` + `decodeAudioData`.

---

## 9. Audio Engine (the interesting part)

### 9.1 Requirements recap

- Two stems played in perfect sync (instrumental + vocals).
- Pitch shift ±6 semitones, optional tempo change, both via SoundTouch.
- **Dual mode**: two output devices, different mixes:
  - **Monitor** (AG06 USB): instrumental + guide vocal (toggleable).
  - **Stream** (VB-Cable): instrumental only.
- **Single mode** (default until configured): everything → system default device, vocal slider behaves normally.

### 9.2 Graph (dual mode)

```
instrumental.m4a ─decode→ AudioBuffer ┐
vocals.m4a       ─decode→ AudioBuffer ┤  (decoded once, shared)
                                      │
        ctxMonitor (setSinkId: AG06)  │   ctxStream (setSinkId: VB-Cable)
        ──────────────────────────    │   ─────────────────────────────
        src(instr) ─ SoundTouch ─ gainInstr ─┐        src(instr) ─ SoundTouch ─ gainInstr ─→ dest
        src(vocal) ─ SoundTouch ─ gainVocal ─┴→ dest
```

- Each `AudioContext` owns its own buffer sources + SoundTouch worklet (same semitone/tempo params pushed to both).
- AudioBuffers are decoded once and handed to both contexts (copy if required by context mismatch).

### 9.3 Cross-context sync strategy

Two `AudioContext`s have independent clocks → drift risk. Mitigation:

1. **Master clock** = `ctxMonitor`. All UI/lyric time derives from it.
2. Start: schedule both contexts' sources at `ctx.currentTime + 0.15` (aligned wall-clock start using `performance.now()` correlation).
3. **Drift check** every 5s: estimate each context's playhead; if |drift| > 25ms, hard-resync the stream context (stop sources, restart at master position). Stream side resync is inaudible to the performer and a 25ms blip is acceptable on stream.
4. Pause/seek/key-change always tears down and rebuilds sources on both contexts at the same target position (sources are cheap).

Fallback if `AudioContext.setSinkId` misbehaves with ASIO-ish devices: render stream mix via `MediaStreamAudioDestinationNode` → `<audio>` element with `setSinkId` (element-level routing is the older, very-stable path).

### 9.4 SoundTouch integration

- AudioWorklet wrapping the vendored SoundTouch JS port (`src/renderer/public/worklets/soundtouch.js` + `soundtouch-processor.js` — Vite cannot bundle worklet module graphs, so these are static assets). Engine-level parameters: `pitchSemitones` (±6), `tempo` (0.75–1.25).
- The worklet itself does **pitch shifting only** (frame-count 1:1, so the push model from a live source can't underrun). Tempo is implemented as `AudioBufferSourceNode.playbackRate = tempo` plus a compensating pitch offset of `−12·log2(tempo)` semitones in the worklet; the user's key change adds on top. Master clock scales: position advances at `tempo ×` wall rate, which also keeps the lyric clock in sync for free.
- At effective pitch 0 (key 0, tempo 1) the worklet copies input to output verbatim — bit-transparent bypass, zero artifacts.
- Engaging/disengaging the shifter mid-song has a short (~latency) warm-up where the worklet outputs silence; acceptable for a manual key/tempo change.
- Phase 5 delivers this; until then the key/tempo controls are hidden.

### 9.5 External routing (documented in README, one-time setup)

1. Install VB-Cable + VoiceMeeter (free).
2. AG06 **TO PC** switch: `INPUT MIX` (or `DRY CH1-2`) — *not* LOOPBACK.
3. App settings: monitor device = AG06 (`Yamaha AG06 USB`), stream device = `CABLE Input`.
4. VoiceMeeter: input 1 = AG06 (your voice), input 2 = `CABLE Output` (app instrumental); output A1 = AG06 (optional), B1 = `VoiceMeeter Output (VAIO)`.
5. Singing website microphone = `VoiceMeeter Output`.

Result: audience = voice + instrumental; your AG06 phones = voice (hardware direct) + instrumental + guide vocal.

---

## 10. UI Design

### 10.1 Design direction

**"Dark stage"** — immersive dark theme (only theme), warm coral/orange accent taken from your reference apps, content-first. Library feels like a music app; player feels like a stage: everything recedes except lyrics.

### 10.2 Design tokens (Tailwind v4, shadcn vars)

Raw shadcn-named vars on `:root` hold the brand hex; `@theme inline` maps them to
`--color-*` so Tailwind generates `bg-background`/`text-foreground`/etc. The
`--color-*: initial` wipe keeps Tailwind's default palette out — only these tokens
compile. Same brand values as the original `--color-*` set, renamed in #14.

```css
/* shadcn surfaces / text — never raw hex in components */
--background: #0E0E12;        /* app background (was --color-bg) */
--card / --popover: #17171D;  /* cards, panels (was --color-surface) */
--secondary / --muted: #222230; /* raised: dialogs, hover (was --color-surface-2) */
--border / --input: #2E2E3A;  /* visible dividers on dark */
--foreground: #F2F2F5;        /* primary text, ≥4.5:1 everywhere (was --color-text) */
--muted-foreground: #A0A0B0;  /* secondary, ≥3:1 (was --color-text-dim) */

/* shadcn brand */
--primary / --ring: #FF5A3C;  /* coral — buttons, active states, sung lyrics (was --color-accent) */
--primary-foreground: #F2F2F5;
--destructive: #F4504C;       /* (was --color-danger) */

/* Brand extras with no shadcn slot (kept as custom utilities) */
--accent-soft: #FF8A3C;       /* gradient partner, progress, primary hover */
--success: #3ECF8E;  --warning: #F5B942;

/* Lyric-specific */
--lyric-pending: #E8E8EE;   /* unsung text */
--lyric-active:  #FFFFFF;   /* current line base */
--lyric-sung:    #FF5A3C;   /* wipe fill (gradient to --accent-soft) */

/* Shape & elevation — radius scale: rounded-md (8px) controls, rounded-lg (12px) cards */
--radius: 8px;  /* @theme inline derives --radius-sm/md/lg */
--shadow-raised: 0 4px 24px rgb(0 0 0 / 0.45);

/* Spacing: 4/8 rhythm only (4,8,12,16,24,32,48) */
/* z-index scale: 0 / 10 (sticky bar) / 30 (popover/select) / 40 (dialog/tooltip) / 100 (player overlay) */
```

Primitives (`components/ui/`) are shadcn/Radix: `cn()` (clsx + tailwind-merge) +
`cva`; Dialog/Select/Popover/Tooltip on Radix for focus-trap + roving focus +
collision-aware portals. `ui/` is exempt from the design-gate arbitrary-value rule
(Radix needs `w-[var(--radix-*)]`, `data-[state=…]`).

### 10.3 Typography

| Role | Font | Notes |
|---|---|---|
| UI | **Inter** (variable) | 14px base UI, 16px forms; weights 400/500/600 |
| Lyrics (player + creator) | **Noto Sans SC** (variable) → fallback `system-ui` CJK stack | Covers zh/ja + Latin in one face; player current line 40–56px weight 700, other lines 24–28px weight 500 |
| Timers/durations | Inter with `font-variant-numeric: tabular-nums` | no layout shift while ticking |

Both fonts bundled locally (offline app, no Google Fonts CDN). Type scale: 12 / 14 / 16 / 20 / 24 / 32 / 48.

### 10.4 Iconography & components

- **lucide-react** only — one stroke family (1.5px), no emoji-as-icon anywhere.
- Controls: minimum 36px hit targets (desktop+mouse; 44px for player's auto-hide bar since it's glanced at while singing).
- Every interactive element: visible hover + pressed + focus-visible ring (2px accent); app is keyboard-heavy by design.
- Buttons: one primary (accent fill) per screen; secondary = outline on `--border`; destructive = `--destructive` and physically separated.

### 10.5 Motion

- Micro-interactions 150–250ms, `ease-out` enter / `ease-in` exit (exit ≈ 70% of enter duration).
- **Lyric wipe: linear, driven by audio clock** — never eased; it must track time exactly (background-clip gradient on transform/opacity-safe properties; no width animation, no layout shift).
- Player auto-scroll: smooth translate ≈ 300ms ease-out when line changes.
- Card grid entrance: 30ms stagger, once per mount; respect `prefers-reduced-motion` (disable everything except the wipe — the wipe is information, not decoration).
- Status badge changes (downloading → separating → ready): crossfade in place.

### 10.6 Screen-level design notes

**Titlebar (all screens, R2.1)** — frameless window (`titleBarStyle: hidden` + Windows `titleBarOverlay` so snap layouts and min/max/close stay native). Custom 40px drag-region bar doubles as the persistent app header: library = app name + search + Add Song + settings gear; player = back + song title/artist + stage chrome buttons; creator = back + song + step actions; settings = back + heading. Interactive children opt out of the drag region (`app-no-drag`); the bar reserves the native caption strip via `env(titlebar-area-*)`.

**Library** — top bar (the titlebar): app name, search input (autofocus on `/`), Add Song primary button. Filter chips row under bar. Card: 16:9 thumb with bottom gradient scrim, title (1 line, ellipsis + tooltip), artist dim, ♥ top-right on hover, status badge bottom-left. Grid `repeat(auto-fill, minmax(220px, 1fr))`. Import progress: slim accent strip under top bar with stage label + percent. Empty state: centered mic icon + "Paste a YouTube link to add your first song" + Add button.

**Import dialog** — modal over 50% black scrim, thumb preview left, fields right; labels above inputs (never placeholder-only), error text under field in `--destructive`.

**Lyric creator** — two-pane focus mode (no nav chrome): transport bar pinned top with big readable timecode (tabular), current line huge center with per-unit state colors (sung = accent, current = white + underline caret, pending = dim), line list below at 40% opacity except current. Keyboard cheat-sheet strip pinned bottom (matches your reference screenshot's hint panel), dismissible.

**Player** — fullscreen, blurred `thumb.jpg` background under an 80% black scrim + bottom gradient to `--background` (lyric contrast always ≥4.5:1 regardless of artwork, even a pure-white thumbnail). Lyrics centered column, max-width 28ch (CJK) / 60ch (Latin). Control bar auto-hides after 3s idle, reappears on mouse move/any hotkey; guide-vocal toggle shows clear on/off state with icon + label (not color alone). Break countdown: three dots draining with the audio clock.

**Settings** — single scrolling form, grouped fieldsets (Library / Pipeline / Audio routing), helper text under each field, "Test" buttons inline with their field.

### 10.7 Hard rules (from UX review pass)

1. Contrast: all text pairs ≥4.5:1 on dark surfaces (verify accent-on-dark for small text; use `--accent-soft` for text-sized accent if needed).
2. No information by color alone — status badges carry text, vocal toggle carries label.
3. Library grid virtualizes at >100 songs (simple `content-visibility: auto` first; react-window only if it janks).
4. Player render loop: rAF reads audio clock, writes transform/clip only — zero layout work per frame.
5. All dialogs: `Esc` closes, focus trapped, focus returns to trigger.
6. Destructive delete: confirm dialog + names the song.

### 10.8 Screens inventory (v1, simple, enhance later)

1. **Library** (home): search box (title/artist, fuzzy-ish substring), filter chips (language, favorites, "needs lyrics"), responsive card grid (thumb, title, artist, status badge, ♥). Card actions: Sing / Edit Lyrics / ⋯ (edit meta, open folder, delete). **Add Song** button top-right; queue progress strip when jobs active.
2. **Import dialog**: URL paste → probe → editable form → queue.
3. **Lyric creator**: §6.
4. **Player**: §7.
5. **Settings**: library folder, python path + "Test pipeline" button (runs `pipeline.py probe` on a known URL), audio output mode + device pickers with "Play test tone", model name.

Dark theme only. No design system ceremony — plain CSS modules or Tailwind, whichever scaffolds faster with electron-vite.

---

## 11. Development Plan

### Phase 0 — Scaffold (½ day)
- [ ] `electron-vite` scaffold (React + TS), `electron-builder` config, repo at `C:\Users\PC\Projects\karaoke`.
- [ ] Typed IPC skeleton (preload bridge), `karaoke://` protocol, settings store.
- [ ] `pipeline/` folder: `setup.ps1` (creates `.venv`: yt-dlp, audio-separator[gpu], torch cu128; checks ffmpeg on PATH), empty `pipeline.py`.

**Exit:** app window opens, settings read/write works, venv builds and `python pipeline.py --help` runs.

### Phase 1 — Library + Import (1–2 days)
- [ ] Port `audio_stems.py` → `pipeline.py` (probe + process, JSON-lines, native paths, no Ollama, keep UVR params: window 320, aggression 5, GPU).
- [ ] Main: library scan service, import queue, progress forwarding.
- [ ] Renderer: library grid + search/filter, import dialog, progress badges, meta edit, delete.

**Exit:** paste URL → song becomes `ready` with 3 playable M4As + thumb; survives app restart; error path shows retry.

### Phase 2 — Lyric Creator (1–2 days)
- [ ] Tokenizer (shared TS module) + `lyrics.json` read/write IPC.
- [ ] Text step with break markers + re-edit diff guard.
- [ ] Timing step: transport on `original.m4a`, Space/Backspace/Enter/arrows per §6.3, end inference §6.4, debounced autosave.
- [ ] Vocals waveform strip (§6.5).
- [ ] Forced alignment: `pipeline.py align` (WhisperX on vocals stem) + fix-up mode (§6.6).

**Exit:** author full timing for one Chinese and one English song comfortably at 0.7× speed.

### Phase 3 — Player, single output (1 day)
- [ ] Audio engine v1: one `AudioContext`, dual stem sources, gain nodes, vocal toggle/slider.
- [ ] Lyric renderer: scrolling centered list, per-unit wipe (rAF + master clock), click-to-seek, break countdown.
- [ ] Review mode hook back into creator (§6.7). Play count tracking.

**Exit:** full karaoke session on default output; wipe visually matches singing.

### Phase 4 — Dual-mix routing (1 day + tinkering)
- [ ] Device enumeration + pickers + test tone in settings.
- [ ] Second `AudioContext` with `setSinkId`, mirrored graph, drift monitor + resync (§9.3).
- [ ] Guide-vocal toggle scoped to monitor context. Fallback path via `MediaStreamDestination` + `<audio>` if needed.
- [ ] README routing guide (§9.5); live test with AG06 + VoiceMeeter + singing website.

**Exit:** audience recording confirms zero guide-vocal leakage while monitor has vocal on.

### Phase 5 — Pitch & tempo (1 day)
- [ ] SoundTouch AudioWorklet integration, bypass at neutral, params mirrored to both contexts.
- [ ] Key stepper + tempo menu in player; clock scaling for tempo.

**Exit:** −2 key change sounds clean on both outputs, lyrics stay in sync.

### Phase 6 — Polish backlog (ongoing, optional)
- Per-unit timing nudge editor; LRC import; macOS build (`setup.sh`, MPS/CPU separation); fullscreen two-line stage mode; playlists/queue; LLM metadata enrichment + lyric fetch (§12).

---

## 12. LLM Integration

- **Client (R3.1, built)**: main-process module `src/main/llm.ts` — plain `fetch` against `<llmBaseUrl>/chat/completions` (OpenAI-compatible; covers Ollama, LM Studio, hosted providers), no SDK. Settings: `llmBaseUrl` (default `http://localhost:11434/v1`), `llmModel`, optional `llmApiKey` (Bearer header). 30s `AbortSignal.timeout` default; network/HTTP/shape errors rewritten to readable messages (connection refused, host not found, bad key, model not found, non-OpenAI response). Renderer reaches it only via typed IPC (`llm:test` today; enrichment/cleanup calls stay in main). Settings → AI assist fieldset has a Test button that round-trips a tiny prompt.
- **Metadata enrichment (R3.2, built)**: `src/main/enrich.ts`. Import prefill: probe result → `llm:enrichProbe` cleans title/artist (strip decoration, prefer the artist's local-script name) under a 3s budget; any failure (unreachable, slow, unconfigured, malformed reply) falls back to the heuristic (`src/shared/parseTitle.ts` + probe track/artist tags) — never rejects, `EnrichResult.source` says which path won. Edit-meta dialog: "Clean up with AI" (`llm:cleanMeta`) cleans the song's current values with raw `youtubeTitle` as context, shows a preview to apply/dismiss, surfaces errors. Model output parsed as JSON `{title, artist}` (code fences/chatter tolerated). Enrichment calls send `reasoning_effort: "none"` (thinking models otherwise burn the budget on hidden tokens; Ollama's /v1 honors it, servers that 400 on it get one retry without). `meta.enrichment` field still reserved.
- **Lyric cleanup (R3.6, built)**: `cleanLyrics({text,language})` in `src/main/enrich.ts` (`llm:cleanLyrics`) strips section tags + credit lines, collapses blank runs, never translates/rephrases/reorders (60s timeout, `reasoning_effort: "none"`, code-fence tolerant, no fallback). Creator text step "Clean up with AI" button → `CleanLyricsDialog` before/after diff (removed lines struck) → Apply just rewrites the textarea, so the existing re-edit guard (`buildLyrics` LCS diff) fires only for changed timed lines on Continue/Align.
- **Legacy format import**: `karaoke.add(...)` lines and `.lrc` map onto `lyrics.json` losslessly (§4.3, LRC import = R3.4).

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Dual-context drift / `setSinkId` quirks per device | Stream/monitor desync | Master-clock + periodic resync; `<audio>` element fallback; Phase 4 isolated so core app unaffected |
| torch/CUDA churn breaks venv | Import pipeline dead | Pinned versions in `setup.ps1`; pipeline failure never blocks library/player |
| yt-dlp breakage (YouTube changes) | Imports fail | `setup.ps1 -Update` flag to bump yt-dlp; errors surfaced with raw stderr |
| SoundTouch worklet artifacts at large shifts | Audio quality | Clamp ±6 semitones; bypass at neutral |
| Long separation time blocks adding many songs | Annoyance | Queue + background processing; library stays usable during jobs |
| `Intl.Segmenter` edge cases (mixed-script lines) | Bad units | Tokenizer is one pure function — fix cases as they appear; creator shows units before tapping |

---

## 14. Microphone & Recording (Round 3)

Extends §9 (Audio Engine) and §7 (Player). Adds a live microphone path (self-monitoring + reverb/echo) and performance recording. Grilled 2026-06-14; decisions baked. Backlog stories: `R3.MIC1-4`, `R3.REC1-2`, `R3.SET4`.

### 14.1 Goals & scope

- **Self-monitoring:** the singer hears their own voice through the app's monitor output, with a toggle to disable it (for users whose hardware — e.g. Yamaha AG06 — already monitors with zero latency).
- **Vocal FX:** preset reverb/echo on the mic, one wet/dry amount knob.
- **Recording:** capture the performance (instrumental + mic + FX, **no guide vocal**) to a file.
- **Non-goals (v1):** EQ (dropped); pitch/tempo on the live mic; noise-gate/compressor; per-band FX params; mic-level VU meter (see Unscheduled); mixdown transcode to mp3/m4a (webm/wav only for now).

### 14.2 Latency reality (decision)

Chromium on Windows has **no ASIO** — `getUserMedia → WebAudio → output` round-trips ~30–150ms (WASAPI shared mode). That is audible when monitoring your own voice. **Decision: ship the software monitor anyway**, labelled "may lag — prefer hardware monitoring (e.g. AG06)". Mitigations applied unconditionally:

- `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, deviceId } })` — the browser DSP chain otherwise adds latency and mangles singing.
- `AudioContext({ latencyHint: 'interactive' })` (both contexts).
- Mic path is **short**: source → (FX) → gain → destination. No SoundTouch, no extra buffering.

The AG06 user sets monitor-off and relies on hardware monitoring; the app still routes their mic into the recording (§14.5).

### 14.3 Routing model

The **recording tap lives on the monitor context** so recording works in every mode (including the common no-mixer / earphone case). On the monitor context one FX chain fans out (`micFxOut`) to two legs: the **monitor leg** (toggle-gated → speakers) and the **record leg** (always on → record tap), so muting your own monitor never drops the mic from the recording. The **stream leg** is a separate dual-mode **broadcast feed** to a *distinct* stream device only. Graph, extending §9.2:

```
                 getUserMedia(MediaStream)                ← one stream, shared
                  │                          │
   ctxMonitor     │                          │ ctxStream (dual mode, distinct stream device only)
   srcMic(monitor)                       srcMic(stream)   ← MediaStreamAudioSourceNode is per-context;
     │                                      │               each builds its own from the SAME stream
   micFX(monitor) → micFxOut             micFX(stream)     ← FX graph duplicated per context (§14.4)
       │        │                            │
   gainMicMon  gainMicRec                  gainMicStr ─→ destStr   (broadcast feed)
       │          │
     destMon    record tap (§14.5, with gainInstr; no guide vocal)
```

- A `MediaStreamAudioSourceNode` cannot be shared across contexts → build one **per context** off the single `MediaStream`. FX nodes likewise duplicate per context.
- **Mic bypasses the SoundTouch worklets entirely** — it is live voice; pitch/tempo shifting it is neither wanted nor feasible in real time. Key/tempo changes never touch the mic graph.
- The mic graph is **independent of the song sources**: it builds when mic is enabled and persists across play/pause/seek/tempo rebuilds (which only tear down `srcInstr`/`srcVocal`). It tears down when mic is disabled (and the `getUserMedia` track is stopped to release the device + mic indicator).
- **Dual mode requires a distinct, real stream device** (`streamDeviceId` non-empty and ≠ `monitorDeviceId`). Empty (= system default) or same-as-monitor would dump the mic onto the listener's own output with no way to silence it via the monitor toggle — so `load()` degrades that case to single mode (recording still works via the monitor-context tap; `routingWarning` set).
- Drift: the stream broadcast leg already runs the §9.3 resync watchdog. Recording is taken from the monitor (master) context, so it is unaffected by stream resync blips.

### 14.4 Monitor toggle, single mode, volume, FX

**Monitor toggle** mutes only the **monitor leg** (`gainMicMon → 0`, ramped) — what *you* hear. The **record leg (`gainMicRec`) and broadcast leg (`gainMicStr`) are untouched**, so a recording always captures your voice even when you monitor via hardware (AG06 case) with the software monitor off. This holds in **single mode too** (record leg lives on the monitor context), so toggling monitor off never silences the recording — and, because there is no audible stream leg, monitor-off genuinely silences the mic on your speakers (no leak).

**Volume:** mic gain on all legs, ramped click-free (reuse the §9 `RAMP` pattern). The monitor, record, and broadcast mic gains move together off one volume control; the monitor toggle is a separate mute on the monitor leg only.

**FX presets** (one set, applied to the mic path, duplicated per context so monitor and recording get identical FX):

| Preset | Graph |
|---|---|
| Off | mic → gain (no FX node) |
| Room | small reverb (short synth IR) |
| Hall | large reverb (long synth IR) |
| Echo | `DelayNode` (~250ms) + feedback `GainNode` (~0.35) |
| Karaoke | light reverb + light echo |

- **Reverb** = `ConvolverNode` fed a **synthesized impulse response** — a decaying-noise buffer generated at runtime (length/decay per preset). **No bundled audio files.**
- **Echo** = `DelayNode` + feedback `GainNode` + wet/dry mix.
- **Amount** = one wet/dry knob (`dryGain`/`wetGain` crossfade). Switching preset or amount ramps to avoid clicks.

### 14.5 Recording

**Source = the monitor bus** (`gainInstr` instrumental + `gainMicRec` mic record leg + FX, **guide vocal excluded by construction** — `gainVocal` is never tapped). That is exactly a clean karaoke take. **Works in every mode** (the tap lives on the monitor context), so the record button is **shown in single mode too** — the common no-mixer / earphone user can record.

- Tap: a `MediaStreamAudioDestinationNode` on `ctxMonitor` fed by `gainInstr` + `gainMicRec` (not `gainVocal`, not the toggle-gated `gainMicMon`) → `MediaRecorder` → `Blob`. It is not wired to any speaker, so it never leaks audio.
- Save: Blob → IPC → song folder `recordings/<ISO-timestamp>.<recordingFormat>`.
- **Format** configurable in Settings (`recordingFormat`, default `webm`): `webm` = `MediaRecorder` native (audio/webm; opus), zero encode; `wav` = decode + PCM-encode in the renderer. (mp3/m4a via bundled ffmpeg is a later option — Unscheduled.)
- State: explicit recording indicator in the player bar; stopping or exiting mid-record flushes/saves the partial file (guard against silent loss).

**Recordings view (`R3.REC2`):** a dedicated screen listing takes (associated to their song) with timestamp + duration and play / delete / reveal-in-folder. Playback via an `<audio>` element off a recordings file URL. Reachable from navigation (library header and/or the song-details modal).

### 14.6 Data model additions

`settings.json` (§4.5) gains:

```jsonc
{
  "micDeviceId": "",            // R3.MIC4: input device, '' = system default
  "micEnabled": false,          // R3.MIC4: mic path built on player load when true
  "micMonitor": true,           // R3.MIC2: monitor leg audible (false = AG06 hardware-monitor case)
  "micVolume": 1,               // R3.MIC2: 0..1
  "micFxPreset": "off",         // R3.MIC3: "off"|"room"|"hall"|"echo"|"karaoke"
  "micFxAmount": 0.3,           // R3.MIC3: wet/dry 0..1
  "recordingFormat": "webm"     // R3.SET4: "webm" | "wav"
}
```

Recordings live under each song folder: `<song>/recordings/<ISO-timestamp>.<ext>`. No central index file in v1 — the recordings view scans song folders (revisit if slow).

### 14.7 IPC additions (§8)

```ts
// invoke/handle
window.openExternal(url: string): void          // R3.SNG4: open YouTube source in default browser
recordings.save(songId, bytes: ArrayBuffer, ext: string): string   // → saved file path
recordings.list(songId?: string): RecordingItem[]                  // all, or per song
recordings.delete(path: string): void
recordings.reveal(path: string): void           // open OS folder
audio.recordingUrl(path: string): string        // karaoke:// URL for <audio> playback

// renderer-side (no IPC): getUserMedia, MediaStream graph, MediaRecorder all live in AudioEngine
```

Mic device + recording-format selection reuse `settings.get/set`. Mic capture, FX, and the `MediaRecorder` are entirely renderer-side (the engine owns them); only file persistence + external-open cross the IPC boundary.

### 14.8 Failure modes

- **Mic permission denied / no device:** surface a clear message (mirrors `routingWarning`); the rest of the player keeps working, mic stays disabled.
- **Saved `micDeviceId` device gone:** fall back to system default, warn (same pattern as the stream-device degrade in §9, `AudioEngine.load`).
- **Record requested in single mode:** not possible — button hidden; defensively, recording APIs no-op if `ctxStream` is null.
- **Exit / song-change mid-record:** stop the recorder and flush the file before tearing down `ctxStream` in `dispose()`.

### 14.9 Verification (by ear + by file — personal app, §conventions)

- Enable mic on a real input → voice audible on monitor; survives play/pause/seek/tempo; unaffected by key/tempo shift.
- Dual mode, monitor-off → mic silent on monitor but present in the saved recording; single mode, monitor-off → mic fully silent.
- Each FX preset audibly changes the voice; amount blends dry→wet; the saved take contains the same FX heard live.
- Recorded file = instrumental + mic + FX, **no guide vocal**; lands in `recordings/` in the configured format; plays back in the recordings view.
- Record button absent in single mode.
