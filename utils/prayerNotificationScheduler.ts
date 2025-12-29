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
const STORAGE_KEY_SOUND_PREF = 'prayer_sched_sound_pref'; // Track sound preference changes
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

      // Determine which channel to use (Android only) - matches notifeePrayerService.js channels
      let channelId = 'prayer-times-default'; // Default
      if (useAzanForPrayer) {
        // Use azan channels for prayers (except Sunrise)
        channelId = prayer === 'Fajr' ? 'fajr-prayer-azan' : 'prayer-times-azan';
      } else {
        // Use default sound channels
        channelId = prayer === 'Fajr' ? 'fajr-prayer-default' : 'prayer-times-default';
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

      // Sunrise is NOT a prayer, just a time marker
      const isSunrise = prayer === 'Sunrise';
      const notificationTitle = isSunrise ? `☀️ ${prayer}` : `🕌 ${prayer} Prayer Time`;
      const notificationBody = isSunrise ? `Sunrise time (${time})` : `It's time for ${prayer} prayer (${time})`;

      // Create trigger with AlarmManager for EXACT timing (critical for prayer times!)
      const trigger: any = {
        type: TriggerType.TIMESTAMP,
        timestamp: when.getTime(),
        alarmManager: {
          allowWhileIdle: true, // Works in Doze mode - bypasses battery optimization
          exact: true, // Exact timing - required for Android 12+
        }
      };

      await notifee.createTriggerNotification(
        {
          id,
          title: notificationTitle,
          body: notificationBody,
          // Use unified type 'prayer-time' for scheduled prayer notifications
          data: { type: 'prayer-time', prayerName: prayer, soundType: useAzanForPrayer ? 'azan' : 'beep', useAzanSound: useAzanSound.toString() },
          android,
          ios,
        },
        trigger
      );
      created.push(id);
      console.log(`✅ Window scheduled ${prayer} ${isoDate(date)} @ ${time} (id=${id}) [AlarmManager: exact=true, allowWhileIdle=true]`);
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
    // CRITICAL: Check if notifications are globally enabled before scheduling anything
    const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
    if (notificationsEnabled === 'false') {
      console.log('⏭️ Notifications are disabled globally, skipping window scheduling');
      return;
    }

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

    // Check if sound preference changed
    let soundPrefChanged = false;
    try {
      const currentSoundPref = await AsyncStorage.getItem('use_azan_sound');
      const storedSoundPref = await AsyncStorage.getItem(STORAGE_KEY_SOUND_PREF);
      if (storedSoundPref && storedSoundPref !== currentSoundPref) {
        console.log(`🔊 Sound preference changed: ${storedSoundPref} → ${currentSoundPref}, triggering full reschedule`);
        soundPrefChanged = true;
        await cancelAll();
      }
      // Update stored sound preference
      if (currentSoundPref) {
        await AsyncStorage.setItem(STORAGE_KEY_SOUND_PREF, currentSoundPref);
      }
    } catch (e) {
      console.log('⚠️ Could not check sound preference:', e);
    }

    // Detect TZ / DST change
    if (storedTz && parseInt(storedTz,10) !== tzOffset) {
      console.log(`🌍 Timezone changed: ${storedTz} → ${tzOffset}, triggering full reschedule`);
      await cancelAll();
    }

    const existingIds = await notifee.getTriggerNotificationIds();
    // Filter our pattern ids with date suffix
    const ours = existingIds.filter(id => id.startsWith('prayer-') && id.split('-').length === 3);

    // Clean up past notifications before counting
    const now = Date.now();
    const todayStr = isoDate(today);
    for (const id of ours) {
      const parts = id.split('-');
      const prayerName = parts[1];
      const dateStr = parts[2];
      
      // Cancel if date is in the past (before today)
      if (dateStr < todayStr) {
        await notifee.cancelTriggerNotification(id);
        continue;
      }
      
      // If it's today, check if the prayer time has already passed
      if (dateStr === todayStr) {
        const date = new Date(dateStr);
        const prayerTimes = buildPrayerTimesForDate(date);
        if (prayerTimes && prayerTimes[prayerName]) {
          const [hours, minutes] = prayerTimes[prayerName].split(':').map(Number);
          const prayerDate = new Date(date);
          prayerDate.setHours(hours, minutes, 0, 0);
          
          // If prayer time has passed, cancel it
          if (prayerDate.getTime() < now) {
            await notifee.cancelTriggerNotification(id);
            continue;
          }
        }
      }
    }
    
    // Re-fetch IDs after cleanup
    const updatedIds = await notifee.getTriggerNotificationIds();
    const activeOurs = updatedIds.filter(id => id.startsWith('prayer-') && id.split('-').length === 3);

    // Build set of dates already covered
    const coveredDates = new Set<string>();
    for (const id of activeOurs) {
      const parts = id.split('-');
      const dateStr = parts.slice(-1)[0];
      coveredDates.add(dateStr);
    }

    let scheduledCount = activeOurs.length;
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

// Force a complete reschedule of all notifications (for settings changes)
export async function forceRescheduleAllNotifications() {
  console.log('🔄 Force rescheduling all notifications from scratch...');
  try {
    // CRITICAL: Check if notifications are globally enabled before rescheduling
    const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
    if (notificationsEnabled === 'false') {
      console.log('⏭️ Notifications are disabled globally, cancelling all instead of rescheduling');
      await cancelAll();
      return;
    }

    // Cancel all existing prayer notifications
    await cancelAll();
    
    // Clear all stored state to trigger fresh scheduling
    await AsyncStorage.removeItem(STORAGE_KEY_LAST_DAY);
    await AsyncStorage.removeItem(STORAGE_KEY_TZ);
    
    // Trigger a full reschedule
    await ensurePrayerNotificationWindow();
    
    console.log('✅ Force reschedule complete');
  } catch (e) {
    console.log('❌ Force reschedule failed:', e);
  }
}
