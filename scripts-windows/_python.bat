@echo off
rem trouve Python et lance le lanceur avec les arguments recus
where py >nul 2>nul && goto avec_py
where python >nul 2>nul && goto avec_python
echo Python est introuvable.
echo Installez Python 3.12 depuis python.org en cochant "Add python.exe to PATH", puis relancez.
exit /b 1
:avec_py
py -3 "%~dp0lanceur.py" %*
exit /b %errorlevel%
:avec_python
python "%~dp0lanceur.py" %*
exit /b %errorlevel%
