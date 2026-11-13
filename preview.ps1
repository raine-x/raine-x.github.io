$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

try {
  $Host.UI.RawUI.WindowTitle = 'Canvas Site Studio (127.0.0.1:4321)'
}
catch {}

Write-Host 'Starting custom site engine & Studio...' -ForegroundColor Cyan
Write-Host 'Preview : http://127.0.0.1:4321/' -ForegroundColor Green
Write-Host 'Studio  : http://127.0.0.1:4321/studio' -ForegroundColor Green
Write-Host 'Close this PowerShell window (or press Ctrl+C) to stop.' -ForegroundColor Yellow
Write-Host ''

try {
  & node engine/dev-server.mjs --open
}
catch {
  Write-Host ''
  Write-Host "Failed to start: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host "Server exited with code $LASTEXITCODE." -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit $LASTEXITCODE
}
