# Android Widget Implementation

We have implemented a native Android widget for Prayer Times with a countdown feature.

## Files Created

1.  **Data Source:** `android/app/src/main/res/raw/prayer_times.csv`

    - Contains the prayer times data (DD-MM format) directly in the Android resources for fail-proof access.

2.  **Layout:** `android/app/src/main/res/layout/widget_prayer_times.xml`

    - Displays Next Prayer Name, Time, and Countdown.

3.  **Widget Info:** `android/app/src/main/res/xml/prayer_widget_info.xml`

    - Configures the widget (min size, update period).

4.  **Logic (Kotlin):**

    - `android/app/src/main/java/com/yourcompany/prayertimes/PrayerTimeRepository.kt`: Handles parsing the CSV and calculating the next prayer time.
    - `android/app/src/main/java/com/yourcompany/prayertimes/PrayerWidget.kt`: The Widget Provider. It uses `AlarmManager` to schedule updates every minute for the countdown.

5.  **Manifest:** `android/app/src/main/AndroidManifest.xml`
    - Registered the `PrayerWidget` receiver.

## How it Works

- The widget reads the `prayer_times.csv` file directly.
- It calculates the next prayer based on the current device time.
- It schedules an exact alarm to update itself every minute to refresh the countdown.
- It works completely independently of the React Native JS bundle, ensuring it runs even if the app is closed or killed.

## Next Steps

1.  **Build:** Run `npx expo run:android` or build the android project via Android Studio to see the widget.
2.  **Test:** Add the widget to your home screen. Verify the countdown updates every minute.
