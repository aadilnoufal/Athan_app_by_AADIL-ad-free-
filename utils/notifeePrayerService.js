// =============================================================================
// NOTIFEE PRAYER NOTIFICATION SERVICE - ENTERPRISE GRADE
// =============================================================================
// Advanced notification service using Notifee for maximum reliability and features
// Key improvements:
// 1. Better reliability across Android versions
// 2. Rich notification support with actions
// 3. Precise scheduling with timestamp triggers
// 4. Better permission handling
// 5. Channel management for Android
// 6. Background task survival
// 7. Battery optimization handling
// 8. Initial notification detection
// 9. Enhanced debugging and status reporting
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
const requestAlarmPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      // Check if exact alarm permission method is available
      if (typeof notifee.canScheduleExactAlarms !== 'function') {
        console.log('⚠️ canScheduleExactAlarms not available in this Notifee version');
        return true; // Assume permission is granted for older versions
      }
      
      // Check if exact alarm permission is available (Android 12+)
      const alarmPermissionStatus = await notifee.canScheduleExactAlarms();
      console.log('🔔 Exact alarm permission status:', alarmPermissionStatus);
      
      if (!alarmPermissionStatus) {
        Alert.alert(
          'Exact Alarms Permission Required',
          'For accurate prayer time notifications, please enable "Alarms & reminders" permission. This is required for Android 12+.',
          [
            {
              text: 'Open Settings',
              onPress: async () => {
                if (typeof notifee.openAlarmPermissionSettings === 'function') {
                  await notifee.openAlarmPermissionSettings();
                } else {
                  console.log('⚠️ openAlarmPermissionSettings not available');
                }
              },
            },
            { text: 'Later', style: 'cancel' },
          ]
        );
        return false;
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
      // Check if battery optimization is enabled
      const batteryOptimizationEnabled = await notifee.isBatteryOptimizationEnabled();
      console.log('🔋 Battery optimization enabled:', batteryOptimizationEnabled);
      
      if (batteryOptimizationEnabled) {
        Alert.alert(
          'Battery Optimization Detected',
          'To ensure prayer notifications work reliably, please disable battery optimization for this app.',
          [
            {
              text: 'Open Settings',
              onPress: async () => {
                await notifee.openBatteryOptimizationSettings();
              },
            },
            { text: 'Later', style: 'cancel' },
          ]
        );
      }

      // Check device-specific power management
      const powerManagerInfo = await notifee.getPowerManagerInfo();
      if (powerManagerInfo.activity) {
        console.log('⚡ Power manager info:', powerManagerInfo);
        Alert.alert(
          'Power Management Settings',
          'Please add this app to auto-start/whitelist to ensure notifications work properly.',
          [
            {
              text: 'Open Settings', 
              onPress: async () => {
                await notifee.openPowerManagerSettings();
              },
            },
            { text: 'Later', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.log('⚠️ Battery optimization check failed:', error);
    }
  }
};

/**
 * Request all essential permissions for prayer notifications
 */
const requestEssentialPermissions = async () => {
  try {
    console.log('🔐 Requesting essential permissions...');
    
    // Request notification permission
    const notificationPermission = await notifee.requestPermission();
    console.log('🔔 Notification permission:', notificationPermission);
    
    // Request exact alarm permission (Android 12+)
    const alarmPermission = await requestAlarmPermission();
    
    // Check battery optimization
    await checkBatteryOptimization();
    
    return {
      notifications: notificationPermission.authorizationStatus === 1,
      exactAlarms: alarmPermission
    };
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
 * Create enhanced notification channels with custom azan sounds
 * Supports custom azan audio directly within Notifee notifications
 */
async function createPrayerNotificationChannels() {
  if (Platform.OS !== 'android') return;

  try {
    // Main prayer channel with custom azan sound
    await notifee.createChannel({
      id: channelId,
      name: 'Prayer Times',
      description: 'Main notifications for daily prayer times with azan',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      // For EAS builds, try using the bundled asset path
      sound: 'azan', // This should match the file in assets/sounds/azan.wav
      vibration: true,
      vibrationPattern: [300, 600, 300, 600], // Even number of values (4)
      lightColor: '#1a8e2d',
      lights: true,
      badge: true,
    });

    // Special channel for Fajr with azan sound
    await notifee.createChannel({
      id: 'fajr_prayer_channel',
      name: 'Fajr Prayer',
      description: 'Fajr prayer notifications with azan sound',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'azan', // Use custom azan sound for Fajr too
      vibration: true,
      vibrationPattern: [200, 400, 200, 400, 200, 400], // Even number of values (6)
      lightColor: '#0066cc',
      lights: true,
      badge: true,
    });

    // Reminder channel with default sound (no azan for reminders)
    await notifee.createChannel({
      id: 'prayer_reminder_channel',
      name: 'Prayer Reminders',
      description: 'Reminder notifications before prayer times',
      importance: AndroidImportance.DEFAULT,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default', // Default sound for reminders
      vibration: true,
      vibrationPattern: [200, 300, 200, 300], // Even number of values (4)
      lightColor: '#ff9900',
      lights: true,
      badge: false,
    });

    console.log("📱 Enhanced notification channels created with custom azan sounds");
    
  } catch (error) {
    console.error("❌ Error creating notification channels:", error);
    // Fallback to default sound channels
    await createFallbackChannels();
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
 */
export async function scheduleNotifeePrayerNotifications(prayerTimes, settings = {}) {
  if (!prayerTimes) {
    console.log("❌ No prayer times provided");
    return [];
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
    console.log(`🔊 Sound preference: ${useAzanSound ? 'Azan sound' : 'Beep sound'}`);
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

      // Determine notification settings based on prayer and user preference
      const shouldUseAzan = useAzanSound && prayer !== 'Sunrise';
      const soundType = shouldUseAzan ? 'azan' : 'beep';

      // Create enhanced trigger for maximum reliability
      const trigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: prayerDate.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: {
          allowWhileIdle: true, // Allow notifications in Doze mode
          exact: true, // Use exact timing (Android 12+ compatible)
        }
      };

      // Determine which channel to use based on prayer type
      const channelToUse = prayer === 'Fajr' ? 'fajr_prayer_channel' : channelId;

      // Create notification
      const notificationId = `prayer-${prayer.toLowerCase()}`;
      
      await notifee.createTriggerNotification(
        {
          id: notificationId,
          title: `🕌 ${prayer} Prayer Time`,
          body: `It's time for ${prayer} prayer (${time})`,
          data: { 
            prayerName: prayer,
            prayerTime: time,
            type: "prayer-reminder",
            soundType: soundType
          },
          android: {
            channelId: channelToUse, // Use appropriate channel for prayer type
            category: AndroidCategory.REMINDER,
            // Use the default notification icon from Expo
            smallIcon: 'ic_launcher_foreground',
            color: prayer === 'Fajr' ? '#0066cc' : '#1a8e2d', // Different color for Fajr
            // Use custom azan sound directly in Notifee
            sound: shouldUseAzan ? 'azan' : 'default',
            vibrationPattern: prayer === 'Fajr' ? [200, 400, 200, 400, 200, 400] : [300, 600, 300, 600],
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            actions: [
              {
                title: '🤲 Mark as Read',
                pressAction: {
                  id: 'mark_read',
                },
              },
              {
                title: '⏰ Snooze 5min',
                pressAction: {
                  id: 'snooze',
                },
              },
            ],
          },
          ios: {
            categoryId: 'prayer-category',
            sound: 'default',
            criticalSound: {
              name: 'default',
              volume: 1.0,
            },
          },
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

      const soundInfo = shouldUseAzan ? '🔊 azan' : '🔔 beep';
      console.log(`✅ Scheduled ${prayer} at ${time} (${soundInfo}) (ID: ${notificationId})`);
    }

    console.log(`🎯 Successfully scheduled ${scheduledIds.length} prayer notifications with Notifee`);
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

    // Also cancel any displayed notifications
    const displayedNotifications = await notifee.getDisplayedNotifications();
    for (const notification of displayedNotifications) {
      if (notification.notification?.data?.type === "prayer-reminder") {
        await notifee.cancelDisplayedNotification(notification.id);
        canceledCount++;
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
 * Update prayer notifications (main function to call when times change)
 */
let lastUpdateAttempt = 0;
const UPDATE_COOLDOWN = 3000; // 3 seconds cooldown

export async function updateNotifeePrayerNotifications(prayerTimes, settings = {}) {
  try {
    // Implement cooldown to prevent rapid re-scheduling
    const now = Date.now();
    if (now - lastUpdateAttempt < UPDATE_COOLDOWN) {
      console.log(`⏱️ Notifee update cooldown active, skipping (${UPDATE_COOLDOWN/1000}s cooldown)`);
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
    
    console.log(`🔊 ${prayerName} notification will use: ${shouldUseAzan ? 'azan (hybrid)' : 'default'} sound`);
    
    const notificationId = await notifee.displayNotification({
      title: `🕌 ${prayerName} Prayer Time`,
      body: message || `It's time for ${prayerName} prayer`,
      data: { 
        prayerName,
        type: "immediate-prayer-reminder",
        soundType: shouldUseAzan ? 'azan' : 'default',
        playManualAzan: shouldUseAzan.toString() // Flag for fallback manual azan
      },
      android: {
        channelId: channelId,
        category: AndroidCategory.REMINDER,
        // Use the default notification icon from Expo
        smallIcon: 'ic_launcher_foreground',
        color: '#1a8e2d',
        // Use azan sound directly in Notifee (no separate audio)
        sound: shouldUseAzan ? 'azan' : 'default',
        vibrationPattern: [300, 600, 300, 600],
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
      ios: {
        categoryId: 'prayer-category',
        sound: shouldUseAzan ? 'azan.wav' : 'default',
      },
    });

    const soundInfo = shouldUseAzan ? '🔊 azan (Notifee + fallback)' : '🔔 default sound';
    console.log(`⚡ Immediate Notifee notification displayed for ${prayerName} (${soundInfo}) (ID: ${notificationId})`);
    
    // Add fallback manual azan playback if needed
    if (shouldUseAzan) {
      setTimeout(async () => {
        try {
          console.log(`🎵 Playing fallback azan sound for ${prayerName}`);
          const { playPrayerSound } = require('../utils/audioHelper');
          await playPrayerSound(prayerName, true, false); // Play azan, no vibration (already done by notification)
          console.log(`✅ Fallback azan sound played for ${prayerName}`);
        } catch (soundError) {
          console.warn('⚠️ Fallback azan sound also failed:', soundError.message);
        }
      }, 500); // Short delay to let Notifee sound attempt first
    }
    
    return notificationId;
  } catch (error) {
    console.error("❌ Error scheduling immediate Notifee notification:", error);
    return null;
  }
}

/**
 * Schedule test notification
 */
export async function scheduleNotifeeTestNotification() {
  try {
    // Get sound preference
    const useAzanSound = await getSoundPreference();
    const shouldUseAzan = useAzanSound;
    console.log(`🔊 Test notification will use: ${shouldUseAzan ? 'azan (hybrid)' : 'default'} sound`);
    
    const notificationId = await notifee.displayNotification({
      title: "Test notification",
      body: `Testing azan sound! (${shouldUseAzan ? 'azan' : 'default'} sound)`,
      data: { 
        type: "test",
        soundType: shouldUseAzan ? 'azan' : 'default',
        playManualAzan: shouldUseAzan.toString()
      },
      android: {
        channelId: channelId,
        category: AndroidCategory.REMINDER,
        // Use the default notification icon from Expo
        smallIcon: 'ic_launcher_foreground',
        color: '#1a8e2d',
        // Use azan sound directly in Notifee (no separate audio)
        sound: shouldUseAzan ? 'azan' : 'default',
        vibrationPattern: [300, 600, 300, 600],
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        categoryId: 'prayer-category',
        sound: shouldUseAzan ? 'azan.wav' : 'default',
      },
    });

    console.log(`🧪 Test notification displayed (ID: ${notificationId})`);
    
    // Add fallback manual azan playback for test if needed
    if (shouldUseAzan) {
      setTimeout(async () => {
        try {
          console.log(`🎵 Playing fallback azan sound for test notification`);
          const { playPrayerSound } = require('../utils/audioHelper');
          await playPrayerSound('Test', true, false); // Play azan, no vibration
          console.log(`✅ Fallback azan sound played for test notification`);
        } catch (soundError) {
          console.warn('⚠️ Fallback azan sound failed for test:', soundError.message);
        }
      }, 500); // Short delay to let Notifee sound attempt first
    }
    
    return notificationId;
  } catch (error) {
    console.error("❌ Error scheduling test notification:", error);
    return null;
  }
}

/**
 * Handle notification events (foreground events)
 */
export function setupNotifeeEventHandlers() {
  // Handle notification press events
  notifee.onForegroundEvent(({ type, detail }) => {
    const { notification, pressAction } = detail;
    
    // Filter out unwanted event types to prevent spam
    if (type === 7 || type === undefined) {
      // Type 7 seems to be a system event that fires constantly - ignore it
      return;
    }
    
    console.log('📱 Notifee foreground event:', type, pressAction?.id);
    
    switch (type) {
      case EventType.DISMISSED:
        console.log('🗑️ Notification dismissed by user');
        break;
        
      case EventType.PRESS:
        console.log('👆 Notification pressed by user');
        break;
        
      case EventType.ACTION_PRESS:
        switch (pressAction?.id) {
          case 'mark_read':
            console.log('🤲 Prayer notification marked as read');
            // Handle mark as read action
            if (notification?.id) {
              notifee.cancelDisplayedNotification(notification.id);
            }
            break;
            
          case 'snooze':
            console.log('⏰ Prayer notification snoozed for 5 minutes');
            // Handle snooze action - schedule another notification in 5 minutes
            if (notification?.data?.prayerName) {
              scheduleSnoozeNotification(notification.data.prayerName);
            }
            break;
        }
        break;
        
      case EventType.DELIVERED:
        console.log('📨 Notification delivered');
        
        // Hybrid azan system: Try Notifee sound first, fallback to manual playback
        const prayerData = notification?.data;
        if (prayerData?.type === 'prayer-reminder' && prayerData.soundType === 'azan') {
          console.log(`🔊 ${prayerData.prayerName} notification delivered - triggering azan fallback`);
          
          // Add small delay to allow Notifee sound to play first, then fallback
          setTimeout(async () => {
            console.log(`🎵 Playing fallback azan sound for ${prayerData.prayerName} prayer`);
            try {
              // Import and use the audio helper for fallback
              const { playAzanSound } = await import('../utils/audioHelper');
              await playAzanSound(prayerData.prayerName);
              console.log(`✅ Fallback azan sound played for ${prayerData.prayerName} prayer`);
            } catch (error) {
              console.error('❌ Failed to play fallback azan sound:', error);
            }
          }, 500); // 500ms delay for hybrid approach
        } else if (prayerData?.type === 'prayer-reminder') {
          console.log(`� ${prayerData.prayerName} notification delivered with ${prayerData.soundType} sound`);
        }
        break;
    }
  });
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
      soundPreference: useAzanSound ? 'Azan (except Sunrise)' : 'Beep for all prayers',
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
  if (Platform.OS !== 'android') return true;
  
  try {
    const batteryOptimizationEnabled = await notifee.isBatteryOptimizationEnabled();
    if (batteryOptimizationEnabled) {
      Alert.alert(
        'Battery Optimization Detected',
        'To ensure prayer notifications are delivered reliably, please disable battery optimization for this app.',
        [
          {
            text: 'Open Settings',
            onPress: async () => await notifee.openBatteryOptimizationSettings(),
          },
          {
            text: 'Later',
            style: 'cancel',
          },
        ],
        { cancelable: false }
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("❌ Error checking battery optimization:", error);
    return true;
  }
}

/**
 * Check and handle power manager restrictions
 */
export async function checkAndHandlePowerManager() {
  if (Platform.OS !== 'android') return true;
  
  try {
    const powerManagerInfo = await notifee.getPowerManagerInfo();
    if (powerManagerInfo.activity) {
      Alert.alert(
        'Power Management Restrictions Detected',
        'To ensure prayer notifications work properly, please adjust your power management settings to prevent this app from being killed.',
        [
          {
            text: 'Open Settings',
            onPress: async () => await notifee.openPowerManagerSettings(),
          },
          {
            text: 'Later',
            style: 'cancel',
          },
        ],
        { cancelable: false }
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("❌ Error checking power manager:", error);
    return true;
  }
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
        sound: 'azan', // Try azan sound directly
        vibrationPattern: [300, 600, 300, 600],
        color: '#1a8e2d',
        pressAction: { id: 'default' },
      },
    });
    
    console.log('✅ Immediate test notification sent with azan sound');
    
    // Add fallback manual azan playback
    setTimeout(async () => {
      try {
        console.log(`🎵 Playing fallback azan sound for immediate test`);
        const { playPrayerSound } = require('../utils/audioHelper');
        await playPrayerSound('Test', true, false); // Play azan, no vibration
        console.log(`✅ Fallback azan sound played for immediate test`);
      } catch (soundError) {
        console.warn('⚠️ Fallback azan sound failed for immediate test:', soundError.message);
      }
    }, 500);
    
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
          sound: 'azan', // Use azan sound directly
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
        sound: 'azan', // Use azan sound directly for Fajr too
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
