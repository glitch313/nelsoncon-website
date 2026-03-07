param(
  [string]$MemoriesRoot = (Join-Path $PSScriptRoot "assets/memories"),
  [int]$MaxWidth = 1280,
  [int]$TargetSizeMB = 50,
  [string]$Preset = "veryfast",
  [int]$AudioBitrateKbps = 128,
  [int]$MinVideoBitrateKbps = 400
)

$videoExts = @(".mp4", ".webm", ".mov", ".m4v", ".avi")
$targetSizeBytes = [int64]$TargetSizeMB * 1MB

function Get-CommandPath {
  param([string]$Name)

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    return $null
  }

  return $cmd.Source
}

function Remove-PassLogs {
  param([string]$PassLogBase)

  Get-ChildItem -Path ([System.IO.Path]::GetDirectoryName($PassLogBase)) -Filter (([System.IO.Path]::GetFileName($PassLogBase)) + "*") -File -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue }
}

function Get-VideoDurationSeconds {
  param(
    [string]$FfprobePath,
    [string]$SourcePath
  )

  $probeArgs = @(
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    $SourcePath
  )

  $durationText = & $FfprobePath @probeArgs 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $durationText) {
    return $null
  }

  $duration = 0.0
  $ok = [double]::TryParse(($durationText | Select-Object -First 1).Trim(), [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$duration)
  if (-not $ok -or $duration -le 0.1) {
    return $null
  }

  return $duration
}

$ffmpegPath = Get-CommandPath -Name "ffmpeg"
if (-not $ffmpegPath) {
  Write-Warning "ffmpeg was not found. Skipping video compression and running manifest sync only."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-memory-photos.ps1")
  exit $LASTEXITCODE
}

$ffprobePath = Get-CommandPath -Name "ffprobe"
if (-not $ffprobePath) {
  $ffmpegDir = [System.IO.Path]::GetDirectoryName($ffmpegPath)
  $candidate = Join-Path $ffmpegDir "ffprobe.exe"
  if (Test-Path $candidate -PathType Leaf) {
    $ffprobePath = $candidate
  }
}

if (-not $ffprobePath) {
  Write-Warning "ffprobe was not found. Install full FFmpeg package. Running manifest sync only."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-memory-photos.ps1")
  exit $LASTEXITCODE
}

if (-not (Test-Path $MemoriesRoot -PathType Container)) {
  throw "Memories root not found: $MemoriesRoot"
}

$allVideos = Get-ChildItem -Path $MemoriesRoot -Recurse -File | Where-Object {
  $_.Extension.ToLowerInvariant() -in $videoExts
}

if ($allVideos.Count -eq 0) {
  Write-Host "No videos found under $MemoriesRoot"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-memory-photos.ps1")
  exit $LASTEXITCODE
}

$convertedCount = 0
$skippedCount = 0
$failedCount = 0

foreach ($video in $allVideos) {
  $sourcePath = $video.FullName
  $sourceDir = $video.DirectoryName
  $sourceExt = $video.Extension.ToLowerInvariant()
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($video.Name)
  $sourceInfo = Get-Item $sourcePath

  if ($sourceExt -eq ".mp4" -and $sourceInfo.Length -le $targetSizeBytes) {
    $skippedCount++
    Write-Host "Skipped (already <= ${TargetSizeMB}MB): $($video.Name)"
    continue
  }

  $durationSec = Get-VideoDurationSeconds -FfprobePath $ffprobePath -SourcePath $sourcePath
  if (-not $durationSec) {
    $failedCount++
    Write-Warning "Could not read duration for: $sourcePath"
    continue
  }

  $totalBitrateBps = [math]::Floor((($targetSizeBytes * 8.0) / $durationSec) * 0.97)
  $audioBitrateBps = $AudioBitrateKbps * 1000
  $videoBitrateBps = [math]::Max($MinVideoBitrateKbps * 1000, $totalBitrateBps - $audioBitrateBps)
  $videoBitrateKbps = [math]::Floor($videoBitrateBps / 1000)

  $destPath = Join-Path $sourceDir ($baseName + ".compressed.mp4")
  if (Test-Path $destPath -PathType Leaf) {
    Remove-Item -Force $destPath
  }

  $passLogBase = Join-Path $env:TEMP ("nelsoncon-" + [guid]::NewGuid().ToString("N"))

  $pass1Args = @(
    "-y",
    "-i", $sourcePath,
    "-vf", "scale='min($MaxWidth,iw)':-2",
    "-c:v", "libx264",
    "-preset", $Preset,
    "-b:v", "${videoBitrateKbps}k",
    "-maxrate", "${videoBitrateKbps}k",
    "-bufsize", "$([math]::Max(2, $videoBitrateKbps * 2))k",
    "-pass", "1",
    "-passlogfile", $passLogBase,
    "-an",
    "-f", "mp4",
    "NUL"
  )

  & $ffmpegPath @pass1Args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $failedCount++
    Write-Warning "Pass 1 failed: $sourcePath"
    Remove-PassLogs -PassLogBase $passLogBase
    continue
  }

  $pass2Args = @(
    "-y",
    "-i", $sourcePath,
    "-vf", "scale='min($MaxWidth,iw)':-2",
    "-c:v", "libx264",
    "-preset", $Preset,
    "-b:v", "${videoBitrateKbps}k",
    "-maxrate", "${videoBitrateKbps}k",
    "-bufsize", "$([math]::Max(2, $videoBitrateKbps * 2))k",
    "-pass", "2",
    "-passlogfile", $passLogBase,
    "-c:a", "aac",
    "-b:a", "${AudioBitrateKbps}k",
    "-movflags", "+faststart",
    $destPath
  )

  & $ffmpegPath @pass2Args | Out-Null
  Remove-PassLogs -PassLogBase $passLogBase

  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $destPath -PathType Leaf)) {
    $failedCount++
    Write-Warning "Pass 2 failed: $sourcePath"
    if (Test-Path $destPath -PathType Leaf) {
      Remove-Item -Force $destPath
    }
    continue
  }

  $destInfo = Get-Item $destPath
  $finalPath = Join-Path $sourceDir ($baseName + ".mp4")

  if ((Test-Path $finalPath -PathType Leaf) -and ($finalPath -ne $sourcePath)) {
    Remove-Item -Force $finalPath
  }

  if ($sourcePath -ne $finalPath -and (Test-Path $sourcePath -PathType Leaf)) {
    Remove-Item -Force $sourcePath
  }

  Move-Item -Force $destPath $finalPath
  $convertedCount++

  $finalSizeMB = [math]::Round(((Get-Item $finalPath).Length / 1MB), 1)
  Write-Host "Compressed: $($video.Name) -> $([System.IO.Path]::GetFileName($finalPath)) (~${finalSizeMB}MB target ${TargetSizeMB}MB)"
}

Write-Host "Video prep complete. Converted: $convertedCount, Skipped: $skippedCount, Failed: $failedCount"

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-memory-photos.ps1")
exit $LASTEXITCODE
