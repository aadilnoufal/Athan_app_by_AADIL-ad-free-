import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { quranStyles as s } from './quranStyles';
import type { SurahMeta } from '../../../lib/quranApi';

interface SurahListItemProps {
    item: SurahMeta;
    openSurah: (n: number) => void;
    goldTint: (opacity: number) => string;
    isDark: boolean;
    colors: any;
    cardBg: string;
    subtleBorder: string;
    arabicFontFamily: string | undefined;
    t: (key: string, params?: any) => string;
}

/** A single surah row in the list view. Wrapped in React.memo for FlatList perf. */
const SurahListItem = React.memo(function SurahListItem({
    item,
    openSurah,
    goldTint,
    isDark,
    colors,
    cardBg,
    subtleBorder,
    arabicFontFamily,
    t,
}: SurahListItemProps) {
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
});

export default SurahListItem;
