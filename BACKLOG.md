# Singray — Story Backlog (Round 1: Enhancement)

Source: user feedback 2026-06-12 (`Some enhancement.md`), grilled + triaged. MVP backlog archived at `docs/rounds/00-mvp.md`.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (note why)

> **Now → R1.1** (update this pointer whenever a story starts/finishes)
>
> R0.1 (ear batch) + R0.2 (AG06) are user-side, can run anytime in parallel with coding stories — they don't block the pointer.

Workflow: one story at a time, top to bottom. A story is done only when every "Done when" line passes by actually running the app/script. On finish: mark `[x]`, move the **Now** pointer, append one line to the Session Log. Commit subjects: `R<story>: <what>`.

Triage decisions (from grilling session):
- Dropped: per-unit timing nudge editor, fullscreen two-line stage mode, playlists/up-next queue → Unscheduled.
- Tempo UI: radio presets inside existing popover (Gauge button stays).
- "Progress bar to bottom" = import progress strip → bottom status bar.
- Soundwave = AnalyserNode on monitor output mix (no mic capture).
- LLM: one OpenAI-compatible client (covers Ollama); triggers = probe prefill + edit-meta button + lyric cleanup.
- Lyrics: LRCLIB finder paired with LRC import (synced hit = auto-timed song).
- Python deps: first-run bootstrapper (no giant installer).
- macOS: CI build only, labeled community-tested.
- Repo: public, MIT.
- Window: frameless + custom titlebar that doubles as persistent app header.
- Motion: `motion` (framer-motion).
- Sing history (added 2026-06-12): ≥60% accumulated playback = one sing; timestamped `sings: []` log in meta.json, not bare counter.
- i18n (added 2026-06-12): i18next, locale folders for contributor PRs, follow OS locale with en fallback.
- Stems (added 2026-06-12): flac default (lossless post-separation), m4a via setting; local-file import for anything ffmpeg decodes.
- Record singing / effects / EQ: explicitly Round 2, recorded in candidates section.

---

## Phase 0 — MVP carry-over (user-side)

### [ ] R0.1 Ear-check batch
From MVP: S4.1 test tone audibly from each chosen device · S4.2 dual-output 5-min song no audible drift + first real sing-through (S3 sync/click-free/wipe-vs-voice piggyback) · S5.1 ±2 semitones clean on both outputs · S5.2 eyeball wipe during sing-through at −2 key and 0.85× tempo.
- **Done when:** all four checks confirmed by ear; failures spawn fix stories in this round.

### [!] R0.2 Live AG06 validation (blocked: VB-Cable + VoiceMeeter install + AG06 session — user-side setup)
Ex-S4.3 verbatim: routing per SPEC §9.5, AG06 TO PC = INPUT MIX, end-to-end with singing website, write `docs/ROUTING.md`.
- **Done when:** recording from website side has voice + instrumental, zero guide vocal, while monitor phones had vocal on.

## Phase 1 — UX fixes (library + player)

### [ ] R1.1 Card + navigation simplification
Remove hover action overlay (Sing/Lyrics/edit) from cards — whole card click → player. Heart (favorite) stays on card; fix favorite toggle bug (currently not toggling — diagnose, likely click swallowed by card-level handler). Edit-details + Lyrics entry points move into player (header menu or chrome — placement finalized with R2.1 titlebar in mind). Import progress strip moves from under top bar to a thin bottom status bar.
- **Done when:** clicking anywhere on card opens player; heart toggles + persists + survives restart; no hover overlay remains; edit-meta dialog and lyric creator both reachable from inside player; URL import shows progress in bottom status bar.

### [ ] R1.2 Player chrome rework
No autoplay on enter (explicit play). Bar pinned/visible by default; new unpin toggle switches to current auto-hide behavior (preference persists in settings). Control order: play → seek bar → instrumental volume → guide cluster → pitch → tempo. Guide cluster = vocal toggle + vocal volume grouped as one visual unit; guide vocal OFF by default. ←/→ seek ±5s. Fix pitch stepper wrap bug (`+n` text drops to second line — fixed width/tabular nums). Tempo popover: slider → radio preset list (0.75 / 0.85 / 0.9 / 0.95 / 1 / 1.05 / 1.1 / 1.25) + Reset.
- **Done when:** entering player is paused at 0:00; bar stays visible through a full song when pinned; unpin → 3s auto-hide returns; arrows seek ±5s; first play of any song has guide off; control order matches spec above; +6 pitch renders one line; tempo set via radio updates clock/wipe same as before.

### [ ] R1.3 Lyric fixes
Tokenizer: apostrophe (`'`/`’`) between letters is word-internal — "We're" = 1 unit, "don't" = 1 unit (fix in `src/shared/tokenize.ts` word-run logic; existing saved lyrics untouched, only new tokenization). Player no-lyrics state: drop the "No lyrics yet — time them in the lyric creator first" copy, show just an Add lyrics button (same affordance R1.1 adds).
- **Done when:** dev-console check `We're don't I've gone` → 4 units; alignment merge still works on a contraction-heavy English line; lyric-less song in player shows single button that opens creator on the right song.

### [ ] R1.4 Stage visuals
Blurred thumb background gets slow Ken Burns pan/zoom (transform-only, ~60s loop, paused when window hidden). Soundwave option: AnalyserNode on monitor context master → canvas wave/bars layered into stage (transform/paint only, no layout shift), toggle in player overflow, default off, persisted.
- **Done when:** pan visibly drifts over a minute with 0 layout-shift entries; wave moves with the music and stops when paused; toggle state survives restart; lyric wipe perf trace unchanged.

### [ ] R1.5 Sing history
Replace open-counts-as-play (S3.3 behavior): engine tracks accumulated playback time per session (seeks don't inflate it); when ≥60% of song duration → append ISO timestamp to `sings: []` in meta.json (once per session). `playCount`/`lastPlayedAt` migrate: existing playCount kept as legacy floor for sort, new sings array is source of truth going forward. Library: sort control (added / most sung / recently sung), card shows sing count.
- **Done when:** play 30s and exit → no sing logged; play >60% with a few seeks → exactly one timestamp appended; sort by most sung and recently sung both reorder correctly; old songs without `sings` don't crash and sort sanely.

## Phase 2 — App shell

### [ ] R2.1 Frameless window + unified titlebar
`frame: false`, custom titlebar: drag region, min/max/close (Windows snap via titlebar overlay or manual handling), doubles as persistent app header on every screen. Library: app name + settings gear. Player: back button + song title/artist (closes "no visual way back" feedback). Esc still exits player.
- **Done when:** window has no native frame; drag, double-click maximize, snap layouts, min/max/close all work; every screen shows the titlebar; player titlebar shows correct song + back returns to library; fullscreen behavior sane.

### [ ] R2.2 Motion pass
Add `motion`. View transitions library↔player↔creator↔settings (AnimatePresence), card grid entrance stagger, dialog/popover spring in/out, control bar pin/unpin slide. Respect `prefers-reduced-motion`.
- **Done when:** all four view switches animate smoothly; lyric wipe trace shows no added jank during/after transitions; reduced-motion OS setting disables them.

### [ ] R2.3 Design system components
`src/renderer/components/ui/`: Button, IconButton, Input, Select, Slider, Toggle, Chip, Dialog, Popover, Menu — semantic tokens only, variants via props. Migrate all screens; visual parity or better.
- **Done when:** grep finds no raw `<button>`/`<input>`/`<select>` outside `ui/`; every screen screenshot-compared sane; `npm run check` green.

### [ ] R2.4 Editable languages
Settings: language list (code + label), add/remove, defaults zh + en. Drives import form select, library filter chips, alignment language passed to whisperx. Removing a language keeps existing songs intact (chip still renders from song meta).
- **Done when:** add `ja` → appears in import form + filter chips; align on a ja song passes `ja`; remove `ja` → existing ja song still filterable; settings survive restart.

### [ ] R2.5 Localisation (zh + en)
i18next + react-i18next, locale JSON files under `src/renderer/locales/<lang>/` (contributor-friendly: one folder = one PR for a new language). All UI strings extracted; first run detects OS locale (zh* → zh, else en), override in settings. CONTRIBUTING gains a "add a translation" section (R4.1 if not landed yet, else amend).
- **Done when:** every screen renders fully in both languages with no hardcoded strings left (grep for literals in JSX); switching language in settings is instant, persists; OS set to zh → first run comes up Chinese; adding a stub `ja` folder makes it appear in the language select with no code change.

## Phase 3 — Integrations (LLM + lyrics + search)

### [ ] R3.1 LLM client + settings
Settings fieldset: base URL (default `http://localhost:11434/v1`), model, optional API key, Test button. Main-process OpenAI-compatible chat client (plain fetch, no SDK), timeout + friendly errors. SPEC §12 updated to match.
- **Done when:** Test round-trips against local Ollama AND one hosted OpenAI-compatible endpoint; wrong URL/model shows readable error, never hangs UI.

### [ ] R3.2 Metadata enrichment
Probe → LLM cleans title/artist before form prefill (local-name-first artist: "Khalil Fong (方大同)" → 方大同; strip decoration: "黑洞裡 Official Music Video" → 黑洞裡), heuristic fallback when LLM unreachable/slow (~3s budget, race). Edit-meta dialog: "Clean up with AI" button for existing songs (preview before apply).
- **Done when:** both example cases from feedback produce the expected clean values via real local model; LLM stopped → import prefill still works via heuristic at normal speed; existing song cleaned via button with confirm.

### [ ] R3.3 YouTube search in Add Song
`pipeline.py search --query` → `ytsearch10` JSON-lines (title/channel/duration/thumb/url). Add Song dialog: search box alongside URL paste → result list → pick → existing probe/prefill flow.
- **Done when:** real query returns ~10 results with thumbs in <5s; picking one lands in prefilled form; URL paste path unchanged; bad query/no network handled.

### [ ] R3.4 LRC import
File picker in creator text step. Parse LRC: line timestamps → line starts; per-unit times linearly interpolated within line (marked estimated); enhanced LRC word timestamps used when present. End inference reused. Re-edit guard rules apply.
- **Done when:** plain LRC file → review mode shows line-accurate highlight; enhanced LRC shows believable per-word wipe; malformed file rejected with message, creator unharmed.

### [ ] R3.5 LRCLIB lyric finder
"Find lyrics" in creator text step: LRCLIB API by title/artist/duration (free, keyless). Synced hit → R3.4 import path (auto-timed); plain hit → fills textarea. Multiple candidates → small picker.
- **Done when:** a known song fetches synced lyrics and plays believably in review with zero taps; plain-only song fills text step; no-hit shows graceful empty state; works for zh and en songs.

### [ ] R3.6 LLM lyric cleanup
"Clean up with AI" in text step: strips credits/section tags ([Chorus], 作詞: …), normalizes line breaks, preserves language. Diff preview before apply; re-edit guard still protects timed lines.
- **Done when:** messy pasted lyric (credits + section tags + bad breaks) comes out clean on real model; apply after timing exists triggers existing invalidation dialog only for changed lines.

### [ ] R3.7 Local file import
Add Song dialog: "From file" alongside URL/search — picker accepts anything ffmpeg decodes (mp4, flac, wav, mp3, m4a, ogg, …). `pipeline.py process --file <path>` skips download stage (probe equivalent via ffprobe: duration, tags → title/artist prefill; embedded art or video frame → thumbnail, placeholder if none). Same separation/normalization/convert chain after.
- **Done when:** an mp4 and a flac each import end-to-end and sing correctly; tags prefill the form when present; tagless file falls back to filename; unsupported/corrupt file errors cleanly with retry/delete.

### [ ] R3.8 Stem output format setting
Setting `stemFormat: flac | m4a`, default flac (lossless after separation — avoids second lossy encode; original stays source-quality as-is). Pipeline convert stage honors it; library scan + player + protocol + waveform accept both extensions per file (existing m4a songs untouched, mixed library fine). Loudness normalization unchanged.
- **Done when:** new import lands flac stems that play in player and load in creator waveform; flipping setting to m4a → next import lands m4a; pre-existing m4a songs still play; meta/scan handles a library containing both.

## Phase 4 — Production + open source

### [ ] R4.1 OSS prep
README (what/screenshots/features/install/dev-setup/architecture pointer to SPEC), MIT LICENSE, CONTRIBUTING.md (story workflow, check commands), issue/PR templates, yt-dlp/UVR usage disclaimer.
- **Done when:** fresh clone on another machine reaches `npm run dev` + pipeline setup using README alone; license/contributing render correctly on GitHub.

### [ ] R4.2 Public repo + branch protection + CI checks
Repo public on GitHub. Branch protection on `main`: PRs required, owner-only merge. Actions workflow: `npm run check` + `ruff check`/`format --check` on every PR.
- **Done when:** direct push to `main` rejected; PR from feature branch shows both checks green and red appropriately (test one deliberate failure); only owner can merge.

### [ ] R4.3 Python first-run bootstrapper
App-managed pipeline env: on first run / Settings button, download embeddable Python (or uv standalone) into `userData`, create venv, install pinned deps with GPU detect (nvidia-smi → cu128, else CPU torch), fetch static ffmpeg if not on PATH, JSON progress → install UI. Python-path setting becomes advanced override. `setup.ps1` stays for dev.
- **Done when:** machine state with no venv + no manual python config: first run → guided install → URL import → song separates and plays, zero manual steps; GPU box gets CUDA torch, install survives app restart mid-download (resume or clean retry).

### [ ] R4.4 Release pipeline
Actions on push to `main`: electron-builder NSIS, version from package.json, tag + GitHub Release with .exe artifact. Release notes from merged PR titles.
- **Done when:** merging a PR produces a downloadable Release; installing that .exe on a clean machine + R4.3 bootstrap → full import + sing smoke passes.

## Phase 5 — macOS (CI-built, community-tested)

### [ ] R5.1 Pipeline mac support
`pipeline/setup.sh`, torch device select (MPS → CPU fallback) in separate step, platform-aware paths in bootstrapper (R4.3) + ffmpeg fetch for darwin.
- **Done when:** GitHub Actions macos runner: setup.sh completes, `pipeline.py probe` real URL succeeds, separation smoke on a short file completes on CPU within runner limits.

### [ ] R5.2 mac build in release
Release workflow adds macos job: electron-builder .dmg (unsigned), uploaded to same Release. README labels mac builds community-tested.
- **Done when:** Release contains .dmg alongside .exe; README section explains unsigned-app open steps + status.

## Round 2 candidates (user-requested, explicitly NOT in Round 1)
- [ ] Record singing (mic capture + mix-down to file)
- [ ] Vocal effects (reverb/echo on monitor path)
- [ ] EQ (per-output or master)

## Unscheduled
- [ ] Playlists / up-next queue (dropped from R1 by user)
- [ ] Fullscreen two-line stage mode (dropped)
- [ ] Per-unit timing nudge editor (dropped after explanation)
- [ ] Mic-input waveform via getUserMedia (chose output-mix analyser instead)
- [ ] Per-song key/tempo persistence (MVP decision was per-session)

---

## Session Log
<!-- newest on top: date · story · what happened / decisions / gotchas -->
- 2026-06-12 · — · Backlog additions: R1.5 sing history (≥60% gate, timestamped log, library sort), R2.5 localisation (i18next, OS-locale default), R3.7 local file import (ffmpeg-decodable formats), R3.8 flac stem default with m4a setting. Round 2 candidates section added: record singing, effects, EQ.
- 2026-06-12 · — · Round 1 backlog created from `Some enhancement.md` feedback + grilling session; MVP backlog archived to `docs/rounds/00-mvp.md`. Key decisions recorded in Triage block above. Tokenizer apostrophe bug confirmed in code (`'` not in `\p{L}` word run). Dropped: nudge editor, fullscreen stage, playlists.
