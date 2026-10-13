@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ====================================================================
echo   Phishing Detector: AI Backend + Permanent Ngrok Tunnel
echo ====================================================================
echo.

echo [1/2] Launching Python ML Backend on GPU CUDA...
start "Python-ML-Backend" cmd /k "cd /d ""%~dp0python_backend"" && ""%~dp0.venv\Scripts\python.exe"" main.py"

echo Waiting 3 seconds for model initialization...
timeout /t 3 /nobreak > nul

echo [2/2] Launching Permanent Ngrok Tunnel (https://anatomy-portly-yard.ngrok-free.dev)...
start "Ngrok-Tunnel" cmd /k "cd /d ""%~dp0"" && ngrok.exe http 8000 --url https://anatomy-portly-yard.ngrok-free.dev"

echo.
echo ====================================================================
echo   Live Permanent Endpoint:
echo   https://anatomy-portly-yard.ngrok-free.dev
echo   (This URL NEVER changes across restarts)
echo ====================================================================
