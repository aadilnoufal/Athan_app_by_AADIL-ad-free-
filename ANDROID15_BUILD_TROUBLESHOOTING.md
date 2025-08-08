# Android 15 Build Troubleshooting Guide

## ENOENT: no such file or directory, open '/home/expo/workingdir/build/android/gradlew'

This error occurs because EAS Build is looking for the Gradle wrapper in the wrong location. Here are the solutions:

### Solution 1: Use EAS Build (Recommended) ✅

The updated build scripts now use EAS Build which handles Android builds in the cloud:

**Windows (PowerShell):**

```powershell
.\build-android15.ps1
```

**Linux/macOS (Bash):**

```bash
./build-android15.sh
```

### Solution 2: Manual Steps

If you prefer to run commands manually:

1. **Clean and install:**

   ```bash
   npm install
   npx expo install --fix
   ```

2. **Prebuild Android project:**

   ```bash
   npx expo prebuild --platform android --clean
   ```

3. **Build with EAS:**
   ```bash
   eas build --platform android --profile development
   eas build --platform android --profile production
   ```

### Solution 3: Local Build (Advanced)

For local Android builds (requires Android SDK):

1. **Ensure Android SDK is installed**
2. **Make gradlew executable:**
   ```bash
   chmod +x android/gradlew
   ```
3. **Build locally:**
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

## Key Improvements Made

### 1. app.json Configuration ✅

- Added Android 15 specific settings
- Proper SDK versions (compileSdk: 35, targetSdk: 35, minSdk: 24)
- Battery optimization permission added
- Edge-to-edge display support

### 2. eas.json Configuration ✅

- Specific Gradle commands for each build type
- Proper build profiles for development and production
- Non-interactive builds to prevent hanging

### 3. Build Scripts Enhanced ✅

- Better error handling
- EAS login verification
- Proper cache cleaning
- Gradle wrapper verification
- Detailed build status information

## Build Profiles

### Development Profile

- Creates APK for testing
- Includes development client
- Internal distribution

### Production Profile

- Creates AAB (App Bundle) for Play Store
- Optimized for release
- Auto-increment version code

## Testing on Android 15

After building, test these features:

1. ✅ Notifications and sounds
2. ✅ Battery optimization exemption
3. ✅ Location permissions
4. ✅ Edge-to-edge display
5. ✅ Background services

## Common Issues

### Build Fails with Permission Error

```bash
eas login
```

### Gradle Wrapper Missing

The prebuild command will regenerate it:

```bash
npx expo prebuild --platform android --clean
```

### Cache Issues

Clear all caches:

```bash
npx expo run:android --clear-cache
rm -rf node_modules/.cache
rm -rf .expo
```

## Next Steps

1. Run `eas build:list` to check build status
2. Download APK/AAB from EAS dashboard
3. Test on Android 15 devices
4. Submit to Play Console
