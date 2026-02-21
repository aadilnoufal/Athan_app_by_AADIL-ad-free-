import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Alert,
    Platform,
    StatusBar,
    ScrollView,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    SurahMeta,
    SurahData,
    Ayah,
    EditionInfo,
    fetchSurah,
    fetchSurahWithTranslation,
    searchQuran,
    fetchSurahAudio,
    EDITIONS,
    SearchMatch,
} from '../../lib/quranApi';
import {
    getSurahListCached,
    downloadSurah,
    readOfflineSurah,
    deleteSurah,
    getEditionPref,
    EditionPref,
    getDownloadIndex,
    getQuranFontScale,
    getQuranAutoScrollWithAudio,
    getTranslationEdition,
    getReciterPref,
    isSettingsHintDismissed,
    dismissSettingsHint,
    isSurahAudioDownloaded,
    downloadSurahAudio,
    getLocalAudioUri,
    getBismillahText,
} from '../../utils/quranStorage';

/* ================================================================
   VIEW MODES:
     'list'   – surah catalogue (default)
     'read'   – reading a single surah
     'search' – search results
   ================================================================ */

type ViewMode = 'list' | 'read' | 'search';

/* ── Bismillah text constants for stripping from first ayah ──── */
const BISMILLAH_AR = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
const BISMILLAH_AR_ALT = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ';
const BISMILLAH_EN_PREFIX = 'In the name of Allah';

/**
 * Strip leading Bismillah from ayah 1 text for surahs 2-113 (except 9).
 * The API includes it in the text but we render a separate styled banner.
 *
 * @param lang 'ar' for Arabic, 'tr' for any translation
 * @param knownBismillah Cached bismillah text for the translation edition (surah 1 ayah 1)
 */
function stripBismillah(text: string, lang: 'ar' | 'tr', knownBismillah?: string): string {
    if (lang === 'ar') {
        for (const prefix of [BISMILLAH_AR, BISMILLAH_AR_ALT]) {
            if (text.startsWith(prefix)) {
                return text.slice(prefix.length).trim();
            }
        }
        // Fuzzy fallback: strip up to and including ٱلرَّحِيمِ
        const rhm = text.indexOf('ٱلرَّحِيمِ');
        if (rhm !== -1 && rhm < 60) {
            return text.slice(rhm + 'ٱلرَّحِيمِ'.length).trim();
        }
        return text;
    }

    // --- Translation stripping ---

    // 1. Universal: use cached bismillah text from the translation edition
    if (knownBismillah) {
        const trimmed = knownBismillah.trim();
        if (text.startsWith(trimmed)) {
            const stripped = text.slice(trimmed.length).trim();
            if (stripped.length > 0) return stripped;
        }
        // Tolerate trailing punctuation / whitespace differences
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefixRe = new RegExp('^' + escaped + '[.\\s,;:\\-!]*\\s*');
        const km = text.match(prefixRe);
        if (km) {
            const stripped = text.slice(km[0].length).trim();
            if (stripped.length > 0) return stripped;
        }
    }

    // 2. Fallback: English patterns
    if (text.toLowerCase().startsWith(BISMILLAH_EN_PREFIX.toLowerCase())) {
        const patterns = [
            /^In the name of Allah[,.]?\s*the\s*(Most\s*)?Gracious[,.]?\s*the\s*(Most\s*)?Merciful[.\s-]*/i,
            /^In the name of Allah[,.]?\s*the\s*Entirely\s*Merciful[,.]?\s*the\s*Especially\s*Merciful[.\s-]*/i,
            /^In the name of God[,.]?\s*the\s*Gracious[,.]?\s*the\s*Merciful[.\s-]*/i,
            /^In the name of Allah[,.]?\s*the\s*Beneficent[,.]?\s*the\s*Merciful[.\s-]*/i,
            /^In\s*\(the\)\s*name of Allah[,.]?\s*the\s*Beneficent[,.]?\s*the\s*Merciful[.\s-]*/i,
        ];
        for (const re of patterns) {
            const m = text.match(re);
            if (m) return text.slice(m[0].length).trim();
        }
    }
    return text;
}

export default function QuranScreen() {
    const { colors, isDark } = useTheme();
    const { t, language } = useLanguage();
    const tabBarHeight = useBottomTabBarHeight();

    // ── State ──────────────────────────────────────────────────────
    const [mode, setMode] = useState<ViewMode>('list');
    const [surahList, setSurahList] = useState<SurahMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Reading state
    const [currentSurahAr, setCurrentSurahAr] = useState<SurahData | null>(null);
    const [currentSurahTr, setCurrentSurahTr] = useState<SurahData | null>(null);
    const [surahLoading, setSurahLoading] = useState(false);

    // Edition preference (arabic | both)
    const [editionPref, setEditionPref] = useState<EditionPref>('both');

    // Translation edition & font scale
    const [translationEdition, setTranslationEditionState] = useState<string>(EDITIONS.ENGLISH);
    const [fontScale, setFontScaleState] = useState(1.0);

    // Offline index (surah numbers that are downloaded)
    const [downloadedSet, setDownloadedSet] = useState<Set<number>>(new Set());
    const [downloadingSurah, setDownloadingSurah] = useState<number | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
    const [searching, setSearching] = useState(false);
    const [lastSearchQuery, setLastSearchQuery] = useState('');

    // Settings hint
    const [showSettingsHint, setShowSettingsHint] = useState(false);

    // Audio player state
    const [audioSurahData, setAudioSurahData] = useState<SurahData | null>(null);
    const [currentAyahIndex, setCurrentAyahIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioLoading, setAudioLoading] = useState(false);
    const [reciterEdition, setReciterEdition] = useState<string>(EDITIONS.DEFAULT_RECITER);
    const [audioDownloaded, setAudioDownloaded] = useState(false);
    const [audioDownloading, setAudioDownloading] = useState(false);
    const [audioDownloadProgress, setAudioDownloadProgress] = useState({ downloaded: 0, total: 0 });
    const [autoScrollWithAudio, setAutoScrollWithAudio] = useState(true);

    const scrollRef = useRef<ScrollView>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const searchInputRef = useRef<TextInput>(null);

    // ── Refs for stable audio callbacks (avoids stale closures) ──
    const currentAyahIndexRef = useRef(-1);
    const isPlayingLockRef = useRef(false);  // prevents re-entrant playAyah
    const currentSurahArRef = useRef<SurahData | null>(null);
    const audioSurahDataRef = useRef<SurahData | null>(null);
    const audioDownloadedRef = useRef(false);
    const reciterEditionRef = useRef<string>(EDITIONS.DEFAULT_RECITER);

    // Keep refs in sync with state
    useEffect(() => { currentSurahArRef.current = currentSurahAr; }, [currentSurahAr]);
    useEffect(() => { audioSurahDataRef.current = audioSurahData; }, [audioSurahData]);
    useEffect(() => { audioDownloadedRef.current = audioDownloaded; }, [audioDownloaded]);
    useEffect(() => { reciterEditionRef.current = reciterEdition; }, [reciterEdition]);

    // ── Ayah position tracking for auto-scroll ───────────────────
    const ayahLayoutsRef = useRef<Record<number, number>>({});
    const autoScrollEnabled = useRef(true);
    const autoScrollResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trBismillahRef = useRef<string | null>(null);

    // ── Time-based gradient (consistent with other tabs) ───────────
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
            return [colors.background.tertiary, colors.surface.secondary, '#F5F1E6'];
        return [colors.surface.secondary, colors.surface.secondary, '#F2EEE1'];
    };
    const gradientColors: [string, string, string] = isDark
        ? [colors.background.primary, colors.background.secondary, colors.surface.primary]
        : getTimeBasedGradient();

    // ── Colour helpers (gold-tint pattern from other screens) ──────
    const goldTint = (opacity: number) => `rgba(218, 165, 32, ${opacity})`;
    const cardBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.06)';
    const subtleBorder = isDark ? goldTint(0.25) : goldTint(0.15);
    const faintBorder = isDark ? goldTint(0.18) : goldTint(0.10);

    // ── Scaled font sizes ──────────────────────────────────────────
    const fs = useMemo(() => ({
        ayahArabic: Math.round(24 * fontScale),
        ayahArabicLH: Math.round(42 * fontScale),
        ayahTranslation: Math.round(16 * fontScale),
        ayahTranslationLH: Math.round(26 * fontScale),
        bismillah: Math.round(28 * fontScale),
        surahHeaderArabic: Math.round(28 * fontScale),
        surahHeaderEnglish: Math.round(16 * fontScale),
    }), [fontScale]);

    // ── Init: load surah list + download index + all prefs ─────────
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [list, pref, idx, scale, trEd, recPref, autoScrollPref, hintDismissed] = await Promise.all([
                    getSurahListCached(),
                    getEditionPref(),
                    getDownloadIndex(),
                    getQuranFontScale(),
                    getTranslationEdition(),
                    getReciterPref(),
                    getQuranAutoScrollWithAudio(),
                    isSettingsHintDismissed(),
                ]);
                setSurahList(list);
                setEditionPref(pref);
                setDownloadedSet(new Set(Object.keys(idx.surahs).map(Number)));
                setFontScaleState(scale);
                setTranslationEditionState(trEd);
                setReciterEdition(recPref);
                setAutoScrollWithAudio(autoScrollPref);
                autoScrollEnabled.current = autoScrollPref;
                setShowSettingsHint(!hintDismissed);
            } catch (e: any) {
                setError(e.message ?? 'Failed to load surah list');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ── Refresh font scale + prefs when screen comes into focus ──
    useFocusEffect(
        useCallback(() => {
            (async () => {
                try {
                    const [scale, pref, trEd, recPref, autoScrollPref] = await Promise.all([
                        getQuranFontScale(),
                        getEditionPref(),
                        getTranslationEdition(),
                        getReciterPref(),
                        getQuranAutoScrollWithAudio(),
                    ]);
                    setFontScaleState(scale);
                    setEditionPref(pref);
                    setTranslationEditionState(trEd);
                    setReciterEdition(recPref);
                    setAutoScrollWithAudio(autoScrollPref);
                    autoScrollEnabled.current = autoScrollPref;
                } catch { }
            })();
        }, [])
    );

    // ── Audio mode setup ──────────────────────────────────────────
    useEffect(() => {
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
        }).catch(() => { });
        return () => {
            soundRef.current?.unloadAsync().catch(() => { });
        };
    }, []);

    // ── Refresh download set after an action ─────────────────────
    const refreshDownloadIndex = useCallback(async () => {
        const idx = await getDownloadIndex();
        setDownloadedSet(new Set(Object.keys(idx.surahs).map(Number)));
    }, []);

    // ── Open a surah for reading ──────────────────────────────────
    const openSurah = useCallback(
        async (surahNumber: number) => {
            setSurahLoading(true);
            setMode('read');
            setCurrentSurahAr(null);
            setCurrentSurahTr(null);
            trBismillahRef.current = null;
            // Stop any playing audio
            stopAudio();

            try {
                // Pre-fetch bismillah text for stripping (runs in parallel)
                const bismillahPromise = (surahNumber !== 1 && surahNumber !== 9)
                    ? getBismillahText(translationEdition).catch(() => null)
                    : Promise.resolve(null);

                // Try offline Arabic first
                const offlineAr = await readOfflineSurah(surahNumber, 'ar');

                if (offlineAr) {
                    setCurrentSurahAr(offlineAr);

                    // For translation: use offline only if user's edition is
                    // the default English (which is what downloadSurah stores).
                    // Otherwise fetch the chosen translation online.
                    let trData: SurahData | null = null;
                    if (translationEdition === EDITIONS.ENGLISH) {
                        trData = await readOfflineSurah(surahNumber, 'en');
                    } else {
                        try {
                            trData = await fetchSurah(surahNumber, translationEdition);
                        } catch {
                            // Fallback to offline English if network fails
                            trData = await readOfflineSurah(surahNumber, 'en');
                        }
                    }
                    setCurrentSurahTr(trData);
                    trBismillahRef.current = await bismillahPromise;
                    setSurahLoading(false);
                    checkAudioStatus(surahNumber);
                    return;
                }

                // Fetch online with user's chosen translation edition
                const [[ar, tr], bismillah] = await Promise.all([
                    fetchSurahWithTranslation(surahNumber, translationEdition),
                    bismillahPromise,
                ]);
                trBismillahRef.current = bismillah;
                setCurrentSurahAr(ar);
                setCurrentSurahTr(tr);
                checkAudioStatus(surahNumber);
            } catch (e: any) {
                Alert.alert(t('error'), e.message ?? t('connectionErrorMessage'));
                setMode('list');
            } finally {
                setSurahLoading(false);
            }
        },
        [t, translationEdition],
    );

    // ── Check if audio is downloaded for current surah ────────────
    const checkAudioStatus = useCallback(async (surahNumber: number) => {
        try {
            const downloaded = await isSurahAudioDownloaded(surahNumber, reciterEdition);
            setAudioDownloaded(downloaded);
        } catch {
            setAudioDownloaded(false);
        }
    }, [reciterEdition]);

    // ── Download a single surah ───────────────────────────────────
    const handleDownloadSurah = useCallback(
        async (surahNumber: number) => {
            setDownloadingSurah(surahNumber);
            try {
                await downloadSurah(surahNumber);
                await refreshDownloadIndex();
            } catch (e: any) {
                Alert.alert(t('downloadFailed'), t('downloadFailedMsg'));
            } finally {
                setDownloadingSurah(null);
            }
        },
        [t, refreshDownloadIndex],
    );

    // ── Remove offline copy of a surah ────────────────────────────
    const handleDeleteSurah = useCallback(
        (surahNumber: number) => {
            Alert.alert(t('deleteDownload'), `${t('confirm')}?`, [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        await deleteSurah(surahNumber);
                        await refreshDownloadIndex();
                    },
                },
            ]);
        },
        [t, refreshDownloadIndex],
    );

    // ── Search (fixed: don't switch mode until results arrive) ────
    const runSearch = useCallback(async () => {
        const q = searchQuery.trim();
        if (q.length < 3) return;
        Keyboard.dismiss();
        setSearching(true);
        setLastSearchQuery(q);
        try {
            const result = await searchQuran(q, EDITIONS.ENGLISH);
            setSearchResults(result.matches ?? []);
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
            setMode('search');
        }
    }, [searchQuery]);

    // ── Go back to list ───────────────────────────────────────────
    const goBack = useCallback(() => {
        stopAudio();
        setMode('list');
        setCurrentSurahAr(null);
        setCurrentSurahTr(null);
        setSearchResults([]);
        setSearchQuery('');
        setLastSearchQuery('');
        setAudioSurahData(null);
        setCurrentAyahIndex(-1);
        currentAyahIndexRef.current = -1;
        audioSurahDataRef.current = null;
        currentSurahArRef.current = null;
        ayahLayoutsRef.current = {};
    }, []);

    // ── Dismiss settings hint ─────────────────────────────────────
    const handleDismissHint = useCallback(() => {
        setShowSettingsHint(false);
        dismissSettingsHint();
    }, []);

    // ── Audio: stop playback ─────────────────────────────────────
    const stopAudio = useCallback(async () => {
        isPlayingLockRef.current = false;
        try {
            if (soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }
        } catch { }
        setIsPlaying(false);
        setCurrentAyahIndex(-1);
        currentAyahIndexRef.current = -1;
    }, []);

    // ── Audio: play a specific ayah (ref-based, no stale closures) ─
    const playAyah = useCallback(async (ayahIndex: number) => {
        const surah = currentSurahArRef.current;
        if (!surah) return;
        const ayah = surah.ayahs[ayahIndex];
        if (!ayah) return;

        // Guard against re-entrant calls (e.g. didJustFinish firing twice)
        if (isPlayingLockRef.current) return;
        isPlayingLockRef.current = true;

        setAudioLoading(true);
        setCurrentAyahIndex(ayahIndex);
        currentAyahIndexRef.current = ayahIndex;

        try {
            // Unload any previous sound
            if (soundRef.current) {
                try {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                } catch { }
                soundRef.current = null;
            }

            // Try local file first
            let uri: string | null = null;
            if (audioDownloadedRef.current) {
                uri = await getLocalAudioUri(reciterEditionRef.current, ayah.number);
            }

            // If no local file, fetch audio data and use remote URL
            if (!uri) {
                let audioData = audioSurahDataRef.current;
                if (!audioData) {
                    audioData = await fetchSurahAudio(surah.number, reciterEditionRef.current);
                    setAudioSurahData(audioData);
                    audioSurahDataRef.current = audioData;
                }
                uri = audioData.ayahs[ayahIndex]?.audio ?? null;
            }

            if (!uri) {
                Alert.alert(t('audioError'), t('audioErrorMsg'));
                setAudioLoading(false);
                isPlayingLockRef.current = false;
                return;
            }

            // Track whether this instance has already triggered advance
            let didAdvance = false;

            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded && status.didJustFinish && !didAdvance) {
                        didAdvance = true; // prevent double-fire
                        const currentIdx = currentAyahIndexRef.current;
                        const surahNow = currentSurahArRef.current;
                        const nextIdx = currentIdx + 1;

                        if (surahNow && nextIdx < surahNow.ayahs.length) {
                            // Release lock so next ayah can play
                            isPlayingLockRef.current = false;
                            playAyah(nextIdx);
                        } else {
                            // End of surah
                            isPlayingLockRef.current = false;
                            setIsPlaying(false);
                            setCurrentAyahIndex(-1);
                            currentAyahIndexRef.current = -1;
                        }
                    }
                }
            );
            soundRef.current = sound;
            setIsPlaying(true);
        } catch (e: any) {
            Alert.alert(t('audioError'), t('audioErrorMsg'));
        } finally {
            setAudioLoading(false);
            isPlayingLockRef.current = false;
        }
    }, [t]);  // Only depends on t — everything else is read from refs

    // ── Audio: toggle play / pause ────────────────────────────────
    const togglePlayPause = useCallback(async () => {
        if (!soundRef.current) {
            // Start from beginning or from current if paused at a position
            const startIdx = currentAyahIndexRef.current >= 0 ? currentAyahIndexRef.current : 0;
            playAyah(startIdx);
            return;
        }
        try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded) {
                if (status.isPlaying) {
                    await soundRef.current.pauseAsync();
                    setIsPlaying(false);
                } else {
                    await soundRef.current.playAsync();
                    setIsPlaying(true);
                }
            }
        } catch {
            playAyah(0);
        }
    }, [playAyah]);

    // ── Audio: prev / next ────────────────────────────────────────
    const playPrevAyah = useCallback(() => {
        const idx = currentAyahIndexRef.current;
        if (idx > 0) playAyah(idx - 1);
    }, [playAyah]);

    const playNextAyah = useCallback(() => {
        const idx = currentAyahIndexRef.current;
        const surah = currentSurahArRef.current;
        if (surah && idx < surah.ayahs.length - 1) {
            playAyah(idx + 1);
        }
    }, [playAyah]);

    // ── Auto-scroll when current ayah changes ─────────────────────
    useEffect(() => {
        if (!autoScrollWithAudio) {
            autoScrollEnabled.current = false;
            return;
        }
        autoScrollEnabled.current = true;
    }, [autoScrollWithAudio]);

    useEffect(() => {
        ayahLayoutsRef.current = {};
        if (autoScrollResumeTimeoutRef.current) {
            clearTimeout(autoScrollResumeTimeoutRef.current);
            autoScrollResumeTimeoutRef.current = null;
        }
    }, [currentSurahAr?.number]);

    useEffect(() => {
        return () => {
            if (autoScrollResumeTimeoutRef.current) {
                clearTimeout(autoScrollResumeTimeoutRef.current);
                autoScrollResumeTimeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (currentAyahIndex >= 0 && autoScrollEnabled.current && scrollRef.current) {
            const scrollToCurrentAyah = () => {
                const y = ayahLayoutsRef.current[currentAyahIndex];
                if (typeof y !== 'number') return false;
                const offset = Math.max(0, y - 12);
                scrollRef.current?.scrollTo({ y: offset, animated: true });
                return true;
            };

            if (!scrollToCurrentAyah()) {
                const retry = setTimeout(scrollToCurrentAyah, 90);
                return () => clearTimeout(retry);
            }
        }
    }, [currentAyahIndex, currentSurahAr?.number]);

    // ── Scroll to currently playing ayah (manual trigger) ─────────
    const scrollToCurrentAyah = useCallback(() => {
        const idx = currentAyahIndexRef.current;
        if (idx >= 0 && scrollRef.current) {
            const y = ayahLayoutsRef.current[idx];
            if (typeof y === 'number') {
                autoScrollEnabled.current = true;
                scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
            }
        }
    }, []);

    // ── Audio: download surah audio ───────────────────────────────
    const handleDownloadAudio = useCallback(async () => {
        if (!currentSurahAr) return;
        setAudioDownloading(true);
        setAudioDownloadProgress({ downloaded: 0, total: currentSurahAr.numberOfAyahs });
        try {
            // Ensure we have audio data cached for playback later
            if (!audioSurahData) {
                const audioData = await fetchSurahAudio(currentSurahAr.number, reciterEdition);
                setAudioSurahData(audioData);
            }
            await downloadSurahAudio(
                currentSurahAr.number,
                reciterEdition,
                (downloaded: number, total: number) => setAudioDownloadProgress({ downloaded, total })
            );
            setAudioDownloaded(true);
        } catch (e: any) {
            Alert.alert(t('downloadFailed'), t('audioErrorMsg'));
        } finally {
            setAudioDownloading(false);
        }
    }, [currentSurahAr, audioSurahData, reciterEdition, t]);

    // ── Format helpers ────────────────────────────────────────────
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ================================================================
    //  SUB-COMPONENTS
    // ================================================================

    /* ── Header ──────────────────────────────────────────────────── */
    const renderHeader = () => (
        <View style={s.headerRow}>
            {mode !== 'list' && (
                <TouchableOpacity onPress={goBack} style={[s.backBtn, { backgroundColor: colors.surface.secondary, borderColor: colors.border.light }]}>
                    <MaterialCommunityIcons name="arrow-left" size={20} color={colors.accent.gold} />
                </TouchableOpacity>
            )}
            <Text style={[s.headerTitle, { color: colors.text.primary }]}>
                {mode === 'read' && currentSurahAr
                    ? currentSurahAr.englishName
                    : mode === 'search'
                        ? lastSearchQuery
                            ? `${t('searchResultsFor')} "${lastSearchQuery}"`
                            : t('searchQuran').replace('...', '')
                        : t('quranTitle')}
            </Text>
            {mode === 'list' && <View style={{ width: 32 }} />}
        </View>
    );

    /* ── Search Bar ─────────────────────────────────────────────── */
    const renderSearchBar = () => (
        <View style={[s.searchContainer, { backgroundColor: cardBg, borderColor: faintBorder }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.text.tertiary} />
            <TextInput
                ref={searchInputRef}
                style={[s.searchInput, { color: colors.text.primary }]}
                placeholder={t('searchQuran')}
                placeholderTextColor={colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={runSearch}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                blurOnSubmit={false}
            />
            {searching && <ActivityIndicator size="small" color={colors.accent.gold} style={{ marginRight: 6 }} />}
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setLastSearchQuery(''); if (mode === 'search') goBack(); }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
            )}
        </View>
    );

    /* ── Settings Hint Banner ──────────────────────────────────── */
    const renderSettingsHintBanner = () => {
        if (!showSettingsHint) return null;
        return (
            <View style={[s.hintBanner, { backgroundColor: goldTint(isDark ? 0.10 : 0.08), borderColor: goldTint(0.25) }]}>
                <MaterialCommunityIcons name="cog-outline" size={16} color={colors.accent.gold} style={{ marginRight: 8 }} />
                <Text style={[s.hintText, { color: colors.text.secondary }]} numberOfLines={2}>
                    {t('quranSettingsHintShort')}
                </Text>
                <TouchableOpacity onPress={handleDismissHint} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="close" size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
            </View>
        );
    };

    /* ── Surah List Item ────────────────────────────────────────── */
    const SurahListItem = ({ item }: { item: SurahMeta }) => {
        const isDownloaded = downloadedSet.has(item.number);
        const isDownloading = downloadingSurah === item.number;

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => openSurah(item.number)}
                style={[s.surahCard, { backgroundColor: cardBg, borderColor: subtleBorder }]}
            >
                {/* Surah number badge */}
                <View style={[s.surahNumberBadge, { backgroundColor: goldTint(isDark ? 0.12 : 0.10) }]}>
                    <Text style={[s.surahNumber, { color: colors.accent.gold }]}>{item.number}</Text>
                </View>

                {/* Name block */}
                <View style={s.surahInfo}>
                    <Text style={[s.surahEnglishName, { color: colors.text.primary }]}>{item.englishName}</Text>
                    <Text style={[s.surahTranslation, { color: colors.text.secondary }]}>
                        {item.englishNameTranslation} · {item.numberOfAyahs} {t('verses')}
                    </Text>
                </View>

                {/* Arabic name */}
                <Text style={[s.surahArabicName, { color: colors.text.primary }]}>{item.name}</Text>

                {/* Download / offline indicator */}
                <View style={s.surahActions}>
                    {isDownloading ? (
                        <ActivityIndicator size="small" color={colors.accent.gold} />
                    ) : isDownloaded ? (
                        <TouchableOpacity
                            onPress={() => handleDeleteSurah(item.number)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialCommunityIcons name="check-circle" size={20} color={colors.accent.gold} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => handleDownloadSurah(item.number)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialCommunityIcons name="download-outline" size={20} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    /* ── Floating Audio Player Popup ──────────────────────────── */
    const renderFloatingAudioPlayer = () => {
        if (mode !== 'read' || !currentSurahAr) return null;
        const hasAudio = currentAyahIndex >= 0;

        return (
            <View style={[s.floatingAudioPopup, {
                bottom: tabBarHeight + 8,
                backgroundColor: isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.97)',
                borderColor: goldTint(0.35),
                shadowColor: isDark ? '#000' : goldTint(0.3),
            }]}>
                {/* Now-playing info row */}
                <View style={s.floatingTopRow}>
                    <MaterialCommunityIcons name="music-note" size={14} color={colors.accent.gold} />
                    <Text style={[s.floatingNowPlayingText, { color: colors.text.secondary }]} numberOfLines={1}>
                        {hasAudio
                            ? `${t('nowPlaying')} · ${t('verses')} ${currentAyahIndex + 1} / ${currentSurahAr.ayahs.length}`
                            : t('tapAyahToPlay')
                        }
                    </Text>
                    {/* Stop / close button — only show when playing */}
                    {hasAudio && (
                        <TouchableOpacity onPress={stopAudio} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <MaterialCommunityIcons name="close" size={18} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Controls row */}
                <View style={s.floatingControlsRow}>
                    {/* Download indicator */}
                    {audioDownloading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
                            <ActivityIndicator size="small" color={colors.accent.gold} />
                            <Text style={{ color: colors.text.secondary, fontSize: 10, marginLeft: 3 }}>
                                {audioDownloadProgress.downloaded}/{audioDownloadProgress.total}
                            </Text>
                        </View>
                    ) : !audioDownloaded ? (
                        <TouchableOpacity onPress={handleDownloadAudio} style={s.floatingIconBtn} activeOpacity={0.7}>
                            <MaterialCommunityIcons name="download-outline" size={20} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    ) : (
                        <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.accent.gold} style={{ marginRight: 4 }} />
                    )}

                    {/* Stop */}
                    <TouchableOpacity onPress={stopAudio} style={s.floatingIconBtn} disabled={!hasAudio} activeOpacity={0.7}>
                        <MaterialCommunityIcons name="stop-circle-outline" size={22} color={hasAudio ? colors.text.primary : colors.text.tertiary} />
                    </TouchableOpacity>

                    {/* Prev */}
                    <TouchableOpacity onPress={playPrevAyah} style={s.floatingIconBtn} disabled={currentAyahIndex <= 0} activeOpacity={0.7}>
                        <MaterialCommunityIcons name="skip-previous" size={26} color={currentAyahIndex > 0 ? colors.text.primary : colors.text.tertiary} />
                    </TouchableOpacity>

                    {/* Play / Pause (main) */}
                    <TouchableOpacity onPress={togglePlayPause} style={[s.floatingPlayBtn, { backgroundColor: colors.accent.gold }]} activeOpacity={0.8}>
                        {audioLoading ? (
                            <ActivityIndicator size="small" color={colors.text.inverse} />
                        ) : (
                            <MaterialCommunityIcons
                                name={isPlaying ? 'pause' : 'play'}
                                size={28}
                                color={colors.text.inverse}
                            />
                        )}
                    </TouchableOpacity>

                    {/* Next */}
                    <TouchableOpacity onPress={playNextAyah} style={s.floatingIconBtn} disabled={!currentSurahAr || currentAyahIndex >= currentSurahAr.ayahs.length - 1} activeOpacity={0.7}>
                        <MaterialCommunityIcons name="skip-next" size={26} color={currentSurahAr && currentAyahIndex < currentSurahAr.ayahs.length - 1 ? colors.text.primary : colors.text.tertiary} />
                    </TouchableOpacity>

                    {/* Ayah counter */}
                    <Text style={[s.floatingAyahCounter, { color: colors.text.secondary }]}>
                        {currentAyahIndex >= 0 ? `${currentAyahIndex + 1}/${currentSurahAr.ayahs.length}` : `–/${currentSurahAr.ayahs.length}`}
                    </Text>

                    {/* Scroll to current ayah */}
                    <TouchableOpacity onPress={scrollToCurrentAyah} style={s.floatingIconBtn} disabled={currentAyahIndex < 0} activeOpacity={0.7}>
                        <MaterialCommunityIcons name="crosshairs-gps" size={20} color={currentAyahIndex >= 0 ? colors.accent.gold : colors.text.tertiary} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    /* ── Reading view ───────────────────────────────────────────── */
    const renderReadingView = () => {
        if (surahLoading) {
            return (
                <View style={s.center}>
                    <ActivityIndicator size="large" color={colors.accent.gold} />
                </View>
            );
        }
        if (!currentSurahAr) return null;

        const showTranslation = editionPref === 'both' && currentSurahTr;
        const arAyahs = currentSurahAr.ayahs;
        const trAyahs = currentSurahTr?.ayahs;
        const shouldStripBismillah = currentSurahAr.number !== 1 && currentSurahAr.number !== 9;

        return (
            <View style={{ flex: 1 }}>
                <ScrollView
                    ref={scrollRef}
                    style={s.readingScroll}
                    contentContainerStyle={[s.readingContent, { paddingBottom: 160 }]}
                    showsVerticalScrollIndicator={false}
                    onScrollBeginDrag={() => {
                        autoScrollEnabled.current = false;
                        if (autoScrollResumeTimeoutRef.current) {
                            clearTimeout(autoScrollResumeTimeoutRef.current);
                            autoScrollResumeTimeoutRef.current = null;
                        }
                    }}
                    onScrollEndDrag={() => {
                        if (autoScrollResumeTimeoutRef.current) {
                            clearTimeout(autoScrollResumeTimeoutRef.current);
                        }
                        autoScrollResumeTimeoutRef.current = setTimeout(() => {
                            autoScrollEnabled.current = autoScrollWithAudio;
                            autoScrollResumeTimeoutRef.current = null;
                        }, 1200);
                    }}
                >
                    {/* Surah header card */}
                    <View style={[s.surahHeaderCard, { backgroundColor: goldTint(isDark ? 0.08 : 0.06), borderColor: goldTint(0.2) }]}>
                        <Text style={[s.surahHeaderArabic, { color: colors.text.primary, fontSize: fs.surahHeaderArabic }]}>{currentSurahAr.name}</Text>
                        <Text style={[s.surahHeaderEnglish, { color: colors.accent.gold, fontSize: fs.surahHeaderEnglish }]}>
                            {currentSurahAr.englishName} – {currentSurahAr.englishNameTranslation}
                        </Text>
                        <Text style={[s.surahHeaderMeta, { color: colors.text.secondary }]}>
                            {currentSurahAr.revelationType === 'Meccan' ? t('meccan') : t('medinan')} · {currentSurahAr.numberOfAyahs} {t('verses')}
                        </Text>

                        {/* Edition toggle */}
                        <View style={s.editionToggleRow}>
                            <TouchableOpacity
                                style={[
                                    s.editionBtn,
                                    editionPref === 'arabic' && { backgroundColor: colors.accent.gold },
                                    { borderColor: colors.accent.gold },
                                ]}
                                onPress={() => setEditionPref('arabic')}
                            >
                                <Text style={[s.editionBtnText, { color: editionPref === 'arabic' ? colors.text.inverse : colors.accent.gold }]}>
                                    {t('arabicOnly')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    s.editionBtn,
                                    editionPref === 'both' && { backgroundColor: colors.accent.gold },
                                    { borderColor: colors.accent.gold },
                                ]}
                                onPress={() => setEditionPref('both')}
                            >
                                <Text style={[s.editionBtnText, { color: editionPref === 'both' ? colors.text.inverse : colors.accent.gold }]}>
                                    {t('arabicAndTranslation')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bismillah banner (skip for Surah 9 and Surah 1) */}
                    {shouldStripBismillah && (
                        <Text style={[s.bismillah, { color: colors.text.primary, fontSize: fs.bismillah }]}>{t('bismillah')}</Text>
                    )}

                    {/* Ayahs */}
                    {arAyahs.map((ayah, idx) => {
                        const arText = (idx === 0 && shouldStripBismillah)
                            ? stripBismillah(ayah.text, 'ar')
                            : ayah.text;
                        const trText = (idx === 0 && shouldStripBismillah && trAyahs?.[idx])
                            ? stripBismillah(trAyahs[idx].text, 'tr', trBismillahRef.current ?? undefined)
                            : trAyahs?.[idx]?.text;
                        const isCurrentAyah = currentAyahIndex === idx;

                        return (
                            <TouchableOpacity
                                key={ayah.number}
                                activeOpacity={0.7}
                                onPress={() => playAyah(idx)}
                                onLayout={(e) => {
                                    ayahLayoutsRef.current[idx] = e.nativeEvent.layout.y;
                                }}
                                style={[
                                    s.ayahCard,
                                    { backgroundColor: cardBg, borderColor: faintBorder },
                                    isCurrentAyah && { borderColor: colors.accent.gold, borderWidth: 1.5, backgroundColor: goldTint(isDark ? 0.12 : 0.06) },
                                ]}
                            >
                                {/* Ayah header row: number pill + play icon */}
                                <View style={s.ayahHeaderRow}>
                                    <View style={[s.ayahNumberPill, { backgroundColor: goldTint(isDark ? 0.12 : 0.08) }]}>
                                        <Text style={[s.ayahNumberText, { color: colors.accent.gold }]}>{ayah.numberInSurah}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        {isCurrentAyah && isPlaying ? (
                                            <View style={[s.ayahPlayIndicator, { backgroundColor: goldTint(isDark ? 0.15 : 0.10) }]}>
                                                <MaterialCommunityIcons name="volume-high" size={14} color={colors.accent.gold} />
                                                <Text style={{ color: colors.accent.gold, fontSize: 10, fontWeight: '600', marginLeft: 3 }}>{t('playing')}</Text>
                                            </View>
                                        ) : isCurrentAyah && !isPlaying ? (
                                            <View style={[s.ayahPlayIndicator, { backgroundColor: goldTint(isDark ? 0.10 : 0.06) }]}>
                                                <MaterialCommunityIcons name="pause" size={14} color={colors.accent.gold} />
                                                <Text style={{ color: colors.accent.gold, fontSize: 10, fontWeight: '600', marginLeft: 3 }}>{t('paused')}</Text>
                                            </View>
                                        ) : (
                                            <MaterialCommunityIcons name="play-circle-outline" size={20} color={colors.text.tertiary} />
                                        )}
                                    </View>
                                </View>

                                {/* Arabic text */}
                                <Text style={[s.ayahArabic, { color: colors.text.primary, fontSize: fs.ayahArabic, lineHeight: fs.ayahArabicLH }]}>{arText}</Text>

                                {/* Translation (if enabled) */}
                                {showTranslation && trText && (
                                    <Text style={[s.ayahTranslation, { color: colors.text.secondary, fontSize: fs.ayahTranslation, lineHeight: fs.ayahTranslationLH }]}>
                                        {trText}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Floating audio player popup */}
                {renderFloatingAudioPlayer()}
            </View>
        );
    };

    /* ── Search Results view ────────────────────────────────────── */
    const renderSearchResultsView = () => {
        if (searching) {
            return (
                <View style={s.center}>
                    <ActivityIndicator size="large" color={colors.accent.gold} />
                </View>
            );
        }

        if (searchResults.length === 0) {
            return (
                <View style={s.center}>
                    <MaterialCommunityIcons name="book-search-outline" size={48} color={colors.text.tertiary} />
                    <Text style={[s.emptyText, { color: colors.text.secondary }]}>
                        {lastSearchQuery ? `${t('noResultsFor')} "${lastSearchQuery}"` : t('tapToSearch')}
                    </Text>
                </View>
            );
        }

        return (
            <FlatList
                data={searchResults}
                keyExtractor={(item) => `${item.number}`}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[s.searchResultCard, { backgroundColor: cardBg, borderColor: faintBorder }]}
                        activeOpacity={0.7}
                        onPress={() => openSurah(item.surah.number)}
                    >
                        <View style={s.searchResultHeader}>
                            <Text style={[s.searchResultSurah, { color: colors.accent.gold }]}>
                                {item.surah.englishName} ({item.surah.number}:{item.numberInSurah})
                            </Text>
                        </View>
                        <Text style={[s.searchResultText, { color: colors.text.primary }]}>{item.text}</Text>
                    </TouchableOpacity>
                )}
            />
        );
    };

    // ================================================================
    //  MAIN RENDER
    // ================================================================

    return (
        <SafeAreaView style={[s.safe, { backgroundColor: colors.background.primary }]} edges={['top', 'left', 'right']}>
            {Platform.OS === 'android' && (
                <View style={{ height: StatusBar.currentHeight || 20, backgroundColor: colors.background.primary }} />
            )}

            <ExpoLinearGradient colors={gradientColors as any} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            <View style={s.container}>
                {renderHeader()}

                {/* Search bar visible in list and search modes (not read) */}
                {mode !== 'read' && renderSearchBar()}

                {/* Settings hint banner */}
                {mode === 'list' && renderSettingsHintBanner()}

                {/* Loading / error / content */}
                {loading ? (
                    <View style={s.center}>
                        <ActivityIndicator size="large" color={colors.accent.gold} />
                        <Text style={[s.loadingText, { color: colors.text.secondary }]}>{t('loading')}</Text>
                    </View>
                ) : error ? (
                    <View style={s.center}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
                        <Text style={[s.emptyText, { color: colors.text.secondary }]}>{error}</Text>
                    </View>
                ) : mode === 'list' ? (
                    <FlatList
                        data={surahList}
                        keyExtractor={(item) => `${item.number}`}
                        renderItem={({ item }) => <SurahListItem item={item} />}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />
                ) : mode === 'read' ? (
                    renderReadingView()
                ) : (
                    renderSearchResultsView()
                )}
            </View>
        </SafeAreaView>
    );
}

// ================================================================
//  STYLES  (static – colours are applied inline via theme)
// ================================================================

const s = StyleSheet.create({
    safe: { flex: 1 },
    container: { flex: 1, paddingHorizontal: 12, paddingBottom: 0, backgroundColor: 'transparent' },

    /* Header */
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'android' ? 0 : 0,
        paddingHorizontal: 8,
        paddingBottom: 6,
        minHeight: 32,
    },
    backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', letterSpacing: 0.4 },

    /* Search */
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 10,
        borderWidth: 0.5,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, paddingVertical: 0 },

    /* Settings hint banner */
    hintBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 10,
        borderWidth: 0.5,
    },
    hintText: { flex: 1, fontSize: 12, letterSpacing: 0.2 },

    /* Surah list card */
    surahCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 0.5,
    },
    surahNumberBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    surahNumber: { fontSize: 13, fontWeight: '700' },
    surahInfo: { flex: 1 },
    surahEnglishName: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
    surahTranslation: { fontSize: 12, marginTop: 2, letterSpacing: 0.2 },
    surahArabicName: { fontSize: 16, fontWeight: '600', marginRight: 10, fontFamily: Platform.OS === 'ios' ? 'System' : undefined },
    surahActions: { width: 28, alignItems: 'center' },

    /* Reading view */
    readingScroll: { flex: 1 },
    readingContent: { paddingBottom: 40 },
    surahHeaderCard: {
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 0.5,
    },
    surahHeaderArabic: { fontWeight: '700', marginBottom: 6 },
    surahHeaderEnglish: { fontWeight: '600', marginBottom: 4, letterSpacing: 0.3 },
    surahHeaderMeta: { fontSize: 13, letterSpacing: 0.3 },
    editionToggleRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
    editionBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1 },
    editionBtnText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
    bismillah: { textAlign: 'center', marginVertical: 20, fontWeight: '500' },

    /* Ayah card */
    ayahCard: { borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5 },
    ayahHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    ayahNumberPill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
    ayahNumberText: { fontSize: 12, fontWeight: '700' },
    ayahArabic: { textAlign: 'right', marginBottom: 8, fontWeight: '400' },
    ayahTranslation: { letterSpacing: 0.2 },

    /* Floating audio player popup */
    floatingAudioPopup: {
        position: 'absolute',
        left: 8,
        right: 8,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingTop: 6,
        paddingBottom: 8,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    floatingTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
        gap: 6,
    },
    floatingNowPlayingText: { flex: 1, fontSize: 11, fontWeight: '500', letterSpacing: 0.2, marginLeft: 4 },
    floatingControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    floatingIconBtn: { padding: 4 },
    floatingPlayBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 8,
    },
    floatingAyahCounter: { fontSize: 12, fontWeight: '600', marginLeft: 6, minWidth: 50, textAlign: 'center' },

    /* Ayah play indicator badge */
    ayahPlayIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },

    /* Search results */
    searchResultCard: { borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5 },
    searchResultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    searchResultSurah: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
    searchResultText: { fontSize: 14, lineHeight: 22, letterSpacing: 0.2 },

    /* Empty / loading states */
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },
    emptyText: { marginTop: 12, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
