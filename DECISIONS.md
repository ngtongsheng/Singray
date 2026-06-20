# Singray — Decisions Log

Narrative decision history. Round-by-round resolutions, the *why* behind them, and
gotchas. Work items themselves live as **GitHub Issues** on the project board; this
file is the prose record that issue comments scatter too thin to hold.

Prior history (Rounds 1–3, MVP) is archived under `docs/` and the legacy
`BACKLOG.md` Session Log.

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

### Carry-over
- `R3.REC2` Recordings view (only open item from Round 3) → migrate to an Issue.

### shadcn foundation — built #14 (2026-06-20), deviations from the row above

| Choice | Decision | Why |
|---|---|---|
| **Staging** | **Big-bang, not per-screen.** Destructive token rename + all consumers + Radix primitives + all 4 screens in one PR (#14), closing **#15–18** with it. | The renamed tokens can't coexist with old `bg-bg`/`text-text` classes, so a partial rename is never green. One atomic rename commit keeps `npm run check` green; per-screen staging was impossible once the rename is destructive. |
| **Primitives** | **Replaced in place** (same prop APIs) so the ~50 consumers didn't churn. Popover went from a presentational panel to the Radix trigger/anchor/content model — Menu, TunePopover, LlmModelCombobox rewired; `PlayerContext` exposes `setTuneOpen` (was `toggleTune`/`tuneRef`); `usePopoverClose` deleted. | Radix gives the a11y (focus-trap/return on Dialog, roving focus + typeahead on Select, collision portals on Popover) the hand-rolled versions lacked, without a prop-API break across screens. |
| **Combobox** | **No cmdk.** Landed as editable `Input` + Radix `Popover` suggestion list (the one consumer, LlmModelCombobox, is type-or-pick-arbitrary). | cmdk's search-inside-popover focus model would turn an always-visible settings field into a worse two-step UX; the unused dep + `Command` primitive were dropped to avoid dead code. Re-add cmdk if a non-editable command-palette combobox ever appears. |
| **Motion** | Radix overlays use small CSS `data-[state]` keyframes (pop/fade) instead of the old `motion` springs. | Radix portals don't compose with the `AnimatePresence` spring presets cheaply; the brand look is unchanged, only the easing differs. |
