// Disable Android autolinking for react-native-iap (RevenueCat handles Android billing directly)
module.exports = {
  dependencies: {
    'react-native-iap': {
      platforms: {
        android: null,
      },
    },
  },
};
