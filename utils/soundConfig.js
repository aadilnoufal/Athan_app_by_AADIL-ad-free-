import { Platform } from 'react-native';

/**
 * Get the correct sound filename based on platform and prayer type
 * @param {string} prayerName - The name of the prayer
 * @param {boolean} useAzanSound - Whether to use Azan sound for main prayers
 * @returns {string} - The sound file reference
 */
export function getSoundForPrayer(prayerName, useAzanSound) {
  // Determine if we should use the Azan sound
  const shouldUseAzan = useAzanSound && prayerName !== 'Sunrise';
  
  // Base filenames
  const azanFile = 'azan.waw';
  const beepFile = 'beep.waw';
  
  if (Platform.OS === 'android') {
    // For Android, reference the raw resource
    return shouldUseAzan ? azanFile : beepFile;
  } else if (Platform.OS === 'ios') {
    // For iOS, provide the full path
    return shouldUseAzan ? './assets/sounds/azan.waw' : './assets/sounds/beep.waw';
  } else {
    // For other platforms, provide the asset path
    return shouldUseAzan ? require('../assets/sounds/azan.waw') : require('../assets/sounds/beep.waw');
  }
}
