param(
  [string]$MemoriesRoot = (Join-Path $PSScriptRoot "assets/memories")
)

$regularYears = 2018..2026
$winterYears = 2023..2026
$supportedExts = @(".jpg", ".jpeg", ".png", ".webp")

function Get-SlotNames {
  $names = @()
  foreach ($slot in 1..3) {
    foreach ($ext in $supportedExts) {
      $names += "photo$slot$ext"
    }
  }
  return $names
}

function Sync-Folder {
  param([string]$FolderPath)

  if (-not (Test-Path $FolderPath -PathType Container)) {
    return
  }

  $slotNames = Get-SlotNames

  # Collect uploaded files (exclude current slot files) and sort newest first.
  $candidates = Get-ChildItem -Path $FolderPath -File | Where-Object {
    ($_.Extension.ToLowerInvariant() -in $supportedExts) -and ($_.Name -notin $slotNames)
  } | Sort-Object LastWriteTime -Descending

  if ($candidates.Count -eq 0) {
    return
  }

  # Clear any existing slot files so the newest uploads become the active slot files.
  foreach ($name in $slotNames) {
    $path = Join-Path $FolderPath $name
    if (Test-Path $path -PathType Leaf) {
      Remove-Item -Path $path -Force
    }
  }

  $slot = 1
  foreach ($file in $candidates) {
    if ($slot -gt 3) {
      break
    }

    $ext = $file.Extension.ToLowerInvariant()
    $destination = Join-Path $FolderPath ("photo{0}{1}" -f $slot, $ext)
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
