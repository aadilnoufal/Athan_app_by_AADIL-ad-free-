import { StyleSheet, Platform } from 'react-native';

// ================================================================
//  STYLES  (static – colours are applied inline via theme)
// ================================================================

export const quranStyles = StyleSheet.create({
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
