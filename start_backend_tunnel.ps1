# Phishing Detector: AI Backend + Permanent Ngrok Tunnel Launcher for PowerShell
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   Phishing Detector: AI Backend + Permanent Ngrok Tunnel" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonPath = Join-Path $rootDir ".venv\Scripts\python.exe"
$backendDir = Join-Path $rootDir "python_backend"
$ngrokPath = Join-Path $rootDir "ngrok.exe"

Write-Host "[1/2] Launching Python ML Backend on GPU CUDA..." -ForegroundColor Green
Start-Process wt.exe -ArgumentList "new-tab", "--title", "Python ML Backend", "-d", "$backendDir", "$pythonPath", "main.py" -ErrorAction SilentlyContinue `
    -ErrorVariable wtError

if ($wtError) {
    Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$backendDir`" && `"$pythonPath`" main.py"
}

Start-Sleep -Seconds 3

Write-Host "[2/2] Launching Permanent Ngrok Tunnel (https://anatomy-portly-yard.ngrok-free.dev)..." -ForegroundColor Green
Start-Process wt.exe -ArgumentList "new-tab", "--title", "Ngrok Tunnel", "-d", "$rootDir", "$ngrokPath", "http", "8000", "--url", "https://anatomy-portly-yard.ngrok-free.dev" -ErrorAction SilentlyContinue `
    -ErrorVariable wtError2

if ($wtError2) {
    Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$rootDir`" && `"$ngrokPath`" http 8000 --url https://anatomy-portly-yard.ngrok-free.dev"
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Live Permanent Endpoint:" -ForegroundColor Yellow
Write-Host "  https://anatomy-portly-yard.ngrok-free.dev" -ForegroundColor Green
Write-Host "  (This URL is permanent and NEVER changes across restarts)" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
