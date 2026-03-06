# Deep Line-by-Line Audit Report — 38-File UI Scope

**Date:** 2025-07-13  
**Scope:** 38 files across `app/(tabs)/`, `app/components/`, `app/config/`, `app/safeArea.ts`, `components/`  
**Auditor:** GitHub Copilot

> **Excluded (already fixed):**
>
> 1. RevenueCatPaywall product deduplication — FIXED
> 2. `app/contexts/ThemeContext.js` re-export — FIXED

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

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 0      |
| HIGH      | 2      |
| MEDIUM    | 8      |
| LOW       | 11     |
| **Total** | **21** |

---

## HIGH Findings

### H-1 — Search result opens surah at start, not at matched ayah

- **File:** `app/components/quran/QuranSearchResults.tsx`
- **Line:** 62
- **Category:** Bug
- **Description:**  
  When a user taps a search result, `openSurah(item.surah.number)` is called with only the surah number. The matched ayah number (`item.numberInSurah`) is discarded. The user lands at the beginning of the surah instead of the verse they searched for.
- **Fix:** Pass the ayah number: `openSurah(item.surah.number, item.numberInSurah - 1)` and have `openSurah` set `scrollToAyahRef.current` to that index.

---

### H-2 — Debug text "RevenueCat Status: Ready" hardcoded in production UI

- **File:** `app/components/settings/AboutSection.tsx`
- **Line:** 59
- **Category:** Bug / Quality
- **Description:**  
  The string `"RevenueCat Status: Ready"` is hardcoded and always displayed to users. This is developer debug text visible in the production Settings screen. It does not reflect actual RevenueCat status.
- **Fix:** Remove the debug text block entirely, or conditionally render only when `__DEV__` is true.

---

## MEDIUM Findings

### M-1 — `createStyles()` called every render without memoization

- **File:** `app/(tabs)/qibla.tsx`
- **Line:** 193
- **Category:** Performance
- **Description:**  
  `const styles = createStyles(colors, isDark, language, isFacingQibla)` calls `StyleSheet.create()` on every render. The `createStyles` function is defined at line 472 and creates a new stylesheet each time.
- **Fix:** Wrap in `useMemo()`:
  ```ts
  const styles = useMemo(
    () => createStyles(colors, isDark, language, isFacingQibla),
    [colors, isDark, language, isFacingQibla],
  );
  ```

---

### M-2 — AsyncStorage polled every 1.5s for support trigger

- **File:** `app/(tabs)/index.tsx`
- **Line:** 210
- **Category:** Performance
- **Description:**  
  `setInterval(check, 1500)` polls AsyncStorage continuously while the Home screen is focused, reading and checking `support_trigger` every 1.5 seconds. This creates unnecessary I/O.
- **Fix:** Use an event-based approach (e.g., `DeviceEventEmitter`) or increase the interval to 10–30 seconds.

---

### M-3 — Hardcoded color `'#F5F1E6'` in light mode gradient (dua.tsx)

- **File:** `app/(tabs)/dua.tsx`
- **Lines:** 104, 106
- **Category:** Style / Consistency
- **Description:**  
  The time-based gradient function hardcodes `'#F5F1E6'` and `'#F2EEE1'` for the Maghrib and Isha time bands. All other bands correctly use theme colors. These will not adapt if the palette changes.
- **Fix:** Replace with `colors.background.tertiary` or an appropriate theme token.

---

### M-4 — Same hardcoded gradient colors in qibla.tsx

- **File:** `app/(tabs)/qibla.tsx`
- **Lines:** 71, 73
- **Category:** Style / Consistency
- **Description:**  
  Identical hardcoded colors `'#F5F1E6'` and `'#F2EEE1'` as M-3. Copy-pasted gradient logic.
- **Fix:** Extract to a shared utility or replace with theme tokens.

---

### M-5 — SVG gradient uses `SepiaColors` instead of themed colors

- **File:** `app/components/home/EnhancedCircularProgress.tsx`
- **Lines:** 72–74, 82
- **Category:** Style / Consistency
- **Description:**  
  The SVG `<LinearGradient>` uses `SepiaColors.accent.gold`, `.amber`, `.copper` directly, and the background circle stroke uses `SepiaColors.border.light`. These bypass the theme system and won't adapt to a future palette change or dark-mode gradient adjustments. The component receives `colors` and other theme props but doesn't use them for SVG fills.
- **Fix:** Use the themed `colors` prop values instead of importing `SepiaColors`.

---

### M-6 — `Paywall.tsx` and `PaywallNew.tsx` are identical files

- **File:** `app/components/Paywall.tsx`, `app/components/PaywallNew.tsx`
- **Lines:** Entire files (15 lines each)
- **Category:** Dead Code
- **Description:**  
  Both files are byte-for-byte identical — each is a thin wrapper around `RevenueCatPaywall`. Having two identical files creates maintenance confusion.
- **Fix:** Delete one file and update any imports to use the other.

---

### M-7 — `SCREEN_WIDTH` / `SCREEN_HEIGHT` stale on orientation change (WelcomeSlides)

- **File:** `components/WelcomeSlides.tsx`
- **Line:** 26
- **Category:** Performance / Bug
- **Description:**  
  `const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')` is captured at module load time. If the user rotates their device during onboarding, pagination (`Math.round(offsetX / SCREEN_WIDTH)` at line 174) and slide widths (lines 219, 315, 369, 440) will use stale values, causing broken layout and incorrect page tracking.
- **Fix:** Use `useWindowDimensions()` hook inside the component for reactive dimension updates.

---

### M-8 — `safeArea.ts` is placeholder dead code

- **File:** `app/safeArea.ts`
- **Lines:** Entire file (13 lines)
- **Category:** Dead Code
- **Description:**  
  File contains a stub function `shouldUseAbsoluteTabBar` that always returns `false`, with a comment: _"This file should be removed once Metro cache is fully cleared."_ It's leftover from a cache-busting workaround.
- **Fix:** Delete the file and remove any imports referencing it.

---

## LOW Findings

### L-1 — Dead `isDark` and `colorScheme` variables in `_layout.tsx`

- **File:** `app/(tabs)/_layout.tsx`
- **Lines:** 11–12
- **Category:** Dead Code
- **Description:**  
  `useColorScheme()` (line 11) and `const isDark = colorScheme === 'dark'` (line 12) are computed but never used. The component uses `themeIsDark` from `useTheme()` (line 14) through `darkMode` (line 16) instead. The `useColorScheme()` call also causes an unnecessary re-render subscription.
- **Fix:** Remove lines 11–12 and the `useColorScheme` import.

---

### L-2 — Dead `glowColor` prop in home `MagicalButton`

- **File:** `app/components/home/MagicalButton.tsx`
- **Lines:** 23, 34
- **Category:** Dead Code
- **Description:**  
  The `glowColor?: string` prop is defined in `MagicalButtonProps` (line 23) but never destructured or used in the component implementation (line 34 destructures all props except `glowColor`). Callers pass it (e.g., `QuranSettingsSection.tsx` line 304, `AboutSection.tsx` line 50) to no effect.
- **Fix:** Either implement the glow effect using the prop, or remove it from the interface and all call sites.

---

### L-3 — Dead `base` variable in settings gradient

- **File:** `app/(tabs)/settings.tsx`
- **Line:** 149
- **Category:** Dead Code
- **Description:**  
  `const base = getTimeBasedGradientColors(C, isDark)` is assigned but `base` is never read. The function immediately enters `if/else` blocks that return hardcoded color arrays, ignoring the computed `base`.
- **Fix:** Remove the `base` assignment and the `getTimeBasedGradientColors` import if no longer needed.

---

### L-4 — Dead import `getAllTranslations` in WelcomeSlides

- **File:** `components/WelcomeSlides.tsx`
- **Line:** 24
- **Category:** Dead Code
- **Description:**  
  `import { getAllTranslations } from '../translations'` is imported but never used anywhere in the component.
- **Fix:** Remove the import.

---

### L-5 — Dead `width` and `height` variables in SplashScreen

- **File:** `components/SplashScreen.tsx`
- **Line:** 21
- **Category:** Dead Code
- **Description:**  
  `const { width, height } = Dimensions.get('window')` declares two variables that are never referenced in the component or its stylesheet.
- **Fix:** Remove line 21.

---

### L-6 — `SCREEN_WIDTH` / `SCREEN_HEIGHT` stale on orientation change (OnboardingTooltips)

- **File:** `components/OnboardingTooltips.tsx`
- **Line:** 16
- **Category:** Performance
- **Description:**  
  Same issue as M-7 — `Dimensions.get('window')` captured at module level. Tooltip vertical positioning (`getTopOffset`, lines 124–131) uses stale `SCREEN_HEIGHT` after rotation.
- **Fix:** Use `useWindowDimensions()` inside the component.

---

### L-7 — `screenWidth` stale on orientation change (index.tsx)

- **File:** `app/(tabs)/index.tsx`
- **Line:** 50
- **Category:** Performance
- **Description:**  
  `const { width: screenWidth } = Dimensions.get('window')` is captured at module load. Used at line 427 for circular progress sizing (`Math.min(260, screenWidth * 0.75)`). Will be stale after rotation.
- **Fix:** Use `useWindowDimensions()` or the existing `screenData` state from `_layout.tsx`.

---

### L-8 — `RegionPicker` uses `SepiaColors` instead of themed colors

- **File:** `app/components/home/RegionPicker.tsx`
- **Lines:** 52, 76
- **Category:** Style / Consistency
- **Description:**  
  The close icon (line 52) uses `SepiaColors.text.primary` and the check icon (line 76) uses `SepiaColors.accent.gold` directly instead of the themed `colors` values passed via props/context.
- **Fix:** Pass themed colors as props or use `useTheme()`.

---

### L-9 — Legacy styles in `settingsStyles.ts` use `SepiaColors` directly

- **File:** `app/components/settings/settingsStyles.ts`
- **Lines:** 657, 746, 778, 815
- **Category:** Style / Consistency
- **Description:**  
  Four legacy style properties (`locationValue`, `supportButton`, `testButton`, `updateLocationButton`) reference `SepiaColors.accent.gold` directly instead of the themed `colors.accent.gold` that is available in the factory function parameter.
- **Fix:** Replace `SepiaColors.accent.gold` with `colors.accent.gold` in these four locations.

---

### L-10 — `prayerTimeConfig.ts` default export references function before declaration

- **File:** `app/config/prayerTimeConfig.ts`
- **Lines:** 173–182
- **Category:** Style / Quality
- **Description:**  
  The default export object at line 173 references `getCountryIsoCode`, which is declared as a function at line 184. While JavaScript hoists function declarations so this works at runtime, the ordering is confusing — the default export appears to reference an undefined symbol when reading top-to-bottom.
- **Fix:** Move the `getCountryIsoCode` function definition above the default export block.

---

### L-11 — Duplicated time-based gradient logic across screens

- **File:** `app/(tabs)/dua.tsx` (lines 95–108), `app/(tabs)/qibla.tsx` (lines 55–76), `app/(tabs)/settings.tsx` (lines 146–164)
- **Category:** Style / DRY Violation
- **Description:**  
  Three screens contain nearly identical `getTimeBasedGradient()` implementations with the same hour-range logic and color arrays. A `getTimeBasedGradientColors` utility is imported in `settings.tsx` (line 31) but not actually used (see L-3).
- **Fix:** Consolidate into the shared `getTimeBasedGradientColors` utility and use it in all three screens.

---

## Files Audited — No Issues Found

The following files were audited line-by-line and found to have **no new issues**:

| #   | File                                                 | Lines |
| --- | ---------------------------------------------------- | ----- |
| 1   | `app/components/home/homeStyles.ts`                  | 484   |
| 2   | `app/components/home/homeTypes.ts`                   | 60    |
| 3   | `app/components/home/MagicalFooter.tsx`              | 120   |
| 4   | `app/components/home/MagicalHeader.tsx`              | 105   |
| 5   | `app/components/home/AnimatedPrayerIcon.tsx`         | 80    |
| 6   | `app/components/quran/FloatingAudioPlayer.tsx`       | 130   |
| 7   | `app/components/quran/quranStyles.ts`                | 160   |
| 8   | `app/components/quran/SurahListItem.tsx`             | 55    |
| 9   | `app/components/RevenueCatPaywall.tsx`               | 350   |
| 10  | `app/components/settings/AppearanceSection.tsx`      | 42    |
| 11  | `app/components/settings/index.ts`                   | 11    |
| 12  | `app/components/settings/LanguageSection.tsx`        | 65    |
| 13  | `app/components/settings/LocationSection.tsx`        | 240   |
| 14  | `app/components/settings/MagicalButton.tsx`          | 50    |
| 15  | `app/components/settings/NotificationSection.tsx`    | 210   |
| 16  | `app/components/settings/QuranSettingsSection.tsx`   | 325   |
| 17  | `app/components/settings/ReciterPickerModal.tsx`     | 90    |
| 18  | `app/components/settings/TranslationPickerModal.tsx` | 120   |
| 19  | `app/components/settings/WidgetSection.tsx`          | 270   |

---

## Cross-Cutting Observations

1. **Theme bypass pattern:** Multiple components import `SepiaColors` directly instead of using the themed `colors` from `useTheme()`. While this works when the app only has a single color palette, it will break if a second theme or dynamic palette is ever introduced. Files affected: `EnhancedCircularProgress.tsx`, `RegionPicker.tsx`, `settingsStyles.ts` (legacy section).

2. **Stale `Dimensions` pattern:** Three files capture `Dimensions.get('window')` at module level, creating stale width/height values after device rotation. The `_layout.tsx` file already implements the correct pattern with `Dimensions.addEventListener('change', ...)`.

3. **Duplicated gradient logic:** The `getTimeBasedGradient()` function is copy-pasted across `dua.tsx`, `qibla.tsx`, and `settings.tsx`. A shared utility (`getTimeBasedGradientColors`) already exists in `utils/colorHelpers` but is imported and not used.
