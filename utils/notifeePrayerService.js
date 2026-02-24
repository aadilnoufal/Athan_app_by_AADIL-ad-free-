// =============================================================================
// NOTIFEE PRAYER NOTIFICATION SERVICE - ENTERPRISE GRADE
// =============================================================================
// Advanced notification service using Notifee for maximum reliability and features
// Key improvements:
// 1. Better reliability across Android versions
// 2. Rich notification support with actions
// 3. Precise scheduling with timestamp triggers
// 4. Better permission handling
// 5. Channel management for Android (iOS uses categories)
// 6. Background task survival
// 7. Battery optimization handling (Android only)
// 8. Initial notification detection
// 9. Enhanced debugging and status reporting
// 10. Cross-platform iOS/Android compatibility
// 
// iOS SPECIFIC FEATURES:
// - Notification categories with actions
// - Critical sounds for important prayers
// - Badge management
// - Interruption levels (iOS 15+)
// - Maximum 64 scheduled notifications per app
// 
// ANDROID SPECIFIC FEATURES:
// - Custom notification channels
// - Battery optimization handling
// - Exact alarm permissions (Android 12+)
// - Power management settings
// - Vibration patterns
// =============================================================================

import notifee, {
  TriggerType,
  RepeatFrequency,
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  AndroidNotificationSetting,
  EventType
} from '@notifee/react-native';
import { Platform, AppState, Alert, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// ANDROID 12+ PERMISSION MANAGEMENT
// =============================================================================

/**
 * Check and request essential Android permissions for prayer notifications
 * Critical for Android 12+ compatibility
 */
// Session-scoped "ask me later" flags — reset every app launch
let _alarmAskLaterThisSession = false;
let _batteryAskLaterThisSession = false;
let _notifAskLaterThisSession = false;

const requestAlarmPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      if (_alarmAskLaterThisSession) {
        console.log('🔔 Alarm permission deferred this session');
        return false;
      }

      // Check if exact alarm permission method is available
      if (typeof notifee.canScheduleExactAlarms !== 'function') {
        console.log('⚠️ canScheduleExactAlarms not available in this Notifee version');
        return true; // Assume permission is granted for older versions
      }

      // Check if exact alarm permission is available (Android 12+)
      const alarmPermissionStatus = await notifee.canScheduleExactAlarms();
      console.log('🔔 Exact alarm permission status:', alarmPermissionStatus);

      if (!alarmPermissionStatus) {
        return new Promise((resolve) => {
          Alert.alert(
            'Exact Alarms Permission Required',
            'For accurate prayer time notifications, please enable "Alarms & reminders" permission. This is required for Android 12+.',
            [
              {
                text: 'Open Settings',
                onPress: async () => {
                  if (typeof notifee.openAlarmPermissionSettings === 'function') {
                    await notifee.openAlarmPermissionSettings();
                  }
                  resolve(false);
                },
              },
              {
                text: 'Ask Me Later',
                onPress: () => {
                  _alarmAskLaterThisSession = true;
                  console.log('🔔 User chose Ask Me Later for alarm permission');
                  resolve(false);
                },
                style: 'cancel',
              },
            ]
          );
        });
      }
      return true;
    } catch (error) {
      console.log('⚠️ Alarm permission check failed:', error);
      return false;
    }
  }
  return true;
};

/**
 * Check battery optimization and power management settings
 * Essential for background notification reliability
 */
const checkBatteryOptimization = async () => {
  if (Platform.OS === 'android') {
    try {
      if (_batteryAskLaterThisSession) {
        console.log('🔋 Battery optimization deferred this session');
        return;
      }

      // Check if user has chosen to not ask again about battery optimization
      const dontAskAgain = await AsyncStorage.getItem('battery_optimization_dont_ask');
      if (dontAskAgain === 'true') {
        console.log('🔋 User chose not to ask about battery optimization again');
        return;
      }

      // Check if battery optimization is enabled
      const batteryOptimizationEnabled = await notifee.isBatteryOptimizationEnabled();
      console.log('🔋 Battery optimization enabled:', batteryOptimizationEnabled);

      if (batteryOptimizationEnabled) {
        return new Promise((resolve) => {
          Alert.alert(
            'Battery Optimization Detected',
            'To ensure prayer notifications work reliably, please disable battery optimization for this app.',
            [
              {
                text: 'Open Settings',
                onPress: async () => {
                  await notifee.openBatteryOptimizationSettings();
                  resolve();
                },
              },
              {
                text: 'Ask Me Later',
                onPress: () => {
                  _batteryAskLaterThisSession = true;
                  console.log('🔋 User chose Ask Me Later for battery optimization');
                  resolve();
                },
                style: 'cancel',
              },
              {
                text: 'Don\'t Ask Again',
                onPress: async () => {
                  await AsyncStorage.setItem('battery_optimization_dont_ask', 'true');
                  console.log('🔋 User chose not to ask about battery optimization again');
                  resolve();
                },
                style: 'destructive',
              },
            ]
          );
        });
      }
      // NOTE: Power manager / auto-start prompt removed — too intrusive for first open
    } catch (error) {
      console.log('⚠️ Battery optimization check failed:', error);
    }
  }
};

/**
 * Request iOS-specific permissions
 */
const requestIOSPermissions = async () => {
  try {
    if (Platform.OS === 'ios') {
      const settings = await notifee.requestPermission({
        alert: true,
        badge: true,
        sound: true,
        criticalAlert: true, // For important prayer notifications
        announcement: true,
      });

      console.log('🍎 iOS notification permission:', settings);
      return settings.authorizationStatus >= 1;
    }
    return true;
  } catch (error) {
    console.error('❌ Error requesting iOS permissions:', error);
    return false;
  }
};

/**
 * Request all essential permissions for prayer notifications
 */
const requestEssentialPermissions = async () => {
  try {
    console.log('🔐 Requesting essential permissions...');

    if (Platform.OS === 'ios') {
      // iOS-specific permission handling
      const iosPermission = await requestIOSPermissions();
      return {
        notifications: iosPermission,
        exactAlarms: true // iOS doesn't need explicit alarm permissions
      };
    } else {
      // === STEP 1: Notification permission FIRST (most important) ===
      if (_notifAskLaterThisSession) {
        console.log('🔔 Notification permission deferred this session');
        return { notifications: false, exactAlarms: false };
      }

      const notificationPermission = await notifee.requestPermission();
      console.log('🔔 Notification permission:', notificationPermission);

      const notifGranted = notificationPermission.authorizationStatus === 1;
      if (!notifGranted) {
        // If user denies notifications, don't bother with alarm/battery
        return { notifications: false, exactAlarms: false };
      }

      // === STEP 2: Exact alarm permission (Android 12+) ===
      const alarmPermission = await requestAlarmPermission();

      // === STEP 3: Battery optimization (single prompt, no power manager) ===
      await checkBatteryOptimization();

      return {
        notifications: true,
        exactAlarms: alarmPermission
      };
    }
  } catch (error) {
    console.error('❌ Error requesting permissions:', error);
    return { notifications: false, exactAlarms: false };
  }
};

// Global state
let appStateSubscription = null;
let isInitialized = false;
let channelId = 'prayer-reminders';

/**
 * Initialize Notifee prayer notification service
 */
export async function initializeNotifeePrayerNotifications() {
  if (isInitialized) return true;

  try {
    console.log("🚀 Initializing Enhanced Notifee Prayer Notification Service...");

    // 1. Request all essential permissions (Android 12+ compatible)
    const permissions = await requestEssentialPermissions();
    console.log("🔐 Essential permissions status:", permissions);

    if (!permissions.notifications) {
      console.log("❌ Notification permissions not granted");
      return false;
    }

    if (!permissions.exactAlarms && Platform.OS === 'android') {
      console.log("⚠️ Exact alarm permission needed for reliable scheduling");
      // Continue but warn user
    }

    // 2. Create enhanced notification channels
    await createPrayerNotificationChannels();

    // 3. Set up app state listener
    setupAppStateListener();

    // 4. Handle initial notification if app was opened by notification
    await handleInitialNotification();

    isInitialized = true;
    console.log("✅ Notifee Prayer notification service initialized");
    return true;

  } catch (error) {
    console.error("❌ Error initializing Notifee prayer notifications:", error);
    return false;
  }
}

/**
 * Create dual notification channels - one for AZAN, one for DEFAULT Android sound
 * This is the PROPER way - we pick the right channel based on user preference
 * NO hybrid fallback needed - Android plays the correct sound from the correct channel
 */
async function createPrayerNotificationChannels() {
  if (Platform.OS !== 'android') {
    // iOS uses categories instead of channels
    await createIOSNotificationCategories();
    return;
  }

  try {
    console.log(`🔊 Creating notification channels (Azan + Default)`);

    // ========== AZAN SOUND CHANNELS ==========

    // Main prayer channel with AZAN sound
    await notifee.createChannel({
      id: 'prayer-times-azan',
      name: 'Prayer Times (Azan)',
      description: 'Prayer notifications with Azan sound',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'azan', // Azan sound from res/raw/azan.wav
      vibration: true,
      vibrationPattern: [300, 600, 300, 600],
      lightColor: '#1a8e2d',
      lights: true,
      badge: true,
    });

    // Fajr channel with AZAN sound
    await notifee.createChannel({
      id: 'fajr-prayer-azan',
      name: 'Fajr Prayer (Azan)',
      description: 'Fajr notifications with Azan sound',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'azan', // Azan sound
      vibration: true,
      vibrationPattern: [200, 400, 200, 400, 200, 400],
      lightColor: '#0066cc',
      lights: true,
      badge: true,
    });

    // ========== DEFAULT SOUND CHANNELS ==========

    // Main prayer channel with DEFAULT Android sound
    await notifee.createChannel({
      id: 'prayer-times-default',
      name: 'Prayer Times (Default)',
      description: 'Prayer notifications with default Android sound',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default', // Android default notification sound
      vibration: true,
      vibrationPattern: [300, 600, 300, 600],
      lightColor: '#1a8e2d',
      lights: true,
      badge: true,
    });

    // Fajr channel with DEFAULT Android sound
    await notifee.createChannel({
      id: 'fajr-prayer-default',
      name: 'Fajr Prayer (Default)',
      description: 'Fajr notifications with default Android sound',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default', // Android default notification sound
      vibration: true,
      vibrationPattern: [200, 400, 200, 400, 200, 400],
      lightColor: '#0066cc',
      lights: true,
      badge: true,
    });

    // Reminder channel with default sound
    await notifee.createChannel({
      id: 'prayer_reminder_channel',
      name: 'Prayer Reminders',
      description: 'Reminder notifications before prayer times',
      importance: AndroidImportance.DEFAULT,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [200, 300, 200, 300],
      lightColor: '#ff9900',
      lights: true,
      badge: false,
    });

    console.log("✅ Notification channels created (Azan + Android Default)");

  } catch (error) {
    console.error("❌ Error creating notification channels:", error);
    // Fallback to default sound channels
    await createFallbackChannels();
  }
}

/**
 * Create iOS notification categories (equivalent to Android channels)
 */
async function createIOSNotificationCategories() {
  try {
    console.log("🍎 Creating iOS notification categories...");

    await notifee.setNotificationCategories([
      {
        id: 'prayer-category',
        actions: [
          {
            id: 'mark_read',
            title: '🤲 Mark as Read',
            foreground: false,
          },
          {
            id: 'snooze',
            title: '⏰ Snooze 5min',
            foreground: false,
          },
        ],
      },
      {
        id: 'fajr-category',
        actions: [
          {
            id: 'mark_read',
            title: '🤲 Mark as Read',
            foreground: false,
          },
          {
            id: 'snooze',
            title: '⏰ Snooze 5min',
            foreground: false,
          },
        ],
      },
    ]);

    console.log("✅ iOS notification categories created successfully");
  } catch (error) {
    console.error("❌ Error creating iOS notification categories:", error);
  }
}

/**
 * Create fallback channels with default sounds if custom azan fails
 */
async function createFallbackChannels() {
  try {
    console.log("🔄 Creating fallback channels with default sounds...");

    await notifee.createChannel({
      id: channelId,
      name: 'Prayer Times (Default Sound)',
      description: 'Prayer notifications with default system sound',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 600, 300, 600], // Even number of values (4)
      lightColor: '#1a8e2d',
      lights: true,
      badge: true,
    });

    await notifee.createChannel({
      id: 'fajr_prayer_channel',
      name: 'Fajr Prayer (Default Sound)',
      description: 'Fajr notifications with default system sound',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [200, 400, 200, 400, 200, 400], // Even number of values (6)
      lightColor: '#0066cc',
      lights: true,
      badge: true,
    });

    console.log("✅ Fallback channels created successfully");
  } catch (fallbackError) {
    console.error("❌ Error creating fallback channels:", fallbackError);
  }
}

// Keep backward compatibility
const createPrayerNotificationChannel = createPrayerNotificationChannels;

/**
 * Create cross-platform notification configuration
 * Android: Uses CORRECT channel based on user preference (azan-channel OR default-channel)
 * iOS: Direct sound specification per notification
 * NO HYBRID FALLBACK - just pick the right channel!
 */
function createCrossPlatformNotification(prayer, time, useAzanSound, isReminder = false) {
  const shouldUseAzan = useAzanSound && prayer !== 'Sunrise' && !isReminder;

  // Sunrise is NOT a prayer, just a time marker
  const isSunrise = prayer === 'Sunrise';
  const title = isReminder
    ? `🔔 ${prayer} Prayer Reminder`
    : isSunrise
      ? `☀️ ${prayer}`
      : `🕌 ${prayer} Prayer Time`;

  const body = isReminder ?
    `${prayer} prayer starts in 15 minutes (${time})` :
    isSunrise
      ? `Sunrise time (${time})`
      : `It's time for ${prayer} prayer (${time})`;

  const baseNotification = {
    title,
    body,
    data: {
      prayerName: prayer,
      prayerTime: time,
      type: isReminder ? "prayer-reminder" : "prayer-time",
      soundType: shouldUseAzan ? 'azan' : 'default',
    },
  };

  if (Platform.OS === 'ios') {
    // iOS - specify sound directly per notification
    return {
      ...baseNotification,
      ios: {
        categoryId: prayer === 'Fajr' ? 'fajr-category' : 'prayer-category',
        sound: shouldUseAzan ? 'azan.wav' : 'beep.wav',
        criticalSound: shouldUseAzan ? {
          name: 'azan.wav',
          volume: 1.0,
          critical: true
        } : undefined,
        badge: 1,
        interruptionLevel: 'active',
      },
    };
  } else {
    // Android - pick the CORRECT channel (azan or default Android sound)
    const isFajr = prayer === 'Fajr';
    const channelId = shouldUseAzan
      ? (isFajr ? 'fajr-prayer-azan' : 'prayer-times-azan')
      : (isFajr ? 'fajr-prayer-default' : 'prayer-times-default');

    console.log(`📱 ${prayer}: Using channel "${channelId}" (${shouldUseAzan ? 'AZAN' : 'DEFAULT ANDROID SOUND'})`);

    return {
      ...baseNotification,
      android: {
        channelId: channelId, // CORRECT channel with CORRECT sound!
        category: AndroidCategory.REMINDER,
        smallIcon: 'ic_launcher_foreground',
        color: prayer === 'Fajr' ? '#0066cc' : '#1a8e2d',
        // No sound specified here - channel handles it perfectly
        vibrationPattern: prayer === 'Fajr' ?
          [200, 400, 200, 400, 200, 400] : [300, 600, 300, 600],
        pressAction: {
          id: 'default',
        },
        actions: [
          {
            title: '🤲 Mark as Read',
            pressAction: {
              id: 'mark_read',
            },
          },
        ],
      },
    };
  }
}

/**
 * Handle initial notification if app was opened by notification
 */
async function handleInitialNotification() {
  try {
    if (Platform.OS === 'android') {
      const initialNotification = await notifee.getInitialNotification();
      if (initialNotification) {
        console.log('📱 App opened by notification:', initialNotification.notification?.title);
        // You can handle specific logic here based on the notification that opened the app
        // For example, navigate to a specific prayer or show prayer details
      }
    }
  } catch (error) {
    console.error("Error handling initial notification:", error);
  }
}

/**
 * Get sound preference from AsyncStorage
 */
async function getSoundPreference() {
  try {
    const useAzanSound = await AsyncStorage.getItem('use_azan_sound');
    return useAzanSound !== 'false'; // Default to true if not set
  } catch (error) {
    console.error('Error getting sound preference:', error);
    return true; // Default to true on error
  }
}

/**
 * Setup app state listener for notification refresh
 */
function setupAppStateListener() {
  if (appStateSubscription) {
    appStateSubscription.remove();
  }

  appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
    if (nextAppState === "active") {
      console.log("📱 App became active - prayer notifications ready");
      // You can refresh prayer times here if needed
    }
  });
}

/**
 * Schedule prayer notifications using Notifee triggers
 * This is the main function to schedule all daily prayer notifications
 * Android limit: 50 scheduled notifications (we stay well under this)
 * Uses hybrid approach: Notifee plays sound from channel, then manual playback handles user preference
 */
export async function scheduleNotifeePrayerNotifications(prayerTimes, settings = {}) {
  if (!prayerTimes) {
    console.log("❌ No prayer times provided");
    return [];
  }

  // CRITICAL: Check if notifications are globally enabled before scheduling anything
  try {
    const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
    if (notificationsEnabled === 'false') {
      console.log("⏭️ Notifications are disabled globally, skipping scheduling");
      return [];
    }
  } catch (e) {
    console.log("⚠️ Could not check global notification setting:", e);
  }

  if (!isInitialized) {
    console.log("⚠️ Notifee service not initialized. Initializing now...");
    const initialized = await initializeNotifeePrayerNotifications();
    if (!initialized) return [];
  }

  try {
    const scheduledIds = [];
    const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    // Get sound preference
    const useAzanSound = await getSoundPreference();
    console.log(`🔊 Sound preference: ${useAzanSound ? 'Azan sound' : 'Android default sound'}`);
    console.log(`📋 Prayer notification settings received:`, settings);

    // Clear existing prayer notifications first
    await cancelAllNotifeePrayerNotifications();

    for (const prayer of prayers) {
      // Check if notifications are enabled for this prayer
      console.log(`🔍 Checking ${prayer}: setting=${settings[prayer]}, time=${prayerTimes[prayer]}`);

      if (settings[prayer] === false) {
        console.log(`⏭️ Skipping ${prayer} - disabled in settings`);
        continue;
      }

      const time = prayerTimes[prayer];
      if (!time) {
        console.log(`⚠️ No time available for ${prayer}`);
        continue;
      }

      const [hours, minutes] = time.split(":").map(Number);

      // Validate time
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.warn(`❌ Invalid time for ${prayer}: ${time}`);
        continue;
      }

      // Create notification trigger for daily repetition
      const today = new Date();
      const prayerDate = new Date();
      prayerDate.setHours(hours, minutes, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (prayerDate <= today) {
        prayerDate.setDate(prayerDate.getDate() + 1);
        console.log(`⏰ ${prayer} time passed today, starting tomorrow`);
      }

      // Determine sound type
      const shouldUseAzan = useAzanSound && prayer !== 'Sunrise';
      const soundType = shouldUseAzan ? 'azan' : 'default';

      // Create enhanced trigger with AlarmManager for reliability
      const trigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: prayerDate.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: Platform.OS === 'android' ? {
          allowWhileIdle: true, // Works in Doze mode - like real alarm apps!
          exact: true, // Exact timing - Android 12+ compatible
        } : undefined
      };

      // Create notification using cross-platform configuration (picks correct channel)
      const notificationId = `prayer-${prayer.toLowerCase()}`;
      const notificationConfig = createCrossPlatformNotification(prayer, time, useAzanSound);

      await notifee.createTriggerNotification(
        {
          id: notificationId,
          ...notificationConfig,
        },
        trigger
      );

      scheduledIds.push({
        prayer,
        time,
        identifier: notificationId,
        scheduledFor: prayerDate.toISOString(),
        soundType: soundType,
        trigger: trigger
      });

      const soundEmoji = shouldUseAzan ? '🔊 azan' : '🔔 default';
      const channelUsed = Platform.OS === 'android'
        ? (shouldUseAzan
          ? (prayer === 'Fajr' ? 'fajr-prayer-azan' : 'prayer-times-azan')
          : (prayer === 'Fajr' ? 'fajr-prayer-default' : 'prayer-times-default'))
        : 'iOS';

      console.log(`✅ Scheduled ${prayer} at ${time} (${soundEmoji}) - Channel: ${channelUsed}`);
    }

    console.log(`🎯 Successfully scheduled ${scheduledIds.length} prayer notifications`);
    if (Platform.OS === 'android') {
      console.log(`⏰ Using AlarmManager for exact timing (like real alarm apps!)`);
      console.log(`📊 Android notification limit: ${scheduledIds.length}/50 used`);
    }
    return scheduledIds;

  } catch (error) {
    console.error("❌ Error scheduling Notifee prayer notifications:", error);
    return [];
  }
}

/**
 * Cancel all prayer notifications
 */
export async function cancelAllNotifeePrayerNotifications() {
  try {
    // Get all trigger notifications
    const triggerIds = await notifee.getTriggerNotificationIds();

    let canceledCount = 0;
    for (const id of triggerIds) {
      if (id.startsWith('prayer-')) {
        await notifee.cancelTriggerNotification(id);
        canceledCount++;
      }
    }

    // Also cancel any displayed notifications related to prayers (reminders or scheduled times)
    const displayedNotifications = await notifee.getDisplayedNotifications();
    for (const notification of displayedNotifications) {
      const t = notification.notification?.data?.type;
      if (t === "prayer-reminder" || t === 'prayer-time' || t === 'prayer-alarm') {
        try {
          await notifee.cancelDisplayedNotification(notification.id);
          canceledCount++;
        } catch (e) {
          console.log('⚠️ Failed to cancel displayed notification', notification.id, e?.message || e);
        }
      }
    }

    console.log(`🧹 Canceled ${canceledCount} prayer notifications`);
    return canceledCount;
  } catch (error) {
    console.error("❌ Error canceling Notifee prayer notifications:", error);
    return 0;
  }
}

/**
 * NUCLEAR OPTION: Cancel absolutely ALL notifications - displayed and scheduled
 * Use this when user turns off the master notification toggle
 */
export async function cancelAllNotificationsCompletely() {
  try {
    console.log('🔴 NUCLEAR: Cancelling ALL notifications completely...');

    let canceledCount = 0;

    // 1. Cancel ALL displayed notifications (not just prayer ones)
    await notifee.cancelAllNotifications();
    console.log('✅ Cancelled all displayed notifications');

    // 2. Cancel ALL trigger/scheduled notifications
    const triggerIds = await notifee.getTriggerNotificationIds();
    for (const id of triggerIds) {
      try {
        await notifee.cancelTriggerNotification(id);
        canceledCount++;
      } catch (e) {
        console.log(`⚠️ Failed to cancel trigger ${id}:`, e?.message);
      }
    }
    console.log(`✅ Cancelled ${canceledCount} scheduled trigger notifications`);

    // 3. Double-check by getting remaining triggers
    const remainingTriggers = await notifee.getTriggerNotificationIds();
    if (remainingTriggers.length > 0) {
      console.log(`⚠️ ${remainingTriggers.length} triggers still remaining, attempting force cancel...`);
      for (const id of remainingTriggers) {
        await notifee.cancelTriggerNotification(id);
      }
    }

    console.log('🔴 NUCLEAR: All notifications completely cancelled');
    return canceledCount;
  } catch (error) {
    console.error('❌ Error in nuclear notification cancel:', error);
    return 0;
  }
}

/**
 * Update prayer notifications (main function to call when times change)
 */
let lastUpdateAttempt = 0;
const UPDATE_COOLDOWN = 3000; // 3 seconds cooldown

export async function updateNotifeePrayerNotifications(prayerTimes, settings = {}) {
  try {
    // Implement cooldown to prevent rapid re-scheduling
    const now = Date.now();
    if (now - lastUpdateAttempt < UPDATE_COOLDOWN) {
      console.log(`⏱️ Notifee update cooldown active, skipping (${UPDATE_COOLDOWN / 1000}s cooldown)`);
      return [];
    }
    lastUpdateAttempt = now;

    console.log("🔄 Updating Notifee prayer notifications...");

    // Cancel existing notifications
    const canceledCount = await cancelAllNotifeePrayerNotifications();

    // Schedule new notifications
    const scheduledIds = await scheduleNotifeePrayerNotifications(prayerTimes, settings);

    console.log(`✅ Updated Notifee notifications: ${canceledCount} canceled, ${scheduledIds.length} scheduled`);
    return scheduledIds;
  } catch (error) {
    console.error("❌ Error updating Notifee prayer notifications:", error);
    return [];
  }
}

/**
 * Get currently scheduled prayer notifications
 */
export async function getScheduledNotifeePrayerNotifications() {
  try {
    const triggerIds = await notifee.getTriggerNotificationIds();

    const prayerNotifications = triggerIds
      .filter(id => id.startsWith('prayer-'))
      .map(id => ({
        id: id,
        prayer: id.replace('prayer-', '').charAt(0).toUpperCase() + id.replace('prayer-', '').slice(1),
        type: 'trigger'
      }));

    console.log(`📋 Found ${prayerNotifications.length} scheduled Notifee prayer notifications`);
    return prayerNotifications;
  } catch (error) {
    console.error("❌ Error getting scheduled Notifee notifications:", error);
    return [];
  }
}

/**
 * Schedule immediate notification for testing or current prayer
 */
export async function scheduleImmediateNotifeeNotification(prayerName, message = null) {
  try {
    // Get sound preference
    const useAzanSound = await getSoundPreference();
    const shouldUseAzan = useAzanSound && prayerName !== 'Sunrise';

    console.log(`🔊 ${prayerName} notification will use: ${shouldUseAzan ? 'azan' : 'default Android'} sound`);

    // Create cross-platform notification configuration
    const notificationConfig = createCrossPlatformNotification(
      prayerName,
      'now',
      useAzanSound,
      false
    );

    // Override body with custom message if provided
    if (message) {
      notificationConfig.body = message;
    }

    const notificationId = await notifee.displayNotification({
      ...notificationConfig,
      data: {
        ...notificationConfig.data,
        type: "immediate-prayer-reminder",
      },
    });

    const soundInfo = shouldUseAzan ? '🔊 azan' : '🔔 default';
    console.log(`⚡ Immediate notification displayed for ${prayerName} (${soundInfo}) - Channel handles sound (ID: ${notificationId})`);

    return notificationId;
  } catch (error) {
    console.error("❌ Error scheduling immediate Notifee notification:", error);
    return null;
  }
}

/**
 * Schedule test notification
 * Uses correct channel based on user preference - NO manual sound playback
 */
export async function scheduleNotifeeTestNotification() {
  try {
    // Get sound preference
    const useAzanSound = await getSoundPreference();
    console.log(`🧪 Test notification - User preference: ${useAzanSound ? 'AZAN' : 'DEFAULT ANDROID SOUND'}`);

    // Pick the CORRECT channel based on preference
    const testChannelId = useAzanSound ? 'prayer-times-azan' : 'prayer-times-default';

    // Create test notification configuration
    const testConfig = {
      title: "🧪 Test Prayer Notification",
      body: `Testing ${useAzanSound ? 'azan' : 'default Android'} sound from channel`,
      data: {
        type: "prayer-time",
        prayerName: "Test",
        soundType: useAzanSound ? 'azan' : 'default',
      },
    };

    // Add platform-specific configurations
    if (Platform.OS === 'ios') {
      testConfig.ios = {
        categoryId: 'prayer-category',
        sound: useAzanSound ? 'azan.wav' : 'beep.wav',
        criticalSound: useAzanSound ? {
          name: 'azan.wav',
          volume: 1.0,
          critical: true
        } : undefined,
        badge: 1,
        interruptionLevel: 'active',
      };
    } else {
      // Android - use CORRECT channel (azan or default)
      testConfig.android = {
        channelId: testChannelId, // ← CORRECT channel!
        category: AndroidCategory.REMINDER,
        smallIcon: 'ic_launcher_foreground',
        color: '#1a8e2d',
        // NO sound specified - channel handles it!
        vibrationPattern: [300, 600, 300, 600],
        pressAction: {
          id: 'default',
        },
      };
    }

    const notificationId = await notifee.displayNotification(testConfig);
    console.log(`✅ Test notification displayed - Channel "${testChannelId}" will play ${useAzanSound ? 'azan' : 'default Android sound'}`);

    return notificationId;
  } catch (error) {
    console.error("❌ Error displaying test notification:", error);
    return null;
  }
}

/**
 * Handle notification events (foreground events)
 * Notifee channels handle ALL sounds - we just log here
 */
export function setupNotifeeEventHandlers() {
  console.log('🔧 Setting up Notifee event handlers (channels handle sounds automatically)');

  // Foreground events
  notifee.onForegroundEvent(({ type, detail }) => {
    const { notification, pressAction } = detail;

    // Filter spam events
    if (type === 7 || type === undefined) return;

    console.log('📱 Notifee foreground event:', type, pressAction?.id);

    switch (type) {
      case EventType.DISMISSED:
        console.log('🗑️ Notification dismissed');
        break;

      case EventType.PRESS:
        console.log('👆 Notification pressed');
        break;

      case EventType.ACTION_PRESS:
        if (pressAction?.id === 'mark_read' && notification?.id) {
          notifee.cancelDisplayedNotification(notification.id);
        }
        break;

      case EventType.DELIVERED:
        console.log('📨 Notification delivered');
        const prayerData = notification?.data;

        // Check for both prayer-time and prayer-reminder types
        if (prayerData?.type === 'prayer-time' || prayerData?.type === 'prayer-reminder') {
          console.log(`✅ ${prayerData.prayerName} prayer notification delivered - Channel played ${prayerData.soundType} sound automatically`);

          // Top up rolling window for iOS
          try {
            const { onPrayerNotificationDelivered } = require('./prayerNotificationScheduler');
            onPrayerNotificationDelivered();
          } catch (e) {
            console.log('⚠️ Rolling window update failed:', e?.message);
          }
        }
        break;
    }
  });

  // Background events are now handled at the top level in index.ts
  // DO NOT register onBackgroundEvent here as it will overwrite the top-level handler
  // The top-level handler in index.ts is critical for notifications when app is closed
}

/**
 * Comprehensive debugging function for Notifee notifications
 */
export async function debugNotifeeNotifications() {
  try {
    console.log('� === NOTIFEE COMPREHENSIVE DEBUG REPORT ===');

    const status = await getNotifeeServiceStatus();

    // Display all the debugging information
    let debugInfo = '🔍 NOTIFEE DEBUG REPORT\n\n';
    debugInfo += `✅ Service Initialized: ${status.initialized}\n`;
    debugInfo += `🔐 Permissions: ${status.permissionsGranted ? 'Granted' : 'Denied'}\n`;
    debugInfo += `�📱 Platform: ${status.platform}\n`;
    debugInfo += `⏰ Alarm Permission: ${status.alarmPermission}\n`;
    debugInfo += `🔋 Battery Optimization: ${status.batteryOptimization}\n`;
    debugInfo += `📋 Scheduled Notifications: ${status.scheduledCount}\n`;
    debugInfo += `🔊 Sound Preference: ${status.soundPreference}\n`;

    if (status.powerManagerInfo?.activity) {
      debugInfo += `⚡ Power Manager: ${status.powerManagerInfo.activity}\n`;
    }

    if (status.scheduledNotifications && status.scheduledNotifications.length > 0) {
      debugInfo += '\n📅 SCHEDULED NOTIFICATIONS:\n';
      status.scheduledNotifications.forEach((notif, index) => {
        debugInfo += `${index + 1}. ${notif.prayer} (ID: ${notif.id})\n`;
      });
    } else {
      debugInfo += '\n⚠️ NO SCHEDULED NOTIFICATIONS FOUND\n';
    }

    console.log(debugInfo);
    return {
      status,
      debugInfo,
      recommendations: generateRecommendations(status)
    };

  } catch (error) {
    console.error("❌ Error in Notifee debug:", error);
    return { error: error.message };
  }
}

/**
 * Generate recommendations based on status
 */
function generateRecommendations(status) {
  const recommendations = [];

  if (!status.permissionsGranted) {
    recommendations.push('📱 Grant notification permissions in device settings');
  }

  if (status.alarmPermission === 'Denied') {
    recommendations.push('⏰ Enable exact alarm permission for Android 12+');
  }

  if (status.batteryOptimization?.includes('Enabled')) {
    recommendations.push('🔋 Disable battery optimization for better reliability');
  }

  if (status.powerManagerInfo?.activity) {
    recommendations.push('⚡ Check power management settings');
  }

  if (status.scheduledCount === 0) {
    recommendations.push('📅 Schedule prayer notifications');
  }

  return recommendations;
}

/**
 * Schedule a snooze notification (5 minutes from now)
 */
async function scheduleSnoozeNotification(prayerName) {
  try {
    const snoozeTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    const trigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: snoozeTime.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: `snooze-${prayerName.toLowerCase()}-${Date.now()}`,
        title: `🔔 ${prayerName} Prayer Reminder`,
        body: `Snoozed reminder: It's time for ${prayerName} prayer`,
        data: {
          prayerName,
          type: "snooze-prayer-reminder"
        },
        android: {
          channelId: channelId,
          category: AndroidCategory.REMINDER,
          // Use the default notification icon from Expo
          smallIcon: 'ic_launcher_foreground',
          color: '#1a8e2d',
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          categoryId: 'prayer-category',
          sound: 'default',
        },
      },
      trigger
    );

    console.log(`⏰ Snooze notification scheduled for ${prayerName} in 5 minutes`);
  } catch (error) {
    console.error("❌ Error scheduling snooze notification:", error);
  }
}

/**
 * Cleanup function
 */
export function cleanupNotifeeService() {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  isInitialized = false;
  console.log("🧹 Notifee service cleaned up");
}

/**
 * Get Notifee service status with comprehensive debugging info
 */
export async function getNotifeeServiceStatus() {
  try {
    const settings = await notifee.getNotificationSettings();
    const scheduledNotifications = await getScheduledNotifeePrayerNotifications();
    const useAzanSound = await getSoundPreference();

    let alarmPermission = 'N/A';
    let batteryOptimization = 'Unknown';
    let powerManagerInfo = null;

    if (Platform.OS === 'android') {
      alarmPermission = settings.android?.alarm === AndroidNotificationSetting.ENABLED ? 'Granted' : 'Denied';

      // Check battery optimization
      try {
        const batteryOptEnabled = await notifee.isBatteryOptimizationEnabled();
        batteryOptimization = batteryOptEnabled ? 'Enabled (May affect notifications)' : 'Disabled (Optimal)';
      } catch (error) {
        console.log('Could not check battery optimization:', error);
      }

      // Check power manager info
      try {
        powerManagerInfo = await notifee.getPowerManagerInfo();
      } catch (error) {
        console.log('Could not get power manager info:', error);
      }
    }

    return {
      initialized: isInitialized,
      permissionsGranted: settings.authorizationStatus >= 1,
      alarmPermission: alarmPermission,
      batteryOptimization: batteryOptimization,
      powerManagerInfo: powerManagerInfo,
      scheduledCount: scheduledNotifications.length,
      scheduledNotifications,
      soundPreference: useAzanSound ? 'Azan (except Sunrise)' : 'Android default sound',
      useAzanSound,
      platform: Platform.OS,
      channelId: channelId,
      notificationSettings: settings,
    };
  } catch (error) {
    console.error("❌ Error getting Notifee service status:", error);
    return {
      initialized: isInitialized,
      permissionsGranted: false,
      scheduledCount: 0,
      scheduledNotifications: [],
      error: error.message,
    };
  }
}

/**
 * Request exact alarm permission for Android 12+
 */
export async function requestExactAlarmPermission() {
  if (Platform.OS !== 'android') return true;

  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.android?.alarm === AndroidNotificationSetting.DISABLED) {
      console.log("📱 Opening exact alarm permission settings for Android 12+");
      await notifee.openAlarmPermissionSettings();
      return false; // User needs to manually grant permission
    }
    return true;
  } catch (error) {
    console.error("❌ Error requesting exact alarm permission:", error);
    return false;
  }
}

/**
 * Check and handle battery optimization
 */
export async function checkAndHandleBatteryOptimization() {
  // Now handled inside requestEssentialPermissions during init;
  // kept as no-op for backward compatibility.
  return true;
}

/**
 * Check and handle power manager restrictions
 */
export async function checkAndHandlePowerManager() {
  // Removed — too intrusive for users. Power manager prompts are no longer shown.
  return true;
}

/**
 * Comprehensive test function to verify all Notifee features work correctly
 */
export async function testNotifeeFeatures() {
  try {
    console.log('🧪 === STARTING COMPREHENSIVE NOTIFEE FEATURE TEST ===');

    const testResults = {
      initialization: false,
      permissions: false,
      channelCreation: false,
      immediateNotification: false,
      triggerNotification: false,
      actionHandling: false,
      statusReporting: false,
    };

    // Test 1: Initialization
    try {
      const initialized = await initializeNotifeePrayerNotifications();
      testResults.initialization = initialized;
      console.log(`✅ Initialization: ${initialized ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      console.log(`❌ Initialization: FAILED - ${error}`);
    }

    // Test 2: Permissions
    try {
      const settings = await notifee.getNotificationSettings();
      testResults.permissions = settings.authorizationStatus >= 1;
      console.log(`✅ Permissions: ${testResults.permissions ? 'GRANTED' : 'DENIED'}`);
    } catch (error) {
      console.log(`❌ Permissions: ERROR - ${error}`);
    }

    // Test 3: Channel Creation (Android)
    if (Platform.OS === 'android') {
      try {
        await createPrayerNotificationChannel();
        testResults.channelCreation = true;
        console.log(`✅ Channel Creation: PASSED`);
      } catch (error) {
        console.log(`❌ Channel Creation: FAILED - ${error}`);
      }
    } else {
      testResults.channelCreation = true; // N/A for iOS
      console.log(`✅ Channel Creation: N/A (iOS)`);
    }

    // Test 4: Immediate Notification
    try {
      const notificationId = await scheduleImmediateNotifeeNotification('Test', 'This is a test notification');
      testResults.immediateNotification = !!notificationId;
      console.log(`✅ Immediate Notification: ${notificationId ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      console.log(`❌ Immediate Notification: FAILED - ${error}`);
    }

    // Test 5: Trigger Notification
    try {
      const triggerTime = new Date(Date.now() + 10 * 1000); // 10 seconds from now
      await notifee.createTriggerNotification(
        {
          id: 'test-trigger',
          title: '🧪 Test Trigger',
          body: 'This trigger notification was scheduled 10 seconds ago',
          android: { channelId: channelId },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: triggerTime.getTime(),
        }
      );
      testResults.triggerNotification = true;
      console.log(`✅ Trigger Notification: SCHEDULED`);
    } catch (error) {
      console.log(`❌ Trigger Notification: FAILED - ${error}`);
    }

    // Test 6: Status Reporting
    try {
      const status = await getNotifeeServiceStatus();
      testResults.statusReporting = !!status;
      console.log(`✅ Status Reporting: ${status ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      console.log(`❌ Status Reporting: FAILED - ${error}`);
    }

    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;

    console.log(`🎯 TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);

    return {
      results: testResults,
      summary: `${passedTests}/${totalTests} tests passed`,
      allPassed: passedTests === totalTests
    };

  } catch (error) {
    console.error('❌ Error during feature testing:', error);
    return { error: error.message };
  }
}

// =============================================================================
// TESTING FUNCTIONS - For troubleshooting and validation
// =============================================================================

/**
 * Test immediate notification with custom sound
 */
export const testImmediateNotification = async () => {
  try {
    const notificationId = await notifee.displayNotification({
      title: '🧪 Test Immediate Notification',
      body: 'Testing azan sound directly in Notifee',
      data: {
        type: 'test_immediate',
        playManualAzan: "true"
      },
      android: {
        channelId: channelId,
        sound: 'azan.wav', // Try azan sound directly
        vibrationPattern: [300, 600, 300, 600],
        color: '#1a8e2d',
        pressAction: { id: 'default' },
      },
    });

    console.log('✅ Immediate test notification sent with azan sound');

    // Add fallback manual azan playback

    console.log('✅ Immediate test notification sent - Channel will play sound automatically');
    return true;
  } catch (error) {
    console.error('❌ Failed to send immediate test notification:', error);
    return false;
  }
};

/**
 * Test scheduled notification (1 minute from now)
 */
export const testScheduledNotification = async () => {
  try {
    const trigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + 60000, // 1 minute from now
      alarmManager: {
        allowWhileIdle: true,
        exact: true
      },
    };

    await notifee.createTriggerNotification(
      {
        id: 'test_scheduled_notification',
        title: '🧪 Test Scheduled Prayer',
        body: 'This should appear in 1 minute with Azan sound',
        data: {
          type: 'test_scheduled',
          prayerName: 'Test'
        },
        android: {
          channelId: channelId,
          sound: 'azan.wav', // Use azan sound directly
          vibrationPattern: [300, 600, 300, 600],
          color: '#ff9900',
          pressAction: { id: 'default' },
        },
      },
      trigger
    );
    console.log('✅ Scheduled test notification created (1 minute)');
    return true;
  } catch (error) {
    console.error('❌ Failed to create scheduled test notification:', error);
    return false;
  }
};

/**
 * Test Fajr-specific notification
 */
export const testFajrNotification = async () => {
  try {
    await notifee.displayNotification({
      title: '🌅 Test Fajr Notification',
      body: 'Testing Fajr-specific channel and styling',
      android: {
        channelId: 'fajr_prayer_channel',
        sound: 'azan.wav', // Use azan sound directly for Fajr too
        vibrationPattern: [200, 400, 200, 400, 200, 400],
        color: '#0066cc',
        pressAction: { id: 'default' },
      },
    });
    console.log('✅ Fajr test notification sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Fajr test notification:', error);
    return false;
  }
};

/**
 * Check current notification permissions and system status
 */
export const checkNotificationStatus = async () => {
  try {
    const status = {
      permissions: await notifee.getNotificationSettings(),
      exactAlarms: typeof notifee.canScheduleExactAlarms === 'function'
        ? await notifee.canScheduleExactAlarms()
        : true, // Assume true for older versions
      batteryOptimized: typeof notifee.isBatteryOptimizationEnabled === 'function'
        ? await notifee.isBatteryOptimizationEnabled()
        : false,
      powerManager: typeof notifee.getPowerManagerInfo === 'function'
        ? await notifee.getPowerManagerInfo()
        : null,
      scheduledNotifications: await notifee.getTriggerNotifications(),
    };

    console.log('📊 Notification System Status:', JSON.stringify(status, null, 2));
    return status;
  } catch (error) {
    console.error('❌ Failed to check notification status:', error);
    return { error: error.message };
  }
};

/**
 * Run comprehensive notification system test
 */
export const runNotificationSystemTest = async () => {
  console.log('🧪 Starting comprehensive notification system test...');

  const results = {
    permissions: false,
    immediateNotification: false,
    scheduledNotification: false,
    fajrNotification: false,
    systemStatus: null
  };

  try {
    // Check permissions
    const permissions = await requestEssentialPermissions();
    results.permissions = permissions.notifications && permissions.exactAlarms;
    console.log('✅ Permissions check:', results.permissions ? 'PASS' : 'FAIL');

    // Test immediate notification
    results.immediateNotification = await testImmediateNotification();
    console.log('✅ Immediate notification:', results.immediateNotification ? 'PASS' : 'FAIL');

    // Test scheduled notification  
    results.scheduledNotification = await testScheduledNotification();
    console.log('✅ Scheduled notification:', results.scheduledNotification ? 'PASS' : 'FAIL');

    // Test Fajr notification
    results.fajrNotification = await testFajrNotification();
    console.log('✅ Fajr notification:', results.fajrNotification ? 'PASS' : 'FAIL');

    // Get system status
    results.systemStatus = await checkNotificationStatus();
    console.log('✅ System status check: COMPLETE');

    const passedTests = Object.values(results).filter(r => r === true).length;
    const totalTests = 4; // permissions, immediate, scheduled, fajr

    console.log(`🎯 NOTIFICATION TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);

    return {
      results,
      summary: `${passedTests}/${totalTests} tests passed`,
      allPassed: passedTests === totalTests
    };

  } catch (error) {
    console.error('❌ Error during notification system test:', error);
    return { error: error.message, results };
  }
};

// Initialize event handlers when module loads
setupNotifeeEventHandlers();

/**
 * Force recreate notification channels to apply sound changes
 * Call this after updating sound files or when azan sound doesn't work
 */
export async function forceRecreateNotificationChannels() {
  if (Platform.OS !== 'android') {
    console.log('🍎 iOS uses categories, not channels - no need to recreate');
    return true;
  }

  try {
    console.log('🔄 Force recreating notification channels for sound fix...');

    // Delete existing channels first
    await notifee.deleteChannel(channelId);
    await notifee.deleteChannel('fajr_prayer_channel');
    await notifee.deleteChannel('prayer_reminder_channel');

    console.log('🗑️ Deleted existing channels');

    // Wait a moment for deletion to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Recreate channels with correct sound
    await createPrayerNotificationChannels();

    console.log('✅ Notification channels recreated with correct azan sound');
    return true;
  } catch (error) {
    console.error('❌ Error recreating notification channels:', error);
    return false;
  }
}

/**
 * Force refresh all scheduled prayer notifications with new sound settings
 * This will cancel existing notifications and reschedule them with correct channels
 */
export async function forceRefreshPrayerNotifications() {
  try {
    console.log('🔄 Force refreshing all prayer notifications with correct sound...');

    // Step 1: Recreate channels first
    if (Platform.OS === 'android') {
      await forceRecreateNotificationChannels();
    }

    // Step 2: Cancel ALL existing prayer notifications
    const triggerIds = await notifee.getTriggerNotificationIds();
    let canceledCount = 0;
    for (const id of triggerIds) {
      if (id.startsWith('prayer-')) {
        await notifee.cancelTriggerNotification(id);
        canceledCount++;
      }
    }
    console.log(`🗑️ Canceled ${canceledCount} existing prayer notifications`);

    // Step 3: Get current prayer times and settings from storage
    let prayerTimes = null;
    let notificationSettings = {};

    try {
      const storedTimes = await AsyncStorage.getItem('prayer_times');
      if (storedTimes) {
        prayerTimes = JSON.parse(storedTimes);
      }

      const storedSettings = await AsyncStorage.getItem('notification_settings');
      if (storedSettings) {
        notificationSettings = JSON.parse(storedSettings);
      } else {
        // Default settings
        notificationSettings = {
          Fajr: true,
          Sunrise: false,
          Dhuhr: true,
          Asr: true,
          Maghrib: true,
          Isha: true
        };
      }
    } catch (error) {
      console.log('⚠️ Could not load existing prayer settings:', error);
    }

    // Step 4: Reschedule with new sound settings if we have prayer times
    if (prayerTimes) {
      console.log('📅 Rescheduling prayer notifications with correct azan sound...');
      const newScheduledIds = await scheduleNotifeePrayerNotifications(prayerTimes, notificationSettings);
      console.log(`✅ Rescheduled ${newScheduledIds.length} prayer notifications with azan sound`);
      return newScheduledIds;
    } else {
      console.log('⚠️ No prayer times found in storage - notifications will be scheduled when times are set');
      return [];
    }

  } catch (error) {
    console.error('❌ Error force refreshing prayer notifications:', error);
    return [];
  }
}

/**
 * Reset battery optimization and power management "don't ask again" preferences
 * Useful for settings screen to allow users to reset their choices
 */
export async function resetDontAskAgainPreferences() {
  try {
    await AsyncStorage.removeItem('battery_optimization_dont_ask');
    await AsyncStorage.removeItem('power_management_dont_ask');
    console.log('✅ Reset "don\'t ask again" preferences for battery optimization and power management');
    return true;
  } catch (error) {
    console.error('❌ Error resetting "don\'t ask again" preferences:', error);
    return false;
  }
}

/**
 * Check current "don't ask again" preferences status
 */
export async function getDontAskAgainStatus() {
  try {
    const batteryDontAsk = await AsyncStorage.getItem('battery_optimization_dont_ask');
    const powerDontAsk = await AsyncStorage.getItem('power_management_dont_ask');

    return {
      batteryOptimization: batteryDontAsk === 'true',
      powerManagement: powerDontAsk === 'true'
    };
  } catch (error) {
    console.error('❌ Error checking "don\'t ask again" status:', error);
    return {
      batteryOptimization: false,
      powerManagement: false
    };
  }
}
