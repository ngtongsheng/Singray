# Singray — Project Instructions

Personal desktop karaoke app. Electron + React + TS + Tailwind v4, Python pipeline for YouTube download + UVR stem separation. Windows first.

## Source of truth
- `SPEC.md` — full spec: architecture, data model, pipeline contract, audio engine, UI design system, risks. Read the sections relevant to the current story before coding.
- `BACKLOG.md` — story checklist + **Now** pointer + session log. This is the development state.

## Resume protocol (start of every session)
1. Read `BACKLOG.md`: the **Now** pointer and the top of the Session Log tell you where work stopped.
2. If the current story is `[~]`, inspect the working tree (`git status`, recent commits) to see how far it got, then continue it.
3. Otherwise start the story the **Now** pointer names. One story at a time, in order.

## Story discipline
- A story is done only when every "Done when" line has been verified by actually running it — not by reading code.
- On completion: mark `[x]`, move the **Now** pointer to the next story, append one Session Log line (date · story · outcome/decisions/gotchas), commit with the story id in the subject (e.g. `S1.2: pipeline process command`).
- Mid-story stop: mark `[~]`, log a Session Log line stating exactly what remains.
- Scope creep goes to Phase 6 backlog, not into the current story.
- Spec change discovered while building → update `SPEC.md` in the same commit and note it in the Session Log.

## Conventions
- No unit tests (personal app, verified by running). Instead: `npm run check` (Biome + `tsc --noEmit`) must be green before every story commit; pre-commit hook enforces it. Python: `ruff check` + `ruff format`.
- Renderer never touches `fs`/`child_process` — typed IPC only (SPEC §8).
- Semantic design tokens only, no raw hex in components (SPEC §10.2).
- Python deps pinned exact in `pipeline/setup.ps1`; npm deps caret.
- Commit messages: `S<story>: <what>`, body only when a decision needs explaining.

## Environment notes
- Windows 11, PowerShell. Python via `pipeline/.venv` (3.13/3.11 base), GPU = RTX 5060 Ti (Blackwell, cu128).
- ffmpeg expected on PATH.
- Reference pipeline implementation: `C:\Users\PC\Documents\Skills\skills\audio-stems\scripts\audio_stems.py` (WSL-flavored — port, don't copy paths/Ollama parts).
