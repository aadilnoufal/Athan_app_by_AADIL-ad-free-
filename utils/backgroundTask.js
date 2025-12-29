// Background task shim now delegates to rolling notification window maintainer.
// No UIBackgroundModes are declared; everything is foreground / delivery driven.

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const TASK_ID = 'prayer-notification-window-fetch';
let started = false;

// Define task only once
try {
  if (!TaskManager.isTaskDefined(TASK_ID)) {
    TaskManager.defineTask(TASK_ID, async () => {
      try {
        const { ensurePrayerNotificationWindow } = require('./prayerNotificationScheduler');
        await ensurePrayerNotificationWindow();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (e) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }
} catch {}

export async function setupBackgroundTask() {
  if (started) return true;
  try {
    const { startPrayerNotificationWindowMaintainer } = require('./prayerNotificationScheduler');
    startPrayerNotificationWindowMaintainer();
    started = true;
    // Register background fetch (approx every 3 hours, system decides)
    try {
      await BackgroundFetch.registerTaskAsync(TASK_ID, {
        minimumInterval: 3 * 60 * 60, // 3 hours
        stopOnTerminate: false,
        startOnBoot: true
      });
    } catch (e) {
      console.log('BackgroundFetch register failed', e?.message);
    }
    return true;
  } catch (e) {
    console.log('setupBackgroundTask failed', e?.message);
    return false;
  }
}

export async function unregisterBackgroundTask() {
  try {
    // Unregister background fetch task
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_ID);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(TASK_ID);
      console.log('✅ Background fetch task unregistered');
    }
    // Reset started flag so it can be re-registered later
    started = false;
    return true;
  } catch (e) {
    console.log('⚠️ unregisterBackgroundTask failed:', e?.message);
    started = false; // Reset anyway to allow re-registration
    return true;
  }
}

export async function getBackgroundFetchStatus() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    return { status, statusText: 'fetch mode active' };
  } catch {
    return { status: 'unknown', statusText: 'fetch query failed' };
  }
}

export async function triggerBackgroundCheck() {
  try {
    const { ensurePrayerNotificationWindow } = require('./prayerNotificationScheduler');
    ensurePrayerNotificationWindow();
  } catch {}
}