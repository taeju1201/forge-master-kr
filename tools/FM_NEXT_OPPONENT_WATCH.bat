@echo off
setlocal
cd /d "%~dp0"
echo ===============================================
echo Forge Master - Next Opponent Assignment Watch
echo ===============================================
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  py FM_NEXT_OPPONENT_WATCH.py
) else (
  python FM_NEXT_OPPONENT_WATCH.py
)
echo.
pause
