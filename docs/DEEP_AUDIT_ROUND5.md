# ULTRA-DEEP Code Audit — Round 5

**Focus:** Concurrency, Async Race Conditions, State Corruption  
**Date:** 2025-07-14  
**Status:** All critical/high findings fixed; medium fixes applied where warranted  
**Tests:** 197/197 passing, 0 compile errors

---

## Scope

| #   | File                                   | Lines |
| --- | -------------------------------------- | ----- |
| 1   | `hooks/home/useHomePrayerData.ts`      | 925   |
| 2   | `hooks/home/useHomeNotifications.ts`   | 343   |
| 3   | `hooks/quran/useQuranAudio.ts`         | 449   |
| 4   | `hooks/quran/useQuranData.ts`          | 339   |
| 5   | `hooks/home/useHomeRegion.ts`          | ~120  |
| 6   | `hooks/home/useHomeAppStateSync.ts`    | ~60   |
| 7   | `index.ts`                             | ~80   |
| 8   | `app/_layout.tsx`                      | 540   |
| 9   | `utils/prayerNotificationScheduler.ts` | 508   |
| 10  | `utils/notifeePrayerService.js`        | ~1220 |
| 11  | `utils/localPrayerData.js`             | ~200  |
| 12  | `utils/backgroundTask.js`              | 85    |

---

## Previously Fixed (Rounds 1–4) — NOT re-reported

1. Division-by-zero in progress ring
2. `soundRef` assigned after `playAsync`
3. `last_notification_scheduled` not cleared on region change
4. Untracked `setTimeout`s in `useHomeNotifications`
5. Pulse animation leak in `qibla.tsx`
6. Production `console.log` silencer
7. `SepiaColors` hardcoded bypassing dark mode
8. Audio 5-second timeout in `audioHelper`

---

## Findings

### Finding 1 — `playAyah` leaves broken sound object in `soundRef` on error ✅ FIXED

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| **Severity** | CRITICAL                                |
| **Category** | Resource leak / state corruption        |
| **File**     | `hooks/quran/useQuranAudio.ts` L330–345 |

**Bug:** When `Audio.Sound.createAsync` succeeds but the subsequent `playAsync()` throws (e.g. audio focus denied, codec error), the `catch` block showed an alert but left `soundRef.current` pointing at the half-initialised sound. Subsequent `togglePlayPause()` calls would call `getStatusAsync()` on the zombied object, throwing again and falling through to `playAyah(0)` — so the user tries to pause but instead gets a restart from ayah 1.

**Reproduction:** Trigger an audio focus conflict (e.g. start a phone call while audio is loading), then tap the play/pause button.

**Fix applied:** The `catch` block now unloads the orphaned sound and nullifies the ref:

```ts
catch (e: any) {
    if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch { }
        soundRef.current = null;
    }
    Alert.alert(t('audioError'), t('audioErrorMsg'));
}
```

---

### Finding 2 — `togglePlayPause` races against `soundRef` nullification ✅ FIXED

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| **Severity** | HIGH                                    |
| **Category** | Async race condition                    |
| **File**     | `hooks/quran/useQuranAudio.ts` L349–375 |

**Bug:** `togglePlayPause` checked `soundRef.current` for null, then awaited `getStatusAsync()`. During that await the surah-change cleanup effect could run, calling `stopAsync()` / `unloadAsync()` / `soundRef.current = null`. The subsequent `soundRef.current.pauseAsync()` would then throw a TypeError.

**Reproduction:** Rapidly switch surahs while audio is playing; tap play/pause during the transition.

**Fix applied:** Capture the sound into a local variable before the await and re-check after:

```ts
const sound = soundRef.current;
const status = await sound.getStatusAsync();
if (!soundRef.current || soundRef.current !== sound) return;
```

---

### Finding 3 — `ensurePrayerNotificationWindow` coalescing lock drops scheduling on mid-run setting changes ✅ FIXED

| Field        | Value                                           |
| ------------ | ----------------------------------------------- |
| **Severity** | HIGH                                            |
| **Category** | Async race / lost update                        |
| **File**     | `utils/prayerNotificationScheduler.ts` L262–283 |

**Bug:** The original implementation used simple promise-coalescing: if a scheduling run was already in flight, a second caller would `await ensurePromise` then return without doing any work. If the reason for the second call was a settings change (e.g. user toggled a prayer's sound on/off), the change would be silently ignored — the first run read the old settings, and the second never ran.

This was especially dangerous when `forceRescheduleAllNotifications()` called `cancelAll()` then `ensurePrayerNotificationWindow()`. If the maintainer's AppState listener happened to trigger a concurrent run:

1. Run A reads old settings, starts scheduling day 1.
2. `forceRescheduleAllNotifications` calls `cancelAll()` — cancels days already scheduled by A.
3. `forceRescheduleAllNotifications` calls `ensurePrayerNotificationWindow()` — sees `ensurePromise ≠ null`, awaits A, returns without rescheduling.
4. Result: partially cancelled, partially stale-settings notifications.

**Fix applied:** Replaced simple coalescing with a dirty-flag `do/while` loop:

```ts
export async function ensurePrayerNotificationWindow() {
  if (ensurePromise) {
    ensureDirty = true;
    await ensurePromise;
    return;
  }
  do {
    ensureDirty = false;
    ensurePromise = _ensurePrayerNotificationWindowImpl();
    try {
      await ensurePromise;
    } finally {
      ensurePromise = null;
    }
  } while (ensureDirty);
}
```

If a second caller arrives while a run is in progress, `ensureDirty` is set. When the current run finishes, the loop re-runs with fresh settings.

---

### Finding 4 — `onPrayerNotificationDelivered` uses fire-and-forget `setTimeout` in background handler ✅ FIXED

| Field        | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| **Severity** | HIGH                                                            |
| **Category** | Background task / async correctness                             |
| **File**     | `utils/prayerNotificationScheduler.ts` L475–482, `index.ts` L79 |

**Bug:** The original:

```ts
export async function onPrayerNotificationDelivered() {
  setTimeout(() => ensurePrayerNotificationWindow(), 2000);
}
```

The function was `async` but returned immediately — the actual work was deferred to a setTimeout. In `index.ts`, the background handler did `await onPrayerNotificationDelivered()`, believing it waited for the window maintenance. In reality the handler returned in ~0 ms, the OS reclaimed the JS context, and the setTimeout never fired. Rolling-window notifications were never extended after delivery.

**Fix applied:** Replaced with inline await:

```ts
export async function onPrayerNotificationDelivered() {
  await new Promise((resolve) => setTimeout(resolve, 500));
  await ensurePrayerNotificationWindow();
}
```

The background handler now genuinely awaits the work.

---

### Finding 5 — `notifScheduleTimerRef` + `innerRetryTimerRef` overwritten without clearing previous ✅ FIXED

| Field        | Value                                                |
| ------------ | ---------------------------------------------------- |
| **Severity** | HIGH                                                 |
| **Category** | Timer leak / double-fire                             |
| **File**     | `hooks/home/useHomePrayerData.ts` L207–208, L233–235 |

**Bug:** If `fetchAndCachePrayerTimes` was called twice in quick succession (e.g. from effect re-run + clearCache in the same second), both `notifScheduleTimerRef.current` and `innerRetryTimerRef.current` were overwritten with new timeouts without clearing the old ones. The orphaned timeouts still fired, causing double-scheduling or double-retry.

**Fix applied:** Added `clearTimeout` before each overwrite:

```ts
// notifScheduleTimerRef
if (notifScheduleTimerRef.current) clearTimeout(notifScheduleTimerRef.current);
notifScheduleTimerRef.current = setTimeout(async () => { ... }, 1000);

// innerRetryTimerRef
if (innerRetryTimerRef.current) clearTimeout(innerRetryTimerRef.current);
innerRetryTimerRef.current = setTimeout(() => { ... }, delay);
```

---

### Finding 6 — `updateNextPrayer` not memoised — defeats `updateCountdown` useCallback ⚠️ DOCUMENTED

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| **Severity** | MEDIUM                                       |
| **Category** | Performance / unnecessary re-creation        |
| **File**     | `hooks/home/useHomePrayerData.ts` L336, L685 |

**Bug:** `updateNextPrayer` is defined as a plain function (not wrapped in `useCallback`). It appears in `updateCountdown`'s dependency array (L685). Since `updateNextPrayer` is a new reference every render, `updateCountdown` is also re-created every render — negating its `useCallback` wrapper.

**Impact:** Not a correctness bug because `updateCountdownRef.current` is always synced to the latest `updateCountdown` (the ref-forwarding pattern). The 1-second interval never rebuilds. However, it is ~60 wasted `useCallback` re-creations per minute on the home screen.

**Recommended fix (not applied — optional optimisation):**

```ts
const updateNextPrayer = useCallback(
  (data: PrayerData): void => {
    // ... same body ...
  },
  [currentDay],
); // only depends on currentDay for findNextPrayer
```

Or remove `updateNextPrayer` from `updateCountdown`'s deps since the ref-forwarding pattern makes it safe.

---

### Finding 7 — Stale `notificationsEnabled` in `clearCache` called from midnight interval ✅ FIXED

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| **Severity** | MEDIUM                                 |
| **Category** | Stale closure                          |
| **File**     | `hooks/home/useHomePrayerData.ts` L726 |

**Bug:** `clearCache` read `notificationsEnabled` directly from state (the `params.notificationsEnabled` closure). `checkDayChange` called `clearCache(false)` at midnight. `checkDayChange` was captured by the `setInterval` inside the main data effect, whose deps **did not include `notificationsEnabled`**. So if the user toggled notifications on/off, the interval's closure still had the old value.

**Scenario:**

1. App starts with notifications OFF → effect runs, interval captures `notificationsEnabled=false`.
2. User enables notifications.
3. Midnight: interval fires `checkDayChange()` → `clearCache(false)`.
4. `clearCache` tests `if (notificationsEnabled)` — stale value `false` — skips rescheduling.
5. Notifications for the new day are never scheduled until the app is foregrounded.

**Impact:** Partially mitigated by the 60-second health check in `useHomeNotifications` (which uses refs). But if the user enables notifications at night and leaves the app in background, they will miss Fajr until the 60-second health check runs after next foreground.

**Fix applied:** Added `notificationsEnabledLocalRef` (a ref synced via `useEffect`) and changed `clearCache` to read from the ref:

```ts
const notificationsEnabledLocalRef = useRef(notificationsEnabled);
useEffect(() => { notificationsEnabledLocalRef.current = notificationsEnabled; }, [notificationsEnabled]);

// In clearCache:
if (notificationsEnabledLocalRef.current) { ...
```

---

### Finding 8 — `Audio.setAudioModeAsync` failure silently swallowed ✅ FIXED

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| **Severity** | MEDIUM                                 |
| **Category** | Swallowed promise rejection            |
| **File**     | `hooks/quran/useQuranAudio.ts` L96–103 |

**Bug:** The `.catch(() => {})` on `Audio.setAudioModeAsync` swallowed all errors. If the call failed (e.g. audio session conflict on iOS), `playsInSilentModeIOS: true` and `staysActiveInBackground: true` would not take effect. The user would hear no Quran audio when the phone is on silent — with zero diagnostic output.

**Fix applied:** Changed to log the error:

```ts
.catch((e) => {
    console.error('⚠️ Audio mode setup failed — playback in silent/background may not work:', e);
});
```

---

### Finding 9 — InAppNotification double-dismiss race ✅ FIXED

| Field        | Value                          |
| ------------ | ------------------------------ |
| **Severity** | MEDIUM                         |
| **Category** | Double-fire / state corruption |
| **File**     | `app/_layout.tsx` L28–66       |

**Bug:** The `InAppNotification` component had both a 7-second auto-dismiss timer and a manual ✕ button, both calling `dismiss()`. If the user tapped ✕ while the timer was about to fire (< 300ms window), `dismiss()` could run twice, starting two slide-out animations and calling `onClose()` twice — re-setting the parent's notification state mid-transition.

**Fix applied:** Added a `dismissedRef` guard:

```ts
const dismissedRef = useRef(false);
const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    Animated.timing(translateY, { ... }).start(() => onClose());
};
```

---

### Finding 10 — `startPrayerNotificationWindowMaintainer` AppState sub not cleaned when notifications disabled ✅ FIXED

| Field        | Value                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| **Severity** | MEDIUM                                                                            |
| **Category** | Event listener leak                                                               |
| **File**     | `utils/prayerNotificationScheduler.ts` L455–465, `utils/backgroundTask.js` L48–65 |

**Bug:** `setupBackgroundTask` called `startPrayerNotificationWindowMaintainer()`, which creates a module-level `AppState` subscription. When the user disabled notifications, `unregisterBackgroundTask()` unregistered the background fetch task but did **not** remove the AppState subscription. The listener kept firing on every foreground, calling `ensurePrayerNotificationWindow()` which would read `notifications_enabled = 'false'` from AsyncStorage and return — but that's still an unnecessary AsyncStorage read + function call every time the app is foregrounded.

**Fix applied:**

1. Added `stopPrayerNotificationWindowMaintainer()` export to the scheduler.
2. `unregisterBackgroundTask()` now calls it:

```js
const {
  stopPrayerNotificationWindowMaintainer,
} = require("./prayerNotificationScheduler");
stopPrayerNotificationWindowMaintainer();
```

---

### Finding 11 — No cancellation guard for abandoned `fetchAndCachePrayerTimes` on `currentDay` change ⚠️ DOCUMENTED

| Field        | Value                                      |
| ------------ | ------------------------------------------ |
| **Severity** | LOW                                        |
| **Category** | Async race / unmount-during-async          |
| **File**     | `hooks/home/useHomePrayerData.ts` L125–270 |

**Bug:** `fetchAndCachePrayerTimes` is a multi-step async function that eventually calls `setPrayerTimes()`, `setLoading()`, etc. When `currentDay` changes, the main effect tears down timers (L814–819) and re-runs. But the in-flight `fetchAndCachePrayerTimes` from the previous effect is **not** cancelled — it can still complete and call `setPrayerTimes()` with stale day data.

**Why it's LOW:** All prayer data comes from local CSV files (synchronous parse), with the only true async operation being a single `AsyncStorage.getItem` for theme. The window for the old fetch to win the race is microseconds. In practice, the correct fetch always completes last.

**Recommended fix (not applied — architectural improvement):**

Add a `cancelled` boolean scoped to the effect and check it before each state update:

```ts
useEffect(() => {
    let cancelled = false;

    const fetchPrayerTimes = async () => {
        await fetchAndCachePrayerTimes();
        if (cancelled) return; // don't update state
        // ... state updates ...
    };

    fetchPrayerTimes();
    return () => { cancelled = true; /* ... existing cleanup ... */ };
}, [currentDay, ...]);
```

---

## Summary

| #   | Finding                                          | Severity | Status        |
| --- | ------------------------------------------------ | -------- | ------------- |
| 1   | `playAyah` sound leak on error                   | CRITICAL | ✅ Fixed      |
| 2   | `togglePlayPause` soundRef race                  | HIGH     | ✅ Fixed      |
| 3   | Coalescing lock drops settings change            | HIGH     | ✅ Fixed      |
| 4   | `onPrayerNotificationDelivered` setTimeout in BG | HIGH     | ✅ Fixed      |
| 5   | Timer refs overwritten without clear             | HIGH     | ✅ Fixed      |
| 6   | `updateNextPrayer` not memoised                  | MEDIUM   | ⚠️ Documented |
| 7   | Stale `notificationsEnabled` at midnight         | MEDIUM   | ✅ Fixed      |
| 8   | `Audio.setAudioModeAsync` error swallowed        | MEDIUM   | ✅ Fixed      |
| 9   | InAppNotification double-dismiss                 | MEDIUM   | ✅ Fixed      |
| 10  | AppState sub leak on disable                     | MEDIUM   | ✅ Fixed      |
| 11  | No cancellation for abandoned fetch              | LOW      | ⚠️ Documented |

**Fixed:** 9 findings across 5 files  
**Documented:** 2 findings (performance optimisation + architectural improvement)

---

## Files Modified

| File                                   | Changes           |
| -------------------------------------- | ----------------- |
| `hooks/quran/useQuranAudio.ts`         | Findings 1, 2, 8  |
| `hooks/home/useHomePrayerData.ts`      | Findings 5, 7     |
| `utils/prayerNotificationScheduler.ts` | Findings 3, 4, 10 |
| `app/_layout.tsx`                      | Finding 9         |
| `utils/backgroundTask.js`              | Finding 10        |

---

## Patterns Documented in lessons.md

| Pattern # | Description                                          |
| --------- | ---------------------------------------------------- |
| 26        | Clean up soundRef on playAsync error                 |
| 27        | Capture ref into local var before await              |
| 28        | Dirty-flag loop instead of simple promise coalescing |
| 29        | Inline await in BG handler instead of setTimeout     |
| 30        | clearTimeout before overwriting timer ref            |
| 31        | Use ref for long-lived closure reads                 |
| 32        | Guard dismiss/callback with `dismissedRef`           |
