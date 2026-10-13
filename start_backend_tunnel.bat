@echo off
title Phishing Detector - AI Backend + Cloudflare Tunnel
echo ====================================================================
echo   Phishing Detector: Запуск Python ML Backend + Cloudflare Tunnel
echo ====================================================================
echo.

echo [1/2] Запуск нейромережевого бекенду (GPU CUDA / RTX 3060)...
start "Python ML Backend (Port 8000)" cmd /k "cd /d %~dp0python_backend && ..\.venv\Scripts\python.exe main.py"

echo Очікування ініціалізації моделі (3 сек)...
timeout /t 3 /nobreak > nul

echo [2/2] Запуск Cloudflare HTTPS тунелю...
start "Cloudflare Tunnel (Public HTTPS)" cmd /k "cd /d %~dp0 && cloudflared.exe tunnel --url http://127.0.0.1:8000"

echo.
echo ====================================================================
echo  Сервіси успішно запущені в окремих вікнах!
echo  У вікні Cloudflare скопіюйте посилання виду:
echo  https://xxxx-xxxx.trycloudflare.com
echo ====================================================================
pause
