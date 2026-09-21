@echo off
netstat -ano | findstr ":8787" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo [osv5m] OSV-5M service already listening on :8787
  exit /b 0
)
echo [osv5m] starting OSV-5M service on :8787 ...
start "OSV5M Service" /min cmd /c "%~dp0..\osv5m\start-osv5m.bat"
exit /b 0