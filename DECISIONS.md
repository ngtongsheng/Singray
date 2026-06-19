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
| **Backlog model** | Hybrid. Plannable features/bugs → GitHub Issues + Projects board. This `DECISIONS.md` keeps the narrative. `CLAUDE.md` resume protocol switches to `gh issue list` + read DECISIONS.md. | Issues enable plan-anytime / auto-close-on-merge / outside contributors; in-repo prose keeps the rich decision history that issue comments fragment. |
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

### Carry-over
- `R3.REC2` Recordings view (only open item from Round 3) → migrate to an Issue.
