@echo off
REM Stops whatever is listening on the DMERS ports (8765 API, 5288 website). Other projects are not touched..
REM It shows each program before stopping it.
for %%P in (8765 5288) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    echo Port %%P is used by process %%I:
    tasklist /FI "PID eq %%I" /NH
    taskkill /PID %%I /F >nul && echo   stopped.
  )
)
echo Done.
pause
