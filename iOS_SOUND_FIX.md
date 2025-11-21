# iOS Notification Sound Fix

## The Issue

Custom notification sounds (like the Azan) were not working on iOS devices. This is because iOS requires notification sound files to be located in the root of the application bundle, not just in the JavaScript assets folder.

## The Fix

We have implemented a custom Expo Config Plugin (`app.plugin.js`) that automatically handles this during the build process.

### Changes Made:

1.  **Updated `app.plugin.js`**:

    - Now acts as a build-time hook.
    - Copies `azan.wav` and `beep.wav` from `assets/sounds/` to the native iOS project folder.
    - Links these files in the Xcode project configuration so they are included in the final app bundle.

2.  **Updated `app.json`**:
    - Registered the new plugin so it runs automatically during prebuild/build.

## How to Apply

Since this involves native code changes (bundling resources), you **must rebuild your native app**.

### For Local Development:

1.  Stop your development server.
2.  Run prebuild to regenerate native projects:
    ```bash
    npx expo prebuild --clean
    ```
3.  Run your app again:
    ```bash
    npx expo run:ios
    ```

### For EAS Build:

Simply create a new build. The plugin will run automatically.

```bash
eas build --platform ios
```

## Verification

After rebuilding:

1.  Go to **Settings**.
2.  Ensure **Use Azan Sound** is enabled.
3.  Tap **Test Notification**.
4.  You should now hear the Azan sound on your iPhone.
