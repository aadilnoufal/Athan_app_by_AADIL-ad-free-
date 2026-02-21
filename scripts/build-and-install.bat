@echo off
setlocal
set ROOT=%~dp0..
cd /d "%ROOT%"
powershell -ExecutionPolicy Bypass -File "%ROOT%\scripts\build-and-install.ps1"
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo Build/install failed with exit code %ERR%
  exit /b %ERR%
)
echo Build and install completed successfully.
exit /b 0
