# Widget Theme Update: Midnight & Huge Circle

## Overview

The widget has been redesigned to match the "Midnight" theme (Dark Blue & Gold) and features a new layout where all details are contained within a large circular progress bar.

## Changes

### 1. Theme Colors (Midnight)

- **File**: `android/app/src/main/res/values/colors.xml`
- **New Colors**:
  - `midnight_background`: #0E1317 (Dark Blue)
  - `midnight_text_primary`: #FAF6EE (Off-white)
  - `midnight_text_secondary`: #E1D6C7 (Beige)
  - `midnight_accent_gold`: #F0D661 (Gold)
  - `midnight_progress_background`: #223039 (Dark Grey/Blue)

### 2. Layout Redesign (Huge Circle)

- **File**: `android/app/src/main/res/layout/widget_prayer_times.xml`
- **Design**:
  - **Root**: Dark Blue background (`midnight_background`).
  - **Center**: A large circular progress bar (`widget_progress_bar`) that fills the widget.
  - **Inside Circle**:
    - **Top**: Prayer Name (e.g., "FAJR") in Beige.
    - **Middle**: Countdown (e.g., "-02:45") in Large Off-white.
    - **Bottom**: Prayer Time (e.g., "05:30 AM") in Gold.

### 3. Drawable Updates

- **File**: `android/app/src/main/res/drawable/circular_progress.xml`
- **Update**: Now uses `midnight_accent_gold` for the progress and `midnight_progress_background` for the track.
- **File**: `android/app/src/main/res/drawable/widget_background.xml`
- **Update**: Now uses `midnight_background`.

### 4. Logic Updates

- **File**: `android/app/src/main/java/com/yourcompany/prayertimes/PrayerWidget.kt`
- **Update**: Removed "Next: " prefix from the prayer name to save space and look cleaner inside the circle.

## How to Apply

1.  **Rebuild the Android App**:
    ```bash
    cd android
    ./gradlew assembleRelease
    ```
2.  **Re-install**:
    - Install the new APK/AAB.
    - Update/Replace the widget on your home screen.
