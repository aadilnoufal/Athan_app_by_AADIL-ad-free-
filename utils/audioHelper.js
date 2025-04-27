import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import { Vibration } from 'react-native';

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
  } catch (error) {
    console.error("Error preloading sounds:", error);
  }
}

/**
 * Get a sound object from the cache or create a new one
 * @param {string} soundKey - Key of the sound to load ('beep' or 'azan')
 * @returns {Promise<Audio.Sound>} - The loaded sound object
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
    
    // Create the sound object using the local URI
    const { sound } = await Audio.Sound.createAsync(
      { uri: asset.uri },
      { shouldPlay: false }
    );
    
    loadedSounds[soundKey] = sound;
    
    // Add unloading callback
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.didJustFinish) {
        console.log(`Sound ${soundKey} finished playing`);
      }
    });
    
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
    
    const sound = await getSoundObject(soundKey);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    console.error(`Error playing sound for ${prayerName}:`, error);
  }
}

/**
 * Play a test sound to verify audio functionality.
 * @param {boolean} vibrate - Whether to vibrate when playing sound (default: true)
 * @returns {Promise<boolean>} - Resolves to true if the sound plays successfully, false otherwise.
 */
export async function playTestSound(vibrate = true) {
  try {
    console.log("Testing sound playback with beep");
    
    // Vibrate with the beep pattern if enabled
    if (vibrate) {
      Vibration.vibrate(vibrationPatterns.beep);
    }
    
    await preloadSounds(); // Make sure assets are preloaded
    const sound = await getSoundObject('beep');
    await sound.setPositionAsync(0);
    await sound.playAsync();
    return true;
  } catch (error) {
    console.error("Error playing test sound:", error);
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
  
  for (const key in loadedSounds) {
    try {
      await loadedSounds[key].unloadAsync();
    } catch (e) {
      console.warn(`Error unloading sound ${key}:`, e);
    }
  }
  loadedSounds = {};
}
