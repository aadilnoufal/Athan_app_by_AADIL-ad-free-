# Finding Your Upload Keystore

## The Problem

Your app is expecting to be signed with:

```
SHA1: DF:B0:71:25:34:B6:F0:F9:48:4B:98:33:93:38:04:93:FC:93:DD:5F
```

But you're currently signing with the debug keystore:

```
SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

## Where to Find Your Keystore

### 1. Search Your Computer

Look for files with these extensions:

- `*.keystore`
- `*.jks`
- `upload-keystore.keystore`
- `release.keystore`
- `my-release-key.keystore`

Common locations:

- `C:\Users\[YourName]\Downloads\`
- `C:\Users\[YourName]\Desktop\`
- `C:\Users\[YourName]\Documents\`
- Previous versions of this project
- Cloud storage (Google Drive, Dropbox, OneDrive)

### 2. Check Google Play Console

**Go to:** [Google Play Console](https://play.google.com/console/) → Your App → Setup → App Integrity

#### If You're Using Google Play App Signing:

✅ **GOOD NEWS!** You can reset your upload key

1. In "App Integrity" section, look for "Upload key certificate"
2. Click "Request upload key reset"
3. Follow instructions to generate a new upload keystore
4. Google will provide a new certificate - download it
5. You can then use the new keystore for future uploads

#### If You're NOT Using Google Play App Signing:

⚠️ **You MUST find the original keystore** - there's no way to reset it

Without the original keystore, you cannot update your app. You would have to:

1. Publish a completely new app with a new package name
2. Migrate users manually

## Once You Find the Keystore

### Update build.gradle

You need to configure the release signing in `android/app/build.gradle`:

```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        storeFile file('upload-keystore.keystore')  // Your keystore filename
        storePassword 'YOUR_KEYSTORE_PASSWORD'
        keyAlias 'upload'  // Your key alias
        keyPassword 'YOUR_KEY_PASSWORD'
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release  // Use release config!
        // ... rest of release config
    }
}
```

### Secure Storage of Credentials

**DON'T put passwords directly in build.gradle!**

Instead, create `android/gradle.properties` (add to .gitignore):

```properties
MYAPP_UPLOAD_STORE_FILE=upload-keystore.keystore
MYAPP_UPLOAD_KEY_ALIAS=upload
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

Then in `build.gradle`:

```gradle
signingConfigs {
    release {
        if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
}
```

## Next Steps

1. ✅ Find your original keystore file (or reset upload key in Play Console)
2. ✅ Copy keystore to `android/app/` directory
3. ✅ Update `build.gradle` signing configuration
4. ✅ Store passwords in `gradle.properties` (NOT in git!)
5. ✅ Rebuild: `cd android; ./gradlew bundleRelease; cd ..`
6. ✅ Upload to Play Console

## Password Recovery

If you have the keystore but forgot the password:

- ❌ There is **NO WAY** to recover a lost keystore password
- You must use the "Reset Upload Key" option in Play Console (if using Google Play App Signing)
- Or contact Google Play support for assistance
