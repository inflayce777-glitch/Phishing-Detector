@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ====================================================================
echo   Phishing Detector: AI Backend + Cloudflare Tunnel
echo ====================================================================
echo.

echo [1/2] Launching Python ML Backend on GPU CUDA...
start "Python-ML-Backend" cmd /k "cd /d ""%~dp0python_backend"" && ""%~dp0.venv\Scripts\python.exe"" main.py"

echo Waiting 3 seconds for model initialization...
timeout /t 3 /nobreak > nul

echo [2/2] Launching Cloudflare HTTPS Tunnel...
start "Cloudflare-Tunnel" cmd /k "cd /d ""%~dp0"" && cloudflared.exe tunnel --url http://127.0.0.1:8000"

echo.
echo ====================================================================
echo   Services are running! Copy your https://...trycloudflare.com URL
echo ====================================================================
