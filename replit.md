# FinAi

## Project overview

FinAi is an AI-assisted financial trading platform with a FastAPI backend, a Vite/React
web application, an Expo mobile application, broker connections, market data, and
account/trading dashboards.

The web profile's broker and API connection UI lives in `frontend/src/pages/FinApiPage.tsx`.
The authenticated API lives in `src/api/routes.py`, and the web API client is
`frontend/src/lib/api.ts`.

## User preferences

- Keep demo trading as the safe default.
- Never fabricate live prices, balances, positions, bridge health, or order results.
- Require explicit confirmation before any live order.
- Mask broker credentials and account identifiers in the UI, logs, AI context, and API responses.
- Prefer small, focused changes that preserve the existing dark FinAi visual style.
