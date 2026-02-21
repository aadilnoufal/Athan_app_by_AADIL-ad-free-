# Architecture

High-level architecture of the Prayer Times app.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.79 + Expo SDK 53 |
| Routing | Expo Router (file-based, tab group) |
| State | React state + AsyncStorage for persistence |
| Styling | StyleSheet + theme context (sepia light/dark) |
| Notifications | Notifee + expo-notifications |
| Networking | fetch (REST) |
| Offline Storage | expo-file-system (large content), AsyncStorage (prefs/index), react-native-mmkv (fast KV) |

## Module Map

```
app/
  _layout.tsx          Root stack + providers (SafeArea, Theme, Language, RevenueCat)
  (tabs)/
    _layout.tsx        Tab navigator (Prayer Times, Dua, Quran, Qibla, Settings)
    index.tsx          Home / Prayer Times screen
    dua.tsx            Duas & Azkar screen
    quran.tsx          Quran reader screen (surah list → reader → search)
    qibla.tsx          Qibla compass screen
    settings.tsx       Settings screen (appearance, language, notifications,
                         location, Quran settings, about/support)
  components/          Shared components used by tab screens
  config/              Static config (prayer time regions, etc.)
  contexts/            React contexts (Theme, Language, RevenueCat)

lib/
  quranApi.ts          REST client for alquran.cloud/api
  qibla-compass/       Qibla compass logic

utils/
  quranStorage.ts      Quran offline download & cache management
  notifeePrayerService.js   Notification scheduling via Notifee
  prayerNotificationScheduler.ts  High-level notification orchestration
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

widgets/
  widgetTaskHandler.ts Android widget bridge
```

## Data Flow – Quran Feature

```
User opens Quran tab
  → quran.tsx loads surah list via quranStorage.getSurahListCached()
    → checks local file cache (expo-file-system: quran/meta.json)
    → if miss → fetches from alquran.cloud/v1/surah, writes cache

User taps a surah
  → quran.tsx calls readOfflineSurah() first
    → if downloaded → renders from disk instantly (no network)
    → if not → fetches Arabic + user's chosen translation edition via fetchSurahWithTranslation()
  → checks if surah audio is downloaded for current reciter (isSurahAudioDownloaded)

User taps an ayah or the play button
  → quran.tsx playAyah(index)
    → tries local audio file first (getLocalAudioUri)
    → if not local → fetches audio data from API (fetchSurahAudio) → streams remote URL
    → plays via expo-av Audio.Sound
    → auto-advances to next ayah on finish

User taps download audio button
  → quranStorage.downloadSurahAudio(surahNumber, reciterEdition, onProgress)
    → fetches audio edition from API if needed
    → downloads individual MP3 files to quran/audio/{reciter}/{ayahNum}.mp3
    → marks in audio download index

User changes font size / translation edition / reciter in Settings
  → quranStorage.setQuranFontScale / setTranslationEdition / setReciterPref
    → persists to AsyncStorage
    → quran.tsx reads on next mount

User changes "Auto-scroll with audio" in Settings
  → quranStorage.setQuranAutoScrollWithAudio(enabled)
    → persists to AsyncStorage
    → quran.tsx follows/pauses synced ayah scrolling during playback

User taps download icon on a surah
  → quranStorage.downloadSurah(n)
    → fetches both editions, writes JSON files to quran/surahs/
    → updates AsyncStorage download index

User triggers "Download Full Quran" from Settings
  → quranStorage.downloadFullQuran(onProgress)
    → fetches /v1/quran/quran-uthmani + /v1/quran/en.sahih (bulk)
    → writes 228 JSON files (114 × 2 editions)
    → progress callback updates UI

User clears downloads from Settings
  → quranStorage.deleteAllQuranData()
    → deletes quran/ directory + removes AsyncStorage index
```

## Key Design Decisions

1. **Online-first, optional offline** – App size stays small; users opt-in to downloads.
2. **Per-surah granularity** – Users can download only surahs they read often.
3. **Audio streaming + optional download** – Audio streams by default; user can download per-surah per-reciter.
4. **expo-file-system for content** – AsyncStorage has size limits; file system handles multi-MB JSON/MP3 without issue.
5. **Edition preference in Settings** – Persisted via AsyncStorage; Quran tab reads it on mount.
6. **Bismillah stripping** – API includes Bismillah in ayah 1 text; `stripBismillah()` strips it since a separate styled banner is shown.
7. **Cached edition lists** – Translation and audio edition lists cached with 7-day TTL to avoid repeated API calls.
