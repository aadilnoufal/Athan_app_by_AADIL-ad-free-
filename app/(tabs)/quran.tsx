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
    AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../contexts/ThemeContext';
import { goldTint as centralGoldTint, withAlpha } from '../../utils/colorHelpers';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    SurahMeta,
    SurahData,
    fetchSurah,
    fetchSurahAudio,
    EDITIONS,
    SearchMatch,
} from '../../lib/quranApi';
import {
    getSurahListCached,
    readOfflineSurah,
    getEditionPref,
    EditionPref,
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
    getLastRead,
    setLastRead,
    LastReadEntry,
    getQuranFontFamily,
    QuranFontFamily,
    getBookmark,
    setBookmark,
    removeBookmark,
    BookmarkEntry,
} from '../../utils/quranStorage';
import * as Font from 'expo-font';

/* ================================================================
   VIEW MODES:
     'list'   – surah catalogue (default)
     'read'   – reading a single surah
     'search' – search results
   ================================================================ */

type ViewMode = 'list' | 'read' | 'search';

/* ── Common surah name aliases / misspellings → surah number ── */
const SURAH_ALIASES: Record<string, number[]> = {
    'fatiha': [1], 'fateha': [1], 'fatihah': [1], 'opening': [1],
    'baqara': [2], 'baqarah': [2], 'cow': [2],
    'imran': [3], 'imraan': [3],
    'nisa': [4], 'nisaa': [4], 'women': [4],
    'maida': [5], 'maidah': [5], 'table': [5],
    'anam': [6], 'anaam': [6], 'cattle': [6],
    'araf': [7], 'araaf': [7],
    'anfal': [8], 'anfaal': [8],
    'tauba': [9], 'taubah': [9], 'tawba': [9], 'tawbah': [9], 'repentance': [9],
    'yunus': [10], 'younus': [10], 'jonah': [10],
    'hud': [11], 'hood': [11],
    'yusuf': [12], 'yousuf': [12], 'joseph': [12],
    'raad': [13], 'rad': [13], 'thunder': [13],
    'ibrahim': [14], 'ibraheem': [14], 'abraham': [14],
    'hijr': [15],
    'nahl': [16], 'bee': [16],
    'isra': [17], 'israa': [17],
    'kahf': [18], 'cave': [18],
    'maryam': [19], 'mary': [19],
    'taha': [20],
    'anbiya': [21], 'anbiyaa': [21], 'prophets': [21],
    'hajj': [22], 'pilgrimage': [22],
    'muminun': [23], 'muminoon': [23], 'believers': [23],
    'nur': [24], 'noor': [24], 'light': [24],
    'furqan': [25], 'furqaan': [25], 'criterion': [25],
    'shuara': [26], 'poets': [26],
    'naml': [27], 'ants': [27],
    'qasas': [28], 'stories': [28],
    'ankabut': [29], 'ankaboot': [29], 'spider': [29],
    'rum': [30], 'romans': [30],
    'luqman': [31], 'luqmaan': [31],
    'sajda': [32], 'sajdah': [32], 'prostration': [32],
    'ahzab': [33], 'ahzaab': [33],
    'saba': [34], 'sabaa': [34], 'sheba': [34],
    'fatir': [35], 'faatir': [35], 'originator': [35],
    'yaseen': [36], 'yasin': [36], 'ya sin': [36],
    'saffat': [37], 'saaffaat': [37],
    'saad': [38],
    'zumar': [39], 'groups': [39],
    'ghafir': [40], 'ghaafir': [40], 'forgiver': [40],
    'fussilat': [41], 'detailed': [41],
    'shura': [42], 'consultation': [42],
    'zukhruf': [43],
    'dukhan': [44], 'smoke': [44],
    'jathiya': [45], 'jathiyah': [45],
    'ahqaf': [46], 'ahqaaf': [46],
    'muhammad': [47],
    'fath': [48], 'victory': [48],
    'hujurat': [49], 'hujuraat': [49], 'rooms': [49],
    'qaaf': [50],
    'dhariyat': [51], 'dhaariyat': [51],
    'tur': [52], 'toor': [52], 'mount': [52],
    'najm': [53], 'star': [53],
    'qamar': [54], 'moon': [54],
    'rahman': [55], 'rehman': [55], 'merciful': [55],
    'waqia': [56], 'waqiah': [56], 'waaqia': [56],
    'hadid': [57], 'hadeed': [57], 'iron': [57],
    'mujadila': [58], 'mujadilah': [58],
    'hashr': [59],
    'mumtahina': [60], 'mumtahinah': [60],
    'saff': [61],
    'jumua': [62], 'jumuah': [62], 'friday': [62],
    'munafiqun': [63], 'munafiqoon': [63], 'hypocrites': [63],
    'taghabun': [64], 'taghaabun': [64],
    'talaq': [65], 'talaaq': [65], 'divorce': [65],
    'tahrim': [66], 'tahreem': [66],
    'mulk': [67], 'dominion': [67], 'sovereignty': [67],
    'qalam': [68], 'pen': [68],
    'haaqqa': [69], 'haqqa': [69], 'haqqah': [69],
    'maarij': [70],
    'nuh': [71], 'nooh': [71], 'noah': [71],
    'jinn': [72], 'djinn': [72],
    'muzzammil': [73], 'muzammil': [73],
    'muddathir': [74], 'mudathir': [74], 'muddaththir': [74],
    'qiyama': [75], 'qiyamah': [75], 'resurrection': [75],
    'insan': [76], 'insaan': [76], 'dahr': [76],
    'mursalat': [77], 'mursalaat': [77],
    'naba': [78], 'nabaa': [78], 'tidings': [78],
    'naziat': [79], 'naziaat': [79],
    'abasa': [80],
    'takwir': [81], 'takweer': [81],
    'infitar': [82], 'infitaar': [82],
    'mutaffifin': [83], 'mutaffifeen': [83],
    'inshiqaq': [84], 'inshiqaaq': [84],
    'buruj': [85], 'burooj': [85],
    'tariq': [86], 'taariq': [86],
    'ala': [87],
    'ghashiya': [88], 'ghaashiya': [88],
    'fajr': [89],
    'balad': [90],
    'shams': [91], 'sun': [91],
    'lail': [92], 'layl': [92], 'night': [92],
    'duha': [93], 'dhuha': [93], 'morning': [93],
    'sharh': [94], 'inshirah': [94],
    'teen': [95], 'fig': [95],
    'alaq': [96], 'clot': [96],
    'qadr': [97], 'power': [97], 'decree': [97],
    'bayyina': [98], 'bayyinah': [98], 'evidence': [98],
    'zalzala': [99], 'zilzal': [99], 'earthquake': [99],
    'adiyat': [100], 'aadiyaat': [100],
    'qaria': [101], 'qariah': [101], 'calamity': [101],
    'takathur': [102], 'takaathur': [102],
    'asr': [103],
    'humaza': [104], 'humazah': [104],
    'fil': [105], 'feel': [105], 'elephant': [105],
    'quraish': [106], 'quraysh': [106],
    'maun': [107], 'maaun': [107],
    'kauthar': [108], 'kawthar': [108], 'kawsar': [108],
    'kafirun': [109], 'kafiroon': [109], 'kaafiroon': [109], 'disbelievers': [109],
    'nasr': [110],
    'masad': [111], 'lahab': [111],
    'ikhlas': [112], 'ikhlaas': [112], 'sincerity': [112], 'purity': [112],
    'falaq': [113], 'daybreak': [113], 'dawn': [113],
    'nas': [114], 'naas': [114], 'mankind': [114], 'people': [114],
};

/* ── Bismillah text constants for stripping from first ayah ──── */
const BISMILLAH_AR = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
const BISMILLAH_AR_ALT = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ';
const BISMILLAH_EN_PREFIX = 'In the name of Allah';

/**
 * Strip leading Bismillah from ayah 1 text for surahs 2-113 (except 9).
 * The API includes it in the text but we render a separate styled banner.
 *
 * @param knownBismillah The exact bismillah text from the same API edition
 *   (surah 1, ayah 1). This is the most reliable way to strip it.
 */
function stripBismillah(text: string, knownBismillah?: string): string {
    // ── 1. Best: use the API's own bismillah text (guaranteed match) ──
    if (knownBismillah) {
        const trimmed = knownBismillah.trim();
        if (text.startsWith(trimmed)) {
            const rest = text.slice(trimmed.length).trim();
            if (rest.length > 0) return rest;
        }
        // Tolerate trailing punctuation / whitespace differences
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefixRe = new RegExp('^' + escaped + '[.\\s,;:\\-!]*\\s*');
        const km = text.match(prefixRe);
        if (km) {
            const rest = text.slice(km[0].length).trim();
            if (rest.length > 0) return rest;
        }
    }

    // ── 2. Fallback: hardcoded Arabic patterns (tatweel-tolerant) ──
    const noTatweel = (s: string) => s.replace(/\u0640/g, '');
    const normText = noTatweel(text);
    for (const prefix of [BISMILLAH_AR, BISMILLAH_AR_ALT]) {
        const normPrefix = noTatweel(prefix);
        if (normText.startsWith(normPrefix)) {
            return normText.slice(normPrefix.length).trim();
        }
    }

    // ── 3. Fallback: English patterns ──
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

    // ── 4. Last resort: fuzzy Arabic strip up to ٱلرَّحِيمِ ──
    const rhmNorm = noTatweel('ٱلرَّحِيمِ');
    const rhmIdx = normText.indexOf(rhmNorm);
    if (rhmIdx !== -1 && rhmIdx < 60) {
        return normText.slice(rhmIdx + rhmNorm.length).trim();
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
    const [fontScale, setFontScaleState] = useState(1.2);

    // Continue from last read
    const [lastRead, setLastReadState] = useState<LastReadEntry | null>(null);

    // Bookmark
    const [bookmarkEntry, setBookmarkEntryState] = useState<BookmarkEntry | null>(null);

    // Quran font family
    const [quranFontFamily, setQuranFontFamilyState] = useState<QuranFontFamily>('default');
    const [fontsLoaded, setFontsLoaded] = useState(false);

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
    const nextSoundRef = useRef<Audio.Sound | null>(null);   // rolling preload
    const nextSoundIndexRef = useRef<number>(-1);             // which ayah nextSoundRef holds
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

    // When reciter changes, invalidate cached audio data so we stream/fetch fresh URLs
    const prevReciterRef = useRef(reciterEdition);
    useEffect(() => {
        if (prevReciterRef.current !== reciterEdition) {
            prevReciterRef.current = reciterEdition;
            // Clear cached audio URLs (they belong to old reciter)
            setAudioSurahData(null);
            audioSurahDataRef.current = null;
            // Discard preloaded sound (belongs to old reciter)
            if (nextSoundRef.current) {
                nextSoundRef.current.unloadAsync().catch(() => { });
                nextSoundRef.current = null;
                nextSoundIndexRef.current = -1;
            }
            // Re-check download status for new reciter
            const surahNum = currentSurahArRef.current?.number;
            if (surahNum) {
                isSurahAudioDownloaded(surahNum, reciterEdition)
                    .then(d => setAudioDownloaded(d))
                    .catch(() => setAudioDownloaded(false));
            }
        }
    }, [reciterEdition]);

    // ── Ayah position tracking for auto-scroll ───────────────────
    const ayahLayoutsRef = useRef<Record<number, number>>({});
    const autoScrollEnabled = useRef(true);
    const autoScrollResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trBismillahRef = useRef<string | null>(null);
    const arBismillahRef = useRef<string | null>(null);

    // ── Smart continue reading: visible ayah & scroll-to target ──
    const topVisibleAyahRef = useRef(0);
    const scrollToAyahRef = useRef<number | null>(null);

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
            return [colors.background.tertiary, colors.surface.secondary, colors.background.tertiary];
        return [colors.surface.secondary, colors.background.tertiary, colors.surface.secondary];
    };
    const gradientColors: [string, string, string] = isDark
        ? [colors.background.primary, colors.background.secondary, colors.surface.primary]
        : getTimeBasedGradient();

    // ── Colour helpers (using centralized goldTint utility) ──────
    const goldTint = (opacity: number) => centralGoldTint(opacity, colors);
    // Goldilocks: slightly darker than last pass, still soft
    const cardBg = isDark ? 'rgba(255,255,255,0.038)' : colors.background.secondary;
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

    // ── Resolved font family for Arabic text ──────────────────────
    const arabicFontFamily = useMemo(() => {
        if (!fontsLoaded || quranFontFamily === 'default') return undefined;
        return quranFontFamily; // 'Amiri' or 'ScheherazadeNew'
    }, [quranFontFamily, fontsLoaded]);

    // ── Ayah reference pattern detector (e.g., "2:14" or "2 : 14") ──
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

        // Search by surah number
        const num = parseInt(q, 10);
        if (!isNaN(num) && num >= 1 && num <= 114) {
            return surahList.filter(s => s.number === num);
        }

        // Collect alias matches
        const aliasHits = new Set<number>();
        for (const [alias, numbers] of Object.entries(SURAH_ALIASES)) {
            if (alias.includes(q) || q.includes(alias)) {
                numbers.forEach(n => aliasHits.add(n));
            }
        }

        // Filter by name, translation, or alias
        return surahList.filter(s => {
            const engNorm = s.englishName.toLowerCase().replace(/[-']/g, '');
            const trNorm = s.englishNameTranslation.toLowerCase().replace(/[-']/g, '');
            return engNorm.includes(q) || trNorm.includes(q) || aliasHits.has(s.number);
        });
    }, [surahList, searchQuery]);

    // ── Init: load surah list + all prefs ─────────
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
                autoScrollEnabled.current = autoScrollPref;
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
                    // Fonts failed to load; fall back to system font
                    setFontsLoaded(true);
                }
            } catch (e: any) {
                setError(e.message ?? 'Failed to load surah list');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ── Refresh prefs + download index when screen comes into focus ──
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
                    autoScrollEnabled.current = autoScrollPref;
                    setQuranFontFamilyState(fontFamPref);
                    setBookmarkEntryState(bookmarkData);
                } catch { }
            })();

            // Save reading position when tab loses focus
            return () => {
                const arData = currentSurahArRef.current;
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

    // ── Save reading position when app goes to background ─────────
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'background' || nextState === 'inactive') {
                const arData = currentSurahArRef.current;
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
            nextSoundRef.current?.unloadAsync().catch(() => { });
        };
    }, []);

    // ── Retry loading surah list (after network error) ────────────
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

    // ── Open a surah for reading ──────────────────────────────────
    const openSurah = useCallback(
        async (surahNumber: number) => {
            setSurahLoading(true);
            setMode('read');
            setCurrentSurahAr(null);
            setCurrentSurahTr(null);
            trBismillahRef.current = null;
            arBismillahRef.current = null;
            // Stop any playing audio
            stopAudio();

            try {
                // Pre-fetch bismillah text for stripping (runs in parallel)
                const needsBismillah = surahNumber !== 1 && surahNumber !== 9;
                const trBismillahPromise = needsBismillah
                    ? getBismillahText(translationEdition).catch(() => null)
                    : Promise.resolve(null);
                const arBismillahPromise = needsBismillah
                    ? getBismillahText(EDITIONS.ARABIC).catch(() => null)
                    : Promise.resolve(null);

                // Arabic text is always available from bundled data
                const arData = await readOfflineSurah(surahNumber, 'ar');
                if (!arData) throw new Error('Bundled Arabic data missing');
                setCurrentSurahAr(arData);

                // Translation: use bundled English if that's the selected edition,
                // otherwise fetch the chosen translation online (fallback to English).
                let trData: SurahData | null = null;
                if (translationEdition === EDITIONS.ENGLISH) {
                    trData = await readOfflineSurah(surahNumber, 'en');
                } else {
                    try {
                        trData = await fetchSurah(surahNumber, translationEdition);
                    } catch {
                        // Fallback to bundled English if network fails
                        trData = await readOfflineSurah(surahNumber, 'en');
                    }
                }
                setCurrentSurahTr(trData);

                const [trBis, arBis] = await Promise.all([trBismillahPromise, arBismillahPromise]);
                trBismillahRef.current = trBis;
                arBismillahRef.current = arBis;
                setSurahLoading(false);
                checkAudioStatus(surahNumber);

                // Save last read position (preserve ayahIndex when continuing)
                const meta = surahList.find(s => s.number === surahNumber);
                if (meta) {
                    const entry: LastReadEntry = {
                        surahNumber,
                        surahName: meta.englishName,
                        surahNameArabic: meta.name,
                        ayahIndex: scrollToAyahRef.current ?? 0,
                        timestamp: Date.now(),
                    };
                    setLastRead(entry).catch(() => { });
                    setLastReadState(entry);
                }
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

    // ── Search: just dismiss keyboard (filtering is real-time via filteredSurahList) ──
    const runSearch = useCallback(() => {
        Keyboard.dismiss();
    }, []);

    // ── Track which ayah is at the top of the visible area ────────
    const handleReadingScroll = useCallback((event: any) => {
        const scrollY: number = event.nativeEvent.contentOffset.y;
        const layouts = ayahLayoutsRef.current;
        const indices = Object.keys(layouts).map(Number).sort((a, b) => a - b);
        let topAyah = 0;
        for (const idx of indices) {
            if (layouts[idx] <= scrollY + 100) {
                topAyah = idx;
            } else {
                break;
            }
        }
        topVisibleAyahRef.current = topAyah;
    }, []);

    // ── Go back to list ───────────────────────────────────────────
    const goBack = useCallback(() => {
        // Save last-read position (ayah-level) before clearing
        const arData = currentSurahArRef.current;
        if (arData) {
            const entry: LastReadEntry = {
                surahNumber: arData.number,
                surahName: arData.englishName,
                surahNameArabic: arData.name,
                ayahIndex: topVisibleAyahRef.current,
                timestamp: Date.now(),
            };
            setLastRead(entry).catch(() => { });
            setLastReadState(entry);
        }

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
        topVisibleAyahRef.current = 0;
        scrollToAyahRef.current = null;
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
        // Clean up preloaded next sound
        try {
            if (nextSoundRef.current) {
                await nextSoundRef.current.unloadAsync();
                nextSoundRef.current = null;
                nextSoundIndexRef.current = -1;
            }
        } catch { }
        setIsPlaying(false);
        setCurrentAyahIndex(-1);
        currentAyahIndexRef.current = -1;
    }, []);

    // ── Audio: resolve URI for a given ayah (local file or remote) ──
    const resolveAyahAudioUri = useCallback(async (
        surah: SurahData,
        ayahIndex: number,
    ): Promise<string | null> => {
        const ayah = surah.ayahs[ayahIndex];
        if (!ayah) return null;

        // Try local file first
        if (audioDownloadedRef.current) {
            const localUri = await getLocalAudioUri(reciterEditionRef.current, ayah.number);
            if (localUri) return localUri;
        }

        // Fetch audio data if needed, then use remote URL
        let audioData = audioSurahDataRef.current;
        if (!audioData) {
            audioData = await fetchSurahAudio(surah.number, reciterEditionRef.current);
            setAudioSurahData(audioData);
            audioSurahDataRef.current = audioData;
        }
        return audioData.ayahs[ayahIndex]?.audio ?? null;
    }, []);

    // ── Audio: preload the next ayah in the background ────────────
    const preloadNextAyah = useCallback(async (nextIndex: number) => {
        const surah = currentSurahArRef.current;
        if (!surah || nextIndex >= surah.ayahs.length) return;

        // Don't preload if we already have this ayah preloaded
        if (nextSoundIndexRef.current === nextIndex && nextSoundRef.current) return;

        // Clean up any existing preloaded sound
        try {
            if (nextSoundRef.current) {
                await nextSoundRef.current.unloadAsync();
                nextSoundRef.current = null;
                nextSoundIndexRef.current = -1;
            }
        } catch { }

        try {
            const uri = await resolveAyahAudioUri(surah, nextIndex);
            if (!uri) return;

            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: false },  // preload only, don't play yet
            );
            nextSoundRef.current = sound;
            nextSoundIndexRef.current = nextIndex;
        } catch {
            // Preload is best-effort; failure is non-critical
        }
    }, [resolveAyahAudioUri]);

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

            // Check if we have a preloaded sound for this ayah
            let sound: Audio.Sound | null = null;
            if (nextSoundRef.current && nextSoundIndexRef.current === ayahIndex) {
                sound = nextSoundRef.current;
                nextSoundRef.current = null;
                nextSoundIndexRef.current = -1;
            }

            if (sound) {
                // Use preloaded sound — set up status callback and play
                let didAdvance = false;
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish && !didAdvance) {
                        didAdvance = true;
                        const currentIdx = currentAyahIndexRef.current;
                        const surahNow = currentSurahArRef.current;
                        const nextIdx = currentIdx + 1;

                        if (surahNow && nextIdx < surahNow.ayahs.length) {
                            isPlayingLockRef.current = false;
                            playAyah(nextIdx);
                        } else {
                            isPlayingLockRef.current = false;
                            setIsPlaying(false);
                            setCurrentAyahIndex(-1);
                            currentAyahIndexRef.current = -1;
                        }
                    }
                });
                await sound.playAsync();
            } else {
                // No preloaded sound — fetch and create fresh
                const uri = await resolveAyahAudioUri(surah, ayahIndex);
                if (!uri) {
                    Alert.alert(t('audioError'), t('audioErrorMsg'));
                    setAudioLoading(false);
                    isPlayingLockRef.current = false;
                    return;
                }

                let didAdvance = false;
                const result = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: true },
                    (status) => {
                        if (status.isLoaded && status.didJustFinish && !didAdvance) {
                            didAdvance = true;
                            const currentIdx = currentAyahIndexRef.current;
                            const surahNow = currentSurahArRef.current;
                            const nextIdx = currentIdx + 1;

                            if (surahNow && nextIdx < surahNow.ayahs.length) {
                                isPlayingLockRef.current = false;
                                playAyah(nextIdx);
                            } else {
                                isPlayingLockRef.current = false;
                                setIsPlaying(false);
                                setCurrentAyahIndex(-1);
                                currentAyahIndexRef.current = -1;
                            }
                        }
                    }
                );
                sound = result.sound;
            }

            soundRef.current = sound;
            setIsPlaying(true);

            // Rolling preload: start loading the next ayah in the background
            const nextIdx = ayahIndex + 1;
            if (nextIdx < surah.ayahs.length) {
                preloadNextAyah(nextIdx);
            }
        } catch (e: any) {
            Alert.alert(t('audioError'), t('audioErrorMsg'));
        } finally {
            setAudioLoading(false);
            isPlayingLockRef.current = false;
        }
    }, [t, resolveAyahAudioUri, preloadNextAyah]);

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

    // ── Scroll to saved ayah after surah data loads ───────────────
    useEffect(() => {
        if (!surahLoading && mode === 'read' && scrollToAyahRef.current !== null && scrollToAyahRef.current >= 0) {
            const targetAyah = scrollToAyahRef.current;
            // Poll until the target ayah's layout is available (handles large surahs)
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                const y = ayahLayoutsRef.current[targetAyah];
                if (y !== undefined && scrollRef.current) {
                    (scrollRef.current as any).scrollTo({ y: Math.max(0, y - 12), animated: false });
                    scrollToAyahRef.current = null;
                    clearInterval(interval);
                } else if (attempts >= 60) {
                    // Give up after ~12 seconds
                    scrollToAyahRef.current = null;
                    clearInterval(interval);
                }
            }, 200);
            return () => clearInterval(interval);
        }
    }, [surahLoading, mode]);

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

    /* ── Settings Hint Banner (always visible) ──────────────────── */
    const renderSettingsHintBanner = () => (
        <View style={[s.hintBanner, { backgroundColor: goldTint(isDark ? 0.06 : 0.04), borderColor: goldTint(0.15) }]}>
            <MaterialCommunityIcons name="cog-outline" size={14} color={colors.accent.gold} style={{ marginRight: 6, flexShrink: 0 }} />
            <Text style={[s.hintText, { color: colors.text.tertiary, fontSize: 11.5 }]}>
                {t('quranListSettingsHint')}
            </Text>
        </View>
    );

    /* ── Surah List Item ────────────────────────────────────────── */
    const SurahListItem = ({ item }: { item: SurahMeta }) => {
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
                <Text style={[s.surahArabicName, { color: colors.text.primary, fontFamily: arabicFontFamily }]}>{item.name}</Text>
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
                    onScroll={handleReadingScroll}
                    scrollEventThrottle={200}
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
                        <Text style={[s.surahHeaderArabic, { color: colors.text.primary, fontSize: fs.surahHeaderArabic, fontFamily: arabicFontFamily }]}>{currentSurahAr.name}</Text>
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
                        <Text style={[s.bismillah, { color: colors.text.primary, fontSize: fs.bismillah, fontFamily: arabicFontFamily }]}>{t('bismillah')}</Text>
                    )}

                    {/* Ayahs */}
                    {arAyahs.map((ayah, idx) => {
                        const arText = (idx === 0 && shouldStripBismillah)
                            ? stripBismillah(ayah.text, arBismillahRef.current ?? undefined)
                            : ayah.text;
                        const trText = (idx === 0 && shouldStripBismillah && trAyahs?.[idx])
                            ? stripBismillah(trAyahs[idx].text, trBismillahRef.current ?? undefined)
                            : trAyahs?.[idx]?.text;
                        const isCurrentAyah = currentAyahIndex === idx;

                        return (
                            <TouchableOpacity
                                key={ayah.number}
                                activeOpacity={0.7}
                                onPress={() => playAyah(idx)}
                                onLayout={(e) => {
                                    const y = e.nativeEvent.layout.y;
                                    ayahLayoutsRef.current[idx] = y;

                                    // If we are waiting to jump to this ayah (e.g. from "2:14"),
                                    // scroll as soon as this layout is measured.
                                    if (scrollToAyahRef.current === idx && scrollRef.current) {
                                        scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: false });
                                        scrollToAyahRef.current = null;
                                    }
                                }}
                                style={[
                                    s.ayahCard,
                                    { backgroundColor: cardBg, borderColor: faintBorder },
                                    isCurrentAyah && { borderColor: colors.accent.gold, borderWidth: 1.5, backgroundColor: goldTint(isDark ? 0.12 : 0.06) },
                                ]}
                            >
                                {/* Ayah header row: number pill + bookmark + play icon */}
                                <View style={s.ayahHeaderRow}>
                                    <View style={[s.ayahNumberPill, { backgroundColor: goldTint(isDark ? 0.12 : 0.08) }]}>
                                        <Text style={[s.ayahNumberText, { color: colors.accent.gold }]}>{ayah.numberInSurah}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        {/* Bookmark button */}
                                        <TouchableOpacity
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            onPress={async () => {
                                                const isCurrent = bookmarkEntry
                                                    && bookmarkEntry.surahNumber === currentSurahAr!.number
                                                    && bookmarkEntry.ayahIndex === idx;
                                                if (isCurrent) {
                                                    await removeBookmark();
                                                    setBookmarkEntryState(null);
                                                } else {
                                                    const entry: BookmarkEntry = {
                                                        surahNumber: currentSurahAr!.number,
                                                        surahName: currentSurahAr!.englishName,
                                                        surahNameArabic: currentSurahAr!.name,
                                                        ayahIndex: idx,
                                                        ayahNumberInSurah: ayah.numberInSurah,
                                                        timestamp: Date.now(),
                                                    };
                                                    await setBookmark(entry);
                                                    setBookmarkEntryState(entry);
                                                }
                                            }}
                                        >
                                            <MaterialCommunityIcons
                                                name={
                                                    bookmarkEntry
                                                        && bookmarkEntry.surahNumber === currentSurahAr!.number
                                                        && bookmarkEntry.ayahIndex === idx
                                                        ? 'bookmark'
                                                        : 'bookmark-outline'
                                                }
                                                size={20}
                                                color={
                                                    bookmarkEntry
                                                        && bookmarkEntry.surahNumber === currentSurahAr!.number
                                                        && bookmarkEntry.ayahIndex === idx
                                                        ? colors.accent.gold
                                                        : colors.text.tertiary
                                                }
                                            />
                                        </TouchableOpacity>
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
                                <Text style={[s.ayahArabic, { color: colors.text.primary, fontSize: fs.ayahArabic, lineHeight: fs.ayahArabicLH, fontFamily: arabicFontFamily }]}>{arText}</Text>

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
                        <Text style={[s.loadingText, { color: colors.text.secondary }]}>{t('loadingQuran')}</Text>
                    </View>
                ) : error ? (
                    <View style={s.center}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
                        <Text style={[s.emptyText, { color: colors.text.secondary, marginBottom: 16 }]}>{error}</Text>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={retryLoadSurahList}
                            style={[s.retryBtn, { backgroundColor: goldTint(isDark ? 0.12 : 0.10), borderColor: goldTint(0.30) }]}
                        >
                            <MaterialCommunityIcons name="refresh" size={18} color={colors.accent.gold} style={{ marginRight: 6 }} />
                            <Text style={{ color: colors.accent.gold, fontWeight: '600', fontSize: 14 }}>{t('retry')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : mode === 'list' ? (
                    filteredSurahList.length === 0 && searchQuery.trim().length > 0 && !ayahRefMatch ? (
                        <View style={s.center}>
                            <MaterialCommunityIcons name="book-search-outline" size={48} color={colors.text.tertiary} />
                            <Text style={[s.emptyText, { color: colors.text.secondary }]}>
                                {`${t('noResultsFor')} "${searchQuery.trim()}"`}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredSurahList}
                            keyExtractor={(item) => `${item.number}`}
                            renderItem={({ item }) => <SurahListItem item={item} />}
                            ListHeaderComponent={
                                <>
                                    {/* Ayah reference quick-jump card (e.g. user typed "2:14") */}
                                    {ayahRefMatch && (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                scrollToAyahRef.current = ayahRefMatch.ayahNum - 1;
                                                openSurah(ayahRefMatch.surahNum);
                                            }}
                                            style={[s.continueCard, { backgroundColor: goldTint(isDark ? 0.12 : 0.08), borderColor: colors.accent.gold }]}
                                        >
                                            <View style={[s.continueIconWrap, { backgroundColor: goldTint(isDark ? 0.18 : 0.12) }]}>
                                                <MaterialCommunityIcons name="book-arrow-right" size={22} color={colors.accent.gold} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[s.continueLabel, { color: colors.accent.gold }]}>{t('goToAyah')}</Text>
                                                <Text style={[s.continueSurah, { color: colors.text.primary }]}>
                                                    {ayahRefMatch.surah.englishName} · {t('ayah')} {ayahRefMatch.ayahNum}
                                                </Text>
                                                <Text style={[s.continueArabic, { color: colors.text.secondary }]}>{ayahRefMatch.surah.name}</Text>
                                            </View>
                                            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.accent.gold} />
                                        </TouchableOpacity>
                                    )}

                                    {/* Bookmark card (shown when no search query and bookmark exists) */}
                                    {!searchQuery.trim() && bookmarkEntry && (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                scrollToAyahRef.current = bookmarkEntry.ayahIndex;
                                                openSurah(bookmarkEntry.surahNumber);
                                            }}
                                            style={[s.continueCard, { backgroundColor: goldTint(isDark ? 0.10 : 0.06), borderColor: goldTint(0.30) }]}
                                        >
                                            <View style={s.continueIconWrap}>
                                                <MaterialCommunityIcons name="bookmark" size={24} color={colors.accent.gold} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[s.continueLabel, { color: colors.text.secondary }]}>{t('bookmarked')}</Text>
                                                <Text style={[s.continueSurah, { color: colors.text.primary }]}>
                                                    {bookmarkEntry.surahName}
                                                    {` · ${t('ayah')} ${bookmarkEntry.ayahNumberInSurah}`}
                                                </Text>
                                                <Text style={[s.continueArabic, { color: colors.text.secondary }]}>{bookmarkEntry.surahNameArabic}</Text>
                                            </View>
                                            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.accent.gold} />
                                        </TouchableOpacity>
                                    )}

                                    {/* Continue reading card (shown when no search query, no bookmark, but lastRead exists) */}
                                    {!searchQuery.trim() && !bookmarkEntry && lastRead && (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                scrollToAyahRef.current = lastRead.ayahIndex;
                                                openSurah(lastRead.surahNumber);
                                            }}
                                            style={[s.continueCard, { backgroundColor: goldTint(isDark ? 0.10 : 0.06), borderColor: goldTint(0.30) }]}
                                        >
                                            <View style={s.continueIconWrap}>
                                                <MaterialCommunityIcons name="book-open-page-variant" size={24} color={colors.accent.gold} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[s.continueLabel, { color: colors.text.secondary }]}>{t('continueReading')}</Text>
                                                <Text style={[s.continueSurah, { color: colors.text.primary }]}>
                                                    {lastRead.surahName}
                                                    {lastRead.ayahIndex > 0 ? ` · ${t('ayah')} ${lastRead.ayahIndex + 1}` : ''}
                                                </Text>
                                                <Text style={[s.continueArabic, { color: colors.text.secondary }]}>{lastRead.surahNameArabic}</Text>
                                            </View>
                                            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.accent.gold} />
                                        </TouchableOpacity>
                                    )}
                                </>
                            }
                            contentContainerStyle={{ paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        />
                    )
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
    hintText: { flex: 1, flexWrap: 'wrap', fontSize: 12, letterSpacing: 0.2 },

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

    /* Continue reading card */
    continueCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
    },
    continueIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    continueLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
    continueSurah: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3, marginTop: 1 },
    continueArabic: { fontSize: 14, marginTop: 1 },

    /* Search results */
    searchResultCard: { borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5 },
    searchResultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    searchResultSurah: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
    searchResultText: { fontSize: 14, lineHeight: 22, letterSpacing: 0.2 },

    /* Empty / loading states */
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },
    emptyText: { marginTop: 12, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
    retryBtn: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: 12, borderWidth: 0.5,
    },
});
