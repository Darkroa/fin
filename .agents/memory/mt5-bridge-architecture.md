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