// app.config.js — replaces app.json so env vars can be read at build/start time
//
// Port layout in Replit:
//   localPort 8099 → externalPort 80  → https://{REPLIT_DEV_DOMAIN}          (Expo Metro)
//   localPort 5000 → externalPort 5000 → https://5000-{REPLIT_DEV_DOMAIN}    (FastAPI backend)
//
// The mobile app must talk to the FastAPI backend, so we prepend "5000-" to
// the dev domain to get the correct port-specific subdomain.

const replitDev = process.env.REPLIT_DEV_DOMAIN;

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (replitDev ? `https://5000-${replitDev}/api` : 'http://localhost:5000/api');

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
