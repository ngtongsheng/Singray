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
# 2.11.0 is the newest version with cu128 wheels (2.12.0 exists only on PyPI as CPU).
# torchvision pinned alongside: onnx2torch pulls it, and an unpinned resolve would
# grab a version that forces a torch upgrade from PyPI.
& $py -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128
if ($LASTEXITCODE -ne 0) { throw "torch install failed (exit $LASTEXITCODE)" }
& $py -m pip install 'audio-separator[gpu]==0.44.2' yt-dlp==2026.6.9 ruff==0.15.16
if ($LASTEXITCODE -ne 0) { throw "deps install failed (exit $LASTEXITCODE)" }

& $py -c "import torch; assert torch.cuda.is_available(), 'CUDA not available'; print('torch', torch.__version__, '| CUDA OK:', torch.cuda.get_device_name(0))"
if ($LASTEXITCODE -ne 0) { throw 'CUDA check failed' }
Write-Host 'setup complete'
