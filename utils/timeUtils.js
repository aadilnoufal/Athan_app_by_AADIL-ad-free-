// Utility functions for handling prayer time calculations and timezone issues
import { getPrayerTimesFromLocalData } from './localPrayerData';

/**
 * Creates a proper Date object for prayer time that handles timezone correctly
 * @param {string} timeStr - Time in 24h format (e.g., "15:30")
 * @param {number} dayOffset - Number of days to add (0 = today, 1 = tomorrow)
 * @returns {Date} Properly formatted date object
 */
export const createPrayerDate = (timeStr, dayOffset = 0) => {
  if (!timeStr || timeStr === '--:--') {
    return null;
  }
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) {
    console.warn(`Invalid time format: ${timeStr}`);
    return null;
  }
  
  // Create date using local timezone
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0); // Set seconds and milliseconds to 0
  
  return date;
};

/**
 * Finds the next prayer from a list of prayer times
 * @param {Object} prayerTimes - Object with prayer names and times
 * @param {Object} prayerTimes12h - Object with 12h formatted times (optional)
 * @param {number} dayOffset - Day offset (0 = today)
 * @returns {Object|null} Next prayer object or null
 */
export const findNextPrayer = (prayerTimes, prayerTimes12h = null, dayOffset = 0) => {
  if (!prayerTimes) {
    console.log('[PRYR_DEBUG] findNextPrayer: prayerTimes is null/undefined');
    return null;
  }
  
  const now = new Date();
  const prayers = [];
  
  // Build array of valid prayers
  Object.entries(prayerTimes).forEach(([prayerName, timeStr]) => {
    const prayerDate = createPrayerDate(timeStr, dayOffset);
    if (prayerDate) {
      prayers.push({
        name: prayerName,
        time: prayerTimes12h ? prayerTimes12h[prayerName] : convertTo12HourFormat(timeStr),
        timeRaw: timeStr,
        date: prayerDate
      });
    }
  });
  
  if (prayers.length === 0) {
    return null;
  }
  
  // Sort prayers by time
  prayers.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  if (dayOffset === 0) {
    // For today, find next prayer that hasn't passed
    // Add 1 second to now to ensure we skip the current prayer if we're exactly at its time
    const lookAheadTime = now.getTime() + 1000;
    const nextPrayer = prayers.find(prayer => prayer.date.getTime() >= lookAheadTime);
    
    if (nextPrayer) {
      console.log('[PRYR_DEBUG] findNextPrayer: next=', nextPrayer.name, 'at', nextPrayer.timeRaw);
      return nextPrayer;
    }
    
    // All prayers passed — return tomorrow's Fajr using TOMORROW's actual data.
    console.log('[PRYR_DEBUG] findNextPrayer: all prayers passed, looking up tomorrow Fajr');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowData = getPrayerTimesFromLocalData(tomorrow);
    const tomorrowFajrRaw =
      tomorrowData?.times?.Fajr && tomorrowData.times.Fajr !== '--:--'
        ? tomorrowData.times.Fajr
        : prayers.find(p => p.name === 'Fajr')?.timeRaw; // last-resort fallback

    if (tomorrowFajrRaw) {
      const tomorrowFajrDate = createPrayerDate(tomorrowFajrRaw, 1);
      return {
        name: 'Fajr (Tomorrow)',
        time: convertTo12HourFormat(tomorrowFajrRaw),
        timeRaw: tomorrowFajrRaw,
        date: tomorrowFajrDate,
      };
    }
  }
  
  // For future days or fallback, return first prayer
  return prayers[0];
};

/**
 * Converts 24h time to 12h format
 * @param {string} timeStr - Time in 24h format
 * @returns {string} Time in 12h format with AM/PM
 */
export const convertTo12HourFormat = (timeStr) => {
  if (!timeStr || timeStr === '--:--') {
    return timeStr;
  }
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) {
    return timeStr;
  }
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Calculates time remaining until target date
 * @param {Date} targetDate - Target date/time
 * @returns {Object} Object with hours, minutes, seconds, and formatted string
 */
export const calculateTimeRemaining = (targetDate) => {
  if (!targetDate) {
    return { hours: 0, minutes: 0, seconds: 0, formatted: '00:00:00' };
  }
  
  const now = new Date();
  const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
  const diffSeconds = Math.floor(diffMs / 1000);
  
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;
  
  const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  return { hours, minutes, seconds, formatted, totalSeconds: diffSeconds };
};

/**
 * Checks if two dates are the same prayer time (within 1 second tolerance)
 * @param {Date} date1 
 * @param {Date} date2 
 * @returns {boolean}
 */
export const isSamePrayerTime = (date1, date2) => {
  if (!date1 || !date2) return false;
  return Math.abs(date1.getTime() - date2.getTime()) <= 1000; // 1 second tolerance
};
