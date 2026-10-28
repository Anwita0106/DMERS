@echo off
REM Loads the DMERS tables + demo data into an EMPTY online database (Neon etc.)
cd /d "%~dp0.."
echo Paste your Neon connection string (the one WITHOUT "-pooler"), then press Enter:
set /p URL=
python tools\load_cloud_db.py "%URL%"
pause
