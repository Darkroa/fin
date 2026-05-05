# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ .
RUN npm run build

# ── Stage 2: Python dependencies ───────────────────────────────────────────
FROM python:3.12-slim AS py-builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Stage 3: Final image ────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=py-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=py-builder /usr/local/bin /usr/local/bin

COPY . .

# Copy built React app into FastAPI static directory
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

RUN mkdir -p data/raw_news data/processed_events data/backtests data/chroma_db logs

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
