/**
 * Quran offline storage service.
 *
 * Uses expo-file-system for surah JSON files and AsyncStorage for
 * a lightweight metadata index (which surahs are downloaded, timestamps, sizes).
 *
 * Directory layout:
 *   ${documentDirectory}quran/
 *     surahs/
 *       1_ar.json   – Arabic text for surah 1
 *       1_en.json   – English text for surah 1
 *       ...
 *     meta.json     – cached surah list metadata
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    SurahMeta,
    SurahData,
    EditionInfo,
    fetchSurah,
    fetchSurahDual,
    fetchSurahWithTranslation,
    fetchFullQuranDual,
    fetchFullQuran,
    fetchSurahList,
    fetchTranslationEditions,
    fetchAudioEditions,
    fetchSurahAudio,
    EDITIONS,
} from '../lib/quranApi';

/* ---------- Bundled Quran data (shipped with app) ---------- */
// These JSON files are bundled inside the app binary (~3.5 MB total).
// They provide instant offline access to Arabic + English (Sahih International).
const BUNDLED_SURAH_LIST: SurahMeta[] = require('../assets/quran/surah_list.json');
const BUNDLED_QURAN_AR: SurahData[] = require('../assets/quran/quran_ar.json');
const BUNDLED_QURAN_EN: SurahData[] = require('../assets/quran/quran_en.json');

/* ---------- Constants ---------- */

const QURAN_DIR = `${FileSystem.documentDirectory}quran/`;
const SURAHS_DIR = `${QURAN_DIR}surahs/`;
const AUDIO_DIR = `${QURAN_DIR}audio/`;
const META_FILE = `${QURAN_DIR}meta.json`;

// AsyncStorage keys
const INDEX_KEY = '@quran_download_index';          // JSON of DownloadIndex
const EDITION_PREF_KEY = '@quran_edition_pref';     // 'arabic' | 'both'
const FONT_SCALE_KEY = '@quran_font_scale';         // float e.g. '1.0'
const AUTO_SCROLL_WITH_AUDIO_KEY = '@quran_auto_scroll_with_audio'; // 'true' | 'false'
const TRANSLATION_EDITION_KEY = '@quran_translation_edition'; // e.g. 'en.sahih'
const RECITER_KEY = '@quran_reciter';               // e.g. 'ar.alafasy'
const EDITIONS_CACHE_KEY = '@quran_editions_list';  // cached translation editions JSON
const RECITERS_CACHE_KEY = '@quran_reciters_list';  // cached audio editions JSON
const SETTINGS_HINT_KEY = '@quran_settings_hint_dismissed'; // '1' when dismissed
const AUDIO_INDEX_KEY = '@quran_audio_download_index'; // JSON of { [surahNum_reciter]: true }
const BISMILLAH_CACHE_KEY = '@quran_bismillah_cache'; // JSON of { [edition]: bismillahText }
const LAST_READ_KEY = '@quran_last_read';             // JSON of LastReadEntry
const QURAN_FONT_FAMILY_KEY = '@quran_font_family';   // 'default' | 'Amiri' | 'ScheherazadeNew'
const BOOKMARK_KEY = '@quran_bookmark';               // JSON of BookmarkEntry

/* ---------- Types ---------- */

export interface DownloadedSurahEntry {
    surahNumber: number;
    downloadedAt: number; // epoch ms
    sizeBytes: number;    // approximate combined size
}

interface DownloadIndex {
    surahs: Record<number, DownloadedSurahEntry>;
    fullDownload: boolean; // true when all 114 downloaded via bulk
    lastUpdated: number;
}

export type EditionPref = 'arabic' | 'both';

/* ---------- Internal helpers ---------- */

async function ensureDirs(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(SURAHS_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(SURAHS_DIR, { intermediates: true });
    }
}

function surahFilePath(surahNumber: number, lang: 'ar' | 'en'): string {
    return `${SURAHS_DIR}${surahNumber}_${lang}.json`;
}

async function readIndex(): Promise<DownloadIndex> {
    try {
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // Corrupted – reset
    }
    return { surahs: {}, fullDownload: false, lastUpdated: 0 };
}

async function writeIndex(index: DownloadIndex): Promise<void> {
    index.lastUpdated = Date.now();
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/* ---------- Public: Edition preference ---------- */

export async function getEditionPref(): Promise<EditionPref> {
    const val = await AsyncStorage.getItem(EDITION_PREF_KEY);
    return (val === 'arabic' || val === 'both') ? val : 'both';
}

export async function setEditionPref(pref: EditionPref): Promise<void> {
    await AsyncStorage.setItem(EDITION_PREF_KEY, pref);
}

/* ---------- Public: Metadata cache ---------- */

/**
 * Get surah list – always available instantly from bundled data.
 * Also attempts to cache an API copy for freshness, but never blocks on it.
 */
export async function getSurahListCached(): Promise<SurahMeta[]> {
    // Bundled data is always available; return immediately
    return BUNDLED_SURAH_LIST;
}

/* ---------- Public: Single-surah download ---------- */

/**
 * Check whether a surah text is available offline.
 * With bundled data this always returns true for Arabic/English.
 */
export async function isSurahDownloaded(surahNumber: number): Promise<boolean> {
    // Bundled Arabic + English are always available
    if (surahNumber >= 1 && surahNumber <= 114) return true;
    const index = await readIndex();
    return !!index.surahs[surahNumber];
}

/**
 * Get the download index (all downloaded surahs).
 */
export async function getDownloadIndex(): Promise<DownloadIndex> {
    return readIndex();
}

/**
 * Download a single surah (Arabic + English) to disk.
 * Returns the entry with size info.
 */
export async function downloadSurah(surahNumber: number): Promise<DownloadedSurahEntry> {
    await ensureDirs();
    const [ar, en] = await fetchSurahDual(surahNumber);

    const arJson = JSON.stringify(ar);
    const enJson = JSON.stringify(en);

    await Promise.all([
        FileSystem.writeAsStringAsync(surahFilePath(surahNumber, 'ar'), arJson),
        FileSystem.writeAsStringAsync(surahFilePath(surahNumber, 'en'), enJson),
    ]);

    const entry: DownloadedSurahEntry = {
        surahNumber,
        downloadedAt: Date.now(),
        sizeBytes: arJson.length + enJson.length,
    };

    const index = await readIndex();
    index.surahs[surahNumber] = entry;
    // If all 114 now present, mark full download
    if (Object.keys(index.surahs).length >= 114) {
        index.fullDownload = true;
    }
    await writeIndex(index);
    return entry;
}

/**
 * Read an offline surah. Priority order:
 *   1. Disk cache (user may have downloaded a different translation)
 *   2. Bundled data (Arabic / English always available)
 * Returns null only for non-bundled languages with no disk cache.
 */
export async function readOfflineSurah(
    surahNumber: number,
    lang: 'ar' | 'en',
): Promise<SurahData | null> {
    // 1. Try disk cache first (supports user-downloaded translations)
    try {
        const path = surahFilePath(surahNumber, lang);
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
            const raw = await FileSystem.readAsStringAsync(path);
            return JSON.parse(raw) as SurahData;
        }
    } catch {
        // Fall through to bundled
    }
    // 2. Fall back to bundled data (Arabic / English)
    return getBundledSurah(surahNumber, lang);
}

/**
 * Read a surah directly from the bundled app data.
 * Supports 'ar' (Arabic) and 'en' (English Sahih International) only.
 * Returns null for any other language.
 */
export function getBundledSurah(
    surahNumber: number,
    lang: 'ar' | 'en',
): SurahData | null {
    const source = lang === 'ar' ? BUNDLED_QURAN_AR : lang === 'en' ? BUNDLED_QURAN_EN : null;
    if (!source) return null;
    // Surah numbers are 1-indexed; array is 0-indexed
    const idx = surahNumber - 1;
    if (idx < 0 || idx >= source.length) return null;
    return source[idx];
}

/** Quran text is always available offline (bundled in app). */
export function isQuranTextBundled(): boolean {
    return true;
}

/* ---------- Public: Full Quran download ---------- */

export interface DownloadProgress {
    downloaded: number;
    total: number;
}

/**
 * Download all 114 surahs (Arabic + English).
 * Accepts a progress callback for UI updates.
 */
export async function downloadFullQuran(
    onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
    await ensureDirs();

    // Use the bulk endpoint to minimise request count
    const [arSurahs, enSurahs] = await fetchFullQuranDual();

    const index = await readIndex();

    // Write each surah to disk
    for (let i = 0; i < arSurahs.length; i++) {
        const ar = arSurahs[i];
        const en = enSurahs[i];
        const num = ar.number;

        const arJson = JSON.stringify(ar);
        const enJson = JSON.stringify(en);

        await Promise.all([
            FileSystem.writeAsStringAsync(surahFilePath(num, 'ar'), arJson),
            FileSystem.writeAsStringAsync(surahFilePath(num, 'en'), enJson),
        ]);

        index.surahs[num] = {
            surahNumber: num,
            downloadedAt: Date.now(),
            sizeBytes: arJson.length + enJson.length,
        };

        onProgress?.({ downloaded: i + 1, total: arSurahs.length });
    }

    index.fullDownload = true;
    await writeIndex(index);
}

/* ---------- Public: Deletion / cleanup ---------- */

/** Delete a single surah's offline files. */
export async function deleteSurah(surahNumber: number): Promise<void> {
    try {
        await FileSystem.deleteAsync(surahFilePath(surahNumber, 'ar'), { idempotent: true });
        await FileSystem.deleteAsync(surahFilePath(surahNumber, 'en'), { idempotent: true });
    } catch {
        // Ignore missing files
    }

    const index = await readIndex();
    delete index.surahs[surahNumber];
    index.fullDownload = false;
    await writeIndex(index);
}

/**
 * Delete ALL cached Quran data (extra translations, audio files) + reset index.
 * Note: This does NOT remove the bundled Arabic/English data (it's part of the app binary).
 */
export async function deleteAllQuranData(): Promise<void> {
    try {
        await FileSystem.deleteAsync(QURAN_DIR, { idempotent: true });
    } catch {
        // Best-effort
    }
    await AsyncStorage.removeItem(INDEX_KEY);
}

/** Approximate total size in bytes of all downloaded surahs. */
export async function getTotalDownloadSize(): Promise<number> {
    const index = await readIndex();
    return Object.values(index.surahs).reduce((sum, e) => sum + e.sizeBytes, 0);
}

/**
 * Get count of downloaded surahs.
 */
export async function getDownloadedCount(): Promise<number> {
    const index = await readIndex();
    return Object.keys(index.surahs).length;
}

/* ---------- Public: Font scale preference ---------- */

/** Get the Quran font scale multiplier (default 1.2, range 0.75–1.5). */
export async function getQuranFontScale(): Promise<number> {
    try {
        const val = await AsyncStorage.getItem(FONT_SCALE_KEY);
        if (val) {
            const n = parseFloat(val);
            if (!isNaN(n) && n >= 0.75 && n <= 1.5) return n;
        }
    } catch { /* ignore */ }
    return 1.2;
}

export async function setQuranFontScale(scale: number): Promise<void> {
    await AsyncStorage.setItem(FONT_SCALE_KEY, String(Math.max(0.75, Math.min(1.5, scale))));
}

/** Get whether audio playback should auto-scroll/highlight current ayah (default true). */
export async function getQuranAutoScrollWithAudio(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(AUTO_SCROLL_WITH_AUDIO_KEY);
        if (val === 'false') return false;
        if (val === 'true') return true;
    } catch { /* ignore */ }
    return true;
}

export async function setQuranAutoScrollWithAudio(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(AUTO_SCROLL_WITH_AUDIO_KEY, enabled ? 'true' : 'false');
}

/* ---------- Public: Last-read position ---------- */

export interface LastReadEntry {
    surahNumber: number;
    surahName: string;        // English name for display
    surahNameArabic: string;  // Arabic name for display
    ayahIndex: number;        // 0-based index within surah
    timestamp: number;        // epoch ms
}

/** Get the user's last read position, or null if none saved. */
export async function getLastRead(): Promise<LastReadEntry | null> {
    try {
        const raw = await AsyncStorage.getItem(LAST_READ_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as LastReadEntry;
    } catch {
        return null;
    }
}

/** Save last read position. */
export async function setLastRead(entry: LastReadEntry): Promise<void> {
    await AsyncStorage.setItem(LAST_READ_KEY, JSON.stringify(entry));
}

/* ---------- Public: Quran font family preference ---------- */

export type QuranFontFamily = 'default' | 'Amiri' | 'ScheherazadeNew';

/** Get the user's chosen Quran Arabic font family (default: 'default'). */
export async function getQuranFontFamily(): Promise<QuranFontFamily> {
    try {
        const val = await AsyncStorage.getItem(QURAN_FONT_FAMILY_KEY);
        if (val === 'Amiri' || val === 'ScheherazadeNew') return val;
    } catch { /* ignore */ }
    return 'default';
}

export async function setQuranFontFamily(family: QuranFontFamily): Promise<void> {
    await AsyncStorage.setItem(QURAN_FONT_FAMILY_KEY, family);
}

/* ---------- Public: Single bookmark ---------- */

export interface BookmarkEntry {
    surahNumber: number;
    surahName: string;        // English name for display
    surahNameArabic: string;  // Arabic name for display
    ayahIndex: number;        // 0-based index within surah
    ayahNumberInSurah: number; // 1-based ayah number
    timestamp: number;        // epoch ms
}

/** Get the user's bookmark, or null if none set. */
export async function getBookmark(): Promise<BookmarkEntry | null> {
    try {
        const raw = await AsyncStorage.getItem(BOOKMARK_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as BookmarkEntry;
    } catch {
        return null;
    }
}

/** Save a bookmark (replaces any previous one). */
export async function setBookmark(entry: BookmarkEntry): Promise<void> {
    await AsyncStorage.setItem(BOOKMARK_KEY, JSON.stringify(entry));
}

/** Remove the current bookmark. */
export async function removeBookmark(): Promise<void> {
    await AsyncStorage.removeItem(BOOKMARK_KEY);
}

/* ---------- Public: Bismillah text cache per edition ---------- */

/**
 * Get the Bismillah text for a translation edition (surah 1, ayah 1).
 * For Arabic / English, reads directly from bundled data (no network).
 * For other editions, cached in AsyncStorage so we only fetch once.
 */
export async function getBismillahText(edition: string): Promise<string | null> {
    try {
        // Fast path: bundled editions
        if (edition === EDITIONS.ARABIC || edition === 'quran-uthmani') {
            return BUNDLED_QURAN_AR[0]?.ayahs?.[0]?.text ?? null;
        }
        if (edition === EDITIONS.ENGLISH || edition === 'en.sahih') {
            return BUNDLED_QURAN_EN[0]?.ayahs?.[0]?.text ?? null;
        }

        const raw = await AsyncStorage.getItem(BISMILLAH_CACHE_KEY);
        const cache: Record<string, string> = raw ? JSON.parse(raw) : {};
        if (cache[edition]) return cache[edition];

        // Fetch surah 1 (Al-Fatiha) in this edition — ayah 1 IS the bismillah
        const surah1 = await fetchSurah(1, edition);
        const bismillah = surah1.ayahs[0]?.text ?? null;
        if (bismillah) {
            cache[edition] = bismillah;
            await AsyncStorage.setItem(BISMILLAH_CACHE_KEY, JSON.stringify(cache));
        }
        return bismillah;
    } catch {
        return null;
    }
}

/* ---------- Public: Translation edition preference ---------- */

/** Get the user's chosen translation edition identifier (default: en.sahih). */
export async function getTranslationEdition(): Promise<string> {
    try {
        const val = await AsyncStorage.getItem(TRANSLATION_EDITION_KEY);
        if (val && val.length > 0) return val;
    } catch { /* ignore */ }
    return EDITIONS.ENGLISH;
}

export async function setTranslationEdition(edition: string): Promise<void> {
    await AsyncStorage.setItem(TRANSLATION_EDITION_KEY, edition);
}

/* ---------- Public: Reciter preference ---------- */

/** Get the user's chosen reciter edition (default: ar.alafasy). */
export async function getReciterPref(): Promise<string> {
    try {
        const val = await AsyncStorage.getItem(RECITER_KEY);
        if (val && val.length > 0) return val;
    } catch { /* ignore */ }
    return EDITIONS.DEFAULT_RECITER;
}

export async function setReciterPref(edition: string): Promise<void> {
    await AsyncStorage.setItem(RECITER_KEY, edition);
}

/* ---------- Public: Cached edition lists (7-day TTL) ---------- */

interface CachedEditions {
    editions: EditionInfo[];
    cachedAt: number;
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Get cached translation editions, fetching from API if stale or missing. */
export async function getTranslationEditionsCached(): Promise<EditionInfo[]> {
    try {
        const raw = await AsyncStorage.getItem(EDITIONS_CACHE_KEY);
        if (raw) {
            const cached: CachedEditions = JSON.parse(raw);
            if (Date.now() - cached.cachedAt < CACHE_TTL) return cached.editions;
        }
    } catch { /* fall through */ }

    const editions = await fetchTranslationEditions();
    await AsyncStorage.setItem(EDITIONS_CACHE_KEY, JSON.stringify({ editions, cachedAt: Date.now() }));
    return editions;
}

/** Get cached audio (reciter) editions, fetching from API if stale or missing. */
export async function getAudioEditionsCached(): Promise<EditionInfo[]> {
    try {
        const raw = await AsyncStorage.getItem(RECITERS_CACHE_KEY);
        if (raw) {
            const cached: CachedEditions = JSON.parse(raw);
            if (Date.now() - cached.cachedAt < CACHE_TTL) return cached.editions;
        }
    } catch { /* fall through */ }

    const editions = await fetchAudioEditions();
    await AsyncStorage.setItem(RECITERS_CACHE_KEY, JSON.stringify({ editions, cachedAt: Date.now() }));
    return editions;
}

/* ---------- Public: Settings hint dismissed ---------- */

export async function isSettingsHintDismissed(): Promise<boolean> {
    const val = await AsyncStorage.getItem(SETTINGS_HINT_KEY);
    return val === '1';
}

export async function dismissSettingsHint(): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_HINT_KEY, '1');
}

/* ---------- Public: Audio download management ---------- */

async function ensureAudioDir(reciterEdition: string): Promise<string> {
    const dir = `${AUDIO_DIR}${reciterEdition}/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
}

function audioFilePath(reciterEdition: string, globalAyahNumber: number): string {
    return `${AUDIO_DIR}${reciterEdition}/${globalAyahNumber}.mp3`;
}

async function readAudioIndex(): Promise<Record<string, boolean>> {
    try {
        const raw = await AsyncStorage.getItem(AUDIO_INDEX_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
}

async function writeAudioIndex(index: Record<string, boolean>): Promise<void> {
    await AsyncStorage.setItem(AUDIO_INDEX_KEY, JSON.stringify(index));
}

function audioIndexKey(surahNumber: number, reciterEdition: string): string {
    return `${surahNumber}_${reciterEdition}`;
}

/** Check if a surah's audio is downloaded for a given reciter. */
export async function isSurahAudioDownloaded(surahNumber: number, reciterEdition: string): Promise<boolean> {
    const index = await readAudioIndex();
    return !!index[audioIndexKey(surahNumber, reciterEdition)];
}

/**
 * Download all ayah audio files for a surah.
 * @returns total bytes downloaded (approximate)
 */
export async function downloadSurahAudio(
    surahNumber: number,
    reciterEdition: string,
    onProgress?: (downloaded: number, total: number) => void,
): Promise<number> {
    await ensureAudioDir(reciterEdition);

    // Fetch surah with audio URLs
    const surahData = await fetchSurahAudio(surahNumber, reciterEdition);
    let totalBytes = 0;

    for (let i = 0; i < surahData.ayahs.length; i++) {
        const ayah = surahData.ayahs[i];
        if (!ayah.audio) continue;

        const dest = audioFilePath(reciterEdition, ayah.number);
        const info = await FileSystem.getInfoAsync(dest);
        if (!info.exists) {
            const result = await FileSystem.downloadAsync(ayah.audio, dest);
            if (result.status === 200) {
                const fInfo = await FileSystem.getInfoAsync(dest);
                totalBytes += (fInfo as any).size || 0;
            }
        }
        onProgress?.(i + 1, surahData.ayahs.length);
    }

    // Mark in index
    const index = await readAudioIndex();
    index[audioIndexKey(surahNumber, reciterEdition)] = true;
    await writeAudioIndex(index);

    return totalBytes;
}

/** Get the local file URI for an ayah's audio, or null if not downloaded. */
export async function getLocalAudioUri(reciterEdition: string, globalAyahNumber: number): Promise<string | null> {
    const path = audioFilePath(reciterEdition, globalAyahNumber);
    try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) return path;
    } catch { /* ignore */ }
    return null;
}

/** Delete a surah's downloaded audio files. */
export async function deleteSurahAudio(surahNumber: number, reciterEdition: string): Promise<void> {
    // We'd need to know the global ayah numbers; simplest: remove the index entry.
    // Actual files will be cleaned up on next full clear.
    const index = await readAudioIndex();
    delete index[audioIndexKey(surahNumber, reciterEdition)];
    await writeAudioIndex(index);
}

/**
 * Download audio for ALL 114 surahs for a given reciter.
 * @param reciterEdition  e.g. 'ar.alafasy'
 * @param onProgress      called after each surah completes: (surahsDone, totalSurahs)
 * @returns total bytes downloaded
 */
export async function downloadAllAudio(
    reciterEdition: string,
    onProgress?: (surahsDone: number, totalSurahs: number) => void,
): Promise<number> {
    let totalBytes = 0;
    const totalSurahs = 114;

    for (let surahNum = 1; surahNum <= totalSurahs; surahNum++) {
        // Skip if already downloaded
        const already = await isSurahAudioDownloaded(surahNum, reciterEdition);
        if (!already) {
            const bytes = await downloadSurahAudio(surahNum, reciterEdition);
            totalBytes += bytes;
        }
        onProgress?.(surahNum, totalSurahs);
    }

    return totalBytes;
}
