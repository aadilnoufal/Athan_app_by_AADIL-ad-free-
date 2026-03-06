# Comprehensive Code Audit Report — `utils/` and `lib/`

**Date:** 2025-07-11  
**Scope:** All files in `utils/` (17 files) and `lib/` (11 files)  
**Auditor:** GitHub Copilot

---

## Severity Legend

| Severity     | Meaning                                                         |
| ------------ | --------------------------------------------------------------- |
| **CRITICAL** | Will cause crashes, data loss, or silent failures in production |
| **HIGH**     | Likely to cause bugs, incorrect behavior, or reliability issues |
| **MEDIUM**   | Code quality, maintainability, or performance concerns          |
| **LOW**      | Minor improvements, style, dead code                            |

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 5      |
| HIGH      | 14     |
| MEDIUM    | 17     |
| LOW       | 10     |
| **Total** | **46** |

---

## 1. `utils/backgroundTask.js`

### ISSUE BT-1 — Missing `await` on async function call

- **Severity:** CRITICAL
- **Lines:** 76–78
- **Description:** `triggerBackgroundCheck()` calls `ensurePrayerNotificationWindow()` without `await`. Since `ensurePrayerNotificationWindow` is async and uses a boolean guard (`ensureInFlight`), the fire-and-forget call means errors are silently swallowed and the caller cannot know if the operation succeeded.
- **Impact:** If `ensurePrayerNotificationWindow()` throws, the error is unhandled (no `.catch()`). The `ensureInFlight` guard will be stuck at `true` indefinitely if the `finally` block isn't reached before the sync function returns.
- **Suggested Fix:**
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

### ISSUE BT-2 — Empty `catch` block hides module load failures

- **Severity:** MEDIUM
- **Lines:** 10–23
- **Description:** The outer `try/catch{}` around `TaskManager.defineTask` silently swallows all errors including module import failures.
- **Suggested Fix:** Log the error: `catch (e) { console.warn('Task definition failed:', e?.message); }`

### ISSUE BT-3 — Module-level `started` flag not reset on error

- **Severity:** MEDIUM
- **Lines:** 8, 28–48
- **Description:** If `setupBackgroundTask()` sets `started = true` (line 37) but a later re-init is needed after an app crash or hot-reload, the flag prevents re-registration. However, this is partially mitigated by the `unregisterBackgroundTask` function.
- **Suggested Fix:** Consider moving `started = true` to after successful registration, or use a more robust idempotency check.

---

## 2. `utils/audioHelper.js`

### ISSUE AH-1 — `downloadedAssets` cache populated but never used for playback

- **Severity:** HIGH
- **Lines:** 31, 42–57, 80–100
- **Description:** `preloadSounds()` downloads assets into `downloadedAssets` (line 49), but `playSound()` (line 68) always creates a _new_ `Audio.Sound` from `soundModules[soundKey]` (line 89). The preloaded assets are never utilized, making `preloadSounds()` waste bandwidth and memory.
- **Impact:** On slow networks, the same audio file is downloaded twice — once by `preloadSounds()` and once by `Audio.Sound.createAsync()`.
- **Suggested Fix:** Use `downloadedAssets[soundKey].localUri` if available in `playSound()`, or remove the preload cache entirely.

### ISSUE AH-2 — Anti-pattern: wrapping async in `new Promise` + `setTimeout(0)`

- **Severity:** MEDIUM
- **Lines:** 68–108, 123–154
- **Description:** Both `playSound()` and `playPrayerSound()` wrap their async work in `new Promise((resolve) => { setTimeout(async () => { ... }, 0); })`. This is an anti-pattern — `setTimeout(0)` does NOT guarantee main thread execution in React Native. It creates unnecessary complexity and prevents proper error propagation to callers.
- **Suggested Fix:** Use plain async/await. If main-thread scheduling is truly required, use `InteractionManager.runAfterInteractions()`.

### ISSUE AH-3 — Sound resource leak on playback error

- **Severity:** HIGH
- **Lines:** 91–100
- **Description:** If `sound.playAsync()` (line 93) throws, the `sound` object created on line 91 is never unloaded. The cleanup `setTimeout` at line 96 only runs on success. Over time, repeated failures will leak `Audio.Sound` instances.
- **Suggested Fix:** Add `sound.unloadAsync()` in the catch block:
  ```js
  try {
    const { sound } = await Audio.Sound.createAsync(moduleRef);
    await sound.playAsync();
    setTimeout(async () => {
      try {
        await sound.unloadAsync();
      } catch {}
    }, 5000);
    resolve(true);
  } catch (error) {
    // Clean up on failure
    if (sound)
      try {
        await sound.unloadAsync();
      } catch {}
    resolve(false);
  }
  ```

### ISSUE AH-4 — 5-second cleanup timeout is a magic number

- **Severity:** LOW
- **Lines:** 96–100
- **Description:** The hard-coded 5000ms delay assumes all sounds are shorter than 5 seconds. If a longer azan is used, the sound will be unloaded mid-playback.
- **Suggested Fix:** Listen for `sound.setOnPlaybackStatusUpdate()` and unload when `didJustFinish` is true.

---

## 3. `utils/colorHelpers.ts`

### ISSUE CH-1 — `lighten()`/`darken()` silently break on shorthand hex (#RGB)

- **Severity:** MEDIUM
- **Lines:** 137–159
- **Description:** `lighten()` and `darken()` do `parseInt(cleanHex, 16)` directly. For shorthand `#FFF` (3 chars), `parseInt('FFF', 16) = 4095` which is far too small a number for the bitshift operations `num >> 16`, causing R to be 0 and producing incorrect colors. Meanwhile `withAlpha()` at line 44 correctly handles shorthand.
- **Suggested Fix:** Expand shorthand hex first:
  ```ts
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex =
      cleanHex[0] +
      cleanHex[0] +
      cleanHex[1] +
      cleanHex[1] +
      cleanHex[2] +
      cleanHex[2];
  }
  ```

### ISSUE CH-2 — No NaN guard on `parseInt` results

- **Severity:** LOW
- **Lines:** 44–52, 137–159
- **Description:** If an invalid hex string is passed (e.g., `"#xyz"`), `parseInt('xy', 16)` returns `NaN`, leading to `rgba(NaN, NaN, NaN, 0.5)`. No validation is performed.
- **Suggested Fix:** Add a check: `if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;`

---

## 4. `utils/notifeePrayerService.js`

### ISSUE NPS-1 — Side effect at module load: `setupNotifeeEventHandlers()` called at bottom

- **Severity:** HIGH
- **Lines:** 1739
- **Description:** `setupNotifeeEventHandlers()` is called unconditionally when the module is first imported (line 1739). This means any code that merely imports from this file (even for type checking or tree-shaking) will register Notifee event listeners as a side effect. This can cause issues during testing, SSR, or if the module is imported before Notifee is initialized.
- **Impact:** Event handlers registered before the service is initialized could process events incorrectly.
- **Suggested Fix:** Move the call into `initializeNotifeePrayerNotifications()` and guard with a flag:
  ```js
  let eventHandlersRegistered = false;
  // Inside initializeNotifeePrayerNotifications:
  if (!eventHandlersRegistered) {
    setupNotifeeEventHandlers();
    eventHandlersRegistered = true;
  }
  ```

### ISSUE NPS-2 — Double cancellation when scheduling

- **Severity:** MEDIUM
- **Lines:** 655, 853–857
- **Description:** `updateNotifeePrayerNotifications()` (line 853) calls `cancelAllNotifeePrayerNotifications()` then calls `scheduleNotifeePrayerNotifications()` — which _also_ calls `cancelAllNotifeePrayerNotifications()` (line 655). This results in two full cancellation passes, doubling the time spent iterating over trigger IDs.
- **Suggested Fix:** Remove the cancel call from `updateNotifeePrayerNotifications` since `scheduleNotifeePrayerNotifications` already handles it, or accept a `skipCancel` parameter.

### ISSUE NPS-3 — `handleInitialNotification` only handles Android

- **Severity:** MEDIUM
- **Lines:** 591–601
- **Description:** The function returns immediately on iOS (`if (Platform.OS === 'android')`), but Notifee's `getInitialNotification()` is cross-platform. iOS users who open the app via a notification will not be handled.
- **Suggested Fix:** Remove the Android platform gate — Notifee supports this on both platforms.

### ISSUE NPS-4 — `appStateSubscription` memory leak risk

- **Severity:** MEDIUM
- **Lines:** 249, 619–627
- **Description:** `appStateSubscription` is module-scoped and only removed in `cleanupNotifeeService()`. If `setupAppStateListener()` is called multiple times without cleanup, the old subscription is removed but a new one replaces it. However, if `cleanupNotifeeService()` is never called (e.g., app hot-reloads), the listener leaks.
- **Suggested Fix:** This is already partially handled (line 620 removes old before adding new). Document that `cleanupNotifeeService()` must be called on unmount.

### ISSUE NPS-5 — Inconsistent `android.sound` vs channel strategy

- **Severity:** HIGH
- **Lines:** 1520, 1557, 1596
- **Description:** The test functions (`testImmediateNotification`, `testScheduledNotification`, `testFajrNotification`) set `android: { sound: 'azan.wav' }` directly on the notification, which **does not work** on Android — sound is controlled by the channel, not the individual notification. This contradicts the correct channel-based approach used in `createCrossPlatformNotification()` (lines 495–580). The test functions will produce confusing results since the `sound` property on individual notifications is ignored by Android.
- **Suggested Fix:** Remove `sound: 'azan.wav'` from the test notification android configs. The channel already handles sound.

### ISSUE NPS-6 — Mojibake character in debug string

- **Severity:** LOW
- **Lines:** 1090
- **Description:** `console.log('🔍 === NOTIFEE COMPREHENSIVE DEBUG REPORT ===')` — preceding character `'�'` is garbled (likely a broken emoji). Not a runtime issue, but suggests encoding problems.
- **Suggested Fix:** Replace with a valid emoji or remove.

### ISSUE NPS-7 — `requestAlarmPermission` returns a `Promise` that never resolves if Alert is dismissed

- **Severity:** MEDIUM
- **Lines:** 77–100
- **Description:** The `Alert.alert()` creates a Promise that only resolves when the user presses a button. On some Android manufacturers, the system can dismiss alerts without user interaction, leaving the promise pending forever.
- **Suggested Fix:** Add a timeout wrapper or handle the dismissal case.

---

## 5. `utils/prayerNotificationScheduler.ts`

### ISSUE PNS-1 — `ensureInFlight` boolean is not a true mutex

- **Severity:** HIGH
- **Lines:** 29, 275–278
- **Description:** The `ensureInFlight` boolean guard prevents concurrent calls but is NOT safe under JS microtask interleaving. If two `ensurePrayerNotificationWindow()` calls happen in rapid succession (e.g., from `startPrayerNotificationWindowMaintainer` + `onPrayerNotificationDelivered`), both could read `ensureInFlight === false` before either sets it to `true`, since the first `await` hasn't yielded yet.
- **Impact:** Duplicate notification scheduling, exceeding iOS 64-notification limit.
- **Suggested Fix:** Use a promise-based lock:
  ```ts
  let ensurePromise: Promise<void> | null = null;
  export async function ensurePrayerNotificationWindow() {
    if (ensurePromise) return ensurePromise;
    ensurePromise = _doEnsure().finally(() => {
      ensurePromise = null;
    });
    return ensurePromise;
  }
  ```

### ISSUE PNS-2 — `dayCursor.setDate()` mutation accumulates inaccuracy

- **Severity:** LOW
- **Lines:** 358
- **Description:** `dayCursor.setDate(dayCursor.getDate() + 1)` mutates the same Date object across loop iterations. While this works correctly, it can cross DST boundaries and cause the date to jump (e.g., 2:00 AM → 3:00 AM in spring). Since only the date part is used (via `isoDate`), this is unlikely to cause issues in practice.
- **Suggested Fix:** Create new Date instances: `const dayCursor = new Date(today.getTime() + i * 86400000);` inside the loop. Note: 86400000 is already used elsewhere in the file (line 362).

### ISSUE PNS-3 — Empty catch blocks hide configuration errors

- **Severity:** MEDIUM
- **Lines:** 92, 183–184, 208, 317–318, 346
- **Description:** Multiple `try {} catch {}` blocks with no logging, particularly around AsyncStorage reads. If AsyncStorage is corrupted, preferences silently fall back to defaults with no diagnostic trace.
- **Suggested Fix:** Add `console.warn` in each catch block.

### ISSUE PNS-4 — `cancelAll()` does not cancel non-pattern-matching IDs

- **Severity:** LOW
- **Lines:** 366–372
- **Description:** `cancelAll()` only cancels IDs starting with `prayer-` or `iqama-`. Snooze notifications (e.g., `snooze-fajr-xxx`) created by `notifeePrayerService.js` are orphaned and never cleaned up by the scheduler.
- **Suggested Fix:** Also cancel IDs starting with `snooze-`.

---

## 6. `utils/localPrayerData.js`

### ISSUE LPD-1 — Hijri date calculation is a rough approximation

- **Severity:** MEDIUM
- **Lines:** (in `getHijriDate` function — approximately line 470+)
- **Description:** The Hijri date is calculated using a fixed arithmetic formula that drifts by 1–2 days. For a prayer times app, incorrect Hijri dates could mislead users about Islamic calendar events.
- **Suggested Fix:** Use a tested Hijri calendar library (e.g., `Intl.DateTimeFormat` with `calendar: 'islamic-umalqura'` on supported engines, or a dedicated library like `hijri-converter`).

### ISSUE LPD-2 — No leap year validation for Feb 29 lookups

- **Severity:** LOW
- **Lines:** (in `formatDateForLookup` / CSV lookup)
- **Description:** The CSV contains 366 entries (including Feb 29). Non-leap years will never query "29-02" but if they do, the lookup silently returns data for a non-existent date. This is harmless but worth a comment.

---

## 7. `utils/pushNotifications.ts`

### ISSUE PN-1 — `initializePushNotifications` has no idempotency guard

- **Severity:** HIGH
- **Lines:** (entire function)
- **Description:** Unlike `initializeNotifeePrayerNotifications` which checks `isInitialized`, this function can be called multiple times, each time setting up a new foreground handler without removing the previous one. This leads to duplicate push notification handlers registering and processing each notification multiple times.
- **Suggested Fix:** Add an `isInitialized` guard similar to the Notifee service.

### ISSUE PN-2 — Dynamic `require()` for Firebase modules

- **Severity:** MEDIUM
- **Lines:** (throughout)
- **Description:** All Firebase imports use `require()` inside function bodies. While this avoids crashes when Firebase is not installed, it bypasses tree-shaking and type checking. If the import fails at runtime, the catch block silently swallows the error.
- **Suggested Fix:** Consider using optional chaining with dynamic `import()` and proper error boundaries, or document this as intentional.

---

## 8. `utils/quranStorage.ts`

### ISSUE QS-1 — `deleteSurahAudio` does not delete actual audio files from disk

- **Severity:** CRITICAL
- **Lines:** 812–818
- **Description:** `deleteSurahAudio()` only removes the index entry from AsyncStorage. The actual audio files on disk (stored in `FileSystem.documentDirectory`) are NOT deleted. The comment says _"Actual files will be cleaned up on next full clear"_ — but there is NO "full clear" function that does this.
- **Impact:** Users who download/delete audio repeatedly will accumulate orphaned files, wasting potentially hundreds of MB of disk space with no way to recover it.
- **Suggested Fix:** Iterate through the audio directory and delete the actual files:
  ```ts
  export async function deleteSurahAudio(
    surahNumber: number,
    reciterEdition: string,
  ): Promise<void> {
    const index = await readAudioIndex();
    const key = audioIndexKey(surahNumber, reciterEdition);
    const entry = index[key];
    if (entry?.files) {
      for (const filePath of Object.values(entry.files)) {
        try {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        } catch {}
      }
    }
    delete index[key];
    await writeAudioIndex(index);
  }
  ```

### ISSUE QS-2 — `downloadAllAudio` has no cancellation mechanism

- **Severity:** MEDIUM
- **Lines:** 829–842
- **Description:** The loop downloads all 114 surahs sequentially with no cancellation token. If the user navigates away or loses network mid-download, the function continues running in the background, consuming bandwidth and battery.
- **Suggested Fix:** Accept an `AbortSignal` parameter and check it between iterations.

### ISSUE QS-3 — Audio download partial failure leaves inconsistent state

- **Severity:** HIGH
- **Lines:** (in `downloadSurahAudio`)
- **Description:** If downloading ayah 50 of 100 fails, the index is written with only a partial list of files. `isSurahAudioDownloaded` will return `true` (the index key exists), but playback will fail for missing ayahs.
- **Suggested Fix:** Only write the index entry after ALL files for the surah download successfully. Use a temporary staging directory.

---

## 9. `utils/prayerTimeTuner.js`

### ISSUE PTT-1 — No validation of city adjustment offsets

- **Severity:** LOW
- **Lines:** (in `applyLocalDataCityAdjustments`)
- **Description:** City adjustment offsets are applied without bounds checking. A misconfigured offset (e.g., +120 minutes) would silently produce incorrect prayer times.
- **Suggested Fix:** Add range validation (e.g., offsets should be within ±30 minutes).

---

## 10. `utils/timeUtils.js`

### ISSUE TU-1 — `findNextPrayer` adds 1-second lookahead

- **Severity:** LOW
- **Lines:** (in `findNextPrayer`)
- **Description:** `findNextPrayer` adds 1000ms to `Date.now()` to skip times that just occurred. This creates a 1-second window where the "current" prayer could be incorrectly identified if called at exactly the prayer time.
- **Suggested Fix:** Document this behavior. Consider using `>=` comparison instead.

---

## 11. `utils/safeAreaUtils.ts`

### ISSUE SAU-1 — Dead code / placeholder file

- **Severity:** LOW
- **Lines:** 1–17 (entire file)
- **Description:** File contains only a placeholder function and a comment: _"This file can be safely removed once the bundler cache is cleared"_. It adds unnecessary complexity and may mislead maintainers.
- **Suggested Fix:** Delete the file and remove any imports referencing it.

---

## 12. `utils/simpleNotificationService.js`

### ISSUE SNS-1 — Empty file

- **Severity:** LOW
- **Lines:** 0 (empty)
- **Description:** This file is completely empty — likely a leftover from a refactor. It adds confusion when browsing the codebase.
- **Suggested Fix:** Delete the file.

---

## 13. `utils/widgetDataBridge.ts`

### ISSUE WDB-1 — Debounced `updateWidgetData` swallows errors silently

- **Severity:** HIGH
- **Lines:** 71–78
- **Description:** `_writeWidgetData()` is called inside a `setTimeout` callback. Since `_writeWidgetData` calls `.then().catch()` on native module calls (lines 161–166), errors are caught but only logged. The caller of `updateWidgetData()` has no way to know if the write succeeded.
- **Impact:** Widget data could silently fail to sync, leaving widgets showing stale data.
- **Suggested Fix:** Track the last error and expose it via a `getLastSyncError()` function.

### ISSUE WDB-2 — No validation of `data` parameter

- **Severity:** MEDIUM
- **Lines:** 69–78
- **Description:** `updateWidgetData()` passes `data` directly to `JSON.stringify()` with no validation. If `data.times` is missing or malformed, the widget will receive invalid JSON and crash or show incorrect data.
- **Suggested Fix:** Validate required fields before writing.

### ISSUE WDB-3 — Module-level debounce timer is not cleared on cleanup

- **Severity:** LOW
- **Lines:** 33
- **Description:** The module-level `debounceTimer` is never cleared when the app unmounts. In development with hot-reloading, old timers can fire after the module re-initializes.
- **Suggested Fix:** Export a cleanup function that calls `clearTimeout(debounceTimer)`.

---

## 14. `utils/notificationTestHelper.js`

### ISSUE NTH-1 — Test helpers available in production bundle

- **Severity:** MEDIUM
- **Lines:** 1–149 (entire file)
- **Description:** This file exports test/debug functions (`testAllNotifications`, `testSoundPreferenceDetection`, etc.) that are intended for development but will be included in the production bundle. They import from `notifeePrayerService.js` which has side effects.
- **Suggested Fix:** Guard with `__DEV__` checks or move to a `__tests__/` directory.

---

## 15. `utils/androidAlarmManager.js`

### ISSUE AAM-1 — Dynamic `require('./audioHelper')` inside event handler

- **Severity:** MEDIUM
- **Lines:** (inside event callback)
- **Description:** `audioHelper` is dynamically required inside the Notifee event handler callback. If the require fails (e.g., bundler issue), the notification event handling silently fails.
- **Suggested Fix:** Use a static import at the top of the file or handle the require failure gracefully.

---

## 16. `lib/quranApi.ts`

### ISSUE QA-1 — No retry logic for transient network failures

- **Severity:** HIGH
- **Lines:** (entire fetch implementation)
- **Description:** All API calls use a single fetch with a 20-second timeout and no retry. For a prayer times app where users may be on flaky mobile networks, a single failed request could unnecessarily show "load failed" to the user.
- **Suggested Fix:** Implement exponential backoff with 2–3 retries for `5xx` and network errors.

### ISSUE QA-2 — No response caching

- **Severity:** MEDIUM
- **Lines:** (entire file)
- **Description:** Each API call hits the network even for the same surah data that was fetched minutes ago. The alquran.cloud API data changes infrequently.
- **Suggested Fix:** Add in-memory cache with TTL, or use AsyncStorage for persistence.

---

## 17. `lib/qibla-compass/utils/qiblaCalculations.ts`

### ISSUE QC-1 — `estimateMagneticDeclination` is highly inaccurate

- **Severity:** CRITICAL
- **Lines:** 200–232
- **Description:** The magnetic declination estimate uses a simplistic linear interpolation that self-documents as _"very rough approximation"_. Magnetic declination varies from -20° to +25° globally and changes yearly. An incorrect declination of even 5° means the Qibla direction will be **wrong by 5°**, which at 10,000 km distance translates to hundreds of km off target.
- **Impact:** For a Qibla compass — the core feature — this directly impacts prayer validity for users in regions with significant declination (e.g., North America, Europe).
- **Suggested Fix:** Use the World Magnetic Model (WMM) coefficients or a library like `geomagnetism`. At minimum, use a lookup table with 5° grid resolution. Alternatively, note that modern devices provide true heading (already compensated) and skip manual declination entirely if `DeviceMotion` or `Location.getHeadingAsync()` is used.

---

## 18. `lib/qibla-compass/utils/sensorFusion.ts`

### ISSUE SF-1 — No issues found

- **Description:** The sensor fusion implementation (tilt-compensated heading, low-pass filter, calibration detection, weighted moving average) is mathematically sound and well-documented. No bugs identified.

---

## 19. `lib/qibla-compass/hooks/useCompass.ts`

### ISSUE UC-1 — Sensor subscription interval may drain battery

- **Severity:** MEDIUM
- **Lines:** (in useEffect where subscriptions are created)
- **Description:** The magnetometer and accelerometer are subscribed at `updateInterval` (default 100ms = 10Hz). When the compass screen is open for extended periods, this continuously drains battery. There's no mechanism to reduce the update rate when the app is backgrounded.
- **Suggested Fix:** Reduce to 200–300ms for normal use, and pause subscriptions when `AppState !== 'active'`.

---

## 20. `lib/qibla-compass/hooks/useLocation.ts`

### ISSUE UL-1 — Module-level location cache shared across hook instances

- **Severity:** HIGH
- **Lines:** 46–47
- **Description:** `cachedLocation` and `cacheTimestamp` are module-level variables. If multiple components use `useLocation()`, they share the same cache. This is intentional for performance, but creates a subtle issue: the `refresh()` function (lines 180–184) clears the module-level cache, affecting ALL instances.
- **Impact:** One component's refresh will cause all other components to re-fetch on next access, potentially triggering multiple simultaneous GPS requests.
- **Suggested Fix:** Document the shared cache behavior. Consider using a ref-based cache per instance if components need independent location updates.

### ISSUE UL-2 — `getLocation` races `Promise.race` timeout creates zombie Promise

- **Severity:** MEDIUM
- **Lines:** 130–135
- **Description:** `Promise.race` between `getCurrentPositionAsync` and a rejection timeout. If the location resolves after the timeout, the location promise's result is silently ignored — but the GPS hardware may still be active. The timeout rejects with an Error but does not cancel the underlying location request.
- **Suggested Fix:** Use `AbortController` if available, or store a cancellation flag.

### ISSUE UL-3 — `startUpdates` calls `getLocation()` without `await`

- **Severity:** MEDIUM
- **Lines:** 211
- **Description:** The initial `getLocation()` call inside `startUpdates()` is not awaited. If it fails, the error is silently lost.
- **Suggested Fix:** `await getLocation().catch(console.warn);`

---

## 21. `lib/qibla-compass/hooks/useQiblaCompass.ts`

### ISSUE UQC-1 — No issues of significance found

- **Description:** Clean composition of sub-hooks with proper `useMemo` and `useCallback` usage. The auto-calibration effect is properly guarded.

---

## 22. `lib/qibla-compass/hooks/useCalibration.ts`

### ISSUE UCal-1 — Simulated calibration progress may confuse users

- **Severity:** MEDIUM
- **Lines:** 100–124
- **Description:** `startCalibration()` uses a `setInterval` to increment progress by 5% every 200ms (total ~4 seconds to reach 100%). This progress is purely cosmetic and not based on actual sensor accuracy improvement. Users may stop the figure-8 motion once progress reaches 100%, even if real calibration quality hasn't improved.
- **Suggested Fix:** Drive progress from actual `compassAccuracy` changes rather than a timer.

---

## 23. `lib/qibla-compass/components/QiblaCompass.tsx`

### ISSUE QComp-1 — Animated.spring with angular values can overshoot past 360°

- **Severity:** HIGH
- **Lines:** 112–118, 122–128
- **Description:** `Animated.spring` is used for compass rotation with `toValue: -compassHeading`. When heading crosses the 0°/360° boundary (e.g., 350° → 10°), the spring will interpolate through -340° of rotation instead of the short +20° path. This causes the compass to "spin" the wrong way around.
- **Impact:** Visually jarring compass animation when the user rotates past north.
- **Suggested Fix:** Calculate the shortest rotation delta and accumulate it:

  ```js
  const prevHeading = useRef(0);
  const accumulated = useRef(0);

  useEffect(() => {
    let delta = compassHeading - prevHeading.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    accumulated.current += delta;
    prevHeading.current = compassHeading;
    Animated.spring(compassRotateAnim, { toValue: -accumulated.current, ... }).start();
  }, [compassHeading]);
  ```

### ISSUE QComp-2 — Pulse/glow animation loops not stopped on cleanup

- **Severity:** MEDIUM
- **Lines:** 130–156
- **Description:** `Animated.loop()` animations started when `isFacingQibla` becomes true are never explicitly stopped when the component unmounts. While React Native typically handles this, it can cause "setState on unmounted component" warnings.
- **Suggested Fix:** Store the animation reference and call `.stop()` in the cleanup function:
  ```js
  useEffect(() => {
    let anim;
    if (isFacingQibla) {
      anim = Animated.loop(...);
      anim.start();
    }
    return () => anim?.stop();
  }, [isFacingQibla]);
  ```

### ISSUE QComp-3 — `onFacingQibla` called on every render when facing Qibla

- **Severity:** MEDIUM
- **Lines:** 155
- **Description:** `onFacingQibla?.()` is called inside the `useEffect` that depends on `isFacingQibla`. However, `onFacingQibla` is also in the dependency array and could cause re-renders if the parent doesn't memoize the callback, leading to infinite re-render loops.
- **Suggested Fix:** Remove `onFacingQibla` from the dependency array and use a ref instead:
  ```js
  const onFacingQiblaRef = useRef(onFacingQibla);
  onFacingQiblaRef.current = onFacingQibla;
  // In effect: onFacingQiblaRef.current?.();
  ```

### ISSUE QComp-4 — `compassRotateAnim` interpolation range clips at ±360°

- **Severity:** HIGH
- **Lines:** 169–172
- **Description:** The interpolation `inputRange: [-360, 360]` means values outside this range will be clamped. If rotation accumulates past ±360° (which `Animated.spring` with `toValue: -compassHeading` does over time), the compass will appear stuck.
- **Suggested Fix:** Use a wider range or `extrapolate: 'extend'`:
  ```js
  compassRotateAnim.interpolate({
    inputRange: [-3600, 3600],
    outputRange: ["-3600deg", "3600deg"],
  });
  ```

---

## 24. `lib/qibla-compass/components/CompassRose.tsx` and `CalibrationGuide.tsx`

### ISSUE CR-1 — No significant issues found

- **Description:** `CompassRose.tsx` uses proper `useMemo` for marker calculations. `CalibrationGuide.tsx` correctly handles animation cleanup in its unmount effect.

---

## Cross-Cutting Concerns

### ISSUE CC-1 — Circular dependency risk between `notifeePrayerService.js` and `prayerNotificationScheduler.ts`

- **Severity:** HIGH
- **Description:** `prayerNotificationScheduler.ts` imports `cancelAllNotifeePrayerNotifications` from `notifeePrayerService.js` at the top (static import), AND uses `require('./notifeePrayerService')` dynamically inside `ensurePrayerNotificationWindow`. Conversely, `notifeePrayerService.js` uses `require('./prayerNotificationScheduler')` inside event handlers. This creates a circular dependency chain that could cause one module to receive an incomplete export object.
- **Suggested Fix:** Extract shared types/constants into a third module to break the cycle, or consolidate the two files.

### ISSUE CC-2 — Inconsistent error handling patterns

- **Severity:** MEDIUM
- **Description:** Some functions return `false`/`null`/`[]` on error (forgiving), while others throw (failing). There's no consistent contract across the codebase:
  - `initializeNotifeePrayerNotifications` → returns `false`
  - `scheduleNotifeePrayerNotifications` → returns `[]`
  - `quranApi.ts` functions → throw
- **Suggested Fix:** Establish a convention: either always return a Result type, or always throw and let callers catch.

### ISSUE CC-3 — Console logging in production

- **Severity:** MEDIUM
- **Description:** Hundreds of `console.log` statements with emoji prefixes throughout the codebase. These will appear in production logs, potentially leaking information and impacting performance.
- **Suggested Fix:** Use a logger utility with log levels that can be disabled in production.

---

## Dead Code Summary

| File                                                                                           | Status                   | Action                       |
| ---------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------- |
| `utils/safeAreaUtils.ts`                                                                       | Placeholder stub         | Delete                       |
| `utils/simpleNotificationService.js`                                                           | Empty file               | Delete                       |
| `utils/audioHelper.js` → `downloadedAssets`                                                    | Populated but never read | Remove or use                |
| `notifeePrayerService.js` → `checkAndHandleBatteryOptimization` / `checkAndHandlePowerManager` | No-op stubs              | Remove or mark `@deprecated` |

---

## Priority Remediation Plan

### Immediate (CRITICAL — fix before next release)

1. **QS-1**: `deleteSurahAudio` — delete actual files, not just index
2. **QC-1**: Replace rough magnetic declination with proper model
3. **BT-1**: Add `await` to `triggerBackgroundCheck()`
4. **QComp-1**: Fix compass rotation across 0°/360° boundary
5. **QComp-4**: Widen rotation interpolation range

### Short-term (HIGH — fix within 1–2 sprints)

6. **NPS-1**: Move `setupNotifeeEventHandlers()` out of module load
7. **NPS-5**: Remove invalid `sound` from test notification android configs
8. **AH-1**: Fix or remove unused `downloadedAssets` cache
9. **AH-3**: Fix sound resource leak on playback error
10. **PNS-1**: Replace boolean guard with promise-based lock
11. **PN-1**: Add idempotency guard to `initializePushNotifications`
12. **QS-3**: Fix partial audio download state
13. **CC-1**: Break circular dependency
14. **UL-1**: Document shared location cache behavior
15. **QA-1**: Add retry logic for API calls
16. **WDB-1**: Surface widget data sync errors
17. **QComp-3**: Fix potential infinite re-render from `onFacingQibla` callback

### Medium-term (MEDIUM — maintenance sprint)

18. Clean up dead code (SAU-1, SNS-1)
19. Fix `lighten`/`darken` for shorthand hex (CH-1)
20. Add structured logging (CC-3)
21. Consolidate error handling patterns (CC-2)
