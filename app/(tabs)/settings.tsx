import Slider from '@react-native-community/slider';
import { Modal } from 'react-native';
import RevenueCatPaywall from '../components/RevenueCatPaywall';
import React, { useState, useEffect } from 'react';
import { usePurchase } from '../contexts/RevenueCatContext';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  Linking,
  Platform,
  Dimensions,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import notifee from '@notifee/react-native';
import * as Device from 'expo-device';
import {
  getAvailableCountries,
  getStatesForCountry,
  getCitiesForState,
  DEFAULT_REGION,
  parseRegionId
} from '../config/prayerTimeConfig';
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
  forceRecreateNotificationChannels
} from '../../utils/notifeePrayerService';
import { ensurePrayerNotificationWindow, forceRescheduleAllNotifications } from '../../utils/prayerNotificationScheduler';
import { setupBackgroundTask, unregisterBackgroundTask } from '../../utils/backgroundTask';
import { playTestSound } from '../../utils/audioHelper';
import { useLanguage } from '../../contexts/LanguageContext';
import { SepiaColors } from '../../constants/sepiaColors';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getEditionPref,
  setEditionPref as saveEditionPref,
  EditionPref,
  getDownloadedCount,
  getTotalDownloadSize,
  deleteAllQuranData,
  downloadFullQuran,
  DownloadProgress,
  getQuranFontScale,
  setQuranFontScale,
  getQuranAutoScrollWithAudio,
  setQuranAutoScrollWithAudio,
  getTranslationEdition,
  setTranslationEdition,
  getReciterPref,
  setReciterPref,
  getTranslationEditionsCached,
  getAudioEditionsCached,
  downloadAllAudio,
} from '../../utils/quranStorage';
import { EditionInfo, EDITIONS } from '../../lib/quranApi';

// Define interfaces
interface LanguageItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface NotificationSettings {
  Fajr: boolean;
  Sunrise: boolean;
  Dhuhr: boolean;
  Asr: boolean;
  Maghrib: boolean;
  Isha: boolean;
  [key: string]: boolean;
}

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function SettingsScreen() {
  const router = useRouter();
  const { t, currentLang, changeLanguage, availableLanguages } = useLanguage();
  const { isDark, toggleTheme, colors } = useTheme();
  const C = colors; // alias
  // Theme-aware dynamic styles
  const styles = React.useMemo(() => createSettingsStyles(colors, isDark), [colors, isDark]);

  // Animations removed

  // State for notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    Fajr: true,
    Sunrise: false,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true
  });

  // Add state for notification sound preference
  const [useAzanSound, setUseAzanSound] = useState(true);

  // Add notification status state for debugging
  const [notificationStatus, setNotificationStatus] = useState<any>(null);

  // Location selection state
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Get available options from config
  const countries = getAvailableCountries();
  const states = selectedCountry ? getStatesForCountry(selectedCountry) : [];
  const cities = (selectedCountry && selectedState)
    ? getCitiesForState(selectedCountry, selectedState)
    : [];

  // State for UI sections
  const [expandedSection, setExpandedSection] = useState('');

  // Quran settings state
  const [quranEditionPref, setQuranEditionPref] = useState<EditionPref>('both');
  const [quranDownloadedCount, setQuranDownloadedCount] = useState(0);
  const [quranStorageSize, setQuranStorageSize] = useState(0);
  const [quranFullDownloading, setQuranFullDownloading] = useState(false);
  const [quranDownloadProgress, setQuranDownloadProgress] = useState<DownloadProgress | null>(null);
  const [quranFontScale, setQuranFontScaleState] = useState(1.15);
  const [quranAutoScrollWithAudio, setQuranAutoScrollWithAudioState] = useState(true);
  const [quranTranslationEdition, setQuranTranslationEditionState] = useState<string>(EDITIONS.ENGLISH);
  const [quranReciter, setQuranReciterState] = useState<string>(EDITIONS.DEFAULT_RECITER);
  const [translationEditions, setTranslationEditions] = useState<EditionInfo[]>([]);
  const [audioEditions, setAudioEditions] = useState<EditionInfo[]>([]);
  const [showTranslationPicker, setShowTranslationPicker] = useState(false);
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [editionSearchQuery, setEditionSearchQuery] = useState('');
  const [audioFullDownloading, setAudioFullDownloading] = useState(false);
  const [audioDownloadProgress, setAudioDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  // Time-based gradient colors for dynamic backgrounds (light mode only)
  const getTimeBasedGradient = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 7) { // Fajr time - ultra soft dawn
      return [C.background.primary, C.background.secondary, C.surface.secondary];
    } else if (hour >= 7 && hour < 12) { // Morning - ultra light warm
      return [C.background.primary, C.surface.elevated, C.background.tertiary];
    } else if (hour >= 12 && hour < 15) { // Midday - bright light sepia
      return [C.surface.elevated, C.background.secondary, C.surface.secondary];
    } else if (hour >= 15 && hour < 18) { // Afternoon - light golden sepia
      return [C.background.secondary, C.background.tertiary, C.surface.secondary];
    } else if (hour >= 18 && hour < 20) { // Maghrib - light sunset sepia
      return [C.background.tertiary, C.surface.secondary, '#F5F1E6'];
    } else { // Night/Isha - slightly deeper but still light sepia
      return [C.surface.secondary, C.surface.secondary, '#F2EEE1'];
    }
  };
  const gradientColors = isDark ? [C.background.primary, C.background.secondary, C.surface.primary] : getTimeBasedGradient();

  // ✨ MAGICAL BUTTON COMPONENT ✨
  const MagicalButton = ({
    onPress,
    disabled = false,
    style,
    children,
    glowColor = C.accent.gold
  }: {
    onPress?: () => void;
    disabled?: boolean;
    style?: any;
    children: React.ReactNode;
    glowColor?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          borderWidth: 0.5,
          borderColor: `${glowColor}30`,
          borderRadius: 16,
          overflow: 'hidden',
        },
        style
      ]}
      activeOpacity={0.8}
    >
      {children}
    </TouchableOpacity>
  );

  // ✨ MAGICAL HEADER COMPONENT ✨
  // Standard simple header (no glow/animations) for consistency with platform defaults
  const StandardHeader = () => (
    <View style={styles.standardHeaderWrapper}>
      <TouchableOpacity style={styles.standardBackButton} onPress={() => router.back()} activeOpacity={0.7}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={C.accent.gold} />
      </TouchableOpacity>
      <Text style={styles.standardHeaderTitle}>{t('settings')}</Text>
      {/* Right placeholder for symmetry */}
      <View style={{ width: 32 }} />
    </View>
  );

  // Animations removed

  // Load saved settings when component mounts
  useEffect(() => {
    const initializeApp = async () => {
      await loadSettings();
      // Initialize Notifee notification system (better reliability)
      try {
        await initializeNotifeePrayerNotifications();
        await requestExactAlarmPermission(); // For Android 12+
      } catch (error) {
        console.log('Error initializing Notifee notifications:', error);
      }
      // Modern service handles foreground notifications automatically
    };

    initializeApp();
  }, []);

  // Load Quran settings
  useEffect(() => {
    (async () => {
      try {
        const [pref, count, size, fontSc, autoScrollPref, trEd, recPref] = await Promise.all([
          getEditionPref(),
          getDownloadedCount(),
          getTotalDownloadSize(),
          getQuranFontScale(),
          getQuranAutoScrollWithAudio(),
          getTranslationEdition(),
          getReciterPref(),
        ]);
        setQuranEditionPref(pref);
        setQuranDownloadedCount(count);
        setQuranStorageSize(size);
        setQuranFontScaleState(fontSc);
        setQuranAutoScrollWithAudioState(autoScrollPref);
        setQuranTranslationEditionState(trEd);
        setQuranReciterState(recPref);
      } catch (e) {
        console.log('Error loading Quran settings:', e);
      }
    })();
    // Pre-load edition lists
    (async () => {
      try {
        const [trEditions, auEditions] = await Promise.all([
          getTranslationEditionsCached(),
          getAudioEditionsCached(),
        ]);
        setTranslationEditions(trEditions);
        setAudioEditions(auEditions);
      } catch { /* silent */ }
    })();
  }, []);

  // Quran settings handlers
  const handleEditionPrefChange = async (pref: EditionPref) => {
    setQuranEditionPref(pref);
    await saveEditionPref(pref);
  };

  const handleDownloadFullQuran = async () => {
    Alert.alert(
      t('downloadAll'),
      t('deleteAllConfirm').replace('remove all downloaded Quran data and free up storage', 'download all 114 surahs'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: async () => {
            setQuranFullDownloading(true);
            setQuranDownloadProgress({ downloaded: 0, total: 114 });
            try {
              await downloadFullQuran((progress) => {
                setQuranDownloadProgress(progress);
              });
              const [count, size] = await Promise.all([getDownloadedCount(), getTotalDownloadSize()]);
              setQuranDownloadedCount(count);
              setQuranStorageSize(size);
              Alert.alert(t('downloadComplete'), '114/114 ' + t('surahs'));
            } catch (e: any) {
              Alert.alert(t('downloadFailed'), t('downloadFailedMsg'));
            } finally {
              setQuranFullDownloading(false);
              setQuranDownloadProgress(null);
            }
          },
        },
      ],
    );
  };

  const handleDownloadAllAudio = async () => {
    const reciterName = audioEditions.find(e => e.identifier === quranReciter)?.name ?? quranReciter;
    Alert.alert(
      t('downloadAllAudio'),
      t('downloadAllAudioConfirm').replace('{reciter}', reciterName),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: async () => {
            setAudioFullDownloading(true);
            setAudioDownloadProgress({ done: 0, total: 114 });
            try {
              await downloadAllAudio(quranReciter, (done, total) => {
                setAudioDownloadProgress({ done, total });
              });
              Alert.alert(t('downloadComplete'), t('allAudioDownloaded'));
            } catch (e: any) {
              Alert.alert(t('downloadFailed'), t('downloadFailedMsg'));
            } finally {
              setAudioFullDownloading(false);
              setAudioDownloadProgress(null);
            }
          },
        },
      ],
    );
  };

  const handleClearAllQuranDownloads = async () => {
    Alert.alert(
      t('deleteAllDownloads'),
      t('deleteAllConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteAllQuranData();
            setQuranDownloadedCount(0);
            setQuranStorageSize(0);
            Alert.alert(t('deleteAllSuccess'));
          },
        },
      ],
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Font scale handler (0.75 – 1.5) via slider
  const handleFontScaleChange = async (value: number) => {
    const rounded = parseFloat(value.toFixed(2));
    setQuranFontScaleState(rounded);
  };
  const handleFontScaleChangeComplete = async (value: number) => {
    const rounded = parseFloat(value.toFixed(2));
    setQuranFontScaleState(rounded);
    await setQuranFontScale(rounded);
  };

  const handleQuranAutoScrollToggle = async (value: boolean) => {
    setQuranAutoScrollWithAudioState(value);
    await setQuranAutoScrollWithAudio(value);
  };

  // Translation edition handler
  const handleTranslationEditionChange = async (identifier: string) => {
    setQuranTranslationEditionState(identifier);
    await setTranslationEdition(identifier);
    setShowTranslationPicker(false);
    setEditionSearchQuery('');
  };

  // Reciter handler
  const handleReciterChange = async (identifier: string) => {
    setQuranReciterState(identifier);
    await setReciterPref(identifier);
    setShowReciterPicker(false);
  };

  // ISO 639-1 language code → English name (for search by language name)
  const LANG_NAMES: Record<string, string> = {
    ar: 'arabic', az: 'azerbaijani', ba: 'bashkir', bn: 'bengali', bs: 'bosnian',
    cs: 'czech', de: 'german', dv: 'divehi maldivian', en: 'english', es: 'spanish',
    fa: 'persian farsi', fr: 'french', ha: 'hausa', hi: 'hindi', id: 'indonesian',
    it: 'italian', ja: 'japanese', ko: 'korean', ku: 'kurdish', ml: 'malayalam',
    ms: 'malay', nl: 'dutch', no: 'norwegian', pl: 'polish', ps: 'pashto',
    pt: 'portuguese', ro: 'romanian', ru: 'russian', sd: 'sindhi', so: 'somali',
    sq: 'albanian', sv: 'swedish', sw: 'swahili', ta: 'tamil', te: 'telugu',
    tg: 'tajik', th: 'thai', tr: 'turkish', tt: 'tatar', ug: 'uyghur',
    uk: 'ukrainian', ur: 'urdu', uz: 'uzbek', zh: 'chinese',
  };

  // Filter translation editions by search (supports language code, name, identifier, englishName, and full language name)
  const filteredTranslations = translationEditions.filter((ed) => {
    if (!editionSearchQuery) return true;
    const q = editionSearchQuery.toLowerCase();
    const langName = LANG_NAMES[ed.language] ?? '';
    return (
      ed.name.toLowerCase().includes(q) ||
      ed.language.toLowerCase().includes(q) ||
      ed.identifier.toLowerCase().includes(q) ||
      ed.englishName.toLowerCase().includes(q) ||
      langName.includes(q)
    );
  });

  const loadSettings = async () => {
    try {
      // Load notification settings
      const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
      const notifSettings = await AsyncStorage.getItem('notification_settings');

      if (notifEnabled !== null) {
        setNotificationsEnabled(notifEnabled === 'true');
      }

      if (notifSettings !== null) {
        setNotificationSettings(JSON.parse(notifSettings));
      }

      // Load notification sound preference
      const soundPref = await AsyncStorage.getItem('use_azan_sound');
      if (soundPref !== null) {
        setUseAzanSound(soundPref === 'true');
      }

      // Load region setting
      const savedRegion = await AsyncStorage.getItem('selected_region');
      if (savedRegion) {
        setRegionId(savedRegion);

        // Parse the region ID to set selected country, state, and city
        const { countryId, stateId, cityId } = parseRegionId(savedRegion);
        setSelectedCountry(countryId);
        setSelectedState(stateId);
        setSelectedCity(cityId);
      } else {
        // Set defaults based on DEFAULT_REGION
        const { countryId, stateId, cityId } = parseRegionId(DEFAULT_REGION);
        setSelectedCountry(countryId);
        setSelectedState(stateId);
        setSelectedCity(cityId);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Request notification permissions
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
            [{ text: 'OK' }]
          );
          return false;
        }
        return true;
      } else {
        Alert.alert(
          'Physical Device Required',
          'Notifications require a physical device to work properly',
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  // Toggle notifications on/off
  const toggleNotifications = async (value: boolean) => {
    try {
      if (value) {
        // If turning on, request permissions first
        const permissionGranted = await requestNotificationPermissions();
        if (!permissionGranted) {
          return; // Don't enable if permission not granted
        }

        // Initialize the Notifee notification service
        console.log('🔧 Initializing Notifee notification service...');
        const initialized = await initializeNotifeePrayerNotifications();
        if (!initialized) {
          Alert.alert(
            'Notifee Setup Failed',
            'Unable to initialize Notifee notification service. Please check permissions.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      setNotificationsEnabled(value);
      await AsyncStorage.setItem('notifications_enabled', value ? 'true' : 'false');

      // Broadcast an event so other parts of the app know about this change
      if (value) {
        // Re-setup background task when enabling notifications
        await setupBackgroundTask();
        console.log('✅ Background task re-registered');

        // Let the home screen know to schedule notifications
        await AsyncStorage.setItem('notifications_updated', Date.now().toString());
        console.log('✅ Notifications enabled and service initialized');
      } else {
        // CRITICAL: Cancel ALL notifications when disabling
        // This includes displayed notifications, trigger notifications, and background tasks
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

  // Toggle individual prayer notification settings
  const togglePrayerNotification = async (prayer: string, value: boolean) => {
    try {
      const updatedSettings = {
        ...notificationSettings,
        [prayer]: value
      };

      setNotificationSettings(updatedSettings);
      await AsyncStorage.setItem('notification_settings', JSON.stringify(updatedSettings));

      // Immediately reschedule notifications when individual prayer is toggled
      if (notificationsEnabled) {
        console.log(`🔄 ${prayer} toggled to ${value}, forcing immediate reschedule...`);
        // Directly call forceRescheduleAllNotifications for immediate update
        await forceRescheduleAllNotifications();
        console.log(`✅ Notifications rescheduled after ${prayer} toggle`);
      }
    } catch (error) {
      console.error('Error toggling prayer notification:', error);
    }
  };

  // Toggle notification sound preference
  const toggleSoundPreference = async (value: boolean) => {
    try {
      setUseAzanSound(value);
      await AsyncStorage.setItem('use_azan_sound', value ? 'true' : 'false');

      // Immediately reschedule notifications with new sound preference
      if (notificationsEnabled) {
        console.log(`🔊 Sound preference changed to ${value ? 'Azan' : 'Default'}, forcing immediate reschedule...`);
        await forceRescheduleAllNotifications();
        console.log('✅ Notifications rescheduled with new sound preference');
      }

      // Show feedback to the user
      Alert.alert(
        'Sound Preference Updated',
        value
          ? 'Azan sound will be used for prayer notifications. Sunrise will still use a simple beep.'
          : 'Simple beep will be used for all prayer notifications.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error setting sound preference:', error);
    }
  };

  // Add a function to test notifications
  const testNotification = async () => {
    try {
      // Initialize Notifee notification system
      await initializeNotifeePrayerNotifications();

      // Schedule a test notification using Notifee service
      const result = await scheduleNotifeeTestNotification();

      if (result) {
        Alert.alert(
          'Notifee Test Scheduled',
          'You should receive a Notifee notification shortly. If not, please check your notification permissions.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Notifee Test Failed',
          'Failed to schedule test notification. Please check permissions.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert(
        'Error',
        'Failed to send test notification. Please check app permissions.',
        [{ text: 'OK' }]
      );
    }
  };

  // Add a function to test audio directly
  const testDirectSound = async () => {
    try {
      console.log("Testing direct sound playback");
      const success = await playTestSound();

      Alert.alert(
        "Sound Test",
        success ?
          "Did you hear the beep sound?" :
          "There was an error playing the sound. Please check your device settings.",
        [
          {
            text: "No",
            style: "cancel",
            onPress: () => {
              console.log("Sound test failed");
              Alert.alert(
                "Sound Test Failed",
                "Try these troubleshooting steps:\n" +
                "1. Check if your device is not on silent mode\n" +
                "2. Increase the volume\n" +
                "3. Restart the app\n" +
                "4. Ensure audio files are in the assets/sounds folder"
              );
            }
          },
          {
            text: "Yes",
            onPress: () => console.log("Sound test succeeded")
          }
        ]
      );
    } catch (error) {
      console.error("Error playing test sound:", error);
      Alert.alert(
        "Sound Test Failed",
        "Error: " + (error instanceof Error ? error.message : String(error)) + "\n\nPlease check if audio files are in the correct location.",
        [{ text: "OK" }]
      );
    }
  };

  // Add azan sound fix test function
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

                // Step 1: Force recreate channels
                console.log('🔄 Recreating notification channels...');
                await forceRecreateNotificationChannels();

                // Step 2: Test notification with azan
                console.log('🔔 Testing notification with azan sound...');
                const result = await scheduleNotifeeTestNotification();

                if (result) {
                  Alert.alert(
                    'Azan Sound Test',
                    'Notification sent! Did you hear the azan sound? If not, check:\n\n• Phone volume is up\n• Not in silent mode\n• Notification sounds enabled\n• App has notification permissions',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert(
                    'Test Failed',
                    'Failed to send test notification. Check notification permissions.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                console.error('❌ Azan sound fix test failed:', error);
                Alert.alert(
                  'Test Error',
                  `Failed to test azan sound: ${error instanceof Error ? error.message : String(error)}`,
                  [{ text: 'OK' }]
                );
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error starting azan sound test:', error);
      Alert.alert("Error", "Failed to start azan sound test.", [{ text: 'OK' }]);
    }
  };

  // Add a function to test in-app notification
  const testInAppNotification = async () => {
    try {
      // Check for notification permissions using Notifee service
      const result = await initializeNotifeePrayerNotifications();

      if (result) {
        // If we have global.showTestNotification function (from _layout.tsx)
        if (global.showTestNotification) {
          global.showTestNotification();
          console.log("Triggered test in-app notification");
        } else {
          // Fallback to alert if function not available
          Alert.alert(
            "Test Function Not Available",
            "The in-app notification test function isn't available. Please restart the app.",
            [{ text: "OK" }]
          );
        }
      } else {
        Alert.alert(
          "Permission Required",
          "Please grant notification permission to test notifications",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error testing in-app notification:", error);
    }
  };

  // Check notification service status
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
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error checking notification status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to check notification status: ${errorMessage}`);
    }
  };

  // Reset all notifications with simplified service
  const resetNotifications = async () => {
    try {
      console.log('🔄 Starting notification reset...');

      // First clear all existing Notifee notifications
      await cancelAllNotifeePrayerNotifications();

      Alert.alert(
        'Notifications Reset',
        `Successfully cancelled all prayer notifications. The app will reschedule notifications automatically when you return to the home page.`,
        [{ text: 'OK' }]
      );

      console.log('✅ Notification reset completed successfully');
    } catch (error) {
      console.error('❌ Error resetting notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to reset notifications: ${errorMessage}`);
    }
  };

  // Select country
  const selectCountry = (countryId: string) => {
    if (countryId === selectedCountry) return;

    setSelectedCountry(countryId);

    // Get first state for the country
    const countryStates = getStatesForCountry(countryId);
    const firstState = countryStates.length > 0 ? countryStates[0].id : '';
    setSelectedState(firstState);

    // Get first city for the state
    const stateCities = getCitiesForState(countryId, firstState);
    const firstCity = stateCities.length > 0 ? stateCities[0].id : '';
    setSelectedCity(firstCity);

    // Don't automatically update the region - wait for user to press update button
  };

  // Select state
  const selectState = (stateId: string) => {
    if (stateId === selectedState) return;

    setSelectedState(stateId);

    // Get first city for the state
    const stateCities = getCitiesForState(selectedCountry, stateId);
    const firstCity = stateCities.length > 0 ? stateCities[0].id : '';
    setSelectedCity(firstCity);

    // Don't automatically update the region - wait for user to press update button
  };

  // Select city
  const selectCity = (cityId: string) => {
    if (cityId === selectedCity) return;

    setSelectedCity(cityId);

    // Don't automatically update the region - wait for user to press update button
  };

  // Update the region ID and save it - simplified for no-cache system
  const updateRegionId = async () => {
    try {
      // Create the new region ID from selected country, state, and city
      const newRegionId = `${selectedCountry}-${selectedState}-${selectedCity}`;

      // Check if the region ID is actually changing
      if (newRegionId === regionId) {
        Alert.alert(
          'No Change',
          'You haven\'t changed your location.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Update the UI first
      setRegionId(newRegionId);

      // Save user preference
      await AsyncStorage.setItem('selected_region', newRegionId);

      // Cancel ALL existing notifications first
      await notifee.cancelAllNotifications();
      console.log('Cancelled all scheduled notifications during region change');

      // Clear any existing cached data (just in case)
      const cachedKeys = await AsyncStorage.getAllKeys();
      const prayerTimeKeys = cachedKeys.filter((key: string) =>
        key.startsWith('prayer_') ||
        key.startsWith('last_updated_') ||
        key === 'cached_prayer_data' ||
        key === 'last_refresh_date'
      );

      if (prayerTimeKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerTimeKeys);
        console.log('Cleared any existing cached data during location change');
      }

      // Show immediate confirmation and navigate back
      Alert.alert(
        'Location Updated',
        'Your location has been updated. The home page will refresh with new prayer times.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to home - the no-cache system will automatically fetch fresh data
              router.push('/');
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error updating region:', error);
      Alert.alert(
        'Error',
        'Failed to update location. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Toggle a section's expanded state
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };
  // Open donation dialog with multiple options
  const [showPaywall, setShowPaywall] = useState(false);
  const [iapRetryCount, setIapRetryCount] = useState(0);
  const { loading: iapLoading, fetchOfferings } = usePurchase();

  const openDonation = () => {
    const extra: any = (Constants.expoConfig?.extra || (Constants as any).manifest?.extra || {});
    const rciOSKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || extra?.revenuecat?.iosApiKey;
    const rcAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || extra?.revenuecat?.androidApiKey;
    const shouldUsePaywall = Platform.OS === 'ios' ? !!rciOSKey : (Platform.OS === 'android' ? !!rcAndroidKey : false);

    if (shouldUsePaywall) {
      // Force refresh if stuck loading and retry count is low
      if (iapLoading && iapRetryCount < 3) {
        setIapRetryCount(prev => prev + 1);
        fetchOfferings();
        setTimeout(() => setShowPaywall(true), 1000);
      } else {
        setShowPaywall(true);
      }
      return;
    }
    // Fallback – keep existing external links
    Alert.alert(
      t('supportTitle'),
      t('supportMessage'),
      [
        { text: t('maybeLater'), style: 'cancel' },
        {
          text: t('oneTimeSupport'),
          onPress: () => {
            Linking.openURL('https://nas.io/checkout-global?communityId=640f2dbae2d22dff16a554d9&communityCode=AADIL_NOUFAL&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fportal%2Fproducts%2F67e825d377e3fc39a8ba9b0d%3Ftab%3Dcontent&sourceInfoType=folder&sourceInfoOrigin=67e825d377e3fc39a8ba9b0d').catch((err: Error) =>
              console.error('An error occurred while opening the link:', err)
            );
          }
        },
        {
          text: t('monthlySupport'),
          onPress: () => {
            Linking.openURL('https://nas.io/checkout-global?communityId=67e828db202755d3615d3a6b&communityCode=AD_FREE_ATHAN&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fcheckout-widget%3FcommunityCode%3DAD_FREE_ATHAN%26communitySlug%3D%252Fad-free-athan%26buttonText%3DJoin%2520as%2520member%26buttonTextColorHex%3D%2523000%26buttonBgColorHex%3D%2523fccb1d%26widgetTheme%3Dlight%26backgroundColorHex%3D%2523fff%2522%2520width%3D%2522100%25%2522%2520height%3D%2522320%2522%2520frameborder%3D%25220%2522%2520referrerpolicy%3D%2522no-referrer&fromWidget=1').catch((err: Error) =>
              console.error('An error occurred while opening the link:', err)
            );
          }
        }
      ]
    );
  };
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {Platform.OS === 'android' ? (
        <View style={{
          height: StatusBar.currentHeight || 20,
          backgroundColor: C.background.primary
        }} />
      ) : (
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={C.background.primary}
        />
      )}

      <Stack.Screen
        options={{
          headerShown: false,
          title: t('settings')
        }}
      />

      {/* ✨ MAGICAL GRADIENT BACKGROUND ✨ */}
      <ExpoLinearGradient
        colors={gradientColors as any}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.container}>
        {/* ✨ ENHANCED MAGICAL HEADER SECTION ✨ */}
        <StandardHeader />

        <ScrollView
          style={styles.enhancedScrollView}
          contentContainerStyle={styles.enhancedScrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {showPaywall && (
            <Modal animationType="slide" transparent visible={showPaywall} onRequestClose={() => setShowPaywall(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' }}>
                <RevenueCatPaywall onClose={() => setShowPaywall(false)} />
              </View>
            </Modal>
          )}
          {/* Appearance / Theme Section with normal toggle */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name={isDark ? 'weather-night' : 'white-balance-sunny'}
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('appearance')}</Text>
            </View>
            <View style={styles.enhancedSettingContainer}>
              <Text style={styles.enhancedSettingLabel}>{t('darkMode')}</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                thumbColor={isDark ? C.accent.gold : C.surface.secondary}
              />
            </View>
          </View>
          {/* ✨ ENHANCED LANGUAGE SETTINGS SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="web"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('language')}</Text>
            </View>

            {Object.values(availableLanguages).map((lang) => {
              const typedLang = lang as LanguageItem;
              return (
                <MagicalButton
                  key={typedLang.id}
                  onPress={() => changeLanguage(typedLang.id)}
                  style={[
                    styles.enhancedLanguageOption,
                    currentLang === typedLang.id && styles.selectedEnhancedLanguageOption
                  ]}
                  glowColor={currentLang === typedLang.id ? C.accent.amber : C.accent.gold}
                >
                  <Text style={[
                    styles.enhancedLanguageName,
                    currentLang === typedLang.id && styles.selectedEnhancedLanguageName
                  ]}>
                    {typedLang.name}
                  </Text>
                  {currentLang === typedLang.id && (
                    <MaterialCommunityIcons name="check" size={20} color={C.accent.gold} />
                  )}
                </MagicalButton>
              );
            })}
          </View>

          {/* ✨ ENHANCED NOTIFICATION SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="bell-outline"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('notifications')}</Text>
            </View>

            <View style={styles.enhancedSettingContainer}>
              <Text style={styles.enhancedSettingLabel}>{t('enableNotifications')}</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                thumbColor={notificationsEnabled ? C.accent.gold : C.surface.secondary}
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={styles.enhancedPrayerNotificationSettings}>
                  <Text style={styles.enhancedSettingSubtitle}>{t('notifyMeFor')}:</Text>
                  {Object.keys(notificationSettings).map((prayer) => (
                    <View
                      key={prayer}
                      style={styles.enhancedPrayerNotificationItem}
                    >
                      <View style={styles.enhancedPrayerLabelContainer}>
                        <View style={styles.enhancedPrayerIcon}>
                          <MaterialCommunityIcons
                            name={
                              prayer === 'Fajr' ? 'weather-sunset-up' :
                                prayer === 'Sunrise' ? 'white-balance-sunny' :
                                  prayer === 'Dhuhr' ? 'sun-wireless' :
                                    prayer === 'Asr' ? 'weather-sunny' :
                                      prayer === 'Maghrib' ? 'weather-sunset-down' :
                                        'weather-night'
                            }
                            size={20}
                            color={C.accent.gold}
                          />
                        </View>
                        <Text style={styles.enhancedPrayerLabel}>{t(prayer)}</Text>
                      </View>
                      <Switch
                        value={notificationSettings[prayer]}
                        onValueChange={(value: boolean) => togglePrayerNotification(prayer, value)}
                        trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                        thumbColor={notificationSettings[prayer] ? C.accent.gold : C.surface.secondary}
                      />
                    </View>
                  ))}
                </View>

                {/* Enhanced Notification Sound Preference */}
                <View style={styles.enhancedSoundPreferenceContainer}>
                  <View style={styles.enhancedSoundPrefTextContainer}>
                    <Text style={styles.enhancedSettingLabel}>{t('useAzanSound')}</Text>
                    <Text style={styles.enhancedSettingDescription}>
                      {t('beepExplanation')}
                    </Text>
                  </View>
                  <Switch
                    value={useAzanSound}
                    onValueChange={toggleSoundPreference}
                    trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                    thumbColor={useAzanSound ? C.accent.gold : C.surface.secondary}
                  />
                </View>

                {/* Enhanced Test Notification Buttons */}
                <View style={styles.enhancedTestButtonsContainer}>
                  <MagicalButton
                    style={styles.enhancedTestButton}
                    onPress={testNotification}
                    glowColor={C.accent.amber}
                  >
                    <MaterialCommunityIcons name="bell-ring" size={18} color={C.text.inverse} />
                    <Text style={styles.enhancedTestButtonText}>{t('testNotification')}</Text>
                  </MagicalButton>

                  {/* Enhanced Notification Status Button */}
                  <MagicalButton
                    style={[styles.enhancedTestButton, { marginTop: 10, backgroundColor: C.accent.copper }]}
                    onPress={checkNotificationStatus}
                    glowColor={C.accent.copper}
                  >
                    <MaterialCommunityIcons name="information-outline" size={18} color={C.text.inverse} />
                    <Text style={styles.enhancedTestButtonText}>{t('status')}</Text>
                  </MagicalButton>
                </View>
              </>
            )}
          </View>

          {/* ✨ ENHANCED LOCATION SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="map-marker"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('locationSettings')}</Text>
            </View>
            <Text style={styles.enhancedSectionDescription}>
              {t('selectLocation')}
            </Text>

            {/* Enhanced Country Selection */}
            <MagicalButton
              style={styles.enhancedLocationSelector}
              onPress={() => toggleSection('country')}
              glowColor={C.accent.amber}
            >
              <View style={styles.enhancedLocationSelectorHeader}>
                <Text style={styles.enhancedLocationLabel}>{t('country')}</Text>
                <View style={styles.enhancedLocationSelection}>
                  <Text style={styles.enhancedLocationValue}>
                    {countries.find(c => c.id === selectedCountry)?.name || t('selectCountry')}
                  </Text>
                  <MaterialCommunityIcons
                    name={expandedSection === 'country' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={C.accent.gold}
                  />
                </View>
              </View>
            </MagicalButton>

            {expandedSection === 'country' && (
              <View style={styles.enhancedOptionsContainer}>
                {countries.map(country => (
                  <MagicalButton
                    key={country.id}
                    style={[
                      styles.enhancedOptionItem,
                      selectedCountry === country.id && styles.selectedEnhancedOptionItem
                    ]}
                    onPress={() => selectCountry(country.id)}
                    glowColor={selectedCountry === country.id ? C.accent.amber : C.accent.gold}
                  >
                    <Text style={[
                      styles.enhancedOptionName,
                      selectedCountry === country.id && styles.selectedEnhancedOptionName
                    ]}>
                      {country.name}
                    </Text>
                    {selectedCountry === country.id && (
                      <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
                    )}
                  </MagicalButton>
                ))}
              </View>
            )}

            {/* Enhanced State Selection */}
            <MagicalButton
              style={[styles.enhancedLocationSelector, { marginTop: 16 }]}
              onPress={() => toggleSection('state')}
              glowColor={C.accent.amber}
            >
              <View style={styles.enhancedLocationSelectorHeader}>
                <Text style={styles.enhancedLocationLabel}>{t('state')}</Text>
                <View style={styles.enhancedLocationSelection}>
                  <Text style={styles.enhancedLocationValue}>
                    {states.find(s => s.id === selectedState)?.name || t('selectState')}
                  </Text>
                  <MaterialCommunityIcons
                    name={expandedSection === 'state' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={C.accent.gold}
                  />
                </View>
              </View>
            </MagicalButton>

            {expandedSection === 'state' && (
              <View style={styles.enhancedOptionsContainer}>
                {states.map(state => (
                  <MagicalButton
                    key={state.id}
                    style={[
                      styles.enhancedOptionItem,
                      selectedState === state.id && styles.selectedEnhancedOptionItem
                    ]}
                    onPress={() => selectState(state.id)}
                    glowColor={selectedState === state.id ? C.accent.amber : C.accent.gold}
                  >
                    <Text style={[
                      styles.enhancedOptionName,
                      selectedState === state.id && styles.selectedEnhancedOptionName
                    ]}>
                      {state.name}
                    </Text>
                    {selectedState === state.id && (
                      <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
                    )}
                  </MagicalButton>
                ))}
              </View>
            )}

            {/* Enhanced City Selection */}
            <MagicalButton
              style={[styles.enhancedLocationSelector, { marginTop: 16 }]}
              onPress={() => toggleSection('city')}
              glowColor={C.accent.amber}
            >
              <View style={styles.enhancedLocationSelectorHeader}>
                <Text style={styles.enhancedLocationLabel}>{t('city')}</Text>
                <View style={styles.enhancedLocationSelection}>
                  <Text style={styles.enhancedLocationValue}>
                    {cities.find(c => c.id === selectedCity)?.name || t('selectCity')}
                  </Text>
                  <MaterialCommunityIcons
                    name={expandedSection === 'city' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={C.accent.gold}
                  />
                </View>
              </View>
            </MagicalButton>

            {expandedSection === 'city' && (
              <View style={styles.enhancedOptionsContainer}>
                {cities.map(city => (
                  <MagicalButton
                    key={city.id}
                    style={[
                      styles.enhancedOptionItem,
                      selectedCity === city.id && styles.selectedEnhancedOptionItem
                    ]}
                    onPress={() => selectCity(city.id)}
                    glowColor={selectedCity === city.id ? C.accent.amber : C.accent.gold}
                  >
                    <Text style={[
                      styles.enhancedOptionName,
                      selectedCity === city.id && styles.selectedEnhancedOptionName
                    ]}>
                      {city.name}
                    </Text>
                    {selectedCity === city.id && (
                      <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
                    )}
                  </MagicalButton>
                ))}
              </View>
            )}

            {/* Enhanced Location Summary */}
            <View style={styles.enhancedLocationSummary}>
              <MaterialCommunityIcons name="map-marker" size={20} color={C.accent.gold} />
              <Text style={styles.enhancedLocationSummaryText}>
                {cities.find(c => c.id === selectedCity)?.name || 'City'}, {' '}
                {states.find(s => s.id === selectedState)?.name || 'State'}, {' '}
                {countries.find(c => c.id === selectedCountry)?.name || 'Country'}
              </Text>
            </View>

            {/* Enhanced Update Location Button */}
            <MagicalButton
              style={styles.enhancedUpdateLocationButton}
              onPress={updateRegionId}
              glowColor={C.accent.amber}
            >
              <MaterialCommunityIcons name="map-marker-check" size={18} color={C.text.inverse} />
              <Text style={styles.enhancedUpdateLocationButtonText}>{t('updateLocation')}</Text>
            </MagicalButton>
          </View>

          {/* ✨ QURAN SETTINGS SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('quranSettings')}</Text>
            </View>

            {/* Default edition preference */}
            <Text style={styles.enhancedSettingSubtitle}>{t('defaultEdition')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <MagicalButton
                onPress={() => handleEditionPrefChange('arabic')}
                style={[
                  styles.enhancedLanguageOption,
                  { flex: 1 },
                  quranEditionPref === 'arabic' && styles.selectedEnhancedLanguageOption,
                ]}
                glowColor={quranEditionPref === 'arabic' ? C.accent.amber : C.accent.gold}
              >
                <Text style={[
                  styles.enhancedLanguageName,
                  { fontSize: 13 },
                  quranEditionPref === 'arabic' && styles.selectedEnhancedLanguageName,
                ]}>
                  {t('arabicOnly')}
                </Text>
                {quranEditionPref === 'arabic' && (
                  <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
                )}
              </MagicalButton>
              <MagicalButton
                onPress={() => handleEditionPrefChange('both')}
                style={[
                  styles.enhancedLanguageOption,
                  { flex: 1 },
                  quranEditionPref === 'both' && styles.selectedEnhancedLanguageOption,
                ]}
                glowColor={quranEditionPref === 'both' ? C.accent.amber : C.accent.gold}
              >
                <Text style={[
                  styles.enhancedLanguageName,
                  { fontSize: 13 },
                  quranEditionPref === 'both' && styles.selectedEnhancedLanguageName,
                ]}>
                  {t('arabicAndTranslation')}
                </Text>
                {quranEditionPref === 'both' && (
                  <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
                )}
              </MagicalButton>
            </View>

            {/* Font size control */}
            <Text style={styles.enhancedSettingSubtitle}>{t('quranFontSize')}</Text>
            <View style={{ marginBottom: 14 }}>
              {/* Slider with min/max labels */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: C.text.tertiary, fontSize: 12 }}>A</Text>
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Slider
                    minimumValue={0.75}
                    maximumValue={1.5}
                    step={0.05}
                    value={quranFontScale}
                    onValueChange={handleFontScaleChange}
                    onSlidingComplete={handleFontScaleChangeComplete}
                    minimumTrackTintColor={C.accent.gold}
                    maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}
                    thumbTintColor={C.accent.gold}
                  />
                </View>
                <Text style={{ color: C.text.tertiary, fontSize: 18, fontWeight: '700' }}>A</Text>
              </View>
              <Text style={{ color: C.accent.gold, fontWeight: '700', textAlign: 'center', fontSize: 14, marginBottom: 10 }}>
                {Math.round(quranFontScale * 100)}%
              </Text>

              {/* Live Arabic preview */}
              <View style={{
                borderRadius: 12,
                padding: 14,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderWidth: 0.5,
                borderColor: `${C.accent.gold}30`,
              }}>
                <Text style={{
                  color: C.text.primary,
                  fontSize: Math.round(24 * quranFontScale),
                  lineHeight: Math.round(42 * quranFontScale),
                  textAlign: 'right',
                  marginBottom: 8,
                }}>
                  {t('quranFontPreview')}
                </Text>
                <Text style={{
                  color: C.text.secondary,
                  fontSize: Math.round(16 * quranFontScale),
                  lineHeight: Math.round(26 * quranFontScale),
                }}>
                  {t('quranFontPreviewEn')}
                </Text>
              </View>
            </View>

            {/* Auto-scroll with audio */}
            <View style={[styles.enhancedSettingContainer, { marginBottom: 14 }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.enhancedSettingLabel}>{t('quranAutoScrollWithAudio')}</Text>
                <Text style={styles.enhancedSettingDescription}>{t('quranAutoScrollWithAudioDescription')}</Text>
              </View>
              <Switch
                value={quranAutoScrollWithAudio}
                onValueChange={handleQuranAutoScrollToggle}
                trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                thumbColor={quranAutoScrollWithAudio ? C.accent.gold : C.surface.secondary}
              />
            </View>

            {/* Translation edition picker */}
            <Text style={styles.enhancedSettingSubtitle}>{t('translationEdition')}</Text>
            <TouchableOpacity
              onPress={() => setShowTranslationPicker(true)}
              style={[styles.enhancedSettingContainer, { marginBottom: 14, borderWidth: 0.5, borderColor: 'rgba(218,165,32,0.2)', borderRadius: 10, paddingVertical: 10 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.enhancedSettingLabel, { fontWeight: '600' }]}>{t('currentTranslation')}</Text>
                <Text style={[styles.enhancedSettingDescription, { marginTop: 2 }]}>
                  {translationEditions.find(e => e.identifier === quranTranslationEdition)?.name ?? quranTranslationEdition}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.text.tertiary} />
            </TouchableOpacity>

            {/* Reciter picker */}
            <Text style={styles.enhancedSettingSubtitle}>{t('reciter')}</Text>
            <TouchableOpacity
              onPress={() => setShowReciterPicker(true)}
              style={[styles.enhancedSettingContainer, { marginBottom: 14, borderWidth: 0.5, borderColor: 'rgba(218,165,32,0.2)', borderRadius: 10, paddingVertical: 10 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.enhancedSettingLabel, { fontWeight: '600' }]}>{t('selectReciter')}</Text>
                <Text style={[styles.enhancedSettingDescription, { marginTop: 2 }]}>
                  {audioEditions.find(e => e.identifier === quranReciter)?.name ?? quranReciter}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.text.tertiary} />
            </TouchableOpacity>

            {/* Download stats */}
            <View style={styles.enhancedSettingContainer}>
              <Text style={styles.enhancedSettingLabel}>{t('downloadedSurahs')}</Text>
              <Text style={[styles.enhancedSettingLabel, { color: C.accent.gold }]}>
                {quranDownloadedCount} / 114
              </Text>
            </View>

            {quranStorageSize > 0 && (
              <View style={[styles.enhancedSettingContainer, { marginTop: 4 }]}>
                <Text style={styles.enhancedSettingLabel}>{t('storageUsed')}</Text>
                <Text style={[styles.enhancedSettingLabel, { color: C.accent.gold }]}>
                  {formatBytes(quranStorageSize)}
                </Text>
              </View>
            )}

            {/* Download full Quran button */}
            {quranDownloadedCount < 114 && (
              <View style={styles.enhancedTestButtonsContainer}>
                {quranFullDownloading && quranDownloadProgress ? (
                  <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                    <ActivityIndicator size="small" color={C.accent.gold} />
                    <Text style={[styles.enhancedSettingDescription, { marginTop: 8, textAlign: 'center' }]}>
                      {t('downloadProgress')
                        .replace('{downloaded}', String(quranDownloadProgress.downloaded))
                        .replace('{total}', String(quranDownloadProgress.total))}
                    </Text>
                  </View>
                ) : (
                  <MagicalButton
                    style={styles.enhancedTestButton}
                    onPress={handleDownloadFullQuran}
                    disabled={quranFullDownloading}
                    glowColor={C.accent.amber}
                  >
                    <MaterialCommunityIcons name="download" size={18} color={C.text.inverse} />
                    <Text style={styles.enhancedTestButtonText}>{t('downloadAll')}</Text>
                  </MagicalButton>
                )}
              </View>
            )}

            {/* Download all audio button */}
            <View style={[styles.enhancedTestButtonsContainer, { marginTop: 8 }]}>
              {audioFullDownloading && audioDownloadProgress ? (
                <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                  <ActivityIndicator size="small" color={C.accent.gold} />
                  <Text style={[styles.enhancedSettingDescription, { marginTop: 8, textAlign: 'center' }]}>
                    {t('downloadProgress')
                      .replace('{downloaded}', String(audioDownloadProgress.done))
                      .replace('{total}', String(audioDownloadProgress.total))}
                  </Text>
                </View>
              ) : (
                <MagicalButton
                  style={styles.enhancedTestButton}
                  onPress={handleDownloadAllAudio}
                  disabled={audioFullDownloading || quranFullDownloading}
                  glowColor={C.accent.amber}
                >
                  <MaterialCommunityIcons name="music-box-multiple" size={18} color={C.text.inverse} />
                  <Text style={styles.enhancedTestButtonText}>{t('downloadAllAudio')}</Text>
                </MagicalButton>
              )}
            </View>

            {/* Clear downloads button */}
            {quranDownloadedCount > 0 && (
              <View style={[styles.enhancedTestButtonsContainer, { marginTop: 8 }]}>
                <MagicalButton
                  style={[styles.enhancedTestButton, { backgroundColor: C.accent.copper || '#B87333' }]}
                  onPress={handleClearAllQuranDownloads}
                  glowColor={C.accent.copper || '#B87333'}
                >
                  <MaterialCommunityIcons name="delete-outline" size={18} color={C.text.inverse} />
                  <Text style={styles.enhancedTestButtonText}>{t('deleteAllDownloads')}</Text>
                </MagicalButton>
              </View>
            )}
          </View>

          {/* ✨ ENHANCED ABOUT SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('about')}</Text>
            </View>
            <View style={styles.enhancedAboutContainer}>
              <Text style={styles.enhancedAppVersion}>{t('appVersion')}</Text>
              <Text style={styles.enhancedAboutText}>
                {t('aboutText')}
              </Text>
              <View style={styles.enhancedSupportButtonsContainer}>
                <MagicalButton
                  style={styles.enhancedSupportButton}
                  onPress={openDonation}
                  glowColor={C.accent.amber}
                >
                  <MaterialCommunityIcons name="gift" size={18} color={C.text.inverse} />
                  <Text style={styles.enhancedSupportButtonText}>{t('supportDeveloper')}</Text>
                </MagicalButton>

                {/* RevenueCat management (production-safe) for iOS and Android */}
                {(Platform.OS === 'ios' || Platform.OS === 'android') && (
                  <View style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
                    <Text style={{ color: C.text.secondary, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
                      RevenueCat Status: Ready
                    </Text>
                    <TouchableOpacity
                      style={[styles.enhancedTestButton, { backgroundColor: '#333' }]}
                      onPress={() => Linking.openURL(
                        Platform.OS === 'ios'
                          ? 'https://apps.apple.com/account/subscriptions'
                          : 'https://play.google.com/store/account/subscriptions'
                      )}
                      disabled={iapLoading}
                    >
                      <Text style={styles.enhancedTestButtonText}>{t('manageSubscriptions')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Footer Padding */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* ── Translation Edition Picker Modal ───────────────────── */}
      <Modal visible={showTranslationPicker} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 30 }}>
            {/* Modal header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(218,165,32,0.15)' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text.primary }}>{t('selectTranslation')}</Text>
              <TouchableOpacity onPress={() => { setShowTranslationPicker(false); setEditionSearchQuery(''); }}>
                <MaterialCommunityIcons name="close" size={22} color={C.text.tertiary} />
              </TouchableOpacity>
            </View>
            {/* Search input */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderWidth: 0.5, borderColor: 'rgba(218,165,32,0.15)' }}>
              <MaterialCommunityIcons name="magnify" size={18} color={C.text.tertiary} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: 14, color: C.text.primary, paddingVertical: 0 }}
                placeholder={t('searchTranslations')}
                placeholderTextColor={C.text.tertiary}
                value={editionSearchQuery}
                onChangeText={setEditionSearchQuery}
                autoCorrect={false}
              />
            </View>
            {/* Edition list */}
            <FlatList
              data={filteredTranslations}
              keyExtractor={(item) => item.identifier}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleTranslationEditionChange(item.identifier)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(218,165,32,0.08)' }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text.primary }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: C.text.secondary, marginTop: 2 }}>{item.language} · {item.identifier}</Text>
                  </View>
                  {quranTranslationEdition === item.identifier && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={C.accent.gold} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <Text style={{ color: C.text.secondary, fontSize: 14 }}>{t('noTranslationsFound')}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ── Reciter Picker Modal ───────────────────────────────── */}
      <Modal visible={showReciterPicker} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 30 }}>
            {/* Modal header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(218,165,32,0.15)' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text.primary }}>{t('selectReciter')}</Text>
              <TouchableOpacity onPress={() => setShowReciterPicker(false)}>
                <MaterialCommunityIcons name="close" size={22} color={C.text.tertiary} />
              </TouchableOpacity>
            </View>
            {/* Reciter list */}
            <FlatList
              data={audioEditions}
              keyExtractor={(item) => item.identifier}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleReciterChange(item.identifier)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(218,165,32,0.08)' }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text.primary }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: C.text.secondary, marginTop: 2 }}>{item.englishName}</Text>
                  </View>
                  {quranReciter === item.identifier && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={C.accent.gold} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <ActivityIndicator size="small" color={C.accent.gold} />
                  <Text style={{ color: C.text.secondary, fontSize: 14, marginTop: 8 }}>{t('loading')}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Factory to create theme-aware styles so dark mode updates instantly
const createSettingsStyles = (colors: any, isDark: boolean) => {
  const goldRGB = '218, 165, 32';
  // Surfaces adapt subtly between themes
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.06)';
  const subCardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.04)';
  const faintLayer = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.03)';
  const optionBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.02)';
  const goldTint = (alpha: number) => `rgba(${goldRGB}, ${alpha})`;
  const selectionBg = isDark ? goldTint(0.10) : goldTint(0.08);
  const selectionBorder = isDark ? goldTint(0.35) : goldTint(0.25);
  const subtleBorder = isDark ? goldTint(0.25) : goldTint(0.15);
  const faintBorder = isDark ? goldTint(0.18) : goldTint(0.10);
  const extraFaintBorder = isDark ? goldTint(0.12) : goldTint(0.08);
  const translucentGoldLayer = isDark ? goldTint(0.05) : goldTint(0.1);

  return StyleSheet.create({
    // ✨ ENHANCED LAYOUT STYLES FROM HOMEPAGE ✨
    safeArea: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    container: {
      flex: 1,
      paddingHorizontal: 12, // Match homepage padding
      paddingTop: 0,
      paddingBottom: 90, // Extra padding for tab bar
      backgroundColor: 'transparent', // Make transparent to show gradient
    },

    // ✨ MAGICAL HEADER STYLES ✨
    // Standard header (replaces magical header)
    standardHeaderWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) - 6, 0) : 0,
      paddingHorizontal: 8,
      paddingBottom: 2,
      backgroundColor: 'transparent',
      minHeight: 32,
    },
    standardBackButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface.secondary,
      borderWidth: 0.5,
      borderColor: colors.border.light,
    },
    standardHeaderTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      letterSpacing: 0.4,
    },

    // Enhanced Scroll View
    enhancedScrollView: {
      flex: 1,
    },
    enhancedScrollViewContent: {
      paddingBottom: 40,
    },

    // ✨ ENHANCED SECTION STYLES ✨
    enhancedSection: {
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      position: 'relative',
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: subtleBorder,
    },
    enhancedSectionTitle: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
      letterSpacing: 0.4,
    },

    // Enhanced Language Option Styles
    enhancedLanguageOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: subCardBg,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    selectedEnhancedLanguageOption: {
      backgroundColor: selectionBg,
      borderColor: selectionBorder,
    },
    enhancedLanguageName: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    selectedEnhancedLanguageName: {
      color: colors.accent.darkGold,
      fontWeight: '700',
    },

    // Enhanced Setting Container Styles
    enhancedSettingContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: subCardBg,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      marginBottom: 10,
    },
    enhancedSettingLabel: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.25,
    },

    // Enhanced Prayer Notification Styles
    enhancedPrayerNotificationSettings: {
      backgroundColor: faintLayer,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    enhancedSettingSubtitle: {
      color: colors.text.secondary,
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 12,
      letterSpacing: 0.3,
    },
    enhancedPrayerNotificationItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: optionBg,
      marginBottom: 6,
      borderWidth: 0.5,
      borderColor: extraFaintBorder,
    },
    enhancedPrayerLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    enhancedPrayerIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: goldTint(isDark ? 0.12 : 0.10),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    enhancedPrayerLabel: {
      color: colors.text.primary,
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0.25,
    },

    // Enhanced Sound Preference Styles
    enhancedSoundPreferenceContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: subCardBg,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      marginTop: 10,
    },
    enhancedSoundPrefTextContainer: {
      flex: 1,
      paddingRight: 12,
    },
    enhancedSettingDescription: {
      color: colors.text.secondary,
      fontSize: 11,
      marginTop: 2,
      letterSpacing: 0.2,
      lineHeight: 14,
    },

    // Enhanced Test Button Styles
    enhancedTestButtonsContainer: {
      marginTop: 16,
      alignItems: 'center',
    },
    enhancedTestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 16,
      minWidth: 180,
    },
    enhancedTestButtonText: {
      color: colors.text.inverse,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
      letterSpacing: 0.3,
    },

    // Enhanced Section Description
    enhancedSectionDescription: {
      color: colors.text.secondary,
      fontSize: 14,
      marginBottom: 16,
      letterSpacing: 0.3,
      lineHeight: 20,
    },

    // Enhanced Location Selector Styles
    enhancedLocationSelector: {
      backgroundColor: subCardBg,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      marginBottom: 8,
    },
    enhancedLocationSelectorHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    enhancedLocationLabel: {
      color: colors.text.secondary,
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    enhancedLocationSelection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: selectionBg,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    enhancedLocationValue: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '600',
      marginRight: 8,
      letterSpacing: 0.3,
    },

    // Enhanced Options Container Styles
    enhancedOptionsContainer: {
      backgroundColor: optionBg,
      borderRadius: 12,
      padding: 8,
      marginBottom: 12,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    enhancedOptionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 4,
      backgroundColor: optionBg,
      borderWidth: 0.5,
      borderColor: extraFaintBorder,
    },
    selectedEnhancedOptionItem: {
      backgroundColor: selectionBg,
      borderColor: selectionBorder,
    },
    enhancedOptionName: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    selectedEnhancedOptionName: {
      color: colors.accent.darkGold,
      fontWeight: '600',
    },

    // Enhanced Location Summary Styles
    enhancedLocationSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: goldTint(isDark ? 0.08 : 0.06),
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
      borderWidth: 0.5,
      borderColor: selectionBorder,
    },
    enhancedLocationSummaryText: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 12,
      flex: 1,
      letterSpacing: 0.3,
      lineHeight: 20,
    },

    // Enhanced Update Location Button
    enhancedUpdateLocationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      marginTop: 16,
      minWidth: 180,
    },
    enhancedUpdateLocationButtonText: {
      color: colors.text.inverse,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
      letterSpacing: 0.3,
    },

    // Enhanced About Section Styles
    enhancedAboutContainer: {
      backgroundColor: faintLayer,
      borderRadius: 16,
      padding: 16,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    enhancedAppVersion: {
      color: colors.accent.gold,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    enhancedAboutText: {
      color: colors.text.secondary,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 20,
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    enhancedSupportButtonsContainer: {
      alignItems: 'center',
    },
    enhancedSupportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 16,
      minWidth: 160,
    },
    enhancedSupportButtonText: {
      color: colors.text.inverse,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
      letterSpacing: 0.3,
    },

    // =============================================================
    // The remaining (legacy/original) styles are kept mostly intact
    // but with palette references switched to current theme colors
    // for consistency across dark / light modes.
    // =============================================================

    // Original styles with homepage enhancements
    container_old: {
      flex: 1,
      backgroundColor: colors.background.primary, // Main background like homepage
      paddingBottom: 90, // Account for tab bar height + safe area
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 0,
      paddingHorizontal: 6,
      marginBottom: 0,
      borderRadius: 14,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 2 : 4,
      minHeight: 34,
    },
    backButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: goldTint(isDark ? 0.10 : 0.08),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    headerTitle: {
      color: colors.text.primary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      textAlign: 'center',
      flex: 1,
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: 12, // Match homepage padding
    },
    section: {
      margin: 8, // Reduced spacing like homepage
      padding: 16,
      backgroundColor: cardBg, // Themed card
      borderRadius: 20,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      marginBottom: 12, // Add bottom margin for spacing
    },
    sectionTitle: {
      color: colors.accent.gold,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12, // Reduced from 16
      letterSpacing: 0.5,
    },
    sectionDescription: {
      color: colors.text.secondary,
      fontSize: 14, // Reduced from 16
      marginBottom: 12, // Reduced from 16
      letterSpacing: 0.3,
      lineHeight: 20,
    },
    settingContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12, // Reduced from 16
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
    },
    settingLabel: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600', // Increased from 500
      letterSpacing: 0.3,
    },
    settingSubtitle: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      fontWeight: '600', // Increased from 500
      marginVertical: 8, // Reduced from 10
      letterSpacing: 0.3,
    },
    prayerNotificationSettings: {
      marginTop: 8, // Reduced from 10
      backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
      borderRadius: 16,
      padding: 12,
      borderWidth: 0.5,
      borderColor: 'rgba(218, 165, 32, 0.1)',
    },
    prayerNotificationItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10, // Reduced from 12
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
    },
    prayerLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(218, 165, 32, 0.05)', // Add subtle background
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    prayerLabel: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    collapsibleHeader: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
      borderRadius: 16, // Increased for elegant look
      overflow: 'hidden',
      borderWidth: 0.5, // Thinner border
      borderColor: 'rgba(218, 165, 32, 0.2)', // Subtle gold border
    },
    locationSelectorHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12, // Reduced from 14
    },
    locationLabel: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      fontWeight: '600', // Increased from 500
      letterSpacing: 0.3,
    },
    locationSelection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(218, 165, 32, 0.05)', // Add subtle background
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    locationValue: {
      color: SepiaColors.accent.gold,
      fontSize: 15, // Reduced from 16
      fontWeight: '700', // Increased from 600
      marginRight: 6, // Reduced from 8
      letterSpacing: 0.3,
    },
    optionsContainer: {
      marginTop: 2,
      backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
      borderRadius: 12, // Increased for elegant look
      paddingVertical: 6, // Reduced from 8
      maxHeight: 200,
      borderWidth: 0.5, // Thinner border
      borderColor: 'rgba(218, 165, 32, 0.2)', // Subtle gold border
    },
    optionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10, // Reduced from 12
      paddingHorizontal: 16,
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
    },
    selectedOptionItem: {
      backgroundColor: 'rgba(218, 165, 32, 0.1)', // Subtle gold highlight
    },
    optionName: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    selectedOptionName: {
      color: colors.accent.gold,
      fontWeight: '700', // Increased from bold
      letterSpacing: 0.3,
    },
    locationSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16, // Reduced from 20
      backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
      padding: 14, // Reduced from 16
      borderRadius: 16, // Increased for elegant look
      borderWidth: 0.5, // Thinner border
      borderColor: 'rgba(218, 165, 32, 0.2)', // Subtle gold border
    },
    locationSummaryText: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      marginLeft: 10,
      flex: 1,
      fontWeight: '500',
      letterSpacing: 0.3,
      lineHeight: 20,
    },
    aboutContainer: {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
      borderRadius: 16,
      padding: 16,
      borderWidth: 0.5,
      borderColor: 'rgba(218, 165, 32, 0.1)',
    },
    appVersion: {
      color: colors.text.primary,
      fontSize: 16, // Reduced from 18
      fontWeight: '700', // Increased from bold
      marginBottom: 10, // Reduced from 12
      letterSpacing: 0.5,
    },
    aboutText: {
      color: colors.text.secondary,
      fontSize: 14, // Reduced from 16
      textAlign: 'center',
      lineHeight: 22, // Reduced from 24
      marginBottom: 16, // Reduced from 20
      letterSpacing: 0.3,
    },
    supportButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      width: '100%',
      marginTop: 4, // Reduced from 5
    },
    supportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: SepiaColors.accent.gold,
      paddingHorizontal: 18, // Reduced from 20
      paddingVertical: 10, // Reduced from 12
      borderRadius: 20, // Reduced from 24
      // Remove all shadow/elevation properties for clean look
    },
    supportButtonText: {
      color: colors.text.inverse,
      fontSize: 15, // Reduced from 16
      fontWeight: '700', // Increased from bold
      marginLeft: 6, // Reduced from 8
      letterSpacing: 0.3,
    },
    settingDescription: {
      color: colors.text.tertiary,
      fontSize: 13, // Reduced from 14
      marginTop: 3, // Reduced from 4
      letterSpacing: 0.3,
      lineHeight: 18,
    },
    testButtonsContainer: {
      marginTop: 12, // Reduced from 16
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
      borderRadius: 16,
      padding: 12,
      borderWidth: 0.5,
      borderColor: 'rgba(218, 165, 32, 0.1)',
    },
    testButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: SepiaColors.accent.gold,
      paddingHorizontal: 14, // Reduced from 16
      paddingVertical: 8, // Reduced from 10
      borderRadius: 20, // Reduced from 24
      alignSelf: 'center',
      minWidth: 180, // Reduced from 200
      marginVertical: 4, // Add spacing between buttons
      // Remove all shadow/elevation properties for clean look
    },
    testButtonText: {
      color: colors.text.inverse,
      fontSize: 14, // Reduced from 16
      fontWeight: '700', // Increased from bold
      marginLeft: 6, // Reduced from 8
      letterSpacing: 0.3,
    },
    languageOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12, // Reduced from 16
      paddingHorizontal: 16, // Reduced from 20
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
    },
    selectedLanguageOption: {
      backgroundColor: 'rgba(218, 165, 32, 0.1)', // Subtle gold highlight
    },
    languageName: {
      color: colors.text.primary,
      fontSize: 16, // Reduced from 18
      fontWeight: '600', // Increased from 500
      letterSpacing: 0.3,
    },
    updateLocationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: SepiaColors.accent.gold,
      paddingHorizontal: 14, // Reduced from 16
      paddingVertical: 8, // Reduced from 10
      borderRadius: 20, // Reduced from 24
      alignSelf: 'center',
      minWidth: 180, // Reduced from 200
      // Remove all shadow/elevation properties for clean look
      marginTop: 12, // Reduced from 16
    },
    updateLocationButtonText: {
      color: colors.text.inverse,
      fontSize: 14, // Reduced from 16
      fontWeight: '700', // Increased from bold
      marginLeft: 6, // Reduced from 8
      letterSpacing: 0.3,
    },
    // Fixed sound preference container with proper layout
    soundPreferenceContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12, // Reduced from 16
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
    },
    soundPrefTextContainer: {
      flex: 1,
      paddingRight: 12, // Reduced from 16
      backgroundColor: faintLayer, // Subtle background themed
      borderRadius: 12,
      padding: 8,
      marginRight: 8,
    },
  });
};
