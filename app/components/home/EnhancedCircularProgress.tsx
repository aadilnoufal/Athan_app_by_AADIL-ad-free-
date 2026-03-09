/**
 * EnhancedCircularProgress — Animated circular countdown with prayer info.
 * Extracted from index.tsx to reduce the Home screen file size.
 */
import React from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { SepiaColors } from '../../../constants/sepiaColors';
import AnimatedPrayerIcon from './AnimatedPrayerIcon';
import type { HomeStyles } from './homeTypes';
import type { NextPrayer } from './homeTypes';

export interface EnhancedCircularProgressProps {
    progress: number;
    size: number;
    strokeWidth: number;
    styles: HomeStyles;
    /** Translation function */
    t: (key: string, params?: any) => string;
    /** Animations from useHomeAnimations */
    glowAnimation: Animated.Value;
    breathingAnimation: Animated.Value;
    /** Current next prayer (may be null) */
    nextPrayer: NextPrayer | null;
    /** Countdown string */
    countdown: string;
    /** Whether we're counting down to iqama or next prayer */
    countdownMode?: 'prayer' | 'iqama';
    /** The prayer name for which iqama countdown is shown */
    iqamaPrayerName?: string | null;
}

export const EnhancedCircularProgress = ({
    progress,
    size,
    strokeWidth,
    styles,
    t,
    glowAnimation,
    breathingAnimation,
    nextPrayer,
    countdown,
    countdownMode = 'prayer',
    iqamaPrayerName = null,
}: EnhancedCircularProgressProps) => {
    const isIqamaMode = countdownMode === 'iqama' && iqamaPrayerName;
    const displayLabel = isIqamaMode ? t('iqamaLabel') : t('nextPrayer');
    // Handle "Fajr (Tomorrow)" → translate "Fajr" part, keep "(Tomorrow)" suffix localised
    const isTomorrow = nextPrayer?.name?.includes('(Tomorrow)');
    const basePrayerName = isTomorrow ? nextPrayer!.name.replace(' (Tomorrow)', '') : nextPrayer?.name ?? '';
    const displayPrayerName = isIqamaMode
      ? t(iqamaPrayerName!)
      : (nextPrayer ? (isTomorrow ? `${t(basePrayerName)} (${t('tomorrow')})` : t(nextPrayer.name)) : '');

    return (
    <View style={styles.enhancedCircularContainer}>
        {/* Magical background glow */}
        <Animated.View
            style={[
                styles.circularGlow,
                {
                    width: size + 40,
                    height: size + 40,
                    borderRadius: (size + 40) / 2,
                    opacity: glowAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.1, 0.2],
                    }),
                },
            ]}
            pointerEvents="none"
        />

        {/* Main circular progress */}
        <Svg width={size} height={size} style={styles.circularProgress}>
            <Defs>
                <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={SepiaColors.accent.gold} />
                    <Stop offset="50%" stopColor={SepiaColors.accent.amber} />
                    <Stop offset="100%" stopColor={SepiaColors.accent.copper} />
                </LinearGradient>
            </Defs>

            {/* Background circle */}
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={(size - strokeWidth) / 2}
                stroke={SepiaColors.border.light}
                strokeWidth={strokeWidth / 2}
                fill="none"
                opacity={0.3}
            />

            {/* Progress circle with gradient */}
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={(size - strokeWidth) / 2}
                stroke="url(#progressGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${2 * Math.PI * ((size - strokeWidth) / 2)}`}
                strokeDashoffset={`${2 * Math.PI * ((size - strokeWidth) / 2) * (1 - progress)}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
        </Svg>

        {/* Center content with breathing animation */}
        <Animated.View
            style={[
                styles.circularContent,
                { transform: [{ scale: breathingAnimation }] },
            ]}
        >
            {nextPrayer && (
                <>
                    <AnimatedPrayerIcon
                        key={isIqamaMode ? `iqama-${iqamaPrayerName}` : nextPrayer.name}
                        prayer={isIqamaMode ? iqamaPrayerName! : basePrayerName}
                        active={true}
                        size={32}
                        color={isIqamaMode ? SepiaColors.accent.amber : SepiaColors.accent.gold}
                        subtle
                    />
                    <Text style={styles.nextPrayerLabel}>{displayLabel}</Text>
                    <Text style={styles.nextPrayerName}>{displayPrayerName}</Text>
                    {!isIqamaMode && (
                        <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
                    )}
                    <Text style={styles.countdown}>{countdown}</Text>
                </>
            )}
        </Animated.View>
    </View>
);
};
