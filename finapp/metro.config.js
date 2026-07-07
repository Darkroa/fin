const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Include 'web' so Metro resolves .web.tsx/.web.ts files before .tsx/.ts
config.resolver.platforms = ['web', 'ios', 'android', 'native'];

module.exports = config;
