/**
 * MagicalButton — Reusable themed button with shimmer effect.
 * Extracted from index.tsx to reduce the Home screen file size.
 *
 * Also exports MagicalArrowButton for left/right navigation arrows.
 */
import React from 'react';
import { TouchableOpacity, Animated, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SepiaColors } from '../../../constants/sepiaColors';
import type { HomeStyles } from './homeTypes';

// ── MagicalButton ────────────────────────────────────────────────────

export interface MagicalButtonProps {
    onPress?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    glowColor?: string;
    /** Pre-computed gold-tint border color, e.g. gt(0.3) */
    borderColor: string;
    /** styles.buttonShimmer from the parent StyleSheet */
    shimmerStyle: StyleProp<ViewStyle>;
    /** buttonShimmerAnimation from useHomeAnimations */
    shimmerAnimation: Animated.Value;
}

export const MagicalButton = ({
    onPress,
    onLongPress,
    disabled = false,
    style,
    children,
    borderColor,
    shimmerStyle,
    shimmerAnimation,
}: MagicalButtonProps) => (
    <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        activeOpacity={0.7}
        style={[
            {
                backgroundColor: 'rgba(255,255,255,0.1)',
                padding: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor,
            },
            style,
        ]}
    >
        {/* Button shimmer effect */}
        <Animated.View
            style={[
                shimmerStyle,
                {
                    opacity: shimmerAnimation.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0.2, 0],
                    }),
                    transform: [
                        {
                            translateX: shimmerAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-100, 200],
                            }),
                        },
                    ],
                },
            ]}
            pointerEvents="none"
        />
        {children}
    </TouchableOpacity>
);

// ── MagicalArrowButton ───────────────────────────────────────────────

export interface MagicalArrowButtonProps {
    direction: 'left' | 'right';
    onPress: () => void;
    disabled?: boolean;
    iconName: string;
    /** arrowBounceAnimation from useHomeAnimations */
    arrowBounceAnimation: Animated.Value;
    /** breathingAnimation from useHomeAnimations */
    breathingAnimation: Animated.Value;
    /** styles.navButton from parent StyleSheet */
    navButtonStyle: StyleProp<ViewStyle>;
    /** MagicalButton shared props (borderColor, shimmerStyle, shimmerAnimation) */
    mbShared: Pick<MagicalButtonProps, 'borderColor' | 'shimmerStyle' | 'shimmerAnimation'>;
}

export const MagicalArrowButton = ({
    direction,
    onPress,
    disabled = false,
    iconName,
    arrowBounceAnimation,
    breathingAnimation,
    navButtonStyle,
    mbShared,
}: MagicalArrowButtonProps) => (
    <MagicalButton
        onPress={onPress}
        disabled={disabled}
        style={[
            navButtonStyle,
            { opacity: disabled ? 0.4 : 1 },
        ]}
        glowColor={disabled ? SepiaColors.special.disabled : SepiaColors.accent.gold}
        {...mbShared}
    >
        <Animated.View
            style={[
                {
                    transform: [
                        {
                            translateX: arrowBounceAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: direction === 'left' ? [-2, 2] : [2, -2],
                            }),
                        },
                        { scale: breathingAnimation },
                    ],
                },
            ]}
        >
            <MaterialCommunityIcons
                name={iconName as any}
                size={28}
                color={disabled ? SepiaColors.special.disabled : SepiaColors.accent.gold}
            />
        </Animated.View>
    </MagicalButton>
);
