# Changelog

All notable changes to this project will be documented in this file.

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
