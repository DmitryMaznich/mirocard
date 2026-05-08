@echo off
cd /d C:\Users\dmazn\Projects\Mirocard2

echo [1/2] Building Mirocard2...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo [2/2] Starting local server on port 8080...
start "Mirocard2 :8080" cmd /k npm run serve:prod
if errorlevel 1 (
  echo Start failed.
  pause
  exit /b 1
)

echo.
echo Done.
pause
