#!/bin/bash
set -euo pipefail

PIDFILE_DIR="/tmp/finai-pids"
mkdir -p "$PIDFILE_DIR"

# ── Kill processes by cmdline (reliable: no lsof/ss needed) ──────────────────
kill_by_cmdline() {
    local PATTERN=$1
    for PID_DIR in /proc/[0-9]*; do
        PID=${PID_DIR#/proc/}
        CMDLINE=$(tr '\0' ' ' < "$PID_DIR/cmdline" 2>/dev/null || true)
        if echo "$CMDLINE" | grep -q "$PATTERN"; then
            echo "  Killing PID $PID ($PATTERN)"
            kill -9 "$PID" 2>/dev/null || true
        fi
    done
}

echo "→ Stopping previous services..."

# Kill tracked PIDs from last run first
for PIDFILE in "$PIDFILE_DIR"/*.pid; do
    [ -f "$PIDFILE" ] || continue
    OLD_PID=$(cat "$PIDFILE" 2>/dev/null || true)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "  Killing tracked PID $OLD_PID"
        kill -9 "$OLD_PID" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
done

# Kill any remaining service processes by their cmdline signatures
kill_by_cmdline "uvicorn src.api.main"
kill_by_cmdline "node dist/main"
# Don't kill vite generically — only kill old FinAi vite by port flag
kill_by_cmdline "vite --port 5000"

sleep 3
echo "✅ Old processes cleared"

# ── Generate evolution-api/.env from runtime secrets ──────────────────────────
echo "→ Writing evolution-api/.env..."
cat > /home/runner/workspace/evolution-api/.env << ENVEOF
SERVER_NAME=FinAiEvobots
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=http://localhost:8080
SERVER_DISABLE_DOCS=false
SERVER_DISABLE_MANAGER=false
CORS_ORIGIN=*
CORS_METHODS=POST,GET,PUT,DELETE
CORS_CREDENTIALS=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=${DATABASE_URL}
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
ENVEOF
echo "✅ evolution-api/.env written"

# ── FastAPI backend ────────────────────────────────────────────────────────────
echo "→ Starting FastAPI backend on port 8000..."
export PATH="/home/runner/workspace/.pythonlibs/bin:$PATH"
export PYTHONPATH="/home/runner/workspace"
cd /home/runner/workspace
python3 -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PIDFILE_DIR/fastapi.pid"
echo "Backend started (PID: $BACKEND_PID)"

sleep 5

# ── Evolution API (skip if already running on 8080) ───────────────────────────
echo "→ Checking Evolution API on port 8080..."
EVO_RUNNING=0
for PID_DIR in /proc/[0-9]*; do
    PID=${PID_DIR#/proc/}
    CMDLINE=$(tr '\0' ' ' < "$PID_DIR/cmdline" 2>/dev/null || true)
    if echo "$CMDLINE" | grep -q "node dist/main"; then
        echo "  Evolution API already running (PID $PID) — skipping start"
        echo "$PID" > "$PIDFILE_DIR/evolution.pid"
        EVO_RUNNING=1
        break
    fi
done

if [ "$EVO_RUNNING" -eq 0 ]; then
    echo "→ Starting Evolution API on port 8080..."
    cd /home/runner/workspace/evolution-api
    npm run start:prod &
    EVO_PID=$!
    echo "$EVO_PID" > "$PIDFILE_DIR/evolution.pid"
    echo "Evolution API started (PID: $EVO_PID)"
    sleep 3
fi

# ── React frontend (Vite) ──────────────────────────────────────────────────────
echo "→ Starting React frontend (Vite) on port 5000..."
cd /home/runner/workspace/frontend
./node_modules/.bin/vite --port 5000 --host 0.0.0.0 &
VITE_PID=$!
echo "$VITE_PID" > "$PIDFILE_DIR/vite.pid"
echo "✅ All services started — FastAPI:8000  Evo:8080  Vite:5000"

# Keep alive and forward signals cleanly to all children
trap "kill -9 $BACKEND_PID $VITE_PID 2>/dev/null; exit 0" SIGTERM SIGINT
wait $VITE_PID
