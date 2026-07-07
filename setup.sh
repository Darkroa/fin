#!/bin/bash
# FinAi Mobile — Expo Metro Bundler
# This is the second workflow. Run it separately from start.sh (which handles FastAPI + Evolution API).
set -euo pipefail

MOBILE_DIR="/home/runner/workspace/mobile"

echo "→ Starting Expo Metro Bundler on port 8099..."

cd "$MOBILE_DIR"

# Clean any stale Metro cache so a fresh build is guaranteed
npx expo start --port 8099 --host lan --clear
