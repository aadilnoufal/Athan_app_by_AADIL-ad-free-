import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Note: Using Expo's vector icons
import { format, addDays, differenceInSeconds, parse, isValid } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { getAvailableRegions, getRegionConfig, DEFAULT_REGION, RegionConfig } from '../config/prayerTimeConfig';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useLanguage } from '../../contexts/LanguageContext';

// Configure notification defaults
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Get screen dimensions to make components responsive
const { width: screenWidth } = Dimensions.get('window');
// Get status bar height to ensure proper padding
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

export default function Home() {
  const router = useRouter();
  const { t, currentLang, changeLanguage, isRTL, availableLanguages } = useLanguage();
  
  // State variables to store our data and UI state
  const [prayerTimes, setPrayerTimes] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState(0); // 0 = today, 1 = tomorrow, etc.
  const [nextPrayer, setNextPrayer] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [location, setLocation] = useState('');
  const [method, setMethod] = useState(0);
  const [tuningParams, setTuningParams] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshDate, setLastRefreshDate] = useState('');
  const [lastDateCheckTime, setLastDateCheckTime] = useState(0); // Track when we last checked the date
  const [progressAnimation] = useState(new Animated.Value(0));
  const [progressPercent, setProgressPercent] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const availableRegions = getAvailableRegions();
  
  // Keep notification state for scheduling purposes
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    Fajr: true,
    Sunrise: false, // Many users don't want notifications for sunrise
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true
  });

  // Add a state for countdown loading
  const [countdownLoading, setCountdownLoading] = useState(true);

  const [appState, setAppState] = useState(AppState.currentState);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const lastModalToggleTime = useRef(Date.now());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const modalLock = useRef(false);
  const toggleModal = (setter) => {
    if (modalLock.current) return;
    modalLock.current = true;
    setter(prev => !prev);
    setTimeout(() => {
      modalLock.current = false;
    }, 600);
  };

  // Load notification settings
  useEffect(() => {
    checkNotificationSettings();
    
    // Listen for notification settings changes
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
    
    // Set up interval to check for settings changes
    const settingsInterval = setInterval(checkForSettingsChanges, 3000);
    
    // Listen for the specific notification update flag
    const notificationListener = async () => {
      const updateFlag = await AsyncStorage.getItem('notifications_updated');
      
      if (updateFlag) {
        // Clear the flag
        await AsyncStorage.removeItem('notifications_updated');
        // Reload settings and reschedule
        await checkNotificationSettings();
        await scheduleNotificationsForToday();
      }
    };
    
    // Check for region changes
    const regionChangeListener = async () => {
      const changeFlag = await AsyncStorage.getItem('region_changed');
      
      if (changeFlag) {
        // Clear the flag
        await AsyncStorage.removeItem('region_changed');
        // Reload region settings and clear cache
        await loadRegionConfig();
        await clearCache(false);
      }
    };
    
    // Set interval to check for these flags
    const flagsInterval = setInterval(() => {
      notificationListener();
      regionChangeListener();
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

  // Schedule notifications for today's prayer times
  const scheduleNotificationsForToday = async () => {
    try {
      if (!notificationsEnabled) return;
      
      // Cancel any existing notifications first
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Get today's prayer times from AsyncStorage
      const cachedData = await AsyncStorage.getItem('prayer_0');
      if (!cachedData) return;
      
      const prayerData = JSON.parse(cachedData);
      const today = new Date();
      
      // For each prayer time, schedule a notification if enabled
      for (const [prayer, timeStr] of Object.entries(prayerData.times)) {
        if (!notificationSettings[prayer]) continue;
        
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        // Create a date for the prayer time
        const prayerDate = new Date(today);
        prayerDate.setHours(hours, minutes, 0);
        
        // Only schedule if the prayer time is in the future
        if (prayerDate > today) {
          await schedulePrayerNotification(prayer, prayerDate);
        }
      }
      
      // Also schedule for tomorrow's Fajr
      await scheduleTomorrowFajr();
      
      console.log('Notifications scheduled successfully');
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  };

  // Schedule a notification for a specific prayer
  const schedulePrayerNotification = async (prayer, date) => {
    if (!notificationsEnabled || !notificationSettings[prayer]) return;
    
    const trigger = date;
    
    // Different message for each prayer using translations
    let message = "";
    switch(prayer) {
      case 'Fajr':
        message = t('fajrMessage');
        break;
      case 'Sunrise':
        message = t('sunriseMessage');
        break;
      case 'Dhuhr':
        message = t('dhuhrMessage');
        break;
      case 'Asr':
        message = t('asrMessage');
        break;
      case 'Maghrib':
        message = t('maghribMessage');
        break;
      case 'Isha':
        message = t('ishaMessage');
        break;
      default:
        message = `${t('next')}: ${prayer}`;
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t(prayer),
        body: message,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: 'date',
        timestamp: date.getTime(),
        channelId: 'prayer-reminders',    // ensure Android channel is used
      },
    });
  };

  // Special function to schedule tomorrow's Fajr notification
  const scheduleTomorrowFajr = async () => {
    try {
      if (!notificationsEnabled || !notificationSettings['Fajr']) return;
      
      // Get tomorrow's prayer times
      const cachedData = await AsyncStorage.getItem('prayer_1');
      if (!cachedData) return;
      
      const prayerData = JSON.parse(cachedData);
      const tomorrow = addDays(new Date(), 1);
      
      const fajrTime = prayerData.times['Fajr'];
      const [hours, minutes] = fajrTime.split(':').map(Number);
      
      const fajrDate = new Date(tomorrow);
      fajrDate.setHours(hours, minutes, 0);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Fajr',
          body: "It's time for Fajr prayer",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: 'date',
          timestamp: fajrDate.getTime(),
          channelId: 'prayer-reminders',
        },
      });
    } catch (error) {
      console.error('Error scheduling tomorrow Fajr:', error);
    }
  };

  // Load configuration for the selected region
  useEffect(() => {
    loadRegionConfig();
  }, []);
  
  // Load region config function
  const loadRegionConfig = async () => {
    try {
      // Check if user has a saved region preference
      const savedRegion = await AsyncStorage.getItem('selected_region');
      const regionToUse = savedRegion || DEFAULT_REGION;
      
      // Get configuration for the region
      const config = getRegionConfig(regionToUse);
      
      if (config) {
        setRegionId(config.id);
        setLocation(config.location);
        setMethod(config.method);
        setTuningParams(config.tuningParams);
      } else {
        // Fallback to default if config not found
        const defaultConfig = getRegionConfig(DEFAULT_REGION);
        setRegionId(DEFAULT_REGION);
        setLocation(defaultConfig.location);
        setMethod(defaultConfig.method);
        setTuningParams(defaultConfig.tuningParams);
      }
    } catch (error) {
      console.error('Error loading region config:', error);
      // Fallback to default
      const defaultConfig = getRegionConfig(DEFAULT_REGION);
      setRegionId(DEFAULT_REGION);
      setLocation(defaultConfig.location);
      setMethod(defaultConfig.method);
      setTuningParams(defaultConfig.tuningParams);
    }
  };

  // Function to check if we need to auto refresh for a new day (optimized)
  const checkDayChange = () => {
    // Only check once per minute (60000 milliseconds)
    const now = Date.now();
    if (now - lastDateCheckTime < 60000) {
      return; // Skip the check if it's been less than a minute
    }
    
    // Update the last check time
    setLastDateCheckTime(now);
    
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // If we haven't refreshed today yet
    if (lastRefreshDate !== today) {
      // Update the last refresh date
      setLastRefreshDate(today);
      
      // If it's not the first run (lastRefreshDate is not empty)
      if (lastRefreshDate !== '') {
        console.log('Auto-refreshing at new day');
        clearCache(false); // Clear cache without showing alert
      } else {
        // First run of the app, just set the date
        AsyncStorage.setItem('last_refresh_date', today);
      }
    }
  };
  
  // Modified clearCache function to optionally show alerts
  const clearCache = async (showAlerts = true) => {
    try {
      setRefreshing(true);
      
      // Get all keys from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      
      // Filter only prayer time related keys
      const prayerKeys = keys.filter(key => key.startsWith('prayer_'));
      
      // Remove all prayer time related data
      if (prayerKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerKeys);
      }
      
      // Store current date as last refresh date
      const today = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem('last_refresh_date', today);
      setLastRefreshDate(today);
      
      // Fetch fresh data
      await fetchAndCachePrayerTimes();
      
      // After cache is cleared and new data is fetched, reschedule notifications
      if (notificationsEnabled) {
        await scheduleNotificationsForToday();
      }
      
      if (showAlerts) {
        Alert.alert(
          t('cacheCleared'),
          t('cacheMessage'),
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

  // Run once when the app starts to get the last refresh date
  useEffect(() => {
    const getLastRefreshDate = async () => {
      try {
        const storedDate = await AsyncStorage.getItem('last_refresh_date');
        if (storedDate) {
          setLastRefreshDate(storedDate);
        }
        // Initialize the last check time
        setLastDateCheckTime(Date.now());
      } catch (error) {
        console.error('Error getting last refresh date:', error);
      }
    };
    
    getLastRefreshDate();
  }, []);

  // Run when the app starts and when currentDay changes
  useEffect(() => {
    // Reset progress when day changes
    setProgressPercent(0);
    progressAnimation.setValue(0);
    setTotalSeconds(0);
    setElapsedSeconds(0);
    
    // Only fetch prayer times when configuration is loaded
    if (location && method && tuningParams) {
      console.log(`Fetching prayer times for day +${currentDay}`);
      fetchPrayerTimes();
    }
    
    // Create separate intervals for countdown update and date checking
    const countdownTimer = setInterval(() => {
      updateCountdown();
    }, 1000);
    
    // Check for date changes every minute instead of every second
    const dateCheckTimer = setInterval(() => {
      checkDayChange();
    }, 60000); // 60000 ms = 1 minute
    
    // Clean up the timers when component unmounts
    return () => {
      clearInterval(countdownTimer);
      clearInterval(dateCheckTimer);
    };
  }, [currentDay, lastRefreshDate, location, method, tuningParams]);
  
  // Fetch prayer times from API or local storage
  const fetchPrayerTimes = async () => {
    try {
      setLoading(true);
      
      // First check if we have cached data for the selected day
      const cachedData = await AsyncStorage.getItem(`prayer_${currentDay}`);
      
      if (cachedData) {
        // If we have cached data, use it instead of making an API call
        const parsedData = JSON.parse(cachedData);
        setPrayerTimes(parsedData);
        setLoading(false);
        updateNextPrayer(parsedData);
      } else {
        // Otherwise fetch from Aladhan API
        await fetchAndCachePrayerTimes();
      }
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      Alert.alert(
        t('connectionError'),
        t('connectionErrorMessage'),
        [{ text: t('ok') }]
      );
      setLoading(false);
    }
  };
  
  // Add a helper function to convert 24h to 12h format
  const convertTo12HourFormat = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12; // Convert 0 to 12
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // This is the function that actually fetches data from the Aladhan API
  const fetchAndCachePrayerTimes = async (retryCount = 0) => {
    try {
      // Calculate the date for fetching (today + currentDay offset)
      const fetchDate = addDays(new Date(), currentDay);
      const formattedDate = format(fetchDate, 'dd-MM-yyyy');
      
      console.log(`Fetching prayer times for ${formattedDate}, location: ${location}`);
      
      // Make API request to Aladhan.com API with tuning parameters
      // This API provides prayer times based on location and calculation method
      const response = await fetch(
        `https://api.aladhan.com/v1/timingsByAddress/${formattedDate}?address=${location}&method=${method}&tune=${tuningParams}`
      );
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract the prayer times from API response
      const timings = data.data.timings;
      const date = data.data.date;
      
      // Format and organize the prayer times data
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
      
      // Cache the data for offline use
      await AsyncStorage.setItem(`prayer_${currentDay}`, JSON.stringify(formattedTimes));
      
      // Pre-fetch the next few days for offline use
      if (currentDay === 0) {
        for (let i = 1; i < 10; i++) {
          prefetchDay(i);
        }
      }
      
      setPrayerTimes(formattedTimes);
      updateNextPrayer(formattedTimes);
      setLoading(false);
      
      // After setting prayer times, update notifications if enabled
      if (currentDay === 0 && notificationsEnabled) {
        await scheduleNotificationsForToday();
      }
    } catch (error) {
      console.error('Error fetching from API:', error);
      
      // Add retry logic - try up to 3 times with exponential backoff
      if (retryCount < 3) {
        console.log(`Retrying API fetch (attempt ${retryCount + 1} of 3)...`);
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
        
        setTimeout(() => {
          fetchAndCachePrayerTimes(retryCount + 1);
        }, delay);
        return;
      }
      
      // After retries, try to use any offline data we might have
      const offlineData = await AsyncStorage.getItem(`prayer_${currentDay}`);
      if (offlineData) {
        console.log('Using cached offline data');
        setPrayerTimes(JSON.parse(offlineData));
      } else if (currentDay === 0) {
        // For today, let's create a fallback data structure with the current date
        // so the UI doesn't break completely if both API and cache fail
        console.log('Creating fallback prayer times data');
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
      }
      
      setLoading(false);
    }
  };
  
  // Pre-fetch and cache prayer times for a future day
  const prefetchDay = async (dayOffset) => {
    try {
      const fetchDate = addDays(new Date(), dayOffset);
      const formattedDate = format(fetchDate, 'dd-MM-yyyy');
      
      // Check if we already have this data cached
      const existingData = await AsyncStorage.getItem(`prayer_${dayOffset}`);
      if (existingData) return;
      
      const response = await fetch(
        `https://api.aladhan.com/v1/timingsByAddress/${formattedDate}?address=${location}&method=${method}&tune=${tuningParams}`
      );
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      const timings = data.data.timings;
      const date = data.data.date;
      
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
      
      await AsyncStorage.setItem(`prayer_${dayOffset}`, JSON.stringify(formattedTimes));
    } catch (error) {
      console.error(`Error prefetching day ${dayOffset}:`, error);
    }
  };
  
  // Figure out which prayer is next and set countdown
  const updateNextPrayer = (data) => {
    if (!data || !data.times) return;
    
    const now = new Date();
    const today = new Date();
    const prayers = [];
    
    // Convert prayer time strings to Date objects
    Object.entries(data.times).forEach(([prayer, timeStr]) => {
      const [hour, minute] = timeStr.split(':').map(Number);
      const prayerDate = new Date(today);
      
      // Adjust date for future days
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
    
    // Sort prayers by time
    prayers.sort((a, b) => a.date - b.date);
    
    // Find the next prayer
    let next = null;
    
    if (currentDay === 0) {
      // For today, find the next prayer based on current time
      next = prayers.find(prayer => prayer.date > now);
      
      // If no prayers left today, first prayer tomorrow is next
      if (!next) {
        const tomorrowFajr = prayers.find(prayer => prayer.name === 'Fajr');
        if (tomorrowFajr) {
          const fajrDate = new Date(tomorrowFajr.date);
          fajrDate.setDate(fajrDate.getDate() + 1);
          next = {
            name: 'Fajr (Tomorrow)',
            time: tomorrowFajr.time,
            date: fajrDate
          };
        }
      }
    } else {
      // For future days, just show the first prayer
      next = prayers[0];
      if (next) {
        // Keep the original name without adding "(Tomorrow)"
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
  
  // Update the countdown timer to the next prayer
  const updateCountdown = useCallback(() => {
    if (!nextPrayer) return;
    
    const now = new Date();
    const prayerTime = new Date(nextPrayer.date);
    
    // Calculate the time difference (without currentDay adjustment here as we already did it in updateNextPrayer)
    const diffSeconds = Math.max(0, differenceInSeconds(prayerTime, now));
    
    if (diffSeconds <= 0) {
      // Time for prayer has passed, update next prayer
      fetchPrayerTimes();
      return;
    }
    
    // Format the countdown
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    
    setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    
    // First calculation - find total seconds between prayers
    if (totalSeconds === 0 || diffSeconds > totalSeconds) {
      // Initialize with max 6 hours to ensure visible progress
      // Convert to ref to avoid state updates
      setTotalSeconds(Math.min(diffSeconds, 21600));
      setElapsedSeconds(0);
    } else {
      // Update elapsed time
      setElapsedSeconds(totalSeconds - diffSeconds);
    }
    
    // Calculate progress percentage (0 to 1)
    const progress = Math.max(0, Math.min(1, elapsedSeconds / totalSeconds));
    
    // Only update if there's a meaningful change to prevent unnecessary renders
    if (Math.abs(progress - progressPercent) > 0.001) {
      setProgressPercent(progress);
      
      // Animate the progress value smoothly with shorter animation duration
      Animated.timing(progressAnimation, {
        toValue: progress,
        duration: 300, // Reduced from 500ms to 300ms for faster updates
        useNativeDriver: false,
        easing: Easing.out(Easing.ease)
      }).start();
    }
  }, [nextPrayer, currentDay, totalSeconds, elapsedSeconds, progressPercent]);
  
  // Use more efficient timer management
  useEffect(() => {
    let countdownTimer;
    
    // Only start the timer when we have necessary data
    if (nextPrayer) {
      updateCountdown(); // Run once immediately
      countdownTimer = setInterval(updateCountdown, 1000);
    }
    
    // Clean up the timer when component unmounts
    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [updateCountdown, nextPrayer]);

  // Reset total seconds when next prayer changes
  useEffect(() => {
    if (nextPrayer) {
      // Set countdown loading while we calculate
      setCountdownLoading(true);
      
      // Small delay to allow the UI to show the loading state
      setTimeout(() => {
        setTotalSeconds(0); // This will trigger recalculation in updateCountdown
        progressAnimation.setValue(0); // Reset the animation value
        setCountdownLoading(false);
      }, 200);
    }
  }, [nextPrayer]);
  
  // Calculate parameters for our progress circle
  const CircularProgress = ({ progress, size, strokeWidth }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    
    // Convert progress (0-1) to dash offset for SVG
    const strokeDashoffset = circumference * (1 - progress);
    
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Background Circle */}
          <Circle
            stroke="#333333"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          
          {/* Progress Circle */}
          <Circle
            stroke="#FFD700"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size/2}, ${size/2}`}
          />
        </Svg>
        
        {/* Center content */}
        <View style={styles.progressCenter}>
          {nextPrayer && (
            <>
              <Text style={styles.nextPrayerText}>
                Next: {nextPrayer.name}
              </Text>
              <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
              <Text style={styles.countdownText}>{countdown}</Text>
            </>
          )}
        </View>
      </View>
    );
  };
  
  // Create a properly animated circular progress component 
  const AnimatedCircularProgress = ({ progress, size, strokeWidth }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    
    // Use interpolated value for smooth animation
    const animatedStrokeDashoffset = progressAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [circumference, 0],
      extrapolate: 'clamp'
    });
    
    // Create an AnimatedCircle component
    const AnimatedCircle = Animated.createAnimatedComponent(Circle);
    
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Background Circle */}
          <Circle
            stroke="#333333"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          
          {/* Animated Progress Circle */}
          <AnimatedCircle
            stroke="#FFD700"
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
        </Svg>
        
        {/* Center content */}
        <View style={styles.progressCenter}>
          {nextPrayer && (
            <>
              <Text style={styles.nextPrayerText}>
                Next: {nextPrayer.name}
              </Text>
              <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
              
              {countdownLoading ? (
                <View style={styles.countdownLoading}>
                  <ActivityIndicator size="small" color="#FFD700" />
                  <Text style={styles.countdownLoadingText}>Calculating...</Text>
                </View>
              ) : (
                <Text style={styles.countdownText}>{countdown}</Text>
              )}
            </>
          )}
        </View>
      </View>
    );
  };
  
  // Navigate to previous day
  const goToPreviousDay = () => {
    if (currentDay > 0) {
      // First update state
      const newDay = currentDay - 1;
      setCurrentDay(newDay);
      
      // Update the displayed date
      if (newDay === 0) {
        // If going back to today, set to current date
        setCurrentDate(new Date());
      } else {
        // Otherwise subtract a day
        setCurrentDate(prevDate => addDays(prevDate, -1));
      }
      
      // Force a reload by clearing any cached nextPrayer
      setNextPrayer(null);
      setCountdown('');
      
      // Log for debugging
      console.log(`Moving to day +${newDay}`);
    }
  };
  
  // Navigate to next day
  const goToNextDay = () => {
    if (currentDay < 9) { // Limit to 10 days (0-9)
      // First update state
      const newDay = currentDay + 1;
      setCurrentDay(newDay);
      
      // Update the displayed date
      setCurrentDate(prevDate => addDays(prevDate, 1));
      
      // Force a reload by clearing any cached nextPrayer
      setNextPrayer(null);
      setCountdown('');
      
      // Log for debugging
      console.log(`Moving to day +${newDay}`);
    }
  };
  
  // Toggle language selector
  const toggleLanguageSelector = () => {
    setShowLanguageSelector(!showLanguageSelector);
  };
  
  // Select a language
  const selectLanguage = async (langId) => {
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
        <View style={[styles.modalContent, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('language')}</Text>
            <TouchableOpacity onPress={() => setShowLanguageSelector(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={Object.values(availableLanguages)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
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
                  <MaterialCommunityIcons name="check" size={20} color="#FFD700" />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  // Open donation dialog with multiple options
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

  // Navigate to settings page
  const openSettings = () => {
    router.push('/settings');
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
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={availableRegions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
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
                  <MaterialCommunityIcons name="check" size={20} color="#FFD700" />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  // Check if the current date matches the system date when app is opened
  useEffect(() => {
    // Function to check and update date if needed
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
    
    // Run date check when component mounts
    checkAndUpdateDate();
    
    // Also set up AppState listener to check date when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        checkAndUpdateDate();
      }
      setAppState(nextAppState);
    });
    
    // Clean up the listener
    return () => {
      subscription.remove();
    };
  }, [currentDate, notificationsEnabled, currentDay]);

  // Add the missing changeRegion function
  const changeRegion = async (newRegionId) => {
    try {
      // Save the selected region to AsyncStorage
      await AsyncStorage.setItem('selected_region', newRegionId);
      
      // Update the UI with the new region
      setRegionId(newRegionId);
      
      // Get the config for the new region
      const config = getRegionConfig(newRegionId);
      if (config) {
        setLocation(config.location);
        setMethod(config.method);
        setTuningParams(config.tuningParams);
      }
      
      // Close the region picker
      toggleModal(setShowRegionPicker);
      
      // Clear the cache to fetch prayer times for the new region
      await clearCache(false);
      
      // Set a flag to indicate that the region has changed
      await AsyncStorage.setItem('region_changed', 'true');
    } catch (error) {
      console.error('Error changing region:', error);
      Alert.alert('Error', 'Failed to change region. Please try again.');
    }
  };

  // Enhanced date check that runs when app is opened
  useEffect(() => {
    const forceCurrentDateRefresh = () => {
      const now = new Date();
      console.log('Performing date check on app start/resume');
      console.log(`System date: ${format(now, 'yyyy-MM-dd')}`);
      console.log(`App date: ${format(currentDate, 'yyyy-MM-dd')}`);
      
      // Always set to current date when on the "today" view
      if (currentDay === 0) {
        // Compare dates by converting to date strings (ignoring time)
        const systemDateStr = format(now, 'yyyy-MM-dd');
        const appDateStr = format(currentDate, 'yyyy-MM-dd');
        
        if (systemDateStr !== appDateStr) {
          console.log('Date mismatch detected, updating to current date');
          
          // Force update the date
          setCurrentDate(new Date());
          
          // Clear cached data to force a refresh
          clearCache(false);
          
          // Reset last refresh date to force a new fetch
          setLastRefreshDate('');
          
          // Make sure we're on today's view
          setCurrentDay(0);
          
          // If notifications are enabled, reschedule them
          if (notificationsEnabled) {
            setTimeout(() => {
              scheduleNotificationsForToday();
            }, 2000);
          }
        }
      }
    };
    
    // Run immediately when component mounts
    forceCurrentDateRefresh();
    
    // Set up AppState listener to check date when app resumes from background
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground - force a date check
        console.log('App resumed from background, checking date');
        forceCurrentDateRefresh();
      }
      setAppState(nextAppState);
    });
    
    // Also set a timer to check the date every minute
    const minuteTimer = setInterval(() => {
      if (currentDay === 0) {  // Only check when viewing today
        const now = new Date();
        const systemDateStr = format(now, 'yyyy-MM-dd');
        const appDateStr = format(currentDate, 'yyyy-MM-dd');
        
        if (systemDateStr !== appDateStr) {
          console.log('Date changed while app was running');
          forceCurrentDateRefresh();
        }
      }
    }, 60000);
    
    // Clean up
    return () => {
      subscription.remove();
      clearInterval(minuteTimer);
    };
  }, []); // Empty dependency array so this only runs once on mount

  // Keep the original date check for day changes
  useEffect(() => {
    // ... existing code for checkDayChange ...
  }, [currentDate, notificationsEnabled, currentDay]);

  // Render the UI
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#121212" 
        translucent={Platform.OS === 'android'} 
      />
      
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
              onPress={clearCache}
              disabled={refreshing}
            >
              <MaterialCommunityIcons 
                name="refresh" 
                size={20} 
                color="#FFD700" 
                style={refreshing ? styles.rotating : null}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.languageButton} 
              onPress={toggleLanguageSelector}
            >
              <MaterialCommunityIcons 
                name="web" 
                size={20} 
                color="#FFD700" 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.donateButton} onPress={openDonation}>
              <MaterialCommunityIcons name="gift" size={20} color="#FFD700" />
              <Text style={styles.donateText}>{t('supportApp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Location display and selection */}
        <TouchableOpacity 
          style={styles.locationContainer} 
          onPress={() => router.push('/settings')}
        >
          <MaterialCommunityIcons name="map-marker" size={20} color="#FFD700" />
          <Text style={styles.locationText}>
            {getRegionConfig(regionId)?.name || location}
          </Text>
          <MaterialCommunityIcons 
            name="chevron-right" 
            size={20} 
            color="#FFD700" 
            style={styles.dropdownIcon} 
          />
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
              color={currentDay === 0 ? '#555' : '#FFD700'} 
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
              color={currentDay === 9 ? '#555' : '#FFD700'} 
            />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Date display */}
            {prayerTimes.date && (
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
            {prayerTimes.times && (
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
                          color="#FFD700"
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
    </SafeAreaView>
  );
}

// Styles for our UI components
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    width: '100%',
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    padding: 8,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  rotating: {
    transform: [{ rotate: '45deg' }],
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  donateText: {
    color: '#FFD700',
    marginLeft: 6,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  locationText: {
    color: '#FFFFFF',
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(50, 50, 50, 0.4)',
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
    width: '100%',
    backgroundColor: '#121212',
  },
  scrollViewContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  dateContainer: {
    marginVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  dateInnerContainer: {
    padding: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  gregorianDate: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  hijriDate: {
    color: '#CCCCCC',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  countdownContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(42, 42, 42, 0.6)',
    margin: 16,
    borderRadius: 16,
  },
  nextPrayerText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  nextPrayerTime: {
    color: '#FFD700',
    fontSize: 26,
    fontWeight: 'bold',
    marginVertical: 6,
    textAlign: 'center',
    letterSpacing: 1,
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
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
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  nextPrayerItem: {
    backgroundColor: 'rgba(42, 42, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
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
    backgroundColor: 'rgba(20, 20, 20, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  prayerName: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  prayerTime: {
    color: '#FFD700',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  circularCountdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.1)',
    shadowColor: "#000",
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
    borderTopColor: 'rgba(255, 215, 0, 0.1)',
  },
  footerText: {
    color: '#AAAAAA',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    overflow: 'hidden',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#FFFFFF',
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedRegionItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  regionName: {
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  selectedRegionName: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  dropdownIcon: {
    marginLeft: 'auto',
    marginRight: 10,
  },
  settingsButton: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  countdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  countdownLoadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 6,
    opacity: 0.8,
  },
  // Add new language button style
  languageButton: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  
  // Language selector styles
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedLanguageItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  languageName: {
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  selectedLanguageName: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
});