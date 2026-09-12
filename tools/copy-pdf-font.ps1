Param(
    [string]$Dest = "$PSScriptRoot\..\fonts\Arial.ttf"
)
$src = Join-Path $env:WINDIR "Fonts\arial.ttf"
if (-not (Test-Path $src)) {
    Write-Error "Не знайдено $src"
    exit 1
}
New-Item -ItemType Directory -Force -Path (Split-Path $Dest) | Out-Null
Copy-Item $src $Dest -Force
Write-Host "Copied to $Dest"
