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
- No in-app microphone capture or recording (AG06 + website chain owns voice).
- No multi-user features, no cloud sync, no scoring.
- No auto lyric fetching or LLM metadata enrichment (designed for, deferred — see §12).

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | Electron | Windows now, macOS later |
| Frontend | React 18 + TypeScript + Vite | via `electron-vite` |
| Main process | TypeScript | fs, spawn, job queue, IPC |
| Audio engine | Web Audio API (renderer) | `AudioContext.setSinkId` for device routing (Chromium ✓) |
| Pitch/tempo | SoundTouch WASM (`soundtouchjs` or `@soundtouchjs/audio-worklet`) | AudioWorklet-based |
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
| soundtouchjs | ^0.3.0 |
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
  "monitorDeviceId": "",          // AG06 USB output
  "streamDeviceId": "",           // VB-Cable input
  "audioOutputMode": "single"     // "single" | "dual"
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
python pipeline.py probe   --url <url>
python pipeline.py process --url <url> --out <songDir> [--model 6_HP-Karaoke-UVR.pth]
python pipeline.py align   --song <songDir> --text <lyrics.txt>     # forced alignment (§6.6)
```

- `probe`: prints one JSON object to stdout — `{title, channel, track, artist, duration, thumbnailUrl}`.
- `process`: streams JSON-lines progress to stdout:

```json
{"stage": "download",  "progress": 0.42}
{"stage": "separate",  "progress": 0.10}
{"stage": "convert",   "progress": 0.66}
{"stage": "done", "files": {"original": "original.m4a", "instrumental": "instrumental.m4a", "vocals": "vocals.m4a", "thumb": "thumb.jpg"}, "durationSec": 312.4}
{"stage": "error", "message": "..."}        // on failure, exit code != 0
```

- `align`: streams JSON-lines like `process` (`{"stage": "align", "progress": …}`); final line `{"stage": "done", "tokens": [{"text", "start", "score"}]}` — one token per CJK char or Latin word, `start`/`score` null when the aligner could not place it. Language read from the song's `meta.json` (`unknown` → `en`). All pipeline stdout is UTF-8 (`sys.stdout.reconfigure` — Windows defaults to cp1252, which cannot encode CJK tokens).
- Steps inside `process`: yt-dlp best-audio download (+ thumbnail) → audio-separator (VR arch, window 320, aggression 5, GPU) → **loudness normalization**: measure integrated loudness of the original (ffmpeg `loudnorm` print_format json, target −14 LUFS), apply the *same linear gain* to original + both stems (preserves vocal/instrumental balance — never per-file loudnorm on stems) → ffmpeg AAC 256k `-movflags +faststart` for all three → write files into `--out`.
- Temp work in `%TEMP%`, cleaned on success and on failure.
- Cookies: reuse the existing yt-dlp cookie setup if age-restricted videos fail; native Windows yt-dlp can use `--cookies-from-browser` directly (no WSL DPAPI workaround needed).

### 5.3 Main-process import queue

- FIFO queue persisted in memory only (crash = re-add manually; acceptable for personal use).
- Spawns `settings.pythonPath pipeline.py process ...`, parses stdout lines, forwards progress to renderer via IPC event `import:progress`.
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

Toggle in timing step: plays song with the real player renderer (§7) inline so timing can be eyeballed; `Space` re-enters tap mode at the current line. No separate per-unit nudge editor in v1 — re-tapping a line is the correction tool.

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

```ts
// invoke/handle
library.list(): SongListItem[]   // SongMeta + derived {hasLyrics, error} the cards need
library.delete(id: string): void
library.updateMeta(id: string, patch: Partial<SongMeta>): SongMeta
library.openFolder(id: string): void   // open song folder in Explorer
lyrics.get(id: string): Lyrics | null
lyrics.save(id: string, lyrics: Lyrics): void
lyrics.align(id: string, text: string): AlignToken[]  // forced alignment (§6.6), slow, rejects on failure
import.probe(url: string): ProbeResult
import.start(req: {url, title, artist, language, youtubeTitle}): jobId
import.retry(id: string): void
settings.get(): Settings
settings.set(patch: Partial<Settings>): Settings
audio.url(id: string, track: "original"|"instrumental"|"vocals"): string  // karaoke:// URL

// main → renderer events
import:progress {jobId, songId, stage, progress}
library:changed
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

- AudioWorklet wrapping SoundTouch WASM; parameters: `pitchSemitones`, `tempo`.
- At `pitch=0, tempo=1` the worklet bypasses processing (clean path, zero artifacts).
- Phase 5 delivers this; until then sources connect directly to gains and the key/tempo controls are hidden.

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

### 10.2 Design tokens (Tailwind v4 `@theme`)

```css
/* Color — semantic tokens, never raw hex in components */
--color-bg:            #0E0E12;   /* app background */
--color-surface:       #17171D;   /* cards, panels */
--color-surface-2:     #222230;   /* raised: dialogs, hover */
--color-border:        #2E2E3A;   /* visible dividers on dark */
--color-text:          #F2F2F5;   /* primary text, ≥4.5:1 everywhere */
--color-text-dim:      #A0A0B0;   /* secondary, ≥3:1 */
--color-accent:        #FF5A3C;   /* coral — buttons, active states, sung lyrics */
--color-accent-soft:   #FF8A3C;   /* gradient partner, progress */
--color-success:       #3ECF8E;
--color-danger:        #F4504C;

/* Lyric-specific */
--color-lyric-pending: #E8E8EE;   /* unsung text */
--color-lyric-active:  #FFFFFF;   /* current line base */
--color-lyric-sung:    #FF5A3C;   /* wipe fill (gradient to --color-accent-soft) */

/* Shape & elevation — one consistent scale */
--radius-card: 12px;  --radius-control: 8px;
--shadow-raised: 0 4px 24px rgb(0 0 0 / 0.45);

/* Spacing: 4/8 rhythm only (4,8,12,16,24,32,48) */
/* z-index scale: 0 / 10 (sticky bar) / 20 (dropdown) / 40 (dialog) / 100 (player overlay) */
```

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
- Buttons: one primary (accent fill) per screen; secondary = outline on `--color-border`; destructive = `--color-danger` and physically separated.

### 10.5 Motion

- Micro-interactions 150–250ms, `ease-out` enter / `ease-in` exit (exit ≈ 70% of enter duration).
- **Lyric wipe: linear, driven by audio clock** — never eased; it must track time exactly (background-clip gradient on transform/opacity-safe properties; no width animation, no layout shift).
- Player auto-scroll: smooth translate ≈ 300ms ease-out when line changes.
- Card grid entrance: 30ms stagger, once per mount; respect `prefers-reduced-motion` (disable everything except the wipe — the wipe is information, not decoration).
- Status badge changes (downloading → separating → ready): crossfade in place.

### 10.6 Screen-level design notes

**Library** — top bar: app name, search input (autofocus on `/`), Add Song primary button. Filter chips row under bar. Card: 16:9 thumb with bottom gradient scrim, title (1 line, ellipsis + tooltip), artist dim, ♥ top-right on hover, status badge bottom-left. Grid `repeat(auto-fill, minmax(220px, 1fr))`. Import progress: slim accent strip under top bar with stage label + percent. Empty state: centered mic icon + "Paste a YouTube link to add your first song" + Add button.

**Import dialog** — modal over 50% black scrim, thumb preview left, fields right; labels above inputs (never placeholder-only), error text under field in `--color-danger`.

**Lyric creator** — two-pane focus mode (no nav chrome): transport bar pinned top with big readable timecode (tabular), current line huge center with per-unit state colors (sung = accent, current = white + underline caret, pending = dim), line list below at 40% opacity except current. Keyboard cheat-sheet strip pinned bottom (matches your reference screenshot's hint panel), dismissible.

**Player** — fullscreen, blurred `thumb.jpg` background under a 55% black scrim + bottom gradient to `--color-bg` (lyric contrast always ≥4.5:1 regardless of artwork). Lyrics centered column, max-width 28ch (CJK) / 60ch (Latin). Control bar auto-hides after 3s idle, reappears on mouse move/any hotkey; guide-vocal toggle shows clear on/off state with icon + label (not color alone). Break countdown: three dots draining with the audio clock.

**Settings** — single scrolling form, grouped fieldsets (Library / Pipeline / Audio routing), helper text under each field, "Test" buttons inline with their field.

### 10.7 Hard rules (from UX review pass)

1. Contrast: all text pairs ≥4.5:1 on dark surfaces (verify accent-on-dark for small text; use `--color-accent-soft` for text-sized accent if needed).
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

## 12. Future Hooks (designed-in, not built)

- **LLM metadata enrichment**: `meta.enrichment` field reserved. Planned flow: web-search title/artist → LLM structured-output parse → user confirms diff. Raw `youtubeTitle` retained as input.
- **Lyric web fetch + LLM cleanup**: feeds the text step; tokenizer/timing untouched.
- **Legacy format import**: `karaoke.add(...)` lines and `.lrc` map onto `lyrics.json` losslessly (§4.3).

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
