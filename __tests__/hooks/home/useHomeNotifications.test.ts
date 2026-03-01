/**
 * Tests for useHomeNotifications hook.
 *
 * Verifies:
 * - Default state (notificationsEnabled = false, default settings)
 * - Initialization calls initializeNotifeePrayerNotifications
 * - checkNotificationSettings reads permissions & AsyncStorage
 * - scheduleNotificationsForToday respects cooldown
 * - scheduleNotificationsForToday skips when disabled
 * - syncPrayerTimes / syncCurrentDay update internal refs
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mocks ──────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../../../utils/notifeePrayerService', () => ({
  initializeNotifeePrayerNotifications: jest.fn().mockResolvedValue(true),
  cancelAllNotificationsCompletely: jest.fn().mockResolvedValue(undefined),
  getScheduledNotifeePrayerNotifications: jest.fn().mockResolvedValue([]),
  getNotifeeServiceStatus: jest.fn().mockResolvedValue({ permissionsGranted: true }),
}));
const mockNotifeeSvc = jest.requireMock('../../../utils/notifeePrayerService');

jest.mock('../../../utils/prayerNotificationScheduler', () => ({
  ensurePrayerNotificationWindow: jest.fn().mockResolvedValue(undefined),
  forceRescheduleAllNotifications: jest.fn().mockResolvedValue(undefined),
}));
const mockScheduler = jest.requireMock('../../../utils/prayerNotificationScheduler');

jest.mock('../../../utils/backgroundTask', () => ({
  setupBackgroundTask: jest.fn().mockResolvedValue(true),
  unregisterBackgroundTask: jest.fn().mockResolvedValue(undefined),
  getBackgroundFetchStatus: jest.fn().mockResolvedValue({ statusText: 'Available' }),
}));
const mockBgTask = jest.requireMock('../../../utils/backgroundTask');

import { useHomeNotifications } from '../../../hooks/home/useHomeNotifications';

describe('useHomeNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Default: nothing in AsyncStorage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns correct default state', () => {
    const { result } = renderHook(() => useHomeNotifications());

    expect(result.current.notificationsEnabled).toBe(false);
    expect(result.current.notificationSettings).toEqual({
      Fajr: true,
      Sunrise: false,
      Dhuhr: true,
      Asr: true,
      Maghrib: true,
      Isha: true,
    });
    expect(typeof result.current.scheduleNotificationsForToday).toBe('function');
    expect(typeof result.current.checkNotificationSettings).toBe('function');
    expect(typeof result.current.syncPrayerTimes).toBe('function');
    expect(typeof result.current.syncCurrentDay).toBe('function');
  });

  it('initialization calls initializeNotifeePrayerNotifications', async () => {
    renderHook(() => useHomeNotifications());

    // Let the init async work settle
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    expect(mockNotifeeSvc.initializeNotifeePrayerNotifications).toHaveBeenCalledTimes(1);
  });

  it('initialization sets up background task', async () => {
    renderHook(() => useHomeNotifications());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    expect(mockBgTask.setupBackgroundTask).toHaveBeenCalledTimes(1);
    expect(mockBgTask.getBackgroundFetchStatus).toHaveBeenCalledTimes(1);
  });

  it('checkNotificationSettings loads settings from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'notifications_enabled') return Promise.resolve('true');
      if (key === 'notification_settings')
        return Promise.resolve(
          JSON.stringify({
            Fajr: false,
            Sunrise: true,
            Dhuhr: true,
            Asr: true,
            Maghrib: true,
            Isha: false,
          }),
        );
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useHomeNotifications());

    // Wait for init effect to complete (which calls checkNotificationSettings)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });

    await waitFor(() => {
      expect(result.current.notificationsEnabled).toBe(true);
    });

    expect(result.current.notificationSettings.Fajr).toBe(false);
    expect(result.current.notificationSettings.Sunrise).toBe(true);
    expect(result.current.notificationSettings.Isha).toBe(false);
  });

  it('disables notifications when permissions are not granted', async () => {
    mockNotifeeSvc.getNotifeeServiceStatus.mockResolvedValue({
      permissionsGranted: false,
    });

    const { result } = renderHook(() => useHomeNotifications());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });

    await waitFor(() => {
      expect(result.current.notificationsEnabled).toBe(false);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('notifications_enabled', 'false');
  });

  it('scheduleNotificationsForToday skips when notifications disabled', async () => {
    const { result } = renderHook(() => useHomeNotifications());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    // Ensure notifications are disabled (default)
    expect(result.current.notificationsEnabled).toBe(false);

    await act(async () => {
      await result.current.scheduleNotificationsForToday();
    });

    // Should NOT call ensurePrayerNotificationWindow
    expect(mockScheduler.ensurePrayerNotificationWindow).not.toHaveBeenCalled();
  });

  it('scheduleNotificationsForToday respects cooldown', async () => {
    // Enable notifications and supply prayer data via init
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'notifications_enabled') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useHomeNotifications());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });

    // Supply prayer data via ref
    act(() => {
      result.current.syncPrayerTimes({
        date: '01 Jan 2025',
        hijriDate: '1',
        hijriMonth: 'Muharram',
        gregorianDate: '01-01-2025',
        times: { Fajr: '05:00', Sunrise: '06:30', Dhuhr: '12:00', Asr: '15:30', Maghrib: '18:00', Isha: '19:30' },
        times12h: { Fajr: '5:00 AM', Sunrise: '6:30 AM', Dhuhr: '12:00 PM', Asr: '3:30 PM', Maghrib: '6:00 PM', Isha: '7:30 PM' },
      });
    });

    // First call should go through
    await act(async () => {
      await result.current.scheduleNotificationsForToday();
    });

    const firstCallCount = mockScheduler.ensurePrayerNotificationWindow.mock.calls.length;

    // Second immediate call should be blocked by cooldown
    await act(async () => {
      await result.current.scheduleNotificationsForToday();
    });

    expect(mockScheduler.ensurePrayerNotificationWindow).toHaveBeenCalledTimes(firstCallCount);
  });

  it('syncPrayerTimes and syncCurrentDay are callable', async () => {
    const { result } = renderHook(() => useHomeNotifications());

    // These should not throw — they update internal refs
    act(() => {
      result.current.syncPrayerTimes(null);
      result.current.syncCurrentDay(3);
    });

    // No thrown errors, refs are internal so we just verify no crash
    expect(result.current.syncPrayerTimes).toBeDefined();
    expect(result.current.syncCurrentDay).toBeDefined();
  });

  it('setNotificationsEnabled toggles state', async () => {
    const { result } = renderHook(() => useHomeNotifications());

    expect(result.current.notificationsEnabled).toBe(false);

    act(() => {
      result.current.setNotificationsEnabled(true);
    });

    expect(result.current.notificationsEnabled).toBe(true);
  });

  it('setNotificationSettings updates settings', async () => {
    const { result } = renderHook(() => useHomeNotifications());

    act(() => {
      result.current.setNotificationSettings({
        Fajr: false,
        Sunrise: true,
        Dhuhr: false,
        Asr: false,
        Maghrib: true,
        Isha: true,
      });
    });

    expect(result.current.notificationSettings.Fajr).toBe(false);
    expect(result.current.notificationSettings.Sunrise).toBe(true);
    expect(result.current.notificationSettings.Dhuhr).toBe(false);
  });

  it('does not re-initialize on re-render', async () => {
    const { rerender } = renderHook(() => useHomeNotifications());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    expect(mockNotifeeSvc.initializeNotifeePrayerNotifications).toHaveBeenCalledTimes(1);

    // Re-render — should NOT call init again (ref guard)
    rerender(undefined);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    expect(mockNotifeeSvc.initializeNotifeePrayerNotifications).toHaveBeenCalledTimes(1);
  });
});
