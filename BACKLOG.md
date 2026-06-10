# Singray — Story Backlog

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (note why)

> **Now → S2.2** (update this pointer whenever a story starts/finishes)

Workflow: one story at a time, top to bottom. A story is done only when every "Done when" line passes by actually running the app/script. On finish: mark `[x]`, move the **Now** pointer, append one line to the Session Log.

---

## Phase 0 — Scaffold

### [x] S0.1 App skeleton
Electron-vite scaffold (React + TS), Tailwind v4 with design tokens from SPEC §10.2, electron-builder config, git init. Quality tooling per SPEC §2.2: Biome (`biome.json`), strict tsconfig (`noUncheckedIndexedAccess`), `npm run check` script, `simple-git-hooks` pre-commit running it.
- **Done when:** `npm run dev` opens a dark-themed window titled "Singray"; `npm run check` passes; a commit with a deliberate type error gets blocked by the hook; `git log` has initial commit.

### [x] S0.2 IPC + settings + media protocol
Typed preload bridge (SPEC §8 surface, stub implementations), settings store (JSON in `userData`, defaults from SPEC §4.5), `karaoke://` protocol serving range-requested files from library dir.
- **Done when:** renderer round-trips `settings.get/set`; an `<audio>` tag plays a manually placed M4A via `karaoke://test/original.m4a`.

### [x] S0.3 Python env
`pipeline/setup.ps1` creates `.venv` (pinned: yt-dlp 2026.6.9, audio-separator[gpu] 0.44.2, torch 2.11.0 cu128), checks ffmpeg on PATH, `-Update` flag bumps yt-dlp. Skeleton `pipeline.py` with argparse (`probe`/`process` subcommands, stubbed). ruff 0.15.16 in venv + `check:py` script.
- **Done when:** `setup.ps1` completes; `.venv\Scripts\python.exe pipeline.py --help` shows both subcommands; torch reports CUDA available; `ruff check pipeline` passes.

## Phase 1 — Library + Import

### [x] S1.1 pipeline probe
`pipeline.py probe --url` → one-line JSON `{title, channel, track, artist, duration, thumbnailUrl}` via yt-dlp `--dump-json --no-download`.
- **Done when:** real YouTube URL returns correct JSON in terminal; bad URL exits non-zero with `{"stage":"error",...}`.

### [x] S1.2 pipeline process
Full chain standalone (no Electron): download best audio + thumbnail → audio-separator (6_HP-Karaoke-UVR, window 320, aggression 5, GPU) → loudness normalization (measure original at −14 LUFS, same linear gain on all three — SPEC §5.2) → ffmpeg AAC 256k ×3 (original/instrumental/vocals) → files into `--out`. JSON-lines progress per SPEC §5.2. Temp cleanup on success and failure.
- **Done when:** one command produces 4 files in a target folder; progress lines stream during run; vocals/instrumental sound separated; two different-loudness songs come out level-matched.

### [x] S1.3 Library screen
Main: scan library dir → `SongMeta[]`, `library.list/updateMeta/delete` IPC live. Renderer: card grid per SPEC §10.6, search (title/artist substring), filter chips (language, favorites, needs-lyrics), empty state. Seed 2–3 songs by hand-running S1.2 output + hand-written meta.json.
- **Done when:** seeded songs render with thumbs; search and filters work; delete removes folder after confirm dialog.

### [x] S1.4 Import dialog
Add Song → URL paste → `import.probe` → editable form (title/artist/language, thumb preview) per SPEC §5.1.
- **Done when:** pasting real URL prefills form within a few seconds; Add button returns a jobId (queue may still be stub).

### [x] S1.5 Import queue
Main-process FIFO queue spawning `pipeline.py process`, parsing stdout JSON-lines, `import:progress` events, `meta.json` write on done, `error.json` + retry/delete on failure. Renderer: card status badges (downloading/separating/converting/ready/error), progress strip under top bar.
- **Done when:** paste URL → watch badges advance → song playable when ready; kill network mid-download → error badge → retry succeeds; queue 2 URLs → runs serially.

### [x] S1.6 Meta management
Edit meta dialog, favorite toggle, open-folder, settings screen v1 (library dir, python path + "test pipeline" button).
- **Done when:** edits persist to meta.json and survive restart; settings round-trip works.

## Phase 2 — Lyric Creator

### [x] S2.1 Tokenizer + lyrics IPC
Shared TS module per SPEC §4.4 (Intl.Segmenter, CJK char = unit, Latin word = unit, punctuation attaches). `lyrics.get/save` IPC.
- **Done when:** dev-console check: `不是想怎么来` → 6 units, `But I wanna go home` → 5 units, mixed line splits sanely; lyrics.json round-trips.

### [ ] S2.2 Text step
Textarea one-line-per-row, empty row = break marker, continue → tokenized draft saved (`t: null`). Re-edit guard: line-diff keeps timing on unchanged lines, warns on timed-line edits.
- **Done when:** paste full song text → draft lyrics.json written with correct units/breaks; editing one line after timing exists only invalidates that line.

### [ ] S2.3 Tap timing engine
Timing step UI per SPEC §6.3 + §10.6: transport on original.m4a, Space stamps unit start, Backspace undo (cross-line), Enter play/pause, ←/→ seek ±5s with cursor follow, ↑/↓ rate cycle (preservesPitch), click line to jump, break auto-skip, 1s-debounced autosave, keyboard cheat-sheet strip.
- **Done when:** full Chinese song tapped end-to-end at 0.7×; quit mid-way, reopen, cursor resumes at first unstamped unit.

### [ ] S2.4 End inference + review mode
End inference per SPEC §6.4 (MAX_TAIL 5s, breaks, song end). Review toggle plays with real player renderer inline; Space re-enters tap mode at current line.
- **Done when:** lyrics.json ends valid (every line start<end, monotonic); review shows believable highlight against singing.

### [ ] S2.5 Vocals waveform strip
Waveform of `vocals.m4a` under transport per SPEC §6.5: peaks rendered to canvas once, playhead + stamped-unit ticks overlaid, click = seek.
- **Done when:** vocal phrases visibly map to waveform bumps; click-seek lands where expected; no per-frame jank (canvas redraw is playhead-only).

### [ ] S2.6 Forced alignment
Add whisperx 3.8.6 to `setup.ps1` + venv. `pipeline.py align --song <dir> --text <file>` per SPEC §6.6: WhisperX alignment on vocals stem → JSON word/char timestamps. App: "Align" button in text step, merge into lyrics.json (`t` for confident matches, null otherwise), timing step opens in fix-up mode jumping between null/suspect units. Alignment failure non-fatal → pure tap mode.
- **Done when:** English song ≥90% units auto-timed and review mode looks right with zero taps; Chinese song aligns partially with graceful fix-up; pipeline failure path leaves creator fully usable.

## Phase 3 — Player (single output)

### [ ] S3.1 Audio engine v1
One AudioContext, two buffer sources (instrumental + vocals) sample-synced, gain nodes, master clock API (`position`, `play/pause/seek`), vocal toggle/volume.
- **Done when:** stems play in perfect sync; toggling vocal mid-song is click-free (short gain ramp); seek keeps both aligned.

### [ ] S3.2 Lyric renderer
Scrolling centered list per SPEC §7.1 + §10.6: current line enlarged, per-unit linear wipe driven by master clock (rAF, transform/clip only), auto-scroll, click-to-seek, dimmed past lines, break dot-countdown, blurred-thumb background with scrim.
- **Done when:** wipe matches the S2 song's vocal exactly; clicking any line seeks; 0 layout-shift warnings in devtools performance trace.

### [ ] S3.3 Player chrome
Auto-hide control bar: play/pause (Space), seek bar, vocal toggle (V) + sliders, Esc exits, play count increment, "Sing" wired from library card, review-mode reuses this renderer (close S2.4 loop if stubbed).
- **Done when:** full karaoke session start-to-finish from library and back, mouse untouched.

## Phase 4 — Dual-mix routing

### [ ] S4.1 Device plumbing
`enumerateDevices` output pickers in settings (monitor/stream), per-device test tone, `audioOutputMode: single|dual`.
- **Done when:** test tone audibly comes out of the chosen physical device for both pickers.

### [ ] S4.2 Dual-context engine
Second AudioContext with `setSinkId`, mirrored graph (instrumental only), aligned start, 5s drift check + >25ms hard resync, vocal toggle scoped to monitor context, pause/seek rebuilds both. Fallback path: MediaStreamDestination → `<audio>.setSinkId` (build only if primary misbehaves).
- **Done when:** 5-minute song shows no audible drift between two outputs (record both, compare); vocal toggle never affects stream sink.

### [ ] S4.3 Live AG06 validation
VB-Cable + VoiceMeeter setup per SPEC §9.5, AG06 TO PC = INPUT MIX, end-to-end test with singing website. Write `docs/ROUTING.md` with the exact working configuration + screenshots.
- **Done when:** recording from the website side has voice + instrumental, zero guide vocal, while monitor phones had vocal on.

## Phase 5 — Pitch & tempo

### [ ] S5.1 SoundTouch worklet
AudioWorklet wrapping SoundTouch WASM, params `pitchSemitones`/`tempo`, true bypass at neutral, inserted per-stem in both contexts, params mirrored.
- **Done when:** ±2 semitones sounds clean on both outputs; neutral position is bit-transparent (null test vs Phase 3 path).

### [ ] S5.2 Key/tempo controls
Key stepper ±6 (`[`/`]`), tempo 0.75–1.25 in overflow menu, lyric clock scales with tempo, settings persist per song? (no — per session).
- **Done when:** −2 key full song with lyrics still in sync; tempo 0.85 practice run with wipe still accurate.

## Phase 6 — Backlog (unscheduled)
- [ ] Per-unit timing nudge editor
- [ ] LRC + legacy `karaoke.add` import
- [ ] LLM metadata enrichment (SPEC §12)
- [ ] Lyric web fetch + LLM cleanup
- [ ] Fullscreen two-line stage mode
- [ ] Playlists / up-next queue
- [ ] macOS build (`setup.sh`, MPS/CPU separation)

---

## Session Log
<!-- newest on top: date · story · what happened / decisions / gotchas -->
- 2026-06-11 · S2.1 · src/shared/tokenize.ts: Intl.Segmenter grapheme walk, CJK regex (Han/Hiragana/Katakana/Hangul) = unit per char, \p{L}\p{N} runs = word units, punctuation/space appends to previous unit text (leading punct prefixes first unit, e.g. 「你). lyrics.get/save real in library.ts (save fires library:changed since hasLyrics derives from file). DEV-only window.__tokenize hook in main.tsx for console checks. Verified via CDP: 不是想怎么来→6, "But I wanna go home"→5 (spaces attach), mixed 我们 sing 一首 song→sane, round-trip exact JSON match, missing lyrics→null, hasLyrics flips true after save. Test lyrics.json removed from seed after.
- 2026-06-11 · S1.6 · Edit-meta dialog (title/artist/language → updateMeta), heart favorite toggle on card, ⋯ card menu (edit/open folder/delete — delete moved off direct button per SPEC §10.8), Settings screen (App-level view switch, gear in header; Library + Pipeline fieldsets, save-on-blur, Test pipeline button reuses import.probe on known URL). SPEC CHANGE: library.openFolder(id) added to §8 (shell.openPath). Verified via CDP: edit→meta.json on disk→survives restart, favorite toggles round-trip, openFolder pops Explorer at song dir, probe test 1.8s success, libraryDir round-trips through settings.json. Gotcha: React onBlur = focusout event, plain blur dispatch does nothing (matters for CDP-driven tests).
- 2026-06-11 · S1.5 · FIFO queue in main (importQueue.ts): spawns pipeline process, readline over stdout JSON-lines, broadcasts import:progress, meta.json written upfront at start (durationSec patched on done), error.json + badge on non-zero exit, retry re-enqueues, library:delete cancels/kills active job first. SongListItem gains `ready` (original.m4a exists) — error state derived from error.json OR not-ready, so killed-mid-import songs show Error after restart too. SPEC CHANGE: import.start req gains youtubeTitle (§8). Verified via CDP: dialog→Add→badges Queued/Separating/Converting advance, 2 URLs run serially ("1 more queued" strip), imported song plays via karaoke://, killed python mid-run → Error badge + error.json ("pipeline exited 4294967295") → Retry button → success with durationSec. Test songs deleted after.
- 2026-06-10 · S1.4 · Import dialog: debounced probe (400ms, seq-guarded against stale results), prefill from track/artist fields else title heuristic (strips (Official Video)/【官方MV】 decoration, splits on dash family + 「」), language select, https thumb preview (CSP img-src widened with https:). import:start is a stub returning randomUUID until S1.5. Verified via CDP: prefill 3.5s, correct split, Add → jobId, dialog closes. main/pipeline.ts spawns venv python for probe.
- 2026-06-10 · S1.3 · Library service (folder scan, meta as id-authority from folder name, sorted by addedAt) + live list/delete/updateMeta IPC. Renderer: card grid, search, language/favorites/needs-lyrics chips, confirm-delete dialog, empty state. SPEC CHANGE: library.list returns SongListItem[] (SongMeta + derived hasLyrics/error) — cards need them, §8 updated. Fonts bundled via @fontsource-variable (Inter + Noto Sans SC). Verified via screenshot + CDP-driven UI test (search/filters/delete all pass; delete removed folder on disk). Seeds: rick + nirv from S1.2 outputs. CDP test trick: launch dev with REMOTE_DEBUGGING_PORT=9222, drive via Runtime.evaluate.
- 2026-06-10 · S1.2 · Full chain works standalone. Verified: dQw4w9WgXcQ + hTWKbfoikeg both → 4 files; JSON-lines progress streamed (download per-percent via yt-dlp hook, separate/convert coarse); stdout is pure JSON (audio-separator tqdm goes to stderr); both originals measured −14.1 LUFS after shared-gain normalization; stems plausible (vocals mean −23.6dB vs instrumental −20dB, distinct content). GPU separation ≈12s for 3.5min song on 5060 Ti. UVR model auto-downloads to pipeline/models (gitignored). Test outputs kept at Karaoke\_test-s12* as S1.3 seeds. Ear-check of stem quality still recommended.
- 2026-06-10 · S1.1 · Probe via yt_dlp Python API (noplaylist; artists list joined, channel falls back to uploader). Verified: real URL → correct one-line JSON exit 0; bad URL → {"stage":"error"} exit 1 (yt-dlp also prints its own ERROR to stderr — harmless, stdout stays clean JSON). ruff green.
- 2026-06-10 · S0.3 · Venv built (Python 3.13). SPEC CHANGE: torch pinned 2.11.0+cu128 (not 2.12.0 — cu128 index tops out at 2.11.0; 2.12.0 resolves to PyPI CPU build). torchvision pinned 0.26.0+cu128 alongside since onnx2torch pulls it and unpinned resolve forced a CPU torch upgrade. setup.ps1 now hard-fails on pip exit codes + asserts CUDA at end. Verified: CUDA True on RTX 5060 Ti, pipeline.py --help shows probe/process, ruff check+format pass, check:py script added.
- 2026-06-10 · S0.2 · Typed IPC bridge (`window.singray`, contract types in src/shared/types.ts shared by all three tsconfigs), settings store with defaults + JSON persistence in userData, `karaoke://<songId>/<file>` protocol with manual byte-range support (Readable.toWeb streams). Verified: settings get→set→file-write round-trip (settings.json appeared in %APPDATA%\singray), 30s test-tone M4A at Karaoke\test\original.m4a played via `<audio>` (screenshot, full duration shown). Temp smoke-test panel in App.tsx — replaced in S1.3.
- 2026-06-10 · S0.1 · Scaffolded with electron-vite 5 template (kept template combo vite 7 + TS 5.9 — electron-vite 5 peer-caps vite at ^7; bumped electron to ^42.4.0). Replaced ESLint/Prettier with Biome (tailwindDirectives enabled for @theme parsing). Tailwind v4 tokens in main.css, strict+noUncheckedIndexedAccess in both tsconfigs, simple-git-hooks pre-commit verified blocking a type error. Verified dev window dark-themed via screenshot. Gotcha: electron binary needed manual `node node_modules/electron/install.js` after npm install.
- 2026-06-10 · — · Spec + backlog created. Nothing built yet.
