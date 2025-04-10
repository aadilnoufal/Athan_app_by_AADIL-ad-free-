import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

// Preload custom sound
const customSound = Asset.fromModule(require('../assets/sounds/azan.mp3')).uri;

/**
 * Setup notification channels for Android
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('prayer-reminders', {
        name: 'Prayer Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'azan.mp3', // Ensure this matches the file name in assets/sounds
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
      });

      console.log("Notification channel setup complete");
    } catch (error) {
      console.error("Error setting up notification channel:", error);
    }
  }
}

/**
 * Schedule a prayer time notification with immediate trigger for testing
 * @param {string} prayerName - Name of the prayer
 */
export async function scheduleImmediateNotification(prayerName) {
  try {
    const useAzanSound = await AsyncStorage.getItem('use_azan_sound') === 'true';
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Test: ${prayerName} Prayer`,
        body: `This is a test notification for ${prayerName} prayer time`,
        data: { prayerName },
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sound: customSound, // Use custom sound
      },
      trigger: {
        seconds: 5, // Show after 5 seconds
        channelId: 'prayer-reminders', // Use the prayer-reminders channel
      },
    });

    console.log(`Test notification for ${prayerName} scheduled`);
  } catch (error) {
    console.error("Error scheduling test notification:", error);
    
    // Fallback with minimal options
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Test: ${prayerName} Prayer (Fallback)`,
          body: `This is a test notification for ${prayerName} prayer time`,
          data: { prayerName },
        },
        trigger: { seconds: 5 },
      });
    } catch (fallbackError) {
      console.error("Even fallback notification failed:", fallbackError);
    }
  }
}

/**
 * Schedule a notification with custom sound
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Date} triggerDate - Date and time to trigger the notification
 */
export async function schedulePrayerNotification(title, body, triggerDate) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: customSound, // Use custom sound
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: 'date',
        timestamp: triggerDate.getTime(), // Use the new trigger format
      },
    });
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
}

/**
 * Handle foreground notifications
 */
export function setupForegroundNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Check and request notification permissions
 * @returns {Promise<boolean>} Whether permissions are granted
 */
export async function checkAndRequestNotificationPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    // If we already have permission, return true
    if (existingStatus === 'granted') {
      return true;
    }
    
    // Otherwise, ask the user for permission
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error("Error checking notification permissions:", error);
    return false;
  }
}

/**
 * Check and request battery optimization exemption (Android only)
 */
export async function requestBatteryOptimizationExemption() {
  if (Platform.OS === 'android') {
    try {
      const batteryOptimizationEnabled = await Battery.isBatteryOptimizationEnabledAsync();
      
      if (batteryOptimizationEnabled) {
        // Open battery optimization settings
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
        );
      }
    } catch (error) {
      console.error('Failed to request battery optimization exemption:', error);
    }
  }
}
