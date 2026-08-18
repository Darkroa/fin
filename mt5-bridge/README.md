# FinAi MT5 Bridge API

This folder contains the server-side API that connects FinAi to a MetaTrader 5
terminal. It is intentionally separate from the main FastAPI application.

## What it does

- Accepts signed requests only from the FinAi backend.
- Connects to an MT5 account using the broker server name provided by the user.
- Returns account balance, equity, margin, positions, broker symbols, and quotes.
- Places only explicitly requested market orders.
- Keeps live orders disabled unless two independent switches allow them:
  the FinAi account permission and `ALLOW_LIVE_ORDERS=true`.

## Security

Every `/account`, `/markets`, and `/order` request requires:

- `X-MT5-BRIDGE-KEY`
- `X-MT5-Timestamp`
- `X-MT5-Nonce`
- `X-MT5-Signature`

The signature is:

```text
HMAC-SHA256(MT5_BRIDGE_SIGNING_SECRET, timestamp + "." + nonce + "." + raw_body)
```

The bridge rejects invalid keys, invalid signatures, expired timestamps, and
replayed nonces. It never logs request bodies because they contain broker
passwords. Keep the bridge behind HTTPS, a private network, or a VPN such as
Tailscale. Do not expose it publicly over plain HTTP.

The bridge is fail-closed:

- Missing bridge secrets returns an error.
- MT5 terminal unavailable returns an error.
- Live orders are disabled by default.
- Invalid account numbers, sides, symbols, and volumes are rejected.

## Running it

The MetaTrader5 Python package requires Windows and an installed MetaTrader 5
terminal. Run this folder on a Windows VPS or Windows machine:

```powershell
cd mt5-bridge
py -3 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Put real secrets in the Windows environment or a protected .env file.
uvicorn app:app --host 127.0.0.1 --port 8100
```

For a remote FinAi backend, expose the service only through HTTPS/private
networking and set these backend secrets in the FinAi environment:

```text
MT5_BRIDGE_URL=https://your-private-bridge-host
MT5_BRIDGE_KEY=<same bridge key>
MT5_BRIDGE_SIGNING_SECRET=<same HMAC secret>
```

Do not put broker account passwords in this folder, `.env.example`, source
control, or the frontend. The FinAi backend supplies them only over the signed
server-to-server request.