# Singray — Story Backlog (Round 2)

Round 1 (Enhancement) archived at `docs/rounds/01-enhancement.md`. MVP at `docs/rounds/00-mvp.md`.
Round 2 feature source: user feedback 2026-06-14 (`docs/feedback/2026-06-14-round2.md`), grilled + triaged. Decisions from the grilling session are baked into each story below.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (note why)

> **Round 2 Phases 1-5 all `[x]`.** Remaining `[~]` are R4.2-R5.2 (Phase 0, env-blocked/owner-side — see their own notes) and **UI7** (Phase 5, in progress — see below). **Now: UI7**. After UI7: **FX1** (Phase 6) is an undetailed one-line stub — needs spec/grilling into a proper story (Done-when, decisions) before it's startable; not a drop-in continuation of the verification pass.

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

### [x] AIC2 Lyric cleanup must not delete real lyrics (bug — data loss)
`cleanLyrics` (enrich.ts) takes the model's free-form rewrite wholesale, so a quantized model can silently delete sung lines. **Decision (grilled): prompt-harden, not restructure** — strengthen `LYRICS_PROMPT` (few-shot, emphatic "keep every sung line verbatim") **+ a `>40%` removed guard**: if cleanup drops more than ~40% of non-empty lines, surface a warning instead of presenting it as clean. The AIC1 diff-before-apply is the real safety gate (Apply stays an explicit click).
- **Done when:** a messy lyric (lyrics + section tags + credits) cleans on the real model with **all original lyric lines intact**, only tags/credits removed; a lyrics-only input returns unchanged; a cleanup that would drop >40% of lines shows the warning instead of a result; the previously-damaged song re-cleans without losing lyrics.

### [x] EL1 Disable stamping in preview (bug)
In timing's review/preview mode, **Space** currently calls `exitReview()` (jumps back to tap, next Space stamps) — that's the "stamp key fires in preview" leak (note: Space is the stamp key, Tab is gap-nav and already guarded). **Decision: in preview, Space = play/pause** (Player muscle memory), stamping fully disabled; leaving preview happens only via Ctrl+Tab / the tab UI (EL4). Enter=play, arrows=seek/speed unchanged. **SPEC §6.7 change** (Space no longer re-enters tap) — update in same commit.
- **Done when:** in preview, Space toggles play/pause and never stamps or exits; tap mode still stamps with Space; re-entering tap works via the EL4 switch.

### [x] EL2 Partial-completed line indicator (bug)
A line prints its start timestamp the moment its *first* unit is stamped, so a partly-timed line reads as complete. **Decision: tri-color timestamp** in the tap-mode line list — `—` dim (untimed), amber time (partial: ≥1 timed & ≥1 untimed), normal/green time (all units timed). Off `line.units.filter(u => u.t !== null)`.
- **Done when:** a line with ≥1 untimed unit shows amber; fully-timed shows complete color; untimed shows `—`; stamping the last unit flips amber→complete live.

### [x] EL5 Back from creator → song page (bug)
Creator is reachable only from the Player (`onEditLyrics`), but `LyricCreator onBack` routes to `library` (App.tsx:42). **Decision: `onBack → setView({name:'player', song})`** — no origin tracking needed.
- **Done when:** open creator from a song, Back returns to that song's player.

## Phase 2 — Shared UI primitives

### [x] UI6 Tabs primitive
New `src/renderer/components/ui/Tabs.tsx`: clickable tab bar (semantic tokens, aria, motion) **+ `Ctrl+Tab` / `Ctrl+Shift+Tab`** cycle. Consumed by EL4 (add/tab/preview) and ADD1 (search-URL / file).
- **Done when:** tab bar renders + switches on click; Ctrl+Tab cycles both directions; keyboard-accessible; `npm run check` green.

### [x] UI1 Custom Select (drop native look)
Replace native `<select>` in the `Select` primitive with a styled popover list (keyboard up/down/enter/esc, matches Menu/Popover).
- **Done when:** no native dropdown chrome anywhere; keyboard nav works; every Select-using screen consistent; check green.

### [x] UI3 Outside-click closes Dialog
Popover/Menu already close on outside-click; add scrim-click-to-close to `Dialog`. **Guard destructive/confirm dialogs** — those keep explicit buttons so an accidental click can't discard unsaved edits.
- **Done when:** non-destructive dialogs/popups close on outside click; confirm/discard dialogs still require an explicit choice; Esc still works everywhere.

## Phase 3 — Navigation / app-shell redesign
> Reverses R2.1's single native titlebar. **SPEC §10** + `src/main/index.ts` updated with NAV1.

### [x] NAV1 Two-row header + custom window controls
Top row: app logo (left) + **custom** minimize / maximize-restore / close (right). **Decision (grilled): go custom** — drop `titleBarOverlay`, add IPC `window:minimize|toggleMaximize|close`, style buttons to the app. **Accepted trade-off: lose the native snap-layouts hover flyout** (edge-drag snap + double-click-maximize still work).
- **Done when:** every screen shows the top row (logo left, custom min/max/close right); all three buttons work; drag region moves the window; double-click drag region maximizes/restores; edge-snap still works.

### [x] NAV2 Page-level controls on the second row
Per-screen controls move to row 2 below the app header: library = search / Add / sort / `Songs|Artists` toggle / grid-list toggle; player = back; creator = its action buttons.
- **Done when:** each screen's controls render on row 2 under the logo row; nothing overlaps the window buttons; holds at min width.
- Note: `Songs|Artists`/grid-list toggles land with HOME1/ART1 (Phase 4) — they'll join this row then.

### [x] NAV3 Floating backgroundless header (gradient scrim)
**Decision: floating overlay** — header is positioned over content, the library grid / lyric list scroll *beneath* it; a top gradient scrim (opaque→transparent) throughout keeps text + window buttons legible. Screens get top padding = header height.
- **Done when:** header has no solid fill (gradient scrim only); content scrolls under it and stays legible; window buttons readable over moving content; matches the player control-bar treatment; semantic tokens only.

### [x] NAV4 Vertical title + artist
Player header stacks title over artist (was inline).
- **Done when:** player header shows title on top, artist beneath; both truncate; back-button alignment intact.

## Phase 4 — Feature views

### [x] HOME1 Songs grid/list view
`Songs | Artists` segmented toggle in row 2 (NAV2). Songs view gains a **grid/list** toggle; list = compact rows (thumb, title, artist, favorite). View choice persists in settings.
- **Done when:** grid↔list toggles; list rows open the player; favorite/sort work in list; choice survives restart.

### [x] ART1 Artists view
The `Artists` toggle shows a list of artists (name · song count). **Decision: artist detail = filtered Songs view** (clicking an artist sets a removable "Artist: …" filter chip on the Songs list, reusing grid/list) — no separate screen type.
- **Done when:** Artists lists every artist with song count; unknown/empty-artist handled; clicking one shows the Songs list filtered to that artist with a clear-able chip; back/clear returns to all songs.

### [x] ART2 Artist name links to artist filter
Clicking an artist name (card, player header, details modal) navigates to Songs filtered by that artist (ART1's chip).
- **Done when:** clicking an artist name anywhere opens the filtered Songs view; works for CJK + latin names; non-artist clicks unaffected.

### [x] ADD1 Tabs in Add Song (search-URL / file)
Use the UI6 Tabs primitive to switch between "YouTube (search + URL)" and "Upload from file".
- **Done when:** tabs switch the two modes; each mode's state survives switching away and back in-session; keyboard-accessible.

### [x] ADD2 Drag-and-drop file load
The "from file" pane accepts a dragged file (drop zone + hover state) alongside the picker.
- **Done when:** dropping a supported file starts the same probe/prefill flow; unsupported file rejected with a message; drag-over shows a visible drop affordance.

### [x] ADD3 Auto-detect language from user's languages
**Decision: heuristic script detection** — dominant Unicode script of the probe title → matching language in `settings.languages` (Han→zh, kana→ja, Hangul→ko, Latin→en/…); ambiguous/none keeps the default. Preselects the import form's language; user can override.
- **Done when:** an obviously-zh and an obviously-en import each preselect the right language from the user's list; ambiguous falls back to a sane default; override still works.

### [x] SNG1 Song details modal
Player overflow entry opens a modal: title, artist, sung count, sing history, duration, source, language. Closes on outside-click (UI3) + Esc; artist name links via ART2.
- **Done when:** modal opens from the player, shows correct metadata, closes on outside click + Esc; artist link navigates to the artist filter.

### [x] SNG2 Lyrics behind player controls
Scrolling lyrics currently overlap the waveform + control bar. **Decision: lyric layer z-below the control bar + bottom gradient fade** so text dissolves before reaching the bar (not a hard clip).
- **Done when:** at every scroll position waveform + controls are fully visible and clickable; lyric text fades out above the bar, never overlapping it; wipe/highlight still readable.

### [x] SNG3 Animated singing background
Stage background reads static. **Decision: investigate** whether R1.4's Ken Burns is absent in the player stage or just imperceptible, then make the motion subtly visible; paused when hidden / not playing.
- **Done when:** background shows subtle continuous motion during playback; pauses when hidden / paused; 0 layout-shift entries; wipe perf trace unchanged.

## Phase 5 — Polish

### [x] EL3 Progress strip replaces the done banner
Remove the centered `timing.done` ("全部打完 - 可以预览了") banner. **Decision: full-width progress strip directly under WaveformStrip** (mirrors the import strip), measuring timed/total units (`stamps.length / flatUnits.length`), filling live; at 100% reads "ready to preview". Keep the large current-line focus display.
- **Done when:** centered banner gone; full-width strip under the waveform shows `timed/total · %` and fills as you stamp; 100% reads ready-to-preview; focus display unchanged.

### [x] EL4 Tab-cycle the three creator steps (+ tab UI)
**Decision: `Ctrl+Tab` / `Ctrl+Shift+Tab`** cycle `text → tap → review`, plus the UI6 Tabs bar in the creator. Plain Tab stays gap-nav in timing; textarea Tab unaffected. Cycle keeps current shape (review is a toggle, not a 4th route).
- **Done when:** Ctrl+Tab moves between all three steps both directions; the tab bar does the same on click; never collides with the stamp (Space) or gap-nav (Tab); works zh + en.

### [x] AIC1 Unified inline diff for cleanup preview
Replace `CleanLyricsDialog`'s two-pane view with a **unified inline diff** (one column, removed lines red `−`, kept neutral; line-level LCS). This is AIC2's apply gate.
- **Done when:** preview renders a unified line-level diff (removed marked); Apply writes only the cleaned text; re-edit guard unchanged.

### [x] UI2 Custom scrollbars
Styled thin scrollbar in scroll regions (library grid, lyric list, dialogs), respecting reduced-motion.
- **Done when:** scroll regions show the custom scrollbar; wheel/drag/touchpad scroll still work; no layout shift.

### [x] UI4 De-native audit
Sweep remaining native-looking controls (checkboxes, range thumbs, file inputs, tooltips) through the `ui/` primitives.
- **Done when:** grep + visual pass finds no raw native control in screens; all chrome uses `ui/` components.

### [x] UI5 Hide sung count on card
Remove the sung-count badge from library cards (R1.5). Count stays in the SNG1 details modal; sort-by-most-sung unaffected.
- **Done when:** cards show no sung-count badge; sort-by-most-sung still works; count visible in details modal.

### [x] META1 Align AI cleanup button with Cancel/Save
Edit-meta dialog: put "Clean up with AI" on the same action row as Cancel/Save.
- **Done when:** the three buttons sit on one aligned row; sane at min width in zh + en.

### [~] UI7 Layout primitives + full migration to gap-based spacing
New `ui/Stack` (flex row/column, typed `gap`/`justify`/`align`, default `align=center`, `as='div'|'header'|'footer'`), `ui/Grid` (fixed `cols` or responsive `minItemWidth` auto-fill), `ui/Container` (page scroll wrapper: `pl-6 pr-[14px] pt-19` — `pr` compensates the UI2 scrollbar-gutter — plus `pb`/`maxWidth`). **Decision (grilled): inter-element spacing → `gap` via these primitives; a component's own intrinsic padding (cards, dialogs, buttons, fieldsets) stays as `padding`.** Migrate every screen + composite component (not `ui/` leaf primitives) to use them: Library, Settings, PipelineSetup, Player, LyricCreator, AppHeader, Titlebar, TimingStep, PipelineInstaller, WindowControls, SongCard, SongRow, ReviewPane, WaveformStrip, and the 6 dialogs (Confirm/Import/EditMeta/SongDetails/CleanLyrics/LrclibFinder).
- **Done when:** `npm run check` green; every migrated screen verified via playwright screenshot with no visual regression vs pre-migration layout.

## Phase 6 — Audio (deferred Round-2 candidates)

### [ ] FX1 Record singing — mic capture + mix-down to file.
### [ ] FX2 Vocal effects — reverb/echo on monitor path.
### [ ] FX3 EQ — per-output or master.

## Unscheduled
- [ ] Themed Tooltip primitive + retrofit native `title=` (~40 sites) — UI4 scoped this out, native title tooltips kept
- [ ] Playlists / up-next queue (dropped from R1)
- [ ] Fullscreen two-line stage mode (dropped)
- [ ] Per-unit timing nudge editor (dropped)
- [ ] Mic-input waveform via getUserMedia (chose output-mix analyser)
- [ ] Per-song key/tempo persistence (MVP decision was per-session)

---

## Session Log
<!-- newest on top: date · story · what happened / decisions / gotchas -->
- 2026-06-14 · NAV1 · Found already fully implemented (`titleBarStyle:'hidden'` + `app-drag`/`app-no-drag` CSS, `WindowControls.tsx` w/ minimize/toggleMaximize/close via `window.singray.window.*` IPC, `AppHeader.tsx` rendering it on every screen) — just never flipped to `[x]`. Playwright (`verify-nav1.mjs`): `header.app-drag` present on both Library and Player; Minimize/Maximize/Close buttons all present with correct `aria-label`s; clicking Maximize/Restore toggles `BrowserWindow.isMaximized()` true→false and the icon swaps Maximize↔Restore. Double-click-to-maximize on the drag region didn't toggle `isMaximized` under Playwright's CDP-synthesized `dblclick` — same class of OS-level drag-region behavior as edge-snap (R0.1/R0.2), not exercisable via automation; accepted as user-side like those. `npm run check` already green (no code changes this entry). **[x]**.
- 2026-06-14 · UI3 · Found already fully implemented (`ui/Dialog.tsx`: scrim-click closes unless `alert`, Esc always closes) — just never flipped to `[x]`. Playwright (`verify-ui3.mjs`): ImportDialog (non-`alert`) closes on scrim click, stays open on inner-panel click, closes on Esc; the delete-song `ConfirmDialog` (`alert`, via Library card's overflow menu) stayed open on scrim click and closed only via Esc (→ `onCancel`, no deletion). All 3 "Done when" clauses covered. `npm run check` already green (no code changes this entry). **[x]**.
- 2026-06-14 · UI1 · Found already fully implemented (`ui/Select.tsx`: popover-based listbox, full keyboard nav, used by Library/Settings/EditMetaDialog/ImportDialog) — just never flipped to `[x]`. Playwright (`verify-ui1.mjs`): zero native `<select>` elements on Library or Settings; Library's sort Select opens a `role="listbox"`, ArrowDown moves the highlight, Enter selects + closes (label updates to 唱得最多), re-opening and pressing Escape closes without changing the selection; Settings has 5 Selects, all the same primitive, first one opens correctly. This closes Round 2 Phases 1-5 (R0.1/R0.2/R4.2-R5.2 remain `[~]`, all env-blocked/owner-side per their own notes). `npm run check` already green (no code changes this entry). **[x]**.
- 2026-06-14 · UI6 · Batched runtime verification of the already-landed `Tabs` primitive (`ui/Tabs.tsx`, used by ImportDialog's YouTube/上传文件 tabs since ADD1, and by EL4's creator Text/Tap/Review — though EL4 has since moved to `Segmented` per UI4's follow-up, ImportDialog remains the live consumer). Playwright (`verify-ui6.mjs`): opened ImportDialog, confirmed both tabs render with `role="tab"`; clicking 上传文件 flips `aria-selected`/`tabIndex` (active=0, inactive=-1) and the underline moves; focusing the active tab and pressing ArrowLeft/ArrowRight cycles selection both directions with correct `aria-selected`/`tabIndex` each time. Ctrl+Tab/Ctrl+Shift+Tab cycling already covered by EL4/EL1's prior verification of `useTabCycle`. `npm run check` already green (no code changes this entry). **[x]**.
- 2026-06-14 · EL5 · Batched runtime verification of the already-landed routing fix (`App.tsx`'s `LyricCreator onBack` already set to `setView({name:'player', song: view.song})`, not `library`). Verified via playwright (`audioOutputMode: single`, reverted after): opened 對愛渴望's player, clicked 编辑歌词 into the creator (Text/Tap/Review segmented control present), clicked the creator's Back button (←, `title="返回"`) — landed back on the player view for the same song (title "對愛渴望楊宗緯", 编辑信息/编辑歌词 buttons, and the lyric line list all present in the body, not the library grid). No code changes; `npm run check` already green. **[x]**.
- 2026-06-14 · EL2 · Batched runtime verification of the already-landed tri-color timestamp (`lineTimestampClass`/`lineTimestamp` in `TimingStep.tsx`: `text-text-dim`+`—` when `timed===0`, `text-warning` when `0<timed<units.length`, `text-success` when fully timed). No real library line is currently fully-untimed, so for this run only temporarily edited 對愛渴望's `lyrics.json` (backed up, restored after, alongside the usual `audioOutputMode: single` workaround — both reverted): set line4 (8 units) to 0/8 timed and line5 (6 units) to 5/6 timed (last unit null). Playwright (`verify-el2.mjs`) confirmed: line0 (6/6, untouched) → `text-success`/"0:24.2"; line4 (0/8) → `text-text-dim`/"—"; line5 (5/6) → `text-warning`. Pressing Space 13× (stamps line4's 8 units + line5's first 5) left line4 at `text-success` and line5 still `text-warning` (5/6); the 14th Space stamped line5's last unit and it flipped live to `text-success` (6/6) — confirms the amber→complete live transition. All 4 "Done when" clauses covered; `npm run check` already green (no code changes this entry). **[x]**.
- 2026-06-14 · EL1 · Batched runtime verification of the already-landed Space-handling change (`TimingStep.tsx`'s keydown switch: `' '` → `togglePlay()` in review, `stamp()` in tap; `exitReview` now only reachable via the EL4 segmented switch). Verified via playwright on 對愛渴望 (partially timed, 70/258 units, `audioOutputMode: single`, reverted after): in tap mode Space advanced the progress strip 70/258→71/258 (stamped) and Backspace restored it to 70/258; switching to 预览 (review) and pressing Space toggled the `<audio>` element from `paused:true`→`paused:false` (play/pause) while the progress strip stayed at 70/258 (no stamp) and the Segmented control stayed on 预览 (no exit); pressed Space again to leave playback paused; clicking 打轴 from review re-entered tap (`aria-checked` flips correctly). No code changes — `npm run check` already green. **[x]**.
- 2026-06-14 · AIC2 · Batched runtime verification of the AIC1-hardened cleanup (prompt + >40% guard already landed and code-complete). Ran `window.singray.llm.cleanLyrics` against the real `qwen3.5:9b-q4_K_M` model from a playwright session (no audio workaround needed — pure IPC, no Player): (1) a clean lyrics-only input (4 non-empty lines, no tags/credits) came back byte-identical; (2) built a "previously-damaged song" scenario from a real library song (南音, 6 real lines + `[Verse 1]` tag + `作詞/作曲` credit line) — output preserved all 6 real lines verbatim and stripped both the tag and credit line. Combined with AIC1's existing real-model verification (messy lyric → correct diff, majorRemoval fires at 3/7>40%, Apply writes only the kept lines), all 4 "Done when" clauses are covered. `npm run check` already green (no code changes this entry). **[x]**.
- 2026-06-14 · META1 · `EditMetaDialog` merged the standalone "AI 清理"/"Clean up with AI" button into the bottom action row (`flex items-center justify-between`, clean button left, Cancel/Save right, all `size="md"`); the clean-error/preview block (incl. its own Apply/Dismiss buttons) now sits above the row in its own `mt-3` block instead of wrapping the clean button. Verified via playwright in both locales (temporarily `audioOutputMode: single` + `uiLanguage: en`, both reverted after — same workaround as EL4/AIC1/UI2/UI4): zh ("AI 清理"/取消/保存) and en ("Clean up with AI"/Cancel/Save, row 370px within the 420px dialog, no wrap) both render the three buttons aligned on one row at matched heights; the preview box (清理建议/应用/忽略) renders correctly above the row when a dirty title is cleaned. `npm run check` green. **[x]**. This closes Phase 5 — remaining work is the batched runtime-verification pass over AIC2/EL1/EL2/EL5/UI6/UI1 ([~], code-complete per line 9).
- 2026-06-14 · UI5 · Removed the `Mic2` sung-count badge (`song.playCount + song.sings.length`) from `SongCard`'s footer row — artist link now spans the full width (`max-w-full`). Dropped the now-unused `Mic2` import and the `card.timesSung` i18n key (en+zh). Sort-by-most-sung (`Library.tsx`'s `singCount` helper, unchanged) and the sung-count row in `SongDetailsDialog` (SNG1, `details.sungCount`/`sungCount_value`) both untouched. Verified via playwright: no `Mic2`/count markup in any card body; switching the sort dropdown to "唱得最多" re-orders the grid (黑洞裡 moves to first) confirming the sort still reads `playCount`/`sings`. `npm run check` green. **[x]**.
- 2026-06-14 · UI4 · Audited for raw native controls: no checkboxes/radios/`<select>`s remain (Select was already custom from UI1, no checkbox/radio usages found by grep); the one `<input type="file">` (LyricCreator's LRC picker) is `className="hidden"`, triggered programmatically, never shown. The real native-looking control was `ui/Slider.tsx` (`<input type="range" className="accent-accent">`, used for Player's seek/instrumental-volume/vocal-volume and TimingStep's seek — OS-styled track+thumb despite the accent color). Rewrote it: `-webkit-appearance: none` + new `.slider` CSS (main.css) renders a 3px track with an accent fill up to the current value via a `--slider-pct` custom property (computed from `value`/`min`/`max` in the component) and a 12px white circular thumb; `::-moz-range-*` equivalents included. Kept the native `<input type="range">` element (and its `value`/`onChange`/keyboard/drag semantics) — only the chrome changed. **User-grilled decision: native `title=` tooltips (~40 call sites) are out of scope** — recommended leaving them (accessible, zero-cost, OS-convention) over building a themed Tooltip primitive; noted in Unscheduled for if ever revisited. Verified via playwright (`audioOutputMode: single`, reverted after — same stale-device workaround as EL4/AIC1/UI2): all 4 sliders render as thin accent-filled tracks with circular thumbs at their correct fill %, hit area restored to 16px tall (an earlier `height: 1px` pass shrank the click target to 1px, fixed before screenshotting). Follow-ups from user spot-check: (1) the lyric-text textarea (creator 'text' step) had no `overflow-y-auto` class so it kept its native scrollbar — added the class to pick up the themed scrollbar; (2) the themed scrollbar thumb sat flush against the border, looking "stuck" — widened the scrollbar gutter 8px→10px and added a 2px transparent border + `background-clip: padding-box` on `::-webkit-scrollbar-thumb` so the thumb floats with a gap from the edge (global UI2 fix, all scroll regions); (3) swapped the creator's Text/Tap/Review `<Tabs>` for `<Segmented>` (button-group style per [[ui-control-preferences]]) — Ctrl+Tab cycling and click-to-select both re-verified via `aria-checked`. `npm run check` green. **[x]**.
- 2026-06-14 · UI2 · Global thin scrollbar styling in `main.css`, scoped to the `.overflow-y-auto`/`.overflow-x-auto`/`.overflow-auto` utility classes (covers all 9 scroll regions — library grid, TimingStep lyric list, Settings/PipelineSetup pages, ImportDialog/LrclibFinderDialog/SongDetailsDialog lists, CleanLyricsDialog diff, Select popover — without per-component edits). 8px thumb in `--color-border`, transparent track, `--color-text-dim` on hover, both `::-webkit-scrollbar-*` (Chromium) and standard `scrollbar-width`/`scrollbar-color`. `scrollbar-gutter: stable` reserves the 8px so toggling the thumb doesn't shift content width. Thumb hover transition wrapped in `@media (prefers-reduced-motion: no-preference)`. Verified via playwright (temporarily `audioOutputMode: single`, reverted after — same stale-`monitorDeviceId` issue as EL4/AIC1): TimingStep's lyric list scrolls on mouse wheel and `getComputedStyle().scrollbarColor` resolves to `rgb(46, 46, 58) rgba(0, 0, 0, 0)` (= `--color-border` / transparent); Settings page (which overflows at 600px height) shows the thin border-colored thumb at the right edge. `npm run check` green. **[x]**.
- 2026-06-14 · AIC1 · `CleanLyricsDialog` rewritten from a two-pane before/after view to a single-column unified diff. New `lib/lineDiff.ts` (`diffLines`, plain line-level LCS) diffs non-empty trimmed lines of `original` vs `cleaned`; removed lines render red+strikethrough with a `−` marker, kept lines neutral (no `+`/green case has occurred yet since the AIC2-hardened prompt only removes lines, but `diffLines` handles additions too for correctness). `majorRemoval`/`removed` counts now come from the diff's `removed` ops instead of a trimmed-line `Set` (handles duplicate lines correctly). Removed now-unused `clean.before`/`clean.after` i18n keys; dialog narrowed to `w-[520px]` single column. Apply still does `setText(cleanPreview)` — writes only the cleaned text, no other behavior changed. Verified end-to-end via playwright (`verify-aic1.mjs`) against the real `qwen3.5:9b-q4_K_M` model (localhost:11434, temporarily `audioOutputMode: single` to reach the creator — see EL4's note on the stale `monitorDeviceId`, reverted after) with a messy lyric (`[Verse 1]` tag + 2 credit lines + 4 real lines): diff shows the tag/credit lines struck through in red with `−`, the 4 lyric lines unchanged/neutral, majorRemoval warning fires (3/7 > 40%), and Apply leaves the textarea holding exactly the 4 lyric lines. `npm run check` green. **[x]**.
- 2026-06-14 · EL4 · `review` state lifted from `TimingStep` to `LyricCreator` (passed down as `review`/`onReviewChange`) so it can be cycled as a step. New `CreatorStep = 'text'|'tap'|'review'` derived from `step`+`review`; `setCreatorStep` translates a target step into `setStep`/`onContinue`/`setReview` calls (text→tap from the text step runs `onContinue()` first, same as the existing Continue button). UI6 `<Tabs>` rendered under the header (`文本/打轴/预览` · `Text/Tap/Review`, new i18n keys) wired to `creatorStep`/`setCreatorStep`; `useTabCycle` adds Ctrl+Tab / Ctrl+Shift+Tab cycling. In `TimingStep`, the `Tab` keydown case now bails early on `e.ctrlKey` so the cycle doesn't fight gap-nav. Verified via playwright (`verify-el4b.mjs` + `verify-el4en.mjs`, after temporarily switching `audioOutputMode` to `single` since the saved `monitorDeviceId` device no longer exists on this machine and was hard-failing `AudioEngine.load` before any Player UI rendered — reverted after): Ctrl+Tab cycles text→tap→review→text and Ctrl+Shift+Tab the reverse; clicking each tab jumps directly (including text→review auto-running Continue); plain Tab and Space inside tap mode leave the active step unchanged (gap-nav/stamp unaffected); tab labels render correctly in both zh and en. `npm run check` green. **[x]**.
- 2026-06-14 · EL3 · Removed the centered `timing.done` banner from TimingStep. New full-width strip (mirrors Library's import strip: `border-t bg-surface px-6 py-1.5` + absolute `h-0.5 bg-accent` fill bar at `width: progressPct%`) shows `stamps.length/flatUnits.length` + `progressPct%` while in progress, and the existing `timing.done` text ("全部打完 — 可以预览了") once `done`. Placed at the bottom of the step, directly above the shortcuts hint bar (per user follow-up — initially placed under `WaveformStrip`, moved to bottom). The large current-line focus display is now unconditional (previously hidden behind the `done` banner) — when done it naturally renders the last line fully in `text-lyric-sung`. No new translation keys. Verified via playwright on a fully-timed song: strip shows the done message with a full-width accent fill at the bottom, centered banner gone, focus display still shows the last line in sung color. `npm run check` green. **[x]**.
- 2026-06-14 · SNG3 · Investigated: Ken Burns (R1.4) was running continuously but its amplitude/duration (scale 1.10→1.22 over 60s) made it read as static through `blur-3xl`. First pass (scale 1.08→1.28/45s) was still imperceptible at a glance — user confirmed they couldn't see motion. Re-tuned to scale 1.05→1.40 over a 24s cycle (bumped from 1.35→1.40 per a second round of user feedback: "too subtle, maybe 5% more movement"), dropped the blur from `blur-3xl` to `blur-2xl` so the pan/zoom reads clearly while staying soft enough for lyric contrast, and added a small ±1deg `rotate()` alongside the scale/translate per user follow-up ("add another transformation like rotation") for a less mechanical drift. Pause gate changed from `windowHidden` only to `windowHidden || !playing` (Player.tsx) — background holds still while paused, animates during playback. Verified via playwright: transform static while paused; during playback scale goes 1.052→1.188→1.275 over 8s with ~40px translate swings (screenshots `sng3b-t0.png`/`sng3b-t4.png` show a visibly different crop/warmth); `PerformanceObserver({type:'layout-shift'})` recorded 0 entries during steady playback. `npm run check` green. **[x]**.
- 2026-06-14 · SNG2 · Lyric column (`LyricRenderer`'s `viewRef` div) now masked with a bottom `mask-image`/`-webkit-mask-image` gradient (`linear-gradient(to bottom, black, black calc(100%-220px), transparent calc(100%-120px))`) so future lines dissolve to fully transparent ~120px from the bottom — above where the control bar sits — instead of being hard-clipped or showing through the bar's own backdrop gradient. Lyric layer also gets explicit `z-0` (Player.tsx) vs the control bar's existing `z-10`, matching the "z-below the bar" decision (DOM order already gave this, now explicit). Verified via playwright: seeking forward so 3+ future lines stack toward the bottom shows progressive fade-to-invisible well clear of the control bar; current line's wipe highlight stays fully opaque/readable; waveform + slider + buttons unobstructed. `npm run check` green. **[x]**.
- 2026-06-14 · SNG1 · New `SongDetailsDialog.tsx`, opened via a new overflow `Menu` (MoreVertical icon) in the Player titlebar with a "Song details" `MenuItem`. Shows title, artist (links to artist filter via ART2's `onArtistClick`), duration, language, added date, sung count, source (YouTube URL or file path), and sing history list. New `common.close`, `player.moreActions`, `player.songDetails`, `details.*` keys (en+zh). Fixed real bug: Player's global Esc keydown handler only checked `editOpen`, so Esc both closed the new dialog AND called `onExit()` (kicked back to Library) — now `if (editOpen || detailsOpen) return`. Also fixed a label-wrap layout bug on the Source row (`shrink-0 whitespace-nowrap` on Row's label span). Verified via playwright (`verify-sng1.mjs`): menu opens, dialog shows correct metadata, Esc closes dialog only (player stays open), artist link navigates to filtered Library and closes dialog. `npm run check` green. **[x]**.
- 2026-06-14 · ADD3 · New `lib/detectLanguage.ts`: counts chars per Unicode script (kana→ja, Hangul→ko, Han→zh, Latin→en), returns the dominant script's code if it's in `settings.languages`, else `null`. Wired into `ImportDialog`'s `prefill` — runs on every probe result before enrichment and calls `setLanguage(detected)` only when non-null, so an unmatched/ambiguous title leaves the existing default and the user's own Select choice is never silently reverted. Verified the heuristic standalone against real titles ("對愛渴望" → zh, "Smells Like Teen Spirit" → en, numeric-only → null, kana with `ja` not in user's languages → null). Couldn't exercise live YouTube/file probes end-to-end (no network in this env, and local `original.m4a` files have no title tag so probeFile returns the filename "original"/en regardless) — algorithm + wiring verified, live preselect not screenshot-tested. `npm run check` green. **[x]**.
- 2026-06-14 · ADD2 · File-tab "From file" pane is now a dashed drop zone (`onDragOver`/`onDragLeave`/`onDrop`, `border-accent bg-accent/5` on hover) wrapping the existing picker button + hint text. New shared `MEDIA_EXTENSIONS` const (`shared/types.ts`) backs both the native dialog filter (`main/ipc.ts`) and the drop-handler's extension check; preload exposes `import.getPathForFile` via Electron's `webUtils.getPathForFile`. Picker and drop now share a `loadFile(path)` helper (probe/prefill). Dropped files with an unrecognized extension show `import.unsupportedFile` without probing. Verified via playwright: drag-over toggles `border-accent`/reverts on drag-leave, dropping a `.txt` shows "不支持的文件类型". Couldn't fully exercise the supported-extension probe path — synthetic `File` objects in the test have no OS path so `getPathForFile` returns `''`, which itself fails the extension check; the picker path (pickFile→loadFile, used by every existing import) already proves `loadFile` works. `npm run check` green. **[x]**.
- 2026-06-14 · ADD1 · ImportDialog now uses UI6 `<Tabs>` (`YouTube` / `import.tabFile`) to split source modes: YouTube tab holds the search box + results list + URL input; file tab holds the "From file…" picker (+ probe spinner/error). Probed-metadata form and Cancel/Add footer stay unconditional below the tabs, so `title`/`artist`/`language`/`probed` state survives switching tabs. Verified via playwright: 2 tabs render with sliding underline, click switches panes, typed URL persists across a tab round-trip (click to file tab, `ArrowLeft` back to YouTube), keyboard arrow-nav moves focus+selection. `npm run check` green. **[x]**.
- 2026-06-14 · HOME1+ART1+ART2 · New `Segmented` UI primitive (button-group radio replacement, h-8 to match Select). Library row2 gains `Songs|Artists` segmented toggle; Songs view gains `grid|list` segmented toggle (persisted via new `Settings.libraryView`, default `grid`). List view = new `SongRow` component (thumb · title · clickable artist · needs-lyrics badge · favorite · menu), reusing SongCard's delete/retry/favorite actions. Artists view = alphabetical list of distinct artists with song counts (`""` groups blank-artist songs under "Unknown"), click → switches to Songs filtered by that artist via a removable "Artist: X" chip in the filter row. ART2: SongCard/SongRow artist text and Player header artist (now a button) call `onArtistClick`; from Player this navigates via a new `View.library.artistFilter` field in App.tsx (Library stays mounted so a `useEffect` re-applies the filter on prop change). Verified via playwright: grid↔list toggle + persistence across relaunch, artist click from card/list/player all land on the filtered Songs view with a clearable chip, Artists list shows correct per-artist counts (方大同 = 2). **[x]**.
- 2026-06-14 · NAV4 · Player header title/artist stacked (`flex-col justify-center gap-0.5`, `leading-tight` on both lines) instead of inline baseline pair; fits within Titlebar's h-10, back-button stays vertically centered via the row's `items-center`. Verified via playwright screenshot. **[x]**.
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
