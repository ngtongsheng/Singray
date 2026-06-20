# Singray — Project Instructions

Personal desktop karaoke app. Electron + React + TS + Tailwind v4, Python pipeline for YouTube download + UVR stem separation. Windows first.

## Source of truth
- `SPEC.md` — full spec: architecture, data model, pipeline contract, audio engine, UI design system, risks. Read the sections relevant to the current issue before coding.
- **GitHub Issues + Projects board** — the work backlog. The "Singray Round 4" board (`gh project view 1 --owner ngtongsheng`) is the source of order: `Status` (Todo/In Progress/Done) and `Priority` (P0 critical-path, P1 ready/independent, P2 blocked/later). Issues close on PR merge.
- `DECISIONS.md` — narrative decision log (the *why* behind resolutions). Read the relevant round before starting work.
- `docs/history/BACKLOG.md` — **archived** (Rounds 1–3). History only; do not add new work there.

## Resume protocol (start of every session)
1. Check the board: `gh project item-list 1 --owner ngtongsheng` — pick lowest `Priority` (P0 first) among **`Todo` only**. Never auto-pick an `In Progress` item; resume one only when the user names it. One issue at a time.
2. Read the issue body + the matching `DECISIONS.md` section for context.
3. If a branch for the issue already exists, inspect the working tree (`git status`, recent commits) to see how far it got, then continue it.

## Issue discipline
- An issue is done only when its acceptance criteria are verified by actually running them — not by reading code.
- One issue → one branch (`feat/<n>-<slug>` / `fix/<n>-<slug>`) → PR → squash-merge. `Closes #<n>` in the PR body so merge closes the issue.
- Conventional Commit subjects (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`). release-please reads these for the changelog.
- A decision made mid-issue (trade-off, scope cut) → record it in `DECISIONS.md` in the same PR.
- Scope creep → a new issue, not into the current one.
- Spec change discovered while building → update `SPEC.md` in the same PR.

## Conventions
- No unit tests (personal app, verified by running). Instead: `npm run check` (Biome + `tsc --noEmit`) must be green before every story commit; pre-commit hook enforces it. Python: `ruff check` + `ruff format`.
- Renderer never touches `fs`/`child_process` — typed IPC only (SPEC §8).
- Semantic design tokens only, no raw hex in components (SPEC §10.2).
- Python deps pinned exact in `pipeline/setup.ps1`; npm deps caret.
- Commit messages: Conventional Commits (`type: <what>`), body only when a decision needs explaining.

## Environment notes
- Windows 11, PowerShell. Python via `pipeline/.venv` (3.13/3.11 base), GPU = RTX 5060 Ti (Blackwell, cu128).
- ffmpeg expected on PATH.
- Reference pipeline implementation: `C:\Users\PC\Documents\Skills\skills\audio-stems\scripts\audio_stems.py` (WSL-flavored — port, don't copy paths/Ollama parts).
