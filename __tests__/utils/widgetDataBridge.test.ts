/**
 * Tests for widgetDataBridge utility.
 *
 * Verifies:
 * - updateWidgetData debouncing behaviour
 * - updateWidgetDataImmediate writes instantly
 * - updateWidgetTheme calls native module correctly
 * - getWidgetData returns stored data
 * - Graceful fallback when native module is unavailable
 */

import { NativeModules, Platform } from 'react-native';
import type { WidgetData } from '../../utils/widgetDataBridge';
import {
  updateWidgetData,
  updateWidgetDataImmediate,
  updateWidgetTheme,
  getWidgetData,
} from '../../utils/widgetDataBridge';

// ── Setup NativeModules mocks ─────────────────────────────────────
const mockSetWidgetData = jest.fn().mockResolvedValue(undefined);
const mockSetThemeMode = jest.fn().mockResolvedValue(undefined);
const mockGetWidgetData = jest.fn().mockResolvedValue('{"test":true}');

const mockSetWidgetDataIOS = jest.fn().mockResolvedValue(undefined);
const mockSetThemeModeIOS = jest.fn().mockResolvedValue(undefined);
const mockGetWidgetDataIOS = jest.fn().mockResolvedValue('{"test":"ios"}');

// ── Test data ──────────────────────────────────────────────────────
const sampleWidgetData: WidgetData = {
  times: {
    Fajr: '05:15',
    Sunrise: '06:45',
    Dhuhr: '12:10',
    Asr: '15:30',
    Maghrib: '18:05',
    Isha: '19:35',
  },
  times12h: {
    Fajr: '5:15 AM',
    Sunrise: '6:45 AM',
    Dhuhr: '12:10 PM',
    Asr: '3:30 PM',
    Maghrib: '6:05 PM',
    Isha: '7:35 PM',
  },
  date: '01-01',
  cityId: 'doha',
  themeMode: 'dark',
  lastUpdated: 1704067200000,
};

describe('widgetDataBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Default to Android
    (Platform as any).OS = 'android';
    // Set up NativeModules mocks (resolved lazily by widgetDataBridge)
    NativeModules.WidgetDataModule = {
      setWidgetData: mockSetWidgetData,
      setThemeMode: mockSetThemeMode,
      getWidgetData: mockGetWidgetData,
    };
    NativeModules.WidgetDataModuleIOS = {
      setWidgetData: mockSetWidgetDataIOS,
      setThemeMode: mockSetThemeModeIOS,
      getWidgetData: mockGetWidgetDataIOS,
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // ── updateWidgetData (debounced) ────────────────────────────────

  describe('updateWidgetData', () => {
    it('debounces writes by 500ms', () => {
      updateWidgetData(sampleWidgetData);

      // Should NOT be called immediately
      expect(mockSetWidgetData).not.toHaveBeenCalled();

      // Advance timer partially
      jest.advanceTimersByTime(400);
      expect(mockSetWidgetData).not.toHaveBeenCalled();

      // Advance past debounce threshold
      jest.advanceTimersByTime(200);
      expect(mockSetWidgetData).toHaveBeenCalledTimes(1);
    });

    it('cancels previous debounced writes when called rapidly', () => {
      updateWidgetData({ ...sampleWidgetData, cityId: 'first' });
      jest.advanceTimersByTime(300);

      updateWidgetData({ ...sampleWidgetData, cityId: 'second' });
      jest.advanceTimersByTime(600);

      // Only the second call should have executed
      expect(mockSetWidgetData).toHaveBeenCalledTimes(1);
      const writtenJSON = mockSetWidgetData.mock.calls[0][0];
      expect(JSON.parse(writtenJSON).cityId).toBe('second');
    });

    it('adds lastUpdated timestamp to the payload', () => {
      const now = 1704067200999;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      updateWidgetData(sampleWidgetData);
      jest.advanceTimersByTime(600);

      const writtenJSON = mockSetWidgetData.mock.calls[0][0];
      expect(JSON.parse(writtenJSON).lastUpdated).toBe(now);

      (Date.now as jest.Mock).mockRestore();
    });
  });

  // ── updateWidgetDataImmediate ───────────────────────────────────

  describe('updateWidgetDataImmediate', () => {
    it('writes immediately without debounce', () => {
      updateWidgetDataImmediate(sampleWidgetData);
      expect(mockSetWidgetData).toHaveBeenCalledTimes(1);
    });

    it('writes all required fields', () => {
      updateWidgetDataImmediate(sampleWidgetData);
      const writtenJSON = mockSetWidgetData.mock.calls[0][0];
      const parsed = JSON.parse(writtenJSON);
      expect(parsed.times.Fajr).toBe('05:15');
      expect(parsed.times12h.Fajr).toBe('5:15 AM');
      expect(parsed.date).toBe('01-01');
      expect(parsed.cityId).toBe('doha');
      expect(parsed.themeMode).toBe('dark');
    });
  });

  // ── updateWidgetTheme ───────────────────────────────────────────

  describe('updateWidgetTheme', () => {
    it('calls setThemeMode on Android', () => {
      updateWidgetTheme('sepia');
      expect(mockSetThemeMode).toHaveBeenCalledWith('sepia');
    });

    it('calls WidgetDataModuleIOS on iOS', () => {
      (Platform as any).OS = 'ios';
      updateWidgetTheme('dark');
      expect(mockSetThemeModeIOS).toHaveBeenCalledWith('dark');
    });
  });

  // ── getWidgetData ───────────────────────────────────────────────

  describe('getWidgetData', () => {
    it('returns stored data on Android', async () => {
      const result = await getWidgetData();
      expect(result).toBe('{"test":true}');
      expect(mockGetWidgetData).toHaveBeenCalled();
    });

    it('returns stored data on iOS', async () => {
      (Platform as any).OS = 'ios';
      const result = await getWidgetData();
      expect(result).toBe('{"test":"ios"}');
      expect(mockGetWidgetDataIOS).toHaveBeenCalled();
    });

    it('returns null on unsupported platform', async () => {
      (Platform as any).OS = 'web';
      const result = await getWidgetData();
      expect(result).toBeNull();
    });
  });
});
