@echo off
cd /d C:\Users\dmazn\Projects\Mirocard2

echo Deploying latest Mirocard2 build through the unified production deploy...
npm run deploy:prod
if errorlevel 1 (
  echo Deploy failed.
  pause
  exit /b 1
)

echo.
echo Done. Production should be consistent on mirocard.kaplieva.help and 192.168.1.163:8080.
pause
