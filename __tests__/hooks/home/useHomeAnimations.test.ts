/**
 * Tests for useHomeAnimations hook.
 *
 * Verifies:
 * - All 11 Animated.Value instances are returned
 * - getTimeBasedGradient returns 3-element array for dark mode
 * - getTimeBasedGradient returns 3-element array for light mode
 * - Animation values are stable across re-renders (useState identity)
 */
import { renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { useHomeAnimations } from '../../../hooks/home/useHomeAnimations';

// ── Test colours matching dark / light palettes ─────────────────────

const mockLightColors = {
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F5F5',
    tertiary: '#E0E0E0',
  },
  surface: {
    primary: '#FAFAFA',
    secondary: '#EEEEEE',
    elevated: '#F0F0F0',
  },
};

const mockDarkColors = {
  background: {
    primary: '#1A1A1A',
    secondary: '#2A2A2A',
    tertiary: '#333333',
  },
  surface: {
    primary: '#222222',
    secondary: '#3A3A3A',
    elevated: '#2E2E2E',
  },
};

describe('useHomeAnimations', () => {
  const animationValueNames = [
    'glowAnimation',
    'breathingAnimation',
    'shimmerAnimation',
    'headerGlowAnimation',
    'footerStarAnimation',
    'moonPhaseAnimation',
    'footerBreathingAnimation',
    'arrowBounceAnimation',
    'refreshSpinAnimation',
    'footerShimmerAnimation',
    'buttonShimmerAnimation',
  ] as const;

  it('returns all 11 Animated.Value instances', () => {
    const { result } = renderHook(() => useHomeAnimations(mockLightColors, false));

    for (const name of animationValueNames) {
      expect(result.current[name]).toBeInstanceOf(Animated.Value);
    }
  });

  it('returns getTimeBasedGradient function', () => {
    const { result } = renderHook(() => useHomeAnimations(mockLightColors, false));

    expect(typeof result.current.getTimeBasedGradient).toBe('function');
  });

  it('getTimeBasedGradient returns 3-element array in dark mode', () => {
    const { result } = renderHook(() => useHomeAnimations(mockDarkColors, true));

    const gradient = result.current.getTimeBasedGradient();
    expect(Array.isArray(gradient)).toBe(true);
    expect(gradient).toHaveLength(3);

    // In dark mode it always returns the same palette regardless of time
    expect(gradient).toEqual([
      mockDarkColors.background.primary,
      mockDarkColors.background.secondary,
      mockDarkColors.surface.primary,
    ]);
  });

  it('getTimeBasedGradient returns 3-element array in light mode', () => {
    const { result } = renderHook(() => useHomeAnimations(mockLightColors, false));

    const gradient = result.current.getTimeBasedGradient();
    expect(Array.isArray(gradient)).toBe(true);
    expect(gradient).toHaveLength(3);
    // All elements should be strings (colour values)
    gradient.forEach((colour: string) => {
      expect(typeof colour).toBe('string');
    });
  });

  it('animation values are stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useHomeAnimations(mockLightColors, false));

    const firstAnimValues = animationValueNames.map((n) => result.current[n]);

    // Re-render with same props
    rerender(undefined);

    const secondAnimValues = animationValueNames.map((n) => result.current[n]);

    // Object identity should be the same (useState preserves identity)
    firstAnimValues.forEach((val, i) => {
      expect(val).toBe(secondAnimValues[i]);
    });
  });
});
