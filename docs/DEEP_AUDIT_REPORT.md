# Deep Line-by-Line Audit Report

**Date:** 2025-07-12 (updated 2025-07-13)  
**Auditor:** GitHub Copilot

This report contains findings from **two audit passes** covering the full codebase:

- **Part A** — 32 JS/TS source files (`index.ts`, `app/`, `utils/`, `lib/`, `widgets/`)
- **Part B** — 49 files across Android Kotlin (9), iOS Swift (6), Config/Constants/Translations (7), Contexts (5), Types (2), Plugin & Build Config (5), Tests (15)

> **Excluded:** The following 8 previously-fixed issues are intentionally NOT re-reported:
>
> 1. `prayerTimeTuner.js` parseInt NaN guard
> 2. `pushNotifications.ts` FCM token logging (wrapped in `__DEV__`)
> 3. `prayerNotificationScheduler.ts` ensureInFlight boolean (Promise-based lock)
> 4. `index.ts` default channel (created at top level)
> 5. `quranStorage.ts` deleteSurahAudio (actually deletes files)
> 6. `useHomePrayerData.ts` timer cleanups
> 7. `useHomeNotifications.ts` try/catch + shallow equality
> 8. `useSettingsNotifications.ts` individual JSON.parse

---

## Severity Legend

| Severity     | Meaning                                                     |
| ------------ | ----------------------------------------------------------- |
| **CRITICAL** | Will cause crashes, data loss, or silent incorrect behavior |
| **HIGH**     | Likely causes bugs, reliability issues, or security risk    |
| **MEDIUM**   | Performance, maintainability, or code-quality concern       |
| **LOW**      | Dead code, minor style, cleanup items                       |

---

## Summary

| Severity  | Part A | Part B | Total  |
| --------- | ------ | ------ | ------ |
| CRITICAL  | 3      | 0      | **3**  |
| HIGH      | 5      | 3      | **8**  |
| MEDIUM    | 6      | 6      | **12** |
| LOW       | 6      | 7      | **13** |
| **Total** | **20** | **16** | **36** |

---

# Part A — JS/TS Source Files (32 files)

## CRITICAL Findings

### C-1 — Hardcoded RevenueCat API keys in `app/_layout.tsx`

- **File:** `app/_layout.tsx`
- **Lines:** 178, 248
- **Category:** Security
- **Description:** RevenueCat API keys are embedded as hardcoded fallback strings:
  ```ts
  // Line 178
  const iosKey =
    publicIosKey || revenuecat?.iosApiKey || "appl_HlFMTQjuEPSpeLuaudMrIpsLqsf";
  // Line 248
  const androidKey =
    publicAndroidKey ||
    revenuecat?.androidApiKey ||
    "goog_dfuJwpbmzyvVmySItVuilefFYFM";
  ```
  While RevenueCat keys are "public" in that they ship in app bundles, hardcoding them as string literals in source means:
  - They appear in plain text in any static analysis or leaked source.
  - The fallback chain silently uses the hardcoded key even when `app.json` extra config was supposed to provide it, masking misconfigurations.
- **Impact:** Security exposure, misconfiguration goes undetected.
- **Fix:** Remove the hardcoded fallback. If neither env var nor `app.json` provides the key, log a clear error and skip SDK initialization. Keys should come exclusively from `app.json` `extra.revenuecat` or environment variables.

---

### C-2 — Missing `await` in `triggerBackgroundCheck()`

- **File:** `utils/backgroundTask.js`
- **Lines:** 76–78
- **Category:** Bug
- **Description:** `ensurePrayerNotificationWindow()` is called without `await`:
  ```js
  export async function triggerBackgroundCheck() {
    try {
      const {
        ensurePrayerNotificationWindow,
      } = require("./prayerNotificationScheduler");
      ensurePrayerNotificationWindow(); // ← not awaited
    } catch {}
  }
  ```
  The function is `async` so the returned Promise floats. Any error inside `ensurePrayerNotificationWindow()` will be an unhandled rejection, and since the `catch {}` is empty it wouldn't even be caught at the function level. The scheduler's Promise-based lock may also behave unexpectedly if the caller doesn't await completion.
- **Impact:** Silent failures in background notification window maintenance; potential unhandled promise rejections.
- **Fix:**
  ```js
  export async function triggerBackgroundCheck() {
    try {
      const {
        ensurePrayerNotificationWindow,
      } = require("./prayerNotificationScheduler");
      await ensurePrayerNotificationWindow();
    } catch (e) {
      console.log("triggerBackgroundCheck failed:", e?.message);
    }
  }
  ```

---

### C-3 — Qibla compass never applies magnetic declination correction

- **File:** `lib/qibla-compass/hooks/useQiblaCompass.ts` (integration), `lib/qibla-compass/utils/qiblaCalculations.ts` (function exists but unused)
- **Lines:** `useQiblaCompass.ts` L80-82, `qiblaCalculations.ts` L202-232
- **Category:** Bug
- **Description:** `calculateQiblaDirection()` returns a bearing from **true (geographic) north**. However, `compass.heading` from `useCompass` is derived from raw magnetometer data, which gives **magnetic north**. The difference — magnetic declination — is never subtracted from the heading.

  The function `estimateMagneticDeclination()` exists in `qiblaCalculations.ts` but is **never called** anywhere in the codebase. The rotation calculation is:

  ```ts
  // useQiblaCompass.ts line 87
  const qiblaRotation = useMemo(() => {
    return calculateQiblaRotation(compass.heading, qiblaDirection);
    //                           ^^^magnetic       ^^^geographic
  }, [compass.heading, qiblaDirection]);
  ```

  For Qatar (target market), magnetic declination is ~2-3°, tolerable. For users in North America or Europe, declination can exceed 15°, causing noticeably wrong Qibla direction.

- **Impact:** Qibla direction inaccurate by up to 20+ degrees for users in areas with high magnetic declination.
- **Fix:** Apply declination correction in `useQiblaCompass.ts`:

  ```ts
  const declination = useMemo(() => {
    if (!location) return 0;
    return estimateMagneticDeclination(location.latitude, location.longitude);
  }, [location]);

  const trueHeading = useMemo(() => {
    return normalizeAngle(compass.heading + declination);
  }, [compass.heading, declination]);
  ```

  Then use `trueHeading` in `calculateQiblaRotation` and `isFacingQibla`. Ideally, replace the rough linear model with a proper WMM lookup for ±0.5° accuracy.

---

## HIGH Findings

### H-1 — `androidAlarmManager.js` registers conflicting `onBackgroundEvent`

- **File:** `utils/androidAlarmManager.js`
- **Lines:** 244–262
- **Category:** Bug (latent)
- **Description:** `setupAndroidAlarmHandler()` calls `notifee.onBackgroundEvent(...)`, which would override the critical handler registered in `index.ts` line 52. Notifee permits only **one** background event handler — the last registered one wins. If this function is ever called (it's exported but currently unused), it would silently break the rolling-window top-up logic in `index.ts`.
- **Impact:** If called, prayer notification rolling window stops working. Currently latent because the function is never invoked.
- **Fix:** Remove the `notifee.onBackgroundEvent` registration from this function entirely. The comment in `notifeePrayerService.js` L1063 already correctly says "DO NOT register onBackgroundEvent here as it will overwrite the top-level handler" — the same rule applies here.

---

### H-2 — Side effect at module import: `setupNotifeeEventHandlers()` auto-runs

- **File:** `utils/notifeePrayerService.js`
- **Line:** 1596
- **Category:** Bug / Design
- **Description:** `setupNotifeeEventHandlers()` is called unconditionally at the module's top level:
  ```js
  // Line 1596
  setupNotifeeEventHandlers();
  ```
  Any code that `import`s or `require`s from this file — even for a single function — triggers foreground event listener registration as a side effect. This can cause:
  - Duplicate listener registration if multiple modules import this file at different times.
  - Foreground handler running before Notifee SDK is fully initialized.
  - Testing difficulties (importing the module in unit tests triggers real Notifee calls).
- **Fix:** Remove the auto-call. Instead, call `setupNotifeeEventHandlers()` explicitly from `initializeNotifeePrayerNotifications()` with an idempotent guard.

---

### H-3 — Audio cleanup uses fixed 5000ms timeout instead of playback completion

- **File:** `utils/audioHelper.js`
- **Lines:** 103–108
- **Category:** Performance / Bug
- **Description:** After `sound.playAsync()`, cleanup is scheduled via `setTimeout(5000)`:
  ```js
  setTimeout(async () => {
    try {
      await sound.unloadAsync();
    } catch (e) { ... }
  }, 5000);
  ```
  If the azan sound is longer than 5 seconds (azan tracks are typically 1-4 minutes), the sound object is unloaded mid-playback, cutting off audio. If beep is shorter than 5 seconds, the `Audio.Sound` object leaks for unnecessary time.
- **Impact:** Azan playback cut off after 5 seconds; Sound objects held longer than needed for beep.
- **Fix:** Use the `onPlaybackStatusUpdate` callback:
  ```js
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.didJustFinish) {
      sound.unloadAsync().catch(() => {});
    }
  });
  ```

---

### H-4 — Magic numbers for EventType in `_layout.tsx`

- **File:** `app/_layout.tsx`
- **Lines:** 337–339
- **Category:** Bug (fragile)
- **Description:** Notifee `EventType` enum values are referenced as raw numbers:
  ```tsx
  if (type === 1) { // EventType.PRESS
  } else if (type === 0) { // EventType.DISPLAYED
  ```
  `EventType` is already imported in `index.ts` but not in `_layout.tsx`. If Notifee ever re-numbers these enums (or on a different Notifee version), this code silently breaks. The comments hint at the intent but comments can drift from reality.
- **Fix:** Import `EventType` from `@notifee/react-native` and use `EventType.PRESS`, `EventType.DELIVERED` etc.:
  ```tsx
  import notifee, { EventType } from '@notifee/react-native';
  // ...
  if (type === EventType.PRESS) { ... }
  else if (type === EventType.DELIVERED) { ... }
  ```

---

### H-5 — Test functions specify `sound` property on Android notifications alongside channel

- **File:** `utils/notifeePrayerService.js`
- **Lines:** 1431, 1475, 1520
- **Category:** Bug (misleading)
- **Description:** Several test functions (`testImmediateNotification`, `testScheduledNotification`, `testFajrNotification`) specify `sound: 'azan.wav'` directly on the `android` notification config:
  ```js
  android: {
    channelId: testChannelId,
    sound: 'azan.wav', // ← ignored on Android O+
  },
  ```
  On Android 8.0+ (API 26+), the `sound` property on individual notifications is **completely ignored** — the channel's sound setting is used instead. This creates a false impression that the per-notification sound might work, making debugging confusing.
- **Fix:** Remove `sound` from all Android notification configs. Add a comment that sound is channel-managed.

---

## MEDIUM Findings

### M-1 — Hijri date calculation is a rough approximation

- **File:** `utils/localPrayerData.js`
- **Lines:** ~490–530
- **Category:** Bug (minor inaccuracy)
- **Description:** `getHijriDate()` divides the difference in days from the Islamic epoch by `29.5306` (average lunation). This can produce dates ±2 days off the actual Islamic calendar, which uses moon sighting and varies by locale. For a prayer app, incorrect Hijri dates could mislead users about important Islamic dates (Ramadan start, Eid).
- **Impact:** Users may see slightly wrong Hijri dates.
- **Suggestion:** Consider using a well-tested library (e.g., `hijri-converter` or Intl.DateTimeFormat with `islamic-umalqura` calendar on supported engines).

---

### M-2 — Module-level mutable cache in `useLocation.ts`

- **File:** `lib/qibla-compass/hooks/useLocation.ts`
- **Lines:** module top-level (variables `cachedLocation`, `cacheTimestamp`)
- **Category:** Performance / Design
- **Description:** Location cache is stored in module-level variables shared across all hook instances. If two components use `useLocation` simultaneously, they share/overwrite the same cache. This is intentional for efficiency but could cause stale data if one component updates the location while another reads the old cached value within the 60-second TTL.
- **Impact:** Minor — in practice the app likely has only one compass component.

---

### M-3 — Simulated calibration progress in `useCalibration.ts`

- **File:** `lib/qibla-compass/hooks/useCalibration.ts`
- **Category:** UX / Design
- **Description:** The calibration progress bar advances on a fixed timer interval (not based on actual sensor quality improvement). A user could see "100% calibrated" while the magnetometer is still unreliable. The `useQiblaCompass.ts` hook has a guard (`completeCalibration()` is called when accuracy reaches MEDIUM), but the progress bar movement is misleading before that point.
- **Impact:** Users may think calibration is done when it isn't.

---

### M-4 — `estimateMagneticDeclination` uses very rough linear model

- **File:** `lib/qibla-compass/utils/qiblaCalculations.ts`
- **Lines:** 202–232
- **Category:** Bug (accuracy)
- **Description:** The function uses a simplistic `longitude / 180 * factor` model that has no basis in geomagnetic science. For locations with unusual magnetic anomalies, the error can exceed ±10°. The function is exported as a public API, giving false confidence to consumers.
- **Impact:** Related to C-3. Even if declination correction is added, using this model won't be accurate enough for many locations.
- **Suggestion:** Use NOAA's WMM coefficients or a community library implementing the World Magnetic Model.

---

### M-5 — Excessive `console.log` in production (not guarded by `__DEV__`)

- **Files:** `utils/notifeePrayerService.js`, `utils/prayerNotificationScheduler.ts`, `utils/audioHelper.js`, `utils/androidAlarmManager.js`, `utils/backgroundTask.js`, `utils/notificationTestHelper.js`, `utils/quranStorage.ts`
- **Category:** Performance / Security
- **Description:** Over 150 `console.log` / `console.error` calls across these files emit to the system logger in production builds. On Android, these are visible via `adb logcat` and could expose prayer scheduling details, channel IDs, user preferences (sound type), and debug state to anyone with device access.
- **Impact:** Performance overhead from string interpolation + I/O; minor information disclosure.
- **Fix:** Wrap non-essential logs in `if (__DEV__)` guards, or use a logging utility that strips in release builds (e.g., Babel plugin `transform-remove-console`).

---

### M-6 — `downloadSurahAudio` uses `(fInfo as any).size` type cast

- **File:** `utils/quranStorage.ts`
- **Line:** ~714
- **Category:** Code quality
- **Description:** The code casts FileInfo to `any` to access `size`:
  ```ts
  const fInfo = await FileSystem.getInfoAsync(dest);
  totalBytes += (fInfo as any).size || 0;
  ```
  `FileSystem.FileInfo` does have a `size` property when `exists: true`, but the type narrowing isn't done. The `any` cast suppresses TypeScript's safety.
- **Fix:** Use a type guard: `if (fInfo.exists && 'size' in fInfo) { totalBytes += fInfo.size ?? 0; }`

---

## LOW Findings

### L-1 — Empty file: `utils/simpleNotificationService.js`

- **File:** `utils/simpleNotificationService.js`
- **Lines:** 0 (empty)
- **Category:** Dead code
- **Description:** File exists but is completely empty. Not imported anywhere.
- **Fix:** Delete.

---

### L-2 — Temporary placeholder: `utils/safeAreaUtils.ts`

- **File:** `utils/safeAreaUtils.ts`
- **Lines:** 1–15
- **Category:** Dead code
- **Description:** File contains a comment "This file should be removed once the import error is resolved" and exports a single `tempFunction` that only checks `insets.bottom > 0`. No other file imports it.
- **Fix:** Delete after confirming no imports exist.

---

### L-3 — Stub file: `widgets/widgetTaskHandler.ts`

- **File:** `widgets/widgetTaskHandler.ts`
- **Lines:** 1–11
- **Category:** Dead code
- **Description:** Intentionally kept as "stub for future extensibility" per its comments. Exports an empty object. `docs/ARCHITECTURE.md` references it for documentation purposes.
- **Suggestion:** Acceptable if the team plans to use it. Otherwise, delete.

---

### L-4 — Dead state variable `assetsLoaded` in `_layout.tsx`

- **File:** `app/_layout.tsx`
- **Line:** 79
- **Category:** Dead code
- **Description:** `const [assetsLoaded, setAssetsLoaded] = useState(true)` — initialized to `true`, never changed, never read elsewhere. Comment says "No startup animation / blocking screen anymore."
- **Fix:** Remove the state declaration.

---

### L-5 — Dead function `playSimpleSound` in `_layout.tsx`

- **File:** `app/_layout.tsx`
- **Lines:** 304–311
- **Category:** Dead code
- **Description:** `playSimpleSound` is defined but never called from any code path (no JSX reference, no event handler, no effect). It was likely used for testing at one point.
- **Fix:** Remove the function.

---

### L-6 — `setupAndroidAlarmHandler` exported but never called

- **File:** `utils/androidAlarmManager.js`
- **Lines:** 216–262
- **Category:** Dead code
- **Description:** The function is exported but no file in the codebase imports or calls it (verified via grep). It contains a dangerous `notifee.onBackgroundEvent` registration (see H-1). This is dead code with a hazardous payload.
- **Fix:** Delete the function entirely, or at minimum remove the `onBackgroundEvent` registration.

---

## Part A — Files With No Issues Found

| File                                                | Lines | Notes                                                           |
| --------------------------------------------------- | ----- | --------------------------------------------------------------- |
| `index.ts`                                          | 87    | Clean structure, proper top-level handlers                      |
| `utils/prayerTimeTuner.js`                          | 238   | NaN guard already fixed; logic is sound                         |
| `utils/timeUtils.js`                                | ~130  | Well-structured date utilities                                  |
| `utils/colorHelpers.ts`                             | 219   | Solid color math utilities                                      |
| `utils/iqamaConfig.ts`                              | ~45   | Simple, correct config                                          |
| `utils/quranHelpers.ts`                             | ~75   | Bismillah stripping works correctly                             |
| `utils/prayerNotificationScheduler.ts`              | 491   | Promise-based lock already fixed; rolling window logic is solid |
| `utils/pushNotifications.ts`                        | 356   | FCM token guard already fixed; clean integration                |
| `utils/widgetDataBridge.ts`                         | 204   | Good debouncing; proper per-platform impl                       |
| `lib/quranApi.ts`                                   | 226   | Proper AbortController timeout; clean REST client               |
| `lib/qibla-compass/index.ts`                        | ~48   | Barrel exports only                                             |
| `lib/qibla-compass/types.ts`                        | 183   | Type definitions only                                           |
| `lib/qibla-compass/hooks/useCompass.ts`             | 289   | Proper cleanup with isMountedRef; correct sensor fusion         |
| `lib/qibla-compass/utils/sensorFusion.ts`           | 311   | Sound math; well-documented                                     |
| `lib/qibla-compass/components/CalibrationGuide.tsx` | 341   | Clean animated UI                                               |
| `lib/qibla-compass/components/CompassRose.tsx`      | 263   | Correct SVG rendering                                           |
| `lib/qibla-compass/components/QiblaCompass.tsx`     | 531   | Well-structured compass UI                                      |
| `utils/notificationTestHelper.js`                   | 163   | Test-only file; console.log expected                            |

---

# Part B — Android, iOS, Config, Contexts, Types, Plugins & Tests (49 files)

---

## HIGH Findings

### B-H-1 — Duplicate translation keys silently shadow values

- **Files:** `translations/en.js` (365 lines), `translations/ar.js` (365 lines)
- **Category:** Bug
- **Description:** Both translation files contain **4 duplicate JS object keys** each. In JavaScript, when an object literal has duplicate keys, the last value silently wins. This means the first value is unreachable dead data, and any code expecting the first value gets the wrong string.

  **Duplicates in `en.js`:**
  | Key | First (line) | Second (line) | First value | Second value (wins) |
  |-----|-------------|---------------|-------------|---------------------|
  | `retry` | L6 | L67 | `'Retry'` | `'Try Again'` |
  | `iqamaCountdown` | L14 | L20 | `'Iqama'` | `'Iqama Countdown'` |
  | `arabic` | ~L113 | ~L133 | `'Arabic'` | `'Arabic'` _(same — no visible bug)_ |
  | `supportTitle` | ~L108 | L329 | `'Support the Developer'` | `'Support This App'` |

  **Duplicates in `ar.js`** — same 4 keys at corresponding locations with Arabic values.

- **Impact:**
  - `t('retry')` returns `'Try Again'` everywhere, never `'Retry'`. The "General" section's intended short label is unreachable.
  - `t('iqamaCountdown')` returns the longer `'Iqama Countdown'` string, never the short `'Iqama'` label. Any UI using this for a compact display will get an unexpectedly long string.
  - `t('supportTitle')` returns `'Support This App'` from the paywall section, not `'Support the Developer'` from the original support dialog. The old dialog text is dead.
- **Fix:** Rename the duplicates to distinct keys:

  ```js
  // General section
  retry: 'Retry',
  // Qibla section — rename to:
  retryQibla: 'Try Again',

  // Iqama section
  iqamaLabel: 'Iqama',       // renamed from first iqamaCountdown
  iqamaCountdown: 'Iqama Countdown',

  // Support dialog — rename to:
  supportDeveloperTitle: 'Support the Developer',
  // Paywall section keeps:
  supportTitle: 'Support This App',
  ```

  Update all call sites that depend on the intended values.

---

### B-H-2 — 60-second exact alarms cause excessive battery drain

- **Files:** `android/.../PrayerWidget.kt` (L100–108), `android/.../PrayerWidget4x2.kt` (L135–143)
- **Category:** Performance / Battery
- **Description:** Both widget classes use `AlarmManager.setExactAndAllowWhileIdle()` to schedule widget updates every **60 seconds**:

  ```kotlin
  // PrayerWidget.kt L100
  val nextUpdate = now + 60000 // 1 minute
  // ...
  alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextUpdate, pendingIntent)
  ```

  `setExactAndAllowWhileIdle` bypasses Doze mode and wakes the device CPU. Android documentation explicitly warns: _"Exact alarms should only be used for user-facing features. Polling or syncing at high frequency wastes battery."_ 60-second wakeups from TWO widget providers (if both are on the home screen) means **up to 2880 wakeups/day**.

  Starting with Android 12 (API 31), apps need the `SCHEDULE_EXACT_ALARM` permission, and Android 14+ may restrict it further for background-only use.

- **Impact:** Significant battery drain. Play Store policy may flag this as excessive wakelock usage.
- **Fix:** Use `AlarmManager.setInexactRepeating()` with `INTERVAL_FIFTEEN_MINUTES` or use `WorkManager` with a periodic 15-minute constraint. For countdown display precision, rely on WidgetKit-style approach: pre-render multiple timeline snapshots (already done on iOS) rather than waking the CPU every minute.

---

### B-H-3 — Non-atomic SharedPreferences writes in `setThemeMode`

- **File:** `android/.../WidgetDataModule.kt` (L91–112)
- **Category:** Bug (race condition)
- **Description:** `setThemeMode()` performs **two separate** `prefs.edit().apply()` calls:

  ```kotlin
  // First write — L99
  prefs.edit().putString(KEY_THEME_MODE, themeMode).apply()

  // Second write — L107
  prefs.edit().putString(KEY_WIDGET_DATA, json.toString()).apply()
  ```

  Between these two asynchronous writes, `refreshWidgets()` is called (L110). A widget update triggered between the first and second `apply()` will see the new `theme_mode` but the old `widget_data` JSON, which still contains the old `themeMode` field. `PrayerTimeRepository.getThemeMode()` reads from the top-level `KEY_THEME_MODE` (correct), but `get12hTimesFromPrefs()` reads widget_data which may have stale theme info.

- **Impact:** Brief visual glitch — widget themes momentarily inconsistent. Low probability but reproducible under load.
- **Fix:** Use a single `editor` instance:
  ```kotlin
  val editor = prefs.edit()
  editor.putString(KEY_THEME_MODE, themeMode)
  if (existingData != null) {
      try {
          val json = JSONObject(existingData)
          json.put("themeMode", themeMode)
          editor.putString(KEY_WIDGET_DATA, json.toString())
      } catch (_: Exception) { }
  }
  editor.apply() // single atomic write
  ```

---

## MEDIUM Findings

### B-M-1 — CSV file read twice for today + tomorrow Fajr

- **File:** `android/.../PrayerTimeRepository.kt` (L178–204, L213–237)
- **Category:** Performance
- **Description:** When SharedPreferences data is unavailable (stale or empty), the fallback path reads `prayer_times.csv` via `getPrayerTimesFromCSV()` for today's times, then reads the same file again via `getTomorrowFajrFromCSV()` for tomorrow's Fajr. Each call opens the resource stream, reads all lines, and closes it. The CSV is ~365 lines (one per day), so this is not slow, but the double-read is wasteful.
- **Fix:** Cache the CSV lines from the first read and pass them to `getTomorrowFajrFromCSV()`, or consolidate both lookups into a single function.

---

### B-M-2 — Deprecated `defaults.synchronize()` in iOS native module

- **File:** `ios-native/WidgetDataModuleIOS.swift` (L48, L67)
- **Category:** Code quality / Deprecation
- **Description:** `defaults.synchronize()` is called after each UserDefaults write. Since iOS 12+, UserDefaults automatically synchronizes, and Apple has deprecated explicit synchronize calls. The call adds unnecessary disk I/O.
- **Fix:** Remove both `defaults.synchronize()` calls.

---

### B-M-3 — Missing `requiresMainQueueSetup` in iOS native module

- **File:** `ios-native/WidgetDataModuleIOS.swift`
- **Category:** Warning suppression
- **Description:** The class is missing the `@objc static func requiresMainQueueSetup() -> Bool` method. React Native logs a warning at startup when this is missing, telling developers to explicitly declare whether the module needs main thread initialization.
- **Fix:** Add to the class:
  ```swift
  @objc static func requiresMainQueueSetup() -> Bool { return false }
  ```

---

### B-M-4 — Production `console.log` in `RevenueCatContext.tsx`

- **File:** `app/contexts/RevenueCatContext.tsx` (20+ occurrences across L103–172, L195–245)
- **Category:** Performance / Security
- **Description:** Over 20 `console.log('[RevenueCat] ...')` statements log purchase IDs, offering identifiers, product prices, and error details in production builds. These are NOT guarded by `__DEV__`.

  Additionally, the `debugLog` helper (L57–61) uses:

  ```tsx
  if (IS_ANDROID || (__DEV__ && VERBOSE_RC)) {
    console.log(...args);
  }
  ```

  This means **all** Android production builds log RevenueCat debug output, including customer info and entitlement details.

- **Impact:** Exposes product IDs, pricing, and purchase flow details in production logs. Performance overhead from string interpolation.
- **Fix:** Guard all `console.log` calls with `if (__DEV__)`. Change `debugLog` condition to `if (__DEV__ && VERBOSE_RC)`.

---

### B-M-5 — Type assertion `(Purchases as any).purchaseProduct()` on iOS

- **File:** `app/contexts/RevenueCatContext.tsx` (L237)
- **Category:** Code quality / Fragility
- **Description:** The iOS purchase path uses:
  ```tsx
  const { customerInfo } = await (Purchases as any).purchaseProduct(productId);
  ```
  Casting to `any` bypasses TypeScript entirely. If `purchaseProduct` is removed or renamed in a future RevenueCat SDK version, this will fail at runtime with no compile-time warning.
- **Fix:** Use the typed `purchaseStoreProduct` API (same approach used for Android in this file), or use `Purchases.getProducts([productId])` followed by `Purchases.purchaseStoreProduct(product)`.

---

### B-M-6 — `@Suppress("DEPRECATION")` instead of AndroidX `ContextCompat`

- **File:** `android/.../WidgetThemeHelper.kt` (L63–68)
- **Category:** Code quality
- **Description:** The `resolveColor` function suppresses deprecation warnings and manually checks `Build.VERSION.SDK_INT`:
  ```kotlin
  @Suppress("DEPRECATION")
  private fun resolveColor(context: Context, colorRes: Int): Int {
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          context.resources.getColor(colorRes, null)
      } else {
          context.resources.getColor(colorRes)
      }
  }
  ```
  `ContextCompat.getColor(context, colorRes)` from AndroidX does exactly this internally and is the recommended replacement. Using it removes the suppression annotation and the manual version check.
- **Fix:** Replace with `ContextCompat.getColor(context, colorRes)` and remove `@Suppress("DEPRECATION")`.

---

## LOW Findings

### B-L-1 — Duplicated scheduling logic across both widget classes

- **Files:** `android/.../PrayerWidget.kt` (L92–128), `android/.../PrayerWidget4x2.kt` (L127–164)
- **Category:** Code duplication
- **Description:** `scheduleNextUpdate()` and `cancelUpdate()` are nearly identical in both classes — same AlarmManager setup, same 60-second interval, same PendingIntent flags, same SecurityException fallback. Only the broadcast action string and target class differ.
- **Fix:** Extract shared scheduling logic into a companion utility (e.g., `WidgetAlarmHelper.kt`).

---

### B-L-2 — 4x2 widget strips AM/PM without visual distinction

- **File:** `android/.../PrayerWidget4x2.kt` (L95–96)
- **Category:** UX
- **Description:** The widget displays times with AM/PM stripped:
  ```kotlin
  val shortTime = prayer.time.replace(" AM", "").replace(" PM", "")
  ```
  This means 4:57 AM (Fajr) and 4:57 PM (Maghrib) would display identically as "4:57". In practice, prayer times don't overlap this way, but it creates potential ambiguity for Dhuhr/Isha or Sunrise/Maghrib times that happen to have similar numeric values.
- **Note:** The iOS widget does the same (intentional design choice for compact display). Acceptable given prayer times are contextually unambiguous.

---

### B-L-3 — Empty test directory for component tests

- **Directory:** `__tests__/components/settings/`
- **Category:** Missing test coverage
- **Description:** The directory exists but contains no test files. Settings components (location picker, notification toggles, Quran preferences) have no component-level tests. Hook-level tests exist in `__tests__/hooks/settings/` and provide good coverage of the business logic, but UI rendering and interaction are untested.
- **Suggestion:** Add component tests for critical user-facing flows (region selection, notification toggle).

---

### B-L-4 — `global.d.ts` redundant re-declaration

- **File:** `types/global.d.ts` (L1–11)
- **Category:** Code quality
- **Description:** The file declares `showTestNotification` twice — once directly on `global` (L3) and once inside a nested `global.global` object (L6–8):
  ```ts
  declare global {
    var showTestNotification: () => void;
    var global: {
      showTestNotification?: () => void;
    };
  }
  ```
  The nested `global.global` declaration is unnecessary and confusing. The top-level `var showTestNotification` already makes it available as `globalThis.showTestNotification`.
- **Fix:** Remove the redundant `var global` declaration.

---

### B-L-5 — `react-native-fix.d.ts` uses `any` for all refs patches

- **File:** `types/react-native-fix.d.ts` (L1–33)
- **Category:** Code quality
- **Description:** Adds `refs?: any` to 6 React Native component type augmentations. The `any` type completely disables TypeScript safety for the `refs` property. This was likely a quick workaround for a type error.
- **Suggestion:** Investigate the root cause. If the error is from a specific library version mismatch, upgrading `@types/react-native` may resolve it. Otherwise, use `refs?: Record<string, React.Component>` for better safety.

---

### B-L-6 — `download-quran-bundle.js` requires Node 18+ without check

- **File:** `scripts/download-quran-bundle.js` (~65 lines)
- **Category:** Robustness
- **Description:** The script uses the global `fetch` API (available in Node 18+) without checking the runtime version or providing a polyfill. Running on Node 16 or earlier will fail with `fetch is not defined`.
- **Fix:** Add a version check at the top:
  ```js
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 18) {
    console.error("Node 18+ required");
    process.exit(1);
  }
  ```

---

### B-L-7 — RTL explicitly disabled for Arabic language

- **File:** `translations/index.js` (L15)
- **Category:** Design decision (intentional)
- **Description:** Arabic language is configured with `rtl: false`:
  ```js
  ar: { id: 'ar', name: 'العربية', rtl: false, /* Disabled RTL to prevent UI mirroring */ translations: ar }
  ```
  This is an intentional choice to prevent React Native's automatic layout mirroring, which can break certain custom layouts. However, Arabic users may find some UI elements (text alignment, icon placement) feel unnatural.
- **Note:** This is acknowledged as a deliberate trade-off, not a bug. Consider enabling RTL in the future after testing all screens for layout issues.

---

## Part B — Files With No Issues Found

### Android Kotlin (9 files)

| File                                  | Lines | Notes                                                                                                                               |
| ------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `android/.../MainActivity.kt`         | 67    | Standard Expo React Activity; correct splash screen + back button handling                                                          |
| `android/.../MainApplication.kt`      | 56    | Standard Expo Application; correctly registers `WidgetDataPackage`                                                                  |
| `android/.../PrayerTimeRepository.kt` | 445   | Well-structured data provider; proper SharedPrefs→CSV fallback chain; `parse24hTime` lacks validation but callers wrap in try-catch |
| `android/.../WidgetDataPackage.kt`    | 24    | Clean ReactPackage registration                                                                                                     |
| `android/.../WidgetPinModule.kt`      | 55    | Clean API 26+ pin request with proper version guard                                                                                 |

### iOS Swift (6 files)

| File                                       | Lines | Notes                                                                           |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------- |
| `ios-widget/PrayerTimesWidgetBundle.swift` | 13    | Clean widget bundle entry point                                                 |
| `ios-widget/PrayerTimesWidgets.swift`      | 90    | Timeline creation is correct — countdown updates use per-entry `date` parameter |
| `ios-widget/PrayerTimesWidgetViews.swift`  | 250   | Clean SwiftUI views with proper iOS 16/17 background compatibility              |
| `ios-widget/WidgetDataProvider.swift`      | 153   | Well-structured data loading with proper staleness check (48h)                  |
| `ios-widget/WidgetTheme.swift`             | 45    | Clean theme colors matching app's dark/sepia palettes                           |

### Config, Constants & Translations (7 files)

| File                             | Lines | Notes                                                                                                                       |
| -------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/config/prayerTimeConfig.ts` | 198   | Clean hierarchical region config. `getCountryIsoCode` is defined after default export but function hoisting makes this safe |
| `constants/duas.ts`              | ~500  | Static dua content data, no logic                                                                                           |
| `constants/sepiaColors.ts`       | ~95   | Light theme color palette, mirrors DarkColors structure                                                                     |
| `constants/surahAliases.ts`      | ~120  | Quran surah name aliases for search, static data                                                                            |

### Contexts (5 files)

| File                             | Lines | Notes                                                                                                                    |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| `contexts/LanguageContext.js`    | 74    | Clean AsyncStorage persistence; `changeLanguage` not in useEffect deps but works correctly due to mount-only execution   |
| `contexts/OnboardingContext.tsx` | 152   | Excellent implementation with AsyncStorage multiGet/multiSet; proper error handling with fallback to defaults            |
| `contexts/ThemeContext.js`       | 213   | Solid animated theme transition; proper migration from old theme names; `pointerEvents="none"` prevents overlay blocking |
| `app/contexts/ThemeContext.js`   | 5     | Clean re-export barrel file                                                                                              |

### Types (2 files)

| File                                                | Lines | Notes |
| --------------------------------------------------- | ----- | ----- |
| _(Both files have minor issues — see B-L-4, B-L-5)_ |       |       |

### Plugin & Build Config (5 files)

| File                             | Lines | Notes                                                                                                            |
| -------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| `plugins/withWidgetExtension.js` | 375   | Well-crafted Expo config plugin; handles Xcode project manipulation, code signing, and bridging header correctly |
| `metro.config.js`                | 8     | Standard Expo Metro config                                                                                       |
| `eslint.config.js`               | 10    | Standard Expo flat ESLint config                                                                                 |
| `react-native.config.js`         | 10    | Correctly disables autolinking for manually managed libs                                                         |

### Tests (15 files)

| File                                                        | Lines | Notes                                                                                                                                                     |
| ----------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/utils/iqamaConfig.test.ts`                       | ~110  | Good coverage of IQAMA_OFFSETS, getIqamaTime, hasIqama                                                                                                    |
| `__tests__/utils/parseRegionId.test.ts`                     | ~95   | Good coverage of region ID parsing and config lookup                                                                                                      |
| `__tests__/utils/prayerTimeTuner.test.ts`                   | ~120  | Tests city adjustments and tuning parameters                                                                                                              |
| `__tests__/utils/pushNotifications.test.ts`                 | 472   | Comprehensive: FCM token, topic subscription/unsubscription, foreground handler, token refresh, full init flow, version management, country topic updates |
| `__tests__/utils/widgetDataBridge.test.ts`                  | ~170  | Tests debouncing, immediate writes, theme sync, platform branching                                                                                        |
| `__tests__/hooks/home/useHomeAnimations.test.ts`            | ~100  | Tests animated value stability and gradient function                                                                                                      |
| `__tests__/hooks/home/useHomeNotifications.test.ts`         | 276   | Tests scheduling flow, cooldown, state toggles, re-render guard                                                                                           |
| `__tests__/hooks/home/useHomePrayerData.test.ts`            | 467   | Comprehensive: initial state, 12h conversion, day navigation (boundaries at 0 and 9), data fetching, cache clearing, widget data sync with theme          |
| `__tests__/hooks/home/useHomeRegion.test.ts`                | ~160  | Tests region loading, fallback, AsyncStorage error handling, manual reload                                                                                |
| `__tests__/hooks/quran/useQuranAudio.test.ts`               | ~300  | Tests audio state, playback, download, reciter change, auto-scroll, layout reset                                                                          |
| `__tests__/hooks/quran/useQuranData.test.ts`                | ~250  | Tests search, filtering (by name/number/alias/ayah ref), font sizes, bookmarks/lastRead                                                                   |
| `__tests__/hooks/settings/useSettingsDonation.test.ts`      | ~100  | Tests paywall state, RC key presence detection, Alert fallback                                                                                            |
| `__tests__/hooks/settings/useSettingsLocation.test.ts`      | ~200  | Tests cascading country→state→city selection, same-country no-op, region save + notification cancel                                                       |
| `__tests__/hooks/settings/useSettingsNotifications.test.ts` | ~180  | Tests enable/disable toggle, per-prayer settings, sound preference, test notification dispatch                                                            |
| `__tests__/hooks/settings/useSettingsQuranPrefs.test.ts`    | ~250  | Tests edition/font/reciter preferences, live preview vs persist, translation filtering, picker modal state                                                |

**Test quality assessment:** All 15 test files are well-structured with proper Jest mocking, appropriate use of `renderHook` + `act`/`waitFor`, and good coverage of happy paths, edge cases, and error states. No bugs found in the test code itself.

---

## Priority Fix Order (Combined)

| Priority | ID                 | Summary                                                            | Effort                                    |
| -------- | ------------------ | ------------------------------------------------------------------ | ----------------------------------------- |
| 1        | C-2                | Add `await` to `triggerBackgroundCheck()`                          | 1 line                                    |
| 2        | C-1                | Remove hardcoded RevenueCat API keys                               | Small                                     |
| 3        | B-H-1              | Fix duplicate translation keys in `en.js`/`ar.js`                  | Small (rename 4 keys + update call sites) |
| 4        | H-3                | Fix audio cleanup to use playback completion                       | Small                                     |
| 5        | H-4                | Replace magic numbers with `EventType` enum                        | Small                                     |
| 6        | B-H-3              | Make SharedPreferences writes atomic in `setThemeMode`             | Small                                     |
| 7        | C-3                | Apply magnetic declination to Qibla compass                        | Medium                                    |
| 8        | B-H-2              | Reduce widget alarm frequency (60s → 15min)                        | Medium                                    |
| 9        | H-1 + L-6          | Remove dangerous `onBackgroundEvent` from `androidAlarmManager.js` | Small                                     |
| 10       | H-2                | Move `setupNotifeeEventHandlers()` out of module load              | Small                                     |
| 11       | B-M-4              | Guard RevenueCatContext production `console.log` with `__DEV__`    | Small                                     |
| 12       | M-5                | Guard all production `console.log` with `__DEV__`                  | Medium                                    |
| 13       | B-M-2 + B-M-3      | Remove deprecated `synchronize()` + add `requiresMainQueueSetup`   | Trivial                                   |
| 14       | H-5                | Remove misleading `sound` property from Android test notifications | Trivial                                   |
| 15       | L-1, L-2, L-4, L-5 | Delete dead code/files                                             | Trivial                                   |
| 16       | B-L-1              | Extract shared widget scheduling logic                             | Small                                     |
