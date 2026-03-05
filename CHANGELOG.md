# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-02-27

### Added

- **Settings-based country detection for push topics** – Country topic (`country-{XX}`) is now derived from the user's selected region in settings via `getCountryIsoCode()` instead of GPS reverse-geocoding. No `expo-location` dependency needed for push notifications. Added `isoCode` field to `Country` interface in `prayerTimeConfig.ts` (e.g. Qatar → `"QA"`). New `getCountryIsoCode(regionId)` helper parses the region ID and returns the ISO 3166-1 alpha-2 code. Tests updated: removed expo-location mocks, added prayerTimeConfig mock.
- **Push notification topics documentation** – New `docs/PUSH_NOTIFICATION_TOPICS.md` with comprehensive reference for all FCM topics (`all-users`, `country-{ISO}`, `version-{X.Y.Z}`), condition syntax, sending examples, and architecture diagram. Public-safe (no credentials or personal info).
- **Dynamic version in settings** – App version in the About section is now dynamically read from `expo-application` (`nativeApplicationVersion`) instead of being hardcoded in translation files. Displays the actual installed version (e.g. `Prayer Times v4.0.1`).
- **iOS widget settings redesign** – Replaced useless iOS widget buttons (that showed alerts with missing translation keys) with inline visual guidance: widget preview cards for both sizes + numbered step-by-step instructions with icons. Added all missing English widget translation keys (`widgetSectionTitle`, `widgetSmallTitle`, etc.) and new iOS-specific step keys (`widgetIOSStep1`–`widgetIOSStep4`, `widgetIOSHowToAdd`). Android widget section unchanged.
- **Android widget preview in picker** – Added `android:previewLayout` to both widget provider XMLs (`prayer_widget_info.xml`, `prayer_widget_4x2_info.xml`) so the Android widget picker shows a realistic live preview of each widget instead of a generic icon (requires Android 12+ / API 31). Added proper `android:description` strings for both widgets (`widget_description_compact`, `widget_description_full`) to display meaningful descriptions in the picker. Also fixed missing `android:description` on the 4×2 widget.
- **Version-based push notification targeting** – Devices now subscribe to `version-{X.Y.Z}` FCM topic (auto-detected via `expo-application`). On app update, unsubscribes from old version topic before subscribing to new. Python sender script (`scripts/send-push.py`) extended with `send_to_condition()` (arbitrary FCM condition expressions), `send_update_reminder(latest_version)` (targets all users EXCEPT those on the specified version), and `send_to_versions(versions)` (targets specific version list). Works on both Android and iOS. 3 new tests (197 total).
- **Firebase Cloud Messaging (Push Notifications)** – Integrated `@react-native-firebase/app` v23.8.6 + `@react-native-firebase/messaging` v23.8.6 for remote push notifications. Sends from Firebase Console (Eid greetings, app updates, corrections). Auto-subscribes to `all-users` topic (broadcast) and `country-{XX}` topic (country-specific via stored region settings). Foreground pushes displayed via Notifee. Background handler in `index.ts`. New `utils/pushNotifications.ts` module with `initializePushNotifications()`, `setupForegroundHandler()`, `setupTokenRefreshListener()`, `updateCountryTopic()`. Added `expo-build-properties` v0.14.8 (`useFrameworks: static` for iOS). Created `firebase.json` config. Added `google-services.json` (Android) and `GoogleService-Info.plist` (iOS). 20 unit tests.

### Fixed

- **Dec 31 bogus prayer time data** – The CSV data for December 31 contained obvious placeholder values (`05:00,06:30,12:00,03:30,06:00,07:30`) that deviated by up to 64 minutes from neighboring days (e.g. Maghrib 18:00 vs correct ~16:57). Replaced with properly interpolated values from Dec 30 and Jan 1 data. Users would have received prayer notifications at significantly wrong times on New Year's Eve.
- **Feb 29 (leap year) missing data** – The year-agnostic CSV had 365 rows with no entry for February 29. On leap years (2028, 2032, etc.), `getPrayerTimesFromLocalData` would return `null` and the UI would show "Data Not Available" with no notifications for the entire day. Added interpolated Feb 29 row between Feb 28 and Mar 1 data (366 rows total). Non-leap years correctly ignore the extra row.
- **Notification cleanup filter never matched** – The rolling window scheduler used `id.split('-').length === 3` to filter prayer notification IDs, but actual IDs are `prayer-fajr-2026-03-05` (5 parts). Filter always returned empty → past notifications never cleaned up, covered dates never tracked, every foreground return re-scheduled all 54 notifications. Fixed filter to match both `prayer-*` and `iqama-*` IDs (length 5), fixed date extraction (`parts.slice(2).join('-')`), fixed prayer name capitalization for today's time check.
- **updateCountryTopic() not called on region change** – Settings hook (`useSettingsLocation.ts`) saved new region and cancelled notifications but never called `updateCountryTopic()` to update FCM country-topic subscription. Added the call with proper error handling.
- **Sound preference null triggers false reschedule** – On first install, `use_azan_sound` is null but stored pref might exist, causing `storedSoundPref !== null` comparison to always detect a "change" and trigger unnecessary full cancel + reschedule on every foreground return. Now requires both values to be non-null before comparing.
- **Stale closure disabled notification health-check** – The `useHomeNotifications` effect ran once with `[]` deps, capturing `notificationsEnabled = false` forever. The 60-second health check and background force-reschedule both gated on this value, making them permanently dead code. Added `notificationsEnabledRef` that syncs with state, and all long-lived interval callbacks now read from the ref.
- **Region change with future day offset** – `changeRegion` in home screen didn't reset `currentDay` to 0, so if the user was viewing day+3, the fresh fetch for the new region would use the stale day offset, showing wrong prayer times. Now calls `goToToday()` before fetching.
- **resetNotifications left iqama notifications orphaned** – `cancelAllNotifeePrayerNotifications()` only cancelled `prayer-*` trigger IDs. Iqama notifications (`iqama-*`) remained scheduled and would fire as phantom notifications after reset. Updated filter to include both prefixes, and also cancels displayed `iqama-reminder` type notifications.
- **Hijri date NaN on Hermes engine** – `new Date('622-07-16')` produces `Invalid Date` on Hermes (3-digit year not valid ISO 8601), causing all Hijri calculations to return `"NaN Unknown NaN"`. Replaced with a pre-computed epoch timestamp constant.
- **iOS notification limit overshoot** – With iqama enabled, each day schedules up to 11 notifications (6 prayers + 5 iqama). The cap check (`scheduledCount < 54`) allowed one final loop iteration to push count to 65, exceeding iOS's 64-notification hard limit. Reduced safe max to `54 - 11 = 43` to guarantee headroom.
- **minutesToTime negative input** – `Math.floor(-30 / 60)` produces `-1` and `Math.floor(-30 % 60)` produces `-30`, yielding `"-01:-30"`. While current data doesn't trigger this, added modular arithmetic wrap-around to guard against future city adjustment edge cases.
- **Dead code in findNextPrayer** – Removed unreachable `Fajr && currentHour >= 18` branch. When `dayOffset === 0`, Fajr today has always passed by 6PM, so it can't be the "next" prayer found by `find()`. The correct "all prayers passed → Fajr Tomorrow" path is handled by the existing fallback below.
- **getScheduledNotifeePrayerNotifications excluded iqama** – Status function only reported `prayer-*` IDs. Updated to include `iqama-*` IDs so health checks and debug logs show the true notification count.
- **Dec 31 / Feb 29 prayer times updated** – Changed from interpolated values to exact copies: Dec 31 = Dec 30, Feb 29 = Feb 28. Ensures consistent prayer times on boundary dates.
- **Snooze notification silently dropped (Android)** – `scheduleSnoozeNotification()` used a non-existent channel ID (`prayer-reminders`). Android silently drops notifications on missing channels. Fixed to dynamically select the correct channel based on user's sound preference and prayer name.
- **"Fix Azan Sound" feature non-functional** – `forceRecreateNotificationChannels()` deleted 3 wrong/legacy channel IDs instead of the 5 actual channels. On Android, `createChannel` with an existing ID doesn't update sound settings — only delete+recreate works. Fixed to delete all 5 real channel IDs.
- **Test notifications used wrong channels** – `testFajrNotification`, `testImmediateNotification`, and the trigger test in `testNotifeeFeatures` all referenced non-existent channel IDs (`fajr_prayer_channel`, `prayer-reminders`). Notifications were silently dropped on Android. Fixed all to use dynamic channel selection via `getSoundPreference()`.
- **Stale notificationSettings in health-check loop** – The 60-second health check captured `notificationSettings` state at mount time. If user toggled individual prayers off, the stale setting would keep triggering unnecessary reschedule attempts every 60 seconds. Added `notificationSettingsRef` synced via `useEffect`.
- **WelcomeSlides double-delayed animations** – Features and "What's New" item animations had both `delay: i * N` in the `Animated.timing` config AND `Animated.stagger(N, ...)` wrapping them, causing 2× slower animation than intended. Removed the redundant per-item delay.
- **Fallback channels had wrong IDs** – `createFallbackChannels()` created channels with legacy IDs (`prayer-reminders`, `fajr_prayer_channel`) that don't match what the scheduler uses. All prayer notifications would silently fail after a fallback. Fixed to use real channel IDs with default sound.
- **Notification scheduler ignored city adjustments** – `buildPrayerTimesForDate()` used raw CSV times without applying `applyLocalDataCityAdjustments()`. Users in Abu Samra, Dukhan, Al Shamal received notifications at wrong times (off by the full city offset). Now reads `selected_region` from AsyncStorage and applies city adjustments.
- **Compass 360° wrap-around spin** – When the user crossed north (360°→0°), the Animated.spring interpolated 340° the wrong way instead of 20° the short way. Added accumulated rotation tracking with shortest-path angular delta computation.
- **Quran API calls had no timeout** – All `fetch()` calls in `quranApi.ts` had no `AbortController` timeout. If the API was unreachable, the UI showed an infinite spinner with no way to cancel. Added 20-second timeout via `AbortController`.
- **Redundant AsyncStorage reads in scheduling loop** – `scheduleDay()` read 4 AsyncStorage keys per call, and was called up to 10× in the window-fill loop (40 bridge calls). Hoisted reads to `ensurePrayerNotificationWindow()` and passed as parameter.
- **Removed legacy `channelId` variable** – Dead `let channelId = 'prayer-reminders'` module-level variable that was the root cause of 5 channel mismatch bugs.
- **Removed empty ParticleBackground.tsx** – Empty file with no code, not imported anywhere. Moved to trash.

- **FCM iOS image URL path** – Fixed foreground handler using non-existent `remoteMessage.notification.apple.imageUrl` (no `apple` property exists on `Notification` type). Now uses `remoteMessage.notification.image` (base `Notification` property). Android path `notification.android.imageUrl` confirmed correct via TypeScript types.
- **FCM AuthorizationStatus magic numbers** – Replaced `=== 1` / `=== 2` with `messaging.AuthorizationStatus.AUTHORIZED` / `messaging.AuthorizationStatus.PROVISIONAL` as recommended by official docs.
- **app.json build comment** – Fixed incorrect `extra.comment` that said "Android folder removed - EAS Build handles Android project generation". Corrected to: Android uses local Gradle build (`android/` folder exists), iOS uses EAS Build.
- **PUSH_NOTIFICATIONS.md build process** – Updated all references from generic "EAS build for both platforms" to correctly distinguish Android (local Gradle) vs iOS (EAS Build).

- **Widget Settings Section** – New "Widgets" section in Settings (between Quran and About) with shortcuts to add 2×2 and 4×2 widgets to the home screen. On Android, uses native `AppWidgetManager.requestPinAppWidget()` (API 26+) via a new `WidgetPinModule.kt` native module. On iOS, shows step-by-step instructions since WidgetKit doesn't support programmatic pinning. Fully translated in EN and AR.
- **Push Notification Research Doc** – Comprehensive analysis at `docs/PUSH_NOTIFICATIONS.md` covering provider comparison (FCM, Expo Push, OneSignal), security considerations, implementation steps, and timeline estimates. Fully verified against official Firebase docs, React Native Firebase docs, and Expo docs with source citations. Includes FCM message types (notification vs data-only vs combined), Firebase Console capabilities and limitations, Expo SDK 51+ `aps-environment` entitlement requirement, `firebase.json` configuration, Notifee v7+ interaction notes, and iOS background limitations.
- **Onboarding: Widgets & Iqama Slide** – Added a dedicated 4th onboarding slide (\"What's New\") between Features and Quick Setup, showcasing Home Screen Widgets and Iqama Reminders with animated card entries. Onboarding now has 4 pages: Welcome → Features → What's New → Quick Setup. New translation keys for both EN and AR.
- **Android Widget Click-to-Open** – Both 2×2 (circular) and 4×2 (list) Android widgets now launch the app when tapped. Uses `PendingIntent.getActivity()` targeting `MainActivity` with `FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP`. Request codes 100 (2×2) and 101 (4×2) to avoid PendingIntent collisions.

### Fixed

- **Android Notification Icon (Pixel)** – Replaced `smallIcon: 'ic_launcher_foreground'` (full-color adaptive icon foreground) with a dedicated monochrome `ic_notification` vector drawable (mirrored crescent moon silhouette). Android requires notification small icons to be single-color + alpha only — the full-color icon was rendering as a filled white shape on Pixel and stock Android devices. Added `<meta-data>` fallback in AndroidManifest.xml. Crescent icon is horizontally mirrored to match the app logo orientation.
- **Asr Iqama Offset** – Corrected Asr iqama offset from +20 to +25 minutes. Updated `iqamaConfig.ts`, both translation files (`en.js`, `ar.js`), `ARCHITECTURE.md`, and this changelog.

### Changed

- **Onboarding Flow** – Onboarding expanded from 3 slides to 4 slides. Quick Setup moved from slide 3 to slide 4 to make room for the new \"What's New\" slide.

### Added

- **Widget Data Sync Architecture** – New cross-platform bridge (`utils/widgetDataBridge.ts`) pushes city-tuned prayer times from the app to native widgets via SharedPreferences (Android) and App Group UserDefaults (iOS). Data is debounced (500ms) for regular updates and immediate for initial app load.
- **Android Widget Theme Support** – Both widget sizes (2×2 circular, 4×2 list) now follow the app's theme (dark/sepia). New `WidgetThemeHelper.kt` provides centralized colour resolution, with sepia-specific drawables for backgrounds and progress rings.
- **Android Widget Data Module** – Native module (`WidgetDataModule.kt`) bridges React Native to SharedPreferences, broadcasting widget refresh intents after each write.
- **Android PrayerTimeRepository Rewrite** – Reads from SharedPreferences (primary, with 48h staleness check) before falling back to bundled CSV. Supports city-tuned prayer times and theme mode.
- **iOS WidgetKit Extension** – New Swift-based widget extension with two sizes (small circular, medium list). Reads prayer data from App Group UserDefaults with 30-minute timeline refresh. Supports dark and sepia themes via SwiftUI.
- **iOS Expo Config Plugin** – `plugins/withWidgetExtension.js` injects the WidgetKit extension target, App Group entitlements, Swift source files, frameworks, and native module registration during `expo prebuild`. Properly embeds the `.appex` in the final app bundle.
- **iOS Native Module** – `WidgetDataModuleIOS.swift` writes widget data to App Group UserDefaults and triggers WidgetKit timeline reloads.
- **Tomorrow's Fajr Data** – Widget payload now includes `tomorrowFajrMinutes` for accurate post-Isha countdown on both platforms, matching the Android CSV-based approach.
- **Widget Integration Tests** – 10 unit tests for `widgetDataBridge` (debouncing, immediate writes, platform branching, theme sync) and 4 integration tests in `useHomePrayerData` (widget payload content, theme reading, 12h format).
- **Iqama Countdown Setting** – The iqama countdown on the home screen is now optional. A new "Iqama Countdown" toggle in Settings > Notifications controls visibility. Off by default; persisted via AsyncStorage (`iqama_countdown_enabled`).
- **Iqama Countdown** – After a prayer's adhan time, the home screen countdown now shows time remaining to iqama before switching to the next prayer countdown.
  - Hardcoded offsets: Fajr +25, Dhuhr +20, Asr +25, Maghrib +10, Isha +20 minutes
  - Amber-themed circular progress in iqama mode with distinct label
  - New utility `utils/iqamaConfig.ts` for centralized iqama offset configuration
- **Iqama Notification Alerts** – Optional notifications before iqama time.
  - Off by default; per-prayer toggles with compact pill UI in settings
  - Adjustable 0–5 minutes before iqama (default: 3 min)
  - Scheduled via Notifee with AlarmManager exact timing (same reliability as prayer notifications)
  - Settings persisted in AsyncStorage (`iqama_notifications_enabled`, `iqama_notification_settings`, `iqama_notification_minutes`)
- **Thank You Screen** – After a successful in-app purchase, the paywall closes and a heartfelt thank-you screen appears with "JazakAllahu Khairan" message and "Ameen" close button. Replaces the previous plain Alert dialog.

### Fixed (Phase 8 — Deep Audit)

- **Config Plugin: Missing build phases** – `addTarget('app_extension')` creates the widget target with an empty `buildPhases` array. Without explicit `PBXSourcesBuildPhase`, `PBXFrameworksBuildPhase`, and `PBXResourcesBuildPhase` phases, `addSourceFile()` and `addFramework()` silently fell back to the main app target's phases — meaning widget Swift files were compiled into the wrong target. Now creates all three phases explicitly before adding sources.
- **Config Plugin: Missing target dependency** – `addTarget('app_extension')` does not create a `PBXTargetDependency` between the main app and the widget extension (only does so for watch targets). Added explicit `addTargetDependency()` call with section initialization guard, ensuring the widget extension builds before the main app embeds it.
- **Config Plugin: EAS Build signing for widget extension** – EAS Build sets up credentials BEFORE `expo prebuild`, so it didn't know about the widget extension target added by the config plugin. Added `extra.eas.build.experimental.ios.appExtensions` to `app.json` so EAS registers the widget bundle ID (`com.aadilnoufal.prayertimes.PrayerTimesWidget`) and creates a provisioning profile. Also added `DEVELOPMENT_TEAM` to widget build settings via `appleTeamId` plugin option.
- **parseRegionId multi-word city bug** – `parseRegionId()` used `parts[2]` which returned `"abu"` for `"qatar-qatar-abu-samra"`. Now uses `parts.slice(2).join('-')` to correctly reconstruct multi-word city IDs. Affected Abu Samra users' settings screen.
- **Android post-Isha countdown wrong for non-Doha** – `PrayerTimeRepository.kt` always fell back to raw Doha CSV for tomorrow's Fajr, ignoring city-tuned `tomorrowFajrMinutes` from SharedPreferences. Added `getTomorrowFajr()` wrapper that checks SharedPrefs first, falling back to CSV only when unavailable. Fixes up to 4-minute countdown error for non-Doha cities.
- **iOS widget countdown seconds precision** – iOS `nextPrayer(at:)` used pure minute math, while Android accounted for partial minutes elapsed. Added `currentSecond > 0 → diff -= 1` logic to match Android's precision. Prevents iOS showing 1 minute more than Android.
- **Production console.log spam** – `prayerTimeTuner.js` had 12 `console.log` calls firing on every prayer calculation. Replaced with `debugLog()` gated by `DEBUG_TUNER = false`.
- **IIFE render side-effect in \_layout.tsx** – `shouldPromptSupport` triggered `__openSupportPaywall()` via an IIFE in JSX, causing a state update during render. Moved to a proper `useEffect`.
- **Notification listener subscription churn** – `lastReceivedAt` state used as effect dependency caused Notifee foreground listener to unsubscribe/resubscribe on every notification. Changed to `useRef` — listener now subscribes once.
- **Countdown timer churn** – `updateCountdown` callback had `countdown` in its deps → recreated every second → `setInterval` torn down/rebuilt 86,400×/day. Introduced `updateCountdownRef` pattern — interval calls `updateCountdownRef.current()` with stable deps `[nextPrayer, appState]`. Timer now only recreates ~6×/day.
- **Tooltip rapid-tap race condition** – Multiple taps during 200ms fade animation could advance tooltips twice or call `onComplete()` twice. Added `isAnimatingRef` guard.
- **New test suites** – Added `parseRegionId.test.ts` (11 tests) and `prayerTimeTuner.test.ts` (14 tests). Fixed `useSettingsLocation.test.ts` mock to use `parts.slice(2).join('-')`. Total tests: 126 → 152.

### Changed

- **iOS Widget Timeline Fix** – `nextPrayer` computed property now accepts a `referenceDate` parameter instead of using `Date()`. Each pre-rendered timeline entry correctly computes its own countdown, fixing stale data in WidgetKit's cached snapshots.
- **iOS 17+ Widget Background** – Added `widgetBackground()` View extension that uses `.containerBackground(for: .widget)` on iOS 17+ and falls back to `ContainerRelativeShape` on iOS 16. Widgets now render custom gradient backgrounds on all supported versions.
- **Config Plugin: Native Module Registration** – Native module files (`.swift`/`.m`) are now added to Xcode's compile sources via `addSourceFile()`, not just copied to disk. Without this, the `WidgetDataModuleIOS` bridge wouldn't compile.
- **Config Plugin: Embed App Extension** – `addTarget('app_extension')` already creates a "Copy Files" `PBXCopyFilesBuildPhase` on the main target and embeds the `.appex`. Previous manual embed phase was removed to avoid "Multiple commands produce" errors in Xcode 14+.
- **Circular Widget Tomorrow Indicator** – Small widget now shows "TOMORROW" label when displaying next-day Fajr countdown, matching the list widget's "(tmrw)" indicator.
- **Sepia Progress Ring Contrast** – Darkened the sepia theme's progress ring background from `#EAE7DF` to `#DAD6CF` (~13% contrast improvement) for better visibility against the `#FCFBF9` widget background.
- **Onboarding first page title** – Changed to full "بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ" using standard Arabic characters (no Alef Wasla) for reliable Android rendering.
- **Quran translation auto-reload** – Changing the translation language in settings now automatically reloads the translation for any currently open surah, without needing to close and reopen it.
- **Revenue Cat purchase flow** – Successful purchases no longer show an Alert; instead, a `purchaseSucceeded` state flag triggers the dedicated thank-you screen in the paywall component.

### Added (previous)

- **Onboarding flow (Phase 1: Welcome Slides)** – 3 swipeable welcome pages shown on first launch:
  - Welcome page: Mosque icon, bismillah, app name, description
  - Features page: 5 animated feature rows (Prayer Times, Dua, Quran, Qibla, Settings)
  - Quick Setup page: Notification enable toggle with explanation
  - Animated entrance (fade, slide, scale), page indicator dots, Skip/Next/Let's Begin buttons
  - Theme-aware and bilingual (English + Arabic)
- **Onboarding flow (Phase 2: Contextual Tooltips)** – Per-tab sequential tooltip overlays on first visit:
  - Home: 3 tooltips (countdown, day arrows, region selector)
  - Dua: 1 tooltip (category browsing)
  - Quran: 3 tooltips (search, tap ayah, settings)
  - Qibla: 1 tooltip (compass usage)
  - Settings: 3 tooltips (location, notifications, Quran settings)
  - Animated cards with progress dots, auto-dismissed after completion
- **OnboardingContext** – AsyncStorage-persisted state management for welcome completion + per-tab tooltip flags
- **Translation keys** – ~30 new keys in en.js + ar.js for onboarding content

### Changed

- **Quran screen refactored** – `quran.tsx` reduced from 1,811 → 652 lines (64% reduction). Extracted into:
  - 2 domain hooks: `useQuranData` (339 lines) — data/prefs/search/bookmarks/fonts/theme; `useQuranAudio` (420 lines) — audio playback/download/auto-scroll
  - 3 sub-components: `SurahListItem`, `FloatingAudioPlayer`, `QuranSearchResults`
  - Static data: `constants/surahAliases.ts`, `utils/quranHelpers.ts`, `app/components/quran/quranStyles.ts`
- **Home screen further refactored** – `index.tsx` reduced from 910 → 508 lines (44% reduction). Extracted 6 inline sub-components:
  - `MagicalButton` + `MagicalArrowButton` — themed button with shimmer
  - `MagicalHeader` — animated header bar
  - `MagicalFooter` — animated footer with moon/star
  - `EnhancedCircularProgress` — circular countdown with prayer info
  - `RegionPicker` — region selection modal
- **Settings screen refactored** – `settings.tsx` reduced from 2,538 → 277 lines (pure orchestrator). Extracted into:
  - 4 domain hooks: `useSettingsQuranPrefs`, `useSettingsLocation`, `useSettingsDonation`, `useSettingsNotifications`
  - 10 section/modal components in `app/components/settings/`
  - Shared style factory `settingsStyles.ts` (838 lines)
- **Home screen refactored** – `index.tsx` reduced from 2,696 → 910 lines (orchestrator + inline sub-components). Extracted into:
  - 4 domain hooks: `useHomeRegion` (130 lines), `useHomeNotifications` (308 lines), `useHomePrayerData` (709 lines), `useHomeAnimations` (85 lines)
  - 3 component/type files: `homeStyles.ts`, `homeTypes.ts`, `AnimatedPrayerIcon.tsx`
  - `useSettingsDonation` shared between Settings and Home (added `fetchOfferings`)
- **Updated ARCHITECTURE.md** – Added settings module map, home module map, hook/component inventories, and design decisions #17–18

### Added

- **112 hook unit tests** covering all 10 extracted hooks:
  - Quran: Data (20), Audio (16)
  - Settings: Donation (4), Location (9), Notifications (8), QuranPrefs (12)
  - Home: Region (8), Animations (5), Notifications (10), PrayerData (19)
- **`@testing-library/react-native`** as dev dependency for hook testing

## [3.18.0] - 2026-02-26

### Added

- **3 New Luxurious Light Themes** – Choose from 5 total color themes in Settings:
  - **Dark** – Deep backgrounds with muted gold accent, high contrast
  - **Classic Light (Sepia)** – Warm cream tones with champagne gold, cozy feel
  - **Warm & Natural** – Ivory backgrounds with antique gold (#C8A870), earthy warmth
  - **Cool & Modern** – Slate backgrounds with silver-gold (#B8A565), professional look
  - **Neutral & Minimal** – Pure white backgrounds with clean champagne gold aesthetic
- **Theme Selector UI** – New visual theme picker in Settings with color preview swatches for each theme
- **Centralized Color Utilities** – New `utils/colorHelpers.ts` with `goldTint()`, `withAlpha()`, `lighten()`, `darken()` functions for consistent color manipulation

### Changed

- **Theme Architecture Overhaul** – All hardcoded `rgba(218, 165, 32, X)` gold colors replaced with theme-aware `goldTint()` calls across Home, Settings, Quran, Dua, Qibla, and SplashScreen
- **Theme Context Extended** – `ThemeContext.js` now exports `ThemeNames`, `ThemeInfo`, `AllThemes` for theme selection UI
- **Updated ARCHITECTURE.md** – Added comprehensive Color System documentation section

### Fixed

- **Inconsistent Gold Colors** – Previously used `rgba(218,165,32,...)` which didn't match any theme's actual gold accent. All screens now use the theme's configured gold color.
- **Light Mode Contrast Issues** – Cards and containers in all light themes now use warmer `background.secondary`/`background.tertiary` colors instead of pure white (`surface.primary`). Fixes harsh white boxes on cream backgrounds affecting Home (date nav, prayer container), Dua, Qibla, Quran, and Settings pages.

## [3.17.0] - 2026-02-25

### Added

- **Bundled offline Quran text** – Full Arabic (Uthmani) and English (Sahih International) Quran text (~3.5 MB) is now bundled in the app binary under `assets/quran/`. Reading works fully offline from first launch with zero network calls.
- **Rolling audio preload** – While an ayah is playing, the next ayah's audio is preloaded in the background, reducing inter-ayah silence on slow networks.
- **Quran data download script** – Added `scripts/download-quran-bundle.js` to re-fetch bundled JSON files from alquran.cloud API if needed.

### Changed

- **Removed per-surah download UI** – The download/delete icons next to each surah in the Quran list are removed; all text is always available via bundled data.
- **Simplified Settings → Quran section** – Replaced "Download All" button and download stats with a static "bundled offline" info note. "Clear All" now only removes cached audio and extra translations.
- **Sepia / light-mode contrast improvements** – Replaced hardcoded gradient fallback colors (#F5F1E6, #F2EEE1) and semi-transparent white card backgrounds with themed tokens (`colors.background.tertiary`, `colors.surface.secondary`, `colors.surface.primary`) across Home, Dua, Qibla, Quran, and Settings pages. Strengthened subtle border opacity on Dua and Qibla cards.

### Fixed

- **Sepia card readability** – Cards on Dua and Qibla pages no longer wash out against the sepia background in light mode.

## [3.16.1] - 2026-02-24

### Fixed

- **Phantom "hooks" tab crash** – `useHomeAppStateSync` was inside `app/(tabs)/hooks/` which expo-router treated as a navigable route. Moved to `app/(tabs)/_hooks/` (underscore prefix is ignored by expo-router). The old `hooks/` directory was removed.
- **Oversized UI elements on Home screen** – Location bar, date navigation row, prayer card items, and the "Next" indicator badge were taller than intended. Padding values trimmed: location bar `paddingVertical` 14→10, date nav `paddingVertical` 12→8, prayer card `padding` 12→10, `prayerItemHeader marginBottom` 8→4.

## [3.16.0] - 2026-02-23

### Fixed

- **Duplicate battery prompts on first open** – Consolidated notification startup flow so only one battery optimization prompt is shown (previously two were fired: one from the service init and one from the Home screen).
- **Removed intrusive auto-start / power manager prompt** – The “Add to auto-start/whitelist” alert was too aggressive for first-time users and has been removed.
- **Notification prompt now always appears first** – Permission order enforced: Notification → Exact Alarm → Battery Optimization.
- **Removed duplicate permission requests from Settings mount** – Settings no longer re-runs `requestExactAlarmPermission()` separately; all permissions are handled inside `initializeNotifeePrayerNotifications()`.
- **Intermittent resume crash on Home** – Fixed a foreground-resume date sync issue that could recurse and crash when reopening after backgrounding.

### Added

- **“Ask Me Later” on all Android prompts** – Notification, Exact Alarm, and Battery Optimization prompts now include an “Ask Me Later” button that defers the prompt until the next app launch (session-scoped).
- **“Return to Today” button** – When viewing prayer times 2+ days in the future, a golden pill button appears below the date navigator to jump back to the countdown page.
- **Iqama time offsets in prayer list** – Each prayer row now shows approximate iqama offset (e.g. “Iqama +25 min”) in small text below the prayer name. A brief explanation footer is shown beneath the prayer grid.

### Changed

- **“Manage Apple Subscriptions” → “Manage Subscriptions”** – Button label in Settings is now platform-neutral (EN & AR).
- **Home lifecycle synchronization extracted** – AppState/date-resume synchronization moved into `app/(tabs)/hooks/useHomeAppStateSync.ts` to reduce coupling in `app/(tabs)/index.tsx`.
- **Home debug surface reduced** – Removed non-essential long-press notification debug path and verbose DEBUG-only interaction logs from Home.

## [3.15.0] - 2025-07-20

### Added

- **Ayah Reference Search** – Type a reference like `2:14` in the Quran search bar to instantly jump to Surah Al-Baqarah, Ayah 14. Validates surah/ayah ranges and shows a quick-jump card above the surah list.
- **Quran Font Options** – Choose between system default, Amiri, or Scheherazade New fonts for Arabic Quran text. Configurable in Settings → Quran section. Fonts are OFL-licensed and bundled with the app.
- **Ayah Bookmark** – Tap the bookmark icon on any ayah to save a single bookmark. The bookmark card replaces "Continue Reading" at the top of the surah list when set. Tap again to remove the bookmark.

### Changed

- **Default Font Scale 120%** – Quran text default size increased from 115% to 120% for better readability.

## [3.14.0] - 2025-07-19

### Fixed

- **Online Surah Last-Read Position** – Reading position now saves when switching tabs or backgrounding the app, not only when pressing back. Fixes the hit-or-miss tracking for online (non-downloaded) surahs.
- **Download Sync (Settings → Quran)** – Surahs downloaded from Settings now show the tick mark immediately when returning to the Quran page, without needing an app restart.
- **Network Error Recovery** – Added a Retry button on the Quran page's network error screen so users can reload without restarting the app.
- **Loading Text** – Quran loading screen now says "Loading Quran…" instead of "Loading prayer times…".

### Improved

- **Light Mode Polish** – Complete overhaul of the light (sepia) colour palette: richer warm backgrounds with visible depth between card levels, deeper coffee-brown text hierarchy (WCAG AAA contrast), darker gold accents for better visibility, stronger warm borders, and warmer shadows. Replaced hardcoded cold-grey `rgba(0,0,0,…)` backgrounds on the home page with themed surface colours. Fixed an invalid rgba+hex concatenation bug in the next-prayer highlight.

## [3.13.0] - 2025-07-19

### Fixed

- **Settings Font Scale Display** – Settings slider now initialises at 115% (the actual default) instead of 100%, preventing the confusing mismatch on first render before AsyncStorage loads.

### Improved

- **Smart Continue Reading** – Continue reading now tracks the exact ayah the user was viewing (top of screen) when they leave a surah, not just the surah number. Tapping "Continue Reading" scrolls directly to that ayah. The card also displays the ayah number (e.g. "Al-Baqarah · Ayah 45").

### Added

- **Always-Visible Settings Hint** – The Quran list page now shows a permanent subtle hint ("Translation, audio, text size & downloads available in Settings") so users always know about customisation options.

### Verified

- **Bismillah Stripping Safety** – Confirmed that `stripBismillah()` only ever processes the first ayah (idx === 0) of surahs 2–113 (excluding 9). Any bismillah text appearing mid-surah is completely untouched.

## [3.12.0] - 2025-07-19

### Fixed

- **Bismillah Stripping (Arabic)** – Root cause identified: API returns `ٱلرَّحْمَٰنِ` without tatweel (U+0640) but constants had `ٱلرَّحْمَـٰنِ` with tatweel. Rewrote `stripBismillah()` as a unified function that fetches the exact bismillah text from the API (surah 1, ayah 1) for both Arabic and translations, with tatweel-normalized fallbacks.
- **Audio Reciter Switching** – When reciter is changed in settings, cached audio data (URLs for old reciter) is now properly invalidated. New reciter audio is streamed immediately even if old reciter's audio was downloaded.

### Added

- **Local Surah Search** – Replaced remote API search with instant as-you-type local search. Matches against English name, translation name, surah number, and 200+ common misspellings/aliases (e.g. "yaseen", "fatiha", "rehman").
- **Continue From Last Read** – Shows a "Continue Reading" card at the top of the surah list with the last opened surah. Position persisted via AsyncStorage.
- **Download All Audio** – New button in Settings → Quran to download audio for all 114 surahs with the selected reciter. Includes progress indicator.
- **Default Font Size 115%** – Changed Quran text default font scale from 100% to 115% for better readability.

### Changed

- Search bar now filters the surah list in real-time (no submit required).
- `stripBismillah()` signature simplified from `(text, lang, knownBismillah?)` to `(text, knownBismillah?)`.

## [3.11.1] - 2026-02-21

### Fixed

- **Quran Audio Auto-Scroll Jump** – Fixed synced scrolling during ayah playback so it no longer jumps back toward the first ayah and now keeps the active ayah near the top consistently.

### Added

- **Quran Auto-Scroll Toggle** – New Settings → Quran option to enable/disable "Auto-scroll with audio" (highlight + top-follow behavior) with persistent preference.

## [3.11.0] - 2025-07-18

### Fixed

- **Bismillah Duplication** – First ayah of surahs 2-113 (except 9) no longer shows the Bismillah text that was already displayed as a styled banner above the ayahs.
- **Search Broken** – Fixed keyboard auto-closing and results not appearing. Search bar now stays visible in search-results mode, `autoCorrect` and `autoCapitalize` disabled, `keyboardShouldPersistTaps="handled"` added to all lists, mode switch deferred until results arrive.

### Added

- **Audio Playback** – Tap any ayah to play its recitation. Full audio player bar with play/pause, previous/next, auto-advance, and ayah counter. Audio streams from remote or plays from offline files.
- **Audio Download** – Download all audio files for a surah per reciter for offline playback.
- **Reciter Selection** – Choose from 17+ Arabic reciters (default: Mishary Al-Afasy) in Settings → Quran Settings.
- **Translation Edition Picker** – Choose from 80+ translation editions (searchable modal) in Settings → Quran Settings.
- **Font Size Control** – Adjustable Quran font scale (75%–150%) via +/- buttons in Settings → Quran Settings, with live preview.
- **Settings Hint Banner** – Dismissible banner on the Quran list page informing users about Quran settings in the main Settings screen.
- **Scaled Font Sizes** – Arabic text, translations, bismillah, and surah headers all respect the font scale preference.
- **Currently-Playing Highlight** – Active ayah card gets a gold border and tinted background during playback.
- **API Layer Additions** – `fetchSurahWithTranslation()`, `fetchSurahAudio()`, `fetchTranslationEditions()`, `fetchAudioEditions()`, `EditionInfo` type.
- **Storage Layer Additions** – Font scale, translation edition, reciter preferences, cached edition lists (7-day TTL), audio download/check/delete management.
- **Translation Keys** – ~40 new keys in English and Arabic for all new features.

### Changed

- Default Arabic font size bumped from 22 → 24, translation from 14 → 16 (before scaling).
- Reading view ayah cards are now tappable (trigger audio playback).
- `currentSurahEn` renamed to `currentSurahTr` to support non-English translations.

## [3.10.0] - 2026-02-20

### Added

- **Quran Tab** – New tab to browse all 114 surahs, read Arabic text and Sahih International English translation, and search the Quran by keyword via the AlQuran Cloud API.
- **Per-Surah Offline Download** – Users can download individual surahs for offline reading directly from the surah list.
- **Full Quran Download** – Optional bulk download of all 114 surahs (Arabic + English) from the Settings screen for complete offline access.
- **Quran Settings Section** – New section in Settings to choose default display (Arabic Only / Arabic + English), view download stats/storage, trigger full download, or clear all Quran downloads.
- **Translation Keys** – Added English and Arabic translations for all Quran-related UI strings.
- **Architecture Documentation** – Added `docs/ARCHITECTURE.md` describing module structure and data flow.

### New Files

- `lib/quranApi.ts` – API client for alquran.cloud (surah list, surah text, full Quran, search).
- `utils/quranStorage.ts` – Offline storage service using expo-file-system + AsyncStorage index.
- `app/(tabs)/quran.tsx` – Quran tab screen (surah list, reader, search).
- `docs/ARCHITECTURE.md` – Module-level architecture documentation.
- `CHANGELOG.md` – This file.
