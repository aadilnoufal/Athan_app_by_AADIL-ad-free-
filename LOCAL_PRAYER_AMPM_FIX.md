# Local Prayer Times AM/PM Fix

## Issue
When using local prayer time data from CSV, the Asr, Maghrib, and Isha prayers were displaying with incorrect AM/PM formatting. For example:
- Asr: "3:02 AM" (should be "3:02 PM")
- Maghrib: "6:30 AM" (should be "6:30 PM") 
- Isha: "8:00 AM" (should be "8:00 PM")

## Root Cause
The local CSV data stores prayer times in a format where afternoon/evening prayers (Asr, Maghrib, Isha) use early hour numbers (e.g., "03:02", "06:30", "08:00") but these represent PM times, not AM times. The original `convertTo12HourFormat` function treated these as regular 24-hour times, resulting in incorrect AM/PM designation.

## Solution
Updated the `convertTo12HourFormat` function in `utils/localPrayerData.js` to:

1. **Accept prayer name parameter**: Modified function signature to `convertTo12HourFormat(timeStr, prayerName)`

2. **Special handling for afternoon/evening prayers**: 
   - For Asr, Maghrib, and Isha: If hours < 12, display as PM
   - For Fajr, Sunrise, and Dhuhr: Use normal 24-hour to 12-hour conversion

3. **Updated function calls**: Modified all calls to pass the prayer name parameter

## Files Modified
- `my-app/utils/localPrayerData.js`
  - Updated `convertTo12HourFormat` function with prayer-name-aware logic
  - Updated function calls in `times12h` object to pass prayer names

## Impact
- ✅ Local prayer times now display correct AM/PM designation
- ✅ Asr, Maghrib, and Isha show as PM times
- ✅ Fajr, Sunrise, and Dhuhr maintain proper AM/PM based on actual time
- ✅ No impact on API-sourced prayer times (they use separate formatting)

## Testing
After this fix:
- Asr: "03:02" → "3:02 PM" ✅
- Maghrib: "06:30" → "6:30 PM" ✅  
- Isha: "08:00" → "8:00 PM" ✅
- Fajr: "04:17" → "4:17 AM" ✅ (unchanged, correct)

## Date
December 21, 2024
