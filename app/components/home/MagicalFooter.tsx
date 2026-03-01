/**
 * MagicalFooter — Animated footer with moon icon, app name, and star.
 * Extracted from index.tsx to reduce the Home screen file size.
 */
import React from 'react';
import { View, Text, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { HomeStyles } from './homeTypes';

const { width: screenWidth } = Dimensions.get('window');

export interface MagicalFooterProps {
    styles: HomeStyles;
    /** Theme colors object (C alias) */
    C: any;
    /** Translation function */
    t: (key: string, params?: any) => string;
    /** Animations from useHomeAnimations */
    footerBreathingAnimation: Animated.Value;
    footerShimmerAnimation: Animated.Value;
    moonPhaseAnimation: Animated.Value;
    footerStarAnimation: Animated.Value;
}

export const MagicalFooter = ({
    styles,
    C,
    t,
    footerBreathingAnimation,
    footerShimmerAnimation,
    moonPhaseAnimation,
    footerStarAnimation,
}: MagicalFooterProps) => (
    <Animated.View
        style={[
            styles.magicalFooter,
            {
                opacity: footerBreathingAnimation.interpolate({
                    inputRange: [1, 1.05],
                    outputRange: [0.9, 1],
                }),
            },
        ]}
    >
        {/* Footer background shimmer */}
        <Animated.View
            style={[
                styles.footerShimmer,
                {
                    opacity: footerShimmerAnimation.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.1, 0.3, 0.1],
                    }),
                    transform: [
                        {
                            translateX: footerShimmerAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-100, screenWidth + 100],
                            }),
                        },
                    ],
                },
            ]}
        />

        {/* Footer content */}
        <View style={styles.footerContent}>
            <Animated.View
                style={[
                    styles.footerMoon,
                    {
                        transform: [
                            {
                                scale: moonPhaseAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.1],
                                }),
                            },
                            {
                                rotate: moonPhaseAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0deg', '15deg'],
                                }),
                            },
                        ],
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name="moon-waning-crescent"
                    size={24}
                    color={C.accent.amber}
                    style={{ opacity: 0.8 }}
                />
            </Animated.View>

            <Text style={styles.footerText}>
                ✨ {t('appName')} - {new Date().getFullYear()} ✨
            </Text>

            <Animated.View
                style={[
                    styles.footerStar,
                    {
                        transform: [
                            {
                                scale: footerStarAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.8, 1.2],
                                }),
                            },
                            {
                                rotate: footerStarAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0deg', '360deg'],
                                }),
                            },
                        ],
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name="star-four-points"
                    size={20}
                    color={C.accent.gold}
                    style={{ opacity: 0.7 }}
                />
            </Animated.View>
        </View>
    </Animated.View>
);
