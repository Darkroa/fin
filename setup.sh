#!/bin/bash
# FinAi — Start All Services
# FastAPI (port 5000) + Evolution API (port 8080) + Expo Metro (port 8099)
set -euo pipefail

PIDFILE_DIR="/tmp/finai-pids"
mkdir -p "$PIDFILE_DIR"

# ── Kill processes by cmdline ──────────────────────────────────────────────────
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

# ── Kill process holding a TCP port ───────────────────────────────────────────
kill_port() {
    local PORT=$1
    python3 - "$PORT" <<'PYEOF' 2>/dev/null || true
import os, sys
port = int(sys.argv[1])
try:
    with open('/proc/net/tcp') as f:
        lines = f.readlines()[1:]
    with open('/proc/net/tcp6') as f:
        lines += f.readlines()[1:]
except Exception:
    pass
inodes = set()
for line in lines:
    parts = line.split()
    if len(parts) < 10:
        continue
    try:
        p = int(parts[1].split(':')[1], 16)
    except Exception:
        continue
    if p == port:
        inodes.add(parts[9])
if not inodes:
    sys.exit(0)
for pid in os.listdir('/proc'):
    if not pid.isdigit():
        continue
    fd_dir = f'/proc/{pid}/fd'
    try:
        fds = os.listdir(fd_dir)
    except Exception:
        continue
    for fd in fds:
        try:
            link = os.readlink(f'{fd_dir}/{fd}')
            for inode in inodes:
                if f'socket:[{inode}]' in link:
                    print(f'  Killing PID {pid} (holding port {port})')
                    os.kill(int(pid), 9)
                    break
        except Exception:
            continue
PYEOF
}

echo "→ Stopping previous services..."
for PIDFILE in "$PIDFILE_DIR"/*.pid; do
    [ -f "$PIDFILE" ] || continue
    OLD_PID=$(cat "$PIDFILE" 2>/dev/null || true)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "  Killing tracked PID $OLD_PID"
        kill -9 "$OLD_PID" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
done
kill_by_cmdline "uvicorn"
kill_by_cmdline "node dist/main"
kill_by_cmdline "expo start"
kill_port 5000
kill_port 8099
sleep 2
echo "✅ Old processes cleared"

# ── Ensure EVOLUTION_API_KEY has a stable default ─────────────────────────────
if [ -z "${EVOLUTION_API_KEY:-}" ]; then
    export EVOLUTION_API_KEY="finai-evo-default-key-2024"
    echo "ℹ️  EVOLUTION_API_KEY not set — using built-in default key"
fi

# ── Write evolution-api/.env ───────────────────────────────────────────────────
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
DATABASE_CONNECTION_URI=${DATABASE_URL:-}
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
AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY:-}
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false
ENVEOF
echo "✅ evolution-api/.env written"

# ── FastAPI backend on port 5000 ───────────────────────────────────────────────
echo "→ Starting FastAPI backend on port 5000..."
export PATH="/home/runner/workspace/.pythonlibs/bin:$PATH"
export PYTHONPATH="/home/runner/workspace"
cd /home/runner/workspace
python3 -m uvicorn src.api.main:app --host 0.0.0.0 --port 5000 --reload &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PIDFILE_DIR/fastapi.pid"
echo "FastAPI started (PID: $BACKEND_PID)"

sleep 5

# ── Evolution API on port 8080 ────────────────────────────────────────────────
EVO_RUNNING=0
for PID_DIR in /proc/[0-9]*; do
    PID=${PID_DIR#/proc/}
    CMDLINE=$(tr '\0' ' ' < "$PID_DIR/cmdline" 2>/dev/null || true)
    if echo "$CMDLINE" | grep -q "node dist/main"; then
        echo "  Evolution API already running (PID $PID) — skipping"
        echo "$PID" > "$PIDFILE_DIR/evolution.pid"
        EVO_RUNNING=1
        break
    fi
done
if [ "$EVO_RUNNING" -eq 0 ]; then
    if [ -f /home/runner/workspace/evolution-api/dist/main.js ]; then
        echo "→ Starting Evolution API on port 8080..."
        cd /home/runner/workspace/evolution-api
        npm run start:prod &
        EVO_PID=$!
        echo "$EVO_PID" > "$PIDFILE_DIR/evolution.pid"
        echo "Evolution API started (PID: $EVO_PID)"
        sleep 3
    else
        echo "⚠️  Evolution API not built — skipping"
    fi
fi

# ── Expo Metro Bundler on port 8099 ───────────────────────────────────────────
echo "→ Installing Expo mobile dependencies..."
cd /home/runner/workspace/mobile
npm install --legacy-peer-deps --silent
echo "✅ Mobile dependencies installed"

echo "→ Starting Expo Metro Bundler on port 8099..."
EXPO_NO_TELEMETRY=1 npx expo start --port 8099 --host lan --web &
EXPO_PID=$!

echo "$EXPO_PID" > "$PIDFILE_DIR/expo.pid"
echo "Expo Metro started (PID: $EXPO_PID)"
echo "✅ All services started — FastAPI:5000  Evolution:8080  Expo:8099"
echo "   Web:    http://localhost:5000"
echo "   Mobile: http://localhost:5000/mobile"
echo "   Expo:   exp:yoururl:8099"

# Keep alive — forward signals to FastAPI (primary process)
trap 'kill -9 $BACKEND_PID $EXPO_PID 2>/dev/null; exit 0' SIGTERM SIGINT
wait $BACKEND_PID
