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

# ── Kill any process holding a specific TCP port (via /proc/net/tcp) ──────────
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
kill_by_cmdline "uvicorn"
kill_by_cmdline "node dist/main"
kill_by_cmdline "vite --port 5000"

# Force-free ports in case zombie processes are still holding them
kill_port 8000
kill_port 5000

sleep 2
echo "✅ Old processes cleared"

# ── Ensure EVOLUTION_API_KEY has a stable default so both services agree ──────
if [ -z "${EVOLUTION_API_KEY:-}" ]; then
    export EVOLUTION_API_KEY="finai-evo-default-key-2024"
    echo "ℹ️  EVOLUTION_API_KEY not set — using built-in default key"
fi

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
    if [ -f /home/runner/workspace/evolution-api/dist/main.js ]; then
        echo "→ Starting Evolution API on port 8080..."
        cd /home/runner/workspace/evolution-api
        npm run start:prod &
        EVO_PID=$!
        echo "$EVO_PID" > "$PIDFILE_DIR/evolution.pid"
        echo "Evolution API started (PID: $EVO_PID)"
        sleep 3
    else
        echo "⚠️  Evolution API not built (dist/main.js missing) — skipping. Run 'npm run build' in evolution-api/ to enable."
    fi
fi

# ── Prometheus ────────────────────────────────────────────────────────────────
if command -v prometheus >/dev/null 2>&1; then
    echo "→ Starting Prometheus on port 9090..."
    prometheus \
        --config.file=/home/runner/workspace/prometheus.yml \
        --web.listen-address=":9090" \
        --storage.tsdb.path=/tmp/prometheus-data \
        --web.route-prefix="/prom" \
        --web.external-url="http://localhost:8000/prom/" \
        --log.level=warn &
    PROM_PID=$!
    echo "$PROM_PID" > "$PIDFILE_DIR/prometheus.pid"
    echo "Prometheus started (PID: $PROM_PID)"
else
    echo "⚠️  prometheus not found in PATH — skipping"
fi

# ── Grafana ────────────────────────────────────────────────────────────────────
if command -v grafana-server >/dev/null 2>&1 || command -v grafana >/dev/null 2>&1; then
    GRAFANA_BIN=$(command -v grafana 2>/dev/null || command -v grafana-server)
    GRAFANA_PKG_ROOT=$(dirname "$(dirname "$GRAFANA_BIN")")
    GRAFANA_HOME="$GRAFANA_PKG_ROOT/share/grafana"
    echo "→ Starting Grafana on port 3001 (home: $GRAFANA_HOME)..."
    mkdir -p /tmp/grafana-data /tmp/grafana-logs /tmp/grafana-plugins
    GF_SERVER_HTTP_PORT=3001 \
    GF_SERVER_ROOT_URL="http://localhost:8000/graf/" \
    GF_SERVER_SERVE_FROM_SUB_PATH=true \
    GF_AUTH_ANONYMOUS_ENABLED=true \
    GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer \
    GF_AUTH_DISABLE_LOGIN_FORM=false \
    GF_SECURITY_ALLOW_EMBEDDING=true \
    GF_LOG_LEVEL=warn \
    GF_PATHS_DATA=/tmp/grafana-data \
    GF_PATHS_LOGS=/tmp/grafana-logs \
    GF_PATHS_PLUGINS=/tmp/grafana-plugins \
    "$GRAFANA_BIN" server --homepath="$GRAFANA_HOME" &
    GRAF_PID=$!
    echo "$GRAF_PID" > "$PIDFILE_DIR/grafana.pid"
    echo "Grafana started (PID: $GRAF_PID)"
else
    echo "⚠️  grafana not found in PATH — skipping"
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
