import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Define notification channel IDs
export const CHANNEL_IDS = {
  // Main channels for different sounds
  AZAN_CHANNEL: 'prayer-azan',
  BEEP_CHANNEL: 'prayer-beep',
  
  // Prayer-specific channels 
  FAJR_CHANNEL: 'prayer-fajr',
  SUNRISE_CHANNEL: 'prayer-sunrise',
  DHUHR_CHANNEL: 'prayer-dhuhr',
  ASR_CHANNEL: 'prayer-asr',
  MAGHRIB_CHANNEL: 'prayer-maghrib',
  ISHA_CHANNEL: 'prayer-isha',
  
  // Default/fallback channel
  DEFAULT_CHANNEL: 'prayer-default'
};

/**
 * Set up all notification channels for Android
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') {
    return; // Channels only needed for Android
  }
  
  try {
    // Create channel for azan sound (higher importance)
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.AZAN_CHANNEL, {
      name: 'Azan Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'azan.wav', // Reference to raw resource
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#FFD700',
      description: 'Notifications with the Azan sound',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true, // Try to play even in Do Not Disturb mode
    });

    // Create channel for beep sound
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.BEEP_CHANNEL, {
      name: 'Simple Alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'beep.wav', // Reference to raw resource
      vibrationPattern: [0, 300],
      lightColor: '#FFFFFF',
      description: 'Simple alert notifications',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    
    // Create specific prayer channels with customized settings
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.FAJR_CHANNEL, {
      name: 'Fajr Prayer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'azan.wav',
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#4169E1', // Blue light for Fajr
      description: 'Fajr prayer time notifications',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
    
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.SUNRISE_CHANNEL, {
      name: 'Sunrise',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'beep.wav',
      vibrationPattern: [0, 300], 
      lightColor: '#FFAE42', // Orange light for sunrise
      description: 'Sunrise notifications',
    });
    
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.DHUHR_CHANNEL, {
      name: 'Dhuhr Prayer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'azan.wav',
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#FFD700', // Gold light for Dhuhr
      description: 'Dhuhr prayer time notifications',
    });
    
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.ASR_CHANNEL, {
      name: 'Asr Prayer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'azan.wav',
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#E5A135', // Amber light for Asr
      description: 'Asr prayer time notifications',
    });
    
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.MAGHRIB_CHANNEL, {
      name: 'Maghrib Prayer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'azan.wav',
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#FF5733', // Red-orange light for Maghrib
      description: 'Maghrib prayer time notifications',
    });
    
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.ISHA_CHANNEL, {
      name: 'Isha Prayer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'azan.wav',
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#800080', // Purple light for Isha
      description: 'Isha prayer time notifications',
    });
    
    // Default channel as fallback
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.DEFAULT_CHANNEL, {
      name: 'Prayer Times',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: true, // Use default sound
      description: 'General prayer time notifications',
    });

    console.log("Notification channels setup complete");
  } catch (error) {
    console.error("Error setting up notification channels:", error);
  }
}

/**
 * Get the appropriate channel ID for a specific prayer
 * @param {string} prayerName - The name of the prayer
 * @param {boolean} useAzanSound - Whether to use the azan sound
 * @returns {string} The channel ID to use
 */
export function getChannelForPrayer(prayerName, useAzanSound = true) {
  // If prayer is Sunrise or not using azan sound, use beep channel
  if (prayerName === 'Sunrise' || !useAzanSound) {
    return prayerName === 'Sunrise' 
      ? CHANNEL_IDS.SUNRISE_CHANNEL 
      : CHANNEL_IDS.BEEP_CHANNEL;
  }
  
  // Otherwise use prayer-specific channel
  switch(prayerName) {
    case 'Fajr': return CHANNEL_IDS.FAJR_CHANNEL;
    case 'Dhuhr': return CHANNEL_IDS.DHUHR_CHANNEL;
    case 'Asr': return CHANNEL_IDS.ASR_CHANNEL;
    case 'Maghrib': return CHANNEL_IDS.MAGHRIB_CHANNEL;
    case 'Isha': return CHANNEL_IDS.ISHA_CHANNEL;
    default: return useAzanSound ? CHANNEL_IDS.AZAN_CHANNEL : CHANNEL_IDS.DEFAULT_CHANNEL;
  }
}
