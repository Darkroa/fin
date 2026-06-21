#!/bin/bash
# Kill any existing processes on used ports
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true
# Also kill any lingering vite / uvicorn processes
pkill -f "vite" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
sleep 2

export PATH="/home/runner/workspace/.pythonlibs/bin:$PATH"
export PYTHONPATH="/home/runner/workspace"

# Start FastAPI backend in background
python3 -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
sleep 5

# Start React frontend (Vite) on port 5000
cd frontend && exec ./node_modules/.bin/vite --port 5000 --host 0.0.0.0 2>&1
