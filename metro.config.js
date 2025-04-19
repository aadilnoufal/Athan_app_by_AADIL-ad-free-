const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Ensure wav files are included in the asset resolver
defaultConfig.resolver.assetExts.push('waw');

module.exports = defaultConfig;
