@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ====================================================================
echo   Phishing Detector: Очищення віддаленої бази даних Turso
echo ====================================================================
echo.

node scripts/clear_database.mjs

echo.
pause
