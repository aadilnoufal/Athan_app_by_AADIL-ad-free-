// Rolling Prayer Notification Scheduler (iOS-safe, no background modes)
// Schedules a moving window of upcoming prayer notifications using Notifee.
// Strategy:
// - Maintain a horizon (e.g. 10 days) of scheduled daily trigger notifications (Timestamp repeat daily not used here; we schedule single-fire to keep precise seasonal time shifts).
// - After a notification fires (DELIVERED) or when app returns to foreground, ensure window is topped up.
// - Avoid exceeding iOS 64 scheduled notification limit (keep max <= 54 to leave headroom for ad‑hoc notifications).
// - Persist last scheduled date in AsyncStorage.
// - Rebuild if timezone offset or DST changed since last schedule.

import notifee, { TriggerType, AndroidCategory } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { getPrayerTimesFromLocalData } from './localPrayerData';
import { scheduleNotifeePrayerNotifications, cancelAllNotifeePrayerNotifications } from './notifeePrayerService';

// Config
const WINDOW_DAYS = 10; // days forward to keep scheduled
const STORAGE_KEY_LAST_DAY = 'prayer_sched_last_day';
const STORAGE_KEY_TZ = 'prayer_sched_tz_offset';
const STORAGE_KEY_VERSION = 'prayer_sched_version';
const SCHEDULER_VERSION = '1';

let appStateSub: any = null;
let ensureInFlight = false;

// Helper: format YYYY-MM-DD
function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

// Build prayer times object shape expected by scheduleNotifeePrayerNotifications
interface DayPrayerTimes {
  Fajr: string; Sunrise: string; Dhuhr: string; Asr: string; Maghrib: string; Isha: string;
  [key: string]: string; // index signature for dynamic access
}

function buildPrayerTimesForDate(date: Date): DayPrayerTimes | null {
  const data: any = getPrayerTimesFromLocalData(date);
  if (!data || !data.times) return null;
  const result: DayPrayerTimes = {
    Fajr: data.times.Fajr,
    Sunrise: data.times.Sunrise,
    Dhuhr: data.times.Dhuhr,
    Asr: data.times.Asr,
    Maghrib: data.times.Maghrib,
    Isha: data.times.Isha,
  };
  return result;
}

async function getNotificationSettings(): Promise<any> {
  try {
    const raw = await AsyncStorage.getItem('notification_settings');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Core: schedule one day's prayers (using existing function that sets repeat daily). For window we schedule per day w/out repeat to avoid drift.
async function scheduleDay(date: Date, settings: any) {
  const pt = buildPrayerTimesForDate(date);
  if (!pt) return [];

  // Determine user sound preference (default true)
  let useAzanSound = true;
  try {
    const stored = await AsyncStorage.getItem('use_azan_sound');
    if (stored === 'false') useAzanSound = false;
  } catch {}

  const created: string[] = [];
  const prayers = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
  for (const prayer of prayers) {
    try {
      if (settings[prayer] === false) continue;
      const time = (pt as any)[prayer];
      if (!time) continue;
      const [h,m] = time.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) continue;
      const when = new Date(date);
      when.setHours(h,m,0,0);
      if (when.getTime() < Date.now()) continue; // skip past times

      const id = `prayer-${prayer.toLowerCase()}-${isoDate(date)}`;
      const useAzanForPrayer = useAzanSound && prayer !== 'Sunrise';

      // Determine which channel to use (Android only)
      let channelId = 'prayer-reminders'; // Default
      if (prayer === 'Sunrise') {
        channelId = 'sunrise_prayer_channel';
      } else if (prayer === 'Fajr') {
        channelId = 'fajr_prayer_channel';
      }

      // Platform specific blocks
      const android: any = {
        channelId: channelId,
        category: AndroidCategory.REMINDER,
        smallIcon: 'ic_launcher_foreground',
        // Sound is determined by channel, not individual notification on Android
        vibrationPattern: prayer === 'Fajr' ? [200,400,200,400,200,400] : [300,600,300,600],
        pressAction: { id: 'default' },
        color: prayer === 'Fajr' ? '#0066cc' : (prayer === 'Sunrise' ? '#ff9900' : '#1a8e2d')
      };

      const ios: any = {
        categoryId: prayer === 'Fajr' ? 'fajr-category' : 'prayer-category',
        sound: useAzanForPrayer ? 'azan.wav' : 'beep.wav',
        interruptionLevel: 'active',
        badge: 1
      };

      await notifee.createTriggerNotification(
        {
          id,
          title: `🕌 ${prayer} Prayer Time`,
          body: `It's time for ${prayer} prayer (${time})`,
          data: { type: 'prayer-reminder', prayerName: prayer, soundType: useAzanForPrayer ? 'azan' : 'beep', useAzanSound: useAzanSound.toString() },
          android,
          ios,
        },
        { type: TriggerType.TIMESTAMP, timestamp: when.getTime() }
      );
      created.push(id);
      console.log(`✅ Window scheduled ${prayer} ${isoDate(date)} @ ${time} (id=${id})`);
    } catch (e:any) {
      console.log(`⚠️ Failed scheduling ${prayer} ${isoDate(date)}:`, e?.message);
    }
  }
  return created;
}

export async function ensurePrayerNotificationWindow() {
  if (ensureInFlight) return;
  ensureInFlight = true;
  try {
    // Lazy initialize full Notifee service to guarantee channels exist (avoid circular import with dynamic require)
    try {
      // @ts-ignore
      const { initializeNotifeePrayerNotifications } = require('./notifeePrayerService');
      await initializeNotifeePrayerNotifications();
    } catch (initErr) {
      const errMsg = (initErr as any)?.message || initErr;
      console.log('⚠️ Could not initialize Notifee before window scheduling', errMsg);
    }

    const tzOffset = new Date().getTimezoneOffset();
    const storedTz = await AsyncStorage.getItem(STORAGE_KEY_TZ);
    const version = await AsyncStorage.getItem(STORAGE_KEY_VERSION);
    if (version !== SCHEDULER_VERSION) {
      await cancelAll();
    }
    const settings = await getNotificationSettings();
    const today = new Date();
    today.setHours(0,0,0,0);

    // Detect TZ / DST change
    if (storedTz && parseInt(storedTz,10) !== tzOffset) {
      await cancelAll();
    }

    const existingIds = await notifee.getTriggerNotificationIds();
    // Filter our pattern ids with date suffix
    const ours = existingIds.filter(id => id.startsWith('prayer-') && id.split('-').length === 3);

    // Build set of dates already covered
    const coveredDates = new Set<string>();
    for (const id of ours) {
      const parts = id.split('-');
      const dateStr = parts.slice(-1)[0];
      coveredDates.add(dateStr);
    }

    let scheduledCount = ours.length;
    let dayCursor = new Date(today);
    for (let i=0; i<WINDOW_DAYS && scheduledCount < 54; i++) {
      const dateStr = isoDate(dayCursor);
      if (!coveredDates.has(dateStr)) {
        const created = await scheduleDay(dayCursor, settings);
        scheduledCount += created.length;
      }
      dayCursor.setDate(dayCursor.getDate()+1);
    }

    await AsyncStorage.setItem(STORAGE_KEY_LAST_DAY, isoDate(new Date(today.getTime() + (WINDOW_DAYS-1)*86400000)));
    await AsyncStorage.setItem(STORAGE_KEY_TZ, tzOffset.toString());
    await AsyncStorage.setItem(STORAGE_KEY_VERSION, SCHEDULER_VERSION);
  } catch (e) {
    console.log('ensurePrayerNotificationWindow error', e);
  } finally {
    ensureInFlight = false;
  }
}

export async function cancelAll() {
  const ids = await notifee.getTriggerNotificationIds();
  for (const id of ids) {
    if (id.startsWith('prayer-')) {
      await notifee.cancelTriggerNotification(id);
    }
  }
}

export function startPrayerNotificationWindowMaintainer() {
  if (appStateSub) appStateSub.remove();
  appStateSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      ensurePrayerNotificationWindow();
    }
  });
  ensurePrayerNotificationWindow();
}

// Hook to be called after a notification fires (DELIVERED) from event handlers
export async function onPrayerNotificationDelivered() {
  // Top up after slight delay
  setTimeout(() => ensurePrayerNotificationWindow(), 2000);
}
