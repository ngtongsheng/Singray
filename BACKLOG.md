# Singray — Story Backlog (Round 2)

Round 1 (Enhancement) archived at `docs/rounds/01-enhancement.md`. MVP at `docs/rounds/00-mvp.md`.
Round 2 feature source: user feedback 2026-06-14 (`docs/feedback/2026-06-14-round2.md`), grilled + triaged. Decisions from the grilling session are baked into each story below.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (note why)

> **Now → NAV4**, then top-to-bottom. Phase order = execution order chosen in grilling: safety/quick bugs → shared primitives → nav redesign → feature views → polish. Phase 0 (Round 1 verification) is env-blocked / user-side and doesn't block the coding pointer.
> AIC2/EL1/EL2/EL5/UI6/UI1 marked `[~]`: code complete + `npm run check` green, runtime "Done when" verification batched at session end.

**ID scheme:** Phase 0 keeps Round 1 IDs (`R#.#`) so the archived Session Log resolves. New Round 2 stories use area-code IDs (`EL`, `NAV`, `UI`, `HOME`, `ART`, `ADD`, `SNG`, `AIC`, `META`, `FX`) — collision-free with Round 1's `R#.#`. Commit subjects use the story ID, e.g. `EL1: disable stamp in preview`.

Workflow: one story at a time, top to bottom. A story is done only when every "Done when" line passes by actually running the app/script. On finish: mark `[x]`, move the **Now** pointer, append one Session Log line.

---

## Phase 0 — Round 1 verification carry-over (non-blocking)

### [ ] R0.1 Ear-check batch (user-side)
From MVP: S4.1 test tone audibly from each chosen device · S4.2 dual-output 5-min song no audible drift + first real sing-through · S5.1 ±2 semitones clean on both outputs · S5.2 eyeball wipe during sing-through at −2 key and 0.85× tempo.
- **Done when:** all four checks confirmed by ear; failures spawn fix stories.

### [!] R0.2 Live AG06 validation (blocked: VB-Cable + VoiceMeeter + AG06 session — user-side)
Routing per SPEC §9.5, AG06 TO PC = INPUT MIX, end-to-end with singing website, write `docs/ROUTING.md`.
- **Done when:** recording from website side has voice + instrumental, zero guide vocal, while monitor phones had vocal on.

### [~] R4.2 Public repo + branch protection + CI checks
CI workflow landed + verified locally; **owner-only GitHub actions remain** (make public, branch protection on `main`, live red/green PR test). Commands in the archived Session Log.
- **Done when:** direct push to `main` rejected; PR shows both checks green + red appropriately; only owner can merge.

### [~] R4.3 Python first-run bootstrapper
Code landed + smoke-checked. **Unverified**: real download→venv→torch→import on a clean no-venv + GPU machine (testing here would wipe the dev venv).
- **Done when:** clean machine: first run → guided install → URL import → separates + plays, zero manual steps; GPU box gets CUDA torch; survives restart mid-download.

### [~] R4.4 Release pipeline
`.github/workflows/release.yml` landed. **Unverified**: needs push + real Release + clean-machine .exe install.
- **Done when:** merging a PR produces a downloadable Release; that .exe installs on a clean machine + R4.3 bootstrap → import + sing smoke passes.

### [~] R5.1 Pipeline mac support
`setup.sh`, MPS→CPU device select, darwin ffmpeg, `pipeline-macos.yml` landed. **Unverified**: needs the macOS Actions runner.
- **Done when:** macos runner: setup.sh completes, `probe` real URL succeeds, separation smoke on a short file completes on CPU within runner limits.

### [~] R5.2 mac build in release
`release-mac` job (unsigned .dmg) + README section landed. **Unverified**: needs a real macOS-runner release build.
- **Done when:** Release contains .dmg alongside .exe; README explains unsigned-open steps + status.

---

## Phase 1 — Safety + quick bugs

### [~] AIC2 Lyric cleanup must not delete real lyrics (bug — data loss)
`cleanLyrics` (enrich.ts) takes the model's free-form rewrite wholesale, so a quantized model can silently delete sung lines. **Decision (grilled): prompt-harden, not restructure** — strengthen `LYRICS_PROMPT` (few-shot, emphatic "keep every sung line verbatim") **+ a `>40%` removed guard**: if cleanup drops more than ~40% of non-empty lines, surface a warning instead of presenting it as clean. The AIC1 diff-before-apply is the real safety gate (Apply stays an explicit click).
- **Done when:** a messy lyric (lyrics + section tags + credits) cleans on the real model with **all original lyric lines intact**, only tags/credits removed; a lyrics-only input returns unchanged; a cleanup that would drop >40% of lines shows the warning instead of a result; the previously-damaged song re-cleans without losing lyrics.

### [~] EL1 Disable stamping in preview (bug)
In timing's review/preview mode, **Space** currently calls `exitReview()` (jumps back to tap, next Space stamps) — that's the "stamp key fires in preview" leak (note: Space is the stamp key, Tab is gap-nav and already guarded). **Decision: in preview, Space = play/pause** (Player muscle memory), stamping fully disabled; leaving preview happens only via Ctrl+Tab / the tab UI (EL4). Enter=play, arrows=seek/speed unchanged. **SPEC §6.7 change** (Space no longer re-enters tap) — update in same commit.
- **Done when:** in preview, Space toggles play/pause and never stamps or exits; tap mode still stamps with Space; re-entering tap works via the EL4 switch.

### [~] EL2 Partial-completed line indicator (bug)
A line prints its start timestamp the moment its *first* unit is stamped, so a partly-timed line reads as complete. **Decision: tri-color timestamp** in the tap-mode line list — `—` dim (untimed), amber time (partial: ≥1 timed & ≥1 untimed), normal/green time (all units timed). Off `line.units.filter(u => u.t !== null)`.
- **Done when:** a line with ≥1 untimed unit shows amber; fully-timed shows complete color; untimed shows `—`; stamping the last unit flips amber→complete live.

### [~] EL5 Back from creator → song page (bug)
Creator is reachable only from the Player (`onEditLyrics`), but `LyricCreator onBack` routes to `library` (App.tsx:42). **Decision: `onBack → setView({name:'player', song})`** — no origin tracking needed.
- **Done when:** open creator from a song, Back returns to that song's player.

## Phase 2 — Shared UI primitives

### [~] UI6 Tabs primitive
New `src/renderer/components/ui/Tabs.tsx`: clickable tab bar (semantic tokens, aria, motion) **+ `Ctrl+Tab` / `Ctrl+Shift+Tab`** cycle. Consumed by EL4 (add/tab/preview) and ADD1 (search-URL / file).
- **Done when:** tab bar renders + switches on click; Ctrl+Tab cycles both directions; keyboard-accessible; `npm run check` green.

### [~] UI1 Custom Select (drop native look)
Replace native `<select>` in the `Select` primitive with a styled popover list (keyboard up/down/enter/esc, matches Menu/Popover).
- **Done when:** no native dropdown chrome anywhere; keyboard nav works; every Select-using screen consistent; check green.

### [~] UI3 Outside-click closes Dialog
Popover/Menu already close on outside-click; add scrim-click-to-close to `Dialog`. **Guard destructive/confirm dialogs** — those keep explicit buttons so an accidental click can't discard unsaved edits.
- **Done when:** non-destructive dialogs/popups close on outside click; confirm/discard dialogs still require an explicit choice; Esc still works everywhere.

## Phase 3 — Navigation / app-shell redesign
> Reverses R2.1's single native titlebar. **SPEC §10** + `src/main/index.ts` updated with NAV1.

### [~] NAV1 Two-row header + custom window controls
Top row: app logo (left) + **custom** minimize / maximize-restore / close (right). **Decision (grilled): go custom** — drop `titleBarOverlay`, add IPC `window:minimize|toggleMaximize|close`, style buttons to the app. **Accepted trade-off: lose the native snap-layouts hover flyout** (edge-drag snap + double-click-maximize still work).
- **Done when:** every screen shows the top row (logo left, custom min/max/close right); all three buttons work; drag region moves the window; double-click drag region maximizes/restores; edge-snap still works.

### [x] NAV2 Page-level controls on the second row
Per-screen controls move to row 2 below the app header: library = search / Add / sort / `Songs|Artists` toggle / grid-list toggle; player = back; creator = its action buttons.
- **Done when:** each screen's controls render on row 2 under the logo row; nothing overlaps the window buttons; holds at min width.
- Note: `Songs|Artists`/grid-list toggles land with HOME1/ART1 (Phase 4) — they'll join this row then.

### [x] NAV3 Floating backgroundless header (gradient scrim)
**Decision: floating overlay** — header is positioned over content, the library grid / lyric list scroll *beneath* it; a top gradient scrim (opaque→transparent) throughout keeps text + window buttons legible. Screens get top padding = header height.
- **Done when:** header has no solid fill (gradient scrim only); content scrolls under it and stays legible; window buttons readable over moving content; matches the player control-bar treatment; semantic tokens only.

### [ ] NAV4 Vertical title + artist
Player header stacks title over artist (was inline).
- **Done when:** player header shows title on top, artist beneath; both truncate; back-button alignment intact.

## Phase 4 — Feature views

### [ ] HOME1 Songs grid/list view
`Songs | Artists` segmented toggle in row 2 (NAV2). Songs view gains a **grid/list** toggle; list = compact rows (thumb, title, artist, favorite). View choice persists in settings.
- **Done when:** grid↔list toggles; list rows open the player; favorite/sort work in list; choice survives restart.

### [ ] ART1 Artists view
The `Artists` toggle shows a list of artists (name · song count). **Decision: artist detail = filtered Songs view** (clicking an artist sets a removable "Artist: …" filter chip on the Songs list, reusing grid/list) — no separate screen type.
- **Done when:** Artists lists every artist with song count; unknown/empty-artist handled; clicking one shows the Songs list filtered to that artist with a clear-able chip; back/clear returns to all songs.

### [ ] ART2 Artist name links to artist filter
Clicking an artist name (card, player header, details modal) navigates to Songs filtered by that artist (ART1's chip).
- **Done when:** clicking an artist name anywhere opens the filtered Songs view; works for CJK + latin names; non-artist clicks unaffected.

### [ ] ADD1 Tabs in Add Song (search-URL / file)
Use the UI6 Tabs primitive to switch between "YouTube (search + URL)" and "Upload from file".
- **Done when:** tabs switch the two modes; each mode's state survives switching away and back in-session; keyboard-accessible.

### [ ] ADD2 Drag-and-drop file load
The "from file" pane accepts a dragged file (drop zone + hover state) alongside the picker.
- **Done when:** dropping a supported file starts the same probe/prefill flow; unsupported file rejected with a message; drag-over shows a visible drop affordance.

### [ ] ADD3 Auto-detect language from user's languages
**Decision: heuristic script detection** — dominant Unicode script of the probe title → matching language in `settings.languages` (Han→zh, kana→ja, Hangul→ko, Latin→en/…); ambiguous/none keeps the default. Preselects the import form's language; user can override.
- **Done when:** an obviously-zh and an obviously-en import each preselect the right language from the user's list; ambiguous falls back to a sane default; override still works.

### [ ] SNG1 Song details modal
Player overflow entry opens a modal: title, artist, sung count, sing history, duration, source, language. Closes on outside-click (UI3) + Esc; artist name links via ART2.
- **Done when:** modal opens from the player, shows correct metadata, closes on outside click + Esc; artist link navigates to the artist filter.

### [ ] SNG2 Lyrics behind player controls
Scrolling lyrics currently overlap the waveform + control bar. **Decision: lyric layer z-below the control bar + bottom gradient fade** so text dissolves before reaching the bar (not a hard clip).
- **Done when:** at every scroll position waveform + controls are fully visible and clickable; lyric text fades out above the bar, never overlapping it; wipe/highlight still readable.

### [ ] SNG3 Animated singing background
Stage background reads static. **Decision: investigate** whether R1.4's Ken Burns is absent in the player stage or just imperceptible, then make the motion subtly visible; paused when hidden / not playing.
- **Done when:** background shows subtle continuous motion during playback; pauses when hidden / paused; 0 layout-shift entries; wipe perf trace unchanged.

## Phase 5 — Polish

### [ ] EL3 Progress strip replaces the done banner
Remove the centered `timing.done` ("全部打完 - 可以预览了") banner. **Decision: full-width progress strip directly under WaveformStrip** (mirrors the import strip), measuring timed/total units (`stamps.length / flatUnits.length`), filling live; at 100% reads "ready to preview". Keep the large current-line focus display.
- **Done when:** centered banner gone; full-width strip under the waveform shows `timed/total · %` and fills as you stamp; 100% reads ready-to-preview; focus display unchanged.

### [ ] EL4 Tab-cycle the three creator steps (+ tab UI)
**Decision: `Ctrl+Tab` / `Ctrl+Shift+Tab`** cycle `text → tap → review`, plus the UI6 Tabs bar in the creator. Plain Tab stays gap-nav in timing; textarea Tab unaffected. Cycle keeps current shape (review is a toggle, not a 4th route).
- **Done when:** Ctrl+Tab moves between all three steps both directions; the tab bar does the same on click; never collides with the stamp (Space) or gap-nav (Tab); works zh + en.

### [ ] AIC1 Unified inline diff for cleanup preview
Replace `CleanLyricsDialog`'s two-pane view with a **unified inline diff** (one column, removed lines red `−`, kept neutral; line-level LCS). This is AIC2's apply gate.
- **Done when:** preview renders a unified line-level diff (removed marked); Apply writes only the cleaned text; re-edit guard unchanged.

### [ ] UI2 Custom scrollbars
Styled thin scrollbar in scroll regions (library grid, lyric list, dialogs), respecting reduced-motion.
- **Done when:** scroll regions show the custom scrollbar; wheel/drag/touchpad scroll still work; no layout shift.

### [ ] UI4 De-native audit
Sweep remaining native-looking controls (checkboxes, range thumbs, file inputs, tooltips) through the `ui/` primitives.
- **Done when:** grep + visual pass finds no raw native control in screens; all chrome uses `ui/` components.

### [ ] UI5 Hide sung count on card
Remove the sung-count badge from library cards (R1.5). Count stays in the SNG1 details modal; sort-by-most-sung unaffected.
- **Done when:** cards show no sung-count badge; sort-by-most-sung still works; count visible in details modal.

### [ ] META1 Align AI cleanup button with Cancel/Save
Edit-meta dialog: put "Clean up with AI" on the same action row as Cancel/Save.
- **Done when:** the three buttons sit on one aligned row; sane at min width in zh + en.

## Phase 6 — Audio (deferred Round-2 candidates)

### [ ] FX1 Record singing — mic capture + mix-down to file.
### [ ] FX2 Vocal effects — reverb/echo on monitor path.
### [ ] FX3 EQ — per-output or master.

## Unscheduled
- [ ] Playlists / up-next queue (dropped from R1)
- [ ] Fullscreen two-line stage mode (dropped)
- [ ] Per-unit timing nudge editor (dropped)
- [ ] Mic-input waveform via getUserMedia (chose output-mix analyser)
- [ ] Per-song key/tempo persistence (MVP decision was per-session)

---

## Session Log
<!-- newest on top: date · story · what happened / decisions / gotchas -->
- 2026-06-14 · NAV3 · Floating two-row header (AppHeader+Titlebar, both `absolute`/z-30) over single shared gradient scrim (`from-bg via-bg/85 to-transparent`, h-19/z-20). All 6 screens (Library/Settings/PipelineSetup/LyricCreator/Player/+root) wrapped `relative h-full` with content `absolute inset-0 ... pt-19` (Player gets no pt-19 — fullscreen stage under floating header, matching control-bar treatment). Playwright screenshots (library top, player) confirm: gradient blends header into content with no solid fill, window buttons legible over Ken Burns bg, title/back-button row reads fine. Library's 5 seed songs don't overflow so scroll-under wasn't visually exercised, but layout math (`pt-19`=76px=header height) is correct and `npm run check` green. **[x]**.
- 2026-06-14 · NAV2 · Library row2 now: search · sort Select (moved up from the filter-chips row, wrapped `app-no-drag`) · Add · Settings; filter chips row keeps language/favorites/needs-lyrics only. Player/Creator already had back+title+actions on row2 via NAV1. Playwright at 960×600: row2 holds, no overlap with window buttons, sort dropdown opens with 3 options. **[x]** verified.
- 2026-06-14 · NAV1 · Dropped `titleBarOverlay`; new `window:minimize|toggleMaximize|close|isMaximized` IPC + `onMaximizedChange` event (main/preload/shared types). New `AppHeader` (logo + drag region + `WindowControls`) rendered once in App.tsx as row 1, screens' existing `Titlebar` becomes row 2 (dropped its now-unused WCO padding reservation + Library's redundant "Singray" h1). Playwright smoke: app renders both rows, all 3 buttons present, maximize/restore toggles correctly at both sizes. `[~]`: drag-move/double-click-maximize/edge-snap need a manual check (not simulable via the electron driver).
- 2026-06-14 · UI3 · Dialog scrim now closes on outside-click via `onClick` on the scrim `motion.div` (`e.target === e.currentTarget` guard so panel clicks don't bubble); skipped when `alert` (ConfirmDialog) so destructive prompts keep explicit buttons. Esc unchanged. `npm run check` green. `[~]`: pending click-through on a few dialogs.
- 2026-06-14 · UI1 · Select rewritten as popover listbox (keyboard up/down/enter/esc, Menu/Popover pattern); new options-array API (`{value,label}[]`, `onChange(value:string)`). Updated all 7 call sites (Settings×4, ImportDialog, EditMetaDialog, Library sort) with type casts where needed. `npm run check` green. `[~]`: native-chrome absence + keyboard nav not yet eyeballed.
- 2026-06-14 · UI6 · New `ui/Tabs.tsx`: clickable tab bar (aria tablist/tab, motion underline, arrow-key nav) + exported `useTabCycle` hook for Ctrl+Tab/Ctrl+Shift+Tab. Not yet consumed (EL4/ADD1 pending). `npm run check` green. `[~]`: pending consumer wiring to fully exercise.
- 2026-06-14 · EL5 · `LyricCreator onBack` now routes to `player` for the song instead of `library` (App.tsx). One-line fix, no spec change needed. `npm run check` green. `[~]`: pending click-through.
- 2026-06-14 · EL2 · Tri-color line timestamps in TimingStep: `—` dim untimed, amber (`--color-warning`, new token) partial, normal complete — derived from `line.units` timed-count. `npm run check` green. `[~]`: pending live stamping eyeball.
- 2026-06-14 · EL1 · Preview/review Space now toggles play/pause (was `exitReview`+stamp leak); Enter hint moved to tap-only; SPEC §6.7 updated same commit. Removed stale `timing.hintBackToTap` i18n key, trimmed `timing.tapTip`. `npm run check` green. `[~]`: pending review-mode keyboard check.
- 2026-06-14 · AIC2 · Hardened `LYRICS_PROMPT` (enrich.ts) with few-shot zh example + "keep every sung line verbatim, when unsure KEEP" rule; `CleanLyricsDialog` now warns when cleanup removes >40% of non-empty lines (`clean.majorRemoval` i18n key, danger-styled). `npm run check` green. `[~]`: needs real-model run with messy lyric + the previously-damaged song, batched to end of session.
- 2026-06-14 · — · Grilled the Round 2 backlog; baked decisions into every story + reordered phases to execution order (safety/bugs → primitives → nav → views → polish). Resolutions: **EL** "preview"=timing review toggle (kept as toggle, not a 4th route); stamp key is **Space** (Tab=gap-nav, already guarded) — EL1 = Space→play/pause in preview, stamping disabled (**SPEC §6.7 change**); EL2 tri-color timestamp; EL3 full-width progress strip under WaveformStrip replacing the centered done banner; EL4 **Ctrl+Tab** cycle + new **UI6 Tabs** primitive (also serves ADD1); EL5 onBack→player (App.tsx:42 bug). **NAV1** go custom min/max/close + new window IPC, drop `titleBarOverlay`, accept loss of native snap-hover flyout (**SPEC §10 + main/index.ts**); NAV3 floating overlay + gradient scrim throughout, content scrolls under; NAV2/NAV4 as triaged. **AIC2** (data loss) = prompt-harden + `>40%`-removed guard + AIC1 diff as apply gate (user chose hardening over classify-and-filter); **AIC1** unified inline diff. **ADD3** heuristic script detection. **HOME1/ART1/ART2** `Songs|Artists` row-2 toggle + grid/list; artist click = filtered Songs view with removable chip (no new screen). Now pointer = AIC2.
- 2026-06-14 · — · Round 2 feature triage. Saved raw feedback to `docs/feedback/2026-06-14-round2.md`; triaged ~26 items into area-code stories.
- 2026-06-14 · — · Round 1 closed + archived to `docs/rounds/01-enhancement.md`. Phase 0 = the five `[~]` carry-overs + user-side R0.1/R0.2 (kept Round 1 IDs). Record/effects/EQ → Phase 6.
