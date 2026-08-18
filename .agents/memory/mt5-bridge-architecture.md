---
name: MT5 bridge architecture
description: The non-obvious integration constraint and safety boundary for MetaTrader 5 broker accounts.
---

MT5 broker access must use a server-side terminal/EA bridge rather than a browser-side
universal REST login. Each broker can expose different MT5 server names and symbol
suffixes, so the bridge normalizes account sync, market search, and order execution
behind FinAi's API.

**Why:** MT5 does not provide one universal broker REST API, and browser-side credential
handling would expose trading passwords. A bridge also gives one place to enforce
demo/live permissions, broker lot rules, margin checks, idempotency, and audit logging.

**How to apply:** Keep the UI honest when `MT5_BRIDGE_URL` is absent: show the saved
connection as bridge-pending and never invent balances, quotes, positions, or fills.
Only send credentials from the authenticated backend to a secured bridge, and require
explicit confirmation for every order.

MT5 trading passwords must be encrypted at rest with a dedicated Fernet key before
they are accepted by the authenticated connection endpoint. Legacy plaintext records
must be reconnected rather than forwarded to the bridge.

**Why:** The connection JSON is persisted in the application database, so server-side
transport security alone does not protect broker credentials at rest.

**How to apply:** Configure `MT5_CREDENTIAL_ENCRYPTION_KEY` in the backend secret store
before saving accounts; keep the key separate from the bridge HMAC secrets and never
include encrypted or plaintext passwords in user responses, logs, or AI prompts.

When no Windows terminal is available, keep the same signed bridge contract and swap
only the server-side adapter for a managed MT5 provider or a broker-specific API.

**Why:** The Linux app can host the authenticated contract, but MT5 login and trading
capabilities are broker/provider-specific; a fake universal adapter would create false
balances, quotes, or fills.

**How to apply:** Require a real provider response for account sync, market search, and
orders. Continue showing `Bridge pending` until `MT5_BRIDGE_URL` points to that adapter.