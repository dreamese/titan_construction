@echo off
cd /d "%~dp0"
set PORT=8040
where py >nul 2>nul
if %errorlevel%==0 (
  set PYTHON=py
) else (
  set PYTHON=python
)
start "Dreamese Local Server" cmd /k "%PYTHON% -m http.server %PORT%"
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/index.html"
