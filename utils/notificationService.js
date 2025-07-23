import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Vibration } from 'react-native';
import { Asset } from 'expo-asset';
import { setupNotificationChannels as setupChannels, getChannelForPrayer, CHANNEL_IDS } from './notificationChannels';

// Store asset references
const soundAssets = {
  azan: require('../assets/sounds/azan.wav'),
  beep: require('../assets/sounds/beep.wav')
};

// Preload and track assets
let downloadedAssets = {};

/**
 * Preload sound assets so they're ready for use
 */
export async function preloadSoundAssets() {
  try {
    // Preload both sound assets
    const azan = Asset.fromModule(soundAssets.azan);
    const beep = Asset.fromModule(soundAssets.beep);
    
    await Promise.all([
      azan.downloadAsync(),
      beep.downloadAsync()
    ]);
    
    downloadedAssets = {
      azan,
      beep
    };
    
    console.log('Sound assets preloaded successfully');
    return true;
  } catch (error) {
    console.error('Failed to preload sound assets:', error);
    return false;
  }
}

/**
 * Setup notification channels for Android
 * This is a wrapper around the implementation in notificationChannels.js
 */
export async function setupNotificationChannels() {
  await setupChannels();
}

/**
 * Schedule a prayer time notification with immediate trigger for testing
 * @param {string} prayerName - Name of the prayer
 */
export async function scheduleImmediateNotification(prayerName) {
  try {
    // First preload the assets to ensure they're available
    await preloadSoundAssets();
    
    const useAzanSound = await AsyncStorage.getItem('use_azan_sound') === 'true';
    
    // Use the appropriate channel
    const channelId = Platform.OS === 'android' 
      ? getChannelForPrayer(prayerName || 'Test', useAzanSound)
      : undefined;
    
    // Determine which sound file to use
    const soundName = (prayerName === 'Sunrise' || !useAzanSound) ? 'beep.wav' : 'azan.wav';
    
    // Determine vibration pattern based on prayer
    let vibrationPattern;
    if (prayerName === 'Fajr') {
      vibrationPattern = [0, 500, 200, 500, 200, 500]; // Special pattern for Fajr
    } else if (prayerName === 'Sunrise') {
      vibrationPattern = [0, 300]; // Shorter pattern for Sunrise
    } else {
      vibrationPattern = [0, 500, 200, 500]; // Standard pattern for other prayers
    }
    
    // Vibrate immediately so the user gets feedback even if notification fails
    Vibration.vibrate(vibrationPattern);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Test: ${prayerName} Prayer`,
        body: `This is a test notification for ${prayerName} prayer time`,
        data: { 
          prayerName,
          useAzanSound,
          customSound: true,
          vibrationPattern
        },
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sound: soundName, // Explicitly set the sound file
        vibrate: vibrationPattern // Set custom vibration pattern
      },
      trigger: {
        seconds: 5, // Show after 5 seconds
        channelId: channelId,
      },
    });

    console.log(`Test notification for ${prayerName} scheduled using channel: ${channelId} with sound: ${soundName} and vibration`);
  } catch (error) {
    console.error("Error scheduling test notification:", error);
    
    // Fallback with minimal options
    try {
      // At least vibrate to provide feedback
      Vibration.vibrate([0, 300, 200, 300]);
      
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
 * @param {string} prayer - Prayer name for channel selection
 */
export async function schedulePrayerNotification(title, body, triggerDate, prayer = 'Default') {
  try {
    const useAzanSound = await AsyncStorage.getItem('use_azan_sound') === 'true';
    
    // Use the appropriate channel
    const channelId = Platform.OS === 'android' 
      ? getChannelForPrayer(prayer, useAzanSound)
      : undefined;
    
    // Determine the sound to use
    const soundName = (prayer === 'Sunrise' || !useAzanSound) ? 'beep.wav' : 'azan.wav';
    
    // Determine vibration pattern based on prayer
    let vibrationPattern;
    if (prayer === 'Fajr') {
      vibrationPattern = [0, 500, 200, 500, 200, 500]; // Special pattern for Fajr
    } else if (prayer === 'Sunrise') {
      vibrationPattern = [0, 300]; // Shorter pattern for Sunrise
    } else {
      vibrationPattern = [0, 500, 200, 500]; // Standard pattern for other prayers
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: soundName,
        vibrate: vibrationPattern,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { 
          prayerName: prayer, 
          useAzanSound,
          customSound: true,
          vibrationPattern
        }
      },
      trigger: {
        type: 'date',
        timestamp: triggerDate.getTime(),
        channelId: channelId,
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
