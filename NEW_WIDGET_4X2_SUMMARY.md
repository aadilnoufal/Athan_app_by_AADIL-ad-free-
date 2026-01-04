# New 4x2 Widget Created

## Overview

A new 4x2 widget has been added to the project. This widget displays all prayer times for the current day in a horizontal list, with the next prayer highlighted. It also features a bottom bar with the next prayer name and a countdown.

## Files Created/Modified

### 1. Layout

- **File**: `android/app/src/main/res/layout/widget_prayer_times_4x2.xml`
- **Description**: Defines the UI structure.
  - **Top**: Horizontal list of 6 prayers (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha).
  - **Bottom**: "Next Prayer: [Name] [Countdown]" separated by a thin line.
  - **Theme**: Uses the Midnight theme colors.

### 2. Widget Provider

- **File**: `android/app/src/main/java/com/yourcompany/prayertimes/PrayerWidget4x2.kt`
- **Description**: Handles widget updates.
  - Fetches today's prayers using `PrayerTimeRepository`.
  - Updates the text views for each prayer.
  - Highlights the _next_ prayer in Gold.
  - Updates the bottom countdown.
  - Schedules updates every minute.

### 3. Metadata

- **File**: `android/app/src/main/res/xml/prayer_widget_4x2_info.xml`
- **Description**: Defines widget properties (min size 4x2, resize mode, etc.).

### 4. Repository Update

- **File**: `android/app/src/main/java/com/yourcompany/prayertimes/PrayerTimeRepository.kt`
- **Description**: Added `getTodaysPrayers()` method to return the full list of prayers and the index of the next prayer.

### 5. Manifest

- **File**: `android/app/src/main/AndroidManifest.xml`
- **Description**: Registered the new `PrayerWidget4x2` receiver.

## How to Build & Test

1.  **Rebuild the Android App**:

    ```bash
    cd android
    ./gradlew assembleRelease
    ```

2.  **Install**:

    - Install the APK.
    - Go to your home screen widgets menu.
    - You should now see **two** widgets for your app:
      1.  The original 2x2 (Circular) widget.
      2.  The new 4x2 (List) widget.

3.  **Verify**:
    - Add the 4x2 widget.
    - Check that all 6 prayers are listed.
    - Check that the _next_ prayer is highlighted in Gold.
    - Check the bottom countdown.
