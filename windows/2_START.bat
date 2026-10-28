@echo off
REM DMERS - start the API (port 8765) and the website (port 5288), then open the browser
cd /d "%~dp0.."

netstat -ano | findstr /R /C:":8765 .*LISTENING" >nul && (
  echo Port 8765 is already in use. Close the old "DMERS API" window, or run windows\STOP_DMERS.bat, then try again.
  pause
  exit /b 1
)
netstat -ano | findstr /R /C:":5288 .*LISTENING" >nul && (
  echo Port 5288 is already in use - an old DMERS website window is probably still open.
  echo Close it, or run windows\STOP_DMERS.bat, then try again.
  pause
  exit /b 1
)

start "DMERS API (keep open)" cmd /k "cd /d "%~dp0..\backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8765"
echo Waiting for the API to start...
set /a tries=0
:wait_api
timeout /t 2 >nul
set /a tries+=1
curl -s http://127.0.0.1:8765/api/health | findstr /C:"dmers-api" >nul && goto api_ok
if %tries% LSS 15 goto wait_api
echo.
echo The DMERS API did not start. Look at the "DMERS API" window for the error,
echo or run windows\DIAGNOSE.bat
pause
exit /b 1

:api_ok
echo API is running on http://127.0.0.1:8765
start "DMERS Website (keep open)" cmd /k "cd /d "%~dp0..\frontend" && npm run dev"
timeout /t 6 >nul
start http://localhost:5288
echo.
echo DMERS is running at http://localhost:5288  -  to stop it, close the two black windows.
pause
