# Widget Logic Update: Rounding & Formatting

## Issues Fixed

1.  **Rounding**: The widget was rounding up the remaining time (e.g., 1m 20s -> 2m). It now rounds down (e.g., 1m 20s -> 1m) by accounting for the seconds passed in the current minute.
2.  **Negative Sign**: The widget displayed time as negative (e.g., "-02:45"). It now displays positive time (e.g., "02:45").

## Changes

- **File**: `android/app/src/main/java/com/yourcompany/prayertimes/PrayerTimeRepository.kt`
- **Logic**:
  - Added check for `now.get(Calendar.SECOND) > 0`. If true, subtract 1 minute from the remaining time difference.
  - Removed the `-` prefix from `String.format` for `timeRemaining`.
  - Applied changes to both `getTodaysPrayers` (for 4x2 widget) and `getNextPrayer` (for 2x2 widget).

## Next Steps

1.  **Rebuild**:
    ```bash
    cd android
    ./gradlew assembleRelease
    ```
2.  **Re-install**:
    - Install the new APK.
    - Verify the countdown is positive and rounds down correctly.
