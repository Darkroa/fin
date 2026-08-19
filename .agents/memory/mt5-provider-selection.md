---
name: MT5 provider selection
description: How MetaApi and the Windows bridge share the authenticated MT5 contract.
---

MT5 provider choice belongs in the authenticated backend connection record, not
in browser-only state. MetaApi records keep a provider account ID; bridge
records keep encrypted credentials and use signed server-to-server calls.

**Why:** Both providers must expose the same account, market, and order contract
without allowing the browser to connect directly to a broker terminal.

**How to apply:** Keep provider-specific code behind the backend adapter boundary
and preserve demo defaults, explicit live confirmation, HMAC bridge signing, and
credential redaction for all new MT5 operations.