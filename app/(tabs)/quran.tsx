import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    SurahMeta,
    SurahData,
    Ayah,
    fetchSurah,
    fetchSurahDual,
    searchQuran,
    EDITIONS,
    SearchMatch,
} from '../../lib/quranApi';
import {
    getSurahListCached,
    isSurahDownloaded,
    downloadSurah,
    readOfflineSurah,
    deleteSurah,
    getEditionPref,
    EditionPref,
    getDownloadIndex,
} from '../../utils/quranStorage';

/* ================================================================
   VIEW MODES:
     'list'   – surah catalogue (default)
     'read'   – reading a single surah
     'search' – search results
   ================================================================ */

type ViewMode = 'list' | 'read' | 'search';

export default function QuranScreen() {
    const { colors, isDark } = useTheme();
    const { t, language } = useLanguage();

    // ── State ──────────────────────────────────────────────────────
    const [mode, setMode] = useState<ViewMode>('list');
    const [surahList, setSurahList] = useState<SurahMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Reading state
    const [currentSurahAr, setCurrentSurahAr] = useState<SurahData | null>(null);
    const [currentSurahEn, setCurrentSurahEn] = useState<SurahData | null>(null);
    const [surahLoading, setSurahLoading] = useState(false);

    // Edition preference (arabic | both)
    const [editionPref, setEditionPref] = useState<EditionPref>('both');

    // Offline index (surah numbers that are downloaded)
    const [downloadedSet, setDownloadedSet] = useState<Set<number>>(new Set());
    const [downloadingSurah, setDownloadingSurah] = useState<number | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
    const [searching, setSearching] = useState(false);

    const scrollRef = useRef<ScrollView>(null);

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

    // ── Init: load surah list + download index + edition pref ──────
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [list, pref, idx] = await Promise.all([
                    getSurahListCached(),
                    getEditionPref(),
                    getDownloadIndex(),
                ]);
                setSurahList(list);
                setEditionPref(pref);
                setDownloadedSet(new Set(Object.keys(idx.surahs).map(Number)));
            } catch (e: any) {
                setError(e.message ?? 'Failed to load surah list');
            } finally {
                setLoading(false);
            }
        })();
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
            setCurrentSurahEn(null);

            try {
                // Try offline first
                const offlineAr = await readOfflineSurah(surahNumber, 'ar');
                const offlineEn = await readOfflineSurah(surahNumber, 'en');

                if (offlineAr) {
                    setCurrentSurahAr(offlineAr);
                    setCurrentSurahEn(offlineEn); // may be null if only Arabic saved
                    setSurahLoading(false);
                    return;
                }

                // Fetch online
                const [ar, en] = await fetchSurahDual(surahNumber);
                setCurrentSurahAr(ar);
                setCurrentSurahEn(en);
            } catch (e: any) {
                Alert.alert(t('error'), e.message ?? t('connectionErrorMessage'));
                setMode('list');
            } finally {
                setSurahLoading(false);
            }
        },
        [t],
    );

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

    // ── Search ────────────────────────────────────────────────────
    const runSearch = useCallback(async () => {
        const q = searchQuery.trim();
        if (q.length < 3) return;
        setSearching(true);
        setMode('search');
        try {
            const result = await searchQuran(q, EDITIONS.ENGLISH);
            setSearchResults(result.matches ?? []);
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, [searchQuery]);

    // ── Go back to list ───────────────────────────────────────────
    const goBack = () => {
        setMode('list');
        setCurrentSurahAr(null);
        setCurrentSurahEn(null);
        setSearchResults([]);
        setSearchQuery('');
    };

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
    const Header = () => (
        <View style={s.headerRow}>
            {mode !== 'list' && (
                <TouchableOpacity onPress={goBack} style={[s.backBtn, { backgroundColor: colors.surface.secondary, borderColor: colors.border.light }]}>
                    <MaterialCommunityIcons name="arrow-left" size={20} color={colors.accent.gold} />
                </TouchableOpacity>
            )}
            <Text style={[s.headerTitle, { color: colors.text.primary }]}>
                {mode === 'read' && currentSurahAr
                    ? `${currentSurahAr.englishName}`
                    : mode === 'search'
                        ? t('searchQuran').replace('...', '')
                        : t('quranTitle')}
            </Text>
            {mode === 'list' && <View style={{ width: 32 }} />}
        </View>
    );

    /* ── Search Bar ─────────────────────────────────────────────── */
    const SearchBar = () => (
        <View style={[s.searchContainer, { backgroundColor: cardBg, borderColor: faintBorder }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.text.tertiary} />
            <TextInput
                style={[s.searchInput, { color: colors.text.primary }]}
                placeholder={t('searchQuran')}
                placeholderTextColor={colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={runSearch}
                returnKeyType="search"
            />
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); if (mode === 'search') goBack(); }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
            )}
        </View>
    );

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

    /* ── Reading view ───────────────────────────────────────────── */
    const ReadingView = () => {
        if (surahLoading) {
            return (
                <View style={s.center}>
                    <ActivityIndicator size="large" color={colors.accent.gold} />
                </View>
            );
        }
        if (!currentSurahAr) return null;

        const showTranslation = editionPref === 'both' && currentSurahEn;
        const arAyahs = currentSurahAr.ayahs;
        const enAyahs = currentSurahEn?.ayahs;

        return (
            <ScrollView
                ref={scrollRef}
                style={s.readingScroll}
                contentContainerStyle={s.readingContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Surah header card */}
                <View style={[s.surahHeaderCard, { backgroundColor: goldTint(isDark ? 0.08 : 0.06), borderColor: goldTint(0.2) }]}>
                    <Text style={[s.surahHeaderArabic, { color: colors.text.primary }]}>{currentSurahAr.name}</Text>
                    <Text style={[s.surahHeaderEnglish, { color: colors.accent.gold }]}>
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
                                {t('arabicAndEnglish')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bismillah (skip for Surah 9 At-Tawbah and Surah 1 Al-Fatiha which includes it) */}
                {currentSurahAr.number !== 9 && currentSurahAr.number !== 1 && (
                    <Text style={[s.bismillah, { color: colors.text.primary }]}>{t('bismillah')}</Text>
                )}

                {/* Ayahs */}
                {arAyahs.map((ayah, idx) => (
                    <View key={ayah.number} style={[s.ayahCard, { backgroundColor: cardBg, borderColor: faintBorder }]}>
                        {/* Ayah number pill */}
                        <View style={[s.ayahNumberPill, { backgroundColor: goldTint(isDark ? 0.12 : 0.08) }]}>
                            <Text style={[s.ayahNumberText, { color: colors.accent.gold }]}>{ayah.numberInSurah}</Text>
                        </View>

                        {/* Arabic text */}
                        <Text style={[s.ayahArabic, { color: colors.text.primary }]}>{ayah.text}</Text>

                        {/* English translation (if enabled) */}
                        {showTranslation && enAyahs && enAyahs[idx] && (
                            <Text style={[s.ayahTranslation, { color: colors.text.secondary }]}>
                                {enAyahs[idx].text}
                            </Text>
                        )}
                    </View>
                ))}

                <View style={{ height: 100 }} />
            </ScrollView>
        );
    };

    /* ── Search Results view ────────────────────────────────────── */
    const SearchResultsView = () => {
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
                    <Text style={[s.emptyText, { color: colors.text.secondary }]}>{t('noResults')}</Text>
                </View>
            );
        }

        return (
            <FlatList
                data={searchResults}
                keyExtractor={(item) => `${item.number}`}
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
                <Header />

                {/* Search bar only on list view */}
                {mode === 'list' && <SearchBar />}

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
                    />
                ) : mode === 'read' ? (
                    <ReadingView />
                ) : (
                    <SearchResultsView />
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
    surahHeaderArabic: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
    surahHeaderEnglish: { fontSize: 16, fontWeight: '600', marginBottom: 4, letterSpacing: 0.3 },
    surahHeaderMeta: { fontSize: 13, letterSpacing: 0.3 },
    editionToggleRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
    editionBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1 },
    editionBtnText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
    bismillah: { fontSize: 26, textAlign: 'center', marginVertical: 20, fontWeight: '500' },

    /* Ayah card */
    ayahCard: { borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5 },
    ayahNumberPill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
    ayahNumberText: { fontSize: 12, fontWeight: '700' },
    ayahArabic: { fontSize: 22, lineHeight: 38, textAlign: 'right', marginBottom: 8, fontWeight: '400' },
    ayahTranslation: { fontSize: 14, lineHeight: 22, letterSpacing: 0.2 },

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
