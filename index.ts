import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import notifee, { EventType } from '@notifee/react-native';

import { widgetTaskHandler } from './widgets/widgetTaskHandler';

// ============================================================================
// CRITICAL: Register Notifee background event handler at TOP LEVEL
// This MUST be here (not inside a function) to work when app is closed
// ============================================================================
notifee.onBackgroundEvent(async ({ type, detail }) => {
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
});

// Register the widget task handler
registerWidgetTaskHandler(widgetTaskHandler);
