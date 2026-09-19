const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Stabilise la résolution des packages ESM (@react-navigation) sous Windows/Metro
config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts = [...new Set([...config.resolver.sourceExts, 'mjs', 'cjs'])];

module.exports = config;
