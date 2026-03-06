# Comprehensive Code Audit Report — Full App

**Date:** 2025-07-12  
**Scope:** All screens, components, hooks, contexts, and config files  
**Focus:** Real bugs causing crashes, wrong behavior, or poor UX

---

## Table of Contents

1. [CRITICAL Issues](#1-critical-issues)
2. [HIGH Severity Issues](#2-high-severity-issues)
3. [MEDIUM Severity Issues](#3-medium-severity-issues)
4. [LOW Severity Issues](#4-low-severity-issues)
5. [Summary & Priorities](#5-summary--priorities)

---

## 1. CRITICAL Issues

### 1.1 — Empty `app/contexts/ThemeContext.js` — import confusion risk

| Field        | Value                          |
| ------------ | ------------------------------ |
| **File**     | `app/contexts/ThemeContext.js` |
| **Line(s)**  | Entire file (0 lines)          |
| **Severity** | CRITICAL                       |

**Description:** This file is completely empty. The real `ThemeContext` lives at `contexts/ThemeContext.js` (workspace root). Any file inside `app/` that resolves `../contexts/ThemeContext` could hit this empty file instead of the real one, resulting in `undefined` exports (`useTheme`, `ThemeProvider`) and a runtime crash.

**Impact:** Currently all imports target the root file via `../../contexts/ThemeContext`. But any new component or refactor inside `app/` could silently pick up the empty file. This is a time bomb.

**Fix:** Delete the file or convert it to a re-export:

```js
export { ThemeProvider, useTheme } from "../../contexts/ThemeContext";
```

---

### 1.2 — Paywall renders duplicate products

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| **File**     | `app/components/RevenueCatPaywall.tsx` |
| **Line(s)**  | 162 and 177                            |
| **Severity** | CRITICAL                               |

**Description:** The paywall renders two separate lists back-to-back:

```tsx
{packages.map((pkg) => ( /* ... */ ))}   // Line 162
{products.map((p) => ( /* ... */ ))}      // Line 177
```

`packages` comes from RevenueCat Offerings and `products` comes from a direct `Purchases.getProducts(DONATION_PRODUCT_IDS)` call. If the same product ID appears in both (which it does — `DONATION_PRODUCT_IDS` includes the same IDs RevenueCat Offerings can contain), users see the same donation option **twice**.

**Impact:** Duplicate purchase options confuse users. They may think these are different products and tap the wrong one.

**Fix:** Filter out duplicates:

```tsx
const packageIds = new Set(packages.map((p) => p.product.identifier));
const uniqueProducts = products.filter((p) => !packageIds.has(p.identifier));
// Render uniqueProducts instead of products
```

---

## 2. HIGH Severity Issues

### 2.1 — Hardcoded `SepiaColors` throughout Home screen — broken dark mode

| Field        | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| **File**     | `app/(tabs)/index.tsx`                                               |
| **Line(s)**  | 282, 286, 291, 354, 358, 368, 370, 394, 405, 451, 482, 505, 506, 534 |
| **Severity** | HIGH                                                                 |

**Description:** The Home screen uses `SepiaColors` (static light-mode constants) in **17 places** instead of the themed `colors` object from `useTheme()`. This includes:

- `SafeAreaView` and `StatusBar` background colors
- `ActivityIndicator` color
- All `MaterialCommunityIcons` color props (map-marker, chevron-right, calendar-today)
- Nav day dot `backgroundColor`
- Prayer time icon colors

Meanwhile the file even has a comment at line 55: _"Shorthand alias used during gradual migration from static SepiaColors styles"_ — the migration was never completed.

**Impact:** In dark mode, gold icons, spinners, and background colors render with light-mode values, creating poor contrast and broken visual appearance.

**Fix:** Replace each `SepiaColors.X` with the equivalent `C.X` (the alias for `colors`) that's already in scope. E.g.:

```tsx
// Before
color={SepiaColors.accent.gold}
// After
color={C.accent.gold}
```

---

### 2.2 — Hardcoded `SepiaColors` in `EnhancedCircularProgress` — broken dark mode

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| **File**     | `app/components/home/EnhancedCircularProgress.tsx` |
| **Line(s)**  | ~84-87, 94, 125, 134                               |
| **Severity** | HIGH                                               |

**Description:** SVG gradient stop colors (`SepiaColors.accent.gold`, `.amber`, `.copper`), circle border colors (`SepiaColors.border.light`), and icon colors are all hardcoded `SepiaColors`.

**Impact:** The circular prayer progress indicator always renders in sepia-light colors regardless of theme. In dark mode it clashes with the dark background.

**Fix:** Accept `colors` from props or context and use themed values for gradients and borders.

---

### 2.3 — Hardcoded `SepiaColors` in `RegionPicker` — invisible icons in dark mode

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| **File**     | `app/components/home/RegionPicker.tsx` |
| **Line(s)**  | ~54, 79                                |
| **Severity** | HIGH                                   |

**Description:** Close button icon uses `SepiaColors.text.primary` (dark text color) and check icon uses `SepiaColors.accent.gold`. On a dark-mode background, dark text color icons become invisible.

**Impact:** Users cannot see the close/dismiss button in dark mode.

**Fix:** Use `colors.text.primary` and `colors.accent.gold` from the theme.

---

### 2.4 — Three hardcoded English strings bypass `t()` translation

| Field        | Value                  |
| ------------ | ---------------------- |
| **File**     | `app/(tabs)/index.tsx` |
| **Line(s)**  | ~392, 397, 398         |
| **Severity** | HIGH                   |

**Description:**

```tsx
"Changing location..."; // Line ~392
"Loading prayer times for new location..."; // Line ~397
"Please wait a moment..."; // Line ~398
```

These user-facing strings are hardcoded in English and not wrapped in `t()`.

**Impact:** Arabic-language users see English text during location changes and loading states. Breaks the bilingual UX promise.

**Fix:** Add keys to both `en.json` and `ar.json` translation files, then use `t('changingLocation')`, `t('loadingNewLocation')`, `t('pleaseWait')`.

---

### 2.5 — Compass interpolation clips at ±360° — compass freezes

| Field        | Value                  |
| ------------ | ---------------------- |
| **File**     | `app/(tabs)/qibla.tsx` |
| **Line(s)**  | 55, 108, 111, 165-172  |
| **Severity** | HIGH                   |

**Description:** The compass heading uses an accumulated rotation pattern:

```tsx
accumulatedCompass.current += delta; // Line 108 — grows unboundedly
Animated.spring(compassRotateAnim, {
  toValue: -accumulatedCompass.current, // Line 111
});
```

But the interpolation clamps:

```tsx
compassRotateAnim.interpolate({
  inputRange: [-360, 360], // Line 166 — clamps outside this range
  outputRange: ["-360deg", "360deg"],
});
```

**Impact:** After the user rotates their device more than one full circle in either direction (accumulated > 360), the compass visual freezes because the interpolated output is clamped. The same issue affects `qiblaRotateInterpolate` (line 170).

**Fix:** Add `extrapolate: 'extend'` to both interpolations:

```tsx
compassRotateAnim.interpolate({
  inputRange: [-360, 360],
  outputRange: ["-360deg", "360deg"],
  extrapolate: "extend", // ← allows values beyond ±360
});
```

---

### 2.6 — `openSurah` has stale `surahList` in closure

| Field        | Value                              |
| ------------ | ---------------------------------- |
| **File**     | `app/(tabs)/quran.tsx`             |
| **Line(s)**  | `openSurah` useCallback definition |
| **Severity** | HIGH                               |

**Description:** `openSurah` is wrapped in `useCallback` with dependency array `[t, translationEdition]`, but the function body accesses `surahList` (a state variable) from the closure. `surahList` is not in the deps array.

**Impact:** If `surahList` changes after initial load (e.g., due to error recovery or data refresh), `openSurah` will use the stale reference. Accessing `surahList[index]` with the old data could yield wrong surah content or crash with an undefined access.

**Fix:** Add `surahList` to the dependency array:

```tsx
const openSurah = useCallback(
  async (surahNumber: number) => {
    // ...
  },
  [t, translationEdition, surahList],
);
```

---

### 2.7 — Verbose RevenueCat logging always ON in production Android

| Field        | Value                                |
| ------------ | ------------------------------------ |
| **File**     | `app/contexts/RevenueCatContext.tsx` |
| **Line(s)**  | 52-57                                |
| **Severity** | HIGH                                 |

**Description:**

```tsx
const IS_ANDROID = Platform.OS === 'android';                           // L52
const VERBOSE_RC = IS_ANDROID || Boolean(process.env.EXPO_PUBLIC_RC_DEBUG...) // L54
const debugLog = (...args: any[]) => {
  if (IS_ANDROID || (__DEV__ && VERBOSE_RC)) {                          // L57
    console.log(...args);
  }
};
```

The condition `IS_ANDROID || (...)` short-circuits: on any Android device (including production), `IS_ANDROID` is `true`, so `debugLog` always executes `console.log`. The `__DEV__` guard only protects the second branch.

**Impact:** Production Android builds log RevenueCat details (offering IDs, product IDs, entitlement status, configuration state) to the console. This is a performance concern and exposes internal data via USB debugging.

**Fix:** Gate the entire function behind `__DEV__`:

```tsx
const debugLog = (...args: any[]) => {
  if (__DEV__ && (IS_ANDROID || VERBOSE_RC)) {
    console.log(...args);
  }
};
```

---

### 2.8 — Home screen polls AsyncStorage every 1.5s for support trigger

| Field        | Value                  |
| ------------ | ---------------------- |
| **File**     | `app/(tabs)/index.tsx` |
| **Line(s)**  | ~195-210               |
| **Severity** | HIGH                   |

**Description:** A `setInterval(check, 1500)` continuously reads `AsyncStorage.getItem('support_trigger')` every 1.5 seconds, indefinitely, for the entire lifetime of the Home tab.

**Impact:** Hundreds of AsyncStorage reads per minute for an event that fires once per month. Wastes CPU/battery and creates unnecessary bridge crossings.

**Fix:** Replace with an event-driven approach:

```tsx
useEffect(() => {
  const check = async () => {
    /* existing check logic */
  };
  check(); // initial check
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") check();
  });
  return () => sub.remove();
}, [iapLoading]);
```

---

### 2.9 — `InnerLayout` uses `useColorScheme()` instead of `useTheme()` for StatusBar

| Field        | Value             |
| ------------ | ----------------- |
| **File**     | `app/_layout.tsx` |
| **Line(s)**  | 82-83             |
| **Severity** | HIGH              |

**Description:** The `InnerLayout` component determines dark mode via:

```tsx
const colorScheme = useColorScheme();
const isDark = colorScheme === "dark";
```

It uses this `isDark` for the `StatusBar` barStyle and `Stack` contentStyle backgroundColor. However, the app has an in-app theme toggle (via `ThemeContext`) that lets users force dark or sepia mode independently of the system setting.

**Impact:** If a user enables dark mode via the Settings toggle but their system is in light mode, the StatusBar and Stack background remain light. The colors mismatch with the rest of the themed UI.

**Fix:** Use `useTheme()` directly:

```tsx
const { isDark, colors } = useTheme();
```

Note: The `useTheme()` import already exists in the file.

---

## 3. MEDIUM Severity Issues

### 3.1 — `glowColor` prop accepted but never used in Home `MagicalButton`

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| **File**     | `app/components/home/MagicalButton.tsx` |
| **Line(s)**  | 21, 31-39                               |
| **Severity** | MEDIUM                                  |

**Description:** The `MagicalButtonProps` interface declares `glowColor?: string` (line 21), and `MagicalArrowButton` passes it (line 115: `glowColor={disabled ? SepiaColors.special.disabled : SepiaColors.accent.gold}`). However, `MagicalButton`'s destructured parameters (lines 31-39) do NOT include `glowColor` — it's never read or applied.

**Impact:** Misleading API. Developers think the glow color is being customized, but nothing changes visually. Dead prop.

**Fix:** Either:

- Destructure and use `glowColor` (e.g., as `borderColor` or shadow tint), OR
- Remove the prop from the interface and call sites

---

### 3.2 — `WelcomeSlides` captures `Dimensions` at module level (stale on resize)

| Field        | Value                          |
| ------------ | ------------------------------ |
| **File**     | `components/WelcomeSlides.tsx` |
| **Line(s)**  | 27                             |
| **Severity** | MEDIUM                         |

**Description:**

```tsx
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
```

Captured once at module load time.

**Impact:** If the device rotates or enters split-screen mode, `SCREEN_WIDTH` and `SCREEN_HEIGHT` are stale. The horizontal FlatList paging for onboarding slides would be mis-sized, causing partial slide rendering.

**Fix:** Use `useWindowDimensions()` from React Native inside the component.

---

### 3.3 — `MagicalFooter` captures `Dimensions` at module level

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| **File**     | `app/components/home/MagicalFooter.tsx` |
| **Line(s)**  | 11                                      |
| **Severity** | MEDIUM                                  |

**Description:** Same pattern as WelcomeSlides:

```tsx
const { width: screenWidth } = Dimensions.get("window");
```

**Impact:** Shimmer animation width stale on rotation. Lower impact since Home is primarily portrait.

**Fix:** Use `useWindowDimensions()`.

---

### 3.4 — `SplashScreen.tsx` appears unused (dead code)

| Field        | Value                         |
| ------------ | ----------------------------- |
| **File**     | `components/SplashScreen.tsx` |
| **Line(s)**  | Entire file (~250 lines)      |
| **Severity** | MEDIUM                        |

**Description:** `app/_layout.tsx` has `assetsLoaded` hardcoded to `true` with the comment: _"No startup animation / blocking screen anymore"_. The `SplashScreen` component appears to have no active imports.

**Impact:** 250 lines of dead code. No runtime effect, but adds maintenance and bundle overhead.

**Fix:** Move to trash.

---

### 3.5 — `PaywallNew.tsx` duplicates `Paywall.tsx` (dead code)

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| **File**     | `app/components/PaywallNew.tsx` and `app/components/Paywall.tsx` |
| **Line(s)**  | Entire files                                                     |
| **Severity** | MEDIUM                                                           |

**Description:** Both are thin wrappers around `RevenueCatPaywall`. Having three files for one component creates confusion about which to import or modify.

**Impact:** Maintenance confusion, potential for divergent edits.

**Fix:** Keep only `RevenueCatPaywall.tsx`, update imports, trash the wrappers.

---

### 3.6 — `AnimatedPrayerIcon` doesn't capture loop reference for cleanup

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| **File**     | `app/components/home/AnimatedPrayerIcon.tsx` |
| **Line(s)**  | 24-52                                        |
| **Severity** | MEDIUM                                       |

**Description:** `Animated.loop(...)` is started but its return value is not captured. Cleanup calls `scale.stopAnimation()` and `rotate.stopAnimation()` on the animated values directly, but doesn't call `.stop()` on the loop handle.

**Impact:** If the component unmounts mid-animation, the loop may continue running on detached animated values, causing a memory leak and potential React warnings.

**Fix:**

```tsx
useEffect(() => {
  const scaleLoop = Animated.loop(Animated.sequence([...]));
  scaleLoop.start();
  return () => scaleLoop.stop();
}, [prayer, active, isSolar, subtle]);
```

---

### 3.7 — `createStyles()` called every render in Qibla (no memoization)

| Field        | Value                  |
| ------------ | ---------------------- |
| **File**     | `app/(tabs)/qibla.tsx` |
| **Line(s)**  | ~210                   |
| **Severity** | MEDIUM                 |

**Description:** `const styles = createStyles(colors, isDark, language, isFacingQibla)` runs on every render. `createStyles` calls `StyleSheet.create()` internally, allocating a new style registry entry each time.

**Impact:** The Qibla screen re-renders every ~32ms as compass data updates. That's ~30 `StyleSheet.create()` calls per second — unnecessary GC pressure.

**Fix:**

```tsx
const styles = useMemo(
  () => createStyles(colors, isDark, language, isFacingQibla),
  [colors, isDark, language, isFacingQibla],
);
```

---

### 3.8 — All animations disabled in `useHomeAnimations` — static values

| Field        | Value                             |
| ------------ | --------------------------------- |
| **File**     | `hooks/home/useHomeAnimations.ts` |
| **Line(s)**  | Throughout                        |
| **Severity** | MEDIUM                            |

**Description:** All animation loops are disabled with a console log: _"🚫 Magical animations temporarily disabled to fix driver conflicts"_. The animated values (`footerBreathingAnimation`, `shimmerAnimation`, `arrowBounceAnimation`, etc.) are created but stay at their initial values forever.

**Impact:** Components consuming these values receive static initial values. For example, `MagicalFooter`'s breathing interpolation has `inputRange: [1, 1.05]` — since the value stays at 1, output is always the start value. Shimmer effect never moves. Arrow bounce never bounces. The app loses its "magical" visual polish.

**Fix:** Either re-enable the animations (fixing the driver conflicts mentioned in the comment) or remove the animation infrastructure to reduce complexity.

---

### 3.9 — Hardcoded fallback colors in Qibla & Dua gradients

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| **Files**    | `app/(tabs)/qibla.tsx` (~lines 79-82), `app/(tabs)/dua.tsx` |
| **Severity** | MEDIUM                                                      |

**Description:** The `getTimeBasedGradient()` function in both files has specific time slots using hardcoded hex colors `'#F5F1E6'` and `'#F2EEE1'` instead of theme values.

**Impact:** These two time-of-day gradients don't adapt to theme changes. Minor visual inconsistency.

**Fix:** Replace with `colors.background.tertiary` / `colors.surface.secondary` from the theme.

---

### 3.10 — Notification health-check interval runs unconditionally

| Field        | Value                                |
| ------------ | ------------------------------------ |
| **File**     | `hooks/home/useHomeNotifications.ts` |
| **Line(s)**  | ~260-300                             |
| **Severity** | MEDIUM                               |

**Description:** A 60-second `setInterval` for notification status checking runs from mount to unmount, even when notifications are globally disabled by the user.

**Impact:** The callback does exit early when disabled (checking `notificationsEnabledRef.current`), so the practical overhead is minimal — just the timer firing and the early return. But it's wasteful.

**Fix:** Conditionally set/clear the interval based on notification enabled state.

---

### 3.11 — Tab `_layout.tsx` declares unused `isDark` from `useColorScheme()`

| Field        | Value                    |
| ------------ | ------------------------ |
| **File**     | `app/(tabs)/_layout.tsx` |
| **Line(s)**  | 11-14                    |
| **Severity** | MEDIUM                   |

**Description:**

```tsx
const colorScheme = useColorScheme();
const isDark = colorScheme === "dark"; // ← never used
const { colors, isDark: themeIsDark } = useTheme();
```

**Impact:** `useColorScheme()` hook call is wasted. `isDark` is dead code.

**Fix:** Remove lines 11-12 since `themeIsDark` from `useTheme()` is the correct source.

---

### 3.12 — Notification settings polling every 10s via AsyncStorage

| Field        | Value                                |
| ------------ | ------------------------------------ |
| **File**     | `hooks/home/useHomeNotifications.ts` |
| **Line(s)**  | ~252                                 |
| **Severity** | MEDIUM                               |

**Description:** Notification settings (enabled/disabled, alert settings) are polled from AsyncStorage every 10 seconds.

**Impact:** Frequent bridge crossings. The settings rarely change (only when user visits Settings screen).

**Fix:** Use an event emitter pattern: when Settings saves to AsyncStorage, emit an event that the notification hook listens to. Or increase interval to 60s.

---

### 3.13 — `InAppNotification` uses hardcoded dark styling regardless of theme

| Field        | Value             |
| ------------ | ----------------- |
| **File**     | `app/_layout.tsx` |
| **Line(s)**  | 490-537           |
| **Severity** | MEDIUM            |

**Description:** The in-app notification overlay uses hardcoded dark colors (`rgba(30,30,30,0.95)`, `'#FFD700'`, `'white'`) regardless of the current theme.

**Impact:** In light mode, the dark overlay is attention-grabbing (possibly intentional), but it doesn't match the app's themed language. The hardcoded `#FFD700` gold may clash with sepia-themed gold values.

**Fix:** Either document as intentional or use theme colors.

---

## 4. LOW Severity Issues

### 4.1 — `getTimeBasedGradient()` duplicated across 4 files

| Field        | Value                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| **Files**    | `hooks/home/useHomeAnimations.ts`, `hooks/quran/useQuranData.ts`, `app/(tabs)/qibla.tsx`, `app/(tabs)/dua.tsx` |
| **Severity** | LOW                                                                                                            |

**Description:** The time-based gradient function is copy-pasted across 4 files with slight variations. A centralized version exists in `utils/colorHelpers.ts` (`getTimeBasedGradientColors`) but is not used by any of these files.

**Fix:** Use the centralized utility everywhere.

---

### 4.2 — Excessive `console.log` in production across hooks

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| **Files**    | Throughout hooks/\* and many component files |
| **Severity** | LOW                                          |

**Description:** Extensive `console.log` with emoji prefixes (`🔍`, `✅`, `🔄`, `⏱️`) throughout the codebase. No dev-only gating.

**Fix:** Create a logger utility gated by `__DEV__`, or use a babel plugin to strip console calls in production.

---

### 4.3 — Hardcoded RevenueCat API keys as fallbacks in source

| Field        | Value             |
| ------------ | ----------------- |
| **File**     | `app/_layout.tsx` |
| **Line(s)**  | ~189, 249         |
| **Severity** | LOW               |

**Description:** RevenueCat public API keys are hardcoded as fallbacks:

```tsx
"appl_HlFMTQjuEPSpeLuaudMrIpsLqsf";
"goog_dfuJwpbmzyvVmySItVuilefFYFM";
```

**Impact:** RevenueCat states public keys are safe client-side. However, hardcoded fallbacks bypass environment configuration and make key rotation harder.

**Fix:** Remove fallbacks; require env variable configuration.

---

### 4.4 — Mixed language in Alert messages

| Field        | Value                             |
| ------------ | --------------------------------- |
| **File**     | `hooks/home/useHomePrayerData.ts` |
| **Line(s)**  | ~197-200, ~720                    |
| **Severity** | LOW                               |

**Description:** Some alerts use `t()` for the title but hardcoded English for the body, e.g.:

```tsx
Alert.alert(t("cacheCleared"), "Fresh prayer times loaded", [
  { text: t("ok") },
]);
```

**Impact:** Arabic users see mixed-language alerts.

**Fix:** Wrap all user-facing strings in `t()`.

---

### 4.5 — `homeStyles.ts` uses fixed `paddingBottom: 70`

| Field        | Value                               |
| ------------ | ----------------------------------- |
| **File**     | `app/components/home/homeStyles.ts` |
| **Line(s)**  | ~24                                 |
| **Severity** | LOW                                 |

**Description:** Fixed `paddingBottom: 70` to account for the tab bar, but the actual tab bar height is dynamically calculated elsewhere based on device size and safe area insets.

**Impact:** On devices with large bottom safe areas, content may be clipped behind the tab bar. On small phones, excess padding.

**Fix:** Pass dynamic tab bar height as param to `createHomeStyles`.

---

### 4.6 — `prayerTimeConfig.ts` only supports Qatar

| Field        | Value                            |
| ------------ | -------------------------------- |
| **File**     | `app/config/prayerTimeConfig.ts` |
| **Severity** | LOW                              |

**Description:** Only Qatar cities configured (Doha, Al Wakrah, Al Khor, etc.) with method 10. No other countries.

**Impact:** Feature limitation. Users outside Qatar get Qatar-tuned prayer times.

**Fix:** Document the limitation clearly in README and about section. Plan multi-region support.

---

### 4.7 — `QuranSearchResults` uses simple `item.number` as keyExtractor

| Field        | Value                                         |
| ------------ | --------------------------------------------- |
| **File**     | `app/components/quran/QuranSearchResults.tsx` |
| **Line(s)**  | 42                                            |
| **Severity** | LOW                                           |

**Description:** `keyExtractor={(item) => `${item.number}`}`. If `item.number` is the global ayah number, keys are unique. But if it's the ayah-within-surah number, keys could collide across surahs.

**Fix:** Use composite key: `` `${item.surah.number}-${item.numberInSurah}` ``

---

### 4.8 — `goBack` in quran.tsx has empty dependency array (fragile)

| Field        | Value                  |
| ------------ | ---------------------- |
| **File**     | `app/(tabs)/quran.tsx` |
| **Severity** | LOW                    |

**Description:** `goBack` is wrapped in `useCallback(() => { ... }, [])` with an empty deps array. Currently safe because it reads from refs, but fragile if refactored to use state directly.

**Fix:** Either add relevant deps or document that all accesses must go through refs.

---

### 4.9 — Scroll-to-ayah in quran.tsx uses polling (60 attempts × 200ms)

| Field        | Value                  |
| ------------ | ---------------------- |
| **File**     | `app/(tabs)/quran.tsx` |
| **Line(s)**  | Inside `openSurah`     |
| **Severity** | LOW                    |

**Description:** After opening a surah, the code sets up a `setInterval(200ms)` with up to 60 attempts to scroll to the target ayah, waiting for the FlatList to be ready.

**Impact:** Works but is wasteful. Could use `onContentSizeChange` or `onLayout` callbacks instead.

**Fix:** Use FlatList's `onContentSizeChange` to trigger scroll once content is available.

---

## 5. Summary & Priorities

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 2      |
| HIGH      | 9      |
| MEDIUM    | 13     |
| LOW       | 9      |
| **Total** | **33** |

### Priority 1 — Fix Now (CRITICAL)

- [ ] **1.1** Delete or re-export empty `app/contexts/ThemeContext.js`
- [ ] **1.2** Deduplicate products in `RevenueCatPaywall.tsx`

### Priority 2 — Next Sprint (HIGH)

- [ ] **2.1-2.3** Replace all `SepiaColors` with themed `colors` in index.tsx, EnhancedCircularProgress, RegionPicker
- [ ] **2.4** Add missing translation keys for hardcoded English strings
- [ ] **2.5** Fix compass interpolation clamping (add `extrapolate: 'extend'`)
- [ ] **2.6** Fix `openSurah` stale closure (add `surahList` to deps)
- [ ] **2.7** Gate RC debugLog behind `__DEV__`
- [ ] **2.8** Replace 1.5s support trigger polling with `AppState` listener
- [ ] **2.9** Fix `InnerLayout` to use `useTheme()` instead of `useColorScheme()`

### Priority 3 — Backlog (MEDIUM)

- [ ] **3.1** Fix unused `glowColor` prop in MagicalButton
- [ ] **3.2-3.3** Replace module-level `Dimensions.get()` with `useWindowDimensions()`
- [ ] **3.4-3.5** Remove dead code (SplashScreen, PaywallNew, Paywall)
- [ ] **3.6** Fix AnimatedPrayerIcon loop cleanup
- [ ] **3.7** Memoize Qibla styles with `useMemo`
- [ ] **3.8** Re-enable or remove disabled animations
- [ ] **3.11** Remove unused `isDark` in tabs `_layout.tsx`
- [ ] **3.12** Reduce notification settings polling frequency

### Priority 4 — Polish (LOW)

- [ ] **4.1** Centralize `getTimeBasedGradient()` utility
- [ ] **4.2** Strip production console logs
- [ ] **4.4** Translate remaining hardcoded alert messages
