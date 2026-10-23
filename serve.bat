@echo off
rem Double-click this to run PickleMatch so badge QR codes work on your phone.
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py serve.py
  goto end
)

where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py
  goto end
)

echo.
echo   Python was not found on this computer.
echo   Install it from https://www.python.org/downloads/
echo   (tick "Add python.exe to PATH" in the installer), then
echo   double-click this file again.
echo.
pause

:end
endlocal
