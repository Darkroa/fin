---
name: MT5 bridge architecture
description: The non-obvious integration constraint and safety boundary for MetaTrader 5 broker accounts.
---

MT5 broker access must use a server-side provider/terminal bridge rather than a
browser-side universal REST login. MetaApi Cloud is the current provider: it owns
the managed terminal and the FinAi API normalizes account sync, market search, and
order execution behind its authenticated contract.

**Why:** MT5 does not provide one universal broker REST API, and browser-side credential
handling would expose trading passwords. A bridge also gives one place to enforce
demo/live permissions, broker lot rules, margin checks, idempotency, and audit logging.

**How to apply:** Keep provider errors visible and never invent balances, quotes,
positions, or fills. Only send credentials from the authenticated backend to the
configured provider, and require explicit confirmation for every order.

MT5 trading passwords must be encrypted at rest with a dedicated Fernet key before
they are accepted by the authenticated connection endpoint. Legacy plaintext records
must be reconnected rather than forwarded to the bridge.

**Why:** The connection JSON is persisted in the application database, so server-side
transport security alone does not protect broker credentials at rest.

**How to apply:** Configure `MT5_CREDENTIAL_ENCRYPTION_KEY` in the backend secret store
before saving accounts; keep the key separate from the bridge HMAC secrets and never
include encrypted or plaintext passwords in user responses, logs, or AI prompts.

When no Windows terminal is available, keep the same authenticated contract and swap
only the server-side adapter for MetaApi Cloud, another managed MT5 provider, or a
broker-specific API.

**Why:** The Linux app can host the authenticated contract, but MT5 login and trading
capabilities are broker/provider-specific; a fake universal adapter would create false
balances, quotes, or fills.

**How to apply:** Require a real provider response for account verification, account
sync, market search, and orders. Configure the MetaApi token through server
environment secrets; never expose it to the browser. MetaApi account creation for
manual trades requires `magic` set to `0` and should use a G2 cloud account.