@echo off
REM DMERS - one-time setup on Windows (needs Python 3.11+ and Node.js 18+ installed)
cd /d "%~dp0.."
echo.
echo === Checking Python and Node ===
python --version || (echo Python not found. Install from python.org and tick "Add python.exe to PATH". & pause & exit /b 1)
node --version || (echo Node.js not found. Install the LTS version from nodejs.org. & pause & exit /b 1)

if not exist backend\.env (
  copy windows\dmers_settings.env backend\.env >nul
  echo Created backend\.env - opening it now. Put your PostgreSQL password and port, save, close.
  notepad backend\.env
)

echo.
echo === Installing backend packages ===
python -m pip install -r backend\requirements.txt || (pause & exit /b 1)

echo.
echo === Installing website packages (takes a few minutes the first time) ===
cd frontend
call npm install || (pause & exit /b 1)
cd ..

echo.
echo === Downloading disaster photos (public domain) into frontend\public\images ===
python tools\download_photos.py

echo.
echo === Checking the database connection ===
cd backend
python -m app.migrate
cd ..
echo.
echo Setup finished. If you see "OK  DMERS schema present" above, run 2_START.bat
pause
