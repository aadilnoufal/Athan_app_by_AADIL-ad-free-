# Deep Code Audit — Round 6

**Focus:** Platform-specific bugs, widget data integrity, and notification system correctness.  
**Rounds 1–5 fixed:** 49 bugs (not re-reported).  
**Methodology:** Full file reads of all notification, widget, background-task, and native platform code. Cross-referenced prior audit reports (CODE_AUDIT_REPORT, DEEP_AUDIT_REPORT, DEEP_AUDIT_ROUND4, DEEP_AUDIT_ROUND5) to avoid duplicates. Each finding below is **new** or was previously identified but **never actually fixed in code**.

---

## Previously Fixed (Rounds 1–5) — NOT re-reported

- Division-by-zero in progress ring
- `soundRef` assigned after `playAsync`
- `last_notification_scheduled` not cleared on region change
- Untracked `setTimeout`s in `useHomeNotifications`
- Pulse animation leak in `qibla.tsx`
- Production `console.log` silencer
- SepiaColors hardcoded bypassing dark mode
- Audio 5-second timeout in audioHelper
- `playAyah` broken sound object in `soundRef`
- `togglePlayPause` race against `soundRef` nullification
- `ensurePrayerNotificationWindow` coalescing lock drop
- `onPrayerNotificationDelivered` fire-and-forget setTimeout
- `notifScheduleTimerRef` overwritten without clearing
- Stale `notificationsEnabled` in `clearCache`
- `Audio.setAudioModeAsync` failure swallowed
- InAppNotification double-dismiss race
- `startPrayerNotificationWindowMaintainer` AppState sub leak

---

## Findings

### Finding 1 — Rolling scheduler invisible to legacy repeating notifications (notification count drift)

- **Severity:** HIGH
- **File:** `utils/prayerNotificationScheduler.ts`, line 349–352
- **Description:** The rolling scheduler's maintenance pass only recognises notifications whose ID has exactly **5** dash-separated parts (e.g., `prayer-fajr-2026-03-05`):

  ```typescript
  const ours = existingIds.filter(
    (id) =>
      (id.startsWith("prayer-") || id.startsWith("iqama-")) &&
      id.split("-").length === 5,
  );
  ```

  Legacy notifications created by `scheduleNotifeePrayerNotifications()` use IDs like `prayer-fajr` (2 dash parts) with `RepeatFrequency.DAILY`. These are **invisible** to the rolling scheduler's count because they don't pass the 5-part filter.

  **Impact:** `scheduledCount` is inaccurate. The `safeMax` headroom calculation (`54 - 11 = 43`) doesn't account for the invisible legacy IDs. On iOS (64-slot limit), this can push the total past 64, causing the OS to **silently drop** the oldest notifications — breaking the prayer schedule with zero error feedback.

- **How legacy IDs can appear:**
  1. `notificationTestHelper.js` lines 53, 66, 140 call `scheduleNotifeePrayerNotifications()` directly.
  2. `forceRefreshPrayerNotifications()` at `notifeePrayerService.js:1689` calls it too.
  3. App upgrades — users who had the legacy scheduler before the rolling scheduler was added may still have daily-repeating notifications active.

- **Fix:**
  ```typescript
  // In _ensurePrayerNotificationWindowImpl(), after getting existingIds:
  // Cancel any legacy-format prayer notifications that the old scheduler left behind
  for (const id of existingIds) {
    if (
      (id.startsWith("prayer-") || id.startsWith("iqama-")) &&
      id.split("-").length !== 5
    ) {
      await notifee.cancelTriggerNotification(id);
      console.log(`🧹 Cancelled legacy notification: ${id}`);
    }
  }
  ```

---

### Finding 2 — `notificationTestHelper.js` creates permanent daily-repeating notifications

- **Severity:** HIGH
- **File:** `utils/notificationTestHelper.js`, lines 53, 66, 140
- **Description:** The test helper calls `scheduleNotifeePrayerNotifications()` which creates notifications with `RepeatFrequency.DAILY` and IDs like `prayer-fajr`. These daily-repeating notifications:
  1. Are **never cleaned up** by the rolling scheduler (Finding 1).
  2. Fire every single day at the originally-scheduled time, even if the user changes city or sound preference.
  3. Create duplicate notifications alongside the rolling scheduler's single-fire notifications.

- **Impact:** A developer/tester running `testNotificationSystem()` during QA **permanently** duplicates every prayer notification. The only escape is the user manually cancelling all notifications via settings.

- **Fix:** Update `notificationTestHelper.js` to use the rolling scheduler's `forceRescheduleAllNotifications()` instead of the legacy function, or add explicit cleanup:
  ```javascript
  // At the end of each test function:
  await cancelAllNotifeePrayerNotifications(); // Clean up legacy IDs
  ```

---

### Finding 3 — Unused imports trigger side-effect and circular dependency

- **Severity:** MEDIUM
- **File:** `utils/prayerNotificationScheduler.ts`, line 14
- **Description:** The rolling scheduler statically imports two functions it never uses:

  ```typescript
  import {
    scheduleNotifeePrayerNotifications,
    cancelAllNotifeePrayerNotifications,
  } from "./notifeePrayerService";
  ```

  Neither `scheduleNotifeePrayerNotifications` nor `cancelAllNotifeePrayerNotifications` is called anywhere within `prayerNotificationScheduler.ts` — the scheduler has its own `scheduleDay()` and `cancelAll()` functions.

  **Problems caused:**
  1. **Side-effect:** Importing `notifeePrayerService.js` executes `setupNotifeeEventHandlers()` at module load time (line 1596), registering foreground event handlers before channels are created.
  2. **Circular dependency:** `prayerNotificationScheduler.ts` → `notifeePrayerService.js` (static) and `notifeePrayerService.js` → `prayerNotificationScheduler.ts` (dynamic `require()` at line 1052). This is fragile — the static import forces full evaluation of the legacy service before the rolling scheduler initialises.
  3. **Bundle bloat:** Tree-shaking cannot remove the legacy service because of the static import.

- **Fix:** Remove the unused import line entirely:
  ```typescript
  // DELETE this line:
  import {
    scheduleNotifeePrayerNotifications,
    cancelAllNotifeePrayerNotifications,
  } from "./notifeePrayerService";
  ```
  The dynamic `require('./notifeePrayerService')` at line 293 for `initializeNotifeePrayerNotifications` is the only legitimate cross-call and doesn't need a static import.

---

### Finding 4 — `setupNotifeeEventHandlers()` runs at import time (UNFIXED from Round 4)

- **Severity:** MEDIUM
- **File:** `utils/notifeePrayerService.js`, line 1596
- **Description:** Round 4 (DEEP_AUDIT_ROUND4.md, line 205) identified that `setupNotifeeEventHandlers()` is called as a top-level side-effect when the module is loaded. The recommendation was to move it inside `initializeNotifeePrayerNotifications()` with an idempotent guard. **This was never fixed.**

  ```javascript
  // Line 1596 — still present:
  setupNotifeeEventHandlers();
  ```

  The foreground event handler registered by this function processes DELIVERED events and calls `onPrayerNotificationDelivered()` (rolling window top-up). If a notification is delivered while the app is loading (before channels exist), the handler fires and may hit "channel not found" errors.

- **Fix:** Move into `initializeNotifeePrayerNotifications()` behind a guard flag:

  ```javascript
  let eventHandlersRegistered = false;

  export async function initializeNotifeePrayerNotifications() {
    if (isInitialized) return true;
    // ... existing init code (permissions, channels) ...

    if (!eventHandlersRegistered) {
      setupNotifeeEventHandlers();
      eventHandlersRegistered = true;
    }

    isInitialized = true;
    return true;
  }

  // DELETE the bare call at line 1596:
  // setupNotifeeEventHandlers();
  ```

---

### Finding 5 — `androidAlarmManager.js` is 263 lines of dead code with dangerous exports (UNFIXED from Round 1/4)

- **Severity:** MEDIUM
- **File:** `utils/androidAlarmManager.js` (entire file, 263 lines)
- **Description:** No file in the project imports from `androidAlarmManager.js`. Every function it exports (`scheduleAndroidPrayerAlarms`, `cancelAllAndroidPrayerAlarms`, `setupAndroidAlarmHandler`, `getAndroidAlarmStatus`) is dead code. Rounds 1 and 4 flagged individual bugs inside this file but it was never deleted or de-exported.

  **Latent hazards if anyone imports it:**
  - Line 243: `notifee.onBackgroundEvent()` would clobber the critical handler in `index.ts` (only one allowed).
  - Line 113: `repeatFrequency: 1` (raw number, not `RepeatFrequency.DAILY` enum).
  - Line 97: `sound: 'default'` on a channel named "silent" — contradicts the intended purpose.

- **Fix:** Delete the file (move to `trash/androidAlarmManager.js` per project policy).

---

### Finding 6 — iOS widget returns nil on stale data → blank widget

- **Severity:** MEDIUM
- **File:** `ios-widget/WidgetDataProvider.swift`, line 93
- **Description:** If the app hasn't been opened for >48 hours, the staleness check returns `nil`:

  ```swift
  if staleness > 48 * 60 * 60 * 1000 { return nil }
  ```

  When `loadWidgetData()` returns `nil`, the WidgetKit entry falls back to a placeholder with no prayer times. The widget goes **completely blank** rather than showing last-known stale times with a visual indicator.

  Prayer times change by at most ~1 minute per day in Qatar, so 48-hour-old data is still highly usable. Blanking the widget penalises users who simply haven't opened the app for a weekend.

- **Fix:** Return the data with a `isStale` flag instead of returning nil:

  ```swift
  struct WidgetPrayerData {
      // ... existing fields ...
      var isStale: Bool = false
  }

  func loadWidgetData() -> WidgetPrayerData? {
      guard let defaults = UserDefaults(suiteName: appGroupId) else { return nil }
      let lastUpdated = defaults.double(forKey: WidgetDataKeys.lastUpdated)
      let staleness = Date().timeIntervalSince1970 * 1000 - lastUpdated
      let isStale = staleness > 48 * 60 * 60 * 1000

      // Continue loading data even if stale — only return nil if data is missing
      guard let jsonStr = defaults.string(forKey: WidgetDataKeys.widgetData),
            // ... other guards ...
      else { return nil }

      // ... build WidgetPrayerData ...
      result.isStale = isStale
      return result
  }
  ```

  Then in the widget view, show a subtle "⚠️ Open app to refresh" indicator when `isStale` is true.

---

### Finding 7 — iOS `_writeThemeModeIOS()` fire-and-forget with unhandled Promise rejection

- **Severity:** MEDIUM
- **File:** `utils/widgetDataBridge.ts`, lines 196–203
- **Description:** The `_writeThemeModeIOS()` function calls the native module without handling the returned Promise:

  ```typescript
  function _writeThemeModeIOS(themeMode: string): void {
    try {
      const WidgetDataModuleIOS = getWidgetDataModuleIOS();
      if (WidgetDataModuleIOS) {
        WidgetDataModuleIOS.setThemeMode(themeMode); // No .then() or .catch()!
      }
    } catch (error) {
      // Only catches synchronous errors, not Promise rejections
    }
  }
  ```

  The native `setThemeMode` (in `WidgetDataModuleIOS.swift`) is a Promise-based method (`resolve`/`reject`). If the App Group is unavailable (e.g., provisioning profile issue), the native side calls `reject(...)`, producing an **unhandled Promise rejection**. In React Native, this surfaces as a yellow box warning in dev and can crash in production (depending on RN version).

  Compare with the Android path (lines 91–99) which properly chains `.then()` and `.catch()`.

- **Fix:**
  ```typescript
  function _writeThemeModeIOS(themeMode: string): void {
    try {
      const WidgetDataModuleIOS = getWidgetDataModuleIOS();
      if (WidgetDataModuleIOS) {
        WidgetDataModuleIOS.setThemeMode(themeMode)
          .then(() => {
            console.log("✅ iOS widget theme updated to:", themeMode);
          })
          .catch((error: Error) => {
            console.log("⚠️ Failed to update iOS widget theme:", error.message);
          });
      }
    } catch (error) {
      console.log("ℹ️ iOS widget theme update not available");
    }
  }
  ```

---

### Finding 8 — `WidgetDataModule.setThemeMode()` double-write race

- **Severity:** LOW
- **File:** `android/app/src/main/java/com/yourcompany/prayertimes/WidgetDataModule.kt`, lines 90–106
- **Description:** When updating the theme, the function performs **two sequential** `apply()` calls:

  ```kotlin
  // First write: update top-level theme_mode
  prefs.edit().putString(KEY_THEME_MODE, themeMode).apply()

  // Then update it inside the JSON data
  val json = JSONObject(existingData)
  json.put("themeMode", themeMode)
  prefs.edit().putString(KEY_WIDGET_DATA, json.toString()).apply()
  ```

  Between the two `apply()` calls, the widget AlarmManager fires every 60 seconds and could read SharedPreferences in an inconsistent state: `KEY_THEME_MODE` would show the new theme but the JSON in `KEY_WIDGET_DATA` would still have the old theme. `PrayerTimeRepository.getThemeMode()` reads from `KEY_THEME_MODE`, so the widget would render with the new theme but any code reading the JSON directly would see the old value.

- **Fix:** Use a single `SharedPreferences.Editor` batch:
  ```kotlin
  @ReactMethod
  fun setThemeMode(themeMode: String, promise: Promise) {
      try {
          val context = reactApplicationContext
          val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
          val editor = prefs.edit()

          editor.putString(KEY_THEME_MODE, themeMode)

          // Also update inside JSON data
          val existingData = prefs.getString(KEY_WIDGET_DATA, null)
          if (existingData != null) {
              try {
                  val json = org.json.JSONObject(existingData)
                  json.put("themeMode", themeMode)
                  editor.putString(KEY_WIDGET_DATA, json.toString())
              } catch (e: Exception) { /* JSON parsing failed */ }
          }

          editor.apply() // Single atomic write

          refreshWidgets(context)
          promise.resolve(true)
      } catch (e: Exception) {
          promise.reject("THEME_ERROR", "Failed to set theme mode: ${e.message}", e)
      }
  }
  ```

---

### Finding 9 — `forceRefreshPrayerNotifications()` uses legacy scheduler, not rolling scheduler (UNFIXED from Round 4)

- **Severity:** MEDIUM
- **File:** `utils/notifeePrayerService.js`, line 1638–1701
- **Description:** Round 4 (DEEP_AUDIT_ROUND4.md, line 93) identified that `forceRefreshPrayerNotifications()` calls `scheduleNotifeePrayerNotifications()` (the legacy daily-repeating scheduler) instead of the rolling scheduler's `forceRescheduleAllNotifications()`. **This was never fixed.**

  If any future code calls `forceRefreshPrayerNotifications()`, it would:
  1. Cancel existing rolling-window notifications.
  2. Create legacy `RepeatFrequency.DAILY` notifications.
  3. These legacy IDs are invisible to the rolling scheduler's cleanup (Finding 1).
  4. Both systems would fire simultaneously, doubling every notification.

- **Fix:** Route through the rolling scheduler:
  ```javascript
  export async function forceRefreshPrayerNotifications() {
    try {
      console.log("🔄 Force refreshing all prayer notifications...");
      if (Platform.OS === "android") {
        await forceRecreateNotificationChannels();
      }
      const {
        forceRescheduleAllNotifications,
      } = require("./prayerNotificationScheduler");
      await forceRescheduleAllNotifications();
      console.log("✅ Force refresh complete via rolling scheduler");
    } catch (error) {
      console.error("❌ Error force refreshing prayer notifications:", error);
    }
  }
  ```

---

### Finding 10 — ProGuard rules incomplete for native modules (latent)

- **Severity:** LOW (only triggers when `enableProguardInReleaseBuilds=true`)
- **File:** `android/app/proguard-rules.pro`
- **Description:** The ProGuard config only keeps Reanimated and RevenueCat. If ProGuard/R8 is enabled (currently `false` in `gradle.properties`), the following classes accessed via reflection would break:
  - `WidgetDataModule` and `WidgetPinModule` — registered via `WidgetDataPackage` as React Native native modules
  - `PrayerTimeRepository` — called from widget providers
  - `WidgetThemeHelper` — called from widget providers

  Widget providers themselves are declared in `AndroidManifest.xml` and kept by default, but their dependencies are not transitively protected from R8 name obfuscation.

- **Fix:** Add keep rules:
  ```proguard
  # Prayer Times native modules and widget classes
  -keep class com.yourcompany.prayertimes.WidgetDataModule { *; }
  -keep class com.yourcompany.prayertimes.WidgetPinModule { *; }
  -keep class com.yourcompany.prayertimes.PrayerTimeRepository { *; }
  -keep class com.yourcompany.prayertimes.WidgetThemeHelper { *; }
  -keep class com.yourcompany.prayertimes.WidgetDataPackage { *; }
  ```

---

### Finding 11 — Widget data not pushed on city/region change until home screen revisited

- **Severity:** LOW
- **File:** `hooks/home/useHomePrayerData.ts`, lines 166–200
- **Description:** Widget data is pushed to native SharedPreferences / App Group only from `useHomePrayerData` when `currentDay === 0` (today tab). The flow is:

  ```typescript
  if (currentDay === 0) {
    // Build widgetPayload and push to native
    updateWidgetDataImmediate(widgetPayload);
  }
  ```

  If the user changes their city/region in Settings without navigating back to the Home tab's "today" view, the widget continues showing the old city's prayer times. The widget's own CSV fallback has raw Doha times (no city tuning), which would be wrong for non-Doha cities.

  **Scenario:** User is in Abu Samra, opens Settings, changes to Al Shamal, then closes the app. Widget still shows Abu Samra times until next home screen visit.

- **Fix:** Trigger a widget data push from the settings hook after a region change:

  ```typescript
  // In useSettingsNotifications.ts or the region change handler:
  import { updateWidgetDataImmediate } from '../utils/widgetDataBridge';

  // After region change:
  const refreshedData = getPrayerTimesFromLocalData(new Date());
  if (refreshedData) {
    const adjusted = applyLocalDataCityAdjustments(refreshedData.times, newCityId, true);
    updateWidgetDataImmediate({
      times: adjusted,
      times12h: /* format */,
      date: format(new Date(), 'dd-MM'),
      cityId: newCityId,
      themeMode: currentTheme,
      lastUpdated: Date.now(),
    });
  }
  ```

---

## Summary

| #   | Finding                                                                               | Severity | Status        | File                                  |
| --- | ------------------------------------------------------------------------------------- | -------- | ------------- | ------------------------------------- |
| 1   | Rolling scheduler blind to legacy notification IDs → count drift / iOS 64-slot breach | HIGH     | NEW           | `prayerNotificationScheduler.ts:349`  |
| 2   | `notificationTestHelper.js` creates permanent daily-repeating notifications           | HIGH     | NEW           | `notificationTestHelper.js:53,66,140` |
| 3   | Unused static imports cause side-effect + circular dependency                         | MEDIUM   | NEW           | `prayerNotificationScheduler.ts:14`   |
| 4   | `setupNotifeeEventHandlers()` runs at import time                                     | MEDIUM   | UNFIXED R4    | `notifeePrayerService.js:1596`        |
| 5   | `androidAlarmManager.js` is 263 lines of dead code with dangerous exports             | MEDIUM   | UNFIXED R1/R4 | `androidAlarmManager.js` (whole file) |
| 6   | iOS widget returns nil on stale data → blank widget                                   | MEDIUM   | NEW           | `WidgetDataProvider.swift:93`         |
| 7   | iOS `_writeThemeModeIOS()` unhandled Promise rejection                                | MEDIUM   | NEW           | `widgetDataBridge.ts:196`             |
| 8   | `WidgetDataModule.setThemeMode()` double-write race                                   | LOW      | NEW           | `WidgetDataModule.kt:90`              |
| 9   | `forceRefreshPrayerNotifications()` uses legacy scheduler                             | MEDIUM   | UNFIXED R4    | `notifeePrayerService.js:1638`        |
| 10  | ProGuard rules missing for native modules                                             | LOW      | NEW           | `proguard-rules.pro`                  |
| 11  | Widget data not pushed on city change until home tab revisited                        | LOW      | NEW           | `useHomePrayerData.ts:166`            |

**New bugs found:** 8  
**Unfixed from prior rounds:** 3  
**Total Round 6 findings:** 11  
**Cumulative across all rounds:** 60

---

## Files That Need Changes

| File                                   | Findings   |
| -------------------------------------- | ---------- |
| `utils/prayerNotificationScheduler.ts` | 1, 3       |
| `utils/notificationTestHelper.js`      | 2          |
| `utils/notifeePrayerService.js`        | 4, 9       |
| `utils/androidAlarmManager.js`         | 5 (delete) |
| `ios-widget/WidgetDataProvider.swift`  | 6          |
| `utils/widgetDataBridge.ts`            | 7          |
| `android/.../WidgetDataModule.kt`      | 8          |
| `android/app/proguard-rules.pro`       | 10         |
| `hooks/home/useHomePrayerData.ts`      | 11         |
