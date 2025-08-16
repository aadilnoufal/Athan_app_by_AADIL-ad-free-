// =============================================================================
// NOTIFICATION TESTING UTILITY
// =============================================================================
// Easy-to-use testing functions for prayer notifications
// Import and use these functions to test your notification system
// =============================================================================

import {
  testImmediateNotification,
  testScheduledNotification,
  testFajrNotification,
  checkNotificationStatus,
  runNotificationSystemTest,
  requestEssentialPermissions
} from './notifeePrayerService';

/**
 * Quick test menu for developers
 * Call this function to get a simple testing interface
 */
export const showTestMenu = () => {
  console.log(`
🧪 NOTIFICATION TESTING MENU
============================

Available test functions:
1. testImmediateNotification() - Test instant notification
2. testScheduledNotification() - Test 1-minute scheduled notification  
3. testFajrNotification() - Test Fajr-specific notification
4. checkNotificationStatus() - Check system permissions & status
5. runNotificationSystemTest() - Full comprehensive test
6. requestEssentialPermissions() - Request all needed permissions

Usage examples:
- import { testImmediateNotification } from './utils/notificationTester';
- await testImmediateNotification();

For comprehensive testing:
- import { runNotificationSystemTest } from './utils/notificationTester';
- const results = await runNotificationSystemTest();
- console.log('Test results:', results);
`);
};

/**
 * Run a quick health check of the notification system
 */
export const quickHealthCheck = async () => {
  console.log('🔍 Running quick notification health check...');
  
  try {
    // Check permissions
    const permissions = await requestEssentialPermissions();
    console.log('✅ Permissions:', permissions.notifications ? 'OK' : 'MISSING');
    console.log('✅ Exact Alarms:', permissions.exactAlarms ? 'OK' : 'MISSING');
    
    // Check system status
    const status = await checkNotificationStatus();
    console.log('✅ Battery Optimized:', status.batteryOptimized ? 'YES (Bad)' : 'NO (Good)');
    console.log('✅ Scheduled Notifications:', status.scheduledNotifications?.length || 0);
    
    // Send test notification
    const testResult = await testImmediateNotification();
    console.log('✅ Test Notification:', testResult ? 'SENT' : 'FAILED');
    
    return {
      permissions: permissions.notifications,
      exactAlarms: permissions.exactAlarms,
      batteryOptimized: status.batteryOptimized,
      scheduledCount: status.scheduledNotifications?.length || 0,
      testNotification: testResult
    };
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return { error: error.message };
  }
};

/**
 * Test all prayer notification types
 */
export const testAllPrayerTypes = async () => {
  console.log('🕌 Testing all prayer notification types...');
  
  const results = {
    immediate: false,
    scheduled: false,
    fajr: false
  };
  
  try {
    console.log('📱 Testing immediate notification...');
    results.immediate = await testImmediateNotification();
    
    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('⏰ Testing scheduled notification...');
    results.scheduled = await testScheduledNotification();
    
    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🌅 Testing Fajr notification...');
    results.fajr = await testFajrNotification();
    
    const passedTests = Object.values(results).filter(Boolean).length;
    console.log(`🎯 Prayer notifications test: ${passedTests}/3 passed`);
    
    return {
      results,
      summary: `${passedTests}/3 prayer notification types working`,
      allPassed: passedTests === 3
    };
    
  } catch (error) {
    console.error('❌ Prayer notification test failed:', error);
    return { error: error.message, results };
  }
};

// Export all testing functions for easy access
export {
  testImmediateNotification,
  testScheduledNotification,
  testFajrNotification,
  checkNotificationStatus,
  runNotificationSystemTest,
  requestEssentialPermissions
};

// Show menu when this file is imported
showTestMenu();
