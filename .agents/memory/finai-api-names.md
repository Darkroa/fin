---
name: FinAi API Function Names
description: Non-obvious API export names that differ from intuitive guesses
---

## Alerts
- `listAlerts()` — not `getAlerts()`
- `createAlert({ symbol, target_price, direction })` — key is `symbol`, not `ticker`
- `deleteAlert(id: number)` — takes numeric ID

## Notifications
- `getUserNotifications()` — not `getNotifications()`

## Positions
- `closeManualPosition(id: number)` — not `closePosition()`

## Support
- `createSupportTicket({ subject, message, priority? })` — key is `message`, not `description`

## getEvents
- Returns axios response; data is in `res.data`, not the return value directly

**Why:** These caused runtime errors when screens assumed different names/shapes. Verified against api.ts exports.
