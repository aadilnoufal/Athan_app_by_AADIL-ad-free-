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
 */

import { Platform } from 'react-native';

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

// ── Import after mocks ──────────────────────────────────────────────────

import {
  getFCMToken,
  subscribeToTopics,
  setupForegroundHandler,
  setupTokenRefreshListener,
  initializePushNotifications,
  updateCountryTopic,
  getAppVersion,
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
});
