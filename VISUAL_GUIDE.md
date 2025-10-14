# 🎯 VISUAL GUIDE - HOW IT WORKS NOW

## 🔊 The Dual-Channel System

```
┌─────────────────────────────────────────────────────────────┐
│                    ANDROID CHANNELS                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📢 AZAN CHANNELS                                           │
│  ├── prayer-times-azan (Dhuhr, Asr, Maghrib, Isha)        │
│  │   Sound: azan.wav (5.2 MB)                             │
│  │   Importance: HIGH                                      │
│  │                                                         │
│  └── fajr-prayer-azan (Fajr only)                         │
│      Sound: azan.wav (5.2 MB)                             │
│      Importance: HIGH                                      │
│      Special vibration pattern                            │
│                                                             │
│  🔔 BEEP CHANNELS                                           │
│  ├── prayer-times-beep (Dhuhr, Asr, Maghrib, Isha)        │
│  │   Sound: beep.wav (191 KB)                             │
│  │   Importance: HIGH                                      │
│  │                                                         │
│  └── fajr-prayer-beep (Fajr only)                         │
│      Sound: beep.wav (191 KB)                             │
│      Importance: HIGH                                      │
│      Special vibration pattern                            │
└─────────────────────────────────────────────────────────────┘
```

## 🎬 User Journey - Toggling Azan/Beep

### **Scenario: User wants AZAN sound**

```
👤 User opens Settings
   ↓
🎚️ Toggles "Use Azan Sound" → ON
   ↓
💾 AsyncStorage.setItem('use_azan_sound', 'true')
   ↓
🚩 AsyncStorage.setItem('notifications_updated', timestamp)
   ↓
🏠 Home screen detects flag (60 second interval)
   ↓
📖 Reads preference: useAzanSound = true
   ↓
🗑️ Cancels existing notifications
   ↓
📅 Schedules new notifications:
   │
   ├─ Fajr at 05:30
   │  └─ Channel: "fajr-prayer-azan" ✅
   │
   ├─ Dhuhr at 12:45
   │  └─ Channel: "prayer-times-azan" ✅
   │
   ├─ Asr at 16:00
   │  └─ Channel: "prayer-times-azan" ✅
   │
   ├─ Maghrib at 18:30
   │  └─ Channel: "prayer-times-azan" ✅
   │
   └─ Isha at 20:00
      └─ Channel: "prayer-times-azan" ✅
   ↓
⏰ AlarmManager armed with exact times
   ↓
⌚ Prayer time arrives (e.g., Fajr 05:30)
   ↓
🔔 AlarmManager fires
   ↓
📢 Channel "fajr-prayer-azan" plays azan.wav
   ↓
✅ User hears AZAN sound (ONCE, perfectly!)
```

### **Scenario: User wants BEEP sound**

```
👤 User opens Settings
   ↓
🎚️ Toggles "Use Azan Sound" → OFF
   ↓
💾 AsyncStorage.setItem('use_azan_sound', 'false')
   ↓
🚩 AsyncStorage.setItem('notifications_updated', timestamp)
   ↓
🏠 Home screen detects flag
   ↓
📖 Reads preference: useAzanSound = false
   ↓
🗑️ Cancels existing notifications
   ↓
📅 Schedules new notifications:
   │
   ├─ Fajr at 05:30
   │  └─ Channel: "fajr-prayer-beep" ✅
   │
   ├─ Dhuhr at 12:45
   │  └─ Channel: "prayer-times-beep" ✅
   │
   ├─ Asr at 16:00
   │  └─ Channel: "prayer-times-beep" ✅
   │
   ├─ Maghrib at 18:30
   │  └─ Channel: "prayer-times-beep" ✅
   │
   └─ Isha at 20:00
      └─ Channel: "prayer-times-beep" ✅
   ↓
⏰ AlarmManager armed
   ↓
⌚ Prayer time arrives (e.g., Dhuhr 12:45)
   ↓
🔔 AlarmManager fires
   ↓
🔔 Channel "prayer-times-beep" plays beep.wav
   ↓
✅ User hears BEEP sound (ONCE, perfectly!)
```

## 🚫 User Journey - Disabling a Prayer

```
👤 User opens Settings
   ↓
🎚️ Toggles "Sunrise" → OFF
   ↓
💾 AsyncStorage saves:
   {
     Fajr: true,
     Sunrise: false,  ← DISABLED
     Dhuhr: true,
     Asr: true,
     Maghrib: true,
     Isha: true
   }
   ↓
🚩 Sets 'notifications_updated' flag
   ↓
🏠 Home screen detects flag
   ↓
📅 Scheduling function loops through prayers:
   │
   ├─ Fajr: enabled ✅ → Schedule
   ├─ Sunrise: disabled ❌ → SKIP!
   ├─ Dhuhr: enabled ✅ → Schedule
   ├─ Asr: enabled ✅ → Schedule
   ├─ Maghrib: enabled ✅ → Schedule
   └─ Isha: enabled ✅ → Schedule
   ↓
✅ Result: 5 notifications (Sunrise skipped)
```

## 🔄 Code Flow - Channel Selection

```javascript
// User preference
const useAzanSound = true; // or false

// Prayer name
const prayer = "Dhuhr";

// Channel selection logic
const isFajr = prayer === "Fajr";

const channelId = useAzanSound
  ? isFajr
    ? "fajr-prayer-azan"
    : "prayer-times-azan"
  : isFajr
  ? "fajr-prayer-beep"
  : "prayer-times-beep";

// Result for this example:
// channelId = "prayer-times-azan" ✅

// Notification uses this channel
await notifee.createTriggerNotification(
  {
    id: "prayer-dhuhr",
    title: "🕌 Dhuhr Prayer Time",
    android: {
      channelId: channelId, // ← Correct channel!
      // Channel has azan.wav configured
    },
  },
  {
    type: TriggerType.TIMESTAMP,
    timestamp: prayerDate.getTime(),
    alarmManager: {
      allowWhileIdle: true, // ← Works in Doze!
      exact: true, // ← Exact timing!
    },
  }
);
```

## ⚡ AlarmManager Benefits

```
┌─────────────────────────────────────────────────────────────┐
│                  REGULAR NOTIFICATIONS                      │
├─────────────────────────────────────────────────────────────┤
│  ❌ Can be delayed by system                                │
│  ❌ May not fire in Doze mode                               │
│  ❌ Battery optimization can block them                     │
│  ❌ Timing is approximate                                   │
│  ❌ Not reliable for time-critical alerts                   │
└─────────────────────────────────────────────────────────────┘

vs

┌─────────────────────────────────────────────────────────────┐
│              ALARMMANAGER NOTIFICATIONS                     │
├─────────────────────────────────────────────────────────────┤
│  ✅ Fires at EXACT time                                     │
│  ✅ Works in Doze mode (allowWhileIdle)                    │
│  ✅ Bypasses battery optimization                           │
│  ✅ Reliable like real alarm apps                           │
│  ✅ Perfect for prayer times!                               │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Before vs After Comparison

### **BEFORE (Broken)**

```
User toggles Azan ON
   ↓
Notification scheduled with "prayer_channel"
   ↓
Channel has azan.wav hardcoded
   ↓
Prayer time arrives
   ↓
Channel plays: 🔊 AZAN
   ↓
Event handler intercepts (500ms later)
   ↓
Checks user preference → wants azan
   ↓
Plays azan AGAIN as "fallback"
   ↓
User hears: 🔊 AZAN + 🔊 AZAN (DOUBLE!) ❌
```

```
User toggles Azan OFF (wants beep)
   ↓
Notification scheduled with SAME "prayer_channel"
   ↓
Channel still has azan.wav (can't change!)
   ↓
Prayer time arrives
   ↓
Channel plays: 🔊 AZAN
   ↓
Event handler intercepts (500ms later)
   ↓
Checks user preference → wants beep
   ↓
Plays beep manually
   ↓
User hears: 🔊 AZAN + 🔔 BEEP (WRONG!) ❌
```

### **AFTER (Fixed)**

```
User toggles Azan ON
   ↓
Notification scheduled with "prayer-times-azan"
   ↓
Channel has azan.wav
   ↓
Prayer time arrives
   ↓
AlarmManager fires
   ↓
Channel plays: 🔊 AZAN
   ↓
User hears: 🔊 AZAN (PERFECT!) ✅
```

```
User toggles Azan OFF (wants beep)
   ↓
Notification scheduled with "prayer-times-beep"
   ↓
Channel has beep.wav
   ↓
Prayer time arrives
   ↓
AlarmManager fires
   ↓
Channel plays: 🔔 BEEP
   ↓
User hears: 🔔 BEEP (PERFECT!) ✅
```

## 🎯 Decision Tree

```
                    Start Scheduling
                          |
                          ↓
              ┌───────────────────────┐
              │ Read user preference  │
              │ use_azan_sound        │
              └───────────────────────┘
                          |
            ┌─────────────┴─────────────┐
            │                           │
         [true]                      [false]
            │                           │
            ↓                           ↓
    ┌──────────────┐          ┌──────────────┐
    │ AZAN SOUND   │          │ BEEP SOUND   │
    └──────────────┘          └──────────────┘
            │                           │
            ↓                           ↓
    For each prayer:                For each prayer:
            │                           │
    ┌───────┴────────┐        ┌───────┴────────┐
    │                │        │                │
    Is Fajr?    Other prayer  Is Fajr?    Other prayer
    │                │        │                │
    ↓                ↓        ↓                ↓
fajr-prayer-   prayer-times- fajr-prayer-   prayer-times-
   azan           azan          beep           beep
    │                │        │                │
    └────────┬───────┘        └────────┬───────┘
             ↓                         ↓
    Plays azan.wav          Plays beep.wav
             │                         │
             └────────┬────────────────┘
                      ↓
              User hears correct sound!
                      ✅
```

## 🧪 Testing Flowchart

```
┌─────────────────────────────────────────┐
│        START TEST                       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  1. Toggle Azan Sound ON                │
│     Expected: Preference saved          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  2. Check logs for channel              │
│     Expected: "prayer-times-azan"       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  3. Wait for notification               │
│     Expected: Hear AZAN (once)          │
└─────────────────────────────────────────┘
                    ↓
          ┌─────────────────┐
          │  Heard azan?    │
          └─────────────────┘
             ↓         ↓
           YES        NO
             │         │
             ↓         ↓
          ✅ PASS   ❌ FAIL
                       │
                       ↓
          Check sound files in
          android/app/src/main/res/raw/
```

---

**That's the complete visual guide!** 🎉

The system now works like a real alarm app with:

- ✅ Exact timing (AlarmManager)
- ✅ Correct sounds (dual channels)
- ✅ No fallback hacks
- ✅ Clean, reliable code
