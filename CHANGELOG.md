# Changelog

All notable changes to this project will be documented in this file.

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
