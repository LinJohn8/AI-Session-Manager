@echo off
setlocal
cd /d "%~dp0\.."

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Install Node.js 18+ first.
  exit /b 1
)

npm ci
if errorlevel 1 exit /b %errorlevel%

npm run build:win
if errorlevel 1 exit /b %errorlevel%

echo.
echo Built dist\AI-Session-Manager.exe
