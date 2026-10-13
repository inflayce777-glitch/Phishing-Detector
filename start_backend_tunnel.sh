#!/usr/bin/env bash
# ====================================================================
# Phishing Detector: AI Backend + Permanent Ngrok Tunnel (Linux & macOS)
# Supports NVIDIA CUDA (Linux) and Apple Silicon MPS (macOS)
# ====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/python_backend"

echo "===================================================================="
echo "   Phishing Detector: AI Backend + Permanent Ngrok Tunnel"
echo "   OS: $(uname -s) ($(uname -m))"
echo "===================================================================="
echo ""

# 1. Kill any existing ngrok process to prevent ERR_NGROK_334
pkill -f ngrok || true

# 2. Check Python environment
if [ -d "$SCRIPT_DIR/.venv" ]; then
    PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
elif [ -d "$BACKEND_DIR/.venv" ]; then
    PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
else
    echo "Error: python3 not found! Please install Python 3.10+."
    exit 1
fi

echo "[1/2] Launching Python ML Backend..."
cd "$BACKEND_DIR"
"$PYTHON_BIN" main.py &
BACKEND_PID=$!

echo "Waiting 3 seconds for model initialization..."
sleep 3

echo "[2/2] Launching Permanent Ngrok Tunnel (https://anatomy-portly-yard.ngrok-free.dev)..."
cd "$SCRIPT_DIR"

if command -v ngrok >/dev/null 2>&1; then
    NGROK_BIN="ngrok"
elif [ -f "./ngrok" ]; then
    NGROK_BIN="./ngrok"
else
    echo "ngrok not found in PATH. Please install ngrok or run: curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc"
    wait $BACKEND_PID
    exit 1
fi

echo ""
echo "===================================================================="
echo "  Permanent Endpoint Live: https://anatomy-portly-yard.ngrok-free.dev"
echo "  Press Ctrl+C to stop both services."
echo "===================================================================="

trap "kill $BACKEND_PID 2>/dev/null || true; pkill -f ngrok || true; exit 0" SIGINT SIGTERM

"$NGROK_BIN" http 127.0.0.1:8000 --url https://anatomy-portly-yard.ngrok-free.dev
