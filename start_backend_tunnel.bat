@echo off
chcp 65001 > nul
cd /d "%~dp0"
taskkill /f /im ngrok.exe >nul 2>&1
echo ====================================================================
echo   Phishing Detector: AI Backend + Permanent Ngrok Tunnel
echo ====================================================================
echo.

set "PYTHON_EXE=%~dp0python_backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

echo [1/2] Launching Python ML Backend on GPU CUDA...
echo Using Python: %PYTHON_EXE%
start "Python-ML-Backend" cmd /k "cd /d ""%~dp0python_backend"" && ""%PYTHON_EXE%"" main.py"

echo Waiting 4 seconds for model initialization...
timeout /t 4 /nobreak > nul

echo [2/2] Launching Permanent Ngrok Tunnel (https://anatomy-portly-yard.ngrok-free.dev)...
start "Ngrok-Tunnel" cmd /k "cd /d ""%~dp0"" && ngrok.exe http 8000 --url https://anatomy-portly-yard.ngrok-free.dev"

echo.
echo ====================================================================
echo   Live Permanent Endpoint:
echo   https://anatomy-portly-yard.ngrok-free.dev
echo   (This URL NEVER changes across restarts)
echo ====================================================================
