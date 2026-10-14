@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ====================================================================
echo   Phishing Detector: Повний локальний запуск (Frontend + Python AI)
echo ====================================================================
echo.

set "PYTHON_EXE=%~dp0python_backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

echo [1/3] Запуск Python ML Backend на GPU RTX 3060 CUDA (порт 8000)...
start "1. Python ML Backend [CUDA]" cmd /k "cd /d ""%~dp0python_backend"" && title 1. Python ML Backend [CUDA] && ""%PYTHON_EXE%"" main.py"

echo [2/3] Запуск веб-інтерфейсу Next.js (порт 3000)...
start "2. Next.js Frontend" cmd /k "cd /d ""%~dp0"" && title 2. Next.js Frontend [localhost:3000] && npm run dev"

echo.
echo [3/3] Очікування ініціалізації нейромереж у відеопам'яті GPU (10-15 сек)...
:wait_loop
timeout /t 2 /nobreak > nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo    ...завантаження моделей Sentence Transformer та XGBoost...
    goto wait_loop
)

echo.
echo ====================================================================
echo   [УСПІХ] Всі сервіси готові до роботи!
echo   - Веб-сайт:    http://localhost:3000
echo   - Python ML:   http://127.0.0.1:8000 (Статус: ONLINE CUDA)
echo ====================================================================
echo.
echo Відкриття браузера...
timeout /t 1 /nobreak > nul
start http://localhost:3000
