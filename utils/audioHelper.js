import { Asset } from 'expo-asset';
import { Vibration } from 'react-native';
import { Audio } from 'expo-av'; // Use expo-av instead of expo-audio

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
// Cache for loaded sounds
let loadedSounds = {};

/**
 * Preload sound assets to ensure they're available
 */
export async function preloadSounds() {
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
 * Get a sound object from the cache or create a new one
 * @param {string} soundKey - Key of the sound to load ('beep' or 'azan')
 * @returns {Promise<Audio.Sound>} - The loaded audio sound object
 */
async function getSoundObject(soundKey) {
  try {
    // Return cached sound if available
    if (loadedSounds[soundKey]) {
      return loadedSounds[soundKey];
    }

    const moduleRef = soundModules[soundKey];
    if (!moduleRef) throw new Error(`Unknown sound key: ${soundKey}`);
    
    // Make sure the asset is downloaded
    let asset = downloadedAssets[soundKey];
    if (!asset) {
      asset = Asset.fromModule(moduleRef);
      await asset.downloadAsync();
      downloadedAssets[soundKey] = asset;
    }
    
    console.log(`Creating sound for ${soundKey}, URI: ${asset.uri}`);
    
    // Set audio mode for background playback
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    
    // Create the sound object using expo-av
    const { sound } = await Audio.Sound.createAsync(
      { uri: asset.uri },
      { shouldPlay: false, isLooping: false }
    );
    
    loadedSounds[soundKey] = sound;
    
    return sound;
  } catch (error) {
    console.error(`Failed to load ${soundKey} sound:`, error);
    throw error;
  }
}

/**
 * Play a sound based on prayer name and user preferences
 * @param {string} prayerName - Name of the prayer
 * @param {boolean} useAzanSound - Whether to use Azan sound for main prayers
 * @param {boolean} vibrate - Whether to vibrate when playing sound (default: true)
 */
export async function playPrayerSound(prayerName, useAzanSound = true, vibrate = true) {
  try {
    const soundKey = prayerName === 'Sunrise' || !useAzanSound ? 'beep' : 'azan';
    console.log(`Playing ${soundKey} sound for ${prayerName}`);
    
    // Play vibration if enabled
    if (vibrate) {
      const pattern = vibrationPatterns[soundKey] || vibrationPatterns.beep;
      Vibration.vibrate(pattern);
    }
    
    try {
      // Try to play actual sound using expo-av
      const sound = await getSoundObject(soundKey);
      await sound.playAsync();
    } catch (soundError) {
      console.error(`Sound playback failed, using vibration only: ${soundError.message}`);
      // Vibration already happened above, so we don't need to do it again
    }
    
    return true;
  } catch (error) {
    console.error(`Error playing sound for ${prayerName}:`, error);
    return false;
  }
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
      // Try to play the actual sound using expo-av
      await preloadSounds(); // Make sure assets are preloaded
      const sound = await getSoundObject('beep');
      await sound.playAsync();
      console.log("Sound played successfully");
      return true;
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
  
  // Release all sound objects
  for (const key in loadedSounds) {
    try {
      // Unload the sound object properly
      await loadedSounds[key].unloadAsync();
      delete loadedSounds[key];
    } catch (e) {
      console.warn(`Error releasing sound ${key}:`, e);
    }
  }
  
  loadedSounds = {};
  console.log("All sound resources released");
}
