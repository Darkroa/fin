---
name: Mobile API URLs
description: Expo/React Native cannot use relative fetch URLs — must use API_BASE from api.ts for all fetch() calls.
---

React Native's `fetch` does not resolve relative paths (no document origin). Any `fetch('/api/...')` call silently fails or errors on-device.

**Rule:** Always import `API_BASE` from `../lib/api` and use `` `${API_BASE}/path` `` for any direct `fetch()` calls in mobile screens.

**Why:** Expo Go on a real device has no base URL to resolve against. `API_BASE` is derived at runtime from `Constants.expoConfig.extra.apiBaseUrl` (set by app.config.js via REPLIT_DEV_DOMAIN), falling back to the Metro manifest host. The axios `api` default export already uses this base, so prefer the axios wrapper where possible.

**How to apply:** Any time a screen uses bare `fetch('/api/...')` in mobile code — import `API_BASE` and prefix the path. For new endpoints, prefer `import api from '../lib/api'` and use the axios instance directly so auth headers are also sent automatically.
