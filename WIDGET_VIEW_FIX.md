# Widget Fix: Replaced View with ImageView

## Issue

The "Couldn't add widget" error persists.
The likely cause is the use of `<View>` in the RemoteViews layout. `RemoteViews` does not support the generic `View` class; it only supports specific widgets like `ImageView`, `TextView`, etc.

## Fix

- **File**: `android/app/src/main/res/layout/widget_prayer_times_4x2.xml`
- **Change**: Replaced the `<View>` used for the separator line with an `<ImageView>`.
  - `ImageView` is supported by RemoteViews.
  - It can still render a background color to act as a separator.

## Next Steps

1.  **Rebuild**:
    ```bash
    cd android
    ./gradlew assembleRelease
    ```
2.  **Re-install**:
    - Install the new APK.
    - Try adding the 4x2 widget again.
