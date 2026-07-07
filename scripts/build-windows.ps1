$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Install Node.js 18+ first."
}

npm ci
npm run build:win

Write-Host ""
Write-Host "Built dist\\AI-Session-Manager.exe"
Write-Host "Built dist\\AI-Session-Manager-server.exe"
