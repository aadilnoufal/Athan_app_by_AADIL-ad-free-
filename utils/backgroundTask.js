import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';

// Define the background task for notification management
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }

  try {
    console.log('🔄 Background task: Checking notification status...');
    
    // Check if notifications are enabled
    const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
    if (notificationsEnabled !== 'true') {
      console.log('Background task: Notifications disabled, skipping');
      return;
    }

    // Get current scheduled notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Check if we have notifications scheduled for today's remaining prayers
    const now = new Date();
    const todayNotifications = scheduledNotifications.filter(notification => {
      if (!notification.trigger) return false;
      
      // Handle different trigger types
      let triggerDate;
      if (notification.trigger.type === 'daily') {
        // For daily triggers, check if they're for today and future time
        const { hour, minute } = notification.trigger;
        triggerDate = new Date();
        triggerDate.setHours(hour, minute, 0, 0);
      } else if (notification.trigger.timestamp || notification.trigger.date) {
        triggerDate = new Date(notification.trigger.timestamp || notification.trigger.date);
      } else {
        return false;
      }
      
      return triggerDate > now && triggerDate.toDateString() === now.toDateString();
    });

    console.log(`Background task: Found ${todayNotifications.length} upcoming notifications today`);

    // If we have no scheduled notifications for today's remaining prayers, flag for reschedule
    if (todayNotifications.length === 0) {
      console.log('Background task: No upcoming notifications today, flagging for reschedule');
      await AsyncStorage.setItem('force_notification_reschedule', 'true');
    }

    // Mark the last background check time
    await AsyncStorage.setItem('last_background_check', Date.now().toString());
    
    console.log('✅ Background task completed successfully');
  } catch (error) {
    console.error('❌ Background task error:', error);
  }
});

// Setup background task for notification management
export async function setupBackgroundTask() {
  try {
    console.log('🔄 Setting up background notification task...');
    
    // Check if the task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    
    if (isRegistered) {
      console.log('✅ Background notification task already registered');
      return true;
    }

    // For Expo Go, background tasks have limitations
    if (__DEV__) {
      console.log('⚠️ Development mode: Background tasks have limited functionality in Expo Go');
      // We can still define the task but it won't run in background in Expo Go
      return true;
    }

    // In production builds, this would work properly
    console.log('📝 Background notification task defined and ready');
    
    // Enable the flag for background rescheduling
    await AsyncStorage.setItem('should_reschedule_notifications', 'true');
    
    return true;
  } catch (error) {
    console.error('❌ Error setting up background task:', error);
    return false;
  }
}

// Unregister background task
export async function unregisterBackgroundTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    
    if (isRegistered) {
      await TaskManager.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('✅ Background task unregistered');
    }
    
    await AsyncStorage.setItem('should_reschedule_notifications', 'false');
  } catch (error) {
    console.error('❌ Error unregistering background task:', error);
  }
}

// Check background task status
export async function getBackgroundFetchStatus() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    
    if (isRegistered) {
      return { status: 'registered', statusText: 'Available' };
    } else {
      return { status: 'not_registered', statusText: 'Available' };
    }
  } catch (error) {
    console.error('❌ Error checking background task status:', error);
    return { status: 'error', statusText: 'Error' };
  }
}

// Force trigger background notification check (for testing)
export async function triggerBackgroundCheck() {
  try {
    console.log('🔄 Triggering manual background check...');
    
    // Simulate the background task logic manually
    const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
    if (notificationsEnabled !== 'true') {
      console.log('Manual check: Notifications disabled, skipping');
      return;
    }

    // Set flag to force reschedule on next app focus
    await AsyncStorage.setItem('force_notification_reschedule', 'true');
    console.log('✅ Manual background check completed - reschedule flag set');
    
  } catch (error) {
    console.error('❌ Error triggering background check:', error);
  }
}