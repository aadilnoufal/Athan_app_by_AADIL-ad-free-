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
import { updateWidgetData, updateWidgetDataImmediate, type WidgetData } from '../../utils/widgetDataBridge';
import { findNextPrayer, isSamePrayerTime } from '../../utils/timeUtils';
import { getIqamaTime, hasIqama } from '../../utils/iqamaConfig';
import { getWidgetLocalizedLabels } from '../../utils/notificationTextResolver';
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
  console.log('[PRYR_DEBUG] useHomePrayerData: Hook initialized with regionId:', params.regionId, 'location:', params.location);
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
  const [refreshing, setRefreshing] = useState(false);
  const [progressAnimation] = useState(new Animated.Value(0));
  const [progressPercent, setProgressPercent] = useState(0);
  const [lastRefreshDate, setLastRefreshDate] = useState('');
  const [lastDateCheckTime, setLastDateCheckTime] = useState(0);
  // Iqama countdown state: 'prayer' = counting to next prayer, 'iqama' = counting to iqama
  const [countdownMode, setCountdownMode] = useState<'prayer' | 'iqama'>('prayer');
  // The prayer name whose iqama we're counting down to (only set when countdownMode is 'iqama')
  const [iqamaPrayerName, setIqamaPrayerName] = useState<string | null>(null);
  // The iqama target time (only set when countdownMode is 'iqama')
  const [iqamaTargetTime, setIqamaTargetTime] = useState<Date | null>(null);
  // Whether the iqama countdown is enabled in settings (default false)
  const [iqamaCountdownEnabled, setIqamaCountdownEnabled] = useState(false);

  // ── Refs ────────────────────────────────────────────
  // Track the identity of nextPrayer by name+time so that the reset
  // effect only fires when the prayer actually changes (not just a
  // new object reference with the same values).
  const nextPrayerKeyRef = useRef<string>('');
  const lastCountdownLog = useRef<string>('');
  const countdownTriggeredRefresh = useRef<string>('');
  // Track current nextPrayer to avoid stale-closure reads in updateNextPrayer
  const nextPrayerRef = useRef<NextPrayer | null>(null);
  nextPrayerRef.current = nextPrayer;
  // Ref to hold the latest updateCountdown function so the setInterval doesn't
  // need to be torn down and rebuilt every time the callback identity changes.
  const updateCountdownRef = useRef<() => void>(() => { });
  // Ref mirror of notificationsEnabled so long-lived closures always read the latest value
  const notificationsEnabledLocalRef = useRef(notificationsEnabled);
  useEffect(() => { notificationsEnabledLocalRef.current = notificationsEnabled; }, [notificationsEnabled]);

  // ── Load iqama countdown setting + listen for changes ──────────
  useEffect(() => {
    const loadIqamaSetting = async () => {
      try {
        const val = await AsyncStorage.getItem('iqama_countdown_enabled');
        setIqamaCountdownEnabled(val === 'true');
      } catch { }
    };
    loadIqamaSetting();

    // Re-check when app returns to foreground (user may have changed setting)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadIqamaSetting();
    });
    return () => sub.remove();
  }, []);

  // ── convertTo12HourFormat ───────────────────────────
  const convertTo12HourFormat = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Track whether this is the first fetch (for immediate widget update)
  const isFirstFetchRef = useRef(true);

  // Ref to track inner retry timers so they can be cleared on effect cleanup
  const innerRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track the notification scheduling timer so it can be cleared on unmount
  const notifScheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── fetchAndCachePrayerTimes ────────────────────────
  const fetchAndCachePrayerTimes = async (retryCount = 0, overrideRegionId?: string) => {
    console.log('[PRYR_DEBUG] fetchAndCachePrayerTimes: START retryCount:', retryCount, 'regionId:', regionId, 'currentDay:', currentDay);
    try {
      const fetchDate = addDays(new Date(), currentDay);
      const formattedDate = format(fetchDate, 'dd-MM-yyyy');

      console.log('[PRYR_DEBUG] fetchAndCachePrayerTimes: fetchDate:', formattedDate, 'location:', location);

      console.log(`Fetching FRESH prayer times for ${formattedDate}, location: ${location}`);

      const localData = getPrayerTimesFromLocalData(fetchDate) as PrayerData | null;
      console.log('[PRYR_DEBUG] fetchAndCachePrayerTimes: localData result:', localData ? 'FOUND' : 'NULL', localData ? JSON.stringify(localData.times) : 'N/A');

      if (localData) {
        console.log(`Using local CSV prayer time data for ${formattedDate}`);

        const effectiveRegionId = overrideRegionId || regionId;
        const cityId = extractCityIdFromRegionId(effectiveRegionId);
        console.log(`Applying local data adjustments for city: ${cityId}`);

        let timings = { ...localData.times } as any;
        console.log('[PRYR_DEBUG] fetchAndCachePrayerTimes: Before city adjustments:', JSON.stringify(timings));
        timings = applyLocalDataCityAdjustments(timings, cityId, true);
        console.log('[PRYR_DEBUG] fetchAndCachePrayerTimes: After city adjustments:', JSON.stringify(timings));

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
        console.log('[PRYR_DEBUG] fetchAndCachePrayerTimes: Prayer times set, calling updateNextPrayer');
        updateNextPrayer(formattedTimes);
        setLoading(false);

        // Push today's city-tuned prayer times to native widgets
        if (currentDay === 0) {
          try {
            // Read current theme mode from AsyncStorage for widget payload
            const currentTheme = await AsyncStorage.getItem('app_theme_mode_v2') || 'dark';

            // Fetch tomorrow's Fajr for accurate post-Isha countdown
            let tomorrowFajrMinutes: number | undefined;
            try {
              const tomorrowDate = addDays(new Date(), 1);
              const tomorrowData = getPrayerTimesFromLocalData(tomorrowDate) as PrayerData | null;
              if (tomorrowData) {
                let tomorrowTimings = { ...tomorrowData.times } as any;
                tomorrowTimings = applyLocalDataCityAdjustments(tomorrowTimings, cityId, true);
                const [h, m] = tomorrowTimings.Fajr.split(':').map(Number);
                if (!isNaN(h) && !isNaN(m)) {
                  tomorrowFajrMinutes = h * 60 + m;
                }
              }
            } catch (e) {
              console.log('ℹ️ Could not fetch tomorrow Fajr for widget (non-critical)');
            }

            // Read current language for widget localization
            let widgetLang = 'en';
            try {
              const storedLang = await AsyncStorage.getItem('app_language');
              if (storedLang === 'ar') widgetLang = 'ar';
            } catch { }

            const widgetPayload: WidgetData = {
              times: timings,
              times12h: formattedTimes.times12h as any,
              date: format(fetchDate, 'dd-MM'),
              cityId,
              themeMode: currentTheme,
              lastUpdated: Date.now(),
              tomorrowFajrMinutes,
              language: widgetLang,
              localizedLabels: getWidgetLocalizedLabels(widgetLang),
            };
            // Use immediate update on first load, debounced for subsequent updates
            if (isFirstFetchRef.current) {
              updateWidgetDataImmediate(widgetPayload);
              isFirstFetchRef.current = false;
            } else {
              updateWidgetData(widgetPayload);
            }
          } catch (widgetErr) {
            console.log('⚠️ Widget data sync failed (non-critical):', widgetErr);
          }
        }

        if (currentDay === 0 && notificationsEnabledLocalRef.current) {
          console.log('[PRYR_DEBUG] fetchAndCachePrayerTimes: Scheduling notification timer for today (currentDay=0, notifEnabled=true)');
          // Clear any existing timer before creating a new one to prevent duplicate scheduling
          if (notifScheduleTimerRef.current) clearTimeout(notifScheduleTimerRef.current);
          notifScheduleTimerRef.current = setTimeout(async () => {
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
      console.error('[PRYR_DEBUG] fetchAndCachePrayerTimes: ERROR:', error);
      console.error('Error fetching prayer times:', error);
      if (retryCount < 3) {
        console.log(`Retrying prayer time fetch (attempt ${retryCount + 1} of 3)...`);
        const delay = Math.pow(2, retryCount) * 1000;
        // Clear any existing retry timer to prevent duplicate retries
        if (innerRetryTimerRef.current) clearTimeout(innerRetryTimerRef.current);
        innerRetryTimerRef.current = setTimeout(() => {
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
    console.log('[PRYR_DEBUG] fetchPrayerTimes: START, prayerTimes exists:', !!prayerTimes, 'isFirstLoad:', isFirstLoad);
    try {
      // Only show full-screen loading spinner when there is no existing data.
      // When data already exists, the fetch happens silently in the background
      // to avoid the circular progress disappearing momentarily.
      if (!prayerTimes) {
        setLoading(true);
      }
      console.log('Always fetching fresh data - no cache used');

      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Request timeout')), 15000);
      });

      if (isFirstLoad || !prayerTimes) {
        console.log('Fetching prayer times for first load or after no data...');
      }

      try {
        await Promise.race([fetchAndCachePrayerTimes(), timeoutPromise]);
      } finally {
        clearTimeout(timeoutId!);
      }
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
        setIsFirstLoad(false);
      }

      Alert.alert(t('connectionError'), t('connectionErrorMessage'), [{ text: t('ok') }]);
      setLoading(false);
    }
  };

  // ── updateNextPrayer ────────────────────────────────
  const updateNextPrayer = (data: PrayerData): void => {
    console.log('[PRYR_DEBUG] updateNextPrayer: Called with data:', data ? JSON.stringify(data.times) : 'NULL');
    if (!data || !data.times) {
      if (__DEV__) console.log('⚠️ updateNextPrayer: No prayer data available');
      return;
    }

    if (__DEV__) console.log('🔄 Calculating next prayer time...');

    const next = findNextPrayer(data.times, data.times12h, currentDay) as NextPrayer | null;

    if (next) {
      // Read from ref to avoid stale closure — nextPrayerRef always holds the latest value
      const current = nextPrayerRef.current;
      if (__DEV__) {
        console.log(`📋 findNextPrayer returned: ${next.name} at ${next.time}`);
        console.log(`📋 Current nextPrayer: ${current?.name || 'none'}`);
      }

      const isDifferent =
        !current ||
        current.name !== next.name ||
        !isSamePrayerTime(current.date, next.date);

      if (__DEV__) console.log(`📋 isDifferent: ${isDifferent}`);

      if (isDifferent) {
        if (__DEV__) console.log(`🔄 Next prayer updated: ${next.name} at ${next.time}`);
        setNextPrayer(next);
        setCountdown('');
        setCountdownLoading(true);
        countdownTriggeredRefresh.current = '';
      } else {
        if (__DEV__) console.log(`⏱️ Next prayer unchanged: ${next.name} at ${next.time}`);
      }
    } else {
      if (__DEV__) console.log('⚠️ Could not determine next prayer time');
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

  // ── findLastPassedPrayerWithIqama ───────────────────
  // Returns the most recently passed prayer that has iqama, plus its iqama time.
  // Used to determine if we should show iqama countdown vs next prayer countdown.
  const findLastPassedPrayerWithIqama = (times: any): { prayerName: string; adhanTime: Date; iqamaTime: Date } | null => {
    if (!times) return null;

    const now = new Date();
    const prayerNames = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    let result: { prayerName: string; adhanTime: Date; iqamaTime: Date } | null = null;

    for (const prayerName of prayerNames) {
      if (!hasIqama(prayerName)) continue;
      const timeStr = times[prayerName];
      if (!timeStr || timeStr === '--:--') continue;

      const [hour, minute] = timeStr.split(':').map(Number);
      if (isNaN(hour) || isNaN(minute)) continue;

      const adhanDate = new Date();
      adhanDate.setHours(hour, minute, 0, 0);

      // Only consider prayers that have passed
      if (adhanDate <= now) {
        const iqamaDate = getIqamaTime(prayerName, adhanDate);
        if (iqamaDate) {
          result = { prayerName, adhanTime: adhanDate, iqamaTime: iqamaDate };
        }
      }
    }

    return result;
  };

  // ── updateCountdown ─────────────────────────────────
  const updateCountdown = useCallback(() => {
    if (!nextPrayer) {
      // Don't log every 100ms when there's no next prayer
      return;
    }

    const now = new Date();
    const prayerTime = new Date(nextPrayer.date);
    const diffSeconds = Math.max(0, differenceInSeconds(prayerTime, now));

    // ── Iqama countdown check ──────────────────────────
    // After a prayer's adhan passes, show countdown to iqama first.
    // Once iqama passes, switch back to counting down to the next prayer.
    // Only active when the user has enabled the iqama countdown setting.
    if (iqamaCountdownEnabled && currentDay === 0 && prayerTimes?.times) {
      const lastPassed = findLastPassedPrayerWithIqama(prayerTimes.times);
      if (lastPassed && lastPassed.iqamaTime > now) {
        // We are between adhan and iqama — show iqama countdown
        const iqamaDiff = Math.max(0, differenceInSeconds(lastPassed.iqamaTime, now));

        if (iqamaDiff > 0) {
          const minutesRemaining = Math.floor(iqamaDiff / 60);
          const secondsRemaining = iqamaDiff % 60;
          const iqamaDisplay = `${minutesRemaining}m ${secondsRemaining}s`;

          if (countdown !== iqamaDisplay) {
            setCountdown(iqamaDisplay);
          }

          // Update mode to iqama
          if (countdownMode !== 'iqama' || iqamaPrayerName !== lastPassed.prayerName) {
            setCountdownMode('iqama');
            setIqamaPrayerName(lastPassed.prayerName);
            setIqamaTargetTime(lastPassed.iqamaTime);
          }

          // Progress: how much of the iqama wait has elapsed
          const iqamaTotalSpan = differenceInSeconds(lastPassed.iqamaTime, lastPassed.adhanTime);
          const iqamaElapsed = differenceInSeconds(now, lastPassed.adhanTime);
          const iqamaProgress = iqamaTotalSpan > 0
            ? Math.max(0, Math.min(1, iqamaElapsed / iqamaTotalSpan))
            : 0;

          if (Math.abs(iqamaProgress - progressPercent) > 0.01) {
            setProgressPercent(iqamaProgress);
            Animated.timing(progressAnimation, {
              toValue: iqamaProgress,
              duration: 300,
              useNativeDriver: false,
              easing: Easing.out(Easing.ease),
            }).start();
          }

          if (countdownLoading) {
            setCountdownLoading(false);
          }
          return;
        }
      }

      // If we were in iqama mode but iqama has now passed, switch back to prayer mode
      if (countdownMode === 'iqama') {
        setCountdownMode('prayer');
        setIqamaPrayerName(null);
        setIqamaTargetTime(null);
        // Reset progress for the next prayer countdown
        progressAnimation.setValue(0);
        setProgressPercent(0);
      }
    }

    // ── Normal next-prayer countdown ──────────────────
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

    // Ensure we are in prayer countdown mode
    if (countdownMode !== 'prayer') {
      setCountdownMode('prayer');
      setIqamaPrayerName(null);
      setIqamaTargetTime(null);
    }

    // ✨ ENHANCED COUNTDOWN LOGIC ✨
    const lastPrayer = findLastPrayer(prayerTimes?.times, prayerTimes?.times12h);

    if (lastPrayer) {
      const totalTimeSpan = differenceInSeconds(prayerTime, lastPrayer);
      const elapsedTime = differenceInSeconds(now, lastPrayer);
      const remainingTime = differenceInSeconds(prayerTime, now);
      const progressPercentage = totalTimeSpan > 0
        ? Math.min(100, Math.max(0, (elapsedTime / totalTimeSpan) * 100))
        : 0;

      if (__DEV__) {
        console.log(
          `⏱️ Enhanced Countdown: ${Math.round(progressPercentage)}% progress, ${Math.floor(remainingTime / 60)}m remaining`,
        );
      }

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
    countdownLoading,
    countdownMode,
    iqamaPrayerName,
    iqamaCountdownEnabled,
    updateNextPrayer,
  ]);

  // Keep ref in sync so the stable setInterval always calls the latest version
  updateCountdownRef.current = updateCountdown;

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
    console.log('[PRYR_DEBUG] clearCache: START, showAlerts:', showAlerts);
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

      if (notificationsEnabledLocalRef.current) {
        const lastScheduled = await AsyncStorage.getItem('last_notification_scheduled');
        const now = Date.now();
        const parsedTimestamp = lastScheduled ? parseInt(lastScheduled, 10) : NaN;
        if (!lastScheduled || isNaN(parsedTimestamp) || now - parsedTimestamp > 60000) {
          console.log('Refresh: Rescheduling notifications after cache clear');
          await scheduleNotificationsForToday();
        } else {
          console.log('Refresh: Skipping notification rescheduling - recently scheduled');
        }
      }

      if (showAlerts) {
        Alert.alert(t('cacheCleared'), t('freshPrayerTimesLoaded'), [{ text: t('ok') }]);
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
    // Only reset progress visuals when there is no existing data.
    // When data already exists (e.g. lastRefreshDate change or day-change
    // auto-refresh), we keep the current progress intact so the circular
    // progress ring does not flash empty.
    if (!prayerTimes) {
      setProgressPercent(0);
      progressAnimation.setValue(0);
    }

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let configTimer: ReturnType<typeof setTimeout> | null = null;

    if (location && method !== undefined && tuningParams !== undefined) {
      console.log('[PRYR_DEBUG] useHomePrayerData: Main data effect triggered, day:', currentDay, 'location:', location, 'method:', method);
      console.log(`Fetching prayer times for day +${currentDay}, location: ${location}`);

      const fetchDataWithRetry = async () => {
        try {
          await fetchPrayerTimes();
        } catch (error) {
          console.error('Error in data fetch effect:', error);
          if (!prayerTimes) {
            console.log('Retrying data fetch in 2 seconds...');
            retryTimer = setTimeout(() => {
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
      console.log('[PRYR_DEBUG] useHomePrayerData: Config incomplete - location:', location, 'method:', method, 'tuningParams:', tuningParams);
      configTimer = setTimeout(() => {
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
      if (retryTimer) clearTimeout(retryTimer);
      if (configTimer) clearTimeout(configTimer);
      if (innerRetryTimerRef.current) clearTimeout(innerRetryTimerRef.current);
      if (notifScheduleTimerRef.current) clearTimeout(notifScheduleTimerRef.current);
    };
  }, [currentDay, lastRefreshDate, location, method, tuningParams, isFirstLoad]);

  // ── Timer management — only when app is in foreground
  // Uses updateCountdownRef so the interval is stable and only torn
  // down when nextPrayer or appState changes (not every render).
  useEffect(() => {
    let countdownTimer: NodeJS.Timeout | null = null;

    if (nextPrayer && appState === 'active') {
      updateCountdownRef.current();
      countdownTimer = setInterval(() => updateCountdownRef.current(), 1000);
    }

    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [nextPrayer, appState]);

  // ── Reset progress when next prayer ACTUALLY changes ─
  // We track a stable key (name + time) instead of the object reference.
  // This prevents spurious resets caused by React creating a new object
  // with the same values (e.g. when returning from a frozen tab).
  const nextPrayerKey = nextPrayer
    ? `${nextPrayer.name}|${nextPrayer.date?.getTime() ?? ''}`
    : '';

  // ── Track next prayer identity ─────────────────────
  // This effect simply keeps the ref in sync.  Progress is no longer
  // reset here — updateCountdown handles all progress transitions
  // smoothly via Animated.timing, avoiding the flash-to-zero visual
  // artifact that the old delayed reset caused.
  useEffect(() => {
    if (!nextPrayer || !nextPrayerKey) return;

    const prevKey = nextPrayerKeyRef.current;
    if (prevKey !== nextPrayerKey) {
      if (__DEV__) console.log(`Prayer key updated: ${prevKey || '(empty)'} → ${nextPrayerKey}`);
    }
    nextPrayerKeyRef.current = nextPrayerKey;
  }, [nextPrayerKey]);

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
    refreshing,
    progressAnimation,
    progressPercent,
    lastRefreshDate,
    setLastRefreshDate,
    countdownMode,
    iqamaPrayerName,
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
