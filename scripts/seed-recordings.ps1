#!/usr/bin/env pwsh
# Seed sample recordings for dev/testing. Generates short WAV tones with ffmpeg
# into <libraryDir>/<songId>/recordings/ for the first N songs found.
# Usage: .\scripts\seed-recordings.ps1 [-Songs 3] [-PerSong 2]

param(
  [int]$Songs   = 3,
  [int]$PerSong = 2
)

$settingsFile = "$env:APPDATA\singray\settings.json"
if (-not (Test-Path $settingsFile)) {
  Write-Error "settings.json not found at $settingsFile — run the app at least once first"
  exit 1
}
$settings = Get-Content $settingsFile | ConvertFrom-Json
$libraryDir = $settings.libraryDir

if (-not (Test-Path $libraryDir)) {
  Write-Error "Library dir '$libraryDir' does not exist"
  exit 1
}

$songDirs = Get-ChildItem $libraryDir -Directory | Select-Object -First $Songs

if ($songDirs.Count -eq 0) {
  Write-Error "No song folders found in $libraryDir"
  exit 1
}

# Alternating durations and frequencies so recordings are distinguishable
$durations  = @(5, 8, 12, 4, 6)
$freqs      = @(440, 523, 659, 392, 784)

$total = 0
foreach ($dir in $songDirs) {
  $recDir = Join-Path $dir.FullName "recordings"
  New-Item -ItemType Directory -Force $recDir | Out-Null

  for ($i = 0; $i -lt $PerSong; $i++) {
    # ISO timestamp with colons/dots replaced — matches saveRecording() naming
    $ts  = (Get-Date).AddMinutes(-($total * 7)).ToString("yyyy-MM-ddTHH-mm-ss-fff") + "Z"
    $out = Join-Path $recDir "$ts.wav"

    $dur  = $durations[$total % $durations.Length]
    $freq = $freqs[$total % $freqs.Length]

    & ffmpeg -y -f lavfi -i "sine=frequency=${freq}:duration=$dur" -ar 44100 -ac 1 "$out" 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  created $out ($dur s @ ${freq}Hz)"
    } else {
      Write-Warning "  ffmpeg failed for $out"
    }
    $total++
  }
  Write-Host "[$($dir.Name)] $PerSong recording(s) seeded"
}

Write-Host "`nDone. $total file(s) created."
