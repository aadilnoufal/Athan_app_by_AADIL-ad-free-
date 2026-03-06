/**
 * Tests for utils/pushNotifications.ts
 *
 * Verifies:
 * - getFCMToken retrieves token and stores it
 * - getFCMToken handles iOS permission denial
 * - subscribeToTopics subscribes to all-users, country, and version topics
 * - subscribeToTopics detects country from stored region settings
 * - subscribeToTopics handles missing country/version gracefully
 * - subscribeToTopics unsubscribes from old version on app update
 * - getAppVersion returns version from expo-application or expo-constants
 * - setupForegroundHandler registers onMessage and displays via Notifee
 * - setupTokenRefreshListener re-subscribes on token refresh
 * - initializePushNotifications orchestrates full init flow
 * - initializePushNotifications handles token failure gracefully
 * - updateCountryTopic unsubscribes old and subscribes new
 * - handleNotificationAction opens store for app-update type
 * - handleNotificationAction opens custom URL for url/deep-link type
 * - handleNotificationAction ignores unknown types
 * - handleNotificationAction navigates to surah for open-surah type
 * - consumePendingNotificationAction retrieves and clears pending actions
 */

import { Linking, Platform, DeviceEventEmitter } from 'react-native';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockGetToken = jest.fn().mockResolvedValue('mock-fcm-token-12345');
const mockRequestPermission = jest.fn().mockResolvedValue(1); // AUTHORIZED
const mockSubscribeToTopic = jest.fn().mockResolvedValue(undefined);
const mockUnsubscribeFromTopic = jest.fn().mockResolvedValue(undefined);
const mockOnMessage = jest.fn().mockReturnValue(jest.fn()); // returns unsubscribe
const mockOnTokenRefresh = jest.fn().mockReturnValue(jest.fn());

jest.mock('@react-native-firebase/messaging', () => {
  const messagingFn = () => ({
    getToken: mockGetToken,
    requestPermission: mockRequestPermission,
    subscribeToTopic: mockSubscribeToTopic,
    unsubscribeFromTopic: mockUnsubscribeFromTopic,
    onMessage: mockOnMessage,
    onTokenRefresh: mockOnTokenRefresh,
  });
  messagingFn.AuthorizationStatus = {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
    DENIED: 0,
  };
  return {
    __esModule: true,
    default: messagingFn,
  };
});

const mockDisplayNotification = jest.fn().mockResolvedValue('notif-id');
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: mockDisplayNotification,
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock prayerTimeConfig — detectCountryCode() now reads region from settings
// and uses getCountryIsoCode() to get the ISO code (no GPS needed)
const mockGetCountryIsoCode = jest.fn();
jest.mock('../../app/config/prayerTimeConfig', () => ({
  getCountryIsoCode: (...args: any[]) => mockGetCountryIsoCode(...args),
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '4.0.1',
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '4.0.1' },
  },
}));

const mockRouterNavigate = jest.fn();
jest.mock('expo-router', () => ({
  router: { navigate: (...args: any[]) => mockRouterNavigate(...args) },
}));

// ── Import after mocks ──────────────────────────────────────────────────

import {
  getFCMToken,
  subscribeToTopics,
  setupForegroundHandler,
  setupTokenRefreshListener,
  initializePushNotifications,
  updateCountryTopic,
  getAppVersion,
  handleNotificationAction,
  consumePendingNotificationAction,
  NOTIFICATION_EVENTS,
} from '../../utils/pushNotifications';

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Tests ────────────────────────────────────────────────────────────────

describe('pushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user has selected Qatar > Qatar > Doha in settings
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'selected_region') return Promise.resolve('qatar-qatar-doha');
      return Promise.resolve(null);
    });
    // Default: getCountryIsoCode returns 'QA' for Qatar
    mockGetCountryIsoCode.mockReturnValue('QA');
  });

  // ── getFCMToken ──────────────────────────────────────────────────────

  describe('getFCMToken', () => {
    it('retrieves and stores the FCM token on Android', async () => {
      (Platform as any).OS = 'android';

      const token = await getFCMToken();

      expect(token).toBe('mock-fcm-token-12345');
      expect(mockGetToken).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'fcm_push_token',
        'mock-fcm-token-12345'
      );
      // Should NOT request permission on Android
      expect(mockRequestPermission).not.toHaveBeenCalled();
    });

    it('requests permission on iOS before getting token', async () => {
      (Platform as any).OS = 'ios';

      const token = await getFCMToken();

      expect(mockRequestPermission).toHaveBeenCalled();
      expect(token).toBe('mock-fcm-token-12345');
    });

    it('returns null when iOS permission is denied', async () => {
      (Platform as any).OS = 'ios';
      mockRequestPermission.mockResolvedValueOnce(0); // DENIED

      const token = await getFCMToken();

      expect(token).toBeNull();
      expect(mockGetToken).not.toHaveBeenCalled();
    });

    it('returns null and logs error on failure', async () => {
      (Platform as any).OS = 'android';
      mockGetToken.mockRejectedValueOnce(new Error('Network error'));

      const token = await getFCMToken();

      expect(token).toBeNull();
    });
  });

  // ── subscribeToTopics ────────────────────────────────────────────────

  describe('subscribeToTopics', () => {
    it('subscribes to all-users, country, and version topics', async () => {
      const topics = await subscribeToTopics();

      expect(mockSubscribeToTopic).toHaveBeenCalledWith('all-users');
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('country-QA');
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('version-4.0.1');
      expect(topics).toEqual(['all-users', 'country-QA', 'version-4.0.1']);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'push_country_code',
        'QA'
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'push_version_topic',
        '4.0.1'
      );
    });

    it('subscribes only to all-users when country detection fails', async () => {
      // No region selected in settings → country detection returns null
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(null));

      const topics = await subscribeToTopics();

      expect(mockSubscribeToTopic).toHaveBeenCalledWith('all-users');
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('version-4.0.1');
      expect(mockSubscribeToTopic).not.toHaveBeenCalledWith(expect.stringContaining('country-'));
      expect(topics).toEqual(['all-users', 'version-4.0.1']);
    });

    it('detects country from stored region settings', async () => {
      // User selected a US region → getCountryIsoCode returns 'US'
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'selected_region') return Promise.resolve('us-california-sf');
        return Promise.resolve(null);
      });
      mockGetCountryIsoCode.mockReturnValue('US');

      const topics = await subscribeToTopics();

      expect(mockGetCountryIsoCode).toHaveBeenCalledWith('us-california-sf');
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('country-US');
      expect(topics).toContain('country-US');
    });

    it('unsubscribes from old version topic on app update', async () => {
      // Simulate: device was on 3.9.0, now on 4.0.1
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'push_version_topic') return Promise.resolve('3.9.0');
        if (key === 'selected_region') return Promise.resolve('qatar-qatar-doha');
        return Promise.resolve(null);
      });

      const topics = await subscribeToTopics();

      // Should unsubscribe from old version
      expect(mockUnsubscribeFromTopic).toHaveBeenCalledWith('version-3.9.0');
      // Should subscribe to new version
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('version-4.0.1');
      expect(topics).toContain('version-4.0.1');
    });

    it('does not unsubscribe when version is unchanged', async () => {
      // Simulate: device was already on 4.0.1 (same as current)
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'push_version_topic') return Promise.resolve('4.0.1');
        if (key === 'selected_region') return Promise.resolve('qatar-qatar-doha');
        return Promise.resolve(null);
      });

      await subscribeToTopics();

      // Should NOT unsubscribe (version unchanged)
      expect(mockUnsubscribeFromTopic).not.toHaveBeenCalled();
      // Should still subscribe (idempotent)
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('version-4.0.1');
    });

    it('handles subscription errors gracefully', async () => {
      mockSubscribeToTopic.mockRejectedValueOnce(new Error('Network error'));

      const topics = await subscribeToTopics();

      // Should return empty array on error
      expect(topics).toEqual([]);
    });
  });

  // ── setupForegroundHandler ───────────────────────────────────────────

  describe('setupForegroundHandler', () => {
    it('registers onMessage listener and returns unsubscribe', () => {
      const unsub = setupForegroundHandler();

      expect(mockOnMessage).toHaveBeenCalledTimes(1);
      expect(typeof unsub).toBe('function');
    });

    it('displays notification via Notifee when message received', async () => {
      let messageHandler: (msg: any) => Promise<void>;
      mockOnMessage.mockImplementationOnce((handler: any) => {
        messageHandler = handler;
        return jest.fn();
      });

      setupForegroundHandler();

      // Simulate a foreground push message
      await messageHandler!({
        messageId: 'test-msg-1',
        notification: {
          title: 'Eid Mubarak!',
          body: 'Wishing you a blessed Eid',
        },
        data: { type: 'greeting' },
      });

      expect(mockDisplayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Eid Mubarak!',
          body: 'Wishing you a blessed Eid',
          data: { type: 'greeting' },
        })
      );
    });

    it('handles foreground message with Android image', async () => {
      let messageHandler: (msg: any) => Promise<void>;
      mockOnMessage.mockImplementationOnce((handler: any) => {
        messageHandler = handler;
        return jest.fn();
      });

      setupForegroundHandler();

      await messageHandler!({
        messageId: 'test-msg-2',
        notification: {
          title: 'Update Available',
          body: 'Check out the new features!',
          android: { imageUrl: 'https://example.com/image.png' },
        },
        data: {},
      });

      expect(mockDisplayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({
            largeIcon: 'https://example.com/image.png',
          }),
        })
      );
    });

    it('handles foreground message with iOS image via notification.image', async () => {
      let messageHandler: (msg: any) => Promise<void>;
      mockOnMessage.mockImplementationOnce((handler: any) => {
        messageHandler = handler;
        return jest.fn();
      });

      setupForegroundHandler();

      await messageHandler!({
        messageId: 'test-msg-3',
        notification: {
          title: 'Eid Mubarak',
          body: 'Eid greetings!',
          image: 'https://example.com/eid.png',
        },
        data: {},
      });

      expect(mockDisplayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          ios: expect.objectContaining({
            attachments: [{ url: 'https://example.com/eid.png' }],
          }),
        })
      );
    });
  });

  // ── setupTokenRefreshListener ────────────────────────────────────────

  describe('setupTokenRefreshListener', () => {
    it('registers onTokenRefresh listener and returns unsubscribe', () => {
      const unsub = setupTokenRefreshListener();

      expect(mockOnTokenRefresh).toHaveBeenCalledTimes(1);
      expect(typeof unsub).toBe('function');
    });

    it('stores new token and re-subscribes on refresh', async () => {
      let refreshHandler: (token: string) => Promise<void>;
      mockOnTokenRefresh.mockImplementationOnce((handler: any) => {
        refreshHandler = handler;
        return jest.fn();
      });

      setupTokenRefreshListener();

      await refreshHandler!('new-token-67890');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'fcm_push_token',
        'new-token-67890'
      );
      // Should also re-subscribe to topics
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('all-users');
    });
  });

  // ── initializePushNotifications ──────────────────────────────────────

  describe('initializePushNotifications', () => {
    it('completes full init: token + topics + marks done', async () => {
      (Platform as any).OS = 'android';

      const result = await initializePushNotifications();

      expect(result.token).toBe('mock-fcm-token-12345');
      expect(result.topics).toContain('all-users');
      expect(result.topics).toContain('version-4.0.1');
      expect(result.error).toBeUndefined();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'push_init_done',
        'true'
      );
    });

    it('returns error when token is null', async () => {
      (Platform as any).OS = 'ios';
      mockRequestPermission.mockResolvedValueOnce(0); // denied

      const result = await initializePushNotifications();

      expect(result.token).toBeNull();
      expect(result.error).toBe('Could not obtain FCM token');
      expect(result.topics).toEqual([]);
    });

    it('handles unexpected errors gracefully', async () => {
      (Platform as any).OS = 'android';
      mockGetToken.mockRejectedValueOnce(new Error('Crash'));

      const result = await initializePushNotifications();

      expect(result.token).toBeNull();
      // Should not throw, just return error
      expect(result.error).toBeDefined();
    });
  });

  // ── getAppVersion ──────────────────────────────────────────────────

  describe('getAppVersion', () => {
    it('returns version from expo-application', () => {
      const version = getAppVersion();
      expect(version).toBe('4.0.1');
    });
  });

  // ── updateCountryTopic ───────────────────────────────────────────────

  describe('updateCountryTopic', () => {
    it('unsubscribes from old country and subscribes to new', async () => {
      // Old country was IN, user changed region to Qatar
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'push_country_code') return Promise.resolve('IN');
        if (key === 'selected_region') return Promise.resolve('qatar-qatar-doha');
        return Promise.resolve(null);
      });

      await updateCountryTopic();

      expect(mockUnsubscribeFromTopic).toHaveBeenCalledWith('country-IN');
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('country-QA');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'push_country_code',
        'QA'
      );
    });

    it('handles case when no previous country was stored', async () => {
      // No old country stored, but region is set
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'selected_region') return Promise.resolve('qatar-qatar-doha');
        return Promise.resolve(null);
      });

      await updateCountryTopic();

      expect(mockUnsubscribeFromTopic).not.toHaveBeenCalled();
      expect(mockSubscribeToTopic).toHaveBeenCalledWith('country-QA');
    });

    it('handles errors gracefully', async () => {
      mockUnsubscribeFromTopic.mockRejectedValueOnce(new Error('fail'));
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'push_country_code') return Promise.resolve('US');
        if (key === 'selected_region') return Promise.resolve('qatar-qatar-doha');
        return Promise.resolve(null);
      });

      // Should not throw
      await expect(updateCountryTopic()).resolves.not.toThrow();
    });
  });

  // ── handleNotificationAction ─────────────────────────────────────────

  describe('handleNotificationAction', () => {
    beforeEach(() => {
      (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
      mockRouterNavigate.mockClear();
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    });

    it('returns false for null/undefined data', async () => {
      expect(await handleNotificationAction(null)).toBe(false);
      expect(await handleNotificationAction(undefined)).toBe(false);
    });

    it('returns false for data without type', async () => {
      expect(await handleNotificationAction({})).toBe(false);
    });

    it('opens Play Store for app-update on Android', async () => {
      (Platform as any).OS = 'android';
      const result = await handleNotificationAction({ type: 'app-update' });

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=com.yourcompany.prayertimes'
      );
    });

    it('opens App Store for app-update on iOS', async () => {
      (Platform as any).OS = 'ios';
      const result = await handleNotificationAction({ type: 'app-update' });

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://apps.apple.com/qa/app/prayer-times-by-aadil-noufal/id6751736180'
      );
    });

    it('uses custom url from data payload for app-update if provided', async () => {
      (Platform as any).OS = 'android';
      const customUrl = 'https://example.com/update';
      const result = await handleNotificationAction({
        type: 'app-update',
        url: customUrl,
      });

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(customUrl);
    });

    it('returns false when openURL throws for app-update', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      const result = await handleNotificationAction({ type: 'app-update' });
      expect(result).toBe(false);
    });

    it('opens URL for url type', async () => {
      const result = await handleNotificationAction({
        type: 'url',
        url: 'https://example.com/promo',
      });

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/promo');
    });

    it('opens URL for deep-link type', async () => {
      const result = await handleNotificationAction({
        type: 'deep-link',
        url: 'myapp://settings',
      });

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith('myapp://settings');
    });

    it('returns false for url type without url field', async () => {
      const result = await handleNotificationAction({ type: 'url' });
      expect(result).toBe(false);
      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it('returns false for unknown type', async () => {
      const result = await handleNotificationAction({ type: 'some-unknown' });
      expect(result).toBe(false);
    });

    it('handles errors gracefully', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('fail'));
      const result = await handleNotificationAction({ type: 'app-update' });
      expect(result).toBe(false);
    });

    // ── open-surah tests ────────────────────────────────────────────────

    it('navigates to Quran tab and emits event for open-surah', async () => {
      jest.useFakeTimers();
      const emitSpy = jest.spyOn(DeviceEventEmitter, 'emit');

      const result = await handleNotificationAction({
        type: 'open-surah',
        surahNumber: '18',
      });

      expect(result).toBe(true);
      expect(mockRouterNavigate).toHaveBeenCalledWith('/(tabs)/quran');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pending_notification_action',
        expect.stringContaining('"surahNumber":18')
      );

      // Event is emitted after timeout
      jest.advanceTimersByTime(500);
      expect(emitSpy).toHaveBeenCalledWith(
        NOTIFICATION_EVENTS.NAVIGATE_TO_SURAH,
        { surahNumber: 18 }
      );

      emitSpy.mockRestore();
      jest.useRealTimers();
    });

    it('returns false for invalid surah number (0)', async () => {
      const result = await handleNotificationAction({
        type: 'open-surah',
        surahNumber: '0',
      });
      expect(result).toBe(false);
    });

    it('returns false for invalid surah number (115)', async () => {
      const result = await handleNotificationAction({
        type: 'open-surah',
        surahNumber: '115',
      });
      expect(result).toBe(false);
    });

    it('returns false for non-numeric surah number', async () => {
      const result = await handleNotificationAction({
        type: 'open-surah',
        surahNumber: 'abc',
      });
      expect(result).toBe(false);
    });

    it('returns false for missing surahNumber', async () => {
      const result = await handleNotificationAction({
        type: 'open-surah',
      });
      expect(result).toBe(false);
    });

    it('still returns true even if router.navigate throws', async () => {
      jest.useFakeTimers();
      mockRouterNavigate.mockImplementationOnce(() => {
        throw new Error('router not ready');
      });

      const result = await handleNotificationAction({
        type: 'open-surah',
        surahNumber: '1',
      });

      expect(result).toBe(true);
      jest.advanceTimersByTime(500);
      jest.useRealTimers();
    });

    it('persists pending action to AsyncStorage for cold-start', async () => {
      jest.useFakeTimers();
      await handleNotificationAction({
        type: 'open-surah',
        surahNumber: '36',
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pending_notification_action',
        expect.stringContaining('"type":"open-surah"')
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pending_notification_action',
        expect.stringContaining('"surahNumber":36')
      );
      jest.advanceTimersByTime(500);
      jest.useRealTimers();
    });
  });

  // ── consumePendingNotificationAction ──────────────────────────────────

  describe('consumePendingNotificationAction', () => {
    it('returns null when no pending action exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      const result = await consumePendingNotificationAction();
      expect(result).toBeNull();
    });

    it('returns and clears a valid pending action', async () => {
      const action = { type: 'open-surah', surahNumber: 18, timestamp: Date.now() };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(action));

      const result = await consumePendingNotificationAction();

      expect(result).toEqual(action);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pending_notification_action');
    });

    it('discards actions older than 30 seconds', async () => {
      const staleAction = { type: 'open-surah', surahNumber: 18, timestamp: Date.now() - 60_000 };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(staleAction));

      const result = await consumePendingNotificationAction();

      expect(result).toBeNull();
      // Still removed from storage
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pending_notification_action');
    });

    it('returns null on AsyncStorage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage error'));
      const result = await consumePendingNotificationAction();
      expect(result).toBeNull();
    });
  });
});