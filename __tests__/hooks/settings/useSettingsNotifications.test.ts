/**
 * Tests for useSettingsNotifications hook.
 *
 * ⚠️  This hook manages the DUAL-LIBRARY notification system (notifee + expo-notifications).
 * Tests verify the state management and handler wiring, NOT the notification delivery.
 *
 * Verifies:
 * - Initial state is correct (notifications disabled by default, most prayers on)
 * - toggleNotifications enables/disables and calls correct services
 * - togglePrayerNotification updates per-prayer settings
 * - toggleSoundPreference saves azan/beep preference
 * - testNotification dispatches a test notification
 * - checkNotificationStatus retrieves and alerts current status
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Mocks (inline to avoid hoisting issues with jest-expo) ─────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
    getNotificationSettings: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    getChannels: jest.fn().mockResolvedValue([]),
    getTriggerNotifications: jest.fn().mockResolvedValue([]),
    AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0 },
  },
}));

jest.mock('expo-device', () => ({
  __esModule: true,
  isDevice: true,
}));

// Mock notifeePrayerService — these names MUST match the actual exports
jest.mock('../../../utils/notifeePrayerService', () => ({
  scheduleNotifeeTestNotification: jest.fn().mockResolvedValue(true),
  initializeNotifeePrayerNotifications: jest.fn().mockResolvedValue(true),
  getScheduledNotifeePrayerNotifications: jest.fn().mockResolvedValue([]),
  cancelAllNotifeePrayerNotifications: jest.fn().mockResolvedValue(undefined),
  cancelAllNotificationsCompletely: jest.fn().mockResolvedValue(undefined),
  getNotifeeServiceStatus: jest.fn().mockResolvedValue({
    permissions: 'authorized',
    channels: [],
    scheduled: [],
  }),
  requestExactAlarmPermission: jest.fn().mockResolvedValue(undefined),
  checkAndHandleBatteryOptimization: jest.fn().mockResolvedValue(undefined),
  checkAndHandlePowerManager: jest.fn().mockResolvedValue(undefined),
  forceRecreateNotificationChannels: jest.fn().mockResolvedValue(undefined),
}));

// Mock prayerNotificationScheduler — names match actual exports
jest.mock('../../../utils/prayerNotificationScheduler', () => ({
  ensurePrayerNotificationWindow: jest.fn().mockResolvedValue(undefined),
  forceRescheduleAllNotifications: jest.fn().mockResolvedValue(undefined),
}));

// Mock backgroundTask — names match actual exports
jest.mock('../../../utils/backgroundTask', () => ({
  setupBackgroundTask: jest.fn().mockResolvedValue(undefined),
  unregisterBackgroundTask: jest.fn().mockResolvedValue(undefined),
}));

// Mock audioHelper — name matches actual export
jest.mock('../../../utils/audioHelper', () => ({
  playTestSound: jest.fn().mockResolvedValue(true),
}));

// Get mock references via requireMock (safe from hoisting)
const notifeePrayerService = jest.requireMock('../../../utils/notifeePrayerService');
const backgroundTask = jest.requireMock('../../../utils/backgroundTask');

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

import { useSettingsNotifications } from '../../../hooks/settings/useSettingsNotifications';

describe('useSettingsNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns correct initial state (notifications disabled by default)', () => {
    const { result } = renderHook(() => useSettingsNotifications());

    // notificationsEnabled defaults to false (gets set to true via AsyncStorage in useEffect)
    expect(result.current.notificationsEnabled).toBe(false);
    expect(result.current.useAzanSound).toBe(true);
    expect(typeof result.current.toggleNotifications).toBe('function');
    expect(typeof result.current.togglePrayerNotification).toBe('function');
    expect(typeof result.current.toggleSoundPreference).toBe('function');
    expect(typeof result.current.testNotification).toBe('function');
    expect(typeof result.current.checkNotificationStatus).toBe('function');
    expect(typeof result.current.resetNotifications).toBe('function');
  });

  it('has correct default prayer settings (Sunrise off, others on)', () => {
    const { result } = renderHook(() => useSettingsNotifications());

    const settings = result.current.notificationSettings;
    expect(settings.Fajr).toBe(true);
    expect(settings.Sunrise).toBe(false); // Sunrise is off by default
    expect(settings.Dhuhr).toBe(true);
    expect(settings.Asr).toBe(true);
    expect(settings.Maghrib).toBe(true);
    expect(settings.Isha).toBe(true);
  });

  it('toggleNotifications disables and cancels notifications', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.toggleNotifications(false);
    });

    expect(result.current.notificationsEnabled).toBe(false);
    // Should call cancelAllNotificationsCompletely and unregisterBackgroundTask
    expect(notifeePrayerService.cancelAllNotificationsCompletely).toHaveBeenCalled();
    expect(backgroundTask.unregisterBackgroundTask).toHaveBeenCalled();
  });

  it('toggleNotifications enables and schedules notifications', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.toggleNotifications(true);
    });

    expect(result.current.notificationsEnabled).toBe(true);
    // initialize + background task setup
    expect(notifeePrayerService.initializeNotifeePrayerNotifications).toHaveBeenCalled();
    expect(backgroundTask.setupBackgroundTask).toHaveBeenCalled();
  });

  it('togglePrayerNotification updates individual prayer setting', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.togglePrayerNotification('Fajr', false);
    });

    expect(result.current.notificationSettings.Fajr).toBe(false);
    // Other prayers unchanged
    expect(result.current.notificationSettings.Dhuhr).toBe(true);
  });

  it('toggleSoundPreference switches between azan and beep', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    expect(result.current.useAzanSound).toBe(true);

    await act(async () => {
      await result.current.toggleSoundPreference(false);
    });

    expect(result.current.useAzanSound).toBe(false);
  });

  it('testNotification calls scheduleNotifeeTestNotification', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.testNotification();
    });

    expect(notifeePrayerService.initializeNotifeePrayerNotifications).toHaveBeenCalled();
    expect(notifeePrayerService.scheduleNotifeeTestNotification).toHaveBeenCalled();
  });

  it('checkNotificationStatus calls getNotifeeServiceStatus and shows alert', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.checkNotificationStatus();
    });

    expect(notifeePrayerService.getNotifeeServiceStatus).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });
});
