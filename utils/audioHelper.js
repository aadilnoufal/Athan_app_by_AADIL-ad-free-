import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';

// Define sound asset modules
const soundModules = {
  beep: require('../assets/sounds/beep.waw'),
  azan: require('../assets/sounds/azan.waw'),
};

// Cache for loaded sounds
let loadedSounds = {};

/**
 * Preload sound assets to ensure they're available
 */
export async function preloadSounds() {
  try {
    console.log("Preloading sound assets...");
    await Promise.all(
      Object.values(soundModules).map((module) => Asset.fromModule(module).downloadAsync())
    );
    console.log("Sound preloading complete");
  } catch (error) {
    console.error("Error preloading sounds:", error);
  }
}

async function createFreshSoundObject(soundKey) {
  try {
    const moduleRef = soundModules[soundKey];
    if (!moduleRef) throw new Error(`Unknown sound key: ${soundKey}`);
    // always load directly from module
    const { sound } = await Audio.Sound.createAsync(
      moduleRef,
      { shouldPlay: false }
    );
    return sound;
  } catch (error) {
    console.error(`Failed to create fresh sound for ${soundKey}:`, error);
    throw error;
  }
}

/**
 * Get a sound object from the cache or create a new one
 * @param {string} soundKey - Key of the sound to load ('beep' or 'azan')
 * @returns {Promise<Audio.Sound>} - The loaded sound object
 */
async function getSoundObject(soundKey) {
  try {
    if (loadedSounds[soundKey]) {
      return loadedSounds[soundKey];
    }

    const sound = await createFreshSoundObject(soundKey);
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
 */
export async function playPrayerSound(prayerName, useAzanSound = true) {
  try {
    const soundKey = prayerName === 'Sunrise' || !useAzanSound ? 'beep' : 'azan';
    const sound = await getSoundObject(soundKey);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    console.error(`Error playing sound for ${prayerName}:`, error);
  }
}

/**
 * Play a test sound to verify audio functionality.
 * @returns {Promise<boolean>} - Resolves to true if the sound plays successfully, false otherwise.
 */
export async function playTestSound() {
  try {
    const sound = await getSoundObject('beep'); // Use the 'beep' sound for testing
    await sound.setPositionAsync(0);
    await sound.playAsync();
    return true;
  } catch (error) {
    console.error("Error playing test sound:", error);
    return false;
  }
}

/**
 * Unload all sound resources
 */
export async function unloadSounds() {
  for (const key in loadedSounds) {
    try {
      await loadedSounds[key].unloadAsync();
    } catch (e) {
      console.warn(`Error unloading sound ${key}:`, e);
    }
  }
  loadedSounds = {};
}
