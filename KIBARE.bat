@echo off
chcp 65001 >nul
title Kibare
cd /d "%~dp0"
call "%~dp0scripts-windows\_python.bat" menu
