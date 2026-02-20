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
    fetchSurahDual,
    fetchFullQuranDual,
    fetchSurahList,
    EDITIONS,
} from '../lib/quranApi';

/* ---------- Constants ---------- */

const QURAN_DIR = `${FileSystem.documentDirectory}quran/`;
const SURAHS_DIR = `${QURAN_DIR}surahs/`;
const META_FILE = `${QURAN_DIR}meta.json`;

// AsyncStorage keys
const INDEX_KEY = '@quran_download_index'; // JSON of DownloadIndex
const EDITION_PREF_KEY = '@quran_edition_pref'; // 'arabic' | 'both'

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

/** Get surah list from cache if available, else fetch & cache. */
export async function getSurahListCached(): Promise<SurahMeta[]> {
    await ensureDirs();
    try {
        const info = await FileSystem.getInfoAsync(META_FILE);
        if (info.exists) {
            const raw = await FileSystem.readAsStringAsync(META_FILE);
            return JSON.parse(raw) as SurahMeta[];
        }
    } catch {
        // Fall through to fetch
    }
    const list = await fetchSurahList();
    await FileSystem.writeAsStringAsync(META_FILE, JSON.stringify(list));
    return list;
}

/* ---------- Public: Single-surah download ---------- */

/**
 * Check whether a surah is available offline.
 */
export async function isSurahDownloaded(surahNumber: number): Promise<boolean> {
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

    await FileSystem.writeAsStringAsync(surahFilePath(surahNumber, 'ar'), arJson);
    await FileSystem.writeAsStringAsync(surahFilePath(surahNumber, 'en'), enJson);

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
 * Read a previously downloaded surah from disk.
 * Returns null if not downloaded.
 */
export async function readOfflineSurah(
    surahNumber: number,
    lang: 'ar' | 'en',
): Promise<SurahData | null> {
    try {
        const path = surahFilePath(surahNumber, lang);
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return null;
        const raw = await FileSystem.readAsStringAsync(path);
        return JSON.parse(raw) as SurahData;
    } catch {
        return null;
    }
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

        await FileSystem.writeAsStringAsync(surahFilePath(num, 'ar'), arJson);
        await FileSystem.writeAsStringAsync(surahFilePath(num, 'en'), enJson);

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

/** Delete ALL downloaded Quran data + reset index. */
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
