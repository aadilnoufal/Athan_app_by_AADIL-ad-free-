import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

/**
 * Request battery optimization exemption for better notification delivery
 * Opens the system settings where users can disable battery optimization for this app
 */
export async function requestBatteryOptimizationExemption() {
  if (Platform.OS !== 'android') {
    console.log('Battery optimization is only relevant for Android');
    return false;
  }

  try {
    // Try to open app-specific battery optimization settings
    const packageName = Constants.expoConfig?.android?.package || 
                       Constants.manifest?.android?.package || 
                       'host.exp.exponent'; // Fallback for Expo Go

    await IntentLauncher.startActivityAsync(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      {
        data: `package:${packageName}`,
      }
    );
    
    console.log('Opened app settings for battery optimization');
    return true;
  } catch (error) {
    console.error('Failed to open app-specific settings:', error);
    
    // Fallback: try opening general battery optimization settings
    try {
      await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      console.log('Opened general battery optimization settings');
      return true;
    } catch (fallbackError) {
      console.error('Failed to open battery optimization settings:', fallbackError);
      return false;
    }
  }
}

/**
 * Check if the app might be affected by battery optimization
 * Note: This is a heuristic check since we can't directly query optimization status in Expo
 */
export function shouldRequestBatteryOptimizationExemption() {
  return Platform.OS === 'android' && Platform.Version >= 23; // Android 6.0+
}