---
name: FinAi Mobile Design System
description: Color tokens, spacing, shadow utilities and navigation structure for the FinAi mobile app
---

## Color Tokens (mobile/src/theme.ts)
- bg: #0B0E11, card: #1E2329, cardAlt: #161A1F, border: #2B3139
- accent: #F0B90B (gold), green: #0ECB81, red: #F6465D
- textSecondary: #848E9C, textMuted: #5E6673
- accentMuted / greenMuted / redMuted: color + "22" for backgrounds

**Why:** These must match the frontend's Binance-style palette exactly. Green #0ECB81 and red #F6465D differ from older shades (#03A66D, #CF304A) in earlier code.

**How to apply:** Import from `../theme` — never hardcode color values in screen files.

## Navigation Structure (5 Tabs)
Dashboard | Markets | **Trade (elevated center)** | Wallet | More (stack)

The Trade button is elevated with a gold circular button at -20 margin-top, using a custom tabBar renderer.

**Why:** Matches the frontend dashboard's mobile nav pattern with raised center action button.

## SVG Gradient Pattern
Use `react-native-svg` RadialGradient for hero card glow effects (expo-linear-gradient is NOT installed).
