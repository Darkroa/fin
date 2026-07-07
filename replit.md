# FinAi — AI-Powered Financial Intelligence & Automated Trading

## Overview

Production-ready trading platform with:
- **FastAPI backend** (port 5000) — REST API + WebSocket live data
- **React frontend** — dark Binance-style dashboard served as static build
- **Evolution API** (port 8080) — WhatsApp messaging service
- **React Native mobile app** (`mobile/`) — Expo SDK 54, runs in Expo Go

## Running the project

### Web app (backend + dashboard)
The `Start application` workflow runs `bash start.sh` which starts:
1. FastAPI backend on port 5000 (serves both API and frontend static files)
2. Evolution API on port 8080

### Mobile app (Expo Go)
The `Expo Mobile` workflow runs:
```
cd mobile && REACT_NATIVE_PACKAGER_HOSTNAME=fin--aifin.replit.app npx expo start --port 8099 --host lan
```
Metro bundler URL: `exp://fin--aifin.replit.app:8099`

To use on phone: scan the QR code from the **Expo Mobile** workflow console in Expo Go.

## Key environment variables

| Variable | Purpose |
|----------|---------|
| `GROK_API_KEY` / `GROQ_API_KEY` | Primary AI engine (Groq) |
| `JWT_SECRET_KEY` | JWT token signing |
| `SUPABASE_DB_URL` | PostgreSQL via Supabase |
| `OPENAI_API_KEY` | Embeddings + fallback LLM |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | Alpaca trading |
| `EVOLUTION_API_KEY` | WhatsApp via Evolution API |
| `TELEGRAM_BOT_TOKEN` | Trade alerts |

## Project structure

```
src/                  FastAPI backend
  api/                Routes, middleware, main app
  analysis/           AI sentiment, trendlines, forecaster
  auth/               JWT authentication
  celery_app/         Task queue (Redis-free fallback)
  database/           SQLAlchemy models + Supabase session
  trading/            Bot engine, Alpaca, Binance (ccxt)
  notifications/      Telegram, WhatsApp, Slack alerts
frontend/             React (Vite) SPA — built to frontend/dist/
mobile/               Expo SDK 54 React Native app
  src/
    screens/          Dashboard, Markets, Bots, Wallet, Chat
    context/          AuthContext (SecureStore token persistence)
    lib/api.ts        Axios client → https://fin--aifin.replit.app/api
    navigation/       Stack + bottom tab navigator
evolution-api/        WhatsApp Evolution API (Node.js, port 8080)
migrations/           Alembic DB migrations
admin/                Admin panel static files
```

## Mobile app screens

| Screen | Tab | Description |
|--------|-----|-------------|
| Dashboard | 🏠 Home | Balance, today P&L, open positions, market events |
| Markets | 📈 Markets | Live crypto prices (CoinGecko) + macro indicators |
| Bots | 🤖 Bots | Start/stop trading bots, view trades |
| Wallet | 💰 Wallet | Deposit, withdraw, P2P send, transaction history |
| Chat | ⚡ Fin AI | Conversational AI trading assistant |

## User preferences

- Keep existing project structure — do not restructure or migrate
- Mobile app lives in `mobile/` directory alongside the main project
- Mobile API base URL: `https://fin--aifin.replit.app/api`
- Expo Metro port: 8099 (Replit-supported port, no ngrok needed)
