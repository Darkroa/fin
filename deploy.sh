#!/bin/bash
set -e

echo "=== FinAi Production Build ==="
cd /home/runner/workspace

# ── Python requirements ────────────────────────────────────────────────────────
echo "→ Installing Python requirements..."
pip install -r requirements.txt
echo "✅ Python requirements installed"

# ── Frontend ───────────────────────────────────────────────────────────────────
echo "→ Installing frontend dependencies..."
cd /home/runner/workspace/frontend
npm install --legacy-peer-deps

echo "→ Building frontend..."
npm run build
echo "✅ Frontend built"

# ── Evolution API setup (install + build + migrate — no server start) ──────────
echo "→ Setting up Evolution API..."
cd /home/runner/workspace/evolution-api
chmod +x evostart.sh
bash evostart.sh

echo ""
echo "=== Build complete — launching all services ==="
chmod +x /home/runner/workspace/start.sh
exec bash /home/runner/workspace/start.sh
