# Lessons Learned

This document tracks mistakes made during development and how to avoid them in the future.

---

## Arabic Localization — Notifications & Widgets

### Pattern 70: jest-expo does not auto-mock @react-native-async-storage/async-storage

- **Mistake**: Assumed `jest-expo` preset would auto-mock AsyncStorage (like it does for many RN core modules). Test suite failed with `NativeModule: AsyncStorage is null` when `notificationTextResolver.ts` imported AsyncStorage.
- **How to avoid**: Always add an explicit `jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }))` at the top of any test file whose module graph touches AsyncStorage — even indirectly (e.g. widgetDataBridge → notificationTextResolver → AsyncStorage).
- **Fix**: Added explicit `jest.mock` to both `notificationTextResolver.test.ts` and `widgetDataBridge.test.ts`.

### Pattern 71: Background schedulers cannot use React hooks for language/preferences

- **Mistake**: Initially considered passing language through React context or hook callbacks for background notification scheduling. Background tasks (AlarmManager, headless JS) have no React tree — hooks are unavailable.
- **How to avoid**: For any value needed by background tasks (language, sound preferences, etc.), always read directly from AsyncStorage at scheduling time. Create a standalone utility function (like `getStoredLanguage()`) that reads the raw stored value with a safe fallback.
- **Fix**: Created `notificationTextResolver.ts` with `getStoredLanguage()` that reads `app_language` from AsyncStorage directly (returns `'en'` on any failure). All schedulers call this at entry and pass the language string through.

---

## 2026-03-06: Dua Page UX Redesign — Full-Screen Navigation

### Pattern 69: Inline expand/collapse in a list degrades reading experience

- **Mistake**: Initially expanded categories inline within the main scroll. This meant the category hub content was pushed below the expanded content, making it hard to navigate back. The expanded area also competed for scroll space with the rest of the list, and content width was constrained by the category card's padding.
- **How to avoid**: For content-heavy categories (e.g. 22 duas with Arabic text), use a full-screen detail view instead of inline expansion. The hub becomes a clean menu, and the detail view has maximum screen space for reading.
- **Fix**: Replaced inline CategoryCard expand/collapse with a full-screen `CategoryDetailView` that slides in from the right using `Animated.spring`. Category cards are now simple tappable menu items with `onPress → openCategory()`. Detail view manages its own state (expandedDuas, readAll) and handles Android `BackHandler`. Animation is RTL-aware.

### Pattern 67: Nested card containers waste horizontal space and feel congested

- **Mistake**: Wrapped each individual dua in its own sub-card (borderRadius, padding, border) inside a category card that already had its own padding. Arabic text then had ANOTHER card wrapper inside that. Total padding consumed: ~88px (14+14 category + 14+14 sub-card + 16+16 arabic block). On a 375px phone, that's only ~287px for actual text — visibly cramped.
- **How to avoid**: Limit visual containers to ONE level. Use dividers (hairline rules) to separate items within a container instead of nesting cards. For text blocks that need visual distinction, use a single-sided border accent (like a blockquote bar) instead of a full card.
- **Fix**: Removed DuaCard sub-card wrapper entirely. Duas are now flat items with dividers inside the category card. Arabic text uses `borderLeftWidth: 3` with gold color instead of a card. Total padding: ~32px (16+16 category only). Content gets ~55px more width.

### Pattern 68: Individual-only expand prevents "read all together" use case

- **Mistake**: Each dua had its own internal expanded state, with no way to expand all at once. Users who recite all morning duas together (the most common use case for adhkar) had to manually tap each of the 22 duas individually. This made users abandon the dua page entirely.
- **How to avoid**: When a category is a natural "reading list" (like morning/evening adhkar), always provide a bulk-expand option. Lift expanded state to the parent component so it can be controlled collectively.
- **Fix**: Moved expanded state from individual DuaItem to CategoryCard (via `expandedDuas: Set<string>` + `readAll: boolean`). Added "Read All" / "Collapse All" button in the category action bar. When user manually expands all items, readAll auto-enables. When user collapses one, readAll auto-disables.

## 2026-03-06: Dua Page Overhaul & LayoutAnimation Flickering

### Pattern 65: LayoutAnimation causes flickering in nested expand/collapse

- **Mistake**: Used `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` inside every individual dua toggle handler. LayoutAnimation is a **global** mechanism — calling it triggers animated re-layout across the _entire_ view tree, not just the expanding item. In nested UIs (category card → dua sub-card → content), this caused brief white/transparent flashes as the system animated intermediate layout states.
- **How to avoid**: Only use `LayoutAnimation` for large structural changes (e.g. a top-level category expanding). For leaf-level content reveals (individual items toggling), use `Animated.timing` with `useNativeDriver: true` for opacity/transform transitions — this doesn't trigger global layout recomputation.
- **Fix**: Replaced `LayoutAnimation` in `DuaCard.toggle()` with `Animated.timing` on an opacity value. Content fades in (280ms) and out (150ms) without affecting the rest of the layout tree. `LayoutAnimation` is retained only for the category-level `toggleCategory()` function.

### Pattern 66: Async state updates in useFocusEffect trigger unwanted LayoutAnimations

- **Mistake**: `useFocusEffect` loaded font scale and family asynchronously on every focus. If a `LayoutAnimation.configureNext` was still pending from a recent interaction, the font state update triggered unintended animated layout reflows.
- **How to avoid**: Gate `useFocusEffect` callbacks behind a "ready" flag from the initial `useEffect` load. This ensures the first load completes with correct values before focus-refresh attempts to update them.
- **Fix**: Added `fontsReady` state variable. The initial `useEffect` sets `fontsReady = true` after loading. The `useFocusEffect` early-returns if `!fontsReady`.

## 2026-03-06: Notification Deep Links & Dua Font Sync

### Pattern 64: FCM notification-type messages bypass Notifee event handlers

- **Mistake**: The app only listened to Notifee's `onForegroundEvent(PRESS)`, `onBackgroundEvent(PRESS)`, and `notifee.getInitialNotification()` for notification taps. But push notifications from the dashboard are FCM **notification-type** messages (they include a `notification` field with title/body). Android auto-displays these via the system tray — Notifee never sees them. So background/cold-start taps on push notifications just opened the app and did nothing.
- **How to avoid**: When using FCM notification-type messages, ALWAYS add Firebase's own tap handlers: `messaging().onNotificationOpenedApp()` for background and `messaging().getInitialNotification()` for cold-start. Notifee events only fire for Notifee-created notifications (local prayer notifications, foreground-displayed remote pushes). For FCM data-only messages displayed via Notifee, both handlers fire.
- **Fix**: Added `messaging().onNotificationOpenedApp()` and `messaging().getInitialNotification()` in `_layout.tsx`'s push notification `useEffect`. Updated `handleInitialNotification()` in `notifeePrayerService.js` to check both Notifee AND Firebase.

### Pattern 62: Linking.canOpenURL returns false for valid HTTPS URLs on some Android devices

- **Mistake**: Used `Linking.canOpenURL(url)` as a guard before `Linking.openURL(url)` for store URLs. On some Android devices/versions this returns `false` even for valid `https://play.google.com/...` URLs, because the app needs `<queries>` entries in `AndroidManifest.xml` for intent resolution. The notification tap silently did nothing.
- **How to avoid**: For HTTPS URLs that you control (store links, known domains), skip `canOpenURL` entirely. Just call `openURL` inside a try-catch. `openURL` itself throws if the URL truly can't be opened, which is a better signal.
- **Fix**: Removed `canOpenURL` pre-checks from all cases in `handleNotificationAction`. Each case now wraps `openURL` in try-catch directly.

### Pattern 63: Cold-start notification handlers fire before React components mount

- **Mistake**: `handleInitialNotification()` fires when the app is opened from a killed state by tapping a notification. At that point, `DeviceEventEmitter.emit()` has no listeners (React tree hasn't mounted yet) and `router.navigate()` may fail (expo-router not ready).
- **How to avoid**: For cold-start scenarios, persist the pending action to AsyncStorage and let the target screen consume it on mount. Add a staleness check (e.g. 30s expiry) to avoid acting on ancient pending actions.
- **Fix**: `handleNotificationAction` now writes `{ type, surahNumber, timestamp }` to `@pending_notification_action` in AsyncStorage. `consumePendingNotificationAction()` reads, removes, and returns it (or null if stale/missing). Quran tab calls this on mount.

---

## 2026-03-06: Admin Dashboard — Delivery & Analytics Features

### Pattern 61: Emoji characters in Python print() crash on Windows cp1252

- **Mistake**: Used emoji characters (📦, ✅, ❌, 🚀) in Python `print()` statements. On Windows with cp1252 encoding, these cause `UnicodeEncodeError: 'charmap' codec can't encode character` and crash the server on startup.
- **How to avoid**: Never use emoji/Unicode characters above U+00FF in Python `print()` on Windows. Use ASCII text labels like `[OK]`, `[WARN]`, `[ERROR]`, `[READY]` instead.
- **Fix**: Replaced all emoji print statements in `app.py` and `fcm_service.py` with ASCII equivalents.

## 2026-03-06: Crash Report Investigation & TypeScript Fixes

### Pattern 57: Android 16 (SDK 36) breaks Notifee Bundle parceling

- **Mistake**: Android 16 Beta introduced stricter `Parcelable`/`Bundle` type validation. Notifee v9.1.8 internally stores notification config in Bundles that Android 16's `Parcel.readValue()` rejects with `BadParcelableException`.
- **How to avoid**: Always sanitize notification `data` to contain only string values. Add a `sanitizeNotifeeData(data)` helper that coerces values via `String()` and strips `null`/`undefined`. Monitor library updates for Android version compatibility.
- **Fix**: Added `sanitizeNotifeeData()` in both `notifeePrayerService.js` and `prayerNotificationScheduler.ts`, applied to all notification creation sites.

### Pattern 58: Duplicate imports cause TypeScript errors

- **Mistake**: Two separate `import` lines from the same module (`react-native`) both imported `View`, causing TS error 2300 (Duplicate identifier).
- **How to avoid**: When adding new imports from a module, always check if there's already an import from that module and merge into it.
- **Fix**: Merged into single `import { Platform, View, Text, ... } from 'react-native'`.

### Pattern 59: Stray braces from code edits

- **Mistake**: An extra `}` brace left over from a previous edit sat outside any function, causing TS error 1128 at runtime or compile.
- **How to avoid**: After editing functions (especially removing or adding blocks), verify brace balance. Use editor bracket matching or linting to catch orphaned braces.
- **Fix**: Removed the stray `}` in `notifeePrayerService.js`.

### Pattern 60: JSDoc `@returns {Object}` loses property types

- **Mistake**: Using `@returns {Object}` in JSDoc for a JavaScript file causes TypeScript to infer the return type as `Object` (capital O), which has no known properties. This breaks `.Fajr`, `.Maghrib` etc. access in TypeScript test files.
- **How to avoid**: Use `@returns {Record<string, string>}` or a more specific `@returns {{ Fajr: string, Maghrib: string, ... }}` in JSDoc to preserve property access in TypeScript consumers.
- **Fix**: Updated `@returns` annotations in `prayerTimeTuner.js` from `{Object}` to `{Record<string, string>}`.

---

## 2026-03-05: Round 7 — Deep Layout, Context, Utils & Data Integrity Audit

### Pattern 47: Using system useColorScheme instead of app's useTheme

- **The mistake**: `InnerLayout` derived `isDark` from `useColorScheme()` (system) while the app has its own `ThemeContext`. StatusBar and Stack background followed the system, not the user's chosen theme.
- **The fix**: Replace `useColorScheme()` with `useTheme().isDark` and `themeColors.background.primary`.
- **Prevention**: Never use `useColorScheme()` anywhere except inside `ThemeProvider`. All other code should use `useTheme()`.

### Pattern 48: Duplicating context providers across conditional render branches

- **The mistake**: `LanguageProvider` and `SafeAreaProvider` appeared in both the welcome-slides and main-app branches. When the condition flipped, the old provider unmounted and a new one mounted, resetting state.
- **The fix**: Hoist providers to `RootLayout` so they wrap both paths as a single stable instance.
- **Prevention**: Context providers that should persist across UI transitions must be at the highest stable ancestor, never inside conditional branches.

### Pattern 49: Context value objects recreated every render

- **The mistake**: `ThemeContext`, `LanguageContext`, `OnboardingContext` all created new `value` objects on every render. React uses reference equality, so every consumer re-rendered on every provider re-render.
- **The fix**: Wrap `value` in `useMemo` with proper deps. Stabilize callbacks with `useCallback`.
- **Prevention**: Always memoize context provider values. Wrap callbacks in `useCallback` before including in memo deps.

### Pattern 50: Loading from storage and re-saving the same value back

- **The mistake**: `LanguageContext` mount effect called `changeLanguage(savedLang)` which wrote the value back to AsyncStorage — redundant I/O on every app start.
- **The fix**: Separate the load path (direct state set) from the user-initiated change path (save + set).
- **Prevention**: Distinguish "hydrate from storage" from "user changed a setting". Only the latter should write.

### Pattern 51: Foreground notification channel ID that was never created

- **The mistake**: `setupForegroundHandler()` used `channelId: 'default'` but no such channel was ever created. Android 8+ silently drops notifications to non-existent channels.
- **The fix**: Changed to `'prayer-times-default'` which is actually created in the notification service.
- **Prevention**: Grep for all `channelId:` usages and verify each has a corresponding `createChannel()` call.

### Pattern 52: Immediate write not cancelling pending debounced write

- **The mistake**: `updateWidgetDataImmediate()` wrote data but didn't cancel pending `debounceTimer` from `updateWidgetData()`. Stale debounced write could overwrite fresh immediate write.
- **The fix**: Cancel `debounceTimer` in `updateWidgetDataImmediate()`.
- **Prevention**: Any "immediate" bypass of a debounce must cancel the pending debounced call.

### Pattern 53: Short alias substrings causing false positive search matches

- **The mistake**: Bidirectional substring matching `q.includes(alias)` with 3-char aliases caused spurious results (e.g., "balance" matching "ala").
- **The fix**: Require minimum alias length (≥4) for reverse alias matching.
- **Prevention**: When doing reverse substring matching, ensure minimum length thresholds to avoid noise.

### Pattern 54: Hardcoded city prefix in fallback parsing

- **The mistake**: `extractCityIdFromRegionId` fallback only handled `'abu'` prefix. New cities like `al-khor` would be extracted incorrectly.
- **The fix**: Generalized to `parts.slice(2).join('-')` for any multi-word city after country-state.
- **Prevention**: Avoid hardcoding specific prefixes when a general split strategy works.

### Pattern 55: Error constructor receiving non-string data becomes [object Object]

- **The mistake**: `throw new Error(json.data)` where `json.data` could be an object. `Error()` calls `.toString()`, producing unhelpful `[object Object]`.
- **The fix**: Check `typeof json.data === 'string'` and use `JSON.stringify` for objects.
- **Prevention**: Always ensure Error messages are strings. Use `typeof` check or template literals.

### Pattern 56: onBeforeShow rejection permanently locking UI

- **The mistake**: `OnboardingTooltips` `onBeforeShow` rejection prevented animation from running, leaving `isAnimatingRef.current = true` permanently — tooltip became un-dismissable.
- **The fix**: Wrapped `onBeforeShow` in try/catch so animation always runs.
- **Prevention**: Error-prone async callbacks in animation chains must be wrapped in try/catch. Never let an external callback prevent animation cleanup.

---

## 2026-03-05: Round 6 — Creative Out-of-Box Audit

### Pattern 41: Display-name suffix breaks identity comparison

- **The mistake**: `nextPrayer.name` was `'Fajr (Tomorrow)'` but prayer rows compared against bare `'Fajr'`, so the highlight never matched for the last daily prayer period.
- **The fix**: Strip suffix with `.replace(' (Tomorrow)', '')` into a `nextPrayerBaseName` variable and use that for all 9 comparison sites.
- **Prevention**: When display strings carry semantic suffixes, always strip them before using in logic comparisons. Keep display names separate from identity keys.

### Pattern 42: Region/settings change doesn't invalidate scheduler metadata

- **The mistake**: Changing region cancelled notifications but left stale scheduler metadata keys in AsyncStorage (`prayer_sched_last_day`, `prayer_sched_tz_offset`, etc.), causing the new region's scheduler to skip rescheduling.
- **The fix**: Added `AsyncStorage.multiRemove()` for all scheduler metadata keys alongside notification cancellation.
- **Prevention**: Whenever a setting invalidates derived state, clear ALL downstream cache/metadata — not just the primary resource.

### Pattern 43: Off-by-one in "Return to Today" visibility threshold

- **The mistake**: Threshold was `currentDay > 1` so button didn't appear when viewing tomorrow (day 1).
- **The fix**: Changed to `currentDay >= 1`.
- **Prevention**: Always test boundary values (0, 1, -1) for visibility/navigation guards.

### Pattern 44: useMemo on time-dependent computed values freezes at mount time

- **The mistake**: Wrapping `gradientColors` (which depends on current hour) in `useMemo([])` cached the gradient from the hour of first render permanently.
- **The fix**: Reverted to IIFE `(() => {...})()` that recalculates every render. For time-dependent values, either use short-lived memo with time-based deps or accept the re-computation.
- **Prevention**: Never memoize values that depend on `new Date()` or wall-clock time with empty deps — the memo will freeze at mount time.

### Pattern 45: Hardcoded English strings in Alert.alert calls bypass i18n

- **The mistake**: 5 `Alert.alert()` calls in `useSettingsLocation` had English strings that ignored the user's language setting.
- **The fix**: Imported `useLanguage()`, replaced all strings with `t('translationKey')`, added keys to en.js and ar.js.
- **Prevention**: Grep for `Alert.alert` with string literals — every user-facing string must go through `t()`.

### Pattern 46: Test assertions must match translation-key returns when `t()` is mocked as identity

- **The mistake**: After changing code from hardcoded English to `t('key')`, tests that mock `t` as `(key) => key` still asserted on the old English string.
- **The fix**: Updated test assertions from `'Fresh prayer times loaded'` to `'freshPrayerTimesLoaded'`.
- **Prevention**: When changing any user-facing string to use `t()`, immediately grep tests for the old string and update assertions.

---

## 2026-03-05: Round 5 (Subagent 2) Deep Audit — Time/Date Edge Cases, Data Integrity

### Pattern 33: Inconsistent constants in mathematical approximations

**Mistake:** `getHijriDate()` in `localPrayerData.js` computed `hijriYear` by dividing by `354.37`, but `hijriDayOfYear` using modulo `354` (integer). Over 1400+ Hijri years, this mismatch causes `hijriDayOfYear` to be hundreds of days off. The displayed Hijri date was ~6 months wrong for current dates.
**Rule:** When computing year + day-of-year from a total day count, BOTH must use the same year-length constant. Compute day-of-year as `daysDiff - (year - 1) * daysPerYear`, not `daysDiff % integerDaysPerYear`.

### Pattern 34: Applying a stale-closure ref fix to one call site but missing another

**Mistake:** Round 5 Finding 7 fixed `clearCache` to use `notificationsEnabledLocalRef.current` instead of the stale `notificationsEnabled` closure. But `fetchAndCachePrayerTimes` (called from the same stale-closure interval) also read `notificationsEnabled` directly at line 206, bypassing the fix.
**Rule:** When fixing a stale-closure bug, search for ALL usages of the stale variable in the same scope and its callees. Use `grep` for the variable name across the file to find every reference.

### Pattern 35: `parseInt` of potentially non-numeric AsyncStorage values without NaN guard

**Mistake:** `clearCache` did `now - parseInt(lastScheduled) > 60000`. If `lastScheduled` was corrupted to a non-numeric string, `parseInt` returned NaN, `Date.now() - NaN` = NaN, `NaN > 60000` = false — silently skipping notification rescheduling.
**Rule:** Always check `isNaN()` after `parseInt`/`parseFloat` when the source is user storage or AsyncStorage. Provide a fallback: `const n = parseInt(val, 10); if (isNaN(n)) { /* handle */ }`.

### Pattern 36: NaN propagation through format-conversion pipelines

**Mistake:** `timeToMinutes()` in `prayerTimeTuner.js` returned NaN for malformed time strings (e.g. `"--:--"`). `minutesToTime(NaN)` then produced `"NaN:NaN"`, which propagated into the UI as a corrupted prayer time display.
**Rule:** Add NaN guards at the entry AND exit of format-conversion functions. Return the original value or a safe placeholder (e.g. `'--:--'`) instead of propagating NaN.

---

## 2026-03-05: Round 5 Deep Audit — Performance, Memory & Theme Fixes

### Pattern 37: Surah-change guard after async resource creation

**Mistake:** `preloadNextAyah` and `playAyah` in `useQuranAudio.ts` called `Audio.Sound.createAsync` (an async operation), but didn't verify the surah hadn't changed while the await was in-flight. If the user switched surahs during `createAsync`, the resolved sound was assigned to a ref that the surah-change cleanup had already nullified, creating an orphaned Audio.Sound resource that was never unloaded.
**Rule:** After every `await` that creates a resource, check that the context (surah, screen, etc.) hasn't changed: `if (currentRef.current?.id !== capturedId) { resource.dispose(); return; }`.

### Pattern 38: Memoize computed arrays/objects passed as props to child components

**Mistake:** `useQuranData.ts` called `getTimeBasedGradient()` inline on every render, creating a new 3-element array each time. This array was passed to `ExpoLinearGradient`, causing unnecessary re-renders since array reference changed.
**Rule:** Use `useMemo` for any array/object computed from state/props that gets passed to child components: `const gradient = useMemo(() => computeGradient(), [deps]);`.

### Pattern 39: Guard all production console.log calls in hot paths with **DEV**

**Mistake:** `updateNextPrayer` in `useHomePrayerData.ts` had 6 console.log calls with template literals that ran every second in production. Even with the console silencer, the template string interpolation still ran (string allocation + property lookups 6x/second).
**Rule:** Wrap ALL console.log in frequently-called functions (countdown tickers, animation frames, scroll handlers) with `if (__DEV__)` to avoid template evaluation overhead in production.

### Pattern 40: Hardcoded hex colors defeat theme system

**Mistake:** `dua.tsx` had `#F5F1E6` and `#F2EEE1` in gradient returns that bypassed the theme system. These don't adapt in dark mode or custom themes.
**Rule:** Never hardcode hex color values in components. Always use theme tokens: `colors.background.tertiary` instead of `'#F5F1E6'`. Search the codebase for hex patterns (`/#[0-9A-Fa-f]{3,8}/`) after theme migrations.

---

## 2026-03-05: Round 5 Deep Audit — Concurrency, Async Races, State Corruption

### Pattern 26: Leaking resource refs when async operations throw

**Mistake:** `useQuranAudio.ts` assigned `soundRef.current = sound` before `playAsync()`, but if `playAsync()` threw, the catch block only showed an alert — the sound was never unloaded. Subsequent `togglePlayPause()` calls interacted with a broken sound object.
**Rule:** When an async operation that uses a ref-tracked resource throws, the catch block MUST clean up the resource (unload, close, dispose). Always add `if (ref.current) { await ref.current.dispose(); ref.current = null; }` in catch blocks.

### Pattern 27: Reading mutable refs across await boundaries without capturing first

**Mistake:** `togglePlayPause` did `const status = await soundRef.current.getStatusAsync()` then later `await soundRef.current.pauseAsync()`. Between the two awaits, a surah change effect could set `soundRef.current = null`, causing a TypeError.
**Rule:** When using a mutable ref across await boundaries, capture it into a local variable first: `const sound = soundRef.current; await sound.getStatusAsync(); if (soundRef.current !== sound) return;`.

### Pattern 28: Promise coalescing lock drops work when callers have different intent

**Mistake:** `ensurePrayerNotificationWindow()` used a simple coalescing pattern where a second caller would `await` the first caller's promise and return without doing its own work. When settings changed mid-run, the second caller's intent (reschedule with new settings) was lost.
**Rule:** Use a dirty flag with coalescing: if a new caller arrives while one is running, mark dirty. After the current run finishes, re-run if dirty. `do { dirty = false; await work(); } while (dirty);`

### Pattern 29: Returning from async function before setTimeout fires in background context

**Mistake:** `onPrayerNotificationDelivered()` was `async` but just called `setTimeout(() => work(), 2000)` and returned. The OS killed the background JS context before the timeout fired, so the rolling notification window was never topped up.
**Rule:** Never use `setTimeout` inside an `async` function that runs in a background handler and is `await`ed. Use `await new Promise(r => setTimeout(r, delay)); await actualWork();` so the caller blocks until work completes.

### Pattern 30: Overwriting timer refs without clearing the previous timer

**Mistake:** `notifScheduleTimerRef.current = setTimeout(...)` was called without first clearing any existing timeout in the ref. When called twice quickly, the old timeout still fired, causing duplicate notification scheduling.
**Rule:** Always clear before overwriting: `if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(...);`

### Pattern 31: Reading state directly in closures captured by long-lived intervals

**Mistake:** `clearCache` read `notificationsEnabled` from state closure. It was called from `checkDayChange`, which was captured in a `setInterval` inside an effect. When `notificationsEnabled` changed, the interval still used the stale value.
**Rule:** For values read inside closures captured by intervals or timeouts, use refs instead of state: `notificationsEnabledRef.current` always reflects the latest value.

### Pattern 32: Double-dismiss race in auto-dismissing UI components

**Mistake:** `InAppNotification` could be dismissed by both a 7-second auto-timer and a manual X tap. Both called `dismiss()`, leading to the animation callback (`onClose()`) firing twice.
**Rule:** Guard dismiss functions with a ref: `if (dismissedRef.current) return; dismissedRef.current = true;`

---

## 2025-07-14: Round 4 Deep Production-Readiness Audit — Patterns to Avoid

### Pattern 18: Division-by-zero in progress calculations

**Mistake:** `useHomePrayerData.ts` computed `elapsedTime / totalTimeSpan` without checking `totalTimeSpan > 0`. When consecutive prayers have the same time (after tuning), the result is `NaN` or `Infinity`, which corrupts `Animated.timing` and freezes the progress ring.
**Rule:** Always guard division operations with a `> 0` check before dividing. Return a safe default (0 or 1) when the divisor is zero. This applies to any time-span calculation that depends on user-tunable data.

### Pattern 19: Ref assignment after async play creates race conditions

**Mistake:** `useQuranAudio.ts` assigned `soundRef.current = sound` after `playAsync()` or after `createAsync({ shouldPlay: true })`. If `stopAudio()` was called during the async gap, it found `null` in the ref and couldn't stop playback.
**Rule:** Always assign a resource ref BEFORE starting the operation that uses it. For audio: `soundRef.current = sound; await sound.playAsync();`. Never use `{ shouldPlay: true }` when you need to assign a ref first — use `{ shouldPlay: false }` + explicit `playAsync()`.

### Pattern 20: Cancelling notifications without clearing scheduling flags

**Mistake:** `useSettingsLocation.ts` called `notifee.cancelAllNotifications()` on region change but didn't remove `last_notification_scheduled` from AsyncStorage. The rescheduling logic checked this flag and skipped scheduling for the new region.
**Rule:** When cancelling notifications, always clear ALL related AsyncStorage flags (`last_notification_scheduled`, scheduling timestamps). The cancel and the flag-clear must be atomic.

### Pattern 21: Orphaned Animated.loop() without cleanup

**Mistake:** `qibla.tsx` created `Animated.loop()` inside a `useEffect` but never stored the reference or called `.stop()` on cleanup. Each time `isFacingQibla` toggled, a new loop started without stopping the old one — animations stacked up.
**Rule:** Always store `Animated.loop()` return value and call `.stop()` in the useEffect cleanup: `const loop = Animated.loop(...); loop.start(); return () => loop.stop();`

### Pattern 22: Hardcoded timeout instead of event-driven cleanup

**Mistake:** `audioHelper.js` used `setTimeout(5000)` to unload sound after playback. If the audio was longer than 5 seconds (like the full azan), it was unloaded mid-playback. If it was shorter, resources lingered for up to 5 seconds.
**Rule:** Use `didJustFinish` callback via `setOnPlaybackStatusUpdate()` for cleanup. Never guess playback duration with a hardcoded timeout.

### Pattern 23: Untracked setTimeout calls in effects

**Mistake:** `useHomeNotifications.ts` had three `setTimeout(() => scheduleNotificationsForToday(), delay)` calls without storing the timer IDs. On component unmount, these could fire after cleanup.
**Rule:** Track ALL setTimeout/setInterval IDs in refs. For multiple timers, use a ref array: `const timers = useRef<NodeJS.Timeout[]>([])`. Push each new ID and clear all on cleanup.

### Pattern 24: Hardcoded colors bypassing theme system

**Mistake:** `index.tsx`, `RegionPicker.tsx`, `settingsStyles.ts` used `SepiaColors.accent.gold` directly instead of `colors.accent.gold` from the theme. Dark mode showed light-mode gold on dark backgrounds.
**Rule:** Never import `SepiaColors` in theme-aware components. Always use `colors` from `useTheme()` or pass as prop. The theme system returns `SepiaColors` for light mode and `DarkColors` for dark mode — using `colors.X` always gives the right value.

### Pattern 25: Production console.log noise and performance drag

**Mistake:** 100+ unguarded `console.log` calls across the codebase, including one that fired every second in the countdown timer. In production builds, these create unnecessary string allocations and I/O.
**Rule:** Add a production console silencer at the app entry point: `if (!__DEV__) { console.log = () => {}; console.warn = () => {}; }`. Keep `console.error` for crash reporting. This is simpler and safer than wrapping each call individually.

---

## 2025-07-13: Round 3 Deep Audit Fixes — Patterns to Avoid

### Pattern 11: Stale closures in frequently-called functions

**Mistake:** `updateNextPrayer()` in `useHomePrayerData.ts` read `nextPrayer` state from its closure. Since it was a plain function (not `useCallback`), it captured the stale value from the render it was created in, causing false "isDifferent" detections and progress bar resets.  
**Rule:** When a function needs to read current state for comparison but isn't stabilized with `useCallback`, use a ref (`useRef`) synced to state: `const nextPrayerRef = useRef(nextPrayer); nextPrayerRef.current = nextPrayer;` Then read `nextPrayerRef.current` inside the function.

### Pattern 12: Dead state variables never set

**Mistake:** `lastPrayerTime` state was declared with `useState` but `setLastPrayerTime` was never called anywhere — always `null`. It polluted the deps array of `updateCountdown` and the return value.  
**Rule:** After adding state, verify `set*` is actually called. Run `grep -r "setFoo"` to confirm. If unused, remove immediately — dead state in deps arrays can cause unnecessary re-renders.

### Pattern 13: Duplicate keys in JavaScript object literals

**Mistake:** `en.js` and `ar.js` had 4 duplicate keys each (`retry`, `iqamaCountdown`, `supportTitle`, `arabic`). JavaScript silently uses the last value — the earlier definition is dead code. One key (`iqamaCountdown`) was used for both a compact label and a settings toggle label.  
**Rule:** Use ESLint rule `no-dupe-keys` to catch duplicates at lint time. When the same key needs different values in different contexts, create distinct keys (e.g. `iqamaLabel` vs `iqamaCountdown`).

### Pattern 14: Forgetting to reset related UI state after clearing data

**Mistake:** `handleClearAllQuranDownloads()` called `deleteAllQuranData()` but didn't reset `downloadedTranslationIds` state. The UI still showed translations as "Downloaded" until app restart.  
**Rule:** When clearing persisted data, always reset ALL related React state to match. Search for every `useState` that derives from the cleared data.

### Pattern 15: IIFE instead of useMemo for derived data

**Mistake:** `filteredTranslations` was computed via an IIFE `(() => { ... })()` on every render instead of `useMemo`. This runs the filter + sort logic unnecessarily on renders that don't change the input data.  
**Rule:** Use `useMemo` for any derived computation that depends on specific values. IIFEs in render bodies are a code smell — they always indicate a missing memoization opportunity.

---

## 2025-07-13: UI Audit Patterns — Common Mistakes to Avoid

### Pattern 6: `Dimensions.get('window')` at module level

**Mistake:** `OnboardingTooltips.tsx`, `WelcomeSlides.tsx`, `SplashScreen.tsx`, and `index.tsx` all capture screen dimensions at module load via `Dimensions.get('window')`. Values become stale after device rotation, breaking layout/pagination.  
**Rule:** Always use `useWindowDimensions()` hook inside components. Never cache `Dimensions.get()` at module scope. If needed outside a component, use `Dimensions.addEventListener('change', ...)` and update state.

### Pattern 7: Bypassing theme system with direct `SepiaColors` imports

**Mistake:** `EnhancedCircularProgress.tsx`, `RegionPicker.tsx`, and `settingsStyles.ts` (legacy section) import `SepiaColors` directly instead of using the `colors` prop/context from `useTheme()`. Works only because the app has one palette — breaks if a second theme is added.  
**Rule:** Always use the themed `colors` from `useTheme()` or pass them as props. Reserve `SepiaColors` for components that render before theme context is available (e.g. `SplashScreen`).

### Pattern 8: Duplicating utility logic across screens

**Mistake:** `getTimeBasedGradient()` is copy-pasted across `dua.tsx`, `qibla.tsx`, and `settings.tsx` with minor variations. A shared utility (`getTimeBasedGradientColors`) exists but is imported and assigned to a variable that is never read.  
**Rule:** Before writing screen-level utilities, check if a shared version already exists in `utils/`. Extract repetitive logic into a single reusable function and import it everywhere.

### Pattern 9: Dead props in component interfaces

**Mistake:** `MagicalButton` (home) defines a `glowColor` prop in its TypeScript interface but never destructures or uses it. Callers pass the prop thinking it has an effect.  
**Rule:** When adding props to an interface, immediately implement the corresponding behavior. Run a dead-code lint pass to catch unused interface members.

### Pattern 10: Debug text left in production UI

**Mistake:** `AboutSection.tsx` displays "RevenueCat Status: Ready" as hardcoded text visible to all users. This is developer debug output that was never cleaned up.  
**Rule:** Wrap all debug/diagnostic UI in `__DEV__` guards. Never commit hardcoded status strings that don't reflect actual runtime state.

---

## 2025-07-12: Deep Audit Patterns — Common Mistakes to Avoid

### Pattern 1: Unguarded `onBackgroundEvent` registration

**Mistake:** Multiple files (`index.ts`, `androidAlarmManager.js`) register `notifee.onBackgroundEvent`. Notifee only keeps the **last** registered handler — previous ones are silently overridden.  
**Rule:** Register `onBackgroundEvent` in exactly ONE place (top-level `index.ts`). Never register it inside utility functions or service modules.

### Pattern 2: Module-level side effects (auto-calling setup functions)

**Mistake:** `notifeePrayerService.js` calls `setupNotifeeEventHandlers()` at the bottom of the file, meaning every `import` triggers event listener registration.  
**Rule:** Never auto-execute initialization functions at module scope. Use explicit init calls with idempotent guards.

### Pattern 3: Hardcoded timeout for async cleanup

**Mistake:** `audioHelper.js` uses `setTimeout(5000)` to unload sounds instead of listening for playback completion. Cuts off azan (which is minutes long) at 5 seconds.  
**Rule:** Always use completion callbacks (`onPlaybackStatusUpdate`, `.then()`, event listeners) instead of fixed timeouts for resource cleanup.

### Pattern 4: Magic enum numbers

**Mistake:** `_layout.tsx` uses `type === 1` and `type === 0` instead of `EventType.PRESS`/`EventType.DELIVERED` from Notifee.  
**Rule:** Always import and use enum constants. Never rely on numeric values that could change across library versions.

### Pattern 5: Mixing magnetic north and true north

**Mistake:** Qibla direction uses geographic bearing (true north) but compass heading uses raw magnetometer (magnetic north). Magnetic declination correction was never applied.  
**Rule:** When combining device compass readings with geographic calculations, always apply magnetic declination correction. Verify units (magnetic vs. true) match.

---

## 2026-02-24: Light Mode Contrast Issues with Pure White Surfaces

### The Mistake

When creating light themes, using `surface.primary: '#FFFFFF'` (pure white) for cards and containers on warm cream backgrounds (like `#FAF8F3` or `#F8F5F0`) creates harsh contrast. The white boxes "pop" too much and look out of place.

Additionally, using `withAlpha(colors.surface.primary, 0.7)` (70% opaque white) or similar transparent overlays still results in washed-out, low-contrast appearances on light backgrounds.

### Files Affected

- `app/(tabs)/index.tsx` - Date navigation, prayer times container, prayer items
- `app/(tabs)/dua.tsx` - Dua cards
- `app/(tabs)/qibla.tsx` - Compass cards
- `app/(tabs)/quran.tsx` - Surah cards, search container
- `app/(tabs)/settings.tsx` - Section cards, option containers

### The Fix

For **light mode** card backgrounds, use the theme's **background.secondary** or **background.tertiary** colors instead of **surface.primary**. These warmer colors blend better with the themed backgrounds:

```tsx
// ❌ Bad: Pure white or transparent white on warm backgrounds
const cardBg = isDark ? ... : withAlpha(colors.surface.primary, 0.7);
const cardBg = isDark ? ... : colors.surface.primary;

// ✅ Good: Use warmer background colors for light mode
const cardBg = isDark ? withAlpha(colors.surface.primary, 0.04) : colors.background.secondary;
backgroundColor: isDark ? C.surface.primary : C.background.secondary
```

---

## 2025-07: GPS-based country detection is wrong for push notification topics

### The Mistake

Used `expo-location` GPS reverse-geocoding to detect the user's country for FCM `country-{XX}` topic subscription. This had multiple problems:

1. Required location permission just for push notifications
2. GPS is unreliable indoors / returns null
3. The "fallback" parsed `"qatar-qatar-doha".split('-')[0]` → `"QATAR"` (wrong — wanted ISO `"QA"`)
4. If a user is traveling, GPS gives the wrong country (not the one they selected for prayer times)

### The Fix

Switched to **settings-based country detection**: read the user's `selected_region` from AsyncStorage (e.g. `"qatar-qatar-doha"`), parse the country ID (`"qatar"`), and look up the ISO code via a new `isoCode` field on the `Country` interface in `prayerTimeConfig.ts`. No location permission needed. The country topic now reflects the user's **intentional choice**, not their physical location.

### How to Avoid

When detecting user context (country, language, region), prefer the value the user explicitly chose in settings over auto-detected values. GPS/IP geolocation adds complexity, permissions, and failure modes — and may not match user intent.

---

## 2026-02-27: Pre-build code audit — critical bugs found

### The Mistakes

1. **Placeholder data left in CSV** — Dec 31 prayer times were round placeholder numbers (`05:00,06:30,12:00...`). Looked valid at a glance but deviated 64+ minutes from neighboring days. Always validate data against neighbors.

2. **Missing edge-case data (Feb 29)** — Year-agnostic CSV had 365 rows but no Feb 29. Easy to miss because it only matters once every 4 years. Always test boundary dates explicitly.

3. **String split assumptions** — Used `id.split('-').length === 3` to match IDs like `prayer-fajr-2026-03-05` (which splits to 5 parts, not 3). The filter silently returned empty, hiding the bug. Always test string parsing with actual data samples.

4. **Stale closures in React useEffect with `[]` deps** — `notificationsEnabled` was captured as `false` (initial value) and never updated inside long-lived intervals. Two critical code paths (health check + background reschedule) were permanently dead. Use refs to mirror state values that need to be read inside long-lived closures.

5. **Hijri epoch date parsing** — `new Date('622-07-16')` works on V8 (Node) but returns `Invalid Date` on Hermes (React Native's JS engine). 3-digit years are not valid ISO 8601. Always use pre-computed timestamps for ancient dates.

6. **Notification system prefix collision** — Two notification systems (legacy daily-repeat and rolling window) both used `prayer-` prefix. Functions like `cancelAllNotifeePrayerNotifications` would wipe both systems. Use distinct prefixes when multiple scheduling strategies coexist.

### How to Avoid

- Test with real data at boundaries (Dec 31, Jan 1, Feb 28/29, DST transitions)
- Verify string parsing with actual production ID samples, not hypothetical ones
- Use refs for state values read inside `[]`-dep effects
- Test on the actual JS engine (Hermes), not just Node/V8
- When scheduling a moving window of notifications, count ALL notification types (prayer + iqama) toward the cap

---

## 2025-02-27: Jest mock hoisting + useEffect race conditions

### The Mistake (1): Jest-expo mock variable hoisting

With `jest-expo` preset, declaring `const mockFn = jest.fn()` before `jest.mock()` and referencing `mockFn` inside the factory FAILS — the variable is `undefined` when the factory runs due to hoisting.

### The Fix (1)

Use inline `jest.fn()` inside `jest.mock()` factories, then get references via `jest.requireMock()`:

```ts
jest.mock("../someModule", () => ({
  myFn: jest.fn().mockResolvedValue("default"),
}));
const someModule = jest.requireMock("../someModule");
// Later: expect(someModule.myFn).toHaveBeenCalled();
```

### The Mistake (2): useEffect async race condition in tests

When a hook has a `useEffect` that loads state from async storage, calling a handler function before that useEffect resolves causes a race. The useEffect's state updates resolve DURING the handler's `act()` block, resetting state back to the loaded defaults.

### The Fix (2)

Always `await waitFor()` for the initial state to load before calling any handler:

```ts
const { result } = renderHook(() => useMyHook());
await waitFor(() => {
  expect(result.current.value).toBe("loaded");
});
// NOW safe to call handlers
await act(async () => {
  await result.current.handleChange("new");
});
expect(result.current.value).toBe("new");
```

### Prevention Strategy

- Never use `const mock = jest.fn()` + reference in `jest.mock()` factory with jest-expo
- Always verify mock function names match actual exports (grep the hook source)
- Always wait for useEffect to complete before testing handler state changes

### The Mistake

When extracting notification code from `settings.tsx` into `useSettingsNotifications`, I removed `StyleSheet` from the `react-native` import block because it wasn't used in the notification code. However, `StyleSheet.absoluteFillObject` was still used in the JSX of settings.tsx, causing a type error.

### The Fix

Added `StyleSheet` back to the import list.

### Prevention Strategy

Before removing any import during a refactor, **always grep** for every symbol being removed to ensure it isn't used elsewhere in the file. Use `grep_search` with the exact symbol name scoped to the specific file.

### Prevention Strategy

When implementing light themes:

1. **Never use `surface.primary` (#FFFFFF) directly for cards** in light mode - always use conditional logic
2. **Use `background.secondary` or `background.tertiary`** for card backgrounds in light mode
3. **Test new themes visually** on actual device before considering work complete
4. **Review the color hierarchy**: `background.primary` → `background.secondary` → `background.tertiary` for increasing depth

### Theme Color Hierarchy (Light Mode)

```
background.primary  - Main page background (lightest)
background.secondary - Cards, containers (slightly darker, warm tint)
background.tertiary - Nested cards, items (darker still)
surface.primary     - Reserved for pure white elements only (rarely appropriate in light mode)
```

---

## 2026-02-27: React act() batching with state setters

### The Mistake

When testing day navigation in `useHomePrayerData`, calling `goToNextDay()` multiple times inside a single `act()` block only increments `currentDay` by 1 instead of N. This is because React batches the `setCurrentDay` calls and each call reads the stale closure value (always 0).

```ts
// ❌ Bad: all calls read stale `currentDay` = 0, result = 1
act(() => {
  result.current.goToNextDay(); // 0 → 1
  result.current.goToNextDay(); // 0 → 1 (stale!)
  result.current.goToNextDay(); // 0 → 1 (stale!)
});
```

### The Fix

Use separate `act()` calls for each state update so React flushes between them:

```ts
// ✅ Good: each call sees updated state
act(() => {
  result.current.goToNextDay();
}); // 0 → 1
act(() => {
  result.current.goToNextDay();
}); // 1 → 2
act(() => {
  result.current.goToNextDay();
}); // 2 → 3
```

### Prevention Strategy

- When testing functions that depend on prior state updates, always use separate `act()` blocks
- Use `jest.useFakeTimers()` + `jest.clearAllTimers()` in afterEach when hooks have `setInterval`/`setTimeout` to prevent timer leaks and "Cannot log after tests are done" warnings

---

## 2026-02-27: Never jest.mock('react-native') with requireActual Spread

### The Mistake

When writing tests for `useQuranData` and `useQuranAudio`, I used:

```ts
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, Keyboard: { dismiss: jest.fn() } };
});
```

This triggered `Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'DevMenu' could not be found` because spreading `jest.requireActual('react-native')` forces initialization of all native TurboModules, which fail in the Jest test environment.

### The Fix

Import the needed module normally, then use `jest.spyOn()` at the top level:

```ts
import { Keyboard, Alert } from "react-native";

jest.spyOn(Keyboard, "dismiss").mockImplementation(() => true as any);
jest.spyOn(Alert, "alert").mockImplementation(() => {});
```

### Prevention Strategy

- **NEVER** use `jest.mock('react-native', () => ...)` in this project
- Always import from `react-native` normally and spy on individual methods
- Look at existing passing tests (e.g., `useSettingsDonation.test.ts`) for the correct pattern

---

## 2026-02-27: Multi-Feature Implementation — Careful Prop Drilling

### The Lesson

When adding new features that span multiple layers (hook → screen → component), always:

1. Update the hook to expose new state/handlers
2. Update the component's interface/props
3. Update the screen that connects them to pass the new props

Missing any layer silently fails — TypeScript may not catch missing optional props.

### Example: Iqama Notification Settings

- Hook (`useSettingsNotifications.ts`): Added `iqamaNotificationsEnabled`, `iqamaNotificationSettings`, etc.
- Component (`NotificationSection.tsx`): Updated interface + JSX
- Screen (`settings.tsx`): Must destructure from hook AND pass to component — easy to forget one

---

## 2026-02-28: Alef Wasla (ٱ) Renders Incorrectly on Android

### The Mistake

Using the Unicode character Alef Wasla (ٱ, U+0671) in Arabic text strings. Android's default font (or many Arabic fonts) truncates or fails to render text containing this character. The string "بِسْمِ ٱللَّهِ" was rendering as just "بسم" on Android devices, making it appear as though only the first word was shown.

This was initially misdiagnosed as a cache/build issue across multiple sessions, wasting significant debugging time.

### The Fix

Replace Alef Wasla (ٱ) with standard Alif (ا) in all user-facing Arabic strings:

```
// ❌ Bad: Uses Alef Wasla (ٱ) — breaks on Android
'بِسْمِ ٱللَّهِ'

// ✅ Good: Uses standard Alif (ا) — works everywhere
'بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ'
```

### Prevention

- Always test Arabic text rendering on actual Android devices
- Avoid Unicode characters that look identical in editors but differ in font support (ٱ vs ا)
- If Arabic text appears truncated on Android, inspect for unusual Unicode codepoints first

---

## 2026-02-27: NativeModules Destructuring Breaks Jest Tests

### The Mistake

Destructuring `NativeModules` at the top level of a module (`const { WidgetDataModule } = NativeModules;`) captures the reference at import time. In Jest, this runs before any test setup code, so mock assignments to `NativeModules.WidgetDataModule` in `beforeEach` or even `jest.mock` factories may not be reflected in the captured variable.

### The Solution

Use lazy accessor functions instead of top-level destructuring:

```typescript
// ❌ BAD: captured at import time, before jest mocks are set up
const { WidgetDataModule } = NativeModules;

// ✅ GOOD: resolved at call time, picks up jest mocks
function getWidgetDataModule() {
  return NativeModules.WidgetDataModule;
}
```

### Files Affected

- `utils/widgetDataBridge.ts` — Changed to lazy accessor pattern for both `WidgetDataModule` and `WidgetDataModuleIOS`

### Prevention

- Never destructure `NativeModules` at the top level of files that need to be tested
- Use lazy accessor functions for any module that needs runtime resolution
- Test native module interactions early to catch this pattern

## 2026-02-28: WidgetKit Timeline Pre-rendering — Date() is Wrong

### The Mistake

In iOS WidgetKit, `getTimeline()` creates multiple entries (e.g. 60 entries, one per minute). The SwiftUI views for ALL entries are pre-rendered at timeline creation time — NOT when each entry is displayed. Using `Date()` inside a computed property or view body gives the current time at creation, not the entry's scheduled display time.

This means all 60 timeline entries showed identical countdown values (the countdown at minute 0), making the widget appear frozen until the next timeline refresh.

### Files Affected

- `ios-widget/WidgetDataProvider.swift` — `nextPrayer` computed property used `Date()`
- `ios-widget/PrayerTimesWidgetViews.swift` — views didn't pass `entry.date`

### The Fix

Changed `nextPrayer` from a computed property to a method that accepts a `referenceDate` parameter. Views now pass `entry.date`:

```swift
// ❌ Bad: Always uses "now" — wrong for pre-rendered entries
var nextPrayer: ... { let currentMinutes = Calendar.current.component(.hour, from: Date()) * 60 ... }

// ✅ Good: Uses the entry's scheduled date
func nextPrayer(at referenceDate: Date = Date()) -> ... { let currentMinutes = cal.component(.hour, from: referenceDate) * 60 ... }
// In views: entry.data?.nextPrayer(at: entry.date)
```

### Prevention

- In WidgetKit timeline providers, NEVER use `Date()` inside views or data models
- Always thread `entry.date` through to any time-dependent computation
- Remember: WidgetKit renders views as static images at timeline creation time

## 2026-02-28: Expo Config Plugin — Files Copied but Not Compiled

### The Mistake

The config plugin used `fs.copyFileSync()` to copy native module files (`.swift`, `.m`) into the iOS project directory, but never called `xcodeProject.addSourceFile()` to register them in the Xcode project's compile sources. The files existed on disk but Xcode didn't know about them, so they wouldn't compile during EAS Build.

Similarly, the "Embed App Extensions" build phase was created empty — the `.appex` product reference was never added, so the widget extension wouldn't be bundled into the final IPA.

### The Fix

1. Moved native module file operations into the `withXcodeProject` step (where `xcodeProject` is available)
2. Called `xcodeProject.addSourceFile()` for each `.swift` and `.m` file
3. Added the `.appex` product reference to the embed phase with `RemoveHeadersOnCopy` attribute

### Prevention

- When using Expo config plugins that add native files, always verify they're added to BOTH disk AND Xcode project
- Test with `expo prebuild` and inspect the generated `.xcodeproj` to verify files appear in build phases
- `withDangerousMod` only gives filesystem access — for Xcode project manipulation, use `withXcodeProject`

---

## 2026-02-28: React Anti-Patterns Found During Phase 8 Deep Audit

### IIFE Side-Effects During Render

**The Mistake:** Using an IIFE in JSX `{condition && (() => { doSomething(); return null; })()}` to trigger side effects. This runs during React's render phase, causing state updates during render — React's "Cannot update a component while rendering" warning and potential infinite loops.

**The Fix:** Move side effects to `useEffect`:

```tsx
// ❌ Bad: Side effect during render
{
  shouldDoThing &&
    (() => {
      doThing();
      return null;
    })();
}

// ✅ Good: useEffect for side effects
useEffect(() => {
  if (shouldDoThing) doThing();
}, [shouldDoThing]);
```

### State as Effect Dependency Causing Listener Churn

**The Mistake:** Using state (`const [lastX, setLastX] = useState(0)`) as an effect dependency for subscriber setup. Every time the state updates (e.g., on notification receipt), the effect re-runs — tearing down and re-subscribing the listener. This causes missed events during the teardown gap.

**The Fix:** Use `useRef` for values needed inside effects but that shouldn't trigger re-subscription:

```tsx
// ❌ Bad: listener torn down on every notification
const [lastReceivedAt, setLastReceivedAt] = useState(0);
useEffect(() => {
  const unsub = subscribe((event) => {
    setLastReceivedAt(Date.now());
  });
  return unsub;
}, [lastReceivedAt]); // ← re-runs on every notification!

// ✅ Good: listener stays alive
const lastReceivedAtRef = useRef(0);
useEffect(() => {
  const unsub = subscribe((event) => {
    lastReceivedAtRef.current = Date.now();
  });
  return unsub;
}, []); // ← subscribes once
```

### useCallback in setInterval Deps Causing Timer Churn

**The Mistake:** `setInterval(() => updateCountdown(), 1000)` where `updateCountdown` is a `useCallback` with deps that change every second (e.g., `countdown`). Since `updateCountdown` identity changes every second, the interval is torn down and rebuilt 86,400 times/day instead of ~6 (once per prayer transition).

**The Fix:** Use the ref-forwarding pattern:

```tsx
const updateCountdownRef = useRef<() => void>(() => {});
const updateCountdown = useCallback(() => { /* ... */ }, [countdown, ...]);
updateCountdownRef.current = updateCountdown; // sync on every render

useEffect(() => {
  const timer = setInterval(() => updateCountdownRef.current(), 1000);
  return () => clearInterval(timer);
}, [nextPrayer]); // ← stable deps, recreated only on prayer change
```

### Prevention

- Never perform side effects in JSX — always use `useEffect`
- Never use mutable state as an effect dependency for subscription setup
- When a callback's identity changes frequently but the interval/listener should be stable, use the ref-forwarding pattern
- Look for `useEffect` cleanup functions that fire too often — add `console.count('effect-name cleanup')` during debugging

---

## 2026-02-28: String.split() for Multi-Part Identifiers

### The Mistake

Using `parts[2]` to extract a city from `"qatar-qatar-abu-samra".split('-')` returns `"abu"` instead of `"abu-samra"`. Any ID containing multiple dashes after the prefix is truncated.

### The Fix

Use `parts.slice(2).join('-')` to reconstruct the full suffix:

```ts
// ❌ Bad: only gets first part after prefix
const cityId = parts[2]; // "abu" from "qatar-qatar-abu-samra"

// ✅ Good: reconstructs full suffix
const cityId = parts.slice(2).join("-"); // "abu-samra"
```

### Prevention

- When splitting compound identifiers, prefer `slice().join()` over index access for the trailing portion
- Add test cases for multi-word values whenever implementing ID parsing

---

## 2026-02-28: xcode npm Package — addTarget() Doesn't Create Build Phases or Target Dependencies

### The Mistake

The `xcode` npm package's `addTarget('app_extension')` creates a PBXNativeTarget with an **empty `buildPhases` array**. It does NOT create the standard Sources, Frameworks, or Resources build phases that Xcode targets need. When `addSourceFile()` is subsequently called targeting the widget UUID, `addToPbxSourcesBuildPhase()` calls `buildPhaseObject('PBXSourcesBuildPhase', 'Sources', widgetTargetUuid)`, which fails to find a Sources phase on the widget target. On a real project, it silently falls back to the main app target's Sources phase — meaning widget Swift files are compiled as part of the **wrong target**. On a minimal project without any Sources phase, it crashes with `Cannot read properties of null (reading 'files')`.

Additionally, `addTarget('app_extension')` only creates a "Copy Files" embed phase but does NOT create a `PBXTargetDependency`. This is only auto-created for `watch2_app` and `watch2_extension` types. Without it, Xcode might not build the extension before trying to embed it.

Finally, `addTargetDependency()` silently no-ops if the `PBXTargetDependency` and `PBXContainerItemProxy` sections don't exist in the project objects — they must be initialized as empty objects first.

### The Fix

```js
// After addTarget(), create the required build phases:
xcodeProject.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
xcodeProject.addBuildPhase(
  [],
  "PBXFrameworksBuildPhase",
  "Frameworks",
  target.uuid,
);
xcodeProject.addBuildPhase(
  [],
  "PBXResourcesBuildPhase",
  "Resources",
  target.uuid,
);

// Initialize dependency sections and add the target dependency:
if (!xcodeProject.hash.project.objects["PBXTargetDependency"]) {
  xcodeProject.hash.project.objects["PBXTargetDependency"] = {};
}
if (!xcodeProject.hash.project.objects["PBXContainerItemProxy"]) {
  xcodeProject.hash.project.objects["PBXContainerItemProxy"] = {};
}
xcodeProject.addTargetDependency(mainTarget.uuid, [target.uuid]);
```

### Prevention

- Never assume `addTarget()` creates build phases — always verify by reading the source code
- Write an integration test that simulates the full plugin against a parsed xcode project
- When using `addTargetDependency`, check that required sections exist first
- The `xcode` package's API is incomplete for extension targets — always read the source to understand what each function actually does vs. what you'd expect

## 2026-03-04: xcode npm Package — addSourceFile() Path Resolution with Groups

### The Mistake

When using `addSourceFile(path, opts, groupUuid)`, the `path` is resolved **relative to the group's path**, not relative to the project root. If the group has `path: 'PrayerTimesWidget'` (set by `addPbxGroup`), and you call `addSourceFile('PrayerTimesWidget/file.swift', ...)`, the resolved path becomes `PrayerTimesWidget/PrayerTimesWidget/file.swift` — double-nested and wrong.

Additionally, `addPbxGroup(files, name, path)` creates file references for ALL files in the `files` array. If you then call `addSourceFile()` for the same files, **duplicate file references** are created — one from `addPbxGroup` (correct path) and one from `addSourceFile` (potentially wrong path). The build uses the one from `addSourceFile`, which is the one with the wrong double-nested path.

### The Fix

```js
// ❌ Wrong: Double-nested path
addPbxGroup(
  [...swiftFiles, "Info.plist", "Widget.entitlements"],
  "Widget",
  "Widget",
);
addSourceFile("Widget/file.swift", { target }, groupUuid); // → Widget/Widget/file.swift

// ✅ Correct: Only non-source files in group, just filename for addSourceFile
addPbxGroup(["Info.plist", "Widget.entitlements"], "Widget", "Widget");
addSourceFile("file.swift", { target }, groupUuid); // → Widget/file.swift
```

### Prevention

- When using `addSourceFile` with a group UUID, pass only the filename, not a prefixed path
- Don't include source files in `addPbxGroup` if you plan to call `addSourceFile` for them — that creates duplicates
- `addSourceFile` already adds the file to the group AND to the build phase, so `addPbxGroup` only needs non-compiled files (Info.plist, entitlements)

---

## 2026-03: Firebase RemoteMessage iOS Image Property

### The Mistake

When implementing the foreground push handler, used `remoteMessage.notification?.apple?.imageUrl` for iOS image URLs. This property does NOT exist on the Firebase `Notification` TypeScript type:

- There is no `apple` property — the iOS-specific property is `ios`
- Even `ios` only has `subtitle`, `subtitleLocKey`, `subtitleLocArgs`, `badge`, `sound` — no `imageUrl`
- The correct path for images is `remoteMessage.notification?.image` (base `Notification` property)
- For Android, `remoteMessage.notification?.android?.imageUrl` is correct (confirmed in types)

### Files Affected

- `utils/pushNotifications.ts` — `setupForegroundHandler()` iOS attachment code
- `__tests__/utils/pushNotifications.test.ts` — test for image handling

### The Fix

Changed iOS image source from non-existent `notification.apple.imageUrl` to `notification.image` (the base property on the `Notification` type).

### Prevention

- Always verify property paths against the actual TypeScript `.d.ts` type definitions in `node_modules/`
- Don't assume platform-specific property names — check `notification.android` vs `notification.ios` structures
- The `image` property on `Notification` is documented as "Web only" but is actually populated on mobile too

---

## 2026-03: AuthorizationStatus Magic Numbers

### The Mistake

Used raw numeric comparisons `=== 1` and `=== 2` for Firebase Messaging `AuthorizationStatus` instead of using the named constants from the module. While functionally correct, this is fragile and less readable.

### The Fix

Changed to `messaging.AuthorizationStatus.AUTHORIZED` and `messaging.AuthorizationStatus.PROVISIONAL` as shown in the official docs.

### Prevention

- Always use named constants/enums instead of magic numbers
- Follow the patterns shown in the official SDK documentation examples

---

## 2026-03-04: Expo Config Plugin Only Runs During `expo prebuild` — Android Firebase Not Initializing

### The Mistake

After implementing Firebase Cloud Messaging, push notifications were never received on Android despite the JS code, Python sender script, and Firebase project all being correctly configured. The root cause: the `@react-native-firebase/app` Expo config plugin in `app.json` plugins array only modifies native files during `expo prebuild`. Since the project uses a **pre-existing `android/` folder with local Gradle builds** (never runs `expo prebuild --clean`), the Google Services Gradle plugin was never injected into the build files. Three things were missing:

1. `google-services.json` was only at project root, not in `android/app/` where Gradle expects it
2. `classpath 'com.google.gms:google-services:4.4.2'` was missing from `android/build.gradle` buildscript dependencies
3. `apply plugin: 'com.google.gms.google-services'` was missing from `android/app/build.gradle`

Without these, the Firebase native SDK has no project config → no FCM token → no topic subscriptions → no push delivery.

### The Fix

- Copied `google-services.json` to `android/app/`
- Added `classpath 'com.google.gms:google-services:4.4.2'` to root `android/build.gradle`
- Added `apply plugin: 'com.google.gms.google-services'` to `android/app/build.gradle`

### Prevention

- When using Expo config plugins with a **pre-existing native folder** (not generated by `expo prebuild`), remember that plugins do NOT run automatically — you must manually apply any native changes they would have made
- Always verify native-level setup after adding Firebase packages: check `google-services.json` location, Gradle classpath, and plugin apply statements
- Test push notification receipt on a real device after initial setup, not just the JS-level logic

---

## 2026-03-04: AsyncStorage.getItem Mock Ordering in Jest — mockResolvedValueOnce Queue

### The Mistake

When testing `subscribeToTopics()` version-upgrade logic, used `mockResolvedValueOnce` chaining to mock multiple `AsyncStorage.getItem` calls. But the function's control flow depends on runtime conditions (GPS success/failure), so `getItem` calls happen in different orders depending on code path. The first `mockResolvedValueOnce(null)` was consumed by the wrong `getItem` call, causing test failures.

### The Fix

Used `mockImplementation` with a key-checking callback instead:

```typescript
(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
  if (key === "push_version_topic") return Promise.resolve("3.9.0");
  return Promise.resolve(null);
});
```

### Prevention

- When a function makes multiple `getItem` calls whose ORDER depends on runtime conditions (e.g., GPS availability), never use `mockResolvedValueOnce` queue — use `mockImplementation` with key-based dispatch
- This is especially important when the function has early-return branches that skip some storage reads

---

## 2026-02-27: Android Notification Channel Mismatch (Root Cause: Legacy Variable)

### The Mistake

A legacy `let channelId = 'prayer-reminders'` variable at module scope was left over from before the 4-channel system was introduced (`prayer-times-azan`, `fajr-prayer-azan`, `prayer-times-default`, `fajr-prayer-default`). Multiple functions (snooze, test notifications, fallback channels, force-recreate) referenced this stale variable or other legacy channel IDs like `fajr_prayer_channel`, resulting in notifications being silently dropped on Android (since notifications pointed at non-existent channels are discarded without error).

### Files Affected

- `utils/notifeePrayerService.js` — 5 separate functions affected

### The Fix

- Removed the legacy `channelId` variable entirely
- Updated all functions to dynamically select the correct channel via `getSoundPreference()` (azan vs default) and prayer name (Fajr vs other)
- Fixed `forceRecreateNotificationChannels()` to delete all 5 real channel IDs
- Fixed `createFallbackChannels()` to use the same IDs as primary channels

### Prevention

- When a module's channel/ID naming scheme changes, always do a full grep for ALL references to the old scheme
- Never rely on `createChannel` to update existing channels on Android — only delete+recreate works
- Test notification functions on Android after channel changes to verify they actually fire
- Avoid module-level `let` variables that hold configuration — prefer functions that read current state

---

## 2026-02-27: Notification Scheduler Missing City Adjustments

### The Mistake

The rolling notification scheduler called `getPrayerTimesFromLocalData(date)` and used raw CSV times directly. But the home screen applied `applyLocalDataCityAdjustments()` to adjust for non-Doha cities. This meant users in Abu Samra/Dukhan/Al Shamal saw correct times on screen but got notifications at the wrong (Doha) times.

### The Fix

- Updated `buildPrayerTimesForDate()` to accept a `cityId` parameter and apply `applyLocalDataCityAdjustments()`
- `ensurePrayerNotificationWindow()` now reads `selected_region` from AsyncStorage and extracts the city ID

### Prevention

- When prayer times pass through a transformation pipeline (raw CSV → city adjustments → display), every consumer of that data must apply ALL the same transformations
- Notification scheduling is a "shadow" consumer that's easy to forget — always verify notification times match displayed times

---

## 2026-02-27: Animated.spring 360° Wrap-Around

### The Mistake

Compass rotation used `Animated.spring({ toValue: -compassHeading })` directly. When heading crosses 360°→0° (e.g., 355° to 5°), the animated value jumps from -355 to -5, causing a 350° clockwise spin instead of a 10° counterclockwise movement.

### The Fix

Track accumulated rotation using shortest-path angular delta:

```typescript
let delta = newHeading - prevHeading;
if (delta > 180) delta -= 360;
if (delta < -180) delta += 360;
accumulated += delta;
Animated.spring({ toValue: -accumulated });
```

### Prevention

- Any animated rotation in degrees must handle the 0°/360° boundary
- Never animate directly to raw angle values — use accumulated delta approach
- Same pattern applies to any circular value (clock hands, dials, gauges)

---

## 2026-02-27: parseInt without NaN guard corrupts prayer times

### The Mistake

`prayerTimeTuner.js` parsed user tuning parameters with `tuningParams.split(',').map(p => parseInt(p, 10))`. If AsyncStorage contained corrupted strings (empty, non-numeric), `parseInt` returns `NaN` which silently propagates through all arithmetic, producing `"NaN:NaN"` prayer times.

### The Fix

Replace bare `parseInt` with a guarded version: `const n = parseInt(p, 10); return isNaN(n) ? 0 : Math.max(-60, Math.min(60, n));`. Always validate + clamp parsed numeric input from user storage.

### Prevention

- **Always** guard `parseInt`/`parseFloat` results with `isNaN()` checks
- Clamp user-provided numeric values to sane bounds
- AsyncStorage values are strings — they can be empty, corrupted, or unexpected

---

## 2026-02-27: Boolean guards don't prevent async race conditions

### The Mistake

`prayerNotificationScheduler.ts` used a simple boolean `ensureInFlight` to prevent concurrent execution of `ensurePrayerNotificationWindow()`. Two near-simultaneous callers could both read `false` before either set `true`, causing duplicate notification scheduling.

### The Fix

Replaced the boolean with a Promise-based lock: if `ensurePromise` is set, the second caller `await`s it instead of proceeding independently. The promise is nulled in a `finally` block.

### Prevention

- Boolean flags are NOT sufficient for async mutual exclusion
- Use Promise-based locks for async functions that must not run concurrently
- Pattern: store the Promise, let subsequent callers await it

---

## 2026-02-27: FCM tokens logged in production builds

### The Mistake

`console.log('🔑 FCM Token:', token)` printed the full device push token to system logs without a `__DEV__` guard. Any attacker with logcat/USB access could capture it and send targeted notifications.

### The Fix

Wrapped all token logging in `if (__DEV__)` guards.

### Prevention

- Never log tokens, keys, or sensitive identifiers without `__DEV__` guard
- Audit all `console.log` calls for sensitive data before release
- Consider using a logging utility that auto-strips in production

---

## 2026-02-27: Notification channel must exist before background handler fires

### The Mistake

`index.ts` background push handler used `channelId: 'default'`, but the channel was only created in `_layout.tsx` useEffect. On cold starts from killed state, the background handler ran before any React component mounted, so the channel didn't exist and Android silently dropped the notification.

### The Fix

Create the 'default' channel at the top level of `index.ts` (synchronous, before background handler registration). `_layout.tsx` can still create/recreate channels; `createChannel` is idempotent.

### Prevention

- Background handlers run outside the React lifecycle — they can't rely on useEffect
- Any resource a background handler needs (channels, DB connections) must be initialized at module scope
- `notifee.createChannel()` is idempotent — safe to call multiple times

---

## 2026-03-06: Circular Progress Flicker on Tab Navigation / App Open

### Problem

The circular prayer-countdown ring disappeared for ~1 second and reappeared every time the user opened the app, switched away from the Home tab and came back, navigated between days and returned to today, or the app returned from background.

### Root Causes (4 interacting issues)

1. **`fetchPrayerTimes()` unconditionally set `setLoading(true)`** — even when prayer data already existed. Because the main content area is wrapped in `loading ? <ActivityIndicator> : <ScrollView>`, setting loading to `true` briefly replaced the entire circular progress with a spinner.

2. **Main data-fetching `useEffect` unconditionally reset progress to zero** — `setProgressPercent(0)` and `progressAnimation.setValue(0)` ran at the top of the effect body. The `Animated.Value.setValue(0)` is NOT batched by React; it immediately zeroes the SVG arc. The effect re-fired whenever `lastRefreshDate` changed (e.g. initial load reads it from AsyncStorage, then `checkDayChange` sets it again), causing a visual flash of an empty circle.

3. **`[nextPrayer]` reset effect used object-reference equality** — `useEffect(..., [nextPrayer])` watched a state object. Whenever the same prayer logically stayed "next" but a new object was created, the effect fired, resetting progress to 0 for 150ms. Combined with `freezeOnBlur` (React Navigation v7 default), queued state updates could trigger this on tab unfreeze.

4. **NEXTPRAYER KEY EFFECT's 150ms delayed reset fired on initial load AND day navigation** — Even after replacing the `[nextPrayer]` dependency with a stable key, the reset effect still fired whenever the key changed from `''` (initial/null state) to a prayer key. This happened on every app launch and when navigating between days (which calls `setNextPrayer(null)` → then sets a new prayer). Device logs confirmed: `updateCountdown` would compute the correct progress (e.g. 0.019), then 150ms later the reset timeout would overwrite it to 0, showing zero progress for ~900ms before the next interval tick corrected it.

### Fixes Applied

- `fetchPrayerTimes`: only call `setLoading(true)` when `!prayerTimes` (no data yet). Silent background refresh when data exists.
- Main data effect: guard `setProgressPercent(0)` and `progressAnimation.setValue(0)` behind `if (!prayerTimes)`.
- Replace `[nextPrayer]` dependency with a stable string key (`name|timestamp`) tracked via a ref.
- **Removed the 150ms delayed progress reset entirely** from the NEXTPRAYER KEY EFFECT. Progress transitions are now handled smoothly by `updateCountdown` via `Animated.timing`, which computes the correct value from real-time calculations every second. This eliminates all flash-to-zero artifacts across all scenarios: initial load, tab switching, day navigation, and app backgrounding.
- `useFocusEffect` in `index.tsx`: moved `prayerTimes` and `loading` reads to refs so the callback identity only changes when `regionId` changes, preventing unnecessary re-invocations on each focus event.

### Prevention

- Never unconditionally set `loading = true` in a fetch function when cached/existing data can be displayed during the fetch.
- Avoid `Animated.Value.setValue()` inside effects that re-fire frequently — Animated mutations are NOT batched by React and cause immediate visual changes.
- When an effect depends on an object, derive a stable primitive key (string/number) for the dependency instead of using the object reference directly.
- **Do not use delayed `setTimeout` resets for animated values** — they race with interval-based updates and create visual artifacts. Let the interval's natural computation handle transitions smoothly via `Animated.timing`.
- Always use **device logging (`adb logcat`)** to verify state transition timing when theoretically-correct fixes don't resolve visual issues. The actual render timing on a device can differ from mental models.
- Be aware of `freezeOnBlur` in React Navigation tabs: state updates still queue while frozen and all flush on tab focus, which can trigger effects with object-reference dependencies.
