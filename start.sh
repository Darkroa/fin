#!/bin/bash
# Kill any existing processes on used ports
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true
pkill -f "vite"       2>/dev/null || true
pkill -f "uvicorn"    2>/dev/null || true
pkill -f "evolution-api.*main" 2>/dev/null || true
sleep 2

export PATH="/home/runner/workspace/.pythonlibs/bin:$PATH"
export PYTHONPATH="/home/runner/workspace"

EVO_DIR="/home/runner/workspace/evolution-api"

# ── Evolution API — write .env from real env vars then start ─────────────────
if [ -d "$EVO_DIR/node_modules" ]; then
    echo "→ Writing Evolution API .env..."
    cat > "$EVO_DIR/.env" <<EVOENV
SERVER_NAME=${EVOLUTION_INSTANCE:-FinAiEvobots}
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=http://localhost:8080
SERVER_DISABLE_DOCS=false
SERVER_DISABLE_MANAGER=false

CORS_ORIGIN=*
CORS_METHODS=POST,GET,PUT,DELETE
CORS_CREDENTIALS=true

DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=${SUPABASE_DB_URL}
DATABASE_CONNECTION_CLIENT_NAME=evolution
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_HISTORIC=true
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_IS_ON_WHATSAPP=true
DATABASE_SAVE_IS_ON_WHATSAPP_DAYS=7
DATABASE_DELETE_MESSAGE=false

CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
CACHE_LOCAL_TTL=86400

AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false

LOG_LEVEL=ERROR,WARN,INFO,LOG
LOG_COLOR=true
LOG_BAILEYS=error

DEL_INSTANCE=false
DEL_TEMP_INSTANCES=true

LANGUAGE=en

WEBSOCKET_ENABLED=true
WEBSOCKET_GLOBAL_EVENTS=false

QRCODE_LIMIT=30
QRCODE_COLOR=#f0b90b

CONFIG_SESSION_PHONE_CLIENT=FinAi
CONFIG_SESSION_PHONE_NAME=Chrome

TELEMETRY_ENABLED=false
EVOENV

    echo "→ Starting Evolution API on port 8080..."
    cd "$EVO_DIR" && npm start > /tmp/evolution-api.log 2>&1 &
    EVO_PID=$!
    echo "  Evolution API started (PID: $EVO_PID)"
    cd /home/runner/workspace
else
    echo "→ Evolution API node_modules not found — skipping (run deploy.sh first)"
fi

# ── FastAPI backend ───────────────────────────────────────────────────────────
echo "→ Starting FastAPI backend on port 8000..."
python3 -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
sleep 5

# ── React frontend ────────────────────────────────────────────────────────────
echo "→ Starting React frontend on port 5000..."
cd frontend && exec ./node_modules/.bin/vite --port 5000 --host 0.0.0.0 2>&1
