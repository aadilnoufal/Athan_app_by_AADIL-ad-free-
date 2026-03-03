/**
 * Widget Data Bridge
 * ==================
 * Cross-platform utility that pushes prayer time data from the React Native app
 * to native shared storage so home screen widgets can read it.
 *
 * Android: SharedPreferences ("PrayerWidgetData") → read by PrayerTimeRepository.kt
 * iOS: App Group UserDefaults ("group.com.aadilnoufal.prayertimes") → read by WidgetKit extension
 *
 * Data format written:
 * {
 *   times: { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha } (24h format),
 *   times12h: { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha } (12h format),
 *   date: "DD-MM",
 *   cityId: "doha",
 *   themeMode: "dark" | "sepia",
 *   lastUpdated: timestamp_ms
 * }
 */

import { Platform, NativeModules } from 'react-native';

const { WidgetDataModule } = NativeModules;

// Debounce timer to avoid excessive writes
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

interface PrayerTimes24h {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface PrayerTimes12h {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface WidgetData {
  times: PrayerTimes24h;
  times12h: PrayerTimes12h;
  date: string;       // "DD-MM" format
  cityId: string;     // e.g., "doha", "abu-samra", "dukhan", "alshamal"
  themeMode: string;   // "dark" | "sepia"
  lastUpdated: number; // Unix timestamp ms
}

/**
 * Write prayer time data + settings to native shared storage.
 * Debounced to avoid rapid successive writes.
 *
 * @param data Prayer times, city, and theme information
 */
export function updateWidgetData(data: WidgetData): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    _writeWidgetData(data);
  }, DEBOUNCE_MS);
}

/**
 * Immediately write widget data without debouncing.
 * Use for critical updates like initial app load.
 */
export function updateWidgetDataImmediate(data: WidgetData): void {
  _writeWidgetData(data);
}

/**
 * Update only the theme mode (optimized for theme toggle).
 */
export function updateWidgetTheme(themeMode: string): void {
  if (Platform.OS === 'android') {
    if (!WidgetDataModule) {
      console.log('⚠️ WidgetDataModule not available on Android');
      return;
    }
    WidgetDataModule.setThemeMode(themeMode)
      .then(() => {
        console.log('✅ Widget theme updated to:', themeMode);
      })
      .catch((error: Error) => {
        console.log('⚠️ Failed to update widget theme:', error.message);
      });
  } else if (Platform.OS === 'ios') {
    // iOS: will be implemented when iOS native module is added
    _writeThemeModeIOS(themeMode);
  }
}

/**
 * Read current widget data (for debugging).
 * Returns null if no data has been written.
 */
export async function getWidgetData(): Promise<string | null> {
  if (Platform.OS === 'android') {
    if (!WidgetDataModule) {
      console.log('⚠️ WidgetDataModule not available');
      return null;
    }
    try {
      return await WidgetDataModule.getWidgetData();
    } catch (error) {
      console.log('⚠️ Failed to read widget data:', error);
      return null;
    }
  }
  // iOS: will be implemented when iOS native module is added
  return null;
}

// ============================================================================
// Private implementation
// ============================================================================

function _writeWidgetData(data: WidgetData): void {
  const jsonString = JSON.stringify({
    ...data,
    lastUpdated: Date.now(),
  });

  if (Platform.OS === 'android') {
    _writeWidgetDataAndroid(jsonString);
  } else if (Platform.OS === 'ios') {
    _writeWidgetDataIOS(jsonString);
  }
}

function _writeWidgetDataAndroid(jsonString: string): void {
  if (!WidgetDataModule) {
    console.log('⚠️ WidgetDataModule not available — widget data will not be synced');
    return;
  }

  WidgetDataModule.setWidgetData(jsonString)
    .then(() => {
      console.log('✅ Widget data synced to SharedPreferences');
    })
    .catch((error: Error) => {
      console.log('⚠️ Failed to sync widget data:', error.message);
    });
}

function _writeWidgetDataIOS(jsonString: string): void {
  // iOS implementation will use the App Group UserDefaults module
  // added via the Expo config plugin in Phase 3
  try {
    const { WidgetDataModuleIOS } = NativeModules;
    if (WidgetDataModuleIOS) {
      WidgetDataModuleIOS.setWidgetData(jsonString)
        .then(() => {
          console.log('✅ Widget data synced to App Group UserDefaults');
        })
        .catch((error: Error) => {
          console.log('⚠️ Failed to sync iOS widget data:', error.message);
        });
    } else {
      // Module not yet available — will be added with iOS widget extension
      console.log('ℹ️ iOS WidgetDataModule not available yet');
    }
  } catch (error) {
    console.log('ℹ️ iOS widget data sync not available');
  }
}

function _writeThemeModeIOS(themeMode: string): void {
  try {
    const { WidgetDataModuleIOS } = NativeModules;
    if (WidgetDataModuleIOS) {
      WidgetDataModuleIOS.setThemeMode(themeMode);
    }
  } catch (error) {
    // Module not yet available
  }
}
