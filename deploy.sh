#!/bin/bash
set -e

echo "=== FinAi Production Build ==="

EVO_VERSION="2.3.7"
EVO_DIR="/home/runner/workspace/evolution-api"

# ── Clone Evolution API at pinned stable version ─────────────────────────────
echo "→ Setting up Evolution API v${EVO_VERSION}..."
if [ -d "$EVO_DIR/.git" ]; then
    CURRENT_TAG=$(git -C "$EVO_DIR" describe --tags --exact-match 2>/dev/null || echo "unknown")
    if [ "$CURRENT_TAG" = "$EVO_VERSION" ]; then
        echo "   ✅ Evolution API already at v${EVO_VERSION}"
    else
        echo "   ♻️  Re-cloning Evolution API at v${EVO_VERSION}..."
        rm -rf "$EVO_DIR"
        git clone --depth 1 --branch "$EVO_VERSION" \
            https://github.com/EvolutionAPI/evolution-api.git "$EVO_DIR"
    fi
else
    echo "   📦 Cloning Evolution API v${EVO_VERSION}..."
    rm -rf "$EVO_DIR"
    git clone --depth 1 --branch "$EVO_VERSION" \
        https://github.com/EvolutionAPI/evolution-api.git "$EVO_DIR"
fi

echo "→ Installing Evolution API dependencies..."
cd "$EVO_DIR"
npm install --legacy-peer-deps 2>&1 | tail -5 || echo "   ⚠️  npm install had warnings"

echo "→ Running npm audit fix..."
npm audit fix --force 2>&1 | tail -5 || echo "   ⚠️  npm audit fix skipped"

echo "→ Running Evolution API DB migrations..."
if [ -n "$SUPABASE_DB_URL" ]; then
    DATABASE_CONNECTION_URI="$SUPABASE_DB_URL" DATABASE_PROVIDER="postgresql" \
        npm run db:deploy 2>&1 | tail -8 || echo "   ⚠️  DB migration skipped"
else
    echo "   ⚠️  SUPABASE_DB_URL not set — skipping Evolution DB migration"
fi

cd /home/runner/workspace

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "→ Installing frontend dependencies..."
cd /home/runner/workspace/frontend
npm install --legacy-peer-deps

echo "→ Building frontend..."
npm run build
echo "→ Frontend built to frontend/dist"

cd /home/runner/workspace

# ── Python requirements ───────────────────────────────────────────────────────
echo "→ Installing 🐍Python 🐍requirements..."
pip install -r requirements.txt
echo "→ Requirements installed done"

echo "→ Making start.sh executable..."
chmod +x start.sh

echo "→ Starting FastAPI server..."
exec bash start.sh
