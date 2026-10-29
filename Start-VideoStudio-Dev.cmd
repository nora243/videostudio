@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo Hay chay npm install truoc khi mo Video Studio.
  pause
  exit /b 1
)
call npm run dev
