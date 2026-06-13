#!/usr/bin/env bash
# Creates pipeline/.venv with pinned deps (SPEC §2.1) on macOS/Linux.
# Run once; `setup.sh --update` bumps yt-dlp only. Windows uses setup.ps1.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$DIR/.venv"
PY="$VENV/bin/python"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found on PATH — install it first (brew install ffmpeg / apt install ffmpeg)" >&2
  exit 1
fi

if [[ "${1:-}" == "--update" ]]; then
  [[ -x "$PY" ]] || { echo "venv missing — run setup.sh without --update first" >&2; exit 1; }
  "$PY" -m pip install --upgrade yt-dlp
  exit $?
fi

# Base interpreter: prefer 3.13, fall back to 3.11 (torch wheels exist for both).
BASE=""
for v in 3.13 3.11; do
  if command -v "python$v" >/dev/null 2>&1; then BASE="python$v"; break; fi
done
[[ -n "$BASE" ]] || { echo "Python 3.13 or 3.11 required" >&2; exit 1; }

echo "Creating venv with $BASE..."
"$BASE" -m venv "$VENV"
"$PY" -m pip install --upgrade pip

OS="$(uname -s)"
if [[ "$OS" == "Darwin" ]]; then
  # macOS: PyPI default wheels carry MPS (Apple Silicon) + CPU support; no CUDA.
  echo "macOS detected — installing CPU/MPS torch from PyPI."
  "$PY" -m pip install torch==2.8.0 torchvision==0.23.0 torchaudio==2.8.0
  SEP_EXTRA="cpu"
else
  # Linux: CUDA if an NVIDIA GPU is visible, else CPU index.
  if command -v nvidia-smi >/dev/null 2>&1; then
    echo "NVIDIA GPU detected — installing CUDA 12.8 torch."
    "$PY" -m pip install torch==2.8.0+cu128 torchvision==0.23.0+cu128 torchaudio==2.8.0+cu128 \
      --index-url https://download.pytorch.org/whl/cu128
    SEP_EXTRA="gpu"
  else
    echo "No NVIDIA GPU — installing CPU torch."
    "$PY" -m pip install torch==2.8.0 torchvision==0.23.0 torchaudio==2.8.0 \
      --index-url https://download.pytorch.org/whl/cpu
    SEP_EXTRA="cpu"
  fi
fi

"$PY" -m pip install "audio-separator[$SEP_EXTRA]==0.44.2" yt-dlp==2026.6.9 ruff==0.15.16 whisperx==3.8.6

"$PY" -c "import torch; print('torch', torch.__version__, '| cuda:', torch.cuda.is_available(), '| mps:', getattr(torch.backends,'mps',None) and torch.backends.mps.is_available())"
echo "setup complete"
