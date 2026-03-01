import React from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { quranStyles as s } from './quranStyles';
import type { SurahData } from '../../../lib/quranApi';

interface FloatingAudioPlayerProps {
    currentSurahAr: SurahData;
    currentAyahIndex: number;
    tabBarHeight: number;
    isDark: boolean;
    goldTint: (opacity: number) => string;
    colors: any;
    t: (key: string, params?: any) => string;
    stopAudio: () => void;
    audioDownloading: boolean;
    audioDownloadProgress: { downloaded: number; total: number };
    audioDownloaded: boolean;
    handleDownloadAudio: () => void;
    playPrevAyah: () => void;
    playNextAyah: () => void;
    togglePlayPause: () => void;
    audioLoading: boolean;
    isPlaying: boolean;
    scrollToCurrentAyah: () => void;
}

/** Floating audio controls bar shown at the bottom of the reading view. */
export default function FloatingAudioPlayer({
    currentSurahAr,
    currentAyahIndex,
    tabBarHeight,
    isDark,
    goldTint,
    colors,
    t,
    stopAudio,
    audioDownloading,
    audioDownloadProgress,
    audioDownloaded,
    handleDownloadAudio,
    playPrevAyah,
    playNextAyah,
    togglePlayPause,
    audioLoading,
    isPlaying,
    scrollToCurrentAyah,
}: FloatingAudioPlayerProps) {
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
                <TouchableOpacity onPress={playNextAyah} style={s.floatingIconBtn} disabled={currentAyahIndex >= currentSurahAr.ayahs.length - 1} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="skip-next" size={26} color={currentAyahIndex < currentSurahAr.ayahs.length - 1 ? colors.text.primary : colors.text.tertiary} />
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
}
