import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Keyboard, AppState } from 'react-native';
import type { TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Font from 'expo-font';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { goldTint as centralGoldTint } from '../../utils/colorHelpers';
import { SURAH_ALIASES } from '../../constants/surahAliases';
import type { ViewMode } from '../../constants/surahAliases';
import {
    SurahMeta,
    SurahData,
    SearchMatch,
    EDITIONS,
} from '../../lib/quranApi';
import {
    getSurahListCached,
    getEditionPref,
    EditionPref,
    getQuranFontScale,
    getQuranAutoScrollWithAudio,
    getTranslationEdition,
    getReciterPref,
    isSettingsHintDismissed,
    dismissSettingsHint,
    getLastRead,
    setLastRead,
    LastReadEntry,
    getQuranFontFamily,
    QuranFontFamily,
    getBookmark,
    BookmarkEntry,
} from '../../utils/quranStorage';
import type { UseQuranDataReturn } from './quranTypes';

/**
 * Manages Quran screen data: surah list, preferences, search, bookmarks,
 * fonts, theme derivations, and position tracking.
 *
 * Does NOT manage audio or surah content loading (openSurah / goBack
 * are coordinators left in the component).
 */
export function useQuranData(): UseQuranDataReturn {
    const { colors, isDark } = useTheme();
    const { t, language } = useLanguage();

    // ── Navigation ───────────────────────────────────────────────
    const [mode, setMode] = useState<ViewMode>('list');

    // ── List ─────────────────────────────────────────────────────
    const [surahList, setSurahList] = useState<SurahMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Reading state (set by component's openSurah coordinator) ─
    const [currentSurahAr, setCurrentSurahAr] = useState<SurahData | null>(null);
    const [currentSurahTr, setCurrentSurahTr] = useState<SurahData | null>(null);
    const [surahLoading, setSurahLoading] = useState(false);

    // ── Preferences ──────────────────────────────────────────────
    const [editionPref, setEditionPref] = useState<EditionPref>('both');
    const [translationEdition, setTranslationEditionState] = useState<string>(EDITIONS.ENGLISH);
    const [fontScale, setFontScaleState] = useState(1.2);
    const [reciterEdition, setReciterEdition] = useState<string>(EDITIONS.DEFAULT_RECITER);
    const [autoScrollWithAudio, setAutoScrollWithAudio] = useState(true);

    // ── Bookmark & last read ─────────────────────────────────────
    const [lastRead, setLastReadState] = useState<LastReadEntry | null>(null);
    const [bookmarkEntry, setBookmarkEntryState] = useState<BookmarkEntry | null>(null);

    // ── Fonts ────────────────────────────────────────────────────
    const [quranFontFamily, setQuranFontFamilyState] = useState<QuranFontFamily>('default');
    const [fontsLoaded, setFontsLoaded] = useState(false);

    // ── Search ───────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
    const [searching, setSearching] = useState(false);
    const [lastSearchQuery, setLastSearchQuery] = useState('');

    // ── Settings hint ────────────────────────────────────────────
    const [showSettingsHint, setShowSettingsHint] = useState(false);

    // ── Refs ─────────────────────────────────────────────────────
    const trBismillahRef = useRef<string | null>(null);
    const arBismillahRef = useRef<string | null>(null);
    const topVisibleAyahRef = useRef(0);
    const scrollToAyahRef = useRef<number | null>(null);
    const searchInputRef = useRef<TextInput>(null);

    // Internal ref to access current surah in AppState / focus handlers
    const currentSurahArInternalRef = useRef<SurahData | null>(null);
    useEffect(() => { currentSurahArInternalRef.current = currentSurahAr; }, [currentSurahAr]);

    // ── Theme derivations ────────────────────────────────────────
    const getTimeBasedGradient = (): [string, string, string] => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 7)
            return [colors.background.primary, colors.background.secondary, colors.surface.secondary];
        if (hour >= 7 && hour < 12)
            return [colors.background.primary, colors.surface.elevated, colors.background.tertiary];
        if (hour >= 12 && hour < 15)
            return [colors.surface.elevated, colors.background.secondary, colors.surface.secondary];
        if (hour >= 15 && hour < 18)
            return [colors.background.secondary, colors.background.tertiary, colors.surface.secondary];
        if (hour >= 18 && hour < 20)
            return [colors.background.tertiary, colors.surface.secondary, colors.background.tertiary];
        return [colors.surface.secondary, colors.background.tertiary, colors.surface.secondary];
    };
    const gradientColors: [string, string, string] = isDark
        ? [colors.background.primary, colors.background.secondary, colors.surface.primary]
        : getTimeBasedGradient();

    const goldTint = (opacity: number) => centralGoldTint(opacity, colors);
    const cardBg = isDark ? 'rgba(255,255,255,0.038)' : colors.background.secondary;
    const subtleBorder = isDark ? goldTint(0.25) : goldTint(0.15);
    const faintBorder = isDark ? goldTint(0.18) : goldTint(0.10);

    // ── Scaled font sizes ────────────────────────────────────────
    const fs = useMemo(() => ({
        ayahArabic: Math.round(24 * fontScale),
        ayahArabicLH: Math.round(42 * fontScale),
        ayahTranslation: Math.round(16 * fontScale),
        ayahTranslationLH: Math.round(26 * fontScale),
        bismillah: Math.round(28 * fontScale),
        surahHeaderArabic: Math.round(28 * fontScale),
        surahHeaderEnglish: Math.round(16 * fontScale),
    }), [fontScale]);

    // ── Resolved font family for Arabic text ─────────────────────
    const arabicFontFamily = useMemo(() => {
        if (!fontsLoaded || quranFontFamily === 'default') return undefined;
        return quranFontFamily;
    }, [quranFontFamily, fontsLoaded]);

    // ── Ayah reference pattern detector (e.g. "2:14") ────────────
    const ayahRefMatch = useMemo(() => {
        const q = searchQuery.trim();
        const m = q.match(/^(\d{1,3})\s*:\s*(\d{1,3})$/);
        if (!m) return null;
        const surahNum = parseInt(m[1], 10);
        const ayahNum = parseInt(m[2], 10);
        if (surahNum < 1 || surahNum > 114 || ayahNum < 1) return null;
        const surah = surahList.find(s => s.number === surahNum);
        if (!surah) return null;
        if (ayahNum > surah.numberOfAyahs) return null;
        return { surahNum, ayahNum, surah };
    }, [searchQuery, surahList]);

    // ── Filtered surah list (real-time local search with fuzzy matching) ──
    const filteredSurahList = useMemo(() => {
        const q = searchQuery.trim().toLowerCase().replace(/[-']/g, '');
        if (!q) return surahList;

        const num = parseInt(q, 10);
        if (!isNaN(num) && num >= 1 && num <= 114) {
            return surahList.filter(s => s.number === num);
        }

        const aliasHits = new Set<number>();
        for (const [alias, numbers] of Object.entries(SURAH_ALIASES)) {
            if (alias.includes(q) || q.includes(alias)) {
                numbers.forEach(n => aliasHits.add(n));
            }
        }

        return surahList.filter(s => {
            const engNorm = s.englishName.toLowerCase().replace(/[-']/g, '');
            const trNorm = s.englishNameTranslation.toLowerCase().replace(/[-']/g, '');
            return engNorm.includes(q) || trNorm.includes(q) || aliasHits.has(s.number);
        });
    }, [surahList, searchQuery]);

    // ── Init: load surah list + all prefs ────────────────────────
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [list, pref, scale, trEd, recPref, autoScrollPref, hintDismissed, lastReadEntry, fontFamPref, bookmarkData] = await Promise.all([
                    getSurahListCached(),
                    getEditionPref(),
                    getQuranFontScale(),
                    getTranslationEdition(),
                    getReciterPref(),
                    getQuranAutoScrollWithAudio(),
                    isSettingsHintDismissed(),
                    getLastRead(),
                    getQuranFontFamily(),
                    getBookmark(),
                ]);
                setSurahList(list);
                setEditionPref(pref);
                setFontScaleState(scale);
                setTranslationEditionState(trEd);
                setReciterEdition(recPref);
                setAutoScrollWithAudio(autoScrollPref);
                setShowSettingsHint(!hintDismissed);
                setLastReadState(lastReadEntry);
                setQuranFontFamilyState(fontFamPref);
                setBookmarkEntryState(bookmarkData);

                // Load custom fonts
                try {
                    await Font.loadAsync({
                        'Amiri': require('../../assets/fonts/Amiri-Regular.ttf'),
                        'Amiri-Bold': require('../../assets/fonts/Amiri-Bold.ttf'),
                        'ScheherazadeNew': require('../../assets/fonts/ScheherazadeNew-Regular.ttf'),
                    });
                    setFontsLoaded(true);
                } catch {
                    setFontsLoaded(true);
                }
            } catch (e: any) {
                setError(e.message ?? 'Failed to load surah list');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ── Refresh prefs when screen comes into focus ────────────────
    useFocusEffect(
        useCallback(() => {
            (async () => {
                try {
                    const [scale, pref, trEd, recPref, autoScrollPref, fontFamPref, bookmarkData] = await Promise.all([
                        getQuranFontScale(),
                        getEditionPref(),
                        getTranslationEdition(),
                        getReciterPref(),
                        getQuranAutoScrollWithAudio(),
                        getQuranFontFamily(),
                        getBookmark(),
                    ]);
                    setFontScaleState(scale);
                    setEditionPref(pref);
                    setTranslationEditionState(trEd);
                    setReciterEdition(recPref);
                    setAutoScrollWithAudio(autoScrollPref);
                    setQuranFontFamilyState(fontFamPref);
                    setBookmarkEntryState(bookmarkData);
                } catch { }
            })();

            // Save reading position when tab loses focus
            return () => {
                const arData = currentSurahArInternalRef.current;
                if (arData) {
                    const entry: LastReadEntry = {
                        surahNumber: arData.number,
                        surahName: arData.englishName,
                        surahNameArabic: arData.name,
                        ayahIndex: topVisibleAyahRef.current,
                        timestamp: Date.now(),
                    };
                    setLastRead(entry).catch(() => { });
                }
            };
        }, [])
    );

    // ── Save reading position when app goes to background ────────
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'background' || nextState === 'inactive') {
                const arData = currentSurahArInternalRef.current;
                if (arData) {
                    const entry: LastReadEntry = {
                        surahNumber: arData.number,
                        surahName: arData.englishName,
                        surahNameArabic: arData.name,
                        ayahIndex: topVisibleAyahRef.current,
                        timestamp: Date.now(),
                    };
                    setLastRead(entry).catch(() => { });
                }
            }
        });
        return () => subscription.remove();
    }, []);

    // ── Retry loading surah list ─────────────────────────────────
    const retryLoadSurahList = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [list, lastReadEntry] = await Promise.all([
                getSurahListCached(),
                getLastRead(),
            ]);
            setSurahList(list);
            setLastReadState(lastReadEntry);
        } catch (e: any) {
            setError(e.message ?? 'Failed to load surah list');
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Search: dismiss keyboard ─────────────────────────────────
    const runSearch = useCallback(() => {
        Keyboard.dismiss();
    }, []);

    // ── Dismiss settings hint ────────────────────────────────────
    const handleDismissHint = useCallback(() => {
        setShowSettingsHint(false);
        dismissSettingsHint();
    }, []);

    return {
        mode, setMode,
        surahList, loading, error,
        currentSurahAr, setCurrentSurahAr,
        currentSurahTr, setCurrentSurahTr,
        surahLoading, setSurahLoading,
        editionPref, setEditionPref,
        translationEdition, fontScale,
        reciterEdition, autoScrollWithAudio,
        lastRead, setLastReadState,
        bookmarkEntry, setBookmarkEntryState,
        fontsLoaded, arabicFontFamily, fs,
        searchQuery, setSearchQuery,
        searchResults, setSearchResults,
        searching, lastSearchQuery, setLastSearchQuery,
        filteredSurahList, ayahRefMatch,
        showSettingsHint,
        gradientColors, goldTint, cardBg, subtleBorder, faintBorder,
        colors, isDark,
        trBismillahRef, arBismillahRef,
        topVisibleAyahRef, scrollToAyahRef,
        searchInputRef,
        t, language,
        retryLoadSurahList, runSearch,
        handleDismissHint,
    };
}
