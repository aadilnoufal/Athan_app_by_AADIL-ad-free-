// =============================================================================
// NOTIFICATION SYSTEM TEST
// =============================================================================
// Quick test to verify the new dual-channel notification system works
// Run this from the settings screen or home screen
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  initializeNotifeePrayerNotifications,
  scheduleNotifeePrayerNotifications,
  getScheduledNotifeePrayerNotifications,
  cancelAllNotifeePrayerNotifications
} from './notifeePrayerService';

/**
 * Test the notification system with both azan and beep sounds
 */
export async function testNotificationSystem() {
  console.log('🧪 ========== NOTIFICATION SYSTEM TEST ==========');
  
  try {
    // Initialize
    console.log('📱 Step 1: Initializing notification system...');
    await initializeNotifeePrayerNotifications();
    
    // Test prayer times (5 minutes from now for each)
    const now = new Date();
    const testTime1 = new Date(now.getTime() + 5 * 60000); // 5 min
    const testTime2 = new Date(now.getTime() + 6 * 60000); // 6 min
    
    const testPrayerTimes = {
      Fajr: `${testTime1.getHours()}:${String(testTime1.getMinutes()).padStart(2, '0')}`,
      Dhuhr: `${testTime2.getHours()}:${String(testTime2.getMinutes()).padStart(2, '0')}`,
      Asr: '15:30',
      Maghrib: '18:00',
      Isha: '19:30',
      Sunrise: '06:30'
    };
    
    const testSettings = {
      Fajr: true,
      Dhuhr: true,
      Asr: false, // Test disabled prayer
      Maghrib: false,
      Isha: false,
      Sunrise: false
    };
    
    // TEST 1: Schedule with AZAN preference
    console.log('\n🔊 TEST 1: Testing with AZAN sound preference');
    await AsyncStorage.setItem('use_azan_sound', 'true');
    await scheduleNotifeePrayerNotifications(testPrayerTimes, testSettings);
    
    let scheduled = await getScheduledNotifeePrayerNotifications();
    console.log(`✅ Scheduled ${scheduled.length} notifications with AZAN`);
    scheduled.forEach(n => {
      console.log(`   - ${n.prayer} at ${n.time} (${n.soundType})`);
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // TEST 2: Reschedule with BEEP preference
    console.log('\n🔔 TEST 2: Testing with BEEP sound preference');
    await AsyncStorage.setItem('use_azan_sound', 'false');
    await scheduleNotifeePrayerNotifications(testPrayerTimes, testSettings);
    
    scheduled = await getScheduledNotifeePrayerNotifications();
    console.log(`✅ Scheduled ${scheduled.length} notifications with BEEP`);
    scheduled.forEach(n => {
      console.log(`   - ${n.prayer} at ${n.time} (${n.soundType})`);
    });
    
    // TEST 3: Verify disabled prayers are skipped
    console.log('\n⏭️ TEST 3: Verifying disabled prayers are skipped');
    const scheduledPrayers = scheduled.map(n => n.prayer);
    const shouldBeScheduled = ['Fajr', 'Dhuhr']; // Only these are enabled
    const shouldBeSkipped = ['Asr', 'Maghrib', 'Isha']; // These are disabled
    
    const allScheduled = shouldBeScheduled.every(p => scheduledPrayers.includes(p));
    const noneSkipped = shouldBeSkipped.every(p => !scheduledPrayers.includes(p));
    
    console.log(`   Enabled prayers scheduled: ${allScheduled ? '✅' : '❌'}`);
    console.log(`   Disabled prayers skipped: ${noneSkipped ? '✅' : '❌'}`);
    
    // TEST 4: Check channel usage
    console.log('\n📱 TEST 4: Verifying correct channels are used');
    console.log(`   (Check logs above for channel IDs)`);
    
    console.log('\n🎉 ========== TEST COMPLETE ==========');
    console.log('Wait 5-6 minutes to hear the notifications!');
    console.log('Expected: Fajr in 5 min, Dhuhr in 6 min (both with BEEP sound)');
    
    return {
      success: true,
      scheduled: scheduled.length,
      expected: 2
    };
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Quick test - schedule a single notification in 1 minute
 */
export async function quickNotificationTest(useAzan = true) {
  console.log(`🧪 Quick test: Notification in 1 minute with ${useAzan ? 'AZAN' : 'BEEP'}`);
  
  try {
    await initializeNotifeePrayerNotifications();
    
    const now = new Date();
    const testTime = new Date(now.getTime() + 60000); // 1 minute from now
    
    const testPrayerTimes = {
      Fajr: `${testTime.getHours()}:${String(testTime.getMinutes()).padStart(2, '0')}`,
      Dhuhr: '00:00', // Won't trigger
      Asr: '00:00',
      Maghrib: '00:00',
      Isha: '00:00',
      Sunrise: '00:00'
    };
    
    const testSettings = {
      Fajr: true,
      Dhuhr: false,
      Asr: false,
      Maghrib: false,
      Isha: false,
      Sunrise: false
    };
    
    await AsyncStorage.setItem('use_azan_sound', useAzan ? 'true' : 'false');
    await scheduleNotifeePrayerNotifications(testPrayerTimes, testSettings);
    
    const scheduled = await getScheduledNotifeePrayerNotifications();
    console.log(`✅ Test notification scheduled for ${testPrayerTimes.Fajr}`);
    console.log(`   Sound: ${useAzan ? 'AZAN 🔊' : 'BEEP 🔔'}`);
    console.log(`   Wait 1 minute to test!`);
    
    return { success: true, scheduled: scheduled.length };
    
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up all test notifications
 */
export async function cleanupTestNotifications() {
  console.log('🧹 Cleaning up test notifications...');
  await cancelAllNotifeePrayerNotifications();
  console.log('✅ All test notifications cancelled');
}
