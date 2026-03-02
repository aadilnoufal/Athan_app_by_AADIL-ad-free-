import React, { useCallback, useRef, useEffect } from 'react';
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
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { quranStyles as s } from '../components/quran/quranStyles';
import {
    SurahMeta,
    SurahData,
    EDITIONS,
    fetchSurah,
} from '../../lib/quranApi';
import { stripBismillah } from '../../utils/quranHelpers';
import {
    readOfflineSurah,
    getBismillahText,
    setLastRead,
    LastReadEntry,
    setBookmark,
    removeBookmark,
    BookmarkEntry,
} from '../../utils/quranStorage';
import { useQuranData } from '../../hooks/quran/useQuranData';
import { useQuranAudio } from '../../hooks/quran/useQuranAudio';
import SurahListItem from '../components/quran/SurahListItem';
import FloatingAudioPlayer from '../components/quran/FloatingAudioPlayer';
import QuranSearchResults from '../components/quran/QuranSearchResults';
import { useOnboarding } from '../../contexts/OnboardingContext';
import OnboardingTooltips, { QURAN_TOOLTIPS } from '../../components/OnboardingTooltips';

export default function QuranScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const scrollRef = useRef<ScrollView>(null);

    // Onboarding tooltips
    const { shouldShowTooltip, completeTooltip } = useOnboarding();
    const [showQuranTooltips, setShowQuranTooltips] = React.useState(false);
    React.useEffect(() => {
        if (shouldShowTooltip('quran')) {
            const timer = setTimeout(() => setShowQuranTooltips(true), 600);
            return () => clearTimeout(timer);
        }
    }, [shouldShowTooltip]);

    // ── Data hook (prefs, search, bookmarks, theme, fonts) ──────
    const {
        mode, setMode,
        surahList, loading, error,
        currentSurahAr, setCurrentSurahAr,
        currentSurahTr, setCurrentSurahTr,
        surahLoading, setSurahLoading,
        editionPref, setEditionPref,
        translationEdition,
        reciterEdition, autoScrollWithAudio,
        lastRead, setLastReadState,
        bookmarkEntry, setBookmarkEntryState,
        arabicFontFamily, fs,
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
        t,
        retryLoadSurahList, runSearch,
        handleDismissHint,
    } = useQuranData();

    // ── Audio hook (playback, download, auto-scroll) ────────────
    const {
        currentAyahIndex, setCurrentAyahIndex,
        isPlaying, audioLoading,
        audioDownloaded, audioDownloading, audioDownloadProgress,
        currentSurahArRef, currentAyahIndexRef,
        audioSurahDataRef, setAudioSurahData,
        ayahLayoutsRef, autoScrollEnabled, autoScrollResumeTimeoutRef,
        stopAudio, playAyah, togglePlayPause,
        playPrevAyah, playNextAyah,
        checkAudioStatus, handleDownloadAudio, scrollToCurrentAyah,
    } = useQuranAudio({
        currentSurahAr,
        reciterEdition,
        autoScrollWithAudio,
        scrollRef,
        t,
    });

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
    // SurahListItem is imported from ../components/quran/SurahListItem

    // FloatingAudioPlayer is imported from ../components/quran/FloatingAudioPlayer

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
                {currentSurahAr && (
                    <FloatingAudioPlayer
                        currentSurahAr={currentSurahAr}
                        currentAyahIndex={currentAyahIndex}
                        tabBarHeight={tabBarHeight}
                        isDark={isDark}
                        goldTint={goldTint}
                        colors={colors}
                        t={t}
                        stopAudio={stopAudio}
                        audioDownloading={audioDownloading}
                        audioDownloadProgress={audioDownloadProgress}
                        audioDownloaded={audioDownloaded}
                        handleDownloadAudio={handleDownloadAudio}
                        playPrevAyah={playPrevAyah}
                        playNextAyah={playNextAyah}
                        togglePlayPause={togglePlayPause}
                        audioLoading={audioLoading}
                        isPlaying={isPlaying}
                        scrollToCurrentAyah={scrollToCurrentAyah}
                    />
                )}
            </View>
        );
    };

    /* ── Search Results view ────────────────────────────────────── */
    // QuranSearchResults is imported from ../components/quran/QuranSearchResults

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
                            renderItem={({ item }) => (
                                <SurahListItem
                                    item={item}
                                    openSurah={openSurah}
                                    goldTint={goldTint}
                                    isDark={isDark}
                                    colors={colors}
                                    cardBg={cardBg}
                                    subtleBorder={subtleBorder}
                                    arabicFontFamily={arabicFontFamily}
                                    t={t}
                                />
                            )}
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
                    <QuranSearchResults
                        searching={searching}
                        searchResults={searchResults}
                        lastSearchQuery={lastSearchQuery}
                        openSurah={openSurah}
                        colors={colors}
                        cardBg={cardBg}
                        faintBorder={faintBorder}
                        t={t}
                    />
                )}
            </View>

            {/* Onboarding tooltips overlay */}
            {showQuranTooltips && (
                <OnboardingTooltips
                    tooltips={QURAN_TOOLTIPS}
                    onComplete={() => {
                        setShowQuranTooltips(false);
                        completeTooltip('quran');
                    }}
                />
            )}
        </SafeAreaView>
    );
}
