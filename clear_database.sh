#!/usr/bin/env bash
# ====================================================================
# Phishing Detector: Remote Database Cleanup Script (Linux & macOS)
# ====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if command -v node >/dev/null 2>&1; then
    node scripts/clear_database.mjs
else
    echo "Error: Node.js is not installed!"
    exit 1
fi
