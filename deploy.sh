#!/bin/bash
set -e

echo "╔══════════════════════════════════════════╗"
echo "║       FinAi — Production Deploy          ║"
echo "╚══════════════════════════════════════════╝"

export PATH="/home/runner/workspace/.pythonlibs/bin:$PATH"
export PYTHONPATH="/home/runner/workspace"

EVO_VERSION="2.3.7"
EVO_DIR="/home/runner/workspace/evolution-api"

# ── 1. Evolution API — clone pinned stable version ───────────────────────────
echo ""
echo "→ [1/5] Setting up Evolution API v${EVO_VERSION}..."
if [ -d "$EVO_DIR/.git" ]; then
    CURRENT_TAG=$(git -C "$EVO_DIR" describe --tags --exact-match 2>/dev/null || echo "unknown")
    if [ "$CURRENT_TAG" = "$EVO_VERSION" ]; then
        echo "   ✅ Already at v${EVO_VERSION} — skipping clone"
    else
        echo "   ♻️  Re-cloning at v${EVO_VERSION}..."
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

# ── 2. Evolution API — npm install + audit fix ───────────────────────────────
echo ""
echo "→ [2/5] Installing Evolution API dependencies..."
cd "$EVO_DIR"
npm install --legacy-peer-deps --prefer-offline 2>&1 | tail -5 || \
    echo "   ⚠️  npm install had warnings (continuing)"

echo "   🔍 Running npm audit fix (best-effort)..."
npm audit fix --force 2>&1 | tail -5 || \
    echo "   ⚠️  npm audit fix skipped or had issues"

# ── 3. Evolution API — Prisma DB migration ──────────────────────────────────
echo ""
echo "→ [3/5] Running Evolution API DB migrations..."
if [ -n "$SUPABASE_DB_URL" ]; then
    DATABASE_CONNECTION_URI="$SUPABASE_DB_URL" \
    DATABASE_PROVIDER="postgresql" \
    npm run db:deploy 2>&1 | tail -8 || \
        echo "   ⚠️  Evolution DB migration skipped (will retry on first start)"
else
    echo "   ⚠️  SUPABASE_DB_URL not set — skipping Evolution DB migration"
fi

# ── 4. Python requirements ───────────────────────────────────────────────────
echo ""
echo "→ [4/5] Installing Python requirements..."
cd /home/runner/workspace
pip install -r requirements.txt --quiet
echo "   ✅ Python requirements installed"

# ── 5. Frontend build ────────────────────────────────────────────────────────
echo ""
echo "→ [5/5] Building React frontend..."
cd /home/runner/workspace/frontend
npm install --legacy-peer-deps --quiet
npm run build
echo "   ✅ Frontend built to frontend/dist"

cd /home/runner/workspace
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     Deploy complete — run start.sh       ║"
echo "╚══════════════════════════════════════════╝"
chmod +x start.sh
