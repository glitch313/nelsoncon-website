param(
  [string]$MemoriesRoot = (Join-Path $PSScriptRoot "assets/memories"),
  [string]$OutputFile = (Join-Path $PSScriptRoot "assets/memories/photo-manifest.json")
)

$regularYears = 2018..2026
$winterYears = 2023..2026
$supportedExts = @(".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm")
$slotPattern = '^photo[1-3]\.(jpg|jpeg|png|webp|mp4|webm)$'

function Get-YearPhotoPaths {
  param([string]$FolderPath)

  if (-not (Test-Path $FolderPath -PathType Container)) {
    return @()
  }

  $allSupported = Get-ChildItem -Path $FolderPath -File | Where-Object {
    $_.Extension.ToLowerInvariant() -in $supportedExts
  }

  if ($allSupported.Count -eq 0) {
    return @()
  }

  $nonSlot = $allSupported | Where-Object { $_.Name -notmatch $slotPattern }
  $chosen = if ($nonSlot.Count -gt 0) { $nonSlot } else { $allSupported }

  return $chosen |
    Sort-Object LastWriteTime -Descending |
    ForEach-Object {
      "./" + ($_.FullName.Substring($PSScriptRoot.Length + 1) -replace '\\', '/')
    }
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  regular = [ordered]@{}
  winter = [ordered]@{}
}

foreach ($year in $regularYears) {
  $folder = Join-Path $MemoriesRoot "$year"
  $manifest.regular["$year"] = @(Get-YearPhotoPaths -FolderPath $folder)
}

foreach ($year in $winterYears) {
  $folder = Join-Path $MemoriesRoot "winter/$year"
  $manifest.winter["$year"] = @(Get-YearPhotoPaths -FolderPath $folder)
}

$manifestJson = $manifest | ConvertTo-Json -Depth 8
Set-Content -Path $OutputFile -Value $manifestJson -Encoding utf8

