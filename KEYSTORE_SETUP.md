# 🔐 Keystore Setup Guide

This guide explains how to set up the Android keystore for building release APKs/AABs.

## ⚠️ Important: Never Commit These Files!

The following files contain sensitive credentials and should **NEVER** be committed to Git:

- `android/keystore.properties` - Contains keystore passwords
- `android/app/upload-keystore.jks` - The actual keystore file
- `@aadiln__prayer-times-keystore.bak.jks` - Backup keystore
- `@aadiln__prayer-times-keystore-credentials.md` - Credentials file

These files are already in `.gitignore`.

## Setup Instructions

### 1. Copy Keystore File

Copy your keystore file to:

```
android/app/upload-keystore.jks
```

### 2. Create keystore.properties

Copy the example file and fill in your credentials:

```bash
# Copy the example file
cp android/keystore.properties.example android/keystore.properties

# Then edit android/keystore.properties with your actual values
```

Or create `android/keystore.properties` manually with this content:

```properties
MYAPP_UPLOAD_STORE_FILE=upload-keystore.jks
MYAPP_UPLOAD_KEY_ALIAS=your_key_alias_here
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password_here
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password_here
```

**Replace the placeholder values with your actual credentials!**

### 3. Verify Setup

To verify the keystore is correctly configured:

```bash
cd android
./gradlew assembleRelease
```

The APK should be created at:

```
android/app/build/outputs/apk/release/app-release.apk
```

For AAB (Google Play):

```bash
cd android
./gradlew bundleRelease
```

The AAB will be at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

## Keystore Details

### Expected SHA1 Fingerprint

```
SHA1: DF:B0:71:25:34:B6:F0:F9:48:4B:98:33:93:38:04:93:FC:93:DD:5F
```

This is the fingerprint registered with Google Play Console.

### Verify Your Keystore

To check the SHA1 fingerprint of your keystore:

**Windows (PowerShell):**

```powershell
& "C:\Program Files\Java\jdk-22\bin\keytool.exe" -list -v -keystore android/app/upload-keystore.jks -storepass YOUR_STORE_PASSWORD | Select-String "SHA1"
```

**macOS/Linux:**

```bash
keytool -list -v -keystore android/app/upload-keystore.jks -storepass YOUR_STORE_PASSWORD | grep SHA1
```

The output should match the expected SHA1 above.

## Security Best Practices

### For Team Members

1. **Store keystore securely**:

   - Use a password manager (1Password, LastPass, Bitwarden)
   - Or use your organization's secret management system

2. **Share credentials securely**:

   - Never via email or Slack
   - Use encrypted channels (1Password shared vaults, etc.)

3. **Backup the keystore**:
   - Keep multiple secure backups
   - If you lose the keystore, you cannot update the app on Play Store!

### For CI/CD (GitHub Actions, etc.)

Store credentials as repository secrets:

- `ANDROID_KEYSTORE_BASE64` - Base64 encoded keystore file
- `ANDROID_STORE_PASSWORD` - Store password
- `ANDROID_KEY_ALIAS` - Key alias
- `ANDROID_KEY_PASSWORD` - Key password

## Troubleshooting

### "signingConfig release is null"

- Make sure `android/keystore.properties` exists
- Verify the file paths and passwords are correct

### "keystore not found"

- Check that `upload-keystore.jks` is in `android/app/`
- Verify the filename matches what's in `keystore.properties`

### "Wrong password or corrupted keystore"

- Double-check passwords in `keystore.properties`
- Try verifying with keytool (command above)

### "SHA1 fingerprint doesn't match"

- You're using the wrong keystore file
- Find the original keystore or reset upload key in Play Console

## Questions?

If you need to:

- Reset the upload key → Go to Google Play Console → App Integrity
- Generate a new app signing key → You'll need to publish as a new app
- Recover lost keystore → Not possible - must reset upload key (if using Google Play App Signing)
