@echo off
chcp 65001 >nul
cd /d "%~dp0.."
call "%~dp0_python.bat" installer
echo.
pause
