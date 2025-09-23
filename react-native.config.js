// Disable Android autolinking for react-native-iap (Android uses external links only)
module.exports = {
  dependencies: {
    'react-native-iap': {
      platforms: {
        android: null,
      },
    },
  },
};
