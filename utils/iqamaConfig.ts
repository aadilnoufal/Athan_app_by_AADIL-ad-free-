/**
 * Iqama Configuration
 *
 * Hardcoded iqama offsets (minutes after adhan) for each prayer.
 * Sunrise is excluded as it is not a prayer.
 *
 * These offsets are approximate and based on common practice in Qatar.
 */

/** Iqama offset in minutes after adhan for each prayer */
export const IQAMA_OFFSETS: Record<string, number> = {
  Fajr: 25,
  Dhuhr: 20,
  Asr: 20,
  Maghrib: 10,
  Isha: 20,
};

/** Prayers that have iqama (excludes Sunrise) */
export const IQAMA_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

/**
 * Calculate the iqama time for a given prayer.
 * @param prayerName - Name of the prayer (e.g. 'Fajr')
 * @param adhanTime - The adhan Date object
 * @returns Date object for iqama time, or null if prayer has no iqama
 */
export function getIqamaTime(prayerName: string, adhanTime: Date): Date | null {
  const offset = IQAMA_OFFSETS[prayerName];
  if (offset === undefined) return null;

  const iqamaTime = new Date(adhanTime.getTime() + offset * 60 * 1000);
  return iqamaTime;
}

/**
 * Check if a prayer has an iqama offset.
 */
export function hasIqama(prayerName: string): boolean {
  return prayerName in IQAMA_OFFSETS;
}
