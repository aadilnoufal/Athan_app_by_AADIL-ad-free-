/**
 * MagicalHeader — Animated header bar with app title, refresh, and donate buttons.
 * Extracted from index.tsx to reduce the Home screen file size.
 */
import React from 'react';
import { View, Text, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MagicalButton, MagicalButtonProps } from './MagicalButton';
import type { HomeStyles } from './homeTypes';

export interface MagicalHeaderProps {
    styles: HomeStyles;
    /** Theme colors object (C alias) */
    C: any;
    /** Translation function */
    t: (key: string, params?: any) => string;
    /** Animations from useHomeAnimations */
    headerGlowAnimation: Animated.Value;
    breathingAnimation: Animated.Value;
    refreshSpinAnimation: Animated.Value;
    /** Callbacks */
    handleRefreshPress: () => void;
    refreshing: boolean;
    openDonation: () => void;
    /** MagicalButton shared props */
    mbShared: Pick<MagicalButtonProps, 'borderColor' | 'shimmerStyle' | 'shimmerAnimation'>;
}

export const MagicalHeader = ({
    styles,
    C,
    t,
    headerGlowAnimation,
    breathingAnimation,
    refreshSpinAnimation,
    handleRefreshPress,
    refreshing,
    openDonation,
    mbShared,
}: MagicalHeaderProps) => (
    <View style={[styles.magicalHeader]} pointerEvents="box-none">
        {/* Header background glow */}
        <Animated.View
            style={[
                styles.headerGlow,
                {
                    opacity: headerGlowAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.2, 0.5],
                    }),
                },
            ]}
            pointerEvents="none"
        />

        {/* Header content */}
        <View style={styles.header}>
            <Animated.Text
                style={[
                    styles.headerTitle,
                    { transform: [{ scale: breathingAnimation }] },
                ]}
            >
                {t('appName')}
            </Animated.Text>
            <View style={styles.headerButtons}>
                <MagicalButton
                    onPress={handleRefreshPress}
                    disabled={refreshing}
                    style={styles.refreshButton}
                    {...mbShared}
                >
                    <Animated.View
                        style={[
                            {
                                transform: [
                                    {
                                        rotate: refreshing
                                            ? refreshSpinAnimation.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0deg', '360deg'],
                                            })
                                            : '0deg',
                                    },
                                ],
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="refresh" size={20} color={C.accent.gold} />
                    </Animated.View>
                </MagicalButton>

                <MagicalButton
                    onPress={openDonation}
                    style={styles.donateButton}
                    glowColor={C.accent.amber}
                    {...mbShared}
                >
                    <MaterialCommunityIcons name="gift" size={20} color={C.text.inverse} />
                    <Text style={styles.donateText}>{t('supportApp')}</Text>
                </MagicalButton>
            </View>
        </View>
    </View>
);
