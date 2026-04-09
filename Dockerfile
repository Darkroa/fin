FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r 

# Fix common PATH issue for pip-installed CLI tools like streamlit
ENV PATH="${PATH}:/root/.local/bin"

# Create necessary directories
RUN mkdir -p data/raw_news data/processed_events data/backtests data/chroma_db logs

EXPOSE 8000 7860 8503 9090 3000 8501

# Default command (can be overridden in docker-compose or render.yaml)
CMD ["streamlit", "run", "user_dashboard.py", "--server.port=8501", "--server.address=0.0.0.0"]
