# Singray

Personal desktop karaoke app — YouTube import, UVR stem separation, tap-along lyric timing, dual-mix output (stream + monitor).

See `SPEC.md` for the full spec and `BACKLOG.md` for development state.

## Develop

```powershell
npm install
npm run dev      # launch app with HMR
npm run check    # Biome + tsc (pre-commit hook runs this)
npm run build:win
```

Python pipeline setup: `pipeline/setup.ps1` (see SPEC §5).
