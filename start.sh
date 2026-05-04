#!/bin/bash
# Start FastAPI backend in background
uvicorn src.api.main:app --host localhost --port 8000 --reload &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
sleep 3

# Start Streamlit on port 5000 (frontend)
exec streamlit run src/frontend/login.py \
  --server.port 5000 \
  --server.address 0.0.0.0 \
  --server.headless true \
  --server.enableCORS false \
  --server.enableXsrfProtection false
