import 'expo-router/entry';
import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

// ============================================================================
// CRITICAL: Register background handlers at TOP LEVEL
// These MUST be here (not inside a function) to work when app is closed
// ============================================================================

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
      
      // Top up rolling window when notification is delivered in background
      if (type === EventType.DELIVERED) {
        console.log('📨 Background notification delivered');
        const prayerData = notification?.data;
        
        // Check for both prayer-time and prayer-reminder types
        if (prayerData?.type === 'prayer-time' || prayerData?.type === 'prayer-reminder') {
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
