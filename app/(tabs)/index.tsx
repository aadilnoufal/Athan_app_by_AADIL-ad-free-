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
import { setupNotificationChannels, getChannelForPrayer } from '../../utils/notificationChannels';
// Import our new prayer time tuner utility
import { applyTuningParameters, applyLocalDataCityAdjustments, extractCityIdFromRegionId } from '../../utils/prayerTimeTuner';
import { getPrayerTimesFromLocalData, hasLocalDataForDate } from '../../utils/localPrayerData';
import { SepiaColors } from '../../constants/sepiaColors';

// Configure notification defaults
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

  // Notification setup and management
  useEffect(() => {
    if (Platform.OS === 'android') {
      setupNotificationChannels();
    }
    
    checkNotificationSettings();
    
    const checkForSettingsChanges = async () => {
      try {
        const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
        const notifSettings = await AsyncStorage.getItem('notification_settings');
        
        if (notifEnabled !== null) {
          setNotificationsEnabled(notifEnabled === 'true');
        }
        
        if (notifSettings !== null) {
          setNotificationSettings(JSON.parse(notifSettings));
        }
      } catch (error) {
        console.error('Error checking notification settings:', error);
      }
    };
    
    const settingsInterval = setInterval(checkForSettingsChanges, 3000);
    
    const notificationListener = async () => {
      const updateFlag = await AsyncStorage.getItem('notifications_updated');
      
      if (updateFlag) {
        await AsyncStorage.removeItem('notifications_updated');
        await checkNotificationSettings();
        await scheduleNotificationsForToday();
      }
    };
    
    const flagsInterval = setInterval(() => {
      notificationListener();
    }, 2000);
    
    return () => {
      clearInterval(settingsInterval);
      clearInterval(flagsInterval);
    };
  }, []);

  // Check if notifications are enabled and load user preferences
  const checkNotificationSettings = async () => {
    try {
      const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
      const notifSettings = await AsyncStorage.getItem('notification_settings');
      
      if (notifEnabled !== null) {
        setNotificationsEnabled(notifEnabled === 'true');
      }
      
      if (notifSettings !== null) {
        setNotificationSettings(JSON.parse(notifSettings));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const scheduleNotificationsForToday = async () => {
    try {
      if (!notificationsEnabled) return;
      
      const lastScheduled = await AsyncStorage.getItem('last_notification_scheduled');
      const now = Date.now();
      if (lastScheduled && now - parseInt(lastScheduled) < 10000) {
        console.log('Notifications were recently scheduled, skipping');
        return;
      }
      
      console.log('Scheduling notifications for today - starting with cancelling existing ones');
      
      // Cancel all existing notifications to prevent duplicates
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Use current prayer times from state instead of cache
      if (!prayerTimes || !prayerTimes.times) {
        console.log('No prayer data available for scheduling notifications');
        return;
      }
      
      const today = new Date();
      let scheduledCount = 0;
      let skippedCount = 0;
      
      for (const [prayer, timeStr] of Object.entries(prayerTimes.times)) {
        if (!notificationSettings[prayer as keyof NotificationSettings]) {
          console.log(`Skipping ${prayer} notification - disabled in settings`);
          continue;
        }
        
        const [hours, minutes] = (timeStr as string).split(':').map(Number);
        
        const prayerDate = new Date(today);
        prayerDate.setHours(hours, minutes, 0);
        
        // The 5-minute check is now inside schedulePrayerNotification
        // but we'll add an early check here to avoid unnecessary function calls
        const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes in milliseconds
        if (prayerDate.getTime() < now - fiveMinutesInMs) {
          console.log(`${prayer} time (${hours}:${minutes}) has passed by more than 5 minutes - skipping`);
          skippedCount++;
          continue;
        }
        
        if (prayerDate > today) {
          console.log(`Scheduling notification for ${prayer} at ${hours}:${minutes}`);
          await schedulePrayerNotification(prayer, prayerDate);
          scheduledCount++;
        } else {
          console.log(`${prayer} time has already passed today - skipping`);
          skippedCount++;
        }
      }
      
      // Only schedule tomorrow's Fajr if all today's prayers have passed
      if (scheduledCount === 0 && skippedCount > 0) {
        console.log('All of today\'s prayers have passed, scheduling tomorrow\'s Fajr');
        await scheduleTomorrowFajr();
      }
      
      await AsyncStorage.setItem('last_notification_scheduled', now.toString());
      
      console.log(`Notification scheduling complete: ${scheduledCount} scheduled, ${skippedCount} skipped`);
    } catch (error) {
      console.error('Error scheduling notifications:', error);
      await AsyncStorage.removeItem('last_notification_scheduled');
    }
  };

  const schedulePrayerNotification = async (prayer: string, prayerDate: Date): Promise<void> => {
    if (!notificationsEnabled || !notificationSettings[prayer as keyof NotificationSettings]) return;
    
    // Skip notifications for prayer times that have passed by more than 5 minutes
    const now = new Date();
    const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes in milliseconds
    if (prayerDate.getTime() < now.getTime() - fiveMinutesInMs) {
      console.log(`Skipping notification for ${prayer} as it passed more than 5 minutes ago`);
      return;
    }
    
    let message = "";
    switch(prayer) {
      case 'Fajr': message = t('fajrMessage'); break;
      case 'Sunrise': message = t('sunriseMessage'); break;
      case 'Dhuhr': message = t('dhuhrMessage'); break;
      case 'Asr': message = t('asrMessage'); break;
      case 'Maghrib': message = t('maghribMessage'); break;
      case 'Isha': message = t('ishaMessage'); break;
      default: message = `${t('next')}: ${prayer}`;
    }
    
    const useAzanSound = await AsyncStorage.getItem('use_azan_sound') !== 'false';
    
    const channelId = Platform.OS === 'android' 
      ? getChannelForPrayer(prayer, useAzanSound)
      : undefined;
    
    const soundName = (prayer === 'Sunrise' || !useAzanSound) ? 'beep.wav' : 'azan.wav';
    
    let vibrationPattern;
    if (prayer === 'Fajr') {
      vibrationPattern = [0, 500, 200, 500, 200, 500];
    } else if (prayer === 'Sunrise') {
      vibrationPattern = [0, 300];
    } else {
      vibrationPattern = [0, 500, 200, 500];
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t(prayer),
        body: message,
        sound: soundName,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: vibrationPattern,
        data: { 
          prayerName: prayer,
          useAzanSound: useAzanSound,
          customSound: true,
          vibrationPattern: vibrationPattern
        }
      },
      trigger: {
        date: prayerDate.getTime(),
        channelId: channelId,
      } as any,
    });
  };

  const scheduleTomorrowFajr = async (): Promise<void> => {
    try {
      if (!notificationsEnabled || !notificationSettings['Fajr']) return;
      
      // If we have prayer times for today, use the same Fajr time for tomorrow
      if (prayerTimes && prayerTimes.times && prayerTimes.times.Fajr) {
        const [hours, minutes] = prayerTimes.times.Fajr.split(':').map(Number);
        
        // Create tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hours, minutes, 0, 0);
        
        console.log(`Scheduling tomorrow's Fajr at ${hours}:${minutes}`);
        
        await schedulePrayerNotification('Fajr', tomorrow);
        return;
      }
      
      console.log('Could not schedule tomorrow\'s Fajr - no time data available');
    } catch (error) {
      console.error('Error scheduling tomorrow Fajr:', error);
    }
  };

  // Region configuration management
  useEffect(() => {
    loadRegionConfig();
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
      
      if (notificationsEnabled) {
        await scheduleNotificationsForToday();
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

  // Pre-fetch disabled - No caching system active
  const prefetchDay = async (dayOffset: number): Promise<void> => {
    // Prefetching disabled since we removed caching completely
    console.log(`Prefetching disabled for day ${dayOffset} - no cache system active`);
    return;
  };

  // Determine next prayer and set countdown
  const updateNextPrayer = (data: PrayerData): void => {
    if (!data || !data.times) return;
    
    const now = new Date();
    const today = new Date();
    const prayers: PrayerTime[] = [];
    
    Object.entries(data.times).forEach(([prayer, timeStr]) => {
      const [hour, minute] = timeStr.split(':').map(Number);
      const prayerDate = new Date(today);
      
      if (currentDay > 0) {
        prayerDate.setDate(prayerDate.getDate() + currentDay);
      }
      prayerDate.setHours(hour, minute, 0);
      
      prayers.push({
        name: prayer,
        time: data.times12h ? data.times12h[prayer] : convertTo12HourFormat(timeStr),
        timeRaw: timeStr,
        date: prayerDate
      });
    });
    
    prayers.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let next = null;
    
    if (currentDay === 0) {
      // Find the next prayer that hasn't passed today
      next = prayers.find(prayer => prayer.date > now);
      
      // Only show "Fajr (Tomorrow)" if ALL prayers for today have passed
      if (!next) {
        // Use today's Fajr time but set for tomorrow as fallback
        const todayFajr = prayers.find(prayer => prayer.name === 'Fajr');
        if (todayFajr) {
          const fajrDate = new Date(todayFajr.date);
          fajrDate.setDate(fajrDate.getDate() + 1);
          next = {
            name: 'Fajr (Tomorrow)',
            time: todayFajr.time,
            date: fajrDate
          };
        }
      }
    } else {
      // For future days, show the first prayer of that day
      next = prayers[0];
      if (next) {
        next = {
          name: next.name,
          time: next.time,
          date: next.date
        };
      }
    }
    
    if (next) {
      setNextPrayer(next);
    }
  };

  // Update countdown timer to next prayer
  const updateCountdown = useCallback(() => {
    if (!nextPrayer) return;
    
    const now = new Date();
    const prayerTime = new Date(nextPrayer.date);
    
    const diffSeconds = Math.max(0, differenceInSeconds(prayerTime, now));
    
    if (diffSeconds <= 0) {
      fetchPrayerTimes();
      return;
    }
    
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    
    // Only show progress when less than 1 hour (3600 seconds) remains
    const oneHourInSeconds = 3600;
    
    if (diffSeconds <= oneHourInSeconds) {
      // Calculate progress for the last hour
      const elapsedInLastHour = oneHourInSeconds - diffSeconds;
      const progress = Math.max(0, Math.min(1, elapsedInLastHour / oneHourInSeconds));
      
      if (Math.abs(progress - progressPercent) > 0.001) {
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
  }, [nextPrayer, currentDay, progressPercent]);
  
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

  // Reset progress when next prayer changes
  useEffect(() => {
    if (nextPrayer) {
      setCountdownLoading(true);
      
      setTimeout(() => {
        // Reset progress animation to 0 when prayer changes
        progressAnimation.setValue(0);
        setProgressPercent(0);
        setCountdownLoading(false);
      }, 200);
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

  const handleClearCache = (): void => {
    clearCache(true);
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
              onPress={handleClearCache}
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