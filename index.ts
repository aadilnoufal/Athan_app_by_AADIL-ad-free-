import 'expo-router/entry';
import notifee, { EventType, AndroidImportance } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

// ============================================================================
// PRODUCTION LOG SILENCER
// Suppress verbose console.log/warn in production builds to avoid
// performance overhead and log noise. console.error is kept for
// crash-reporting integrations (e.g. Sentry, Crashlytics).
// ============================================================================
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
}

// ============================================================================
// CRITICAL: Register background handlers at TOP LEVEL
// These MUST be here (not inside a function) to work when app is closed
// ============================================================================

// ── Ensure notification channels exist before background handlers fire ────
// Channels must be created BEFORE any notification is displayed; _layout.tsx
// creates them too, but the background handler can fire before _layout mounts.
if (Platform.OS === 'android') {
  notifee.createChannel({
    id: 'default',
    name: 'Default',
    importance: AndroidImportance.DEFAULT,
  }).catch(() => {});
}

// ── Firebase: Background/quit-state push message handler ──────────────────
// When a data-only push arrives while app is killed or backgrounded,
// this handler runs. We display via Notifee for consistent UX.
// Source: https://rnfirebase.io/messaging/usage#background--quit-state-messages
try {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('🔥 Firebase background message:', remoteMessage.messageId);
    // Notification-type messages are auto-displayed by the system.
    // Data-only messages need manual display:
    if (!remoteMessage.notification) {
      await notifee.displayNotification({
        title: (remoteMessage.data?.title as string) || 'Prayer Times',
        body: (remoteMessage.data?.body as string) || '',
        android: {
          channelId: 'default',
          smallIcon: 'ic_notification',
          pressAction: { id: 'default' },
        },
        data: remoteMessage.data || {},
      });
    }
  });
} catch (e) {
  console.log('⚠️ Failed to register Firebase background handler:', e);
}

// ── Notifee: Background event handler (local notifications) ───────────────
// Handles prayer notification delivery events (rolling window top-up)
// and notification press/dismiss events when app is backgrounded.
try {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    try {
      const { notification } = detail;
      console.log('🌙 Background event (top-level):', type);

      // Handle notification tap action (e.g. open store for app-update)
      if (type === EventType.PRESS) {
        console.log('👆 Background notification pressed');
        try {
          const { handleNotificationAction } = require('./utils/pushNotifications');
          await handleNotificationAction(notification?.data as Record<string, string>);
        } catch (e) {
          console.log('⚠️ Background action handler failed:', (e as any)?.message);
        }
      }
      
      // Top up rolling window when notification is delivered in background
      if (type === EventType.DELIVERED) {
        console.log('📨 Background notification delivered');
        const prayerData = notification?.data;
        
        // Check for both prayer-time and prayer-reminder types
        if (prayerData?.type === 'prayer-time' || prayerData?.type === 'prayer-reminder' || prayerData?.type === 'iqama-reminder') {
          // Staleness guard: suppress notifications that fire >5 min late
          // (e.g. after a clock change or timezone hop)
          const scheduledTs = Number(prayerData?.scheduledTimestamp);
          if (scheduledTs && (Date.now() - scheduledTs) > 5 * 60 * 1000) {
            console.log(`🗑️ Suppressing stale background ${prayerData.prayerName} notification`);
            if (notification?.id) {
              notifee.cancelDisplayedNotification(notification.id);
            }
            return;
          }

          console.log(`✅ ${prayerData.prayerName} notification delivered in background (top-level handler)`);
          
          // Top up rolling window
          try {
            const { onPrayerNotificationDelivered } = require('./utils/prayerNotificationScheduler');
            await onPrayerNotificationDelivered();
            console.log('✅ Rolling window topped up after background delivery');
          } catch (e) {
            const errMsg = (e as any)?.message || e;
            console.log('⚠️ Rolling window update failed:', errMsg);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Background event handler error:', e);
    }
  });
} catch (e) {
  console.log('⚠️ Failed to register background event handler:', e);
}
