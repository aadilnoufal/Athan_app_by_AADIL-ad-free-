# ✅ TESTING CHECKLIST - Quick Reference

## 🚀 Before Testing

- [ ] Expo server is running (`npx expo start`)
- [ ] App is installed on Android device/emulator
- [ ] Notification permissions granted
- [ ] Exact alarm permission granted (Android 12+)

## 📱 Test 1: Azan Sound Toggle

### Setup

- [ ] Open Settings screen
- [ ] Find "Use Azan Sound" toggle
- [ ] Turn it **ON**
- [ ] Return to home screen

### Verify

- [ ] Check console logs for: `🔊 Sound preference: Azan sound`
- [ ] Check logs for: `Using channel "prayer-times-azan"`
- [ ] Wait for next prayer time (or use test helper)

### Expected Result

- [ ] ✅ Hear **azan sound** (full call to prayer)
- [ ] ✅ Hear it **ONCE** (not twice)
- [ ] ✅ No beep sound before or after

### If Failed

- Check: `android/app/src/main/res/raw/azan.wav` exists
- Check: Console shows correct channel ID
- Check: Notification permissions granted

---

## 🔔 Test 2: Beep Sound Toggle

### Setup

- [ ] Open Settings screen
- [ ] Find "Use Azan Sound" toggle
- [ ] Turn it **OFF**
- [ ] Return to home screen

### Verify

- [ ] Check console logs for: `🔊 Sound preference: Beep sound`
- [ ] Check logs for: `Using channel "prayer-times-beep"`
- [ ] Wait for next prayer time (or use test helper)

### Expected Result

- [ ] ✅ Hear **beep sound** (short beep)
- [ ] ✅ Hear it **ONCE** (not multiple times)
- [ ] ✅ No azan sound at all

### If Failed

- Check: `android/app/src/main/res/raw/beep.wav` exists
- Check: Console shows correct channel ID
- Check: AsyncStorage has correct value

---

## 🚫 Test 3: Disable Prayer

### Setup

- [ ] Open Settings screen
- [ ] Find "Sunrise Prayer" toggle
- [ ] Turn it **OFF**
- [ ] Return to home screen

### Verify

- [ ] Check console logs for: `⏭️ Skipping Sunrise - disabled in settings`
- [ ] Wait for Sunrise time

### Expected Result

- [ ] ✅ **NO notification** for Sunrise
- [ ] ✅ Other prayers still work normally

### Re-enable Test

- [ ] Go back to Settings
- [ ] Turn "Sunrise Prayer" **ON**
- [ ] Return to home screen
- [ ] Check logs for: Sunrise scheduled
- [ ] ✅ Sunrise notification should appear next day

---

## ⏰ Test 4: Exact Timing

### Setup

- [ ] Note current time
- [ ] Set a prayer time for 2 minutes from now (manually for testing)
- [ ] Wait exactly until that time

### Expected Result

- [ ] ✅ Notification appears **within 5 seconds** of prayer time
- [ ] ✅ Not 1-2 minutes late
- [ ] ✅ AlarmManager is working

### If Failed

- Check: Exact alarm permission granted
- Check: Battery optimization disabled for app
- Check: Console shows "Using AlarmManager"

---

## 🔋 Test 5: Doze Mode (Advanced)

### Setup

- [ ] Schedule notification for 5 minutes
- [ ] Lock phone and leave it still
- [ ] Device enters Doze mode (after ~5 min idle)

### Expected Result

- [ ] ✅ Notification still fires on time
- [ ] ✅ Sound plays correctly
- [ ] ✅ `allowWhileIdle: true` is working

### If Failed

- Check: AlarmManager configuration in code
- Check: Request to disable battery optimization

---

## 🧪 Quick Test Function

### Using Test Helper

```javascript
// In settings.tsx, add temporary button:
import { quickNotificationTest } from '../../utils/notificationTestHelper';

<TouchableOpacity onPress={() => quickNotificationTest(true)}>
  <Text>Test Azan (1 min)</Text>
</TouchableOpacity>

<TouchableOpacity onPress={() => quickNotificationTest(false)}>
  <Text>Test Beep (1 min)</Text>
</TouchableOpacity>
```

### Expected Result

- [ ] ✅ Notification in 1 minute
- [ ] ✅ Correct sound plays
- [ ] ✅ Console logs show correct channel

---

## 📊 Console Log Checks

### Good Logs (What to Look For)

```
✅ "🔊 Sound preference: Azan sound"
✅ "📱 Fajr: Using channel "fajr-prayer-azan" (AZAN)"
✅ "⏰ Using AlarmManager for exact timing (like real alarm apps!)"
✅ "✅ Scheduled Dhuhr at 12:45 (🔊 azan) - Channel: prayer-times-azan"
```

### Bad Logs (Red Flags)

```
❌ "❌ Error creating notification channels"
❌ "⚠️ Notifee service not initialized"
❌ "❌ Invalid time for Fajr"
❌ "🔊 Playing manual BEEP sound" (shouldn't happen anymore!)
```

---

## 🐛 Debugging

### Problem: No Sound at All

**Check:**

- [ ] Sound files exist in `android/app/src/main/res/raw/`
- [ ] Phone is not on silent mode
- [ ] Volume is turned up
- [ ] Notification permissions granted

### Problem: Wrong Sound Plays

**Check:**

- [ ] Console shows correct channel ID
- [ ] AsyncStorage has correct preference
- [ ] No "Playing manual" logs (old system)

### Problem: Double Sound

**Check:**

- [ ] Using latest code (dual-channel system)
- [ ] No hybrid fallback code running
- [ ] Event handler doesn't play manual sounds

### Problem: Late Notifications

**Check:**

- [ ] Exact alarm permission granted
- [ ] Battery optimization disabled
- [ ] Console shows "Using AlarmManager"

---

## 📝 Test Results Template

```
Date: _____________
Device: Android _____ / iOS _____
App Version: _______

Test 1 - Azan Toggle:        [ ] PASS  [ ] FAIL
Test 2 - Beep Toggle:        [ ] PASS  [ ] FAIL
Test 3 - Disable Prayer:     [ ] PASS  [ ] FAIL
Test 4 - Exact Timing:       [ ] PASS  [ ] FAIL
Test 5 - Doze Mode:          [ ] PASS  [ ] FAIL

Notes:
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## ✅ Success Criteria

All tests should show:

- ✅ Correct sound plays (azan OR beep, not both)
- ✅ Sound plays ONCE (no double/triple sounds)
- ✅ Disabled prayers are skipped
- ✅ Exact timing (within 5 seconds)
- ✅ Works in Doze mode
- ✅ No errors in console

**If all tests pass → System is working perfectly! 🎉**
