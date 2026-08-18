@echo off
cd /d C:\Users\dmazn\Projects\Mirocard2

echo Pulling latest main, verifying, building, then deploying...
npm run deploy:safe
if errorlevel 1 (
  echo Deploy aborted - see the failed step above.
  pause
  exit /b 1
)

echo.
echo Done. Production should be consistent on mirocard.kaplieva.help and 192.168.1.163:8080.
pause
