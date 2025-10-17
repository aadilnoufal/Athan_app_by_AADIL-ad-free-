# 📱 How Prayer Notification Scheduling Works

## Overview

The app uses a **rolling window system** that schedules notifications for the next **10 days** at a time, with a maximum of **~54 notifications** to stay under iOS's 64-notification limit.

---

## 🔄 When Notifications Get Scheduled/Replenished

### 1. **App Startup** (Initial Setup)

**When:** Every time the app launches  
**What happens:**

- `setupBackgroundTask()` is called in `index.tsx` during initialization
- This calls `startPrayerNotificationWindowMaintainer()`
- Which immediately calls `ensurePrayerNotificationWindow()`
- **Result:** Schedules up to 10 days of prayer notifications (if not already scheduled)

**Code flow:**

```
app launches → initializeNotifications() → setupBackgroundTask()
→ startPrayerNotificationWindowMaintainer() → ensurePrayerNotificationWindow()
```

---

### 2. **App Returns to Foreground**

**When:** User switches back to the app from background  
**What happens:**

- An AppState listener detects when app becomes 'active'
- Automatically calls `ensurePrayerNotificationWindow()`
- **Result:** Tops up the window if any days are missing

**Code location:** `utils/prayerNotificationScheduler.ts`

```typescript
appStateSub = AppState.addEventListener("change", (s) => {
  if (s === "active") {
    ensurePrayerNotificationWindow();
  }
});
```

---

### 3. **After Each Notification is Delivered** ⚡ **(This is KEY!)**

**When:** Every time a prayer notification fires  
**What happens:**

- The notification system detects `EventType.DELIVERED`
- Calls `onPrayerNotificationDelivered()`
- After a 2-second delay, calls `ensurePrayerNotificationWindow()`
- **Result:** Automatically replenishes the rolling window by adding another day

**Code location:** `utils/notifeePrayerService.js`

```javascript
case EventType.DELIVERED:
  if (prayerData?.type === 'prayer-time' || prayerData?.type === 'prayer-reminder') {
    const { onPrayerNotificationDelivered } = require('./prayerNotificationScheduler');
    onPrayerNotificationDelivered(); // This tops up the window
  }
```

---

### 4. **Background Fetch (Optional, System-Controlled)**

**When:** Approximately every 3 hours (when system decides)  
**What happens:**

- Background fetch task runs (if OS permits)
- Calls `ensurePrayerNotificationWindow()`
- **Result:** Ensures window stays topped up even if app hasn't been opened

**⚠️ Important:** This is **NOT reliable** - iOS controls when/if this runs. The main replenishment happens via methods 1-3 above.

---

### 5. **Manual Reschedule** 🔄

**When:** User changes settings or manually triggers reschedule  
**What happens:**

- Sound preference changes (Azan ↔ Beep)
- Prayer toggles on/off
- Location/calculation changes
- Sets `notifications_updated` flag in AsyncStorage
- Home screen detects flag and calls `forceRescheduleAllNotifications()`
- **Cancels ALL existing notifications** (via `cancelAll()`)
- **Schedules fresh 10-day window** with new settings
- **Result:** Complete reset of all ~50 notifications with updated preferences

**Triggers:**

- User toggles notification on/off for specific prayers
- User changes sound preference (Azan vs Beep) ⚡
- User manually clicks "Reschedule" in settings
- Location/calculation method changes

**Code flow:**

```
Settings change → setItem('notifications_updated')
→ Home screen listener detects → forceRescheduleAllNotifications()
→ cancelAll() → ensurePrayerNotificationWindow()
→ Schedules fresh 10 days
```

**⚠️ Important:** This is a **FULL RESCHEDULE**, not just topping up!

---

## 🎯 The Rolling Window Strategy

### How It Works:

1. **Maintain 10-day horizon:** Always try to have next 10 days scheduled
2. **Stay under limit:** Max ~54 notifications (leaves room for iOS 64 limit)
3. **Smart top-up:** Only schedules missing days, doesn't duplicate (except when settings change)
4. **Single-fire notifications:** Each notification is scheduled once (not repeating daily) to handle seasonal prayer time shifts accurately
5. **Auto-detect changes:** Detects timezone, DST, and sound preference changes automatically and triggers full reschedule

### Example Timeline:

```
Day 1: App opens → Schedules Days 1-10 (47 notifications total)
Day 2: Prayer fires at 5am → Auto-replenishes → Adds Day 11
Day 3: Prayer fires → Adds Day 12
...and so on
```

### Safety Checks:

- **Timezone change detection:** If DST or timezone changes, cancels all and reschedules automatically
- **Sound preference detection:** If sound changes (Azan ↔ Beep), cancels all and reschedules with new sound ⚡ **NEW!**
- **Version check:** If scheduler version updates, triggers full reschedule
- **Duplicate prevention:** Checks existing scheduled IDs before adding new ones
- **Past time filtering:** Skips scheduling any prayer times that have already passed

---

## 🆕 Recent Improvements

### 1. **Automatic Sound Preference Detection**

The scheduler now tracks the sound preference (`use_azan_sound`) and automatically detects when it changes:

- Stores last known sound preference in `prayer_sched_sound_pref`
- On every `ensurePrayerNotificationWindow()` call, checks if preference changed
- If changed, automatically cancels ALL notifications and reschedules with new sound
- **No manual intervention needed!**

### 2. **Force Reschedule Function**

New `forceRescheduleAllNotifications()` function for complete reset:

- Cancels all existing prayer notifications
- Clears scheduling state
- Rebuilds entire 10-day window from scratch
- Used when settings change to ensure all ~50 notifications get updated

### 3. **Better Logging**

Enhanced console logging to track:

- Sound preference changes: `🔊 Sound preference changed: true → false`
- Timezone changes: `🌍 Timezone changed: -240 → -300`
- Full rescheduling events: `🔄 Force rescheduling all notifications from scratch...`

---

## 📊 How Many Notifications?

**Per Day:** Depends on user settings, but typically:

- 6 prayers maximum (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha)
- But user can disable individual prayers in settings
- Average: ~4-5 notifications per day

**In the Window:**

- 10 days × ~5 prayers/day = **~50 notifications**
- Stays well under iOS 64 limit

---

## 🔧 Technical Details

### Storage Keys Used:

- `prayer_sched_last_day` - Last day in current window
- `prayer_sched_tz_offset` - Timezone offset (for DST detection)
- `prayer_sched_sound_pref` - Last known sound preference (for auto-detection) ⚡ **NEW!**
- `prayer_sched_version` - Scheduler version (for migration)
- `notifications_updated` - Flag to trigger full reschedule from settings

### Notification ID Format:

```
prayer-{prayername}-{YYYY-MM-DD}
Example: prayer-fajr-2025-10-14
```

This format allows:

- Easy filtering of prayer notifications
- Duplicate detection
- Cancellation of specific days/prayers

---

## ✅ Summary

**The system is self-maintaining!**

The most important replenishment happens **automatically after each notification fires**. This ensures the rolling window stays topped up without requiring:

- ❌ User to open app daily
- ❌ Background tasks to run reliably
- ❌ End-of-day scheduling jobs

**As long as notifications are firing, the system keeps itself alive!** 🎉

The app startup and foreground detection are backup mechanisms to ensure the window is maintained even if notifications get cleared or the user hasn't received one in a while.
