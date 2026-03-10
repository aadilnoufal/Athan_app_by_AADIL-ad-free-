/**
 * Tests for EnhancedCircularProgress component.
 *
 * Verifies:
 * - Displays "Next Prayer" label for normal prayers (Fajr, Dhuhr, etc.)
 * - Displays "Next" label (not "Next Prayer") when next prayer is Sunrise
 * - Displays iqama label in iqama countdown mode
 * - Displays correct prayer name for each case
 * - Handles "Fajr (Tomorrow)" correctly
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { EnhancedCircularProgress } from '../../../app/components/home/EnhancedCircularProgress';

// ── Mocks ────────────────────────────────────────────────────────────

// Mock react-native-svg to avoid native module errors in tests
jest.mock('react-native-svg', () => {
    const React = require('react');
    const MockSvg = (props: any) => React.createElement('Svg', props);
    const MockCircle = (props: any) => React.createElement('Circle', props);
    const MockDefs = (props: any) => React.createElement('Defs', props);
    const MockLinearGradient = (props: any) => React.createElement('LinearGradient', props);
    const MockStop = (props: any) => React.createElement('Stop', props);
    return {
        __esModule: true,
        default: MockSvg,
        Svg: MockSvg,
        Circle: MockCircle,
        Defs: MockDefs,
        LinearGradient: MockLinearGradient,
        Stop: MockStop,
    };
});

// Mock AnimatedPrayerIcon to avoid icon-library dependencies
jest.mock('../../../app/components/home/AnimatedPrayerIcon', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: (props: any) => React.createElement('AnimatedPrayerIcon', props),
    };
});

// ── Translation helper ──────────────────────────────────────────────

/** Simple translation mock that returns the key's English value */
const translations: Record<string, string> = {
    nextPrayer: 'Next Prayer',
    next: 'Next',
    iqamaLabel: 'Iqama',
    Fajr: 'Fajr',
    Sunrise: 'Sunrise',
    Dhuhr: 'Dhuhr',
    Asr: 'Asr',
    Maghrib: 'Maghrib',
    Isha: 'Isha',
    tomorrow: 'Tomorrow',
};

const t = (key: string) => translations[key] ?? key;

// ── Minimal styles stub ─────────────────────────────────────────────

const stubStyles: any = {
    enhancedCircularContainer: {},
    circularGlow: {},
    circularProgress: {},
    circularContent: {},
    nextPrayerLabel: {},
    nextPrayerName: {},
    nextPrayerTime: {},
    countdown: {},
};

// ── Shared animation values ─────────────────────────────────────────

const glowAnimation = new Animated.Value(0);
const breathingAnimation = new Animated.Value(1);

// ── Helpers ─────────────────────────────────────────────────────────

const baseProps = {
    progress: 0.5,
    size: 200,
    strokeWidth: 14,
    styles: stubStyles,
    t,
    glowAnimation,
    breathingAnimation,
    countdown: '01:30:00',
};

// ── Tests ───────────────────────────────────────────────────────────

describe('EnhancedCircularProgress', () => {
    it('shows "Next Prayer" label for a regular prayer like Fajr', () => {
        const { getByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={{ name: 'Fajr', time: '5:30 AM', timeRaw: '05:30', date: new Date() }}
            />,
        );
        expect(getByText('Next Prayer')).toBeTruthy();
        expect(getByText('Fajr')).toBeTruthy();
    });

    it('shows "Next" (not "Next Prayer") when next is Sunrise', () => {
        const { getByText, queryByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={{ name: 'Sunrise', time: '6:45 AM', timeRaw: '06:45', date: new Date() }}
            />,
        );
        expect(getByText('Next')).toBeTruthy();
        expect(queryByText('Next Prayer')).toBeNull();
        expect(getByText('Sunrise')).toBeTruthy();
    });

    it('shows "Next Prayer" label for Dhuhr', () => {
        const { getByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={{ name: 'Dhuhr', time: '12:30 PM', timeRaw: '12:30', date: new Date() }}
            />,
        );
        expect(getByText('Next Prayer')).toBeTruthy();
    });

    it('shows "Next Prayer" label for Asr', () => {
        const { getByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={{ name: 'Asr', time: '3:45 PM', timeRaw: '15:45', date: new Date() }}
            />,
        );
        expect(getByText('Next Prayer')).toBeTruthy();
    });

    it('shows "Next Prayer" label for Maghrib', () => {
        const { getByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={{ name: 'Maghrib', time: '6:15 PM', timeRaw: '18:15', date: new Date() }}
            />,
        );
        expect(getByText('Next Prayer')).toBeTruthy();
    });

    it('shows "Next Prayer" label for Isha', () => {
        const { getByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={{ name: 'Isha', time: '8:00 PM', timeRaw: '20:00', date: new Date() }}
            />,
        );
        expect(getByText('Next Prayer')).toBeTruthy();
    });

    it('shows iqama label when in iqama mode', () => {
        const { getByText, queryByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={{ name: 'Dhuhr', time: '12:30 PM', timeRaw: '12:30', date: new Date() }}
                countdownMode="iqama"
                iqamaPrayerName="Dhuhr"
            />,
        );
        expect(getByText('Iqama')).toBeTruthy();
        expect(queryByText('Next Prayer')).toBeNull();
        expect(queryByText('Next')).toBeNull();
    });

    it('handles Fajr (Tomorrow) with "Next Prayer" label', () => {
        const { getByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={{ name: 'Fajr (Tomorrow)', time: '5:30 AM', timeRaw: '05:30', date: new Date() }}
            />,
        );
        expect(getByText('Next Prayer')).toBeTruthy();
        expect(getByText('Fajr (Tomorrow)')).toBeTruthy();
    });

    it('renders nothing inside the center when nextPrayer is null', () => {
        const { queryByText } = render(
            <EnhancedCircularProgress
                {...baseProps}
                nextPrayer={null}
            />,
        );
        expect(queryByText('Next Prayer')).toBeNull();
        expect(queryByText('Next')).toBeNull();
    });
});
