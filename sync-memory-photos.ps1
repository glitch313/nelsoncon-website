param(
  [string]$MemoriesRoot = (Join-Path $PSScriptRoot "assets/memories")
)

$regularYears = 2018..2026
$winterYears = 2023..2026
$slotNames = @("photo1.jpg", "photo2.jpg", "photo3.jpg")

function Sync-Folder {
  param([string]$FolderPath)

  if (-not (Test-Path $FolderPath -PathType Container)) {
    return
  }

  # Map the newest uploaded JPG/JPEG files into fixed photo slots used by the pages.
  $candidates = Get-ChildItem -Path $FolderPath -File | Where-Object {
    ($_.Extension -match '^\.(jpg|jpeg)$') -and ($_.Name -notin $slotNames)
  } | Sort-Object LastWriteTime -Descending

  $slot = 0
  foreach ($file in $candidates) {
    if ($slot -ge $slotNames.Count) {
      break
    }

    $destination = Join-Path $FolderPath $slotNames[$slot]
    Copy-Item -Path $file.FullName -Destination $destination -Force
    $slot += 1
  }
}

foreach ($year in $regularYears) {
  Sync-Folder -FolderPath (Join-Path $MemoriesRoot "$year")
}

foreach ($year in $winterYears) {
  Sync-Folder -FolderPath (Join-Path $MemoriesRoot "winter/$year")
}
