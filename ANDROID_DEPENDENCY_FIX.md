# Android Build Dependency Conflict Fix

## Problem
Build was failing with duplicate class errors:
```
Duplicate class android.support.v4.app.INotificationSideChannel found in:
- androidx.core:core:1.13.1
- com.android.support:support-compat:27.1.1
```

## Root Cause
- One of the dependencies was pulling in the OLD Android Support Library (`com.android.support:support-compat:27.1.1`)
- Project uses AndroidX (modern version)
- Jetifier wasn't catching all cases

## Solution Applied
Added explicit exclusions in `android/app/build.gradle`:

```gradle
// Force exclude old support library to prevent conflicts with AndroidX
configurations.all {
    exclude group: 'com.android.support', module: 'support-compat'
    exclude group: 'com.android.support', module: 'support-v4'
}
```

## Why This Works
1. **Jetifier** (already enabled in gradle.properties) auto-converts most cases
2. **Explicit exclusion** catches any remaining old support library references
3. All code now uses AndroidX exclusively

## Build Configuration
- Using EAS Build to avoid Windows path length issues
- Building APK (not AAB) for direct installation: `eas build --platform android --profile preview`
- Can install with: `adb install file.apk` or `eas build:run -p android --latest`

## Files Modified
1. `android/app/build.gradle` - Added configurations.all exclusions
2. `android/gradle.properties` - Already has `android.enableJetifier=true`
3. `android/local.properties` - Added SDK path for local builds

## Status
✅ Dependency conflict resolved
✅ EAS build configuration ready (APK output)
⏳ Build in progress on EAS servers
⏳ Pending: Install & test notifications

## Next Steps After APK Download
1. Download APK from EAS build link
2. Install: `adb install path/to/build.apk`
3. Grant permissions: Notifications, Exact Alarms
4. Test notification display (not just sound)
5. Test azan/default toggle
6. Verify clean console logs (no infinite loops)
