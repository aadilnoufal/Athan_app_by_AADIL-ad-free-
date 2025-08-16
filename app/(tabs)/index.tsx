import React, { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  StatusBar, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  Easing,
  Modal,
  FlatList,
  AppState,
  Dimensions,
  Platform,
  GestureResponderEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Note: Using Expo's vector icons
import { format, addDays, differenceInSeconds } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { getAvailableRegions, getRegionConfig, DEFAULT_REGION } from '../config/prayerTimeConfig';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useLanguage } from '../../contexts/LanguageContext';
// Import prayer time utilities
import { applyTuningParameters, applyLocalDataCityAdjustments, extractCityIdFromRegionId } from '../../utils/prayerTimeTuner';
import { getPrayerTimesFromLocalData, hasLocalDataForDate } from '../../utils/localPrayerData';
import { SepiaColors } from '../../constants/sepiaColors';
// Import time utilities for improved timezone and countdown handling
import { 
  findNextPrayer, 
  calculateTimeRemaining, 
  convertTo12HourFormat,
  isSamePrayerTime 
} from '../../utils/timeUtils';
// Import Notifee prayer notification services (enterprise-grade reliability)
import { 
  initializeNotifeePrayerNotifications,
  updateNotifeePrayerNotifications,
  cancelAllNotifeePrayerNotifications,
  getScheduledNotifeePrayerNotifications,
  scheduleImmediateNotifeeNotification,
  scheduleNotifeeTestNotification,
  getNotifeeServiceStatus,
  requestExactAlarmPermission,
  debugNotifeeNotifications,
  checkAndHandleBatteryOptimization,
  checkAndHandlePowerManager
} from '../../utils/notifeePrayerService';
// Import background task utilities
import { 
  setupBackgroundTask,
  unregisterBackgroundTask,
  getBackgroundFetchStatus 
} from '../../utils/backgroundTask';

// Get screen dimensions to make components responsive
const { width: screenWidth } = Dimensions.get('window');
// Get status bar height to ensure proper padding
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

// Define interfaces for prayer data
interface PrayerTime {
  name: string;
  time: string;
  timeRaw: string;
  date: Date;
}

interface PrayerData {
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

interface NextPrayer {
  name: string;
  time: string;
  date: Date;
}

// Define interfaces for language and region items
interface LanguageItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface RegionItem {
  id: string;
  name: string;
  [key: string]: any;
}

// Define type for notification settings
interface NotificationSettings {
  Fajr: boolean;
  Sunrise: boolean;
  Dhuhr: boolean;
  Asr: boolean;
  Maghrib: boolean;
  Isha: boolean;
  [key: string]: boolean; // Add index signature for string keys
}

export default function Home() {
  const router = useRouter();
  const { t, currentLang, changeLanguage, availableLanguages } = useLanguage();
  
  // Add isFirstLoad state to track first launch
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  
  // Core state
  const [prayerTimes, setPrayerTimes] = useState<PrayerData | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState(0);
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null);
  const [countdown, setCountdown] = useState('');
  const [countdownLoading, setCountdownLoading] = useState(true);
  
  // Location and region settings
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [location, setLocation] = useState('');
  const [method, setMethod] = useState(0);
  const [tuningParams, setTuningParams] = useState('');
  const availableRegions = getAvailableRegions();
  
  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [regionChanging, setRegionChanging] = useState(false);
  
  // Progress tracking
  const [progressAnimation] = useState(new Animated.Value(0));
  const [progressPercent, setProgressPercent] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Date management
  const [lastRefreshDate, setLastRefreshDate] = useState('');
  const [lastDateCheckTime, setLastDateCheckTime] = useState(0);
  
  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    Fajr: true,
    Sunrise: false,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true
  });

  // Modal management
  const lastModalToggleTime = useRef(Date.now());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalLock = useRef(false);
  const toggleModal = (setter: Dispatch<SetStateAction<boolean>>): void => {
    if (modalLock.current) return;
    modalLock.current = true;
    setter(prev => !prev);
    setTimeout(() => {
      modalLock.current = false;
    }, 600);
  };

  // Enhanced notification setup and management
  const notificationInitialized = useRef(false);
  
  useEffect(() => {
    // Prevent multiple notification system initializations
    if (notificationInitialized.current) {
      return;
    }
    
    notificationInitialized.current = true;
    
    const initializeNotifications = async () => {
      // Initialize the Notifee notification service (enterprise-grade reliability)
      console.log('🔧 Initializing Notifee prayer notification system...');
      const initialized = await initializeNotifeePrayerNotifications();
      
      if (!initialized) {
        console.warn('Failed to initialize Notifee notifications - continuing without notifications');
        return;
      }
      
      // Request exact alarm permission for Android 12+
      await requestExactAlarmPermission();
      
      // Check and handle battery optimization (optional - don't block initialization)
      setTimeout(() => {
        checkAndHandleBatteryOptimization();
      }, 3000); // Delay to avoid overwhelming user with permission requests
      
      // Check and handle power manager (optional - don't block initialization)
      setTimeout(() => {
        checkAndHandlePowerManager();
      }, 6000); // Further delay to spread out permission requests
      
      // Check and update notification settings
      await checkNotificationSettings();
      
      // Setup background task for notification management
      const backgroundSetup = await setupBackgroundTask();
      if (!backgroundSetup) {
        console.warn('Background task setup failed - notifications may not work when app is closed');
      }
      
      // Check background fetch status
      const bgStatus = await getBackgroundFetchStatus();
      console.log('Background fetch status:', bgStatus.statusText);
    };
    
    initializeNotifications();
    
    const checkForSettingsChanges = async () => {
      try {
        const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
        const notifSettings = await AsyncStorage.getItem('notification_settings');
        
        if (notifEnabled !== null) {
          const isEnabled = notifEnabled === 'true';
          if (isEnabled !== notificationsEnabled) {
            setNotificationsEnabled(isEnabled);
            
            if (isEnabled && prayerTimes) {
              // If notifications were just enabled, clear timestamp and schedule them
              console.log('Notifications enabled, clearing timestamp and scheduling...');
              await AsyncStorage.removeItem('last_notification_scheduled');
              setTimeout(() => scheduleNotificationsForToday(), 1000);
            } else if (!isEnabled) {
              // If disabled, cancel all notifications
              console.log('Notifications disabled, cancelling all...');
              await Notifications.cancelAllScheduledNotificationsAsync();
              await unregisterBackgroundTask();
            }
          }
        }
        
        if (notifSettings !== null) {
          const parsed = JSON.parse(notifSettings);
          setNotificationSettings(prev => ({ ...prev, ...parsed }));
        }

        // Check for force reschedule flag from background task
        const forceReschedule = await AsyncStorage.getItem('force_notification_reschedule');
        if (forceReschedule === 'true' && notificationsEnabled && prayerTimes) {
          console.log('Background task requested notification reschedule');
          await AsyncStorage.removeItem('force_notification_reschedule');
          await AsyncStorage.removeItem('last_notification_scheduled'); // Clear timestamp
          setTimeout(() => scheduleNotificationsForToday(), 500);
        }
      } catch (error) {
        console.error('Error checking notification settings:', error);
      }
    };
    
    const settingsInterval = setInterval(checkForSettingsChanges, 10000);
    
    const notificationListener = async () => {
      const updateFlag = await AsyncStorage.getItem('notifications_updated');
      
      if (updateFlag) {
        await AsyncStorage.removeItem('notifications_updated');
        await AsyncStorage.removeItem('last_notification_scheduled'); // Clear timestamp for fresh scheduling
        await checkNotificationSettings();
        await scheduleNotificationsForToday();
      }

      // Check notification health
      if (notificationsEnabled && prayerTimes) {
        const status = await getScheduledNotifeePrayerNotifications();
        
        // If we have no scheduled notifications but should have them, reschedule
        if (status.length === 0) {
          const now = new Date();
          const hasRemainingPrayers = Object.entries(prayerTimes.times).some(([prayer, timeStr]) => {
            if (!timeStr || timeStr === '--:--') return false;
            
            const [hours, minutes] = timeStr.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes)) return false;
            
            const prayerDate = new Date();
            prayerDate.setHours(hours, minutes, 0, 0);
            return prayerDate > now && notificationSettings[prayer as keyof NotificationSettings];
          });
          
          if (hasRemainingPrayers) {
            console.log('Health check: Missing notifications, forcing reschedule...');
            // Clear the timestamp to allow immediate rescheduling
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
    }, 60000); // Check every 60 seconds to reduce frequency
    
    return () => {
      clearInterval(settingsInterval);
      clearInterval(flagsInterval);
    };
  }, []); // Remove dependency array to prevent re-initialization

  // Enhanced notification settings check with permission verification
  const checkNotificationSettings = async () => {
    try {
      console.log('🔍 ===== CHECKING NOTIFICATION SETTINGS =====');
      // Check notification permissions using Notifee service status instead of scheduled count
      const serviceStatus = await getNotifeeServiceStatus();
      console.log('🔍 Notifee service status check:', serviceStatus);
      
      // Check if permissions are actually granted (not just if notifications are scheduled)
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
        // Default to enabled if permission is granted but no setting exists
        console.log('📱 No notification setting found, defaulting to enabled');
        setNotificationsEnabled(true);
        await AsyncStorage.setItem('notifications_enabled', 'true');
      }
      
      if (notifSettings !== null) {
        setNotificationSettings(JSON.parse(notifSettings));
      } else {
        // Set default notification settings
        const defaultSettings = {
          Fajr: true,
          Sunrise: false,
          Dhuhr: true,
          Asr: true,
          Maghrib: true,
          Isha: true
        };
        setNotificationSettings(defaultSettings);
        await AsyncStorage.setItem('notification_settings', JSON.stringify(defaultSettings));
      }

      // Log notification status for debugging
      const debugStatus = await getScheduledNotifeePrayerNotifications();
      console.log(`Notifee notification settings loaded - Enabled: ${notifEnabled === 'true'}, Scheduled: ${debugStatus.length}`);
      
    } catch (error) {
      console.error('Error loading notification settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      
      // Only disable notifications if it's a permission-related error
      // Don't disable for background task or other unrelated errors
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        console.log('🚫 Disabling notifications due to permission error');
        setNotificationsEnabled(false);
      } else {
        console.log('⚠️ Non-critical error, keeping notifications enabled');
        // Still try to set default enabled state if permissions are available
        try {
          const notificationStatus = await getScheduledNotifeePrayerNotifications();
          // Assume permissions are granted if we can check scheduled notifications
          setNotificationsEnabled(true);
          await AsyncStorage.setItem('notifications_enabled', 'true');
        } catch (fallbackError) {
          console.error('Fallback permission check failed:', fallbackError);
          setNotificationsEnabled(false);
        }
      }
    }
  };

  // Add cooldown mechanism to prevent infinite scheduling loops
  const lastScheduleAttempt = useRef<number>(0);
  const SCHEDULE_COOLDOWN = 5000; // 5 seconds cooldown between scheduling attempts

  // Add global notification cooldown to prevent spam (CRITICAL FIX)
  const lastNotificationDelivered = useRef<number>(0);
  const NOTIFICATION_COOLDOWN = 60000; // 60 seconds cooldown between actual notifications

  const scheduleNotificationsForToday = async () => {
    try {
      // Implement cooldown to prevent infinite loops
      const now = Date.now();
      if (now - lastScheduleAttempt.current < SCHEDULE_COOLDOWN) {
        console.log(`⏱️ Schedule cooldown active, skipping (${SCHEDULE_COOLDOWN/1000}s cooldown)`);
        return;
      }
      lastScheduleAttempt.current = now;
      
      console.log(`🔄 ===== SCHEDULING NOTIFICATIONS FOR TODAY =====`);
      console.log(`🔄 notificationsEnabled: ${notificationsEnabled}`);
      console.log(`🔄 prayerTimes available: ${!!(prayerTimes && prayerTimes.times)}`);
      console.log(`🔄 notificationSettings:`, notificationSettings);
      
      // If notifications are disabled but service is working, check service status
      if (!notificationsEnabled) {
        console.log('🔍 Notifications disabled, checking if service is actually working...');
        try {
          const serviceStatus = await getNotifeeServiceStatus();
          if (serviceStatus && serviceStatus.permissionsGranted && serviceStatus.initialized) {
            console.log('✅ Service is working, enabling notifications and continuing...');
            setNotificationsEnabled(true);
            await AsyncStorage.setItem('notifications_enabled', 'true');
          } else {
            console.log('❌ Service not working, genuinely disabled');
            return;
          }
        } catch (error) {
          console.log('❌ Could not check service status, skipping scheduling');
          return;
        }
      }
      
      // Use the new improved notification system
      if (!prayerTimes || !prayerTimes.times) {
        console.log('❌ No prayer data available for scheduling notifications');
        return;
      }
      
      console.log('✅ All conditions met, calling updateNotifeePrayerNotifications...');
      // Pass notification settings to the scheduling function
      await updateNotifeePrayerNotifications(prayerTimes.times, notificationSettings);
      console.log('✅ Notifee notification system updated successfully');
      console.log('📋 Final notification settings used:', notificationSettings);
      
    } catch (error) {
      console.error('❌ Error with new notification system:', error);
    }
  };

  // Note: Individual prayer scheduling functions have been moved to 
  // the improved notification service for better reliability

  // Region configuration management
  const regionLoadingRef = useRef(false);
  
  useEffect(() => {
    // Prevent multiple region config loads
    if (regionLoadingRef.current) {
      return;
    }
    
    regionLoadingRef.current = true;
    loadRegionConfig().finally(() => {
      setTimeout(() => {
        regionLoadingRef.current = false;
      }, 1000); // Allow reload after 1 second
    });
  }, []);

  // Reload region config when screen becomes focused (e.g., returning from settings)
  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused, checking for region changes...');
      
      const checkForRegionChanges = async () => {
        try {
          const savedRegion = await AsyncStorage.getItem('selected_region');
          const regionToUse = savedRegion || DEFAULT_REGION;
          
          // Only reload if the region actually changed
          if (regionToUse !== regionId) {
            console.log(`Region changed from ${regionId} to ${regionToUse}, reloading...`);
            await loadRegionConfig();
          } else {
            console.log('No region change detected, skipping reload');
            // If already have prayer times and no region change, don't set loading
            if (prayerTimes) {
              setLoading(false);
            }
          }
        } catch (error) {
          console.error('Error checking for region changes:', error);
          // Fallback to current behavior if there's an error
          await loadRegionConfig();
        }
      };
      
      checkForRegionChanges();
      
      // Safety mechanism: if we're still loading after 5 seconds and have prayer times, stop loading
      const loadingTimeout = setTimeout(() => {
        if (loading && prayerTimes) {
          console.log('Safety timeout: stopping loading state when returning to home');
          setLoading(false);
        }
      }, 5000);
      
      return () => {
        clearTimeout(loadingTimeout);
      };
    }, [regionId, prayerTimes, loading])
  );
  
  const loadRegionConfig = async (): Promise<void> => {
    try {
      const savedRegion = await AsyncStorage.getItem('selected_region');
      const regionToUse = savedRegion || DEFAULT_REGION;
      
      console.log(`Loading region config for: ${regionToUse}`);
      
      const config = getRegionConfig(regionToUse);
      
      if (config) {
        console.log(`Setting region to: ${config.id}, location: ${config.location}`);
        
        // Always apply config on first load to ensure data is displayed
        if (isFirstLoad) {
          console.log('First load detected, applying region config and fetching data...');
          setRegionId(config.id);
          setLocation(config.location);
          setMethod(config.method);
          setTuningParams(config.tuningParams);
          setIsFirstLoad(false);
          
          // Set loading state for first load
          setPrayerTimes(null);
          setLoading(true);
          
          // Trigger an immediate fetch after setting the config
          setTimeout(() => {
            console.log('Triggering first data fetch...');
            fetchPrayerTimes().catch(err => {
              console.error('First fetch error:', err);
              setLoading(false);
            });
          }, 500);
          
          return;
        }
        
        // Regular flow for subsequent loads
        const regionChanged = config.id !== regionId || config.location !== location;
        
        if (regionChanged) {
          console.log('Region configuration changed, updating...');
          setRegionId(config.id);
          setLocation(config.location);
          setMethod(config.method);
          setTuningParams(config.tuningParams);
          
          // Clear prayer times to force refetch with new region
          setPrayerTimes(null);
          setLoading(true);
        } else {
          console.log('Region configuration unchanged, keeping current data');
          // Don't set loading if region hasn't changed
        }
      } else {
        const defaultConfig = getRegionConfig(DEFAULT_REGION);
        if (defaultConfig) {
          console.log('No config found, using default region');
          const regionChanged = DEFAULT_REGION !== regionId || defaultConfig.location !== location || isFirstLoad;
          
          if (regionChanged) {
            setRegionId(DEFAULT_REGION);
            setLocation(defaultConfig.location);
            setMethod(defaultConfig.method);
            setTuningParams(defaultConfig.tuningParams);
            
            // Clear prayer times to force refetch
            setPrayerTimes(null);
            setLoading(true);
            setIsFirstLoad(false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading region config:', error);
      const defaultConfig = getRegionConfig(DEFAULT_REGION);
      if (defaultConfig && (defaultConfig.id !== regionId || isFirstLoad)) {
        console.log('Error occurred, loading default region config');
        setRegionId(DEFAULT_REGION);
        setLocation(defaultConfig.location);
        setMethod(defaultConfig.method);
        setTuningParams(defaultConfig.tuningParams);
        setPrayerTimes(null);
        setLoading(true);
        setIsFirstLoad(false);
      }
    }
  };

  // Date change detection (optimized)
  const checkDayChange = () => {
    const now = Date.now();
    if (now - lastDateCheckTime < 60000) {
      return;
    }
    
    setLastDateCheckTime(now);
    
    const today = format(new Date(), 'yyyy-MM-dd');
    
    if (lastRefreshDate !== today) {
      setLastRefreshDate(today);
      
      if (lastRefreshDate !== '') {
        console.log('Auto-refreshing at new day');
        clearCache(false);
      } else {
        AsyncStorage.setItem('last_refresh_date', today);
      }
    }
  };
  
  const clearCache = async (showAlerts = true) => {
    try {
      setRefreshing(true);
      
      // Clear all cached data
      const keys = await AsyncStorage.getAllKeys();
      const prayerKeys = keys.filter(key => key.startsWith('prayer_'));
      
      if (prayerKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerKeys);
      }
      
      const today = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem('last_refresh_date', today);
      setLastRefreshDate(today);
      
      // Fetch fresh data (no cache)
      await fetchAndCachePrayerTimes();
      
      // Only reschedule notifications if they are enabled and we haven't scheduled recently
      if (notificationsEnabled) {
        const lastScheduled = await AsyncStorage.getItem('last_notification_scheduled');
        const now = Date.now();
        
        // Only reschedule if it's been more than 1 minute since last scheduling to prevent spam
        if (!lastScheduled || now - parseInt(lastScheduled) > 60000) {
          console.log('Refresh: Rescheduling notifications after cache clear');
          await scheduleNotificationsForToday();
        } else {
          console.log('Refresh: Skipping notification rescheduling - recently scheduled');
        }
      }
      
      if (showAlerts) {
        Alert.alert(
          t('cacheCleared'),
          'Fresh prayer times loaded',
          [{ text: t('ok') }]
        );
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      if (showAlerts) {
        Alert.alert(
          t('error'),
          t('failedCache'),
          [{ text: t('ok') }]
        );
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Initialize last refresh date on startup
  useEffect(() => {
    const getLastRefreshDate = async () => {
      try {
        const storedDate = await AsyncStorage.getItem('last_refresh_date');
        if (storedDate) {
          setLastRefreshDate(storedDate);
        }
        setLastDateCheckTime(Date.now());
      } catch (error) {
        console.error('Error getting last refresh date:', error);
      }
    };
    
    getLastRefreshDate();
  }, []);

  // Main effect for data fetching and timer management
  useEffect(() => {
    setProgressPercent(0);
    progressAnimation.setValue(0);
    setElapsedSeconds(0);
    
    if (location && method !== undefined && tuningParams !== undefined) {
      console.log(`Fetching prayer times for day +${currentDay}, location: ${location}`);
      
      // Using a more reliable way to fetch data with a retry mechanism for first load
      const fetchDataWithRetry = async () => {
        try {
          await fetchPrayerTimes();
        } catch (error) {
          console.error('Error in data fetch effect:', error);
          
          // If this is first load or we have no prayer times, try one more time after a delay
          if (!prayerTimes) {
            console.log('Retrying data fetch in 2 seconds...');
            setTimeout(() => {
              fetchPrayerTimes().catch(err => {
                console.error('Retry fetch error:', err);
                setLoading(false);
              });
            }, 2000);
          } else {
            setLoading(false);
          }
        }
      };
      
      fetchDataWithRetry();
    } else {
      // If we don't have location config yet, ensure we're not stuck loading
      setTimeout(() => {
        if (loading && (!location || method === undefined || tuningParams === undefined)) {
          console.log('Configuration incomplete, stopping loading state');
          
          // If we're still in first load but have no config, force default config
          if (isFirstLoad) {
            console.log('First load with incomplete config, forcing default config...');
            const defaultConfig = getRegionConfig(DEFAULT_REGION);
            if (defaultConfig) {
              setRegionId(DEFAULT_REGION);
              setLocation(defaultConfig.location);
              setMethod(defaultConfig.method);
              setTuningParams(defaultConfig.tuningParams);
              setIsFirstLoad(false);
              return; // This will trigger the effect again with proper config
            }
          }
          
          setLoading(false);
        }
      }, 3000);
    }
    
    const countdownTimer = setInterval(() => {
      updateCountdown();
    }, 1000);
    
    const dateCheckTimer = setInterval(() => {
      checkDayChange();
    }, 60000);
    
    return () => {
      clearInterval(countdownTimer);
      clearInterval(dateCheckTimer);
    };
  }, [currentDay, lastRefreshDate, location, method, tuningParams, isFirstLoad]);
  
  // Prayer times fetching - NO CACHE, ALWAYS FRESH
  const fetchPrayerTimes = async () => {
    try {
      setLoading(true);
      console.log('Always fetching fresh data - no cache used');
      
      // Add a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000); // 15 second timeout
      });
      
      // Check if this is first load and add extra logging
      if (isFirstLoad || !prayerTimes) {
        console.log('Fetching prayer times for first load or after no data...');
      }
      
      await Promise.race([fetchAndCachePrayerTimes(), timeoutPromise]);
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      
      // If we have existing prayer times and this is just a refresh, keep the old data
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (prayerTimes && errorMessage !== 'Request timeout') {
        console.log('Keeping existing prayer times due to fetch error');
        setLoading(false);
        return;
      }
      
      // Create fallback data if this is first load or we have no prayer times
      if (isFirstLoad || !prayerTimes) {
        console.log('Error on first load, creating fallback data');
        const today = new Date();
        const fallbackTimes = {
          date: format(today, 'dd MMM yyyy'),
          hijriDate: 'Unknown',
          hijriMonth: 'Unknown',
          gregorianDate: format(today, 'dd-MM-yyyy'),
          times: {
            Fajr: '--:--',
            Sunrise: '--:--',
            Dhuhr: '--:--',
            Asr: '--:--',
            Maghrib: '--:--',
            Isha: '--:--'
          },
          times12h: {
            Fajr: '--:--',
            Sunrise: '--:--',
            Dhuhr: '--:--',
            Asr: '--:--',
            Maghrib: '--:--',
            Isha: '--:--'
          }
        };
        setPrayerTimes(fallbackTimes);
        setIsFirstLoad(false);
      }
      
      Alert.alert(
        t('connectionError'),
        t('connectionErrorMessage'),
        [{ text: t('ok') }]
      );
      setLoading(false);
    }
  };
  
  // Convert 24h to 12h format
  const convertTo12HourFormat = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Fetch prayer times - NO CACHING, ALWAYS FRESH
  const fetchAndCachePrayerTimes = async (retryCount = 0) => {
    try {
      const fetchDate = addDays(new Date(), currentDay);
      const formattedDate = format(fetchDate, 'dd-MM-yyyy');
      const fetchYear = fetchDate.getFullYear();
      
      console.log(`Fetching FRESH prayer times for ${formattedDate}, location: ${location}`);
      
      if (fetchYear === 2025) {
        // Use local CSV data for 2025
        const localData = getPrayerTimesFromLocalData(fetchDate) as PrayerData | null;
        
        if (localData) {
          console.log(`Using local CSV prayer time data for ${formattedDate}`);
          
          const cityId = extractCityIdFromRegionId(regionId);
          console.log(`Applying local data adjustments for city: ${cityId}`);
          
          let timings = { ...localData.times } as any;
          timings = applyLocalDataCityAdjustments(timings, cityId, true);
          
          const formattedTimes: PrayerData = {
            date: localData.date,
            hijriDate: localData.hijriDate,
            hijriMonth: localData.hijriMonth,
            gregorianDate: localData.gregorianDate,
            times: timings,
            times12h: {
              Fajr: convertTo12HourFormat(timings.Fajr),
              Sunrise: convertTo12HourFormat(timings.Sunrise),
              Dhuhr: convertTo12HourFormat(timings.Dhuhr),
              Asr: convertTo12HourFormat(timings.Asr),
              Maghrib: convertTo12HourFormat(timings.Maghrib),
              Isha: convertTo12HourFormat(timings.Isha)
            }
          };
          
          // NO CACHING - Just set the data directly
          setPrayerTimes(formattedTimes); 
          updateNextPrayer(formattedTimes); 
          setLoading(false);
          
          if (currentDay === 0 && notificationsEnabled) {
            setTimeout(async () => {
              console.log('Clearing old notifications and scheduling fresh ones for updated prayer times');
              await AsyncStorage.removeItem('last_notification_scheduled');
              await scheduleNotificationsForToday();
            }, 1000);
          }
          return;
        } else {
          console.log(`No local CSV data available for ${formattedDate} (2025)`);
          Alert.alert(
            'Data Not Available',
            `Prayer time data for ${formattedDate} is not available in local database.`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
      } else if (fetchYear >= 2026) {
        // Use API for 2026 and beyond
        console.log(`Using API for year ${fetchYear}`);
        
        const apiUrl = `https://api.aladhan.com/v1/timingsByAddress/${formattedDate}?address=${location}&method=${method}`;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        let timings = data.data.timings;
        const date = data.data.date;
        
        timings = applyTuningParameters(timings, tuningParams);
        
        const formattedTimes = {
          date: date.readable,
          hijriDate: date.hijri.date,
          hijriMonth: date.hijri.month.en,
          gregorianDate: date.gregorian.date,
          times: {
            Fajr: timings.Fajr,
            Sunrise: timings.Sunrise,
            Dhuhr: timings.Dhuhr,
            Asr: timings.Asr,
            Maghrib: timings.Maghrib,
            Isha: timings.Isha
          },
          times12h: {
            Fajr: convertTo12HourFormat(timings.Fajr),
            Sunrise: convertTo12HourFormat(timings.Sunrise),
            Dhuhr: convertTo12HourFormat(timings.Dhuhr),
            Asr: convertTo12HourFormat(timings.Asr),
            Maghrib: convertTo12HourFormat(timings.Maghrib),
            Isha: convertTo12HourFormat(timings.Isha)
          }
        };
        
        // NO CACHING - Just set the data directly
        setPrayerTimes(formattedTimes); 
        updateNextPrayer(formattedTimes); 
        setLoading(false);
        
        if (currentDay === 0 && notificationsEnabled) {
          setTimeout(async () => {
            console.log('Clearing old notifications and scheduling fresh ones for updated prayer times');
            await AsyncStorage.removeItem('last_notification_scheduled');
            await scheduleNotificationsForToday();
          }, 1000);
        }
      } else {
        console.log(`Year ${fetchYear} is not supported`);
        Alert.alert(
          'Year Not Supported',
          `Prayer times for year ${fetchYear} are not available. Please check your device date.`,
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      
      if (retryCount < 3) {
        console.log(`Retrying prayer time fetch (attempt ${retryCount + 1} of 3)...`);
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          fetchAndCachePrayerTimes(retryCount + 1);
        }, delay);
        return;
      }
      
      // Fallback for any day when all retries fail
      console.log('Creating fallback prayer times data after all retries failed');
      const today = addDays(new Date(), currentDay);
      const fallbackTimes = {
        date: format(today, 'dd MMM yyyy'),
        hijriDate: 'Unknown',
        hijriMonth: 'Unknown',
        gregorianDate: format(today, 'dd-MM-yyyy'),
        times: {
          Fajr: '--:--',
          Sunrise: '--:--',
          Dhuhr: '--:--',
          Asr: '--:--',
          Maghrib: '--:--',
          Isha: '--:--'
        },
        times12h: {
          Fajr: '--:--',
          Sunrise: '--:--',
          Dhuhr: '--:--',
          Asr: '--:--',
          Maghrib: '--:--',
          Isha: '--:--'
        }
      };
      
      // Always set fallback data to prevent blank screen
      setPrayerTimes(fallbackTimes);
      
      // If this was the first load, mark it as complete
      if (isFirstLoad) {
        setIsFirstLoad(false);
      }
      
      setLoading(false);
    }
  };

  // Prayer Time Monitoring System - Automatically detects when prayer times arrive
  const lastTriggeredPrayer = useRef<string | null>(null);
  
  useEffect(() => {
    if (!prayerTimes || !prayerTimes.times || !nextPrayer) return;
    
    let prayerMonitorTimer: NodeJS.Timeout | null = null;
    
    const checkPrayerTimeArrival = async () => {
      const now = new Date();
      const prayerTime = new Date(nextPrayer.date);
      
      // Only check for today's prayers (currentDay === 0)
      if (currentDay !== 0) return;
      
      // Create a unique key for this prayer time to prevent duplicate triggers
      const prayerKey = `${nextPrayer.name}-${prayerTime.getTime()}`;
      
      // Check if we already processed this prayer time
      if (lastTriggeredPrayer.current === prayerKey) {
        return;
      }
      
      // Check if prayer time has passed (with 10 second buffer to catch it quickly)
      const timeDiff = now.getTime() - prayerTime.getTime();
      const tenSeconds = 10 * 1000;
      
      if (timeDiff >= -tenSeconds) { // Changed to -10 seconds to catch slightly early
        console.log(`🕌 Prayer Time Detected: ${nextPrayer.name} at ${nextPrayer.time} (${Math.floor(timeDiff / 1000)}s ${timeDiff < 0 ? 'before' : 'after'})`);
        
        // Mark this prayer as processed to prevent loops - do this FIRST
        lastTriggeredPrayer.current = prayerKey;
        
        // IMMEDIATELY stop the monitoring timer to prevent duplicate triggers
        if (prayerMonitorTimer) {
          clearInterval(prayerMonitorTimer);
          prayerMonitorTimer = null;
          console.log('⛔ Stopped prayer monitoring to prevent notification spam');
        }
        
        // Deliver immediate notification for this prayer (DISABLED - Notifee scheduled handles this)
        if (notificationsEnabled && notificationSettings[nextPrayer.name]) {
          console.log(`📨 Prayer time arrived: ${nextPrayer.name} - Notifee scheduled notification will handle this`);
          console.log(`🚫 Skipping immediate notification to prevent duplicates with scheduled notifications`);
          // Disabled to prevent duplicate notifications:
          // const result = await scheduleImmediateNotifeeNotification(nextPrayer.name);
        }
        
        // Auto-trigger prayer time actions immediately
        console.log('🔄 Updating prayer times due to prayer time arrival...');
        
        // Clear notification timestamp to force rescheduling
        await AsyncStorage.removeItem('last_notification_scheduled');
        
        // Immediately update to next prayer to fix countdown stuck at 00:00:00
        if (prayerTimes) {
          console.log('⏱️ Immediately updating next prayer to fix countdown');
          updateNextPrayer(prayerTimes);
        }
        
        // Fetch fresh prayer times (this should advance to next prayer)
        console.log('🔄 Fetching fresh prayer times after prayer time arrival');
        await fetchPrayerTimes(); // This will update the next prayer
        
        // Wait briefly for data to update and next prayer to advance
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force update next prayer calculation to ensure it advances
        if (prayerTimes) {
          console.log('🔄 Force advancing to next prayer after current one passed');
          updateNextPrayer(prayerTimes);
        }
        
        // Reschedule notifications after data is updated (force reschedule)
        console.log('📅 Prayer monitoring: Forcing notification reschedule after prayer time passed');
        await AsyncStorage.removeItem('last_notification_scheduled');
        await scheduleNotificationsForToday();
        
        // Final update to ensure everything is in sync
        if (prayerTimes) {
          console.log('✅ Final update: Ensuring next prayer is properly set');
          updateNextPrayer(prayerTimes);
        }
        
        // Only restart monitoring after 30 seconds and if next prayer actually changed
        setTimeout(() => {
          if (!prayerMonitorTimer) {
            const newNextPrayer = nextPrayer;
            // Only restart monitoring if we successfully advanced to next prayer
            if (newNextPrayer && newNextPrayer.name !== prayerKey.split('-')[0]) {
              console.log('🔄 Restarting prayer time monitoring for next prayer:', newNextPrayer.name);
              prayerMonitorTimer = setInterval(() => {
                checkPrayerTimeArrival();
              }, 15000);
            } else {
              console.log('⚠️ Next prayer did not advance, waiting longer before restart');
              // Try again after more time if prayer didn't advance
              setTimeout(() => {
                if (!prayerMonitorTimer && prayerTimes) {
                  updateNextPrayer(prayerTimes);
                  prayerMonitorTimer = setInterval(() => {
                    checkPrayerTimeArrival();
                  }, 15000);
                }
              }, 30000);
            }
          }
        }, 30000); // Wait 30 seconds before restarting monitoring
      }
    };
    
    // Check every 15 seconds for prayer time arrival (increased frequency)
    prayerMonitorTimer = setInterval(() => {
      checkPrayerTimeArrival();
    }, 15000);
    
    // Also check immediately (but only once per prayer)
    checkPrayerTimeArrival();
    
    return () => {
      if (prayerMonitorTimer) {
        clearInterval(prayerMonitorTimer);
      }
    };
  }, [nextPrayer, prayerTimes, currentDay]);

  // Pre-fetch disabled - No caching system active
  const prefetchDay = async (dayOffset: number): Promise<void> => {
    // Prefetching disabled since we removed caching completely
    console.log(`Prefetching disabled for day ${dayOffset} - no cache system active`);
    return;
  };

  // Simplified and improved next prayer calculation
  const updateNextPrayer = (data: PrayerData): void => {
    if (!data || !data.times) {
      console.log('⚠️ updateNextPrayer: No prayer data available');
      return;
    }
    
    console.log('🔄 Calculating next prayer time...');
    
    // Use the improved utility function
    const next = findNextPrayer(data.times, data.times12h, currentDay) as NextPrayer | null;
    
    if (next) {
      // Only update if the prayer is actually different (prevents unnecessary re-renders)
      const isDifferent = !nextPrayer || 
        nextPrayer.name !== next.name || 
        !isSamePrayerTime(nextPrayer.date, next.date);
      
      if (isDifferent) {
        console.log(`🔄 Next prayer updated: ${next.name} at ${next.time}`);
        setNextPrayer(next);
        
        // Reset countdown when prayer changes to fix stuck countdown
        setCountdown('');
        setCountdownLoading(true);
        
        console.log(`🔄 Prayer changed from ${nextPrayer?.name || 'none'} to ${next.name} - countdown reset`);
      } else {
        console.log(`⏱️ Next prayer unchanged: ${next.name} at ${next.time}`);
      }
    } else {
      console.log('⚠️ Could not determine next prayer time');
    }
  };

  // Update countdown timer to next prayer
  const lastCountdownLog = useRef<string>('');
  const countdownTriggeredRefresh = useRef<string>('');
  const safetyMechanismTriggered = useRef<string>('');
  
  const updateCountdown = useCallback(() => {
    if (!nextPrayer) return;
    
    const now = new Date();
    const prayerTime = new Date(nextPrayer.date);
    
    const diffSeconds = Math.max(0, differenceInSeconds(prayerTime, now));
    
    if (diffSeconds <= 0) {
      // Prayer time has passed! 
      
      // Only log this once per prayer to prevent spam
      const logKey = `${nextPrayer.name}-passed`;
      if (lastCountdownLog.current !== logKey) {
        console.log(`⏰ Countdown: ${nextPrayer.name} prayer time has passed`);
        lastCountdownLog.current = logKey;
      }
      
      // If prayer monitoring hasn't caught this yet, trigger a refresh after a short delay
      const refreshKey = `${nextPrayer.name}-${prayerTime.getTime()}`;
      if (countdownTriggeredRefresh.current !== refreshKey && currentDay === 0) {
        countdownTriggeredRefresh.current = refreshKey;
        console.log('⏰ Countdown triggered prayer time refresh (backup system)');
        
        // Special handling for Isha prayer - transition to tomorrow's Fajr
        if (nextPrayer.name === 'Isha' && prayerTimes && prayerTimes.times['Fajr']) {
          console.log('🌙 Last prayer of the day (Isha) detected, transitioning to Fajr tomorrow');
          const fajrTimeStr = prayerTimes.times['Fajr'];
          if (fajrTimeStr && fajrTimeStr !== '--:--') {
            const [hour, minute] = fajrTimeStr.split(':').map(Number);
            if (!isNaN(hour) && !isNaN(minute)) {
              const fajrDate = new Date();
              fajrDate.setDate(fajrDate.getDate() + 1);
              fajrDate.setHours(hour, minute, 0, 0);
              
              // Reset all tracking variables first to ensure clean transition
              countdownTriggeredRefresh.current = '';
              lastTriggeredPrayer.current = null;
              safetyMechanismTriggered.current = '';
              
              // Set next prayer to tomorrow's Fajr
              console.log(`🌅 Setting next prayer to Fajr (Tomorrow) at ${hour}:${minute.toString().padStart(2, '0')}`);
              setNextPrayer({
                name: 'Fajr (Tomorrow)',
                time: prayerTimes.times12h ? prayerTimes.times12h['Fajr'] : convertTo12HourFormat(fajrTimeStr),
                date: fajrDate
              });
              
              // Reset countdown to force refresh
              setCountdown('');
              
              // Force a fresh data fetch to ensure we have tomorrow's data
              setTimeout(() => {
                console.log('Fetching fresh data for tomorrow');
                // We'll stay on currentDay=0 but with updated nextPrayer
                fetchPrayerTimes();
              }, 2000);
              
              console.log('✅ Successfully transitioned to Fajr (Tomorrow) after Isha');
              return;
            }
          }
        }
        
        // Backup notification system disabled to prevent spam - main system will handle notifications
        console.log(`�️ Backup system: Notification handled by main system to prevent spam`);
        // The main prayer monitoring system above already sent notification, no backup needed
        
        // Clear notification timestamp for backup system too
        setTimeout(async () => {
          await AsyncStorage.removeItem('last_notification_scheduled');
          
          // Immediately update next prayer from backup system too
          if (prayerTimes) {
            console.log('Backup system: Immediately updating next prayer to fix countdown');
            updateNextPrayer(prayerTimes);
          }
          
          fetchPrayerTimes();
          
          // Also reschedule notifications after backup refresh
          setTimeout(async () => {
            console.log('Countdown backup: Notification rescheduling disabled to prevent duplicates');
            // Disabled: await scheduleNotificationsForToday();
            // The main prayer monitoring system already handles notifications
          }, 1000);
        }, 5000); // Give prayer monitoring system time to catch it first
      }
      
      // Show that time has passed but try to update if we have prayer times
      setCountdown('00:00:00');
      
      // Enhanced safety mechanism: If countdown is stuck at 00:00:00, force a complete system reset
      // Generate a unique key with timestamp to prevent multiple triggers in succession
      const safetyKey = `safety-${nextPrayer.name}-${Date.now()}`;
      if (prayerTimes && countdown === '00:00:00' && safetyMechanismTriggered.current !== safetyKey) {
        // Mark this safety operation as in progress
        safetyMechanismTriggered.current = safetyKey;
        console.log(`🔄 Safety mechanism triggered once for: ${nextPrayer.name}`);
        
        // Execute a comprehensive recovery sequence
        setTimeout(async () => {
          console.log('🔄 Safety mechanism: Complete prayer system reset in progress');
          
          // 1. Reset tracking variables to force fresh state
          lastTriggeredPrayer.current = null;
          countdownTriggeredRefresh.current = '';
          
          // 2. Force next prayer update
          updateNextPrayer(prayerTimes);
          
          // 3. Force notification reschedule
          await AsyncStorage.removeItem('last_notification_scheduled');
          
          // 4. Perform a complete fresh data fetch
          await fetchPrayerTimes();
          
          // 5. Reschedule notifications with fresh data (only if truly stuck, not during normal prayer transitions)
          if (notificationsEnabled && countdown === '00:00:00') {
            console.log('🔄 Safety mechanism: Rescheduling notifications due to stuck countdown');
            await scheduleNotificationsForToday();
          } else {
            console.log('🔄 Safety mechanism: Skipping notification reschedule during normal prayer transition');
          }
          
          console.log('✅ Safety mechanism: System reset complete');
          
          // Reset the safety flag after 30 seconds to prevent rapid retriggering
          // but allow future safety mechanisms if truly needed
          setTimeout(() => {
            if (safetyMechanismTriggered.current === safetyKey) {
              safetyMechanismTriggered.current = '';
              console.log('🔓 Safety mechanism unlocked for future use if needed');
            }
          }, 30000);
        }, 3000);
      }
      
      return;
    }
    
    // Reset log key when prayer is active
    const activeLogKey = `${nextPrayer.name}-active`;
    if (lastCountdownLog.current !== activeLogKey) {
      lastCountdownLog.current = activeLogKey;
    }
    
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    const timeDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Only update countdown if it's actually different (prevents glitching)
    if (countdown !== timeDisplay) {
      setCountdown(timeDisplay);
    }
    
    // Only show progress when less than 1 hour (3600 seconds) remains
    const oneHourInSeconds = 3600;
    
    if (diffSeconds <= oneHourInSeconds) {
      // Calculate progress for the last hour
      const elapsedInLastHour = oneHourInSeconds - diffSeconds;
      const progress = Math.max(0, Math.min(1, elapsedInLastHour / oneHourInSeconds));
      
      // Only update progress if significantly different (prevents micro-updates)
      if (Math.abs(progress - progressPercent) > 0.01) {
        setProgressPercent(progress);
        setTotalSeconds(oneHourInSeconds);
        setElapsedSeconds(elapsedInLastHour);
        
        Animated.timing(progressAnimation, {
          toValue: progress,
          duration: 300,
          useNativeDriver: false,
          easing: Easing.out(Easing.ease)
        }).start();
      }
    } else {
      // Reset progress when more than 1 hour remains
      if (progressPercent !== 0) {
        setProgressPercent(0);
        setTotalSeconds(0);
        setElapsedSeconds(0);
        progressAnimation.setValue(0);
      }
    }
  }, [nextPrayer, currentDay, progressPercent, countdown]);
  
  // Timer management for countdown
  useEffect(() => {
    let countdownTimer: NodeJS.Timeout | null = null;
    
    if (nextPrayer) {
      updateCountdown();
      countdownTimer = setInterval(updateCountdown, 1000);
    }
    
    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [updateCountdown, nextPrayer]);

  // Reset progress when next prayer changes (improved stability)
  useEffect(() => {
    if (nextPrayer) {
      // Only show loading very briefly to prevent glitching
      setCountdownLoading(true);
      
      // Shorter timeout to reduce glitching
      const resetTimeout = setTimeout(() => {
        // Reset progress animation to 0 when prayer changes
        progressAnimation.setValue(0);
        setProgressPercent(0);
        setCountdownLoading(false);
      }, 150); // Reduced to 150ms for faster response
      
      return () => clearTimeout(resetTimeout);
    }
  }, [nextPrayer]);

  // Animated circular progress component
  const AnimatedCircularProgress = ({ 
    progress, 
    size, 
    strokeWidth 
  }: { 
    progress: number, 
    size: number, 
    strokeWidth: number 
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    
    const animatedStrokeDashoffset = progressAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [circumference, 0],
      extrapolate: 'clamp'
    });
    
    const AnimatedCircle = Animated.createAnimatedComponent(Circle);
    
    // Check if we should show progress (less than 1 hour remaining)
    const shouldShowProgress = nextPrayer && 
      differenceInSeconds(new Date(nextPrayer.date), new Date()) <= 3600;
    
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            stroke="#333333"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          
          {shouldShowProgress && (
            <AnimatedCircle
              stroke={SepiaColors.accent.gold}
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={animatedStrokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${size/2}, ${size/2}`}
            />
          )}
        </Svg>
        
        <View style={styles.progressCenter}>
          {nextPrayer && (
            <>
              <Text style={styles.nextPrayerText}>
                Next: {nextPrayer.name}
              </Text>
              <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
              {countdownLoading ? (
                <View style={styles.countdownLoading}>
                  <ActivityIndicator size="small" color={SepiaColors.accent.gold} />
                  <Text style={styles.countdownLoadingText}>Calculating...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.countdownText}>{countdown}</Text>
                  {shouldShowProgress && (
                    <Text style={styles.progressIndicatorText}>Final Hour</Text>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  // Day navigation functions
  const goToPreviousDay = () => {
    if (currentDay > 0) {
      const newDay = currentDay - 1;
      setCurrentDay(newDay);
      
      if (newDay === 0) {
        setCurrentDate(new Date());
      } else {
        setCurrentDate(prevDate => addDays(prevDate, -1));
      }
      
      setNextPrayer(null);
      setCountdown('');
      
      console.log(`Moving to day +${newDay}`);
    }
  };
  
  const goToNextDay = () => {
    if (currentDay < 9) {
      const newDay = currentDay + 1;
      setCurrentDay(newDay);
      
      setCurrentDate(prevDate => addDays(prevDate, 1));
      
      setNextPrayer(null);
      setCountdown('');
      
      console.log(`Moving to day +${newDay}`);
    }
  };
  
  // Language functions
  const toggleLanguageSelector = () => {
    setShowLanguageSelector(!showLanguageSelector);
  };
  
  const selectLanguage = async (langId: string): Promise<void> => {
    await changeLanguage(langId);
    setShowLanguageSelector(false);
  };
  
  // Language selector component
  const LanguageSelector = () => (
    <Modal
      transparent={true}
      visible={showLanguageSelector}
      animationType="fade"
      onRequestClose={() => setShowLanguageSelector(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('language')}</Text>
            <TouchableOpacity onPress={() => setShowLanguageSelector(false)}>
              <MaterialCommunityIcons name="close" size={24} color={SepiaColors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={Object.values(availableLanguages) as LanguageItem[]}
            keyExtractor={(item: LanguageItem) => item.id}
            renderItem={({ item }: { item: LanguageItem }) => (
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  currentLang === item.id && styles.selectedLanguageItem
                ]}
                onPress={() => selectLanguage(item.id)}
              >
                <Text style={[
                  styles.languageName,
                  currentLang === item.id && styles.selectedLanguageName
                ]}>
                  {item.name}
                </Text>
                {currentLang === item.id && (
                  <MaterialCommunityIcons name="check" size={20} color={SepiaColors.accent.gold} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  // Donation dialog
  const openDonation = () => {
    Alert.alert(
      t('supportTitle'),
      t('supportMessage'),
      [
        { text: t('maybeLater'), style: 'cancel' },
        { 
          text: t('oneTimeSupport'), 
          onPress: () => {
            Linking.openURL('https://nas.io/checkout-global?communityId=640f2dbae2d22dff16a554d9&communityCode=AADIL_NOUFAL&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fportal%2Fproducts%2F67e825d377e3fc39a8ba9b0d%3Ftab%3Dcontent&sourceInfoType=folder&sourceInfoOrigin=67e825d377e3fc39a8ba9b0d').catch(err => 
              console.error('An error occurred while opening the link:', err)
            );
          } 
        },
        { 
          text: t('monthlySupport'), 
          onPress: () => {
            Linking.openURL('https://nas.io/checkout-global?communityId=67e828db202755d3615d3a6b&communityCode=AD_FREE_ATHAN&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fcheckout-widget%3FcommunityCode%3DAD_FREE_ATHAN%26communitySlug%3D%252Fad-free-athan%26buttonText%3DJoin%2520as%2520member%26buttonTextColorHex%3D%2523000%26buttonBgColorHex%3D%2523fccb1d%26widgetTheme%3Dlight%26backgroundColorHex%3D%2523fff%2522%2520width%3D%2522100%25%2522%2520height%3D%2522320%2522%2520frameborder%3D%25220%2522%2520referrerpolicy%3D%2522no-referrer&fromWidget=1').catch(err => 
              console.error('An error occurred while opening the link:', err)
            );
          } 
        }
      ]
    );
  };
  
  // Region selector component
  const RegionPicker = () => (
    <Modal
      transparent={true}
      visible={showRegionPicker}
      animationType="fade"
      onRequestClose={() => toggleModal(setShowRegionPicker)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Region</Text>
            <TouchableOpacity onPress={() => toggleModal(setShowRegionPicker)}>
              <MaterialCommunityIcons name="close" size={24} color={SepiaColors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={availableRegions as RegionItem[]}
            keyExtractor={(item: RegionItem) => item.id}
            renderItem={({ item }: { item: RegionItem }) => (
              <TouchableOpacity
                style={[
                  styles.regionItem,
                  regionId === item.id && styles.selectedRegionItem
                ]}
                onPress={() => changeRegion(item.id)}
              >
                <Text style={[
                  styles.regionName,
                  regionId === item.id && styles.selectedRegionName
                ]}>
                  {item.name}
                </Text>
                {regionId === item.id && (
                  <MaterialCommunityIcons name="check" size={20} color={SepiaColors.accent.gold} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  // Ensure the current date matches the system date when app is opened
  const checkAndUpdateDate = () => {
    if (currentDay === 0) {
      const systemDate = new Date();
      // Compare dates by converting to date strings (ignoring time)
      const systemDateStr = format(systemDate, 'yyyy-MM-dd');
      const appDateStr = format(currentDate, 'yyyy-MM-dd');
      
      if (systemDateStr !== appDateStr) {
        console.log('App date does not match system date, updating...');
        setCurrentDate(systemDate);
        // Force refresh prayer times for the new date
        setLastRefreshDate(''); // This will trigger a data refresh
        
        // Reset to today's view
        setCurrentDay(0);
         
        // If notifications are enabled, reschedule them for the new date
        if (notificationsEnabled) {
          setTimeout(() => {
            scheduleNotificationsForToday();
          }, 3000); // Give some time for data to be fetched
        }
      }
    }
  };

  const changeRegion = async (newRegionId: string): Promise<void> => {
    try {
      console.log(`Changing region from ${regionId} to ${newRegionId}`);
      
      // Set loading states
      setRegionChanging(true);
      setLoading(true);
      
      // Save the new region first
      await AsyncStorage.setItem('selected_region', newRegionId);
      
      // Get config for new region
      const config = getRegionConfig(newRegionId);
      if (!config) {
        throw new Error('Invalid region configuration');
      }
      
      console.log(`New location config: ${config.location}`);
      
      // Clear ALL cached data (just in case some exists)
      console.log('Clearing any existing cached data...');
      const keys = await AsyncStorage.getAllKeys();
      const prayerKeys = keys.filter(key => key.startsWith('prayer_'));
      if (prayerKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerKeys);
        console.log(`Removed ${prayerKeys.length} cached prayer entries`);
      }
      
      // Reset prayer states
      setPrayerTimes(null);
      setNextPrayer(null);
      setCountdown('');
      
      // Update state with new location config
      setRegionId(newRegionId);
      setLocation(config.location);
      setMethod(config.method);
      setTuningParams(config.tuningParams);
      
      // Close the modal
      toggleModal(setShowRegionPicker);
      
      // Force immediate fresh data fetch for new location
      console.log('Fetching FRESH data for new region (no cache)...');
      await fetchAndCachePrayerTimes();
      
      // Schedule notifications after successful data fetch
      if (notificationsEnabled && currentDay === 0) {
        setTimeout(() => {
          scheduleNotificationsForToday();
        }, 1000);
      }
      
      console.log('Region change completed successfully');
    } catch (error) {
      console.error('Error changing region:', error);
      Alert.alert('Error', 'Failed to change region. Please try again.');
    } finally {
      setLoading(false);
      setRegionChanging(false);
    }
  };

  // Date synchronization with system
  useEffect(() => {
    const forceCurrentDateRefresh = () => {
      const now = new Date();
      console.log('Performing date check on app start/resume');
      console.log(`System date: ${format(now, 'yyyy-MM-dd')}`);
      console.log(`App date: ${format(currentDate, 'yyyy-MM-dd')}`);
      
      if (currentDay === 0) {
        const systemDateStr = format(now, 'yyyy-MM-dd');
        const appDateStr = format(currentDate, 'yyyy-MM-dd');
        
        if (systemDateStr !== appDateStr) {
          console.log('Date changed while app was running');
          forceCurrentDateRefresh();
        }
      }
    };

    forceCurrentDateRefresh();
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App resumed from background, checking date');
        forceCurrentDateRefresh();
      }
      setAppState(nextAppState);
    });
    
    const minuteTimer = setInterval(() => {
      if (currentDay === 0) {
        const now = new Date();
        const systemDateStr = format(now, 'yyyy-MM-dd');
        const appDateStr = format(currentDate, 'yyyy-MM-dd');
        
        if (systemDateStr !== appDateStr) {
          console.log('Date changed while app was running');
          forceCurrentDateRefresh();
        }
      }
    }, 60000);
    
    return () => {
      subscription.remove();
      clearInterval(minuteTimer);
    };
  }, []);

  useEffect(() => {
    checkDayChange();
  }, [currentDate, notificationsEnabled, currentDay]);

  // Enhanced debug function to check notification status with comprehensive Notifee debugging
  const debugNotifications = async () => {
    try {
      console.log('🔍 STARTING COMPREHENSIVE NOTIFEE DEBUG...');
      
      // Use the comprehensive debugging function
      const debugResult = await debugNotifeeNotifications();
      const bgStatus = await getBackgroundFetchStatus();
      
      if (debugResult.error) {
        Alert.alert('Debug Error', debugResult.error);
        return;
      }
      
      const { status, debugInfo, recommendations } = debugResult;
      
      // Add background task info
      let fullDebugInfo = debugInfo;
      fullDebugInfo += `\n🔄 Background Task: ${bgStatus.statusText}\n`;
      fullDebugInfo += `📍 Background Status: ${bgStatus.status}\n`;
      
      // Add current time info
      const now = new Date();
      const currentTimeStr = now.toLocaleTimeString();
      fullDebugInfo += `\n⏰ Current Time: ${currentTimeStr}\n`;
      fullDebugInfo += `🔔 Notifications Enabled: ${notificationsEnabled ? '✅ Yes' : '❌ No'}\n`;

      // Add prayer settings for reference
      if (notificationSettings) {
        fullDebugInfo += `\n⚙️ PRAYER SETTINGS:\n`;
        Object.entries(notificationSettings).forEach(([prayer, enabled]) => {
          fullDebugInfo += `${prayer}: ${enabled ? '✅' : '❌'}\n`;
        });
      }

      // Add prayer times for reference
      if (prayerTimes && prayerTimes.times) {
        fullDebugInfo += `\n🕐 TODAY'S PRAYER TIMES:\n`;
        Object.entries(prayerTimes.times).forEach(([prayer, time]) => {
          const [hours, minutes] = time.split(':').map(Number);
          const prayerTimeInMinutes = hours * 60 + minutes;
          const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
          const status = prayerTimeInMinutes > currentTimeInMinutes ? '⏳ Upcoming' : '✅ Passed';
          fullDebugInfo += `${prayer}: ${time} ${status}\n`;
        });
      }

      // Add recommendations if any
      if (recommendations && recommendations.length > 0) {
        fullDebugInfo += `\n💡 RECOMMENDATIONS:\n`;
        recommendations.forEach((rec, index) => {
          fullDebugInfo += `${index + 1}. ${rec}\n`;
        });
      }

      Alert.alert('Notifee Debug', fullDebugInfo, [
        { text: 'Clear All & Reschedule', onPress: async () => {
          await cancelAllNotifeePrayerNotifications();
          setTimeout(() => scheduleNotificationsForToday(), 1000);
          Alert.alert('Done', 'All Notifee notifications cleared and rescheduled');
        }},
        { text: 'Reschedule Only', onPress: () => scheduleNotificationsForToday() },
        { text: 'Close' }
      ]);
    } catch (error) {
      Alert.alert('Debug Error', `Failed to get debug info: ${error}`);
    }
  };

  const handleClearCache = (): void => {
    clearCache(true);
  };

  // Enhanced refresh button with long press debug
  const handleRefreshPress = () => {
    handleClearCache();
  };

  const handleRefreshLongPress = () => {
    debugNotifications();
  };

  // Render the UI
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {Platform.OS === 'android' ? (
        <View style={{ 
          height: StatusBar.currentHeight || 20, // Reduced default height from 24 to 20
          backgroundColor: SepiaColors.background.primary 
        }} />
      ) : (
        <StatusBar 
          barStyle="dark-content" 
          backgroundColor={SepiaColors.background.primary} 
        />
      )}
      
      <Stack.Screen 
        options={{ 
          headerShown: false, // Hide the default header
          title: t('appName') // This sets the title but since we're hiding the header, it won't show
        }}
      />
       
      <View style={styles.container}>
        {/* Region Picker Modal */}
        <RegionPicker />
        
        {/* Language Selector Modal */}
        <LanguageSelector />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('appName')}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.refreshButton} 
              onPress={handleRefreshPress}
              onLongPress={handleRefreshLongPress}
              disabled={refreshing}
            >
              <MaterialCommunityIcons 
                name="refresh" 
                size={20} 
                color={SepiaColors.accent.gold} 
                style={refreshing ? styles.rotating : null}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.donateButton} onPress={openDonation}>
              <MaterialCommunityIcons name="gift" size={20} color={SepiaColors.text.inverse} />
              <Text style={styles.donateText}>{t('supportApp')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.languageButton} 
              onPress={toggleLanguageSelector}
            >
              <MaterialCommunityIcons 
                name="web" 
                size={20} 
                color={SepiaColors.accent.gold} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Location display and selection */}
        <TouchableOpacity 
          style={styles.locationContainer} 
          onPress={() => router.push('/settings')}
          disabled={regionChanging}
        >
          <MaterialCommunityIcons name="map-marker" size={20} color={SepiaColors.accent.gold} />
          <Text style={styles.locationText}>
            {regionChanging ? 'Changing location...' : (getRegionConfig(regionId)?.name || location)}
          </Text>
          {regionChanging ? (
            <ActivityIndicator size="small" color={SepiaColors.accent.gold} />
          ) : (
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={20} 
              color={SepiaColors.accent.gold} 
              style={styles.dropdownIcon} 
            />
          )}
        </TouchableOpacity>
        
        {/* Date navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={goToPreviousDay}
            disabled={currentDay === 0}
          >
            <MaterialCommunityIcons 
              name="chevron-left" 
              size={28} 
              color={currentDay === 0 ? SepiaColors.special.disabled : SepiaColors.accent.gold} 
            />
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {currentDay === 0 
              ? t('today')
              : currentDay === 1 
                ? t('tomorrow')
                : `+${currentDay} ${t('days')}`}
          </Text>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={goToNextDay}
            disabled={currentDay === 9}
          >
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={28} 
              color={currentDay === 9 ? SepiaColors.special.disabled : SepiaColors.accent.gold} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Main content area - adjusted to allow scrolling */}
        <View style={styles.contentContainer}>
          {loading || regionChanging ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={SepiaColors.accent.gold} />
              <Text style={styles.loadingText}>
                {regionChanging ? 'Loading prayer times for new location...' : t('loading')}
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Date display */}
              {prayerTimes?.date && (
                <View style={styles.dateContainer}>
                  <View style={styles.dateInnerContainer}>
                    <Text style={styles.gregorianDate}>{prayerTimes.date}</Text>
                    <Text style={styles.hijriDate}>
                      {prayerTimes.hijriDate} {prayerTimes.hijriMonth}
                    </Text>
                  </View>
                </View>
              )}
              
              {/* Next prayer countdown with circular progress */}
              {nextPrayer && currentDay === 0 && (
                <View style={styles.circularCountdownContainer}>
                  <AnimatedCircularProgress 
                    progress={progressPercent} 
                    size={Math.min(260, screenWidth * 0.75)} 
                    strokeWidth={14} 
                  />
                </View>
              )}
              
              {/* Prayer times list */}
              {prayerTimes?.times && (
                <View style={styles.timesContainer}>
                  {Object.entries(prayerTimes.times).map(([prayer, time], index) => (
                    <View 
                      key={prayer}
                      style={[
                        styles.prayerItem, 
                        nextPrayer && nextPrayer.name === prayer && currentDay === 0
                          ? styles.nextPrayerItem
                          : null,
                        { marginBottom: index === Object.entries(prayerTimes.times).length - 1 ? 0 : 8 }
                      ]}
                    >
                      <View style={styles.prayerNameContainer}>
                        <View style={styles.iconContainer}>
                          <MaterialCommunityIcons 
                            name={
                              prayer === 'Fajr' ? 'weather-sunset-up' :
                              prayer === 'Sunrise' ? 'white-balance-sunny' :
                              prayer === 'Dhuhr' ? 'sun-wireless' :
                              prayer === 'Asr' ? 'weather-sunny' :
                              prayer === 'Maghrib' ? 'weather-sunset-down' :
                              'weather-night'
                            }
                            size={22}
                            color={SepiaColors.accent.gold}
                          />
                        </View>
                        <Text style={styles.prayerName}>{t(prayer)}</Text>
                      </View>
                      <Text style={styles.prayerTime}>
                        {prayerTimes.times12h ? prayerTimes.times12h[prayer] : convertTo12HourFormat(time)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Footer with developer credit */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('madeBy')}</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// Styles for our UI components
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SepiaColors.background.primary,
  },
  container: {
    flex: 1,
    paddingHorizontal: 12, // Reduced horizontal padding to minimize unused space
    paddingTop: 0, // Keep zero top padding
    paddingBottom: 90, // Extra padding to account for tab bar height + safe area
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8, // Further reduced vertical padding
    paddingHorizontal: 2, // Minimized horizontal padding for header
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: SepiaColors.text.primary,
    flex: 1, // Allow title to take available space
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Align buttons to the right
    paddingRight: 0, // No right padding to avoid overflow
    flexShrink: 0, // Don't allow buttons to shrink
  },
  refreshButton: {
    backgroundColor: SepiaColors.surface.secondary,
    padding: 8,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: SepiaColors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
  },
  rotating: {
    transform: [{ rotate: '45deg' }],
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: SepiaColors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  donateText: {
    color: SepiaColors.text.inverse,
    marginLeft: 6,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8, // Reduced padding
    backgroundColor: SepiaColors.surface.secondary,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  locationText: {
    color: SepiaColors.text.primary,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'capitalize',
  },
  dateNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8, // Reduced vertical padding
    paddingHorizontal: 12, // Reduced horizontal padding
    backgroundColor: SepiaColors.surface.elevated,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  navButton: {
    padding: 6, // Reduced padding for more compact buttons
    borderRadius: 20,
    backgroundColor: SepiaColors.surface.secondary,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
  },
  dateText: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SepiaColors.background.primary,
  },
  loadingText: {
    color: SepiaColors.text.secondary,
    marginTop: 16,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    paddingHorizontal: 8, // Reduced horizontal padding
    paddingBottom: 120, // Extra padding to ensure content is not hidden behind tab bar
  },
  dateContainer: {
    marginVertical: 10, // Reduced vertical margin
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: SepiaColors.surface.primary,
    shadowColor: SepiaColors.shadow.light,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  dateInnerContainer: {
    padding: 12, // Reduced padding
    alignItems: 'center',
    backgroundColor: SepiaColors.surface.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
  },
  gregorianDate: {
    color: SepiaColors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  hijriDate: {
    color: SepiaColors.text.secondary,
    fontSize: 14,
    marginTop: 4,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  countdownContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: SepiaColors.surface.primary,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SepiaColors.border.medium,
  },
  nextPrayerText: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  nextPrayerTime: {
    color: SepiaColors.accent.gold,
    fontSize: 26,
    fontWeight: 'bold',
    marginVertical: 6,
    textAlign: 'center',
    letterSpacing: 1,
  },
  countdownText: {
    color: SepiaColors.text.primary,
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: SepiaColors.shadow.light,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  timesContainer: {
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  prayerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: SepiaColors.surface.primary,
    borderRadius: 14,
    shadowColor: SepiaColors.shadow.light,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
  },
  nextPrayerItem: {
    backgroundColor: SepiaColors.special.highlight,
    borderWidth: 2,
    borderColor: SepiaColors.border.accent,
  },
  prayerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SepiaColors.surface.secondary,
    borderWidth: 1,
    borderColor: SepiaColors.border.medium,
  },
  prayerName: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  prayerTime: {
    color: SepiaColors.accent.gold,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  circularCountdownContainer: {
    alignItems: 'center',
    backgroundColor: SepiaColors.surface.transparent,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
    shadowColor: SepiaColors.shadow.light,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  progressCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  footer: {
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: SepiaColors.border.light,
  },
  footerText: {
    color: SepiaColors.text.tertiary,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61, 52, 37, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    backgroundColor: SepiaColors.surface.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SepiaColors.border.medium,
    overflow: 'hidden',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  modalTitle: {
    color: SepiaColors.text.primary,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  selectedRegionItem: {
    backgroundColor: SepiaColors.special.highlight,
  },
  regionName: {
    color: SepiaColors.text.primary,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  selectedRegionName: {
    color: SepiaColors.accent.gold,
    fontWeight: 'bold',
  },
  dropdownIcon: {
    marginLeft: 'auto',
    marginRight: 10,
  },
  settingsButton: {
    backgroundColor: SepiaColors.surface.secondary,
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: SepiaColors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
  },
  countdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  countdownLoadingText: {
    color: SepiaColors.text.secondary,
    fontSize: 16,
    marginLeft: 6,
    opacity: 0.8,
  },
  // Add new language button style
  languageButton: {
    backgroundColor: SepiaColors.surface.secondary,
    padding: 8,
    borderRadius: 20,
    marginRight: 4, // Reduced margin to prevent overflow
    shadowColor: SepiaColors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36, // Fixed width to ensure proper sizing
    height: 36, // Fixed height to match width
  },
  // Language selector styles
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  selectedLanguageItem: {
    backgroundColor: SepiaColors.special.highlight,
  },
  languageName: {
    color: SepiaColors.text.primary,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  selectedLanguageName: {
    color: SepiaColors.accent.gold,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1, // Add this to allow the container to expand properly
    width: '100%',
    backgroundColor: SepiaColors.background.primary,
  },
  progressIndicatorText: {
    color: SepiaColors.accent.gold,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
});