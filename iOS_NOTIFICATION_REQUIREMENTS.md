# iOS Notification Requirements for Prayer App

## Sound File Requirements for iOS

### 1. File Format and Location

- **Format**: `.wav`, `.aiff`, or `.caf` files
- **Location**: Must be included in the iOS app bundle (not in assets folder)
- **Naming**: Use exact filename in notification configuration

### 2. Current Implementation

Your notification service is configured to use:

```javascript
sound: "azan.wav"; // For iOS
sound: "azan"; // For Android
```

### 3. Required Actions for iOS Build

#### Option 1: Add sound files to iOS bundle (Recommended)

1. Create `ios/YourApp/sounds/` directory
2. Add `azan.wav` file to this directory
3. Add the sound file to Xcode project bundle

#### Option 2: Use Expo asset system

1. Keep `azan.wav` in `assets/sounds/`
2. Configure `app.json` to include sound files:

```json
{
  "expo": {
    "assetBundlePatterns": ["assets/sounds/*.wav"]
  }
}
```

### 4. iOS-Specific Features Implemented

✅ **Notification Categories**: Equivalent to Android channels

```javascript
- 'prayer-category': For regular prayers
- 'fajr-category': Special category for Fajr
```

✅ **Critical Sounds**: For important prayer notifications

```javascript
criticalSound: {
  name: 'azan.wav',
  volume: 1.0,
  critical: true
}
```

✅ **Interruption Levels**: iOS 15+ feature

```javascript
interruptionLevel: "active"; // Ensures notification shows immediately
```

✅ **Badge Management**: App icon badge updates

```javascript
badge: 1; // Shows prayer notification count
```

### 5. iOS Limitations

❌ **No Custom Channels**: iOS uses categories instead
❌ **No Vibration Patterns**: iOS manages vibration automatically
❌ **No Battery Optimization Controls**: iOS manages this automatically
❌ **64 Notification Limit**: iOS allows max 64 scheduled notifications per app

### 6. Testing on iOS

1. **Simulator Testing**: Limited - sounds may not work properly
2. **Physical Device**: Required for proper notification testing
3. **Background Testing**: Test with app closed/backgrounded
4. **Sound Testing**: Ensure device is not on silent mode

### 7. iOS Build Configuration

For EAS builds, ensure your `eas.json` includes:

```json
{
  "build": {
    "production": {
      "ios": {
        "buildConfiguration": "Release",
        "bundleIdentifier": "your.bundle.id"
      }
    }
  }
}
```

### 8. Common iOS Issues and Solutions

#### Issue: Notifications not showing

- Check permission status in device Settings > [App] > Notifications
- Verify app is not in Do Not Disturb mode
- Check Focus/Sleep modes (iOS 15+)

#### Issue: Sound not playing

- Ensure sound file is in iOS bundle
- Check device volume and silent switch
- Verify file format is supported (.wav recommended)

#### Issue: Critical sounds not working

- Critical alerts require special permission
- May not work in all iOS versions
- Test on physical device

### 9. Debug Commands

Use these functions to debug iOS notifications:

```javascript
await debugNotifeeNotifications(); // Comprehensive debug info
await scheduleNotifeeTestNotification(); // Test notification
await getNotifeeServiceStatus(); // Check service status
```

### 10. Production Checklist

Before iOS release:

- [ ] Sound files included in iOS bundle
- [ ] Tested on physical iOS device
- [ ] Permissions properly requested
- [ ] Background notifications working
- [ ] Sound playing correctly
- [ ] Critical alerts working (if needed)
- [ ] Badge updates working
- [ ] Categories configured properly

## Summary

Your notification service is now fully compatible with iOS! The main differences from Android are:

- Uses notification categories instead of channels
- Sound files must be in iOS bundle format
- No manual battery optimization controls
- Different permission model
- 64 notification scheduling limit

The code will automatically detect the platform and use the appropriate configuration for each system.
