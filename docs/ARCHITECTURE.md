# Architecture

High-level architecture of the Prayer Times app.

## Tech Stack

| Layer           | Technology                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| Framework       | React Native 0.79 + Expo SDK 53                                                           |
| Routing         | Expo Router (file-based, tab group)                                                       |
| State           | React state + AsyncStorage for persistence                                                |
| Styling         | StyleSheet + theme context (5 themes)                                                     |
| Notifications   | Notifee + expo-notifications                                                              |
| Networking      | fetch (REST)                                                                              |
| Offline Storage | expo-file-system (large content), AsyncStorage (prefs/index), react-native-mmkv (fast KV) |

## Color System

The app supports 5 color themes, managed by `contexts/ThemeContext.js`:

| Theme Name            | Key Characteristics                                                |
| --------------------- | ------------------------------------------------------------------ |
| Dark                  | Deep backgrounds, muted gold accent (#F0D661), high contrast       |
| Classic Light (Sepia) | Warm cream tones (#F8F5F0), champagne gold (#D4AF37), cozy feel    |
| Warm & Natural        | Ivory backgrounds (#FAF8F3), antique gold (#C8A870), earthy warmth |
| Cool & Modern         | Slate backgrounds (#F8F9FA), silver-gold (#B8A565), professional   |
| Neutral & Minimal     | Pure white (#FFFFFF), champagne gold (#D4AF37), clean minimalism   |

### Theme Palette Structure

Each theme palette (`constants/*Colors.ts`) follows a consistent structure:

```
palette = {
  background: { primary, secondary, tertiary, elevated },
  surface: { primary, secondary, elevated, card, modal },
  text: { primary, secondary, tertiary, inverse, muted },
  accent: { gold, amber, copper, emerald, rose },
  prayer: { fajr, sunrise, dhuhr, asr, maghrib, isha },
  overlay: { light, medium, dark },
  semantic: { success, warning, error, info, pending },
  gradient: { primary: [start, middle, end], secondary: [...] }
}
```

### Centralized Color Utilities

`utils/colorHelpers.ts` provides theme-aware color manipulation:

- **`goldTint(alpha, colors)`** – Creates RGBA gold overlay using the theme's gold accent
- **`withAlpha(hex, alpha)`** – Adds alpha channel to any hex color
- **`lighten(hex, amount)` / `darken(hex, amount)`** – Adjusts color brightness
- **`getTimeBasedGradientColors(colors)`** – Returns gradient based on current time

### Usage Pattern

```tsx
// In components, get colors from theme context
const { colors, isDark } = useTheme();

// Use centralized helpers for dynamic colors
import { goldTint, withAlpha } from '../utils/colorHelpers';
const gt = (alpha: number) => goldTint(alpha, colors);

// Apply in styles
<View style={{ borderColor: gt(0.2) }}>
```

### Migration Notes

- All hardcoded `rgba(218, 165, 32, X)` values have been replaced with theme-aware `goldTint()` calls
- Theme persistence uses AsyncStorage key `app_theme_mode_v2` (migrated from v1)
- SplashScreen uses fixed SepiaColors (shown before theme context loads)

## Module Map

```
app/
  _layout.tsx          Root stack + providers (SafeArea, Theme, Language, RevenueCat, Onboarding)
  (tabs)/
    _layout.tsx        Tab navigator (Prayer Times, Dua, Quran, Qibla, Settings)
    index.tsx          Home / Prayer Times screen orchestrator (508 lines — wires hooks to extracted sub-components)
    hooks/
      useHomeAppStateSync.ts  Home AppState/date-resume synchronization
    dua.tsx            Duas & Azkar screen
    quran.tsx          Quran reader orchestrator (652 lines — wires hooks, coordinator fns, inline views)
    qibla.tsx          Qibla compass screen
    settings.tsx       Settings orchestrator (277 lines — wires hooks to section components)
  components/
    home/              Home screen extracted components & types
      homeStyles.ts            Style factory: createHomeStyles(colors, isDark)
      homeTypes.ts             PrayerData, NextPrayer, RegionItem, NotificationSettings, HomeStyles
      AnimatedPrayerIcon.tsx   Animated prayer icon component
      MagicalButton.tsx        Themed button + arrow variant (shimmer, glow, shared via mbShared)
      MagicalHeader.tsx        Animated header bar (title, refresh, donate)
      MagicalFooter.tsx        Animated footer (moon icon, app name, star)
      EnhancedCircularProgress.tsx  Circular countdown with SVG gradient & prayer info
      RegionPicker.tsx         Modal for selecting prayer time region
    quran/             Quran screen extracted components
      quranStyles.ts           Static StyleSheet (165 lines, theme colors applied inline)
      SurahListItem.tsx        React.memo surah list row (9 props)
      FloatingAudioPlayer.tsx  Audio control overlay (18 props)
      QuranSearchResults.tsx   Search result cards (8 props)
    settings/          Settings section components & modals
      settingsStyles.ts         Style factory: createSettingsStyles(colors, isDark)
      MagicalButton.tsx         Reusable animated theme-aware button
      AppearanceSection.tsx     Dark mode toggle
      LanguageSection.tsx       Language selection
      NotificationSection.tsx   Notification toggles, per-prayer, sound, test
      LocationSection.tsx       Cascading Country → State → City pickers
      QuranSettingsSection.tsx  Edition pref, font, auto-scroll, picker buttons
      AboutSection.tsx          Version, about text, donation, subscription
      TranslationPickerModal.tsx  Bottom-sheet translation selection with search
      ReciterPickerModal.tsx      Bottom-sheet reciter selection
      index.ts                  Barrel export of all settings components
  config/              Static config (prayer time regions, etc.)
  contexts/            React contexts (Theme, Language, RevenueCat)

components/            Root-level shared components
  WelcomeSlides.tsx    Phase 1 onboarding: 3 swipeable welcome pages (Welcome, Features, Setup)
  OnboardingTooltips.tsx Phase 2 onboarding: sequential tooltip overlay cards per tab
  SplashScreen.tsx     App splash screen
  ParticleBackground.tsx Background particle effect

contexts/
  OnboardingContext.tsx  Onboarding state management (AsyncStorage-persisted welcome + per-tab tooltip flags)
  ThemeContext.js       Theme provider (dark/sepia)
  LanguageContext.js    i18n provider (en/ar)

hooks/
  home/
    useHomeRegion.ts            Self-contained region state (130 lines)
    useHomeNotifications.ts     Notification lifecycle: init, polling, scheduling (308 lines)
    useHomePrayerData.ts        Prayer data engine: CSV fetch, countdown, day nav (709 lines)
    useHomeAnimations.ts        11 Animated.Values + time-based gradient (85 lines)
  quran/
    quranTypes.ts               Shared TypeScript interfaces (QuranFontSizes, AyahRefMatch, return types)
    useQuranData.ts             Surah list/loading/search/prefs/bookmarks/fonts/theme/refs (339 lines)
    useQuranAudio.ts            Audio playback, download, preload, auto-scroll (420 lines)
  settings/
    useSettingsQuranPrefs.ts     Quran edition/font/scroll/translation/reciter state
    useSettingsLocation.ts       Region cascading pickers + notification cancel on change
    useSettingsDonation.ts       RevenueCat paywall + fallback URL (shared with Home)
    useSettingsNotifications.ts  ⚠️ Dual-library (Notifee + expo-notifications) state & handlers

__tests__/
  hooks/
    home/
      useHomeRegion.test.ts             8 tests
      useHomeAnimations.test.ts         5 tests
      useHomeNotifications.test.ts      10 tests
      useHomePrayerData.test.ts         19 tests
    quran/
      useQuranData.test.ts              20 tests
      useQuranAudio.test.ts             16 tests
    settings/
      useSettingsDonation.test.ts       4 tests
      useSettingsLocation.test.ts       9 tests
      useSettingsNotifications.test.ts  8 tests
      useSettingsQuranPrefs.test.ts     12 tests

lib/
  quranApi.ts          REST client for alquran.cloud/api
  qibla-compass/       Qibla compass logic

utils/
  quranStorage.ts      Quran offline download & cache management
  quranHelpers.ts      Pure helpers: stripBismillah(), formatSize(), bismillah constants
  iqamaConfig.ts       Iqama offset configuration (per-prayer offsets, getIqamaTime, hasIqama)
  notifeePrayerService.js   Notification scheduling via Notifee
  prayerNotificationScheduler.ts  High-level notification orchestration (prayer + iqama scheduling)
  backgroundTask.js    Expo background fetch registration
  localPrayerData.js   Bundled prayer time dataset
  audioHelper.js       Sound playback helpers
  ...

translations/
  en.js                English strings
  ar.js                Arabic strings
  index.js             Language registry & lookup

constants/
  duas.ts              Dua/azkar data
  sepiaColors.ts       Theme colour palette
  surahAliases.ts      Surah name alias map (134 entries) + ViewMode type

widgets/
  widgetTaskHandler.ts Android widget architecture documentation

utils/
  widgetDataBridge.ts  Cross-platform widget data sync bridge
```

## Widget Architecture

Home screen widgets display the next prayer time, countdown, and circular progress on both Android and iOS.

### Data Flow

```
App startup / prayer time change / city change
  → useHomePrayerData hook computes city-tuned 24h & 12h times
  → widgetDataBridge.ts pushes JSON payload to native shared storage:
      Android: SharedPreferences ("PrayerWidgetData")
      iOS:     App Group UserDefaults ("group.com.aadilnoufal.prayertimes")
  → Native widgets read from shared storage on periodic refresh

Theme change (via ThemeContext.js)
  → updateWidgetTheme() pushes themeMode to native storage
  → Widgets re-render with matching dark/sepia palette
```

### Android Widgets (Kotlin)

| File                      | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `WidgetDataModule.kt`     | React Native ↔ SharedPreferences bridge      |
| `WidgetDataPackage.kt`    | ReactPackage registration                    |
| `PrayerTimeRepository.kt` | Read SharedPrefs (primary) or CSV (fallback) |
| `WidgetThemeHelper.kt`    | Centralized dark/sepia colour resolution     |
| `PrayerWidget.kt`         | 2×2 circular widget with progress ring       |
| `PrayerWidget4x2.kt`      | 4×2 list widget showing all 6 prayer times   |

Two widget sizes:

- **2×2** – Circular progress ring with next prayer countdown
- **4×2** – Six prayer columns with highlighted next prayer

AlarmManager triggers 60-second refreshes. Widgets support dark and sepia themes.

### iOS Widgets (SwiftUI / WidgetKit)

| File                            | Purpose                                   |
| ------------------------------- | ----------------------------------------- |
| `PrayerTimesWidgetBundle.swift` | @main WidgetBundle entry point            |
| `WidgetDataProvider.swift`      | Reads JSON from App Group UserDefaults    |
| `WidgetTheme.swift`             | Dark/sepia SwiftUI colour definitions     |
| `PrayerTimesWidgets.swift`      | Timeline providers (30-min refresh cycle) |
| `PrayerTimesWidgetViews.swift`  | SwiftUI views for small & medium sizes    |
| `WidgetDataModuleIOS.swift/m`   | React Native native module (ObjC bridge)  |

The iOS extension is injected via an Expo config plugin (`plugins/withWidgetExtension.js`) that:

- Adds the WidgetKit extension target to the Xcode project
- Configures App Group entitlements
- Copies Swift source files and links required frameworks

## Data Flow – Quran Feature

```
User opens Quran tab
  → quran.tsx loads surah list via quranStorage.getSurahListCached()
    → returns instantly from BUNDLED_SURAH_LIST (no network, no file I/O)

User taps a surah
  → quran.tsx calls readOfflineSurah(n, 'ar')
    → always returns bundled Arabic data (BUNDLED_QURAN_AR) — works fully offline
  → for translation:
    → if user's edition is 'en.sahih' → returns bundled English (BUNDLED_QURAN_EN)
    → else → fetches chosen translation from API, falls back to bundled English on failure
  → fetches Arabic bismillah from bundled data (getBismillahText) for stripping
  → checks if surah audio is downloaded for current reciter (isSurahAudioDownloaded)
  → saves last-read position (setLastRead) for "Continue Reading" card

User taps an ayah or the play button
  → quran.tsx playAyah(index)
    → tries local audio file first (getLocalAudioUri)
    → if not local → fetches audio data from API (fetchSurahAudio) → streams remote URL
    → plays via expo-av Audio.Sound
    → auto-advances to next ayah on finish
    → rolling preload: preloads next ayah's audio in background (preloadNextAyah)
    → on didJustFinish: uses preloaded sound if available, otherwise creates fresh

User taps download audio button
  → quranStorage.downloadSurahAudio(surahNumber, reciterEdition, onProgress)
    → fetches audio edition from API if needed
    → downloads individual MP3 files to quran/audio/{reciter}/{ayahNum}.mp3
    → marks in audio download index

User changes font size / translation edition / reciter in Settings
  → quranStorage.setQuranFontScale / setTranslationEdition / setReciterPref
    → persists to AsyncStorage
    → quran.tsx reads on next focus
    → if reciter changed: cached audioSurahData invalidated, audioDownloaded re-checked,
      preloaded nextSoundRef discarded

User changes "Auto-scroll with audio" in Settings
  → quranStorage.setQuranAutoScrollWithAudio(enabled)
    → persists to AsyncStorage
    → quran.tsx follows/pauses synced ayah scrolling during playback

User triggers "Download All Audio" from Settings
  → quranStorage.downloadAllAudio(reciterEdition, onProgress)
    → iterates surahs 1-114, skips already downloaded
    → downloads all ayah MP3s per surah via downloadSurahAudio()
    → progress callback updates UI

User clears cached data from Settings
  → quranStorage.deleteAllQuranData()
    → deletes quran/ directory (cached audio, extra translations) + removes AsyncStorage index
    → bundled Arabic + English data remain available (part of app binary)
```

## Key Design Decisions

1. **Bundled offline Quran text** – Full Arabic (Uthmani) + English (Sahih International) text is bundled in `assets/quran/` (~3.5 MB). No network needed for reading; works fully offline from first launch.
2. **On-demand translations** – Non-English translations are fetched from the API when selected; fall back to bundled English on failure.
3. **Audio streaming + rolling preload** – Audio streams by default; next ayah is preloaded in background while current plays, reducing inter-ayah gaps. User can also download per-surah per-reciter.
4. **expo-file-system for content** – AsyncStorage has size limits; file system handles multi-MB JSON/MP3 without issue.
5. **Edition preference in Settings** – Persisted via AsyncStorage; Quran tab reads it on mount.
6. **Bismillah stripping** – API includes Bismillah in ayah 1 text; `stripBismillah()` fetches the exact bismillah from the API's own surah 1 ayah 1 for reliable comparison, with tatweel-normalized constant fallbacks.
7. **Cached edition lists** – Translation and audio edition lists cached with 7-day TTL to avoid repeated API calls.
8. **Local surah search** – Real-time as-you-type filtering with 200+ aliases for common misspellings, replacing the unreliable remote API search.
9. **Continue from last read** – Saves surah number + name + ayah index to AsyncStorage on open; displayed as a card atop the surah list. Bookmark card takes priority when set.
10. **Reciter invalidation** – When reciter preference changes, cached audio URLs and download status are re-evaluated to avoid playing stale audio.
11. **Ayah reference search** – Regex-based detection of `N:N` patterns in search input, validated against surah list metadata, shown as a quick-jump card.
12. **Custom Quran fonts** – Amiri and Scheherazade New (OFL-licensed) bundled in `assets/fonts/`, loaded at runtime via `expo-font`. Preference persisted via AsyncStorage.
13. **Single bookmark** – One bookmark stored in AsyncStorage; replaces Continue Reading card when set. Bookmark icon shown per ayah in reading view.
14. **Consolidated notification prompts** – All Android permission prompts (notification, exact-alarm, battery) go through a single ordered flow in `requestEssentialPermissions()`. Session-scoped "Ask Me Later" flags reset on every fresh app launch. Power-manager/auto-start prompt removed.
15. **Iqama offsets** – Hardcoded offsets (Fajr 25, Dhuhr 20, Asr 20, Maghrib 10, Isha 20 min after adhan). Displayed as small text below prayer name; footer explains the convention. Sunrise excluded.
16. **Home lifecycle isolation** – Foreground-resume date synchronization for Home is isolated in `useHomeAppStateSync` to avoid stale AppState/date closures and reduce crash risk during resume.
17. **Settings modular architecture** – Settings screen (originally 2538 lines) split into 4 domain hooks + 10 section/modal components + 1 thin orchestrator (277 lines). Each hook owns its own state & persistence; components are pure presentational. The notification hook preserves the dual-library (Notifee + expo-notifications) architecture exactly — do NOT refactor the two-library pattern.
18. **Home screen modular architecture** – Home/Prayer Times screen (originally 2696 lines) split into 4 domain hooks + 5 extracted sub-components + type/style files. `index.tsx` (508 lines) orchestrates hooks and renders extracted components. Sub-components receive props via explicit prop drilling; `mbShared` bundles common MagicalButton styling (borderColor, shimmerStyle, shimmerAnimation) to reduce repetition. Hook dependency direction: `useHomeRegion` → independent; `useHomeNotifications` → uses refs for cross-domain data; `useHomePrayerData` → receives region params + scheduling callback via props. `useSettingsDonation` is shared between Settings and Home.
19. **Quran modular architecture** – Quran screen (originally 1811 lines) split into 2 domain hooks + 3 extracted sub-components + shared types + static styles. `quran.tsx` (652 lines) remains the orchestrator with coordinator functions (`handleReadingScroll`, `openSurah`, `goBack`) that bridge both hooks, plus inline render helpers for views that depend on too many local variables to extract cleanly. `useQuranData` owns all non-audio state; `useQuranAudio` owns playback, downloads, and preloading. `handleReadingScroll` must live in the component because it reads `ayahLayoutsRef` from audio and writes `topVisibleAyahRef` from data.
20. **Two-phase onboarding** – Phase 1: `WelcomeSlides` (3 swipeable pages — Welcome, Features, Quick Setup with notification toggle) shown as a gate in `_layout.tsx` before the main Stack renders. Phase 2: `OnboardingTooltips` are per-tab sequential tooltip overlays (Modal + semi-transparent backdrop) triggered 600ms after first visit to each tab. `OnboardingContext` manages state with AsyncStorage persistence per tab (`onboarding_tooltip_{home,dua,quran,qibla,settings}`) and welcome completion (`onboarding_welcome_complete`). Tooltips never re-show after dismissal; `resetOnboarding()` available for testing.
21. **Iqama countdown mode** – After a prayer's adhan time passes, `useHomePrayerData` checks if the current time falls between adhan and iqama. If yes, the circular countdown switches to "iqama mode" (amber-themed) showing time remaining to iqama. Once iqama passes, reverts to normal next-prayer countdown. Offsets centralized in `utils/iqamaConfig.ts`. `EnhancedCircularProgress` renders different labels/colors based on `countdownMode` prop.
22. **Iqama notification scheduling** – Iqama alerts are scheduled alongside prayer notifications in `prayerNotificationScheduler.ts`'s `scheduleDay()`. Uses the same 10-day rolling window, AlarmManager exact timing, and Notifee trigger system. IDs prefixed with `iqama-` (e.g., `iqama-fajr-2024-01-15`). Settings stored in AsyncStorage: `iqama_notifications_enabled` (master toggle), `iqama_notification_settings` (per-prayer JSON), `iqama_notification_minutes` (0-5 min before iqama). `cancelAll()` now cancels both `prayer-` and `iqama-` prefixed notifications.
23. **Purchase thank-you screen** – Successful purchases set `purchaseSucceeded` flag in `RevenueCatContext` (replaces previous `Alert.alert`). `RevenueCatPaywall` detects this and renders a full thank-you card with close button that calls `resetPurchaseSuccess()` + `onClose()`. This ensures the paywall dismisses and the user sees a heartfelt message.
