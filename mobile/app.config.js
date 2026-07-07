// app.config.js — replaces app.json so env vars can be read at build/start time
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  `https://${process.env.REPLIT_DEV_DOMAIN}/api`;

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
