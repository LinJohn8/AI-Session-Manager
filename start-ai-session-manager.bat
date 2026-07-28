@echo off
setlocal
title AI Session Manager

cd /d "%~dp0"
if errorlevel 1 (
  echo Failed to open the project directory:
  echo %~dp0
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 18 or newer, then try again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

echo Starting AI Session Manager...
echo The browser will open automatically. Close this window to stop the service.
echo.

node server.js --open
set "APP_EXIT_CODE=%errorlevel%"

if not "%APP_EXIT_CODE%"=="0" (
  echo.
  echo AI Session Manager stopped with exit code %APP_EXIT_CODE%.
  pause
)

exit /b %APP_EXIT_CODE%
