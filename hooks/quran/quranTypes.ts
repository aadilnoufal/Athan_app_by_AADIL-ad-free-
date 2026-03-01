import { SurahMeta, SurahData, SearchMatch } from '../../lib/quranApi';
import { EditionPref, LastReadEntry, BookmarkEntry, QuranFontFamily } from '../../utils/quranStorage';
import { ViewMode } from '../../constants/surahAliases';
import type { RefObject, MutableRefObject } from 'react';
import type { TextInput, ScrollView } from 'react-native';

/* ── Scaled font sizes for Quran text ── */
export interface QuranFontSizes {
    ayahArabic: number;
    ayahArabicLH: number;
    ayahTranslation: number;
    ayahTranslationLH: number;
    bismillah: number;
    surahHeaderArabic: number;
    surahHeaderEnglish: number;
}

/* ── Ayah reference match from search query (e.g. "2:14") ── */
export interface AyahRefMatch {
    surahNum: number;
    ayahNum: number;
    surah: SurahMeta;
}

/* ── Return type for useQuranData ── */
export interface UseQuranDataReturn {
    // Navigation
    mode: ViewMode;
    setMode: (m: ViewMode) => void;

    // List
    surahList: SurahMeta[];
    loading: boolean;
    error: string | null;

    // Reading state
    currentSurahAr: SurahData | null;
    setCurrentSurahAr: (d: SurahData | null) => void;
    currentSurahTr: SurahData | null;
    setCurrentSurahTr: (d: SurahData | null) => void;
    surahLoading: boolean;
    setSurahLoading: (b: boolean) => void;

    // Preferences
    editionPref: EditionPref;
    setEditionPref: (p: EditionPref) => void;
    translationEdition: string;
    fontScale: number;
    reciterEdition: string;
    autoScrollWithAudio: boolean;

    // Bookmark & last read
    lastRead: LastReadEntry | null;
    setLastReadState: (e: LastReadEntry | null) => void;
    bookmarkEntry: BookmarkEntry | null;
    setBookmarkEntryState: (e: BookmarkEntry | null) => void;

    // Fonts
    fontsLoaded: boolean;
    arabicFontFamily: string | undefined;
    fs: QuranFontSizes;

    // Search
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    searchResults: SearchMatch[];
    setSearchResults: (r: SearchMatch[]) => void;
    searching: boolean;
    lastSearchQuery: string;
    setLastSearchQuery: (q: string) => void;
    filteredSurahList: SurahMeta[];
    ayahRefMatch: AyahRefMatch | null;

    // Settings hint
    showSettingsHint: boolean;

    // Theme derivations
    gradientColors: [string, string, string];
    goldTint: (opacity: number) => string;
    cardBg: string;
    subtleBorder: string;
    faintBorder: string;
    colors: any;
    isDark: boolean;

    // Refs
    trBismillahRef: MutableRefObject<string | null>;
    arBismillahRef: MutableRefObject<string | null>;
    topVisibleAyahRef: MutableRefObject<number>;
    scrollToAyahRef: MutableRefObject<number | null>;
    searchInputRef: RefObject<TextInput | null>;

    // Translation helper
    t: (key: string, params?: any) => string;
    language: string;

    // Callbacks
    retryLoadSurahList: () => Promise<void>;
    runSearch: () => void;
    handleDismissHint: () => void;
}

/* ── Return type for useQuranAudio ── */
export interface UseQuranAudioReturn {
    // State
    audioSurahData: SurahData | null;
    setAudioSurahData: (d: SurahData | null) => void;
    currentAyahIndex: number;
    setCurrentAyahIndex: (i: number) => void;
    isPlaying: boolean;
    audioLoading: boolean;
    audioDownloaded: boolean;
    audioDownloading: boolean;
    audioDownloadProgress: { downloaded: number; total: number };

    // Refs
    currentSurahArRef: MutableRefObject<SurahData | null>;
    currentAyahIndexRef: MutableRefObject<number>;
    audioSurahDataRef: MutableRefObject<SurahData | null>;
    ayahLayoutsRef: MutableRefObject<Record<number, number>>;
    autoScrollEnabled: MutableRefObject<boolean>;
    autoScrollResumeTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;

    // Callbacks
    stopAudio: () => Promise<void>;
    playAyah: (ayahIndex: number) => Promise<void>;
    togglePlayPause: () => Promise<void>;
    playPrevAyah: () => void;
    playNextAyah: () => void;
    checkAudioStatus: (surahNumber: number) => Promise<void>;
    handleDownloadAudio: () => Promise<void>;
    scrollToCurrentAyah: () => void;
}
