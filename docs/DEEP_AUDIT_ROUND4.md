# Deep Audit — Round 4

> Generated line-by-line from every file listed in the audit scope.  
> **Only NEW issues** — previously-fixed items are excluded.

---

## Legend

| Tag            | Meaning                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| **[CRITICAL]** | Will cause crashes, data loss, or silent notification failures in production              |
| **[HIGH]**     | Incorrect behaviour users will notice (wrong times, double notifications, broken compass) |
| **[MEDIUM]**   | Edge-case bugs, resource leaks, or non-obvious correctness issues                         |
| **[LOW]**      | Code smells, perf waste, maintainability, dead code                                       |

---

## Findings

### 1. Conflicting `onBackgroundEvent` Registrations — Silent Handler Clobbering

**[CRITICAL]** [androidAlarmManager.js](utils/androidAlarmManager.js#L243-L259) **+ [index.ts](index.ts#L54)**

Notifee allows **exactly one** `onBackgroundEvent` handler ([docs](https://notifee.app/react-native/docs/events#background-events)). `index.ts:54` registers a top-level handler for rolling-window top-up. `setupAndroidAlarmHandler()` at `androidAlarmManager.js:243` registers a **second** handler. The **last one registered wins** — whichever loads last silently replaces the other.

- If `setupAndroidAlarmHandler()` runs after app startup → the rolling-window maintenance handler is destroyed → notifications stop being replenished → prayers eventually go silent.
- If it never runs → the alarm sound playback handler never fires.

**Fix:** Merge both handlers into the single top-level `onBackgroundEvent` in `index.ts`. Branch on `notification.data.type` to decide whether to top-up the rolling window or play alarm audio.

---

### 2. audioHelper.js — Sound Unloaded While Still Playing (5 s Hardcoded Timeout)

**[CRITICAL]** [audioHelper.js](utils/audioHelper.js#L110-L115)

```js
setTimeout(async () => {
  try { await sound.unloadAsync(); } catch (e) { … }
}, 5000);
```

The azan recording is typically **60–120 seconds** long. `unloadAsync()` fires after only 5 seconds, killing playback mid-azan. The user hears ~5 seconds of azan, then silence.

**Fix:** Listen for the `onPlaybackStatusUpdate` event and unload only after `didJustFinish === true`:

```js
sound.setOnPlaybackStatusUpdate((status) => {
  if (status.didJustFinish) {
    sound.unloadAsync().catch(() => {});
  }
});
```

---

### 3. `useCompass.ts` — `isMountedRef` Never Reset After Dependency-Triggered Re-run

**[CRITICAL]** [useCompass.ts](lib/qibla-compass/hooks/useCompass.ts#L210-L218)

```ts
useEffect(() => {
  if (autoStart) {
    start();
  }
  return () => {
    isMountedRef.current = false; // ← set to false on cleanup
    stop();
  };
}, [autoStart, start, stop]);
```

When `start` gets a new reference (because `processSensorData` deps changed), the effect cleans up → `isMountedRef.current = false` → then re-runs `start()`. Inside `start()`, every `setCompass()` / `setIsLoading()` call is gated by `if (isMountedRef.current)` — which is still **false**. All sensor data is silently discarded.

**Fix:** Set `isMountedRef.current = true` at the top of the effect body, before calling `start()`.

---

### 4. Dual Notification Systems Can Cancel Each Other's Work

**[HIGH]** [notifeePrayerService.js](utils/notifeePrayerService.js#L667) **vs** [prayerNotificationScheduler.ts](utils/prayerNotificationScheduler.ts#L82)

Two independent scheduling systems co-exist:

| System                                     | ID Pattern               | Repeat?                 | Entry Point                            |
| ------------------------------------------ | ------------------------ | ----------------------- | -------------------------------------- |
| Legacy (`notifeePrayerService.js`)         | `prayer-fajr`            | `RepeatFrequency.DAILY` | `scheduleNotifeePrayerNotifications()` |
| Rolling (`prayerNotificationScheduler.ts`) | `prayer-fajr-2025-06-15` | Single-fire             | `scheduleDay()`                        |

`cancelAllNotifeePrayerNotifications()` (line 788) cancels **all** IDs starting with `prayer-`, which includes the rolling scheduler's date-suffixed IDs. Any call to the legacy `scheduleNotifeePrayerNotifications` or `updateNotifeePrayerNotifications` **destroys the rolling window** and replaces it with the legacy daily-repeat system.

Similarly, `forceRefreshPrayerNotifications()` (line 1645) calls the legacy scheduler, not the rolling one.

**Fix:** Deprecate or delete the legacy `scheduleNotifeePrayerNotifications()`. Route all scheduling through `forceRescheduleAllNotifications()` from the rolling scheduler. Update `forceRefreshPrayerNotifications()` to call the rolling scheduler's `forceRescheduleAllNotifications()`.

---

### 5. `backgroundTask.js:76` — Missing `await` Causes Silent Swallowed Errors

**[HIGH]** [backgroundTask.js](utils/backgroundTask.js#L74-L77)

```js
export async function triggerBackgroundCheck() {
  try {
    const {
      ensurePrayerNotificationWindow,
    } = require("./prayerNotificationScheduler");
    ensurePrayerNotificationWindow(); // ← no await
  } catch {}
}
```

`ensurePrayerNotificationWindow()` returns a `Promise`. Without `await`, any scheduling error inside it is silently swallowed. The surrounding `try/catch` only catches synchronous `require()` failures — asynchrounous errors vanish.

**Fix:** Add `await` before the call:

```js
await ensurePrayerNotificationWindow();
```

---

### 6. Qibla Compass Shows Magnetic North, Not True North — Declination Never Applied

**[HIGH]** [qiblaCalculations.ts](lib/qibla-compass/utils/qiblaCalculations.ts#L200-L232) **+ [useQiblaCompass.ts](lib/qibla-compass/hooks/useQiblaCompass.ts#L73)**

`calculateQiblaDirection()` returns a **true (geographic) bearing** from the user to the Kaaba. But `compass.heading` from `useCompass` is a **magnetic heading** (no declination correction applied). The resulting `qiblaRotation = qiblaDirection - compassHeading` is off by the magnetic declination:

- Middle East: 1-4° (usually within the 5° threshold)
- East Asia: 5-10°
- Americas: 5-20°
- Northern Europe: 5-15°

`estimateMagneticDeclination()` is defined but **never called anywhere** in the codebase.

**Fix:** Apply declination correction to the compass heading in `useQiblaCompass`:

```ts
const correctedHeading =
  compass.heading +
  estimateMagneticDeclination(location.latitude, location.longitude);
```

Or use a proper WMM library for higher accuracy.

---

### 7. `QiblaCompass.tsx` — Animated.loop Never Stopped on State Change

**[MEDIUM]** [QiblaCompass.tsx](lib/qibla-compass/components/QiblaCompass.tsx#L135-L163)

```tsx
useEffect(() => {
  if (isFacingQibla) {
    Animated.loop(…).start();   // starts infinite loop
  } else {
    pulseAnim.setValue(1);       // ← doesn't stop the running loop
    glowAnim.setValue(0);
  }
}, [isFacingQibla, …]);
```

When `isFacingQibla` changes to `false`, `setValue()` is called but the `Animated.loop` from the previous render is still running and immediately overwrites the value on its next cycle. The pulse/glow animations continue indefinitely.

There is also no cleanup in the effect's return, so on unmount the loops continue running until GC.

**Fix:** Store the animation references and `.stop()` them:

```tsx
const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
// In the effect:
if (isFacingQibla) {
  pulseLoopRef.current = Animated.loop(…);
  pulseLoopRef.current.start();
} else {
  pulseLoopRef.current?.stop();
  pulseAnim.setValue(1);
}
// In cleanup:
return () => { pulseLoopRef.current?.stop(); };
```

---

### 8. `useCalibration.ts` — Simulated Progress Has No Relation to Actual Sensor Calibration

**[MEDIUM]** [useCalibration.ts](lib/qibla-compass/hooks/useCalibration.ts#L103-L126)

`startCalibration()` creates a `setInterval` that increments progress by 5% every 200ms (completes in exactly 4 seconds). This is purely cosmetic — it gives the user feedback that "calibration is complete" regardless of whether the magnetometer actually stabilized. The `completeCalibration` callback from `useQiblaCompass` can fire based on actual sensor quality, but the 4-second timer will also mark it as CALIBRATED independently.

**Fix:** Remove the simulated progress timer. Drive progress from actual `compassAccuracy` improvements reported by `useCompass`. Only mark as CALIBRATED when sensor quality reaches MEDIUM or better.

---

### 9. `notifeePrayerService.js` Module-Load Side Effect

**[MEDIUM]** [notifeePrayerService.js](utils/notifeePrayerService.js#L1200) (approximate — near end of file)

```js
// Initialize event handlers when module loads
setupNotifeeEventHandlers();
```

`setupNotifeeEventHandlers()` is called at **module evaluation time** (top-level side effect). This means merely `require()`-ing the module (e.g., from `prayerNotificationScheduler.ts`) immediately registers foreground event listeners, even if the app hasn't initialized channels yet. This can cause "channel not found" errors for notifications received before `initializeNotifeePrayerNotifications()` completes.

**Fix:** Move `setupNotifeeEventHandlers()` inside `initializeNotifeePrayerNotifications()` (after channel creation), guarded by a flag to prevent double-registration.

---

### 10. `RevenueCatContext.tsx` — Production Android Debug Logging

**[MEDIUM]** [RevenueCatContext.tsx](app/contexts/RevenueCatContext.tsx#L57-L62)

```tsx
const debugLog = (...args: any[]) => {
  if (IS_ANDROID || (__DEV__ && VERBOSE_RC)) {
    console.log(...args);
  }
};
```

`IS_ANDROID` is always `true` on Android production builds. Combined with the `console.log` calls in `fetchOfferings`, `fetchProducts`, and throughout the provider, this causes RevenueCat debug logs to appear in production logcat output — leaking internal product IDs, pricing structures, and entitlement information.

**Fix:** Change condition to `__DEV__ && (IS_ANDROID || VERBOSE_RC)` or remove the `IS_ANDROID` override entirely.

---

### 11. Production `console.log` Saturation Across Notification Stack

**[MEDIUM]** Multiple files

The following files contain unguarded `console.log()` calls that fire in production builds:

| File                                                                   | Approx. Count | Examples                                                                |
| ---------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------- |
| [notifeePrayerService.js](utils/notifeePrayerService.js)               | ~80+          | `"🚀 Initializing..."`, `"✅ Scheduled..."`, `"🔊 Sound preference..."` |
| [prayerNotificationScheduler.ts](utils/prayerNotificationScheduler.ts) | ~30+          | `"✅ Window scheduled..."`, `"🌍 Timezone changed..."`                  |
| [androidAlarmManager.js](utils/androidAlarmManager.js)                 | ~20+          | `"⏰ === SCHEDULING..."`, `"✅ Scheduled alarm..."`                     |
| [backgroundTask.js](utils/backgroundTask.js)                           | ~5            | `"BackgroundFetch register failed"`                                     |
| [pushNotifications.ts](utils/pushNotifications.ts)                     | ~15           | `"📱 Setting up..."`, `"🔥 Topic subscribed..."`                        |
| [audioHelper.js](utils/audioHelper.js)                                 | ~15           | `"Playing sound..."`, `"Sound preloading complete"`                     |

Each prayer notification cycle can generate 50+ log lines. On older Android devices, this can cause measurable UI thread stuttering.

**Fix:** Wrap all non-error logs in `if (__DEV__)` guards, or use a centralized logger that no-ops in production:

```js
const log = __DEV__ ? console.log : () => {};
```

---

### 12. `useLocation.ts` — Location Promise Rejection Can Cause Unhandled Rejection

**[MEDIUM]** [useLocation.ts](lib/qibla-compass/hooks/useLocation.ts#L119-L126)

```ts
const locationResult = await Promise.race([
  Location.getCurrentPositionAsync({ accuracy: desiredAccuracy }),
  new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("Location timeout")), 15000),
  ),
]);
```

When the timeout fires first and the `Promise.race` settles with the rejection, the **other** promise (`getCurrentPositionAsync`) is still pending. When it eventually resolves, its result is silently discarded (fine). But if it **rejects**, that rejection is unhandled because nobody is listening to it anymore.

**Fix:** Use `AbortController` for location timeout, or attach a `.catch(() => {})` to the location promise:

```ts
const locationPromise = Location.getCurrentPositionAsync({
  accuracy: desiredAccuracy,
});
locationPromise.catch(() => {}); // prevent unhandled rejection
const locationResult = await Promise.race([locationPromise, timeoutPromise]);
```

---

### 13. `sensorFusion.ts` — `isDeviceFlat` Threshold Inconsistency

**[LOW]** [sensorFusion.ts](lib/qibla-compass/utils/sensorFusion.ts#L190-L197) **vs** [useCompass.ts](lib/qibla-compass/hooks/useCompass.ts#L121)

`isDeviceFlat()` in sensorFusion.ts uses a default threshold of **30°**. But `useCompass.ts:121` passes **35°**:

```ts
const deviceFlat = isDeviceFlat(filteredAcc, 35);
```

The 5° discrepancy means any code calling `isDeviceFlat()` without an argument gets different behaviour than the compass hook. This is a maintainability issue — the "flat" definition varies depending on the caller.

**Fix:** Align the defaults. Either change the default parameter to 35° or pass the threshold explicitly everywhere.

---

### 14. `localPrayerData.js` — Hijri Date Approximation Drift

**[LOW]** [localPrayerData.js](utils/localPrayerData.js) (getHijriDate function)

The Hijri date is calculated using a fixed epoch (July 16, 622 CE) and a constant cycle of 354.37 days/year. The actual Islamic calendar is observation-based (new month starts with the sighting of the crescent moon). Over time, this approximation drifts:

- Can be off by **1–3 days** in any given month
- Accumulates ~1 day error every 2–3 years

If users rely on this for religious observances (Ramadan start/end, Eid dates), they could be misled.

**Fix:** Either label the Hijri date prominently as "approximate" in the UI, or use the Umm al-Qura calendar algorithm (used by Saudi Arabia) for better accuracy. Libraries like `@pashio/hijri-converter` implement this.

---

### 15. `androidAlarmManager.js` — `repeatFrequency: 1` Magic Number

**[LOW]** [androidAlarmManager.js](utils/androidAlarmManager.js#L112)

```js
repeatFrequency: 1, // Daily
```

Uses a raw number `1` instead of the imported `RepeatFrequency.DAILY` enum. While it works because `RepeatFrequency.DAILY === 1`, it's brittle and breaks if Notifee changes enum values.

**Fix:** Use `RepeatFrequency.DAILY` (already imported but unused).

---

### 16. `LanguageContext.js` — Stale `changeLanguage` Closure in useEffect

**[LOW]** [LanguageContext.js](contexts/LanguageContext.js#L19-L30)

```js
useEffect(() => {
  const loadLanguage = async () => {
    const savedLang = await AsyncStorage.getItem("app_language");
    if (savedLang) {
      changeLanguage(savedLang);
    }
  };
  loadLanguage();
}, []); // ← changeLanguage not in deps
```

`changeLanguage` is defined in the component body and changes on every render (it's not wrapped in `useCallback`). The empty dependency array captures the initial-render version. Currently benign because `changeLanguage` only uses stable state setters and AsyncStorage, but ESLint's `exhaustive-deps` rule would flag this.

**Fix:** Wrap `changeLanguage` in `useCallback` and add it to the dependency array, or inline the loading logic.

---

### 17. `notifeePrayerService.js` — `cancelAllNotifeePrayerNotifications` Accesses Data on Wrong Object

**[LOW]** [notifeePrayerService.js](utils/notifeePrayerService.js#L795-L800)

```js
const displayedNotifications = await notifee.getDisplayedNotifications();
for (const notification of displayedNotifications) {
  const t = notification.notification?.data?.type;
```

`getDisplayedNotifications()` returns an array of `DisplayedNotification` objects. The correct path is `notification.notification.data.type` — the double `.notification` is because the wrapper object has a `.notification` property containing the actual notification object. While this technically works in Notifee's current API, it's confusing and can break if the return type changes.

**Fix:** Destructure for clarity:

```js
const { notification: notifData } = displayedNotif;
const t = notifData?.data?.type;
```

---

### 18. `ThemeContext.js` — Animated Transition Overlay Blocks Touch Input

**[LOW]** [ThemeContext.js](contexts/ThemeContext.js#L196-L206)

```js
<Animated.View
  pointerEvents="none"
  style={{
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: prevBg,
    opacity: transitionProgress,
    zIndex: 9999,
  }}
/>
```

While `pointerEvents="none"` correctly passes through touches, the `zIndex: 9999` overlay renders above **everything** including modals and alerts. During the 450ms transition animation, any element with `zIndex < 9999` may experience visual glitches (rendering under the color overlay). Not a touch-blocking issue, but a visual layering concern.

**Fix:** Use a lower `zIndex` or render inside a portal that's positioned correctly in the view hierarchy.

---

### 19. Dead Code: `createPrayerNotificationChannel` Alias

**[LOW]** [notifeePrayerService.js](utils/notifeePrayerService.js#L500)

```js
const createPrayerNotificationChannel = createPrayerNotificationChannels;
```

This backward-compatibility alias is defined but never exported and has zero references in the codebase (the non-plural version isn't called anywhere).

**Fix:** Remove the dead alias.

---

### 20. Dead Code: `checkAndHandleBatteryOptimization` and `checkAndHandlePowerManager`

**[LOW]** [notifeePrayerService.js](utils/notifeePrayerService.js#L1284-L1299)

Both functions are stubs that return `true`:

```js
export async function checkAndHandleBatteryOptimization() {
  return true;
}
export async function checkAndHandlePowerManager() {
  return true;
}
```

If no callers exist, these are dead code. If callers exist, they give a false sense of security (caller thinks optimization was checked, but nothing happened).

**Fix:** Either remove entirely or add deprecation JSDoc pointing callers to `requestEssentialPermissions()`.

---

### 21. `global.d.ts` — Redundant/Conflicting Global Declaration

**[LOW]** [global.d.ts](types/global.d.ts#L1-L9)

```ts
declare global {
  var showTestNotification: () => void;
  var global: {
    showTestNotification?: () => void;
  };
}
```

`global.global` is self-referential and doesn't match the actual Node/RN global shape. The inner declaration shadows the standard `globalThis.global` without adding value.

**Fix:** Remove the inner `var global` declaration. Keep only `var showTestNotification`.

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 3      |
| HIGH      | 3      |
| MEDIUM    | 5      |
| LOW       | 10     |
| **Total** | **21** |

### Top 5 Priority Fixes

1. **#1 — Conflicting `onBackgroundEvent`** → Merge into single handler (prevents silent notification failure)
2. **#2 — Azan cut off at 5 seconds** → Use `onPlaybackStatusUpdate` (user-facing audio breakage)
3. **#3 — `isMountedRef` never reset** → Add `isMountedRef.current = true` (compass completely breaks after prop change)
4. **#4 — Dual notification systems** → Deprecate legacy scheduler (prevents double/missing notifications)
5. **#6 — No magnetic declination** → Apply correction (Qibla direction off for many locations)
