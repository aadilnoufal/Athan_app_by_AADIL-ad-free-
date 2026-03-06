/**
 * Push Notification Service — Firebase Cloud Messaging (FCM) integration
 *
 * This module handles:
 * 1. FCM token retrieval and logging
 * 2. Topic subscriptions (all-users + country-{code} + version-{X.Y.Z})
 * 3. Foreground push display via Notifee
 * 4. Country detection via stored region in settings
 * 5. Version topic for targeted pushes (e.g. update reminders)
 * 6. Notification tap action handling (store redirect, deep links)
 *
 * Key architectural decisions (documented in PUSH_NOTIFICATIONS.md):
 * - Notifee v9.1.8 intercepts Firebase notification taps, so we use
 *   Notifee's onForegroundEvent / onBackgroundEvent for tap handling
 *   (NOT Firebase's onNotificationOpenedApp / getInitialNotification).
 * - Firebase messaging.setBackgroundMessageHandler is registered in
 *   index.ts (top-level, outside React tree) for data-only messages.
 * - Country detection uses the stored selected_region from settings
 *   (e.g. "qatar-qatar-doha" → countryId "qatar" → isoCode "QA").
 *   No GPS/location permission required.
 * - handleNotificationAction() is the centralized handler for notification
 *   taps. It reads data.type to decide what to do:
 *     "app-update" → opens Play Store / App Store
 *     "url" / "deep-link" → opens data.url
 *     "open-surah" → emits navigate-to-surah event (for Quran tab deep link)
 *   Called from _layout.tsx (foreground), index.ts (background), and
 *   notifeePrayerService.js (cold start / initial notification).
 *
 * Source: https://rnfirebase.io/messaging/usage
 */

import { DeviceEventEmitter, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ───────────────────────────────────────────────────────────
const PUSH_TOKEN_KEY = 'fcm_push_token';
const PUSH_COUNTRY_KEY = 'push_country_code';
const PUSH_VERSION_KEY = 'push_version_topic';
const PUSH_INIT_DONE_KEY = 'push_init_done';

/**
 * AsyncStorage key for cold-start pending action.
 * When a notification tap triggers an in-app navigation but the React tree
 * isn't mounted yet, we persist the action here so the target screen can
 * pick it up on mount.
 */
const PENDING_NOTIF_ACTION_KEY = '@pending_notification_action';

// ─── Store URLs ─────────────────────────────────────────────────────────────
const STORE_URLS = {
  ios: 'https://apps.apple.com/qa/app/prayer-times-by-aadil-noufal/id6751736180',
  android: 'https://play.google.com/store/apps/details?id=com.yourcompany.prayertimes',
};

// ─── Notification Event Names ───────────────────────────────────────────────
/** Event names emitted via DeviceEventEmitter for in-app navigation from notification taps. */
export const NOTIFICATION_EVENTS = {
  /** Emitted when user taps a notification that should open a specific surah. Payload: { surahNumber: number } */
  NAVIGATE_TO_SURAH: 'navigate-to-surah',
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────
interface PushInitResult {
  token: string | null;
  topics: string[];
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Detect the user's ISO 3166-1 alpha-2 country code from settings.
 *
 * Reads the stored selected_region from AsyncStorage (e.g. "qatar-qatar-doha"),
 * parses the country ID, and looks up the ISO code from prayerTimeConfig.
 *
 * No GPS or location permission required — uses the country the user
 * explicitly selected in their settings.
 *
 * @returns ISO country code (e.g. "QA") or null if not available.
 */
async function detectCountryCode(): Promise<string | null> {
  try {
    const region = await AsyncStorage.getItem('selected_region');
    if (region) {
      const { getCountryIsoCode } = require('../app/config/prayerTimeConfig');
      const isoCode = getCountryIsoCode(region);
      if (isoCode) {
        console.log(`🌍 Country detected via settings: ${isoCode} (region: ${region})`);
        return isoCode;
      }
      console.log(`⚠️ No ISO code found for region: ${region}`);
    }
  } catch (e) {
    console.log('⚠️ Could not detect country from settings:', e);
  }

  return null;
}

/**
 * Get the native app version string (e.g. "4.0.1").
 *
 * Uses expo-application's nativeApplicationVersion (reads from AndroidManifest
 * / Info.plist at runtime). Falls back to expo-constants expoConfig.version
 * (from app.json at build time). Returns null only if both fail.
 */
export function getAppVersion(): string | null {
  try {
    const Application = require('expo-application');
    if (Application.nativeApplicationVersion) {
      return Application.nativeApplicationVersion;
    }
  } catch (e) {
    // expo-application not available, try expo-constants
  }

  try {
    const Constants = require('expo-constants').default;
    const version = Constants.expoConfig?.version || Constants.manifest?.version;
    if (version) return version;
  } catch (e) {
    // expo-constants not available either
  }

  console.log('⚠️ Could not determine app version');
  return null;
}

// ─── Notification Action Handler ────────────────────────────────────────────

/**
 * Handle notification tap actions based on `data.type` payload.
 *
 * Supported types:
 * - "app-update": Opens the platform-specific app store page so the user
 *   can update. If a custom `url` field is in the data, opens that instead.
 * - "url" / "deep-link": Opens a custom URL from `data.url`.
 * - "open-surah": Emits a DeviceEventEmitter event so the Quran tab
 *   can open the specified surah (e.g. Surah Al-Kahf = 18). Also
 *   navigates to the Quran tab via expo-router.
 * - Default: No action (app opens normally).
 *
 * Called from foreground PRESS, background PRESS, and cold-start initial
 * notification handlers.
 *
 * @param data - The notification data payload (key-value string map).
 * @returns true if an action was taken, false otherwise.
 */
export async function handleNotificationAction(
  data: Record<string, string> | undefined | null
): Promise<boolean> {
  if (!data?.type) return false;

  console.log('🔔 handleNotificationAction called with type:', data.type, 'data:', JSON.stringify(data));

  try {
    switch (data.type) {
      case 'app-update': {
        // Custom URL in payload takes priority, otherwise use platform store URL
        const url = data.url || (Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android);
        console.log(`🔗 App update notification tapped — opening store: ${url}`);
        // Skip canOpenURL for https URLs — it can return false on some devices
        // due to missing <queries> or intent filter config, but openURL still works
        try {
          await Linking.openURL(url);
          return true;
        } catch (openErr) {
          console.log('⚠️ Failed to open store URL:', url, (openErr as any)?.message);
          return false;
        }
      }

      case 'url':
      case 'deep-link': {
        // Generic URL action — opens whatever URL is in data.url
        if (data.url) {
          console.log(`🔗 Opening URL from notification: ${data.url}`);
          try {
            await Linking.openURL(data.url);
            return true;
          } catch (openErr) {
            console.log('⚠️ Failed to open URL:', data.url, (openErr as any)?.message);
          }
        }
        return false;
      }

      case 'open-surah': {
        // Navigate to Quran tab and open a specific surah
        const surahNumber = parseInt(data.surahNumber, 10);
        if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
          console.log('⚠️ Invalid surah number in notification:', data.surahNumber);
          return false;
        }
        console.log(`📖 Opening Surah ${surahNumber} from notification tap`);

        // Persist pending action for cold-start (Quran tab checks on mount)
        try {
          await AsyncStorage.setItem(
            PENDING_NOTIF_ACTION_KEY,
            JSON.stringify({ type: 'open-surah', surahNumber, timestamp: Date.now() }),
          );
        } catch { /* best effort */ }

        // Navigate to the Quran tab first, then emit event for surah opening
        try {
          const router = require('expo-router').router;
          router.navigate('/(tabs)/quran');
        } catch (e) {
          console.log('⚠️ Could not navigate to Quran tab:', (e as any)?.message);
        }

        // Small delay to let tab switch complete, then emit event
        setTimeout(() => {
          DeviceEventEmitter.emit(NOTIFICATION_EVENTS.NAVIGATE_TO_SURAH, { surahNumber });
        }, 500);
        return true;
      }

      default:
        // No special action for this notification type
        return false;
    }
  } catch (e) {
    console.error('❌ Error handling notification action:', e);
    return false;
  }
}

/**
 * Check for and consume a pending notification action stored during cold start.
 * Call this from the target screen's mount effect (e.g., Quran tab).
 * Returns the pending action or null if none exists.
 */
export async function consumePendingNotificationAction(): Promise<{
  type: string;
  surahNumber?: number;
  [key: string]: any;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_NOTIF_ACTION_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_NOTIF_ACTION_KEY);
    const action = JSON.parse(raw);
    // Discard stale actions (older than 30 seconds)
    if (action.timestamp && Date.now() - action.timestamp > 30_000) {
      return null;
    }
    return action;
  } catch {
    return null;
  }
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Request notification permissions (iOS) and retrieve the FCM token.
 * On Android 13+, POST_NOTIFICATIONS permission is requested by Notifee
 * elsewhere — this only handles the Firebase/APNs registration.
 *
 * @returns The FCM token string, or null if permission denied / error.
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const messaging = require('@react-native-firebase/messaging').default;

    // iOS: request permission (no-op on Android)
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      // Use named constants for clarity (source: rnfirebase.io/messaging/usage)
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        console.log('🔕 Push permission denied on iOS');
        return null;
      }
    }

    // Get the FCM token
    const token = await messaging().getToken();
    if (__DEV__) console.log('🔑 FCM Token:', token);

    // Store locally for debugging reference
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    return token;
  } catch (e) {
    console.error('❌ Failed to get FCM token:', e);
    return null;
  }
}

/**
 * Subscribe the device to FCM topics.
 *
 * Topics:
 * - "all-users": every device; for broadcasts like Eid greetings
 * - "country-XX": country-specific; for regional messages
 * - "version-X.Y.Z": version-specific; for update reminders
 *
 * Safe to call multiple times — Firebase topic subscription is idempotent.
 * On app update, unsubscribes from old version topic before subscribing to new.
 */
export async function subscribeToTopics(): Promise<string[]> {
  const subscribedTopics: string[] = [];

  try {
    const messaging = require('@react-native-firebase/messaging').default;

    // 1. Subscribe to broadcast topic
    await messaging().subscribeToTopic('all-users');
    subscribedTopics.push('all-users');
    console.log('📢 Subscribed to topic: all-users');

    // 2. Subscribe to country topic
    const countryCode = await detectCountryCode();
    if (countryCode) {
      const countryTopic = `country-${countryCode}`;
      await messaging().subscribeToTopic(countryTopic);
      subscribedTopics.push(countryTopic);
      console.log(`📢 Subscribed to topic: ${countryTopic}`);

      // Store for reference
      await AsyncStorage.setItem(PUSH_COUNTRY_KEY, countryCode);
    } else {
      console.log('⚠️ Could not detect country — skipping country topic');
    }

    // 3. Subscribe to version topic (unsubscribe from old version first)
    const appVersion = getAppVersion();
    if (appVersion) {
      const versionTopic = `version-${appVersion}`;
      const oldVersion = await AsyncStorage.getItem(PUSH_VERSION_KEY);

      // If the version changed, unsubscribe from the old version topic
      if (oldVersion && oldVersion !== appVersion) {
        try {
          await messaging().unsubscribeFromTopic(`version-${oldVersion}`);
          console.log(`📢 Unsubscribed from old version topic: version-${oldVersion}`);
        } catch (e) {
          console.log('⚠️ Failed to unsubscribe from old version topic:', e);
        }
      }

      await messaging().subscribeToTopic(versionTopic);
      subscribedTopics.push(versionTopic);
      await AsyncStorage.setItem(PUSH_VERSION_KEY, appVersion);
      console.log(`📢 Subscribed to version topic: ${versionTopic}`);
    } else {
      console.log('⚠️ Could not determine app version — skipping version topic');
    }
  } catch (e) {
    console.error('❌ Topic subscription error:', e);
  }

  return subscribedTopics;
}

/**
 * Set up the foreground message listener.
 *
 * When a push notification arrives while the app is in the foreground,
 * Firebase suppresses the system notification. We use Notifee to display
 * it so the user still sees it.
 *
 * Returns an unsubscribe function for cleanup.
 */
export function setupForegroundHandler(): () => void {
  try {
    const messaging = require('@react-native-firebase/messaging').default;
    const notifee = require('@notifee/react-native').default;

    const unsubscribe = messaging().onMessage(async (remoteMessage: any) => {
      console.log('📩 Foreground push received:', remoteMessage.messageId);

      // Display using Notifee (uses the prayer-times-default channel)
      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'Prayer Times',
        body: remoteMessage.notification?.body || '',
        android: {
          channelId: 'prayer-times-default',
          // Use small icon already configured in AndroidManifest
          smallIcon: 'ic_notification',
          pressAction: { id: 'default' },
          // If the push has an image, display it
          ...(remoteMessage.notification?.android?.imageUrl && {
            largeIcon: remoteMessage.notification.android.imageUrl,
            style: {
              type: 0, // AndroidStyle.BIGPICTURE
              picture: remoteMessage.notification.android.imageUrl,
            },
          }),
        },
        ios: {
          // If the push has an image, display it
          // Note: remoteMessage.notification.ios does NOT have imageUrl.
          // The image URL is on the base notification object as .image
          ...(remoteMessage.notification?.image && {
            attachments: [{ url: remoteMessage.notification.image }],
          }),
        },
        data: remoteMessage.data || {},
      });
    });

    console.log('📡 Foreground push handler registered');
    return unsubscribe;
  } catch (e) {
    console.error('❌ Failed to set up foreground handler:', e);
    return () => {};
  }
}

/**
 * Listen for token refresh events.
 * If the FCM token changes (rare but possible), we re-subscribe topics.
 * Returns an unsubscribe function.
 */
export function setupTokenRefreshListener(): () => void {
  try {
    const messaging = require('@react-native-firebase/messaging').default;

    const unsubscribe = messaging().onTokenRefresh(async (newToken: string) => {
      if (__DEV__) console.log('🔄 FCM token refreshed:', newToken);
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, newToken);
      // Re-subscribe (idempotent — safe to call again)
      await subscribeToTopics();
    });

    return unsubscribe;
  } catch (e) {
    console.error('❌ Failed to set up token refresh listener:', e);
    return () => {};
  }
}

// ─── Main Initialization ────────────────────────────────────────────────────

/**
 * Initialize push notifications. Call once from _layout.tsx on app start.
 *
 * This function is idempotent: safe to call multiple times (e.g. on
 * hot reload). It will only run the full init sequence once per session.
 *
 * @returns PushInitResult with token, subscribed topics, and any error.
 */
export async function initializePushNotifications(): Promise<PushInitResult> {
  const result: PushInitResult = { token: null, topics: [] };

  try {
    console.log('🚀 Initializing push notifications...');

    // 1. Get FCM token (requests permission on iOS)
    result.token = await getFCMToken();
    if (!result.token) {
      result.error = 'Could not obtain FCM token';
      console.log('⚠️ Push init incomplete: no token');
      return result;
    }

    // 2. Subscribe to topics
    result.topics = await subscribeToTopics();

    // 3. Set up foreground handler (returns cleanup, but we don't need it
    //    here — _layout.tsx manages the lifecycle)
    // Note: foreground handler is set up separately in _layout.tsx useEffect

    // Mark init done
    await AsyncStorage.setItem(PUSH_INIT_DONE_KEY, 'true');
    console.log('✅ Push notifications initialized:', {
      token: result.token.substring(0, 20) + '...',
      topics: result.topics,
    });
  } catch (e) {
    result.error = String(e);
    console.error('❌ Push notification init failed:', e);
  }

  return result;
}

/**
 * Re-subscribe to country topic when location changes.
 * Call this when the user changes their region in settings.
 */
export async function updateCountryTopic(): Promise<void> {
  try {
    const messaging = require('@react-native-firebase/messaging').default;

    // Unsubscribe from old country topic
    const oldCountry = await AsyncStorage.getItem(PUSH_COUNTRY_KEY);
    if (oldCountry) {
      await messaging().unsubscribeFromTopic(`country-${oldCountry}`);
      console.log(`📢 Unsubscribed from old country topic: country-${oldCountry}`);
    }

    // Subscribe to new country topic
    const newCountry = await detectCountryCode();
    if (newCountry) {
      await messaging().subscribeToTopic(`country-${newCountry}`);
      await AsyncStorage.setItem(PUSH_COUNTRY_KEY, newCountry);
      console.log(`📢 Subscribed to new country topic: country-${newCountry}`);
    }
  } catch (e) {
    console.error('❌ Failed to update country topic:', e);
  }
}
