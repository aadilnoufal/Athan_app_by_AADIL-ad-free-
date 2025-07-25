// Prayer times data source - More accurate local data
// Falls back to API if date is not found

// Raw CSV data as provided
const PRAYER_TIMES_CSV = `Date,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Isha
01-07-2025,03:17,04:47,11:39,03:02,06:30,08:00
02-07-2025,03:17,04:47,11:39,03:02,06:30,08:00
03-07-2025,03:18,04:48,11:39,03:02,06:30,08:00
04-07-2025,03:18,04:48,11:39,03:03,06:30,08:00
05-07-2025,03:18,04:48,11:39,03:03,06:30,08:00
06-07-2025,03:19,04:49,11:40,03:03,06:30,08:00
07-07-2025,03:20,04:49,11:40,03:03,06:30,08:00
08-07-2025,03:20,04:50,11:40,03:04,06:30,08:00
09-07-2025,03:21,04:50,11:40,03:04,06:30,08:00
10-07-2025,03:21,04:51,11:40,03:04,06:30,08:00
11-07-2025,03:22,04:51,11:40,03:04,06:30,08:00
12-07-2025,03:22,04:51,11:40,03:05,06:29,07:59
13-07-2025,03:23,04:52,11:41,03:05,06:29,07:59
14-07-2025,03:24,04:52,11:41,03:05,06:29,07:59
15-07-2025,03:24,04:53,11:41,03:05,06:29,07:59
16-07-2025,03:25,04:53,11:41,03:06,06:28,07:58
17-07-2025,03:25,04:54,11:41,03:06,06:28,07:58
18-07-2025,03:26,04:54,11:41,03:06,06:28,07:58
19-07-2025,03:27,04:55,11:41,03:06,06:27,07:57
20-07-2025,03:27,04:55,11:41,03:07,06:27,07:57
21-07-2025,03:28,04:56,11:41,03:07,06:27,07:57
22-07-2025,03:29,04:56,11:41,03:07,06:26,07:56
23-07-2025,03:29,04:56,11:41,03:07,06:26,07:56
24-07-2025,03:30,04:57,11:41,03:07,06:26,07:56
25-07-2025,03:31,04:57,11:41,03:08,06:25,07:55
26-07-2025,03:31,04:58,11:41,03:08,06:25,07:55
27-07-2025,03:32,04:58,11:41,03:08,06:24,07:54
28-07-2025,03:33,04:59,11:41,03:08,06:24,07:54
29-07-2025,03:33,04:59,11:41,03:08,06:23,07:53
30-07-2025,03:34,05:00,11:41,03:08,06:22,07:52
31-07-2025,03:35,05:00,11:41,03:08,06:22,07:52
01-08-2025,03:36,05:01,11:41,03:08,06:21,07:51
02-08-2025,03:36,05:01,11:41,03:09,06:21,07:51
03-08-2025,03:37,05:02,11:41,03:09,06:20,07:50
04-08-2025,03:38,05:02,11:41,03:09,06:19,07:49
05-08-2025,03:38,05:03,11:41,03:09,06:19,07:49
06-08-2025,03:39,05:03,11:41,03:09,06:18,07:48
07-08-2025,03:40,05:04,11:41,03:09,06:17,07:47
08-08-2025,03:40,05:04,11:41,03:09,06:17,07:47
09-08-2025,03:41,05:05,11:40,03:09,06:16,07:46
10-08-2025,03:42,05:05,11:40,03:09,06:15,07:45
11-08-2025,03:42,05:06,11:40,03:09,06:14,07:44
12-08-2025,03:43,05:06,11:40,03:09,06:14,07:44
13-08-2025,03:44,05:06,11:40,03:09,06:13,07:43
14-08-2025,03:44,05:07,11:40,03:08,06:12,07:42
15-08-2025,03:45,05:07,11:39,03:08,06:11,07:41
16-08-2025,03:46,05:08,11:39,03:08,06:10,07:40
17-08-2025,03:46,05:08,11:39,03:08,06:09,07:39
18-08-2025,03:47,05:09,11:39,03:08,06:09,07:39
19-08-2025,03:47,05:09,11:39,03:08,06:08,07:38
20-08-2025,03:48,05:09,11:38,03:08,06:07,07:37
21-08-2025,03:49,05:10,11:38,03:07,06:06,07:36
22-08-2025,03:49,05:10,11:38,03:07,06:05,07:35
23-08-2025,03:50,05:11,11:38,03:07,06:04,07:34
24-08-2025,03:50,05:11,11:37,03:07,06:03,07:33
25-08-2025,03:51,05:12,11:37,03:06,06:02,07:32
26-08-2025,03:52,05:12,11:37,03:06,06:01,07:31
27-08-2025,03:52,05:12,11:36,03:06,06:00,07:30
28-08-2025,03:53,05:13,11:36,03:06,05:59,07:29
29-08-2025,03:53,05:13,11:36,03:05,05:58,07:28
30-08-2025,03:54,05:14,11:36,03:05,05:57,07:27
31-08-2025,03:54,05:14,11:35,03:05,05:56,07:26
01-09-2025,03:55,05:14,11:35,03:04,05:55,07:25
02-09-2025,03:55,05:15,11:35,03:04,05:54,07:24
03-09-2025,03:56,05:15,11:34,03:03,05:53,07:23
04-09-2025,03:56,05:16,11:34,03:03,05:52,07:22
05-09-2025,03:57,05:16,11:34,03:03,05:51,07:21
06-09-2025,03:58,05:16,11:33,03:02,05:50,07:20
07-09-2025,03:58,05:17,11:33,03:02,05:49,07:19
08-09-2025,03:59,05:17,11:33,03:01,05:48,07:18
09-09-2025,03:59,05:17,11:32,03:01,05:47,07:17
10-09-2025,03:59,05:18,11:32,03:00,05:46,07:16
11-09-2025,04:00,05:18,11:32,03:00,05:45,07:15
12-09-2025,04:00,05:19,11:31,02:59,05:44,07:14
13-09-2025,04:01,05:19,11:31,02:59,05:43,07:13
14-09-2025,04:01,05:19,11:30,02:58,05:42,07:12
15-09-2025,04:02,05:20,11:30,02:58,05:41,07:11
16-09-2025,04:02,05:20,11:30,02:57,05:40,07:10
17-09-2025,04:03,05:20,11:29,02:57,05:38,07:08
18-09-2025,04:03,05:21,11:29,02:56,05:37,07:07
19-09-2025,04:04,05:21,11:29,02:56,05:36,07:06
20-09-2025,04:04,05:22,11:28,02:55,05:35,07:05
21-09-2025,04:05,05:22,11:28,02:55,05:34,07:04
22-09-2025,04:05,05:22,11:28,02:54,05:33,07:03
23-09-2025,04:05,05:23,11:27,02:53,05:32,07:02
24-09-2025,04:06,05:23,11:27,02:53,05:31,07:01
25-09-2025,04:06,05:23,11:27,02:52,05:30,07:00
26-09-2025,04:07,05:24,11:26,02:52,05:29,06:59
27-09-2025,04:07,05:24,11:26,02:51,05:28,06:58
28-09-2025,04:08,05:25,11:26,02:50,05:26,06:56
29-09-2025,04:08,05:25,11:25,02:50,05:25,06:55
30-09-2025,04:08,05:25,11:25,02:49,05:24,06:54
01-10-2025,04:09,05:26,11:25,02:49,05:23,06:53
02-10-2025,04:09,05:26,11:24,02:48,05:22,06:52
03-10-2025,04:10,05:27,11:24,02:47,05:21,06:51
04-10-2025,04:10,05:27,11:24,02:47,05:20,06:50
05-10-2025,04:10,05:28,11:23,02:46,05:19,06:49
06-10-2025,04:11,05:28,11:23,02:45,05:18,06:48
07-10-2025,04:11,05:28,11:23,02:45,05:17,06:47
08-10-2025,04:12,05:29,11:22,02:44,05:16,06:46
09-10-2025,04:12,05:29,11:22,02:43,05:15,06:45
10-10-2025,04:13,05:30,11:22,02:43,05:14,06:44
11-10-2025,04:13,05:30,11:22,02:42,05:13,06:43
12-10-2025,04:13,05:31,11:21,02:42,05:12,06:42
13-10-2025,04:14,05:31,11:21,02:41,05:11,06:41
14-10-2025,04:14,05:32,11:21,02:40,05:10,06:40
15-10-2025,04:15,05:32,11:21,02:40,05:09,06:39
16-10-2025,04:15,05:33,11:20,02:39,05:08,06:38
17-10-2025,04:16,05:33,11:20,02:39,05:07,06:37
18-10-2025,04:16,05:34,11:20,02:38,05:06,06:36
19-10-2025,04:17,05:34,11:20,02:37,05:05,06:35
20-10-2025,04:17,05:35,11:20,02:37,05:04,06:34
21-10-2025,04:17,05:35,11:20,02:36,05:04,06:34
22-10-2025,04:18,05:36,11:19,02:36,05:03,06:33
23-10-2025,04:18,05:36,11:19,02:35,05:02,06:32
24-10-2025,04:19,05:37,11:19,02:34,05:01,06:31
25-10-2025,04:19,05:37,11:19,02:34,05:00,06:30
26-10-2025,04:20,05:38,11:19,02:33,05:00,06:30
27-10-2025,04:20,05:38,11:19,02:33,04:59,06:29
28-10-2025,04:21,05:39,11:19,02:32,04:58,06:28
29-10-2025,04:21,05:40,11:19,02:32,04:57,06:27
30-10-2025,04:22,05:40,11:19,02:31,04:57,06:27
31-10-2025,04:22,05:41,11:18,02:31,04:56,06:26
01-11-2025,04:23,05:41,11:18,02:30,04:55,06:25
02-11-2025,04:23,05:42,11:18,02:30,04:55,06:25
03-11-2025,04:24,05:43,11:18,02:29,04:54,06:24
04-11-2025,04:24,05:43,11:18,02:29,04:53,06:23
05-11-2025,04:25,05:44,11:18,02:29,04:53,06:23
06-11-2025,04:25,05:45,11:18,02:28,04:52,06:22
07-11-2025,04:26,05:45,11:19,02:28,04:52,06:22
08-11-2025,04:26,05:46,11:19,02:27,04:51,06:21
09-11-2025,04:27,05:47,11:19,02:27,04:50,06:20
10-11-2025,04:28,05:47,11:19,02:27,04:50,06:20
11-11-2025,04:28,05:48,11:19,02:26,04:50,06:20
12-11-2025,04:29,05:49,11:19,02:26,04:49,06:19
13-11-2025,04:29,05:49,11:19,02:26,04:49,06:19
14-11-2025,04:30,05:50,11:19,02:26,04:48,06:18
15-11-2025,04:30,05:51,11:19,02:25,04:48,06:18
16-11-2025,04:31,05:51,11:20,02:25,04:48,06:18
17-11-2025,04:32,05:52,11:20,02:25,04:47,06:17
18-11-2025,04:32,05:53,11:20,02:25,04:47,06:17
19-11-2025,04:33,05:53,11:20,02:25,04:47,06:17
20-11-2025,04:33,05:54,11:20,02:24,04:46,06:16
21-11-2025,04:34,05:55,11:21,02:24,04:46,06:16
22-11-2025,04:35,05:56,11:21,02:24,04:46,06:16
23-11-2025,04:35,05:56,11:21,02:24,04:46,06:16
24-11-2025,04:36,05:57,11:21,02:24,04:46,06:16
25-11-2025,04:37,05:58,11:22,02:24,04:45,06:15
26-11-2025,04:37,05:59,11:22,02:24,04:45,06:15
27-11-2025,04:38,05:59,11:22,02:24,04:45,06:15
28-11-2025,04:38,06:00,11:23,02:24,04:45,06:15
29-11-2025,04:39,06:01,11:23,02:24,04:45,06:15
30-11-2025,04:40,06:01,11:23,02:24,04:45,06:15
01-12-2025,04:40,06:02,11:24,02:24,04:45,06:15
02-12-2025,04:41,06:03,11:24,02:24,04:45,06:15
03-12-2025,04:42,06:04,11:25,02:24,04:45,06:15
04-12-2025,04:42,06:04,11:25,02:25,04:45,06:15
05-12-2025,04:43,06:05,11:25,02:25,04:46,06:16
06-12-2025,04:43,06:06,11:26,02:25,04:46,06:16
07-12-2025,04:44,06:06,11:26,02:25,04:46,06:16
08-12-2025,04:45,06:07,11:27,02:25,04:46,06:16
09-12-2025,04:45,06:08,11:27,02:26,04:46,06:16
10-12-2025,04:46,06:08,11:28,02:26,04:47,06:17
11-12-2025,04:46,06:09,11:28,02:26,04:47,06:17
12-12-2025,04:47,06:10,11:28,02:26,04:47,06:17
13-12-2025,04:48,06:10,11:29,02:27,04:47,06:17
14-12-2025,04:48,06:11,11:29,02:27,04:48,06:18
15-12-2025,04:49,06:11,11:30,02:28,04:48,06:18
16-12-2025,04:49,06:12,11:30,02:28,04:49,06:19
17-12-2025,04:50,06:13,11:31,02:28,04:49,06:19
18-12-2025,04:50,06:13,11:31,02:29,04:49,06:19
19-12-2025,04:51,06:14,11:32,02:29,04:50,06:20
20-12-2025,04:52,06:14,11:32,02:30,04:50,06:20
21-12-2025,04:52,06:15,11:33,02:30,04:51,06:21
22-12-2025,04:53,06:15,11:33,02:31,04:51,06:21
23-12-2025,04:53,06:16,11:34,02:31,04:52,06:22
24-12-2025,04:53,06:16,11:34,02:32,04:52,06:22
25-12-2025,04:54,06:17,11:35,02:32,04:53,06:23
26-12-2025,04:54,06:17,11:35,02:33,04:53,06:23
27-12-2025,04:55,06:18,11:36,02:33,04:54,06:24
28-12-2025,04:55,06:18,11:36,02:34,04:55,06:25
29-12-2025,04:56,06:18,11:37,02:35,04:55,06:25
30-12-2025,04:56,06:19,11:37,02:35,04:56,06:26
31-12-2025,04:56,06:19,11:38,02:36,04:56,06:26`;

// Helper function to convert time to PM if needed (add 12 hours)
const convertToPMIfNeeded = (timeStr, shouldConvertToPM) => {
  if (!shouldConvertToPM) return timeStr;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  // If hours is less than 12, add 12 to make it PM
  if (hours < 12) {
    const pmHours = hours + 12;
    return `${pmHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  return timeStr; // Already in PM format
};

// Parse CSV data into a Map for quick lookup
const parseCSVData = () => {
  const lines = PRAYER_TIMES_CSV.trim().split('\n');
  const dataMap = new Map();
  
  // Skip header line (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const [date, fajr, sunrise, dhuhr, asr, maghrib, isha] = line.split(',');
    dataMap.set(date, {
      Fajr: fajr, // Keep as is (AM)
      Sunrise: sunrise, // Keep as is (AM)
      Dhuhr: dhuhr, // Keep as is (noon/PM)
      Asr: convertToPMIfNeeded(asr, true), // Convert to PM
      Maghrib: convertToPMIfNeeded(maghrib, true), // Convert to PM
      Isha: convertToPMIfNeeded(isha, true) // Convert to PM
    });
  }
  
  return dataMap;
};

// Initialize the data map
const PRAYER_DATA_MAP = parseCSVData();

// Helper function to convert 24h to 12h format
const convertTo12HourFormat = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Helper function to format date for lookup (DD-MM-YYYY)
const formatDateForLookup = (date) => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper function to format date for display
const formatDateForDisplay = (date) => {
  const options = { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  };
  return date.toLocaleDateString('en-GB', options);
};

// Helper function to get Hijri date (simplified approximation)
const getHijriDate = (gregorianDate) => {
  // This is a simplified approximation - for production use a proper Hijri calendar library
  const HIJRI_EPOCH = new Date('622-07-16'); // Approximate start of Hijri calendar
  const daysDiff = Math.floor((gregorianDate - HIJRI_EPOCH) / (1000 * 60 * 60 * 24));
  const hijriYear = Math.floor(daysDiff / 354.37) + 1; // Approximate Hijri year
  const hijriDayOfYear = daysDiff % 354;
  const hijriMonth = Math.floor(hijriDayOfYear / 29.5) + 1;
  const hijriDay = (hijriDayOfYear % 29) + 1;
  
  const hijriMonths = [
    'Muharram', 'Safar', 'Rabi\' al-awwal', 'Rabi\' al-thani',
    'Jumada al-awwal', 'Jumada al-thani', 'Rajab', 'Sha\'ban',
    'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
  ];
  
  const monthName = hijriMonths[Math.min(hijriMonth - 1, 11)] || 'Unknown';
  
  return {
    date: `${hijriDay.toString().padStart(2, '0')} ${monthName} ${hijriYear}`,
    month: monthName
  };
};

/**
 * Get prayer times from local CSV data
 * @param {Date} date - The date to get prayer times for
 * @returns {Object|null} - Prayer times data or null if not found
 */
export const getPrayerTimesFromLocalData = (date) => {
  const dateKey = formatDateForLookup(date);
  const prayerTimes = PRAYER_DATA_MAP.get(dateKey);
  
  if (!prayerTimes) {
    console.log(`No local prayer time data found for ${dateKey}`);
    return null;
  }
  
  console.log(`Using local prayer time data for ${dateKey}`);
  
  // Get Hijri date
  const hijriInfo = getHijriDate(date);
  
  // Format the data to match the expected structure
  return {
    date: formatDateForDisplay(date),
    hijriDate: hijriInfo.date,
    hijriMonth: hijriInfo.month,
    gregorianDate: formatDateForLookup(date),
    times: {
      Fajr: prayerTimes.Fajr,
      Sunrise: prayerTimes.Sunrise,
      Dhuhr: prayerTimes.Dhuhr,
      Asr: prayerTimes.Asr,
      Maghrib: prayerTimes.Maghrib,
      Isha: prayerTimes.Isha
    },
    times12h: {
      Fajr: convertTo12HourFormat(prayerTimes.Fajr),
      Sunrise: convertTo12HourFormat(prayerTimes.Sunrise),
      Dhuhr: convertTo12HourFormat(prayerTimes.Dhuhr),
      Asr: convertTo12HourFormat(prayerTimes.Asr),
      Maghrib: convertTo12HourFormat(prayerTimes.Maghrib),
      Isha: convertTo12HourFormat(prayerTimes.Isha)
    }
  };
};

/**
 * Check if local data is available for a specific date
 * @param {Date} date - The date to check
 * @returns {boolean} - True if data is available, false otherwise
 */
export const hasLocalDataForDate = (date) => {
  const dateKey = formatDateForLookup(date);
  return PRAYER_DATA_MAP.has(dateKey);
};

/**
 * Get the date range for which local data is available
 * @returns {Object} - Object with startDate and endDate
 */
export const getLocalDataDateRange = () => {
  const dates = Array.from(PRAYER_DATA_MAP.keys()).sort();
  if (dates.length === 0) {
    return { startDate: null, endDate: null };
  }
  
  const parseDate = (dateStr) => {
    const [day, month, year] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  return {
    startDate: parseDate(dates[0]),
    endDate: parseDate(dates[dates.length - 1])
  };
};
