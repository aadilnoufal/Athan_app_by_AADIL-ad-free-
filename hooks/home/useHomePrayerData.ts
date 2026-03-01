/**
 * useHomePrayerData
 *
 * Core prayer data engine for the Home screen:
 * - Local CSV data fetching (year-agnostic, no API)
 * - 12 h / 24 h format conversion
 * - Next-prayer calculation + countdown timer
 * - Day navigation (previous / next / today)
 * - Cache clearing / refresh
 * - Progress animation for the circular indicator
 *
 * Accepts region params, notification scheduling callback, and
 * translation function from the orchestrator.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Animated, AppState, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, addDays, differenceInSeconds } from 'date-fns';

import { getRegionConfig, DEFAULT_REGION } from '../../app/config/prayerTimeConfig';
import { applyLocalDataCityAdjustments, extractCityIdFromRegionId } from '../../utils/prayerTimeTuner';
import { getPrayerTimesFromLocalData } from '../../utils/localPrayerData';
import { findNextPrayer, isSamePrayerTime } from '../../utils/timeUtils';
import type { PrayerData, NextPrayer } from '../../app/components/home/homeTypes';

type TFunc = (key: string) => string;

export interface UseHomePrayerDataParams {
  regionId: string;
  location: string;
  method: number;
  tuningParams: string;
  isFirstLoad: boolean;
  setIsFirstLoad: React.Dispatch<React.SetStateAction<boolean>>;
  t: TFunc;
  appState: string;
  notificationsEnabled: boolean;
  scheduleNotificationsForToday: () => Promise<void>;
}

export function useHomePrayerData(params: UseHomePrayerDataParams) {
  const {
    regionId,
    location,
    method,
    tuningParams,
    isFirstLoad,
    setIsFirstLoad,
    t,
    appState,
    notificationsEnabled,
    scheduleNotificationsForToday,
  } = params;

  // ── State ───────────────────────────────────────────
  const [prayerTimes, setPrayerTimes] = useState<PrayerData | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState(0);
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null);
  const [countdown, setCountdown] = useState('');
  const [countdownLoading, setCountdownLoading] = useState(true);
  const [lastPrayerTime, setLastPrayerTime] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progressAnimation] = useState(new Animated.Value(0));
  const [progressPercent, setProgressPercent] = useState(0);
  const [lastRefreshDate, setLastRefreshDate] = useState('');
  const [lastDateCheckTime, setLastDateCheckTime] = useState(0);

  // ── Refs ────────────────────────────────────────────
  const lastCountdownLog = useRef<string>('');
  const countdownTriggeredRefresh = useRef<string>('');

  // ── convertTo12HourFormat ───────────────────────────
  const convertTo12HourFormat = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // ── fetchAndCachePrayerTimes ────────────────────────
  const fetchAndCachePrayerTimes = async (retryCount = 0) => {
    try {
      const fetchDate = addDays(new Date(), currentDay);
      const formattedDate = format(fetchDate, 'dd-MM-yyyy');

      console.log(`Fetching FRESH prayer times for ${formattedDate}, location: ${location}`);

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
            Isha: convertTo12HourFormat(timings.Isha),
          },
        };

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
        console.log(`No local CSV data available for ${formattedDate}`);
        Alert.alert(
          'Data Not Available',
          `Prayer time data for ${formattedDate} is not available in local database. This should not happen as we have year-round data.`,
          [{ text: 'OK' }],
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

      console.log('Creating fallback prayer times data after all retries failed');
      const today = addDays(new Date(), currentDay);
      const fallbackTimes: PrayerData = {
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
          Isha: '--:--',
        },
        times12h: {
          Fajr: '--:--',
          Sunrise: '--:--',
          Dhuhr: '--:--',
          Asr: '--:--',
          Maghrib: '--:--',
          Isha: '--:--',
        },
      };

      setPrayerTimes(fallbackTimes);
      if (isFirstLoad) setIsFirstLoad(false);
      setLoading(false);
    }
  };

  // ── fetchPrayerTimes (top-level entry with timeout) ─
  const fetchPrayerTimes = async () => {
    try {
      setLoading(true);
      console.log('Always fetching fresh data - no cache used');

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000);
      });

      if (isFirstLoad || !prayerTimes) {
        console.log('Fetching prayer times for first load or after no data...');
      }

      await Promise.race([fetchAndCachePrayerTimes(), timeoutPromise]);
    } catch (error) {
      console.error('Error fetching prayer times:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (prayerTimes && errorMessage !== 'Request timeout') {
        console.log('Keeping existing prayer times due to fetch error');
        setLoading(false);
        return;
      }

      if (isFirstLoad || !prayerTimes) {
        console.log('Error on first load, creating fallback data');
        const today = new Date();
        const fallbackTimes: PrayerData = {
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
            Isha: '--:--',
          },
          times12h: {
            Fajr: '--:--',
            Sunrise: '--:--',
            Dhuhr: '--:--',
            Asr: '--:--',
            Maghrib: '--:--',
            Isha: '--:--',
          },
        };
        setPrayerTimes(fallbackTimes);
        setIsFirstLoad(false);
      }

      Alert.alert(t('connectionError'), t('connectionErrorMessage'), [{ text: t('ok') }]);
      setLoading(false);
    }
  };

  // ── updateNextPrayer ────────────────────────────────
  const updateNextPrayer = (data: PrayerData): void => {
    if (!data || !data.times) {
      console.log('⚠️ updateNextPrayer: No prayer data available');
      return;
    }

    console.log('🔄 Calculating next prayer time...');

    const next = findNextPrayer(data.times, data.times12h, currentDay) as NextPrayer | null;

    if (next) {
      console.log(`📋 findNextPrayer returned: ${next.name} at ${next.time}`);
      console.log(`📋 Current nextPrayer: ${nextPrayer?.name || 'none'}`);

      const isDifferent =
        !nextPrayer ||
        nextPrayer.name !== next.name ||
        !isSamePrayerTime(nextPrayer.date, next.date);

      console.log(`📋 isDifferent: ${isDifferent}`);

      if (isDifferent) {
        console.log(`🔄 Next prayer updated: ${next.name} at ${next.time}`);
        setNextPrayer(next);
        setCountdown('');
        setCountdownLoading(true);
        countdownTriggeredRefresh.current = '';
        console.log(
          `🔄 Prayer changed from ${nextPrayer?.name || 'none'} to ${next.name} - countdown reset`,
        );
      } else {
        console.log(`⏱️ Next prayer unchanged: ${next.name} at ${next.time}`);
      }
    } else {
      console.log('⚠️ Could not determine next prayer time');
    }
  };

  // ── findLastPrayer ──────────────────────────────────
  const findLastPrayer = (times: any, _times12h: any): Date | null => {
    if (!times) return null;

    const now = new Date();
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const prayerNames = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    let lastPrayer: Date | null = null;

    for (const prayerName of prayerNames) {
      const timeStr = times[prayerName];
      if (timeStr && timeStr !== '--:--') {
        const [hour, minute] = timeStr.split(':').map(Number);
        if (!isNaN(hour) && !isNaN(minute)) {
          const prayerDate = new Date(today);
          prayerDate.setHours(hour, minute, 0, 0);

          if (prayerDate <= now) {
            lastPrayer = prayerDate;
          } else {
            break;
          }
        }
      }
    }

    if (!lastPrayer) {
      const ishaTimeStr = times['Isha'];
      if (ishaTimeStr && ishaTimeStr !== '--:--') {
        const [hour, minute] = ishaTimeStr.split(':').map(Number);
        if (!isNaN(hour) && !isNaN(minute)) {
          const yesterdayIsha = new Date(yesterday);
          yesterdayIsha.setHours(hour, minute, 0, 0);
          lastPrayer = yesterdayIsha;
        }
      }
    }

    return lastPrayer;
  };

  // ── updateCountdown ─────────────────────────────────
  const updateCountdown = useCallback(() => {
    if (!nextPrayer) return;

    const now = new Date();
    const prayerTime = new Date(nextPrayer.date);
    const diffSeconds = Math.max(0, differenceInSeconds(prayerTime, now));

    if (diffSeconds <= 0) {
      const logKey = `${nextPrayer.name}-passed`;
      if (lastCountdownLog.current !== logKey) {
        console.log(`⏰ Countdown: ${nextPrayer.name} prayer time has passed`);
        lastCountdownLog.current = logKey;
      }

      setCountdown('00:00:00');

      const refreshKey = `${nextPrayer.name}-${prayerTime.getTime()}`;
      console.log(
        `🔍 Countdown zero check - refreshKey: ${refreshKey}, stored: ${countdownTriggeredRefresh.current}, currentDay: ${currentDay}, hasPrayerTimes: ${!!prayerTimes}`,
      );

      if (
        countdownTriggeredRefresh.current !== refreshKey &&
        currentDay === 0 &&
        prayerTimes
      ) {
        countdownTriggeredRefresh.current = refreshKey;
        console.log('🔄 Countdown reached zero - advancing to next prayer immediately');
        updateNextPrayer(prayerTimes);
      } else {
        console.log(
          '⚠️ Countdown zero BUT not triggering update - already triggered or wrong conditions',
        );
      }
      return;
    }

    const activeLogKey = `${nextPrayer.name}-active`;
    if (lastCountdownLog.current !== activeLogKey) {
      lastCountdownLog.current = activeLogKey;
    }

    // ✨ ENHANCED COUNTDOWN LOGIC ✨
    const lastPrayer = findLastPrayer(prayerTimes?.times, prayerTimes?.times12h);

    if (lastPrayer) {
      const totalTimeSpan = differenceInSeconds(prayerTime, lastPrayer);
      const elapsedTime = differenceInSeconds(now, lastPrayer);
      const remainingTime = differenceInSeconds(prayerTime, now);
      const progressPercentage = Math.min(100, Math.max(0, (elapsedTime / totalTimeSpan) * 100));

      console.log(
        `⏱️ Enhanced Countdown: ${Math.round(progressPercentage)}% progress, ${Math.floor(remainingTime / 60)}m remaining`,
      );

      const oneHourInSeconds = 3600;

      if (remainingTime <= oneHourInSeconds) {
        const minutesRemaining = Math.floor(remainingTime / 60);
        const secondsRemaining = remainingTime % 60;
        const finalHourDisplay = `${minutesRemaining}m ${secondsRemaining}s`;

        if (countdown !== finalHourDisplay) {
          setCountdown(finalHourDisplay);
        }

        const hourElapsed = oneHourInSeconds - remainingTime;
        const hourProgress = Math.max(0, Math.min(1, hourElapsed / oneHourInSeconds));

        if (Math.abs(hourProgress - progressPercent) > 0.01) {
          setProgressPercent(hourProgress);
          Animated.timing(progressAnimation, {
            toValue: hourProgress,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease),
          }).start();
        }
      } else {
        const hoursRemaining = Math.floor(remainingTime / 3600);
        const minutesRemaining = Math.floor((remainingTime % 3600) / 60);
        const progressDisplay = `${hoursRemaining}h ${minutesRemaining}m`;

        if (countdown !== progressDisplay) {
          setCountdown(progressDisplay);
        }

        const circularProgress = Math.max(0, Math.min(1, progressPercentage / 100));

        if (Math.abs(circularProgress - progressPercent) > 0.01) {
          setProgressPercent(circularProgress);
          Animated.timing(progressAnimation, {
            toValue: circularProgress,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease),
          }).start();
        }
      }
    } else {
      // Fallback to proportional countdown
      const hoursRemaining = Math.floor(diffSeconds / 3600);
      const minutesRemaining = Math.floor((diffSeconds % 3600) / 60);
      const secondsRemaining = diffSeconds % 60;
      const basicProgress = Math.min(100, Math.max(0, 100 - (diffSeconds / (6 * 3600)) * 100));
      const oneHourInSeconds = 3600;

      if (diffSeconds <= oneHourInSeconds) {
        const timeDisplay = `${minutesRemaining}m ${secondsRemaining}s`;
        if (countdown !== timeDisplay) {
          setCountdown(timeDisplay);
        }

        const hourElapsed = oneHourInSeconds - diffSeconds;
        const hourProgress = Math.max(0, Math.min(1, hourElapsed / oneHourInSeconds));

        if (Math.abs(hourProgress - progressPercent) > 0.01) {
          setProgressPercent(hourProgress);
          Animated.timing(progressAnimation, {
            toValue: hourProgress,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease),
          }).start();
        }
      } else {
        const progressDisplay = `${hoursRemaining}h ${minutesRemaining}m`;
        if (countdown !== progressDisplay) {
          setCountdown(progressDisplay);
        }

        const circularProgress = Math.max(0, Math.min(1, basicProgress / 100));

        if (Math.abs(circularProgress - progressPercent) > 0.01) {
          setProgressPercent(circularProgress);
          Animated.timing(progressAnimation, {
            toValue: circularProgress,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease),
          }).start();
        }
      }
    }

    if (countdownLoading) {
      setCountdownLoading(false);
    }
  }, [
    nextPrayer,
    currentDay,
    progressPercent,
    countdown,
    prayerTimes,
    lastPrayerTime,
    countdownLoading,
    updateNextPrayer,
  ]);

  // ── Date management ─────────────────────────────────
  const checkDayChange = () => {
    const now = Date.now();
    if (now - lastDateCheckTime < 60000) return;

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

      const keys = await AsyncStorage.getAllKeys();
      const prayerKeys = keys.filter((key) => key.startsWith('prayer_'));
      if (prayerKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerKeys);
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem('last_refresh_date', today);
      setLastRefreshDate(today);

      await fetchAndCachePrayerTimes();

      if (notificationsEnabled) {
        const lastScheduled = await AsyncStorage.getItem('last_notification_scheduled');
        const now = Date.now();
        if (!lastScheduled || now - parseInt(lastScheduled) > 60000) {
          console.log('Refresh: Rescheduling notifications after cache clear');
          await scheduleNotificationsForToday();
        } else {
          console.log('Refresh: Skipping notification rescheduling - recently scheduled');
        }
      }

      if (showAlerts) {
        Alert.alert(t('cacheCleared'), 'Fresh prayer times loaded', [{ text: t('ok') }]);
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      if (showAlerts) {
        Alert.alert(t('error'), t('failedCache'), [{ text: t('ok') }]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // ── Initialize last refresh date on startup ─────────
  useEffect(() => {
    const getLastRefreshDate = async () => {
      try {
        const storedDate = await AsyncStorage.getItem('last_refresh_date');
        if (storedDate) setLastRefreshDate(storedDate);
        setLastDateCheckTime(Date.now());
      } catch (error) {
        console.error('Error getting last refresh date:', error);
      }
    };
    getLastRefreshDate();
  }, []);

  // ── Main data fetching effect ───────────────────────
  useEffect(() => {
    setProgressPercent(0);
    progressAnimation.setValue(0);

    if (location && method !== undefined && tuningParams !== undefined) {
      console.log(`Fetching prayer times for day +${currentDay}, location: ${location}`);

      const fetchDataWithRetry = async () => {
        try {
          await fetchPrayerTimes();
        } catch (error) {
          console.error('Error in data fetch effect:', error);
          if (!prayerTimes) {
            console.log('Retrying data fetch in 2 seconds...');
            setTimeout(() => {
              fetchPrayerTimes().catch((err) => {
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
      setTimeout(() => {
        if (loading && (!location || method === undefined || tuningParams === undefined)) {
          console.log('Configuration incomplete, stopping loading state');
          if (isFirstLoad) {
            console.log('First load with incomplete config, forcing default config...');
            // NOTE: cannot set region state here — the orchestrator should
            // handle this via useHomeRegion. Kept for behavioural parity.
          }
          setLoading(false);
        }
      }, 3000);
    }

    const dateCheckTimer = setInterval(() => {
      checkDayChange();
    }, 60000);

    return () => {
      clearInterval(dateCheckTimer);
    };
  }, [currentDay, lastRefreshDate, location, method, tuningParams, isFirstLoad]);

  // ── Timer management — only when app is in foreground
  useEffect(() => {
    let countdownTimer: NodeJS.Timeout | null = null;

    if (nextPrayer && appState === 'active') {
      updateCountdown();
      countdownTimer = setInterval(updateCountdown, 1000);
    }

    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [updateCountdown, nextPrayer, appState]);

  // ── Reset progress when next prayer changes ─────────
  useEffect(() => {
    if (nextPrayer) {
      setCountdownLoading(true);
      const resetTimeout = setTimeout(() => {
        progressAnimation.setValue(0);
        setProgressPercent(0);
        setCountdownLoading(false);
      }, 150);
      return () => clearTimeout(resetTimeout);
    }
  }, [nextPrayer]);

  // ── checkDayChange on date/notification changes ─────
  useEffect(() => {
    checkDayChange();
  }, [currentDate, notificationsEnabled, currentDay]);

  // ── Day navigation ──────────────────────────────────
  const goToPreviousDay = () => {
    if (currentDay > 0) {
      const newDay = currentDay - 1;
      setCurrentDay(newDay);
      if (newDay === 0) {
        setCurrentDate(new Date());
      } else {
        setCurrentDate((prevDate) => addDays(prevDate, -1));
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
      setCurrentDate((prevDate) => addDays(prevDate, 1));
      setNextPrayer(null);
      setCountdown('');
      console.log(`Moving to day +${newDay}`);
    }
  };

  const goToToday = () => {
    setCurrentDay(0);
    setCurrentDate(new Date());
    setNextPrayer(null);
    setCountdown('');
  };

  const handleRefreshPress = () => {
    clearCache(true);
  };

  return {
    prayerTimes,
    setPrayerTimes,
    currentDate,
    setCurrentDate,
    loading,
    setLoading,
    currentDay,
    setCurrentDay,
    nextPrayer,
    setNextPrayer,
    countdown,
    setCountdown,
    countdownLoading,
    lastPrayerTime,
    refreshing,
    progressAnimation,
    progressPercent,
    lastRefreshDate,
    setLastRefreshDate,
    convertTo12HourFormat,
    fetchPrayerTimes,
    fetchAndCachePrayerTimes,
    clearCache,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    handleRefreshPress,
    updateNextPrayer,
  };
}
