# FinAi — AI-Powered Financial Intelligence Platform

## Project Overview

FinAi is a full-stack AI-powered financial trading platform built with FastAPI (backend) and Streamlit (frontend). It ingests real-time financial news, performs Grok-powered sentiment analysis, detects market events, and executes automated trading strategies.

## Architecture

```
├── src/
│   ├── api/             # FastAPI backend (main.py, routes.py, middleware.py)
│   ├── analysis/        # AI analysis modules (sentiment, forecaster, trendline, impact)
│   ├── auth/            # JWT authentication (auth.py, dependencies.py)
│   ├── celery_app/      # Celery task queue (__init__.py auto-detects Redis, tasks.py)
│   ├── conversation/    # Conversational AI agent
│   ├── database/        # SQLAlchemy models and session (PostgreSQL)
│   ├── event/           # Market event detection
│   ├── frontend/        # Streamlit pages (login.py, user_dashboard.py, pages/)
│   ├── ingestion/       # News scrapers (RSS, NewsAPI, AlphaVantage)
│   ├── notifications/   # Multi-channel alerts (Telegram, WhatsApp, Slack, Email)
│   ├── rag/             # Retrieval-Augmented Generation (ChromaDB)
│   ├── trading/         # Trading bots and Alpaca/Binance broker integrations
│   └── users/           # User CRUD, API key management, bot manager
├── admin/               # Streamlit admin dashboard
├── migrations/          # Alembic database migrations
└── start.sh             # Entry point: starts FastAPI (port 8000) + Streamlit (port 5000)
```

## Tech Stack

- **Backend**: FastAPI + Uvicorn (port 8000)
- **Frontend**: Streamlit (port 5000) — dark Binance-inspired UI
- **Database**: PostgreSQL (Replit managed, via DATABASE_URL)
- **Task Queue**: Celery — auto-detects Redis; falls back to synchronous eager mode when Redis is unavailable
- **AI**: Grok (primary via langchain-groq) + OpenAI (fallback/embeddings)
- **Vector DB**: ChromaDB (RAG)
- **Trading**: Alpaca (paper + live), Binance via python-binance
- **Notifications**: Telegram, Twilio WhatsApp, Slack, Email

## Running the App

The main workflow runs `start.sh`:

```bash
# Starts FastAPI backend on port 8000 (background)
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Starts Streamlit frontend on port 5000 (foreground)
streamlit run src/frontend/login.py --server.port 5000 --server.address 0.0.0.0
```

## Environment Variables (Secrets)

Set these in the Replit Secrets panel:

| Key | Required | Description |
|-----|----------|-------------|
| `GROK_API_KEY` | Yes | Groq API key for Grok LLM (console.groq.com) |
| `OPENAI_API_KEY` | Recommended | OpenAI fallback + embeddings (platform.openai.com) |
| `JWT_SECRET_KEY` | Yes | Secret for signing JWT tokens (any long random string) |
| `DATABASE_URL` | Auto | Set automatically by Replit PostgreSQL |
| `NEWSAPI_KEY` | Optional | NewsAPI.org for live financial news |
| `ALPHA_VANTAGE_KEY` | Optional | AlphaVantage market data |
| `ALPACA_API_KEY` | Optional | Alpaca trading (paper/live) |
| `ALPACA_SECRET_KEY` | Optional | Alpaca trading secret |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram trade alerts |
| `TELEGRAM_CHAT_ID` | Optional | Telegram target chat |
| `TWILIO_ACCOUNT_SID` | Optional | WhatsApp alerts via Twilio |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio auth |

## Key Design Decisions

### Redis-Free Celery Mode
`src/celery_app/__init__.py` probes Redis at startup. If Redis is not available (as on Replit free tier), Celery automatically runs in `task_always_eager=True` mode — tasks execute synchronously inline without needing a broker. This makes background jobs work out of the box.

### Database
Uses Replit's built-in PostgreSQL. The `DATABASE_URL` secret is automatically injected. SQLAlchemy models auto-create tables at startup (`Base.metadata.create_all`).

### Auth
JWT-based auth via `python-jose`. Users login through Streamlit, which calls the FastAPI `/api/auth/login` endpoint. Tokens stored in Streamlit session state.

### Frontend Structure
- `login.py` — Landing page + auth (dark theme, Binance-inspired)
- `user_dashboard.py` — Full trading dashboard (Overview, Markets, Bots, Portfolio, Deposit/Withdrawal, Analysis, Profile)
- `admin/admin_dashboard.py` — Admin panel (Users, Transactions, Events, System)

## User Preferences

- Dark theme throughout (Binance-style color palette: #0b0e11 bg, #f0b90b gold, #0ecb81 green, #f6465d red)
- Inter font for professional look
- Modular sidebar navigation
