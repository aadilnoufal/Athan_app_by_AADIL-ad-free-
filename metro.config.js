const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Include both mp3 and wav files in the asset resolver
defaultConfig.resolver.assetExts.push('mp3', 'wav');

module.exports = defaultConfig;
