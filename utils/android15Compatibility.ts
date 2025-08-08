import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

/**
 * Android 15 (API 35) specific permission and compatibility utilities
 */

export interface Android15Features {
  hasEdgeToEdgeSupport: boolean;
  hasEnhancedNotifications: boolean;
  hasBatteryOptimizationControls: boolean;
  hasPrivacyDashboard: boolean;
}

/**
 * Check if the device is running Android 15 or higher
 */
export function isAndroid15OrHigher(): boolean {
  if (Platform.OS !== 'android') return false;
  return Device.platformApiLevel ? Device.platformApiLevel >= 35 : false;
}

/**
 * Get Android 15 specific features availability
 */
export function getAndroid15Features(): Android15Features {
  const isAndroid15 = isAndroid15OrHigher();
  
  return {
    hasEdgeToEdgeSupport: isAndroid15,
    hasEnhancedNotifications: isAndroid15,
    hasBatteryOptimizationControls: isAndroid15,
    hasPrivacyDashboard: isAndroid15,
  };
}

/**
 * Request enhanced notification permissions for Android 15
 */
export async function requestAndroid15NotificationPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  
  try {
    // Request basic notification permissions
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
      android: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    
    if (status !== 'granted') {
      return false;
    }
    
    // For Android 15+, we might need additional permissions
    if (isAndroid15OrHigher()) {
      // Additional Android 15 specific permission checks can be added here
      console.log('Android 15+ detected, using enhanced notification features');
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting Android 15 notification permissions:', error);
    return false;
  }
}

/**
 * Open Android 15 specific battery optimization settings
 */
export async function openAndroid15BatterySettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  
  try {
    if (isAndroid15OrHigher()) {
      // Try Android 15 specific battery settings
      await IntentLauncher.startActivityAsync('android.settings.BATTERY_OPTIMIZATION_SETTINGS');
      return true;
    } else {
      // Fallback for older versions
      await IntentLauncher.startActivityAsync(
        'android.settings.APPLICATION_DETAILS_SETTINGS',
        {
          data: 'package:' + (Constants.manifest?.android?.package || Constants.expoConfig?.android?.package || 'com.yourapp.name')
        }
      );
      return true;
    }
  } catch (error) {
    console.error('Error opening Android 15 battery settings:', error);
    return false;
  }
}

/**
 * Handle Android 15 edge-to-edge display considerations
 */
export function getAndroid15EdgeToEdgeStyles() {
  if (!isAndroid15OrHigher()) {
    return {};
  }
  
  return {
    // Add padding for system bars in edge-to-edge mode
    paddingTop: Platform.OS === 'android' ? 24 : 0, // Status bar height
    paddingBottom: Platform.OS === 'android' ? 48 : 0, // Navigation bar height
  };
}

/**
 * Configure Android 15 optimized notification channels
 */
export async function setupAndroid15NotificationChannels() {
  if (Platform.OS !== 'android') return;
  
  const channels = [
    {
      identifier: 'prayer-times-high',
      name: 'Prayer Times (High Priority)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'azan.wav',
      vibrationPattern: [0, 500, 200, 500],
      description: 'High priority notifications for main prayer times',
    },
    {
      identifier: 'prayer-times-normal',
      name: 'Prayer Times (Normal)',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'beep.wav',
      vibrationPattern: [0, 300],
      description: 'Normal priority notifications for sunrise and other reminders',
    },
    {
      identifier: 'prayer-reminders',
      name: 'Prayer Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'beep.wav',
      vibrationPattern: [0, 200, 100, 200],
      description: 'Reminder notifications before prayer times',
    },
  ];
  
  for (const channel of channels) {
    try {
      await Notifications.setNotificationChannelAsync(channel.identifier, {
        name: channel.name,
        importance: channel.importance,
        sound: channel.sound,
        vibrationPattern: channel.vibrationPattern,
        description: channel.description,
        enableLights: true,
        lightColor: '#FF6B35',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (error) {
      console.error(`Error setting up notification channel ${channel.identifier}:`, error);
    }
  }
}

/**
 * Check Android 15 app targeting compliance
 */
export function checkAndroid15Compliance(): {
  isCompliant: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check target SDK version
  const targetSdk = Constants.manifest?.android?.targetSdkVersion || 35;
  
  if (!targetSdk || targetSdk < 35) {
    issues.push('Target SDK version should be 35 for Android 15 compliance');
    recommendations.push('Update app.json to set android.targetSdkVersion to 35');
  }
  
  // Check permissions
  const permissions = Constants.manifest?.android?.permissions || 
                     Constants.expoConfig?.android?.permissions || [];
  
  if (!permissions.includes('POST_NOTIFICATIONS')) {
    issues.push('POST_NOTIFICATIONS permission required for Android 15');
    recommendations.push('Add POST_NOTIFICATIONS to android.permissions in app.json');
  }
  
  if (!permissions.includes('USE_EXACT_ALARM')) {
    recommendations.push('Consider adding USE_EXACT_ALARM permission for precise prayer time notifications');
  }
  
  return {
    isCompliant: issues.length === 0,
    issues,
    recommendations,
  };
}
