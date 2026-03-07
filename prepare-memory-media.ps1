param(
  [string]$MemoriesRoot = (Join-Path $PSScriptRoot "assets/memories"),
  [int]$MaxWidth = 1280,
  [int]$Crf = 28,
  [string]$Preset = "veryfast",
  [int]$AudioBitrateKbps = 96,
  [int]$MinSavingsBytes = 65536
)

$videoExts = @(".mp4", ".webm", ".mov", ".m4v", ".avi")

function Get-CommandPath {
  param([string]$Name)

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    return $null
  }

  return $cmd.Source
}

$ffmpegPath = Get-CommandPath -Name "ffmpeg"
if (-not $ffmpegPath) {
  Write-Warning "ffmpeg was not found. Skipping video compression and running manifest sync only."
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

  $destPath = Join-Path $sourceDir ($baseName + ".compressed.mp4")

  if (Test-Path $destPath -PathType Leaf) {
    Remove-Item -Force $destPath
  }

  $ffmpegArgs = @(
    "-y",
    "-i", $sourcePath,
    "-vf", "scale='min($MaxWidth,iw)':-2",
    "-c:v", "libx264",
    "-preset", $Preset,
    "-crf", "$Crf",
    "-c:a", "aac",
    "-b:a", "${AudioBitrateKbps}k",
    "-movflags", "+faststart",
    $destPath
  )

  & $ffmpegPath @ffmpegArgs | Out-Null

  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $destPath -PathType Leaf)) {
    $failedCount++
    Write-Warning "Failed to convert: $sourcePath"
    if (Test-Path $destPath -PathType Leaf) {
      Remove-Item -Force $destPath
    }
    continue
  }

  $destInfo = Get-Item $destPath
  $sourceInfo = Get-Item $sourcePath

  $shouldReplace = $sourceExt -ne ".mp4" -or ($destInfo.Length + $MinSavingsBytes -lt $sourceInfo.Length)

  if ($shouldReplace) {
    $finalPath = Join-Path $sourceDir ($baseName + ".mp4")

    if ((Test-Path $finalPath -PathType Leaf) -and ($finalPath -ne $sourcePath)) {
      Remove-Item -Force $finalPath
    }

    if ($sourcePath -ne $finalPath -and (Test-Path $sourcePath -PathType Leaf)) {
      Remove-Item -Force $sourcePath
    }

    Move-Item -Force $destPath $finalPath
    $convertedCount++
    Write-Host "Converted: $($video.Name) -> $([System.IO.Path]::GetFileName($finalPath))"
  } else {
    Remove-Item -Force $destPath
    $skippedCount++
    Write-Host "Skipped (already efficient): $($video.Name)"
  }
}

Write-Host "Video prep complete. Converted: $convertedCount, Skipped: $skippedCount, Failed: $failedCount"

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-memory-photos.ps1")
exit $LASTEXITCODE
