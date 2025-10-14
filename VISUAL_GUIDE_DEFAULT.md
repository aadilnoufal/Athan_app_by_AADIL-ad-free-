# 📱 VISUAL GUIDE - Android Notification System

## 🎯 The Simple Choice

```
┌─────────────────────────────────────────────┐
│          PRAYER TIME APP SETTINGS           │
├─────────────────────────────────────────────┤
│                                             │
│  🔊 Use Azan Sound              [  ON  ]   │
│                                             │
│  When ON: Traditional azan call             │
│  When OFF: Android default notification     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 📊 System Architecture

```
                     USER OPENS APP
                          ↓
                  ┌──────────────────┐
                  │   SETTINGS TAB   │
                  └──────────────────┘
                          ↓
           ┌──────────────┴──────────────┐
           │                             │
      Toggle ON                     Toggle OFF
           │                             │
           ↓                             ↓
  ┌──────────────────┐        ┌──────────────────┐
  │  AZAN CHANNELS   │        │ DEFAULT CHANNELS │
  ├──────────────────┤        ├──────────────────┤
  │ prayer-times-    │        │ prayer-times-    │
  │     azan         │        │     default      │
  │                  │        │                  │
  │ fajr-prayer-     │        │ fajr-prayer-     │
  │     azan         │        │     default      │
  └──────────────────┘        └──────────────────┘
           │                             │
           │  Sound: azan.wav            │  Sound: Android default
           │  Duration: 2-3 min          │  Duration: 1-2 sec
           │  Source: Custom file        │  Source: System
           │                             │
           └──────────────┬──────────────┘
                          ↓
                  ┌──────────────────┐
                  │  ALARMMANAGER    │
                  │  (Exact timing)  │
                  └──────────────────┘
                          ↓
                  ┌──────────────────┐
                  │  NOTIFICATION    │
                  │  + SOUND         │
                  └──────────────────┘
```

---

## 🎵 Sound Flow

### **When Azan Toggle is ON:**

```
Prayer Time Arrives (e.g., 1:30 PM)
        ↓
AlarmManager Fires
        ↓
Notifee Creates Notification
        ↓
Android Selects Channel: "prayer-times-azan"
        ↓
Channel Configuration:
  - Sound: azan.wav
  - Importance: HIGH
  - Vibration: [300, 600, 300, 600]
        ↓
Android Plays Sound from res/raw/azan.wav
        ↓
🔊 Full Azan Call Plays (~2-3 minutes)
        ↓
User Hears Traditional Prayer Call ✅
```

### **When Azan Toggle is OFF:**

```
Prayer Time Arrives (e.g., 1:30 PM)
        ↓
AlarmManager Fires
        ↓
Notifee Creates Notification
        ↓
Android Selects Channel: "prayer-times-default"
        ↓
Channel Configuration:
  - Sound: default
  - Importance: HIGH
  - Vibration: [300, 600, 300, 600]
        ↓
Android Plays Default Notification Sound
        ↓
🔔 Short Notification Beep (~1-2 seconds)
        ↓
User Hears Familiar Android Sound ✅
```

---

## 📱 Notification Preview

### **Azan Sound (Toggle ON):**

```
╔════════════════════════════════════════╗
║  🕌 Dhuhr Prayer Time            12:30 ║
╠════════════════════════════════════════╣
║  It's time for Dhuhr prayer (12:30)   ║
║                                        ║
║  🤲 Mark as Read                       ║
╚════════════════════════════════════════╝

🔊 [Azan sound playing...]
   Allahu Akbar, Allahu Akbar...
   (Full 2-3 minute azan)
```

### **Default Sound (Toggle OFF):**

```
╔════════════════════════════════════════╗
║  🕌 Dhuhr Prayer Time            12:30 ║
╠════════════════════════════════════════╣
║  It's time for Dhuhr prayer (12:30)   ║
║                                        ║
║  🤲 Mark as Read                       ║
╚════════════════════════════════════════╝

🔔 *beep beep* (1-2 seconds)
   (Android default notification sound)
```

---

## 🔄 Toggle Flow

```
User Opens Settings
        ↓
┌──────────────────────────┐
│ 🔊 Use Azan Sound  [OFF] │ ← Currently OFF
└──────────────────────────┘
        ↓
User Taps Toggle
        ↓
┌──────────────────────────┐
│ 🔊 Use Azan Sound  [ON]  │ ← Now ON
└──────────────────────────┘
        ↓
App Saves to AsyncStorage
        ↓
Next Prayer Notification Uses:
  ✅ prayer-times-azan channel
  ✅ azan.wav sound
        ↓
User Taps Toggle Again
        ↓
┌──────────────────────────┐
│ 🔊 Use Azan Sound  [OFF] │ ← Back to OFF
└──────────────────────────┘
        ↓
App Saves to AsyncStorage
        ↓
Next Prayer Notification Uses:
  ✅ prayer-times-default channel
  ✅ Android default sound
```

---

## 📊 Channel Comparison

```
┌──────────────────────┬──────────────────────┐
│   AZAN CHANNELS      │  DEFAULT CHANNELS    │
├──────────────────────┼──────────────────────┤
│ prayer-times-azan    │ prayer-times-default │
│ fajr-prayer-azan     │ fajr-prayer-default  │
├──────────────────────┼──────────────────────┤
│ Sound: azan.wav      │ Sound: system        │
│ Custom audio file    │ Android built-in     │
│ 2-3 minutes          │ 1-2 seconds          │
│ Islamic call         │ Standard beep        │
│ User preference      │ Familiar to user     │
└──────────────────────┴──────────────────────┘
```

---

## ⏰ Prayer Schedule Example

```
Today's Prayers:
┌──────────────────────────────────────────────┐
│ Time   │ Prayer  │ Toggle │ Channel         │
├────────┼─────────┼────────┼─────────────────┤
│ 05:45  │ Fajr    │ ON     │ fajr-prayer-    │
│        │         │        │    azan         │
│        │         │        │ 🔊 azan.wav     │
├────────┼─────────┼────────┼─────────────────┤
│ 07:15  │ Sunrise │ N/A    │ prayer-times-   │
│        │         │        │    default      │
│        │         │        │ 🔔 default      │
├────────┼─────────┼────────┼─────────────────┤
│ 12:30  │ Dhuhr   │ ON     │ prayer-times-   │
│        │         │        │    azan         │
│        │         │        │ 🔊 azan.wav     │
├────────┼─────────┼────────┼─────────────────┤
│ 15:45  │ Asr     │ ON     │ prayer-times-   │
│        │         │        │    azan         │
│        │         │        │ 🔊 azan.wav     │
├────────┼─────────┼────────┼─────────────────┤
│ 18:00  │ Maghrib │ ON     │ prayer-times-   │
│        │         │        │    azan         │
│        │         │        │ 🔊 azan.wav     │
├────────┼─────────┼────────┼─────────────────┤
│ 19:30  │ Isha    │ ON     │ prayer-times-   │
│        │         │        │    azan         │
│        │         │        │ 🔊 azan.wav     │
└──────────────────────────────────────────────┘

Note: Sunrise ALWAYS uses default sound (never azan)
```

---

## 🎯 Decision Tree

```
                    Prayer Time Arrives
                            ↓
                    Is it Sunrise?
                    ┌─────┴─────┐
                   Yes          No
                    │            │
                    ↓            ↓
          Use default     Check user toggle
            sound              ┌──┴──┐
                              ON     OFF
                               │      │
                               ↓      ↓
                          Use azan  Use default
```

---

## 🔧 Technical Flow

```
1. User sets preference
   AsyncStorage.setItem('use_azan_sound', 'true/false')
                ↓
2. App schedules prayers
   scheduleNotifeePrayerNotifications(times)
                ↓
3. For each prayer:
   getSoundPreference() → true/false
                ↓
4. Select channel:
   if (useAzan && prayer !== 'Sunrise')
     → prayer-times-azan
   else
     → prayer-times-default
                ↓
5. Create notification with channel
   notifee.displayNotification({ channelId })
                ↓
6. AlarmManager schedules exact time
   { allowWhileIdle: true, exact: true }
                ↓
7. At prayer time:
   AlarmManager fires → Notification appears
   Channel plays sound automatically
                ↓
8. User hears notification
   ✅ Correct sound based on preference!
```

---

## 📱 User Interface Mockup

```
┌────────────────────────────────────────┐
│  Prayer Times        🕌  [Settings]    │
├────────────────────────────────────────┤
│                                        │
│  Next Prayer: Dhuhr                    │
│  Time: 12:30 PM                        │
│  In: 2 hours 15 minutes                │
│                                        │
│  [Show All Prayer Times]               │
│                                        │
└────────────────────────────────────────┘

[User taps Settings]

┌────────────────────────────────────────┐
│  [Back]  Settings                      │
├────────────────────────────────────────┤
│                                        │
│  📍 Location                           │
│  📍 New York, USA                      │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│  🔊 Sound Settings                     │
│                                        │
│  Use Azan Sound          [  ON  ] ←   │
│  Play traditional azan call for        │
│  prayer notifications                  │
│                                        │
│  [Test Notification]                   │
│                                        │
│  ─────────────────────────────────     │
│                                        │
└────────────────────────────────────────┘
```

---

## ✅ Benefits Summary

### **For Users:**

- ✅ Clear choice: Islamic azan OR familiar Android sound
- ✅ No confusion about "beep" vs "default"
- ✅ Respects user preference
- ✅ Works reliably in all conditions

### **For Developers:**

- ✅ Simpler code (4 channels instead of 6)
- ✅ Clearer logic
- ✅ Easier to maintain
- ✅ Better logs

### **For System:**

- ✅ Native Android sound integration
- ✅ Reliable channel-based playback
- ✅ AlarmManager ensures exact timing
- ✅ Works in Doze mode

---

## 🎉 Final Result

**Simple. Clean. Works Perfectly.**

```
   "Azan or Default?"
         ↓
   [  Toggle  ]
         ↓
   ✅ Done!
```

**That's it! 🚀**
