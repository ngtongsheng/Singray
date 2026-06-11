# Creates pipeline/.venv with pinned deps (SPEC §2.1). Run once; -Update bumps yt-dlp only.
param([switch]$Update)

$ErrorActionPreference = 'Stop'
$venv = Join-Path $PSScriptRoot '.venv'
$py = Join-Path $venv 'Scripts\python.exe'

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    throw 'ffmpeg not found on PATH — install it first (winget install ffmpeg)'
}

if ($Update) {
    if (-not (Test-Path $py)) { throw 'venv missing — run setup.ps1 without -Update first' }
    & $py -m pip install --upgrade yt-dlp
    exit $LASTEXITCODE
}

# Base interpreter: 3.13 preferred, 3.11 fallback (torch cu128 wheels exist for both)
$base = $null
foreach ($v in '3.13', '3.11') {
    & py "-$v" -c 'pass' 2>$null
    if ($LASTEXITCODE -eq 0) { $base = $v; break }
}
if (-not $base) { throw 'Python 3.13 or 3.11 required (via py launcher)' }

Write-Host "Creating venv with Python $base..."
& py "-$base" -m venv $venv
& $py -m pip install --upgrade pip

# torch first from the cu128 index so audio-separator finds it already satisfied.
# 2.8.0 because whisperx 3.8.6 pins torch~=2.8.0 (a newer torch would be
# replaced by a PyPI CPU build during whisperx install). cu128 has 2.8.0
# wheels and Blackwell (sm_120) support since 2.7.
# torchvision/torchaudio pinned alongside: onnx2torch and whisperx pull them,
# and an unpinned resolve would force a torch swap from PyPI.
# +cu128 tag is load-bearing: a bare ==2.8.0 is "satisfied" by a CPU build.
& $py -m pip install torch==2.8.0+cu128 torchvision==0.23.0+cu128 torchaudio==2.8.0+cu128 --index-url https://download.pytorch.org/whl/cu128
if ($LASTEXITCODE -ne 0) { throw "torch install failed (exit $LASTEXITCODE)" }
& $py -m pip install 'audio-separator[gpu]==0.44.2' yt-dlp==2026.6.9 ruff==0.15.16 whisperx==3.8.6
if ($LASTEXITCODE -ne 0) { throw "deps install failed (exit $LASTEXITCODE)" }

& $py -c "import torch; assert torch.cuda.is_available(), 'CUDA not available'; print('torch', torch.__version__, '| CUDA OK:', torch.cuda.get_device_name(0))"
if ($LASTEXITCODE -ne 0) { throw 'CUDA check failed' }
Write-Host 'setup complete'
