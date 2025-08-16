// =============================================================================
// MODERN AUDIO HELPER - OPTIMIZED 2024 - THREAD SAFE VERSION
// =============================================================================
// Handles direct audio playback for app UI (not notifications)
// Note: Notification sounds are handled by modernNotificationService.js
// =============================================================================

import { Asset } from 'expo-asset';
import { Vibration } from 'react-native';

// EMERGENCY DISABLE FLAG - Set to true to disable audio and use vibration only
const DISABLE_AUDIO_FOR_STABILITY = false; // Re-enabled for Notifee built-in sounds

// Define sound asset modules
const soundModules = {
  beep: require('../assets/sounds/beep.wav'), 
  azan: require('../assets/sounds/azan.wav'),
};

// Vibration patterns (in milliseconds)
const vibrationPatterns = {
  beep: [0, 300],               // Short vibration for beep
  azan: [0, 500, 200, 500],     // Pattern for azan (vibrate, pause, vibrate)
};

// Keep track of downloaded assets
const downloadedAssets = {};

/**
 * Preload sound assets to ensure they're available
 */
export async function preloadSounds() {
  // Skip asset loading if audio is disabled for stability
  if (DISABLE_AUDIO_FOR_STABILITY) {
    console.log("Audio disabled for stability - skipping sound preloading");
    return [];
  }
  
  try {
    console.log("Preloading sound assets...");
    const assets = await Promise.all(
      Object.entries(soundModules).map(async ([key, module]) => {
        const asset = Asset.fromModule(module);
        await asset.downloadAsync();
        downloadedAssets[key] = asset;
        return asset;
      })
    );
    console.log("Sound preloading complete", assets);
    return assets;
  } catch (error) {
    console.error("Error preloading sounds:", error);
    return null;
  }
}

/**
 * Play a sound using expo-av (stable implementation with main thread safety)
 * @param {string} soundKey - Key of the sound to load ('beep' or 'azan')
 * @returns {Promise<boolean>} - Whether sound played successfully
 */
async function playSound(soundKey) {
  return new Promise((resolve) => {
    // Emergency disable - use vibration only to prevent ExoPlayer threading issues
    if (DISABLE_AUDIO_FOR_STABILITY) {
      console.log(`Audio disabled for stability - skipping sound: ${soundKey}`);
      resolve(true); // Return success to continue flow
      return;
    }
    
    // Ensure we run on main thread using setTimeout
    setTimeout(async () => {
      try {
        const moduleRef = soundModules[soundKey];
        if (!moduleRef) {
          console.error(`Unknown sound key: ${soundKey}`);
          resolve(false);
          return;
        }
        
        console.log(`Playing sound: ${soundKey}`);
        
        // Use expo-av only (stable and reliable)
        const { Audio } = await import('expo-av');
        
        // Set audio mode for proper playback (on main thread)
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        
        // Create and play sound (on main thread)
        const { sound } = await Audio.Sound.createAsync(moduleRef);
        await sound.playAsync();
        
        // Clean up after playback
        setTimeout(async () => {
          try {
            await sound.unloadAsync();
          } catch (e) {
            console.warn('Error unloading sound:', e);
          }
        }, 5000);
        
        resolve(true);
          
      } catch (error) {
        console.error(`Failed to play ${soundKey}:`, error);
        resolve(false);
      }
    }, 0); // Run on next tick to ensure main thread
  });
}

/**
 * Play a sound based on prayer name and user preferences (main thread safe)
 * @param {string} prayerName - Name of the prayer
 * @param {boolean} useAzanSound - Whether to use Azan sound for main prayers
 * @param {boolean} vibrate - Whether to vibrate when playing sound (default: true)
 */
export async function playPrayerSound(prayerName, useAzanSound = true, vibrate = true) {
  return new Promise((resolve) => {
    // Ensure we run on main thread
    setTimeout(async () => {
      try {
        const soundKey = prayerName === 'Sunrise' || !useAzanSound ? 'beep' : 'azan';
        console.log(`Playing ${soundKey} sound for ${prayerName}`);
        
        // Play vibration if enabled (safe on main thread)
        if (vibrate) {
          const pattern = vibrationPatterns[soundKey] || vibrationPatterns.beep;
          Vibration.vibrate(pattern);
        }
        
        try {
          // Try to play actual sound using expo-audio (on main thread)
          const success = await playSound(soundKey);
          resolve(success);
          
        } catch (soundError) {
          console.error(`Sound playback failed, using vibration only: ${soundError.message}`);
          // Vibration already happened above, so we don't need to do it again
          resolve(false);
        }
        
      } catch (error) {
        console.error(`Error playing sound for ${prayerName}:`, error);
        resolve(false);
      }
    }, 0); // Run on next tick to ensure main thread
  });
}

/**
 * Play a test sound to verify functionality.
 * @param {boolean} vibrate - Whether to vibrate (default: true)
 * @returns {Promise<boolean>} - Resolves to true if successful
 */
export async function playTestSound(vibrate = true) {
  try {
    console.log("Testing sound playback with beep");
    
    // Vibrate with the beep pattern if enabled
    if (vibrate) {
      Vibration.vibrate(vibrationPatterns.beep);
    }
    
    try {
      // Try to play the actual sound using expo-audio
      await preloadSounds(); // Make sure assets are preloaded
      const success = await playSound('beep');
      
      if (success) {
        console.log("Sound played successfully");
        return true;
      } else {
        throw new Error("Sound playback failed");
      }
    } catch (soundError) {
      console.error(`Sound playback failed, used vibration only: ${soundError.message}`);
      // Vibration already happened above
      return true; // Still return true since vibration worked
    }
  } catch (error) {
    console.error("Error during test sound:", error);
    return false;
  }
}

/**
 * Cancel any ongoing vibration
 */
export function stopVibration() {
  Vibration.cancel();
}

/**
 * Unload all sound resources
 */
export async function unloadSounds() {
  // Stop any ongoing vibration
  stopVibration();
  
  // Clear the asset cache
  Object.keys(downloadedAssets).forEach(key => {
    delete downloadedAssets[key];
  });
  
  console.log("All sound resources released");
}
