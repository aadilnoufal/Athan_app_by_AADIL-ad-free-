import { useState, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * Manages all Animated.Value declarations and the time-based gradient
 * for the Home screen. All animation values are already allocated here;
 * the actual animation loops are currently disabled (driver conflicts).
 */
export function useHomeAnimations(colors: any, isDark: boolean) {
  const C = colors;

  // ✨ MAGICAL ANIMATIONS & VISUAL ENHANCEMENTS ✨
  const [glowAnimation] = useState(new Animated.Value(0));
  const [breathingAnimation] = useState(new Animated.Value(1));
  const [shimmerAnimation] = useState(new Animated.Value(0));
  const [headerGlowAnimation] = useState(new Animated.Value(0));
  const [footerStarAnimation] = useState(new Animated.Value(0));
  const [moonPhaseAnimation] = useState(new Animated.Value(0));
  const [footerBreathingAnimation] = useState(new Animated.Value(1));

  // ✨ MAGICAL BUTTON ANIMATIONS ✨
  const [arrowBounceAnimation] = useState(new Animated.Value(0));
  const [refreshSpinAnimation] = useState(new Animated.Value(0));

  // Separate shimmer animations that require layout properties (non-native driver)
  const [footerShimmerAnimation] = useState(new Animated.Value(0));
  const [buttonShimmerAnimation] = useState(new Animated.Value(0));

  // ✨ MAGICAL ANIMATIONS SETUP ✨
  useEffect(() => {
    // TEMPORARILY DISABLED - All magical animations commented out to fix driver conflicts
    console.log('🚫 Magical animations temporarily disabled to fix driver conflicts');
  }, []);

  // Time-based gradient colors for dynamic backgrounds
  const getTimeBasedGradient = (): string[] => {
    const hour = new Date().getHours();
    // Provide a simplified darker gradient palette when in dark mode for better contrast
    if (isDark) {
      return [
        C.background.primary,
        C.background.secondary,
        C.surface.primary,
      ];
    }
    if (hour >= 5 && hour < 7) {
      return [C.background.primary, C.background.secondary, C.surface.secondary];
    } else if (hour >= 7 && hour < 12) {
      return [C.background.primary, C.surface.elevated, C.background.tertiary];
    } else if (hour >= 12 && hour < 15) {
      return [C.surface.elevated, C.background.secondary, C.surface.secondary];
    } else if (hour >= 15 && hour < 18) {
      return [C.background.secondary, C.background.tertiary, C.surface.secondary];
    } else if (hour >= 18 && hour < 20) {
      return [C.background.tertiary, C.surface.secondary, C.background.tertiary];
    } else {
      return [C.surface.secondary, C.background.tertiary, C.surface.secondary];
    }
  };

  return {
    // Animation values
    glowAnimation,
    breathingAnimation,
    shimmerAnimation,
    headerGlowAnimation,
    footerStarAnimation,
    moonPhaseAnimation,
    footerBreathingAnimation,
    arrowBounceAnimation,
    refreshSpinAnimation,
    footerShimmerAnimation,
    buttonShimmerAnimation,
    // Gradient helper
    getTimeBasedGradient,
  };
}
