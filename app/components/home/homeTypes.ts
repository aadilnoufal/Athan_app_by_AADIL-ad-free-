/**
 * Shared type definitions for the Home screen and its sub-components / hooks.
 */

/** Prayer times data for a single day */
export interface PrayerData {
  date: string;
  hijriDate: string;
  hijriMonth: string;
  gregorianDate: string;
  times: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
  };
  times12h: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
  };
}

/** The next upcoming prayer */
export interface NextPrayer {
  name: string;
  time: string;      // Already in 12h format from findNextPrayer
  timeRaw: string;   // Raw 24h format time
  date: Date;
}

/** Region picker list item */
export interface RegionItem {
  id: string;
  name: string;
  [key: string]: any;
}

/** Per-prayer notification toggle map */
export interface NotificationSettings {
  Fajr: boolean;
  Sunrise: boolean;
  Dhuhr: boolean;
  Asr: boolean;
  Maghrib: boolean;
  Isha: boolean;
  [key: string]: boolean;
}
