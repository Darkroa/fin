# FinAi Windows MT5 Bridge Setup

The bridge is the option to use when the MetaTrader terminal must run on a
Windows VPS or workstation. The browser never connects to MT5 directly. The
FinAi backend sends signed server-to-server requests to this bridge.

## 1. Prepare the Windows machine

1. Use Windows Server or Windows 10/11 on a machine that can stay online.
2. Install the broker's MetaTrader 5 (or MT4) desktop terminal.
3. Log in once manually with the trading account, exact broker server, and
   trading password.
4. Leave the terminal installed and available to the Python process. Do not
   put the broker password in this project or in the bridge `.env` file.

The terminal architecture must match the Python architecture. A 64-bit Python
installation should use a 64-bit MetaTrader terminal.

## 2. Install and configure the bridge

Open PowerShell:

```powershell
cd C:\path\to\FinAi\mt5-bridge
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Generate two different random values and put them in `.env`:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Set:

```text
MT5_BRIDGE_KEY=<random client key>
MT5_BRIDGE_SIGNING_SECRET=<different random HMAC secret>
ALLOW_LIVE_ORDERS=false
MT5_BRIDGE_DOCS=false
```

Keep live orders disabled until demo account sync, market search, and explicit
demo-order checks work.

## 3. Run the bridge privately

For a first local test:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app:app --host 127.0.0.1 --port 8100
```

The health endpoint should report that the `MetaTrader5` adapter is available:

```powershell
curl.exe http://127.0.0.1:8100/health
```

For a remote Replit backend, do not expose port 8100 directly to the public
internet. Put the bridge behind HTTPS and a private network/VPN such as
Tailscale, then set these values in the FinAi server secret store:

```text
MT5_BRIDGE_URL=https://private-bridge-host
MT5_BRIDGE_KEY=<same random client key>
MT5_BRIDGE_SIGNING_SECRET=<same random HMAC secret>
```

The key and signing secret must match exactly. They are never sent to the
frontend.

## 4. Connect from FinAPI

1. Open Profile → FinAPI → MT5 Broker Accounts.
2. Select **Windows MT5 Bridge**.
3. Choose MT4 or MT5, the broker, and the exact server name shown in the
   terminal.
4. Enter the account number and **trading** password, not the investor/read-only
   password.
5. Keep Demo selected.
6. Click Connect.

FinAi signs the verification request, the bridge logs into the installed
terminal, and only then stores the connection. The password is encrypted in
the FinAi database and decrypted only for a signed bridge request.

## 5. Production checklist

- Use HTTPS or a private VPN between FinAi and Windows.
- Run the bridge as a restricted Windows service or scheduled task.
- Keep the terminal and Python dependencies patched.
- Use a demo account first and verify account sync, broker symbols, quotes, and
  rejected-order handling.
- Add audit logging and idempotency before enabling live orders.
- Only set `ALLOW_LIVE_ORDERS=true` after a separate operational review.

If the bridge is unavailable or its credentials are wrong, FinAi returns a
provider error. It does not show fabricated balances, prices, positions, or
fills.