#!/bin/bash
# FinAi — Expo Mobile Dev Server (port 8099)
set -euo pipefail

PIDFILE_DIR="/tmp/finai-pids"
mkdir -p "$PIDFILE_DIR"

# ── Kill any previous Expo process on port 8099 ───────────────────────────────
echo "→ Clearing port 8099..."
python3 - 8099 <<'PYEOF' 2>/dev/null || true
import os, sys
port = int(sys.argv[1])
try:
    with open('/proc/net/tcp') as f: lines = f.readlines()[1:]
    with open('/proc/net/tcp6') as f: lines += f.readlines()[1:]
except Exception: lines = []
inodes = set()
for line in lines:
    parts = line.split()
    if len(parts) < 10: continue
    try:
        p = int(parts[1].split(':')[1], 16)
    except Exception: continue
    if p == port: inodes.add(parts[9])
for pid in os.listdir('/proc'):
    if not pid.isdigit(): continue
    fd_dir = f'/proc/{pid}/fd'
    try:
        for fd in os.listdir(fd_dir):
            link = os.readlink(f'{fd_dir}/{fd}')
            for inode in inodes:
                if f'socket:[{inode}]' in link:
                    os.kill(int(pid), 9)
    except Exception: continue
PYEOF

for p in /proc/[0-9]*/cmdline; do
    pid=${p%/cmdline}; pid=${pid#/proc/}
    cmd=$(tr '\0' ' ' < "$p" 2>/dev/null || true)
    if echo "$cmd" | grep -q "expo start"; then
        kill -9 "$pid" 2>/dev/null || true
    fi
done
echo "✅ Port 8099 cleared"

# ── Install mobile dependencies ───────────────────────────────────────────────
echo "→ Installing mobile dependencies..."
cd /home/runner/workspace/mobile
npm install --legacy-peer-deps --silent
echo "✅ Dependencies ready"

# ── Export env vars ───────────────────────────────────────────────────────────
export EXPO_PUBLIC_API_URL="https://${REPLIT_DEV_DOMAIN}/api"
# LAN hostname is used for the QR code exp:// link in native Expo Go
export REACT_NATIVE_PACKAGER_HOSTNAME="${REPLIT_EXPO_DEV_DOMAIN:-${REPLIT_DEV_DOMAIN}}"
export EXPO_NO_TELEMETRY=1

# ── Start Expo Metro Bundler ──────────────────────────────────────────────────
echo "→ Starting Expo on port 8099..."
echo "   Native (Expo Go): exp://${REACT_NATIVE_PACKAGER_HOSTNAME}:8099"
echo "   Web preview:      https://${REPLIT_DEV_DOMAIN}:8099"
# --host 0.0.0.0 makes the web server reachable through Replit's proxy
npx expo start --port 8099 --host lan --web
