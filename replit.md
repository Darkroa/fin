# FinAi — AI-Powered Financial Intelligence & Automated Trading

## Overview
FinAi is a production-ready trading platform with real-time AI analysis, automated bots, and multi-broker execution (Alpaca + Binance).

## Stack
- **Backend**: FastAPI + Uvicorn (port 5000)
- **Frontend**: React (Vite) — dark, Binance-inspired dashboard served as static build from `frontend/dist/`
- **Mobile**: Expo / React Native (port 8099) — `mobile/`
- **Database**: PostgreSQL via Supabase (`SUPABASE_DB_URL`)
- **Messaging**: Evolution API (port 8080) — `evolution-api/`
- **Task Queue**: Celery (runs eagerly/sync without Redis)
- **AI/LLM**: Grok → OpenAI → Groq → DeepSeek → Gemini → fallback chain

## How to Run
The single workflow `Start application` runs `bash start.sh`, which:
1. Starts FastAPI backend on port 5000
2. Starts Evolution API (WhatsApp) on port 8080
3. Starts Expo mobile dev server on port 8099

## Required Secrets (already configured)
| Secret | Purpose |
|--------|---------|
| `JWT_SECRET_KEY` | JWT token signing |
| `GROK_API_KEY` | Primary AI engine |
| `SUPABASE_DB_URL` | PostgreSQL database |
| `OPENAI_API_KEY` | Embeddings + fallback LLM |
| `GROQ_API_KEY` | Ultra-fast inference fallback |

## Optional Secrets
Trading: `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`  
Notifications: `TELEGRAM_BOT_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `RESEND_API_KEY`  
Data: `NEWSAPI_KEY`, `ALPHA_VANTAGE_KEY`

## Project Structure
```
src/           FastAPI backend
frontend/      React (Vite) SPA — build to frontend/dist/ with: cd frontend && npm run build
mobile/        Expo / React Native app
evolution-api/ WhatsApp messaging service
migrations/    Alembic database migrations
```

## Frontend Build
The frontend must be built before the backend serves the UI:
```bash
cd frontend && npm install --legacy-peer-deps && npm run build
```

## Mobile (Expo)
Expo dev server starts automatically on port 8099.  
Scan the QR code with Expo Go on your phone, or open the web build in a browser.

## API Docs
Interactive Swagger UI available at `/docs` when the backend is running.

## Admin Credentials
Seeded on first startup (see database/seed logic in `src/api/main.py`).

## User Preferences
