/**
 * Quran API client for alquran.cloud
 *
 * Endpoints used:
 *   GET /v1/surah          – list of all 114 surahs (metadata)
 *   GET /v1/surah/{number}/{edition} – full surah text in a given edition
 *   GET /v1/quran/{edition} – entire Quran text in a given edition
 *   GET /v1/search/{keyword}/{scope}/{edition} – keyword search
 *
 * No auth required. Rate-limit is unknown so we keep requests conservative.
 */

const BASE = 'https://api.alquran.cloud/v1';

/* ---------- Edition identifiers ---------- */
export const EDITIONS = {
    ARABIC: 'quran-uthmani',       // Uthmani Arabic script
    ENGLISH: 'en.sahih',           // Sahih International English translation
} as const;

export type EditionKey = keyof typeof EDITIONS;

/* ---------- Type definitions ---------- */

export interface SurahMeta {
    number: number;
    name: string;             // Arabic name  (e.g. "سورة الفاتحة")
    englishName: string;      // English name (e.g. "Al-Faatiha")
    englishNameTranslation: string; // e.g. "The Opening"
    numberOfAyahs: number;
    revelationType: 'Meccan' | 'Medinan';
}

export interface Ayah {
    number: number;           // Global ayah number (1-6236)
    text: string;
    numberInSurah: number;
    juz: number;
    page: number;
    hizbQuarter: number;
}

export interface SurahData {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
    numberOfAyahs: number;
    ayahs: Ayah[];
}

export interface SearchMatch {
    number: number;
    text: string;
    surah: SurahMeta;
    numberInSurah: number;
    edition: { identifier: string; language: string; name: string; englishName: string };
}

export interface SearchResult {
    count: number;
    matches: SearchMatch[];
}

/* ---------- Helpers ---------- */

async function apiFetch<T>(path: string): Promise<T> {
    const url = `${BASE}${path}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Quran API error ${res.status}: ${url}`);
    }
    const json = await res.json();
    if (json.code !== 200 || json.status !== 'OK') {
        throw new Error(json.data ?? `Quran API returned status ${json.status}`);
    }
    return json.data as T;
}

/* ---------- Public API ---------- */

/** Fetch metadata for all 114 surahs (lightweight). */
export async function fetchSurahList(): Promise<SurahMeta[]> {
    return apiFetch<SurahMeta[]>('/surah');
}

/**
 * Fetch a single surah's full text in the given edition.
 * @param surahNumber 1-114
 * @param edition     e.g. 'quran-uthmani' or 'en.sahih'
 */
export async function fetchSurah(
    surahNumber: number,
    edition: string = EDITIONS.ARABIC,
): Promise<SurahData> {
    return apiFetch<SurahData>(`/surah/${surahNumber}/${edition}`);
}

/**
 * Fetch a surah's Arabic text AND English translation in one call.
 * Returns a tuple [arabicSurah, englishSurah].
 */
export async function fetchSurahDual(
    surahNumber: number,
): Promise<[SurahData, SurahData]> {
    const [ar, en] = await Promise.all([
        fetchSurah(surahNumber, EDITIONS.ARABIC),
        fetchSurah(surahNumber, EDITIONS.ENGLISH),
    ]);
    return [ar, en];
}

/**
 * Fetch the entire Quran in one edition.
 * WARNING: large payload (~2-3 MB per edition). Use for optional "download all".
 */
export async function fetchFullQuran(
    edition: string = EDITIONS.ARABIC,
): Promise<SurahData[]> {
    // The /quran endpoint returns { surahs: SurahData[] }
    const data = await apiFetch<{ surahs: SurahData[] }>(`/quran/${edition}`);
    return data.surahs;
}

/**
 * Fetch entire Quran in both Arabic + English.
 * Returns [arabicSurahs[], englishSurahs[]].
 */
export async function fetchFullQuranDual(): Promise<[SurahData[], SurahData[]]> {
    const [ar, en] = await Promise.all([
        fetchFullQuran(EDITIONS.ARABIC),
        fetchFullQuran(EDITIONS.ENGLISH),
    ]);
    return [ar, en];
}

/**
 * Search the Quran for a keyword.
 * @param keyword  search term
 * @param edition  edition to search in (defaults to English)
 * @param scope    'all' or surah number range e.g. '36' or '1-5'
 */
export async function searchQuran(
    keyword: string,
    edition: string = EDITIONS.ENGLISH,
    scope: string = 'all',
): Promise<SearchResult> {
    return apiFetch<SearchResult>(
        `/search/${encodeURIComponent(keyword)}/${scope}/${edition}`,
    );
}
