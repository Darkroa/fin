---
name: FinAi AuthContext Contract
description: How to correctly use AuthContext login/logout in screens
---

## AuthContext.login signature
```typescript
login: (token: string) => Promise<void>
```
It takes **only a JWT token string**, not email/password. It stores the token in SecureStore and calls getMe() to populate the user.

**Why:** The context is token-centric; the API call to exchange credentials for a token is the caller's responsibility.

**How to apply:**
1. Call `login(email, password)` from `api.ts` → get `res.data.access_token`
2. Handle `requires_2fa` flow: get `partial_token`, call `verify2fa()` → get real token
3. Call AuthContext's `login(token)` to store it

## There is NO register() in AuthContext
Use `signup(email, password)` from `api.ts`. It returns `{ access_token }` directly.
