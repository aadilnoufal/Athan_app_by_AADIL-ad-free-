import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { playPrayerSound, preloadSounds, unloadSounds } from '../utils/audioHelper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Configure notifications to always show in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Custom in-app notification component
function InAppNotification({ title, body, onClose }) {
  const translateY = useRef(new Animated.Value(-100)).current;
  
  useEffect(() => {
    console.log("In-app notification mounted with:", title, body);
    // Animate in
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Automatically dismiss after 7 seconds 
    const timer = setTimeout(() => {
      dismiss();
    }, 7000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };
  
  return (
    <Animated.View 
      style={[
        styles.notification,
        { transform: [{ translateY }] }
      ]}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationBody}>{body}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} style={styles.closeButton}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [notification, setNotification] = useState(null);
  const [lastReceivedAt, setLastReceivedAt] = useState(0); // Track when last notification was received
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Preload assets when the app loads
  useEffect(() => {
    async function loadAssets() {
      try {
        // Configure audio session
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
        
        // Preload sound assets
        await preloadSounds();
        setAssetsLoaded(true);
      } catch (error) {
        console.error("Error preloading assets:", error);
        // Continue even if preloading fails
        setAssetsLoaded(true);
      }
    }
    
    loadAssets();
    
    // Cleanup function
    return () => {
      unloadSounds();
    };
  }, []);
  
  // Helper function to directly show an in-app notification for testing
  const showTestInAppNotification = async () => {
    console.log("Showing test in-app notification");
    setNotification({
      title: "Test In-App Notification",
      body: "This is a test notification that should appear in-app",
      data: { prayerName: 'Test' }
    });
    
    try {
      await playSimpleSound();
    } catch (error) {
      console.error("Error playing test sound", error);
    }
  };

  // Simple function to play a sound directly
  const playSimpleSound = async () => {
    try {
      console.log("Playing simple sound");
      await playPrayerSound('Test', true); // Test with Azan sound
    } catch (error) {
      console.error("Failed to play sound", error);
    }
  };
  
  useEffect(() => {
    console.log("Setting up notification listeners");
    
    // Debug notification channel if on Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => {
        console.log("Notification received in foreground:", notification);
        const prayerName = notification.request.content.data?.prayerName || 'Prayer';
        
        // Only show new notifications (avoid duplication from quick re-renders)
        const currentTime = new Date().getTime();
        if (currentTime - lastReceivedAt > 1000) {
          setLastReceivedAt(currentTime);
          
          // Set notification for display
          setNotification({
            title: notification.request.content.title || `${prayerName} Time`,
            body: notification.request.content.body || `It's time for ${prayerName}`,
            data: notification.request.content.data || {}
          });
          
          // Play sound directly instead of relying on notification sound
          playSimpleSound();
        }
      }
    );
    
    // Handle notification responses (when user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log('Notification tapped:', response);
      }
    );

    // Automatically trigger test notification after 2 seconds to verify setup
    const timer = setTimeout(async () => {
      const permissions = await Notifications.getPermissionsAsync();
      console.log("Current notification permissions:", permissions);
      
      if (permissions.granted) {
        // Uncomment to test on app start:
        // showTestInAppNotification();
      } else {
        console.log("No notification permissions granted yet");
      }
    }, 2000);
    
    // Cleanup function
    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
      clearTimeout(timer);
    };
  }, [lastReceivedAt]);
  
  // Attach global error handler to expo-notifications
  useEffect(() => {
    const errorListener = Notifications.addNotificationResponseReceivedListener(response => {
      if (response.error) {
        console.error("Notification error:", response.error);
      }
    });
    
    return () => {
      Notifications.removeNotificationSubscription(errorListener);
    };
  }, []);

  // Expose test function globally for easier debugging (remove in production)
  if (__DEV__) {
    // @ts-ignore
    global.showTestNotification = showTestInAppNotification;
  }
  
  // Don't render anything until assets are loaded
  if (!assetsLoaded) {
    return null; // Or a loading screen
  }
  
  return (
    <SafeAreaProvider>
      <StatusBar 
        style={isDark ? 'light' : 'dark'} 
        backgroundColor="#121212" 
        translucent={Platform.OS === 'android'} 
      />
      <Stack 
        screenOptions={{
          headerShown: false,
          contentStyle: { 
            backgroundColor: isDark ? '#121212' : '#FFFFFF'
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {notification && (
        <InAppNotification 
          title={notification.title}
          body={notification.body}
          onClose={() => setNotification(null)}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  notification: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    padding: 16,
    margin: 8,
    marginTop: Constants.statusBarHeight + 10 || 40, // Account for status bar height
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10, // Increase elevation for Android
    zIndex: 9999, // Very high z-index to ensure visibility
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  notificationBody: {
    color: 'white',
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
