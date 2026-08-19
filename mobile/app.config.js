// app.config.js — replaces app.json so env vars can be read at build/start time
//
// Port layout in Replit:
//   localPort 5000  → externalPort 80  → https://{REPLIT_DEV_DOMAIN}    (FastAPI backend + React frontend)
//   localPort 8099  → externalPort 8099 → Expo Metro (tunnel via ngrok, not via Replit domain)
//
// Mobile API calls use the main REPLIT_DEV_DOMAIN, which routes to FastAPI on port 5000.

const replitDev = process.env.REPLIT_DEV_DOMAIN;

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (replitDev ? `https://${replitDev}/api` : 'http://localhost:8000/api');

module.exports = {
  expo: {
    name: 'FinAi',
    slug: 'finai-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      backgroundColor: '#0B0E11',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.finai.mobile',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#0B0E11',
      },
      package: 'com.finai.mobile',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      apiBaseUrl,
    },
  },
};
