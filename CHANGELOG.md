# Changelog

All notable changes to this project will be documented in this file.

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
