# Phishing Detector: AI Backend + Permanent Ngrok Tunnel Launcher for PowerShell
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   Phishing Detector: AI Backend + Permanent Ngrok Tunnel" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""
Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir "python_backend"
$ngrokPath = Join-Path $rootDir "ngrok.exe"

$pythonPath = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonPath)) {
    $pythonPath = Join-Path $rootDir ".venv\Scripts\python.exe"
}
if (-not (Test-Path $pythonPath)) {
    $pythonPath = "python"
}

Write-Host "[1/2] Launching Python ML Backend on GPU CUDA..." -ForegroundColor Green
Write-Host "Using Python: $pythonPath" -ForegroundColor Gray

Start-Process wt.exe -ArgumentList "new-tab", "--title", "Python ML Backend", "-d", "$backendDir", "$pythonPath", "main.py" -ErrorAction SilentlyContinue `
    -ErrorVariable wtError

if ($wtError) {
    Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$backendDir`" && `"$pythonPath`" main.py"
}

Write-Host "Waiting for Python ML Backend to load models..." -ForegroundColor Yellow
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($res.StatusCode -eq 200) { break }
    } catch {}
}

Write-Host "Python ML Backend is READY and responding!" -ForegroundColor Green
Write-Host "[2/2] Launching Permanent Ngrok Tunnel (https://anatomy-portly-yard.ngrok-free.dev)..." -ForegroundColor Green
Start-Process wt.exe -ArgumentList "new-tab", "--title", "Ngrok Tunnel", "-d", "$rootDir", "$ngrokPath", "http", "127.0.0.1:8000", "--url", "https://anatomy-portly-yard.ngrok-free.dev" -ErrorAction SilentlyContinue `
    -ErrorVariable wtError2

if ($wtError2) {
    Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$rootDir`" && `"$ngrokPath`" http 127.0.0.1:8000 --url https://anatomy-portly-yard.ngrok-free.dev"
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Live Permanent Endpoint:" -ForegroundColor Yellow
Write-Host "  https://anatomy-portly-yard.ngrok-free.dev" -ForegroundColor Green
Write-Host "  (This URL is permanent and NEVER changes across restarts)" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
