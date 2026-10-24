@echo off
setlocal enabledelayedexpansion
title Mochi-Puff Virtual Pet
echo ======================================================================
echo   Mochi-Puff AI Virtual Pet - Desktop App Launcher
echo ======================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js is not found in your system PATH.
  echo Please install Node.js v18+ or v20 LTS from https://nodejs.org
  echo.
  pause
  exit /b 1
)

cd /d "%~dp0"

if not exist node_modules (
  echo [1/3] First-time setup: Installing dependencies...
  call npm install
  echo.
)

if not exist dist (
  echo [2/3] Building application web assets...
  call npm run build
  echo.
)

echo [3/3] Starting Mochi-Puff Desktop Server on port 3000...
start "" /min "Mochi-Puff Server" cmd /c "node server.js"

timeout /t 2 /nobreak >nul

:: Try opening with Chrome, Edge, or default browser in standalone app mode (borderless, no URL bar)
set BROWSER_FOUND=0

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --window-size=1150,820
  set BROWSER_FOUND=1
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --window-size=1150,820
  set BROWSER_FOUND=1
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000 --window-size=1150,820
  set BROWSER_FOUND=1
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000 --window-size=1150,820
  set BROWSER_FOUND=1
)

if %BROWSER_FOUND% equ 0 (
  start http://localhost:3000
)

echo.
echo Mochi-Puff is now running as a standalone desktop application.
echo To close the application, close the window and the server task.
echo.
