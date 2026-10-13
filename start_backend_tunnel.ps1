# Phishing Detector: AI Backend + Cloudflare Tunnel Launcher for PowerShell
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   Phishing Detector: AI Backend + Cloudflare Tunnel" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonPath = Join-Path $rootDir ".venv\Scripts\python.exe"
$backendDir = Join-Path $rootDir "python_backend"
$cloudflaredPath = Join-Path $rootDir "cloudflared.exe"

Write-Host "[1/2] Launching Python ML Backend on GPU CUDA..." -ForegroundColor Green
Start-Process wt.exe -ArgumentList "new-tab", "--title", "Python ML Backend", "-d", "$backendDir", "$pythonPath", "main.py" -ErrorAction SilentlyContinue `
    -ErrorVariable wtError

if ($wtError) {
    Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$backendDir`" && `"$pythonPath`" main.py"
}

Start-Sleep -Seconds 3

Write-Host "[2/2] Launching Cloudflare HTTPS Tunnel..." -ForegroundColor Green
Start-Process wt.exe -ArgumentList "new-tab", "--title", "Cloudflare Tunnel", "-d", "$rootDir", "$cloudflaredPath", "tunnel", "--url", "http://127.0.0.1:8000" -ErrorAction SilentlyContinue `
    -ErrorVariable wtError2

if ($wtError2) {
    Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$rootDir`" && `"$cloudflaredPath`" tunnel --url http://127.0.0.1:8000"
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Services launched in separate windows!" -ForegroundColor Yellow
Write-Host "  Check the Cloudflare window to copy your https://...trycloudflare.com URL" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
