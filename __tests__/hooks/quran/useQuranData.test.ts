/**
 * Tests for useQuranData hook.
 *
 * Verifies:
 * - Initial state defaults are correct
 * - Init effect loads surah list + all preferences
 * - retryLoadSurahList reloads after error
 * - filteredSurahList filters by name, number, and aliases
 * - ayahRefMatch detects "surah:ayah" patterns (e.g. "2:14")
 * - Font size scaling (fs memo)
 * - runSearch dismisses keyboard
 * - handleDismissHint persists dismissal
 * - Theme derivations (dark vs light gradient)
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

// ── Mock data ──────────────────────────────────────────────────────────

const mockSurahList = [
    { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', englishNameTranslation: 'The Opening', numberOfAyahs: 7, revelationType: 'Meccan' },
    { number: 2, name: 'البقرة', englishName: 'Al-Baqara', englishNameTranslation: 'The Cow', numberOfAyahs: 286, revelationType: 'Medinan' },
    { number: 36, name: 'يس', englishName: 'Ya-Sin', englishNameTranslation: 'Ya Sin', numberOfAyahs: 83, revelationType: 'Meccan' },
    { number: 114, name: 'الناس', englishName: 'An-Nas', englishNameTranslation: 'Mankind', numberOfAyahs: 6, revelationType: 'Meccan' },
];

// ── Mocks ──────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@react-navigation/native', () => ({
    useFocusEffect: jest.fn((cb: () => any) => { cb(); }),
}));

jest.mock('expo-font', () => ({
    loadAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../contexts/ThemeContext', () => ({
    useTheme: jest.fn(() => ({
        colors: {
            background: { primary: '#fff', secondary: '#f5f5f5', tertiary: '#eee' },
            surface: { primary: '#fafafa', secondary: '#f0f0f0', elevated: '#e8e8e8' },
            text: { primary: '#000', secondary: '#666', tertiary: '#999', inverse: '#fff' },
            accent: { gold: '#c9a55a' },
            border: { light: '#ddd' },
        },
        isDark: false,
    })),
}));

jest.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: jest.fn(() => ({
        t: jest.fn((key: string) => key),
        language: 'en',
    })),
}));

jest.mock('../../../utils/colorHelpers', () => ({
    goldTint: jest.fn((_opacity: number, _colors: any) => 'rgba(201,165,90,0.1)'),
    withAlpha: jest.fn(),
}));

jest.mock('../../../utils/quranStorage', () => ({
    __esModule: true,
    getSurahListCached: jest.fn().mockResolvedValue([]),
    getEditionPref: jest.fn().mockResolvedValue('both'),
    getQuranFontScale: jest.fn().mockResolvedValue(1.2),
    getTranslationEdition: jest.fn().mockResolvedValue('en.sahih'),
    getReciterPref: jest.fn().mockResolvedValue('ar.alafasy'),
    getQuranAutoScrollWithAudio: jest.fn().mockResolvedValue(true),
    isSettingsHintDismissed: jest.fn().mockResolvedValue(false),
    dismissSettingsHint: jest.fn(),
    getLastRead: jest.fn().mockResolvedValue(null),
    setLastRead: jest.fn().mockResolvedValue(undefined),
    getQuranFontFamily: jest.fn().mockResolvedValue('default'),
    getBookmark: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../lib/quranApi', () => ({
    __esModule: true,
    EDITIONS: {
        ARABIC: 'quran-uthmani',
        ENGLISH: 'en.sahih',
        DEFAULT_RECITER: 'ar.alafasy',
    },
}));

// Spy on Keyboard.dismiss (no need to mock all of react-native)
jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => true as any);

const quranStorage = jest.requireMock('../../../utils/quranStorage');

import { useQuranData } from '../../../hooks/quran/useQuranData';

describe('useQuranData', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        quranStorage.getSurahListCached.mockResolvedValue(mockSurahList);
        quranStorage.getEditionPref.mockResolvedValue('both');
        quranStorage.getQuranFontScale.mockResolvedValue(1.2);
        quranStorage.getTranslationEdition.mockResolvedValue('en.sahih');
        quranStorage.getReciterPref.mockResolvedValue('ar.alafasy');
        quranStorage.getQuranAutoScrollWithAudio.mockResolvedValue(true);
        quranStorage.isSettingsHintDismissed.mockResolvedValue(false);
        quranStorage.getLastRead.mockResolvedValue(null);
        quranStorage.getQuranFontFamily.mockResolvedValue('default');
        quranStorage.getBookmark.mockResolvedValue(null);
    });

    // ── Initial state & loading ──────────────────────────────────

    it('starts in loading state with list mode', async () => {
        const { result } = renderHook(() => useQuranData());
        // Initially loading
        expect(result.current.mode).toBe('list');
        expect(result.current.loading).toBe(true);
        expect(result.current.surahList).toEqual([]);

        // After init resolves
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.surahList).toEqual(mockSurahList);
    });

    it('loads all preferences on init', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.editionPref).toBe('both');
        expect(result.current.translationEdition).toBe('en.sahih');
        expect(result.current.reciterEdition).toBe('ar.alafasy');
        expect(result.current.autoScrollWithAudio).toBe(true);
        expect(result.current.showSettingsHint).toBe(true); // !false
    });

    it('sets error when init fails', async () => {
        quranStorage.getSurahListCached.mockRejectedValue(new Error('Network error'));
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe('Network error');
        expect(result.current.surahList).toEqual([]);
    });

    // ── retryLoadSurahList ───────────────────────────────────────

    it('retryLoadSurahList reloads after error', async () => {
        quranStorage.getSurahListCached.mockRejectedValueOnce(new Error('fail'));
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.error).toBe('fail'));

        // Fix the mock
        quranStorage.getSurahListCached.mockResolvedValue(mockSurahList);
        await act(async () => {
            await result.current.retryLoadSurahList();
        });

        expect(result.current.error).toBeNull();
        expect(result.current.surahList).toEqual(mockSurahList);
    });

    // ── filteredSurahList ────────────────────────────────────────

    it('returns all surahs when search is empty', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.filteredSurahList).toEqual(mockSurahList);
    });

    it('filters by surah number', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSearchQuery('36'));
        expect(result.current.filteredSurahList).toEqual([mockSurahList[2]]);
    });

    it('filters by English name', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSearchQuery('fatiha'));
        expect(result.current.filteredSurahList).toEqual([mockSurahList[0]]);
    });

    it('filters by English name translation', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSearchQuery('cow'));
        expect(result.current.filteredSurahList).toEqual([mockSurahList[1]]);
    });

    it('filters by alias (e.g. "yaseen" → Ya-Sin)', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSearchQuery('yaseen'));
        const filtered = result.current.filteredSurahList;
        expect(filtered.some(s => s.number === 36)).toBe(true);
    });

    it('shows empty list for non-matching query', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSearchQuery('zzzznotasurah'));
        expect(result.current.filteredSurahList).toEqual([]);
    });

    // ── ayahRefMatch ─────────────────────────────────────────────

    it('detects "2:14" as ayah reference', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSearchQuery('2:14'));
        const match = result.current.ayahRefMatch;
        expect(match).not.toBeNull();
        expect(match!.surahNum).toBe(2);
        expect(match!.ayahNum).toBe(14);
        expect(match!.surah.englishName).toBe('Al-Baqara');
    });

    it('rejects invalid surah number in ref', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSearchQuery('999:1'));
        expect(result.current.ayahRefMatch).toBeNull();
    });

    it('rejects ayah number exceeding surah length', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSearchQuery('1:99'));
        expect(result.current.ayahRefMatch).toBeNull();
    });

    // ── Font sizes ───────────────────────────────────────────────

    it('computes scaled font sizes from fontScale', async () => {
        quranStorage.getQuranFontScale.mockResolvedValue(2.0);
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.fs.ayahArabic).toBe(Math.round(24 * 2.0));
        expect(result.current.fs.bismillah).toBe(Math.round(28 * 2.0));
    });

    // ── arabicFontFamily ─────────────────────────────────────────

    it('returns undefined for default font family', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.arabicFontFamily).toBeUndefined();
    });

    it('returns font name when custom family selected', async () => {
        quranStorage.getQuranFontFamily.mockResolvedValue('Amiri');
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.arabicFontFamily).toBe('Amiri');
    });

    // ── runSearch ────────────────────────────────────────────────

    it('runSearch dismisses keyboard', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.runSearch());
        expect(Keyboard.dismiss).toHaveBeenCalled();
    });

    // ── handleDismissHint ────────────────────────────────────────

    it('handleDismissHint hides hint and persists', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.showSettingsHint).toBe(true);

        act(() => result.current.handleDismissHint());
        expect(result.current.showSettingsHint).toBe(false);
        expect(quranStorage.dismissSettingsHint).toHaveBeenCalled();
    });

    // ── Theme derivations ────────────────────────────────────────

    it('provides gradient colors', async () => {
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.gradientColors).toHaveLength(3);
        expect(typeof result.current.goldTint).toBe('function');
        expect(typeof result.current.cardBg).toBe('string');
    });

    // ── Bookmark & lastRead ──────────────────────────────────────

    it('loads bookmark from storage', async () => {
        const bm = { surahNumber: 2, surahName: 'Al-Baqara', surahNameArabic: 'البقرة', ayahIndex: 10, ayahNumberInSurah: 11, timestamp: 123 };
        quranStorage.getBookmark.mockResolvedValue(bm);
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.bookmarkEntry).toEqual(bm);
    });

    it('loads lastRead from storage', async () => {
        const lr = { surahNumber: 36, surahName: 'Ya-Sin', surahNameArabic: 'يس', ayahIndex: 5, timestamp: 456 };
        quranStorage.getLastRead.mockResolvedValue(lr);
        const { result } = renderHook(() => useQuranData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.lastRead).toEqual(lr);
    });
});
