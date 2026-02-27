/**
 * useSettingsNotifications
 *
 * Custom hook that encapsulates ALL notification-related state, loading, and
 * handler logic for the Settings screen.
 *
 * ⚠️  CRITICAL — Notification system architecture notes:
 *
 *   The app uses a DUAL-LIBRARY notification system:
 *     • @notifee/react-native  — for scheduling, channels, and sound control
 *     • expo-notifications     — companion library needed for the full
 *                                 notification pipeline (known library bug
 *                                 workaround — both must remain)
 *
 *   DO NOT simplify to a single library.  The dual-library setup is the ONLY
 *   way to get notifications working with proper azan sounds on all devices.
 *
 *   Every call to notifeePrayerService, prayerNotificationScheduler,
 *   backgroundTask, and audioHelper is intentional and must be preserved
 *   exactly as-is.
 */
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import * as Device from 'expo-device';
import {
  scheduleNotifeeTestNotification,
  initializeNotifeePrayerNotifications,
  getScheduledNotifeePrayerNotifications,
  cancelAllNotifeePrayerNotifications,
  cancelAllNotificationsCompletely,
  getNotifeeServiceStatus,
  requestExactAlarmPermission,
  checkAndHandleBatteryOptimization,
  checkAndHandlePowerManager,
  forceRecreateNotificationChannels,
} from '../../utils/notifeePrayerService';
import {
  ensurePrayerNotificationWindow,
  forceRescheduleAllNotifications,
} from '../../utils/prayerNotificationScheduler';
import { setupBackgroundTask, unregisterBackgroundTask } from '../../utils/backgroundTask';
import { playTestSound } from '../../utils/audioHelper';

export interface NotificationSettings {
  Fajr: boolean;
  Sunrise: boolean;
  Dhuhr: boolean;
  Asr: boolean;
  Maghrib: boolean;
  Isha: boolean;
  [key: string]: boolean;
}

export function useSettingsNotifications() {
  // ── State ────────────────────────────────────────────────────────────
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    Fajr: true,
    Sunrise: false,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true,
  });
  const [useAzanSound, setUseAzanSound] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState<any>(null);

  // ── Load + initialise on mount ───────────────────────────────────────
  useEffect(() => {
    const initializeNotifications = async () => {
      await loadSettings();
      // Initialize Notifee notification system (handles all permissions internally)
      try {
        await initializeNotifeePrayerNotifications();
      } catch (error) {
        console.log('Error initializing Notifee notifications:', error);
      }
    };
    initializeNotifications();
  }, []);

  const loadSettings = async () => {
    try {
      const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
      const notifSettings = await AsyncStorage.getItem('notification_settings');

      if (notifEnabled !== null) {
        setNotificationsEnabled(notifEnabled === 'true');
      }

      if (notifSettings !== null) {
        setNotificationSettings(JSON.parse(notifSettings));
      }

      const soundPref = await AsyncStorage.getItem('use_azan_sound');
      if (soundPref !== null) {
        setUseAzanSound(soundPref === 'true');
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────

  const requestNotificationPermissions = async () => {
    try {
      if (Device.isDevice) {
        const settings = await notifee.getNotificationSettings();
        let finalStatus = settings.authorizationStatus;

        if (settings.authorizationStatus !== 1) { // 1 = AUTHORIZED
          const newSettings = await notifee.requestPermission();
          finalStatus = newSettings.authorizationStatus;
        }

        if (finalStatus !== 1) { // 1 = AUTHORIZED
          Alert.alert(
            'Notification Permission',
            'Please enable notifications to receive prayer time alerts',
            [{ text: 'OK' }],
          );
          return false;
        }
        return true;
      } else {
        Alert.alert(
          'Physical Device Required',
          'Notifications require a physical device to work properly',
          [{ text: 'OK' }],
        );
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  const toggleNotifications = async (value: boolean) => {
    try {
      if (value) {
        const permissionGranted = await requestNotificationPermissions();
        if (!permissionGranted) return;

        console.log('🔧 Initializing Notifee notification service...');
        const initialized = await initializeNotifeePrayerNotifications();
        if (!initialized) {
          Alert.alert(
            'Notifee Setup Failed',
            'Unable to initialize Notifee notification service. Please check permissions.',
            [{ text: 'OK' }],
          );
          return;
        }
      }

      setNotificationsEnabled(value);
      await AsyncStorage.setItem('notifications_enabled', value ? 'true' : 'false');

      if (value) {
        await setupBackgroundTask();
        console.log('✅ Background task re-registered');

        await AsyncStorage.setItem('notifications_updated', Date.now().toString());
        console.log('✅ Notifications enabled and service initialized');
      } else {
        console.log('🔄 Disabling all notifications...');

        // 1. Use the comprehensive cancel function from notifeePrayerService
        await cancelAllNotificationsCompletely();

        // 2. Unregister background task to stop any background scheduling
        await unregisterBackgroundTask();
        console.log('✅ Unregistered background notification task');

        // 3. Clear the notifications_updated flag to prevent re-scheduling
        await AsyncStorage.removeItem('notifications_updated');

        console.log('❌ All notifications completely cancelled');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    }
  };

  const togglePrayerNotification = async (prayer: string, value: boolean) => {
    try {
      const updatedSettings = {
        ...notificationSettings,
        [prayer]: value,
      };

      setNotificationSettings(updatedSettings);
      await AsyncStorage.setItem('notification_settings', JSON.stringify(updatedSettings));

      if (notificationsEnabled) {
        console.log(`🔄 ${prayer} toggled to ${value}, forcing immediate reschedule...`);
        await forceRescheduleAllNotifications();
        console.log(`✅ Notifications rescheduled after ${prayer} toggle`);
      }
    } catch (error) {
      console.error('Error toggling prayer notification:', error);
    }
  };

  const toggleSoundPreference = async (value: boolean) => {
    try {
      setUseAzanSound(value);
      await AsyncStorage.setItem('use_azan_sound', value ? 'true' : 'false');

      if (notificationsEnabled) {
        console.log(
          `🔊 Sound preference changed to ${value ? 'Azan' : 'Default'}, forcing immediate reschedule...`,
        );
        await forceRescheduleAllNotifications();
        console.log('✅ Notifications rescheduled with new sound preference');
      }

      Alert.alert(
        'Sound Preference Updated',
        value
          ? 'Azan sound will be used for prayer notifications. Sunrise will still use a simple beep.'
          : 'Simple beep will be used for all prayer notifications.',
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error setting sound preference:', error);
    }
  };

  const testNotification = async () => {
    try {
      await initializeNotifeePrayerNotifications();

      const result = await scheduleNotifeeTestNotification();

      if (result) {
        Alert.alert(
          'Notifee Test Scheduled',
          'You should receive a Notifee notification shortly. If not, please check your notification permissions.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert(
          'Notifee Test Failed',
          'Failed to schedule test notification. Please check permissions.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert(
        'Error',
        'Failed to send test notification. Please check app permissions.',
        [{ text: 'OK' }],
      );
    }
  };

  const testDirectSound = async () => {
    try {
      console.log('Testing direct sound playback');
      const success = await playTestSound();

      Alert.alert(
        'Sound Test',
        success
          ? 'Did you hear the beep sound?'
          : 'There was an error playing the sound. Please check your device settings.',
        [
          {
            text: 'No',
            style: 'cancel',
            onPress: () => {
              console.log('Sound test failed');
              Alert.alert(
                'Sound Test Failed',
                'Try these troubleshooting steps:\n' +
                  '1. Check if your device is not on silent mode\n' +
                  '2. Increase the volume\n' +
                  '3. Restart the app\n' +
                  '4. Ensure audio files are in the assets/sounds folder',
              );
            },
          },
          {
            text: 'Yes',
            onPress: () => console.log('Sound test succeeded'),
          },
        ],
      );
    } catch (error) {
      console.error('Error playing test sound:', error);
      Alert.alert(
        'Sound Test Failed',
        'Error: ' +
          (error instanceof Error ? error.message : String(error)) +
          '\n\nPlease check if audio files are in the correct location.',
        [{ text: 'OK' }],
      );
    }
  };

  const testAzanSoundFix = async () => {
    try {
      Alert.alert(
        'Testing Azan Sound Fix',
        'This will recreate notification channels and test azan sound. You should hear the azan sound if it works.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Test',
            onPress: async () => {
              try {
                console.log('🧪 Starting azan sound fix test...');

                console.log('🔄 Recreating notification channels...');
                await forceRecreateNotificationChannels();

                console.log('🔔 Testing notification with azan sound...');
                const result = await scheduleNotifeeTestNotification();

                if (result) {
                  Alert.alert(
                    'Azan Sound Test',
                    'Notification sent! Did you hear the azan sound? If not, check:\n\n• Phone volume is up\n• Not in silent mode\n• Notification sounds enabled\n• App has notification permissions',
                    [{ text: 'OK' }],
                  );
                } else {
                  Alert.alert(
                    'Test Failed',
                    'Failed to send test notification. Check notification permissions.',
                    [{ text: 'OK' }],
                  );
                }
              } catch (error) {
                console.error('❌ Azan sound fix test failed:', error);
                Alert.alert(
                  'Test Error',
                  `Failed to test azan sound: ${error instanceof Error ? error.message : String(error)}`,
                  [{ text: 'OK' }],
                );
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error starting azan sound test:', error);
      Alert.alert('Error', 'Failed to start azan sound test.', [{ text: 'OK' }]);
    }
  };

  const testInAppNotification = async () => {
    try {
      const result = await initializeNotifeePrayerNotifications();

      if (result) {
        if (global.showTestNotification) {
          global.showTestNotification();
          console.log('Triggered test in-app notification');
        } else {
          Alert.alert(
            'Test Function Not Available',
            "The in-app notification test function isn't available. Please restart the app.",
            [{ text: 'OK' }],
          );
        }
      } else {
        Alert.alert(
          'Permission Required',
          'Please grant notification permission to test notifications',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Error testing in-app notification:', error);
    }
  };

  const checkNotificationStatus = async () => {
    try {
      const status = await getNotifeeServiceStatus();
      setNotificationStatus(status);

      Alert.alert(
        'Notification Status',
        `Initialized: ${status.initialized ? '✅' : '❌'}\n` +
          `Permissions: ${status.permissionsGranted ? '✅' : '❌'}\n` +
          `Scheduled: ${status.scheduledCount} notifications\n` +
          `Sound: ${status.soundPreference || 'Default'}\n` +
          `${status.error ? `Error: ${status.error}` : ''}`,
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error checking notification status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to check notification status: ${errorMessage}`);
    }
  };

  const resetNotifications = async () => {
    try {
      console.log('🔄 Starting notification reset...');

      await cancelAllNotifeePrayerNotifications();

      Alert.alert(
        'Notifications Reset',
        'Successfully cancelled all prayer notifications. The app will reschedule notifications automatically when you return to the home page.',
        [{ text: 'OK' }],
      );

      console.log('✅ Notification reset completed successfully');
    } catch (error) {
      console.error('❌ Error resetting notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to reset notifications: ${errorMessage}`);
    }
  };

  // ── Public API ───────────────────────────────────────────────────────
  return {
    // State
    notificationsEnabled,
    notificationSettings,
    useAzanSound,
    notificationStatus,

    // Handlers
    toggleNotifications,
    togglePrayerNotification,
    toggleSoundPreference,
    testNotification,
    testDirectSound,
    testAzanSoundFix,
    testInAppNotification,
    checkNotificationStatus,
    resetNotifications,
  };
}
