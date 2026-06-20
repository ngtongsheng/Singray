# Contributing to Singray

Thanks for your interest. Singray is a personal-use app developed openly. This
guide covers the development workflow, the checks that must pass, and how to add
a translation.

## Development workflow

Work is tracked in **[GitHub Issues](../../issues)** — the issue list is the
backlog. Tackle one issue at a time:

1. **One issue → one branch** — `feat/<n>-<slug>` or `fix/<n>-<slug>`.
2. Read the issue body and the matching [`DECISIONS.md`](DECISIONS.md) section
   for the *why* before changing code.
3. An issue is *done* only when its acceptance criteria are verified by actually
   running the app or script — not by reading code.
4. **One PR → squash-merge.** Put `Closes #<n>` in the PR body so the merge
   closes the issue.

Commit subjects follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) — release-please reads these
for the changelog. Add a body only when a decision needs explaining.

The full design lives in [`SPEC.md`](SPEC.md). Read the sections relevant to an
issue before changing code; if you discover a spec change while building, update
`SPEC.md` in the same PR. A trade-off made mid-issue goes in `DECISIONS.md` in
the same PR. Scope creep goes to a **new issue**, not into the current one.

> `BACKLOG.md` is archived (Rounds 1–3) — history only, don't add work there.

## Checks (must be green before every commit)

A pre-commit hook (`simple-git-hooks`) runs `npm run check` automatically.

```powershell
npm run check      # Biome (lint + format) + tsc --noEmit, both web and node
npm run check:fix  # auto-fix what Biome can
npm run check:py   # ruff check + ruff format --check on pipeline/
```

Conventions:

- **No unit tests** — this is a personal app, verified by running it. Static
  tooling (Biome + strict TypeScript + ruff) carries the weight.
- The renderer never touches `fs` or `child_process` — typed IPC only
  (SPEC §8).
- Use **semantic design tokens** in components, never raw hex (SPEC §10.2).
- npm deps use caret ranges; Python deps are pinned exact in
  `pipeline/setup.ps1` (torch/CUDA churn is the fragile axis).

## Adding a translation

UI strings live in one JSON file per locale:

```
src/renderer/locales/
  en/translation.json
  zh/translation.json
```

To add a language, **one folder is one pull request**:

1. Copy `src/renderer/locales/en/` to a new folder named with the language code
   (e.g. `ja`, `ko`, `fr`).
2. Translate the values in `translation.json`. Keep the keys unchanged.
3. Set the `languageName` key to the language's own name (e.g. `日本語`) — this
   is what appears in the Settings language selector.

That's it. The loader picks up locale folders automatically
(`import.meta.glob`), so the new language shows up in Settings with **no code
change**. Run `npm run dev`, switch to your language in Settings, and check
every screen renders.

## Reporting bugs & requesting features

Use the issue templates. Include your OS, GPU, and reproduction steps for bugs.
Every pull request should close the issue it addresses (`Closes #<n>`).
