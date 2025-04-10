const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Ensure mp3 files are included in the asset resolver
defaultConfig.resolver.assetExts.push('mp3');

module.exports = defaultConfig;
