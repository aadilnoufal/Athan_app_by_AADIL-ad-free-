/**
 * useHomeNotifications
 *
 * Encapsulates the entire notification lifecycle for the Home screen:
 * - Permission checking and initialization (Notifee)
 * - Polling AsyncStorage for settings changes (every 10 s)
 * - Notification health-check (every 60 s)
 * - Schedule / reschedule today's prayer notifications
 *
 * The effect runs once ([] deps) matching the original component behaviour;
 * values captured in the closure are therefore the initial values, which is the
 * pre-existing intentional (or "bug") behavior — not changed during refactor.
 */
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  initializeNotifeePrayerNotifications,
  cancelAllNotificationsCompletely,
  getScheduledNotifeePrayerNotifications,
  getNotifeeServiceStatus,
} from '../../utils/notifeePrayerService';
import {
  ensurePrayerNotificationWindow,
  forceRescheduleAllNotifications,
} from '../../utils/prayerNotificationScheduler';
import {
  setupBackgroundTask,
  unregisterBackgroundTask,
  getBackgroundFetchStatus,
} from '../../utils/backgroundTask';
import type { PrayerData, NotificationSettings } from '../../app/components/home/homeTypes';

const SCHEDULE_COOLDOWN = 5000; // 5 seconds cooldown between scheduling attempts

export function useHomeNotifications() {
  // ── State ───────────────────────────────────────────
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    Fajr: true,
    Sunrise: false,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true,
  });

  // ── Refs ────────────────────────────────────────────
  const notificationInitialized = useRef(false);
  const lastScheduleAttempt = useRef<number>(0);
  /** Ref mirror of notificationsEnabled so long-lived intervals read the latest value */
  const notificationsEnabledRef = useRef(false);
  /** Ref mirror of notificationSettings so health-check reads the latest per-prayer toggles */
  const notificationSettingsRef = useRef<NotificationSettings>(notificationSettings);

  /**
   * Refs for cross-domain values that are set by the orchestrator.
   * These allow the long-lived intervals (created once) to read the
   * *latest* prayer data without re-running the effect.
   */
  const prayerTimesRef = useRef<PrayerData | null>(null);
  const currentDayRef = useRef<number>(0);

  /** Call from the orchestrator whenever prayerTimes changes */
  const syncPrayerTimes = (pt: PrayerData | null) => {
    prayerTimesRef.current = pt;
  };
  /** Call from the orchestrator whenever currentDay changes */
  const syncCurrentDay = (day: number) => {
    currentDayRef.current = day;
  };

  // Keep ref in sync with state so long-lived intervals always read the latest value
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  useEffect(() => {
    notificationSettingsRef.current = notificationSettings;
  }, [notificationSettings]);

  // ── checkNotificationSettings ───────────────────────
  const checkNotificationSettings = async () => {
    try {
      console.log('🔍 ===== CHECKING NOTIFICATION SETTINGS =====');
      const serviceStatus = await getNotifeeServiceStatus();
      console.log('🔍 Notifee service status check:', serviceStatus);

      const hasPermissions = serviceStatus && serviceStatus.permissionsGranted;

      if (!hasPermissions) {
        console.log('❌ Notification permissions not granted, disabling notifications');
        setNotificationsEnabled(false);
        await AsyncStorage.setItem('notifications_enabled', 'false');
        return;
      }

      console.log('✅ Notification permissions are granted, checking settings...');
      const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
      const notifSettings = await AsyncStorage.getItem('notification_settings');

      if (notifEnabled !== null) {
        const isEnabled = notifEnabled === 'true';
        console.log(`📱 Notification enabled from storage: ${isEnabled}`);
        setNotificationsEnabled(isEnabled);
      } else {
        console.log('📱 No notification setting found, defaulting to enabled');
        setNotificationsEnabled(true);
        await AsyncStorage.setItem('notifications_enabled', 'true');
      }

      if (notifSettings !== null) {
        setNotificationSettings(JSON.parse(notifSettings));
      } else {
        const defaultSettings: NotificationSettings = {
          Fajr: true,
          Sunrise: false,
          Dhuhr: true,
          Asr: true,
          Maghrib: true,
          Isha: true,
        };
        setNotificationSettings(defaultSettings);
        await AsyncStorage.setItem('notification_settings', JSON.stringify(defaultSettings));
      }

      const debugStatus = await getScheduledNotifeePrayerNotifications();
      console.log(
        `Notifee notification settings loaded - Enabled: ${notifEnabled === 'true'}, Scheduled: ${debugStatus.length}`,
      );
    } catch (error) {
      console.error('Error loading notification settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);

      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        console.log('🚫 Disabling notifications due to permission error');
        setNotificationsEnabled(false);
      } else {
        console.log('⚠️ Non-critical error, keeping notifications enabled');
        try {
          const notificationStatus = await getScheduledNotifeePrayerNotifications();
          setNotificationsEnabled(true);
          await AsyncStorage.setItem('notifications_enabled', 'true');
        } catch (fallbackError) {
          console.error('Fallback permission check failed:', fallbackError);
          setNotificationsEnabled(false);
        }
      }
    }
  };

  // ── scheduleNotificationsForToday ───────────────────
  const scheduleNotificationsForToday = async () => {
    try {
      const now = Date.now();
      if (now - lastScheduleAttempt.current < SCHEDULE_COOLDOWN) {
        console.log(`⏱️ Schedule cooldown active, skipping (${SCHEDULE_COOLDOWN / 1000}s cooldown)`);
        return;
      }
      lastScheduleAttempt.current = now;

      console.log('🔄 ===== SCHEDULING NOTIFICATIONS FOR TODAY =====');
      console.log(`🔄 notificationsEnabled: ${notificationsEnabledRef.current}`);
      console.log(`🔄 prayerTimes available: ${!!(prayerTimesRef.current && prayerTimesRef.current.times)}`);

      if (!notificationsEnabledRef.current) {
        console.log('⏭️ Notifications disabled by user, skipping scheduling');
        return;
      }

      if (!prayerTimesRef.current || !prayerTimesRef.current.times) {
        console.log('❌ No prayer data available for scheduling notifications');
        return;
      }

      console.log('✅ All conditions met, ensuring rolling prayer notification window...');
      await ensurePrayerNotificationWindow();
      console.log('✅ Rolling prayer notification window ensured');
    } catch (error) {
      console.error('❌ Error with new notification system:', error);
    }
  };

  // ── Initialization effect (runs once) ───────────────
  useEffect(() => {
    if (notificationInitialized.current) return;
    notificationInitialized.current = true;

    const initializeNotifications = async () => {
      try {
        console.log('🔧 Initializing Notifee prayer notification system...');
        const initialized = await initializeNotifeePrayerNotifications();

        if (!initialized) {
          console.warn('Failed to initialize Notifee notifications - continuing without notifications');
          return;
        }

        await checkNotificationSettings();

        const backgroundSetup = await setupBackgroundTask();
        if (!backgroundSetup) {
          console.warn('Background task setup failed - notifications may not work when app is closed');
        }

        const bgStatus = await getBackgroundFetchStatus();
        console.log('Background fetch status:', bgStatus.statusText);
      } catch (error) {
        console.error('❌ Critical error in notification initialization:', error);
      }
    };

    initializeNotifications().catch((err) => {
      console.error('❌ Unhandled notification init error:', err);
    });

    // Poll AsyncStorage for notification settings changes every 10 s
    const checkForSettingsChanges = async () => {
      try {
        const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
        const notifSettings = await AsyncStorage.getItem('notification_settings');

        if (notifEnabled !== null) {
          const isEnabled = notifEnabled === 'true';
          if (isEnabled !== notificationsEnabledRef.current) {
            setNotificationsEnabled(isEnabled);

            if (isEnabled && prayerTimesRef.current) {
              console.log('Notifications enabled, clearing timestamp and scheduling...');
              await AsyncStorage.removeItem('last_notification_scheduled');
              setTimeout(() => scheduleNotificationsForToday(), 1000);
            } else if (!isEnabled) {
              console.log('Notifications disabled, cancelling all...');
              await cancelAllNotificationsCompletely();
              await unregisterBackgroundTask();
            }
          }
        }

        if (notifSettings !== null) {
          const parsed = JSON.parse(notifSettings);
          setNotificationSettings((prev) => ({ ...prev, ...parsed }));
        }

        const forceReschedule = await AsyncStorage.getItem('force_notification_reschedule');
        if (forceReschedule === 'true' && notificationsEnabledRef.current && prayerTimesRef.current) {
          console.log('Background task requested notification reschedule');
          await AsyncStorage.removeItem('force_notification_reschedule');
          await AsyncStorage.removeItem('last_notification_scheduled');
          setTimeout(() => scheduleNotificationsForToday(), 500);
        }
      } catch (error) {
        console.error('Error checking notification settings:', error);
      }
    };

    const settingsInterval = setInterval(checkForSettingsChanges, 10000);

    // Notification health-check every 60 s
    const notificationListener = async () => {
      const updateFlag = await AsyncStorage.getItem('notifications_updated');

      if (updateFlag) {
        console.log('🔄 Notification settings changed, forcing full reschedule...');
        await AsyncStorage.removeItem('notifications_updated');
        await AsyncStorage.removeItem('last_notification_scheduled');
        await checkNotificationSettings();
        await forceRescheduleAllNotifications();
      }

      if (notificationsEnabledRef.current && prayerTimesRef.current) {
        const status = await getScheduledNotifeePrayerNotifications();

        if (status.length === 0) {
          const now = new Date();
          const hasRemainingPrayers = Object.entries(prayerTimesRef.current.times).some(
            ([prayer, timeStr]) => {
              if (!timeStr || timeStr === '--:--') return false;
              const [hours, minutes] = timeStr.split(':').map(Number);
              if (isNaN(hours) || isNaN(minutes)) return false;
              const prayerDate = new Date();
              prayerDate.setHours(hours, minutes, 0, 0);
              return prayerDate > now && notificationSettingsRef.current[prayer as keyof NotificationSettings];
            },
          );

          if (hasRemainingPrayers) {
            console.log('Health check: Missing notifications, forcing reschedule...');
            await AsyncStorage.removeItem('last_notification_scheduled');
            setTimeout(() => scheduleNotificationsForToday(), 1000);
          }
        } else {
          console.log(`Health check: ${status.length} notifications are properly scheduled`);
        }
      }
    };

    const flagsInterval = setInterval(() => {
      notificationListener();
    }, 60000);

    return () => {
      clearInterval(settingsInterval);
      clearInterval(flagsInterval);
    };
  }, []); // Remove dependency array to prevent re-initialization

  return {
    notificationsEnabled,
    setNotificationsEnabled,
    notificationSettings,
    setNotificationSettings,
    scheduleNotificationsForToday,
    checkNotificationSettings,
    syncPrayerTimes,
    syncCurrentDay,
  };
}
