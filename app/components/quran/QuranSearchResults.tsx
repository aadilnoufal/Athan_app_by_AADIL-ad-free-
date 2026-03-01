import React from 'react';
import { Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { quranStyles as s } from './quranStyles';
import type { SearchMatch } from '../../../lib/quranApi';

interface QuranSearchResultsProps {
    searching: boolean;
    searchResults: SearchMatch[];
    lastSearchQuery: string;
    openSurah: (n: number) => void;
    colors: any;
    cardBg: string;
    faintBorder: string;
    t: (key: string, params?: any) => string;
}

/** Search results list for the Quran screen. */
export default function QuranSearchResults({
    searching,
    searchResults,
    lastSearchQuery,
    openSurah,
    colors,
    cardBg,
    faintBorder,
    t,
}: QuranSearchResultsProps) {
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
}
