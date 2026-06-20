# Singray — Decisions Log

Narrative decision history. Round-by-round resolutions, the *why* behind them, and
gotchas. Work items themselves live as **GitHub Issues** on the project board; this
file is the prose record that issue comments scatter too thin to hold.

Prior history (Rounds 1–3, MVP) is archived under `docs/history/`, including the
legacy `BACKLOG.md` Session Log.

---

## Round 4 — modernization + open-source rails (grilled 2026-06-20)

Two tracks, **rails first** so the UI migration dogfoods the new pipeline (every
shadcn/react-query PR exercises release-please + branch protection).

### Track 1 — Governance / release rails (build first)

| Item | Decision | Why |
|---|---|---|
| **Backlog model** | Hybrid. Plannable features/bugs → GitHub Issues + Projects board. This `DECISIONS.md` keeps the narrative. `CLAUDE.md` resume protocol reads the board (`Status` + `Priority` fields, P0/P1/P2) for order + read DECISIONS.md. | Issues enable plan-anytime / auto-close-on-merge / outside contributors; the board's Priority field gives picks a real ordering signal; in-repo prose keeps the rich decision history that issue comments fragment. |
| **Workflow** | Same flow for everyone: issue → branch → PR → squash-merge, Conventional Commit PR titles, branch protection on `main`. | Keeps release-please changelog clean (one line per PR); dogfoods the contributor experience; no two mental models. |
| **Release** | `release-please` + GitHub Actions. Release-PR bumps version + CHANGELOG; merge → tag + GitHub Release; workflow builds the Windows exe and attaches it. | Automated but gated by the release-PR. Requires strict Conventional Commits going forward. |
| **Code signing** | Ship **unsigned**, document the SmartScreen "unknown publisher" warning in README/release notes. | Signing cert costs money; not worth it for a personal app's download count. |
| **Deps** | Update **all to latest**, chase fallout. Hard blocker only if electron-vite 5 can't run Vite 8 → pin that one back and report. | Majors (TS 6, Vite 8, plugin-react 6, @types/node 26) carry compat risk; gate on `npm run build` staying green. |
| **Docs** | Merge `docs/rounds` + `docs/feedback` into one history dir; fold ongoing decisions into this file / release notes. | The two folders were the same thing (dev history). |
| **build/ vs resources/** | Not a bug — keep both. `build/` = electron-builder package-time assets (installer icons, mac entitlements). `resources/` = runtime-bundled (`asarUnpack`), `main/index.ts` imports `resources/icon.png` for the window icon. Same source image, two consumers. Document it. | electron-vite scaffold convention; they serve different lifecycle stages. |
| **.github** | Lean per-feature PR template + issue templates; CONTRIBUTING → standard OSS flow. | Contributors raise one feature/bug at a time, not BACKLOG mass-updates. |
| **Pipeline** | Review backend Python, fix issues found. | — |
| **localhost:5173 blank** | Dev-only mock bridge: when `window.singray` is absent (browser), install a mock implementing the IPC surface with fixture data. | Renderer is Electron-only; mock makes it browser-runnable for fast component dev + react-scan during the UI migration. |

### Track 2 — UI migration (driven over the rails)

| Lib | Decision | Why |
|---|---|---|
| **TanStack Router** | **Skip.** Add a nav-stack to `AppContext` + Alt+←/→ hotkeys for back/forward. | Electron has no address bar; router's value (deep links, loaders, code-split) is unused, and it'd force song-object → id route-param refactor. Real need was just history-for-hotkeys. |
| **State** | **zustand, selective** — genuinely-shared client state (player transport, lyric-creator wizard). Drop TanStack Store (redundant). | Most "state" is server/IPC data react-query should own; two competing state libs make no sense. |
| **react-query** | Request/response reads + mutations (settings, lrclib, llm models, probe; edit/delete/import). Event-pushed lists (`library:changed`, `import:progress`) stay thin queries invalidated from the event listener. | Data freshness is push-based, not poll-based, so query's staleTime/refetch are dead weight on the lists — but dedup/loading/error/optimistic-mutations still pay off elsewhere. |
| **RHF + zod** | RHF + `zodResolver` on **all forms**. | User chose full standardization over native-form minimalism. |
| **zod** | Schemas are **source of truth**; infer TS types for shared contracts. Also validate untrusted external API responses (lrclib, LLM). | One contract definition; runtime safety at the external boundary. |
| **shadcn/ui** | Rename tokens to shadcn vars (`--primary`/`--background`/`--muted`/`--ring`) carrying the **brand values**. Primitives-first → per-screen (Settings → Library → Player → LyricCreator), each a green commit. `cn` + `cva` + Radix. Update `check-design.mjs` for shadcn semantic classes; exempt `ui/` from the arbitrary-value rule (Radix needs them). | Keep branding, adopt shadcn sizing/spacing + Radix a11y (focus-trap on hand-rolled Dialog/Popover/Combobox/Select). |
| **TanStack Pacer** | In — debounce/throttle (search, waveform, tap-timing). | — |
| **immer** | In — nested immutable updates where they appear (e.g. import-progress Map, lyric timing). | — |
| **react-scan** | In, dev-only — perf auditing during the migration. | Zero prod cost, finds wasted re-renders. |

### deps update — done #7 (2026-06-20), deviations from the Deps row above

| Choice | Decision | Why |
|---|---|---|
| **Vite 8** | **Pinned back to ^7.** electron-vite 5.0.0's peer is `vite ^5 \|\| ^6 \|\| ^7` — the named hard blocker. | Predicted in the issue; electron-vite hasn't shipped a Vite 8-compatible release yet. Revisit when it does. |
| **@vitejs/plugin-react 6** | **Pinned back to ^5.** plugin-react 6 requires `vite ^8`, so it's bound to the Vite pin. | Bumps in lockstep with Vite 8. |
| **Everything else** | Bumped to latest incl. majors: **TS 6**, **@types/node 26**, biome 2.5, electron 42.4.1, electron-builder 26.15.3, tailwind 4.3.1, lucide-react 1.21. | Per the row; `npm run build` stays green. |
| **TS 6 fallout** | Dropped deprecated `baseUrl` from `tsconfig.web.json` (TS5101) and made the `@renderer/*` path entry relative (`./src/...`, TS5090). biome 2.5 config migrated via `biome migrate`. | TS 6 deprecates `baseUrl`; paths resolve relative to the config file without it. |
| **Audit** | `npm audit fix` cleared the high (undici). One **low** (esbuild dev-server file-read on Windows) remains — it's gated behind the Vite 7 pin and is dev-server-only. | Can't fix without Vite 8; not shipped in the app. Clears with the Vite bump. |

### pipeline audit — done #11 (2026-06-20)

Audited `pipeline/pipeline.py` (+ `setup.ps1`/`setup.sh`/`ruff.toml`) and verified by running.

| Finding | Outcome |
|---|---|
| **Functional correctness** | No bugs. Verified end-to-end on the RTX 5060 Ti: `process` ran download → GPU separation (~18 it/s) → loudnorm gain → FLAC ×3 + thumb, exit 0, correct JSON-lines contract. `probe`/`search`/`list-models` also exercised against live YouTube + the model registry. `ruff check` + `ruff format` already clean. |
| **Cleanups applied** | Dropped a redundant in-function `import shutil` (already module-level); fixed stale `vocals.m4a` wording in the `align` docstring/help — stems default to FLAC now and the code already resolves either extension. |
| **Benign warnings (not fixed)** | `audio-separator` logs (a) `CUDAExecutionProvider not available in ONNXruntime` — only bites ONNX models; the default karaoke `.pth` runs on the torch CUDA path (GPU confirmed), so left alone rather than chasing an onnxruntime-gpu/cu128 pin; (b) libsndfile `Could not detect input audio bit depth` on the `.webm` download → defaults PCM_16, separation decodes via ffmpeg regardless. Both cosmetic. |

### Carry-over
- `R3.REC2` Recordings view (only open item from Round 3) → migrate to an Issue.

### shadcn foundation — built #14 (2026-06-20), deviations from the row above

| Choice | Decision | Why |
|---|---|---|
| **Staging** | **Big-bang, not per-screen.** Destructive token rename + all consumers + Radix primitives + all 4 screens in one PR (#14), closing **#15–18** with it. | The renamed tokens can't coexist with old `bg-bg`/`text-text` classes, so a partial rename is never green. One atomic rename commit keeps `npm run check` green; per-screen staging was impossible once the rename is destructive. |
| **Primitives** | **Replaced in place** (same prop APIs) so the ~50 consumers didn't churn. Popover went from a presentational panel to the Radix trigger/anchor/content model — Menu, TunePopover, LlmModelCombobox rewired; `PlayerContext` exposes `setTuneOpen` (was `toggleTune`/`tuneRef`); `usePopoverClose` deleted. | Radix gives the a11y (focus-trap/return on Dialog, roving focus + typeahead on Select, collision portals on Popover) the hand-rolled versions lacked, without a prop-API break across screens. |
| **Combobox** | **No cmdk.** Landed as editable `Input` + Radix `Popover` suggestion list (the one consumer, LlmModelCombobox, is type-or-pick-arbitrary). | cmdk's search-inside-popover focus model would turn an always-visible settings field into a worse two-step UX; the unused dep + `Command` primitive were dropped to avoid dead code. Re-add cmdk if a non-editable command-palette combobox ever appears. |
| **Motion** | Radix overlays use small CSS `data-[state]` keyframes (pop/fade) instead of the old `motion` springs. | Radix portals don't compose with the `AnimatePresence` spring presets cheaply; the brand look is unchanged, only the easing differs. |

### shadcn primitives — built #43 (2026-06-20), deviations from the row above

| Choice | Decision | Why |
|---|---|---|
| **Font base** | `body { font-size: 14px }` removed → stock 16px default; control text stays `text-sm` via Tailwind. | Stock shadcn primitives are sized against a 16px base. Keeping 14px made hand-ported `h-9`/padding ratios compute wrong relative to the shadcn source, causing row-height misalignment. |
| **Slider** | Native `<input type="range">` + `.slider` CSS block → `@radix-ui/react-slider`. | Completes the Radix-first primitive set (Select/Dialog/Popover were already Radix since #14). Drops the one native-input outlier and gains keyboard a11y at no API cost — call sites kept the plain `value`/`onChange(n)` signature via a thin wrapper. |
| **Segmented** | Custom flex group → `@radix-ui/react-toggle-group`. | ToggleGroup provides roving focus + managed pressed-state; same `options[]` prop API preserved. |
| **Toggle** | `Button`-based `aria-pressed` div → `@radix-ui/react-toggle`. | Radix Toggle owns the `aria-pressed` semantics + keyboard activation; borrows `buttonBase` CVA for size/variant classes since Radix has no native size prop. |
| **Tabs** | Custom tabs + `motion` underline → `@radix-ui/react-tabs` (stock shadcn muted-pill list). | `motion` underline was the only remaining `motion` dependency on the primitive layer; Radix Tabs handles roving focus + keyboard. `useTabCycle` hook is independent and unchanged. |
| **Menu** | Radix `Popover` + manual close context → `@radix-ui/react-dropdown-menu`. | `DropdownMenuItem` auto-closes via `onSelect` (no manual `MenuClose` context needed); Radix handles Esc + outside-click. SongCardMenu's card-click-through risk resolved: Trigger does only `e.stopPropagation()` — Radix's own handler still fires and drives open/close. |
| **Animations** | Custom `pop-in`/`pop-out`/`fade-in`/`fade-out` keyframes removed → `tw-animate-css` + Radix `data-[state]` classes. | `tw-animate-css` provides the `animate-in`/`fade-in-0`/`zoom-in-95` classes stock shadcn source references; custom keyframes were duplicates. |

---

## Round 5 — workflow rules + UI fixes (2026-06-20)

### #55 — worktree-per-task + in-progress discipline

| Choice | Decision | Why |
|---|---|---|
| **Worktree location** | Sibling dir `../singray-worktrees/<branch>` (e.g. `git worktree add ../singray-worktrees/feat-19-foo -b feat/19-foo`). | Keeps worktrees out of the primary checkout; simple relative path works on any machine. |
| **Enforcement** | Doc-rule only in CLAUDE.md — no helper script. | Script adds a file to maintain; the rule is trivially followable from the doc. |
| **In-Progress timing** | Move to In Progress **before first commit**, not at PR open. | Prevents agents from double-picking an item that another agent has already started but not yet committed. |

### #58 — system default device select rendered blank

| Choice | Decision | Why |
|---|---|---|
| **Root cause** | Not the audio-routing logic (`setSink`/`enableMic` already treated `''` as "omit constraint" correctly) — it was `@radix-ui/react-select`'s `Select.Value`, which hardcodes `shouldShowPlaceholder(value) => value === '' \|\| value === undefined`. Any `Select.Item` with `value=""` can never render its label in the trigger; Radix can't tell "selected the empty-string item" apart from "nothing selected". | Found by building the app and screenshotting Settings — all three System Default options (monitor/stream/mic) showed a blank trigger, never the label, regardless of the underlying setting. |
| **Fix** | `ui/Select.tsx` remaps `''` to an internal sentinel for Radix only, translated back at the `value`/`onChange` boundary. Settings/IPC/audio-engine code is untouched — it was already correct. | Keeps the fix to one generic primitive instead of special-casing every call site that uses `''` as a "default" sentinel. |

### #71 — lead-in countdown to first lyric word

| Choice | Decision | Why |
|---|---|---|
| **Silence padding = scheduling delay, not audio splice** | Delay `engine.play()` by `(lead - onset)` wall-clock seconds when onset < lead. No audio buffer is edited; the gap is real-time silence before the engine starts. | Matches spec's "scheduling, not editing the audio file" — simplest implementation that satisfies the requirement. |
| **Eligibility tracking** | `playFromStartEligible` ref (reset per song, cleared by any seek or first play). CountdownOverlay fires only when the ref is true AND `engine.position === 0`. | Gate excludes: resume-after-pause (ref consumed on first play), seek-then-play (seek clears ref), re-play after song ends (position no longer 0). |
| **Arrow-key seeks route through context `seek()`** | Moved `seek` callback definition above the keyboard effect; ArrowLeft/Right now call `seek(position ± 5)` instead of `engine?.seek(...)`. | Ensures keyboard seeks also clear `playFromStartEligible` and cancel any active pad countdown, consistent with all other seek paths. |
| **CountdownOverlay in shared/**, not player/ | `src/renderer/src/components/shared/CountdownOverlay.tsx` — pure presentational, usable by #65 prep dialog without importing from player/ namespace. | Issue asked to reuse overlay with #65; placing it in shared/ avoids a circular or cross-namespace import later. |
| **No countdown overlay for #65 yet** | #65 (pre-record prep dialog) is still open; it can import `CountdownOverlay` directly when built. No wiring done in this PR. | Scope boundary: #71 builds the component, #65 integrates it. |

### #85 — release-please: fix repo permission, hold until Round 5 closes

| Choice | Decision | Why |
|---|---|---|
| **Repo permission** | Flipped `Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"` on (`can_approve_pull_request_reviews: true`). | This, not the trigger, was the actual cause of the failed run (#85): Actions couldn't open the release-PR at all. |
| **Trigger stays `push: branches: [main]`** | Considered switching to `milestone: types: [closed]`, reverted. | One-release-per-merge is the flow we want long-term; gating the trigger itself would've meant rebuilding it later. |
| **Gate job added instead** | New `gate` job checks whether the Round 5 milestone is open (`gh api repos/.../milestones?state=all`) and sets `proceed`; `release-please` job now has `needs: gate` + `if: needs.gate.outputs.proceed == 'true'`. | Holds every release (including v1.0) until Round 5 actually finishes, per [[v1-release-on-round5-close]]. Once Round 5 closes the milestone permanently reports `closed`, so the gate is a permanent pass-through — no further change needed for v1.0 onward to release on every merge. |

### #61 — AI Assist provider presets + strict model dropdown

| Choice | Decision | Why |
|---|---|---|
| **Cloud base URLs are fixed, not user-editable** | `llmBaseUrl` in Settings now only applies to Ollama; OpenAI/Anthropic/Gemini/OpenRouter each resolve to a hardcoded base URL in `llm.ts` (`PROVIDER_DEFAULTS`), hidden from the UI. | The issue asked for presets specifically to remove free-typed endpoint config for cloud providers; a hidden fixed URL per preset is what "preset" means here — only Ollama (local, variable port/host) still needs the field. |
| **Anthropic `/v1/models` reuses the existing `{data:[{id}]}` zod schema** | Same `ListModelsResponseSchema` as the OpenAI-compatible path, just different headers (`x-api-key` + `anthropic-version` instead of `Authorization: Bearer`). | Anthropic's models-list response happens to have the identical shape; a second near-duplicate schema would've been pure duplication. |
| **Anthropic `max_tokens` hardcoded to 4096** | No UI control for it; picked generous enough to not truncate the lyric-cleanup prompt (the longest-running call through `chat()`). | Anthropic's Messages API requires `max_tokens` (OpenAI-compat doesn't); this is a personal app, not metered, so generous-and-fixed beats a new setting. |
| **Gemini model list filtered to `supportedGenerationMethods.includes('generateContent')`** | Gemini's `/v1beta/models` also returns embedding-only models; un-filtered they'd show up as chat model choices and fail at call time. | Keeps the strict dropdown actually strict — every listed model must work for the chat/test call. |

Verified live against real Anthropic/Gemini endpoints with a throwaway key (both correctly returned and parsed real `401`/"API key not valid" errors); Ollama path unchanged. OpenAI/OpenRouter share Ollama's OpenAI-compatible code path, not separately live-tested.
