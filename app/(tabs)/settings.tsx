import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  StatusBar, 
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  Linking,
  Platform,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { 
  getAvailableCountries, 
  getStatesForCountry, 
  getCitiesForState, 
  DEFAULT_REGION,
  parseRegionId
} from '../config/prayerTimeConfig';
import { 
  scheduleNotifeeTestNotification,
  initializeNotifeePrayerNotifications,
  getScheduledNotifeePrayerNotifications,
  cancelAllNotifeePrayerNotifications,
  updateNotifeePrayerNotifications,
  getNotifeeServiceStatus,
  requestExactAlarmPermission,
  checkAndHandleBatteryOptimization,
  checkAndHandlePowerManager
} from '../../utils/notifeePrayerService';
import { playTestSound } from '../../utils/audioHelper';
import { useLanguage } from '../../contexts/LanguageContext';
import { SepiaColors } from '../../constants/sepiaColors';

// Define interfaces
interface LanguageItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface NotificationSettings {
  Fajr: boolean;
  Sunrise: boolean;
  Dhuhr: boolean;
  Asr: boolean;
  Maghrib: boolean;
  Isha: boolean;
  [key: string]: boolean;
}

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function SettingsScreen() {
  const router = useRouter();
  const { t, currentLang, changeLanguage, availableLanguages } = useLanguage();
  
  // ✨ MAGICAL ANIMATIONS ✨
  const [breathingAnimation] = useState(new Animated.Value(1));
  const [glowAnimation] = useState(new Animated.Value(0));
  const [shimmerAnimation] = useState(new Animated.Value(0));
  const [headerGlowAnimation] = useState(new Animated.Value(0));
  
  // State for notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    Fajr: true,
    Sunrise: false,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true
  });

  // Add state for notification sound preference
  const [useAzanSound, setUseAzanSound] = useState(true);
  
  // Add notification status state for debugging
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  
  // Location selection state
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  
  // Get available options from config
  const countries = getAvailableCountries();
  const states = selectedCountry ? getStatesForCountry(selectedCountry) : [];
  const cities = (selectedCountry && selectedState) 
    ? getCitiesForState(selectedCountry, selectedState) 
    : [];
  
  // State for UI sections
  const [expandedSection, setExpandedSection] = useState('');
  
  // Time-based gradient colors for dynamic backgrounds
  const getTimeBasedGradient = () => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 7) { // Fajr time - ultra soft dawn
      return [SepiaColors.background.primary, SepiaColors.background.secondary, SepiaColors.surface.secondary];
    } else if (hour >= 7 && hour < 12) { // Morning - ultra light warm
      return [SepiaColors.background.primary, SepiaColors.surface.elevated, SepiaColors.background.tertiary];
    } else if (hour >= 12 && hour < 15) { // Midday - bright light sepia
      return [SepiaColors.surface.elevated, SepiaColors.background.secondary, SepiaColors.surface.secondary];
    } else if (hour >= 15 && hour < 18) { // Afternoon - light golden sepia
      return [SepiaColors.background.secondary, SepiaColors.background.tertiary, SepiaColors.surface.secondary];
    } else if (hour >= 18 && hour < 20) { // Maghrib - light sunset sepia
      return [SepiaColors.background.tertiary, SepiaColors.surface.secondary, '#F5F1E6'];
    } else { // Night/Isha - slightly deeper but still light sepia
      return [SepiaColors.surface.secondary, SepiaColors.surface.secondary, '#F2EEE1'];
    }
  };

  // ✨ MAGICAL BUTTON COMPONENT ✨
  const MagicalButton = ({ 
    onPress, 
    disabled = false, 
    style, 
    children, 
    glowColor = SepiaColors.accent.gold 
  }: {
    onPress?: () => void;
    disabled?: boolean;
    style?: any;
    children: React.ReactNode;
    glowColor?: string;
  }) => (
    <Animated.View
      style={[
        {
          transform: [{ scale: breathingAnimation }],
          opacity: glowAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.9, 1]
          }),
        }
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={[
          {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 0.5,
            borderColor: `${glowColor}30`,
            borderRadius: 16,
            overflow: 'hidden',
          },
          style
        ]}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
  
  // ✨ MAGICAL HEADER COMPONENT ✨
  const MagicalHeader = () => (
    <Animated.View style={[
      styles.magicalHeader,
      {
        opacity: headerGlowAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1]
        })
      }
    ]}>
      {/* Header background glow */}
      <Animated.View
        style={[
          styles.headerGlow,
          {
            opacity: headerGlowAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 0.3]
            })
          }
        ]}
      />
      
      {/* Header content */}
      <View style={styles.header}>
        <MagicalButton
          style={styles.backButton} 
          onPress={() => router.back()}
          glowColor={SepiaColors.accent.amber}
        >
          <MaterialCommunityIcons 
            name="arrow-left" 
            size={20} 
            color={SepiaColors.accent.gold} 
          />
        </MagicalButton>
        <Animated.Text 
          style={[
            styles.headerTitle,
            {
              transform: [{ scale: breathingAnimation }]
            }
          ]}
        >
          {t('settings')}
        </Animated.Text>
        <View style={styles.backButton} />
      </View>
    </Animated.View>
  );
  
  // ✨ MAGICAL ANIMATIONS SETUP ✨
  useEffect(() => {
    // Header glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlowAnimation, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(headerGlowAnimation, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation for components
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Breathing animation for components
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathingAnimation, {
          toValue: 1.05,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathingAnimation, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.timing(shimmerAnimation, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);
  
  // Load saved settings when component mounts
  useEffect(() => {
    const initializeApp = async () => {
      await loadSettings();
      // Initialize Notifee notification system (better reliability)
      try {
        await initializeNotifeePrayerNotifications();
        await requestExactAlarmPermission(); // For Android 12+
      } catch (error) {
        console.log('Error initializing Notifee notifications:', error);
      }
      // Modern service handles foreground notifications automatically
    };
    
    initializeApp();
  }, []);
  
  const loadSettings = async () => {
    try {
      // Load notification settings
      const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
      const notifSettings = await AsyncStorage.getItem('notification_settings');
      
      if (notifEnabled !== null) {
        setNotificationsEnabled(notifEnabled === 'true');
      }
      
      if (notifSettings !== null) {
        setNotificationSettings(JSON.parse(notifSettings));
      }

      // Load notification sound preference
      const soundPref = await AsyncStorage.getItem('use_azan_sound');
      if (soundPref !== null) {
        setUseAzanSound(soundPref === 'true');
      }
      
      // Load region setting
      const savedRegion = await AsyncStorage.getItem('selected_region');
      if (savedRegion) {
        setRegionId(savedRegion);
        
        // Parse the region ID to set selected country, state, and city
        const { countryId, stateId, cityId } = parseRegionId(savedRegion);
        setSelectedCountry(countryId);
        setSelectedState(stateId);
        setSelectedCity(cityId);
      } else {
        // Set defaults based on DEFAULT_REGION
        const { countryId, stateId, cityId } = parseRegionId(DEFAULT_REGION);
        setSelectedCountry(countryId);
        setSelectedState(stateId);
        setSelectedCity(cityId);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  
  // Request notification permissions
  const requestNotificationPermissions = async () => {
    try {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          Alert.alert(
            'Notification Permission',
            'Please enable notifications to receive prayer time alerts',
            [{ text: 'OK' }]
          );
          return false;
        }
        return true;
      } else {
        Alert.alert(
          'Physical Device Required',
          'Notifications require a physical device to work properly',
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };
  
  // Toggle notifications on/off
  const toggleNotifications = async (value: boolean) => {
    try {
      if (value) {
        // If turning on, request permissions first
        const permissionGranted = await requestNotificationPermissions();
        if (!permissionGranted) {
          return; // Don't enable if permission not granted
        }
        
        // Initialize the Notifee notification service
        console.log('🔧 Initializing Notifee notification service...');
        const initialized = await initializeNotifeePrayerNotifications();
        if (!initialized) {
          Alert.alert(
            'Notifee Setup Failed',
            'Unable to initialize Notifee notification service. Please check permissions.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('notifications_enabled', value ? 'true' : 'false');
      
      // Broadcast an event so other parts of the app know about this change
      if (value) {
        // Let the home screen know to schedule notifications
        await AsyncStorage.setItem('notifications_updated', Date.now().toString());
        console.log('✅ Notifications enabled and service initialized');
      } else {
        // Cancel all Notifee notifications if they're being disabled
        await cancelAllNotifeePrayerNotifications();
        console.log('❌ All Notifee notifications cancelled');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    }
  };
  
  // Toggle individual prayer notification settings
  const togglePrayerNotification = async (prayer: string, value: boolean) => {
    try {
      const updatedSettings = {
        ...notificationSettings,
        [prayer]: value
      };
      
      setNotificationSettings(updatedSettings);
      await AsyncStorage.setItem('notification_settings', JSON.stringify(updatedSettings));
      
      // Let the home screen know to reschedule notifications
      if (notificationsEnabled) {
        await AsyncStorage.setItem('notifications_updated', Date.now().toString());
      }
    } catch (error) {
      console.error('Error toggling prayer notification:', error);
    }
  };

  // Toggle notification sound preference
  const toggleSoundPreference = async (value: boolean) => {
    try {
      setUseAzanSound(value);
      await AsyncStorage.setItem('use_azan_sound', value ? 'true' : 'false');
      
      // Let the home screen know to reschedule notifications with new sound preference
      if (notificationsEnabled) {
        await AsyncStorage.setItem('notifications_updated', Date.now().toString());
      }
      
      // Show feedback to the user
      Alert.alert(
        'Sound Preference Updated',
        value 
          ? 'Azan sound will be used for prayer notifications. Sunrise will still use a simple beep.' 
          : 'Simple beep will be used for all prayer notifications.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error setting sound preference:', error);
    }
  };
  
  // Add a function to test notifications
  const testNotification = async () => {
    try {
      // Initialize Notifee notification system
      await initializeNotifeePrayerNotifications();
      
      // Schedule a test notification using Notifee service
      const result = await scheduleNotifeeTestNotification();
      
      if (result) {
        Alert.alert(
          'Notifee Test Scheduled',
          'You should receive a Notifee notification shortly. If not, please check your notification permissions.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Notifee Test Failed',
          'Failed to schedule test notification. Please check permissions.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert(
        'Error',
        'Failed to send test notification. Please check app permissions.',
        [{ text: 'OK' }]
      );
    }
  };

  // Add a function to test audio directly
  const testDirectSound = async () => {
    try {
      console.log("Testing direct sound playback");
      const success = await playTestSound();
      
      Alert.alert(
        "Sound Test",
        success ? 
          "Did you hear the beep sound?" : 
          "There was an error playing the sound. Please check your device settings.",
        [
          { 
            text: "No", 
            style: "cancel", 
            onPress: () => {
              console.log("Sound test failed");
              Alert.alert(
                "Sound Test Failed",
                "Try these troubleshooting steps:\n" +
                "1. Check if your device is not on silent mode\n" +
                "2. Increase the volume\n" +
                "3. Restart the app\n" +
                "4. Ensure audio files are in the assets/sounds folder"
              );
            }
          },
          { 
            text: "Yes", 
            onPress: () => console.log("Sound test succeeded") 
          }
        ]
      );
    } catch (error) {
      console.error("Error playing test sound:", error);
      Alert.alert(
        "Sound Test Failed",
        "Error: " + (error instanceof Error ? error.message : String(error)) + "\n\nPlease check if audio files are in the correct location.",
        [{ text: "OK" }]
      );
    }
  };
  
  // Add a function to test in-app notification
  const testInAppNotification = async () => {
    try {
      // Check for notification permissions using Notifee service
      const result = await initializeNotifeePrayerNotifications();
      
      if (result) {
        // If we have global.showTestNotification function (from _layout.tsx)
        if (global.showTestNotification) {
          global.showTestNotification();
          console.log("Triggered test in-app notification");
        } else {
          // Fallback to alert if function not available
          Alert.alert(
            "Test Function Not Available",
            "The in-app notification test function isn't available. Please restart the app.",
            [{ text: "OK" }]
          );
        }
      } else {
        Alert.alert(
          "Permission Required",
          "Please grant notification permission to test notifications",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error testing in-app notification:", error);
    }
  };

  // Check notification service status
  const checkNotificationStatus = async () => {
    try {
      const status = await getNotifeeServiceStatus();
      setNotificationStatus(status);
      
      Alert.alert(
        'Notification Status',
        `Initialized: ${status.initialized ? '✅' : '❌'}\n` +
        `Permissions: ${status.permissionsGranted ? '✅' : '❌'}\n` +
        `Scheduled: ${status.scheduledCount} notifications\n` +
        `Sound: ${status.soundPreference || 'Default'}\n` +
        `${status.error ? `Error: ${status.error}` : ''}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error checking notification status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to check notification status: ${errorMessage}`);
    }
  };

  // Reset all notifications with simplified service
  const resetNotifications = async () => {
    try {
      console.log('🔄 Starting notification reset...');
      
      // First clear all existing Notifee notifications
      await cancelAllNotifeePrayerNotifications();
      
      Alert.alert(
        'Notifications Reset',
        `Successfully cancelled all prayer notifications. The app will reschedule notifications automatically when you return to the home page.`,
        [{ text: 'OK' }]
      );
        
      console.log('✅ Notification reset completed successfully');
    } catch (error) {
      console.error('❌ Error resetting notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to reset notifications: ${errorMessage}`);
    }
  };

  // Force schedule notifications by getting prayer times and scheduling them
  const forceScheduleNotifications = async () => {
    try {
      console.log('🚀 Force scheduling notifications...');
      
      // First enable notifications
      await AsyncStorage.setItem('notifications_enabled', 'true');
      
      // Get today's prayer times from local storage (assuming they're cached)
      const todayKey = `prayer_${new Date().toISOString().split('T')[0]}`;
      const cachedTimes = await AsyncStorage.getItem(todayKey);
      
      if (cachedTimes) {
        const prayerData = JSON.parse(cachedTimes);
        console.log('📅 Found cached prayer times:', prayerData);
        
        await updateNotifeePrayerNotifications(prayerData, notificationSettings as any);
        
        Alert.alert(
          'Success!',
          `Successfully scheduled Notifee prayer notifications for today!`,
          [{ text: 'OK' }]
        );
        console.log('✅ Force scheduling completed successfully');
      } else {
        Alert.alert(
          'No Prayer Data',
          'No cached prayer times found. Please go to the home screen first to load prayer times, then try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error force scheduling notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to force schedule notifications: ${errorMessage}`);
    }
  };

  // Select country
  const selectCountry = (countryId: string) => {
    if (countryId === selectedCountry) return;
    
    setSelectedCountry(countryId);
    
    // Get first state for the country
    const countryStates = getStatesForCountry(countryId);
    const firstState = countryStates.length > 0 ? countryStates[0].id : '';
    setSelectedState(firstState);
    
    // Get first city for the state
    const stateCities = getCitiesForState(countryId, firstState);
    const firstCity = stateCities.length > 0 ? stateCities[0].id : '';
    setSelectedCity(firstCity);
    
    // Don't automatically update the region - wait for user to press update button
  };

  // Select state
  const selectState = (stateId: string) => {
    if (stateId === selectedState) return;
    
    setSelectedState(stateId);
    
    // Get first city for the state
    const stateCities = getCitiesForState(selectedCountry, stateId);
    const firstCity = stateCities.length > 0 ? stateCities[0].id : '';
    setSelectedCity(firstCity);
    
    // Don't automatically update the region - wait for user to press update button
  };

  // Select city
  const selectCity = (cityId: string) => {
    if (cityId === selectedCity) return;
    
    setSelectedCity(cityId);
    
    // Don't automatically update the region - wait for user to press update button
  };

  // Update the region ID and save it - simplified for no-cache system
  const updateRegionId = async () => {
    try {
      // Create the new region ID from selected country, state, and city
      const newRegionId = `${selectedCountry}-${selectedState}-${selectedCity}`;
      
      // Check if the region ID is actually changing
      if (newRegionId === regionId) {
        Alert.alert(
          'No Change',
          'You haven\'t changed your location.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Update the UI first
      setRegionId(newRegionId);
      
      // Save user preference
      await AsyncStorage.setItem('selected_region', newRegionId);
      
      // Cancel ALL existing notifications first
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('Cancelled all scheduled notifications during region change');
      
      // Clear any existing cached data (just in case)
      const cachedKeys = await AsyncStorage.getAllKeys();
      const prayerTimeKeys = cachedKeys.filter((key: string) => 
        key.startsWith('prayer_') || 
        key.startsWith('last_updated_') ||
        key === 'cached_prayer_data' ||
        key === 'last_refresh_date'
      );
      
      if (prayerTimeKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerTimeKeys);
        console.log('Cleared any existing cached data during location change');
      }
      
      // Show immediate confirmation and navigate back
      Alert.alert(
        'Location Updated',
        'Your location has been updated. The home page will refresh with new prayer times.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Navigate back to home - the no-cache system will automatically fetch fresh data
              router.push('/');
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error updating region:', error);
      Alert.alert(
        'Error',
        'Failed to update location. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Toggle a section's expanded state
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };
  // Open donation dialog with multiple options
  const openDonation = () => {
    Alert.alert(
      t('supportTitle'),
      t('supportMessage'),
      [
        { text: t('maybeLater'), style: 'cancel' },
        { 
          text: t('oneTimeSupport'), 
          onPress: () => {
            Linking.openURL('https://nas.io/checkout-global?communityId=640f2dbae2d22dff16a554d9&communityCode=AADIL_NOUFAL&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fportal%2Fproducts%2F67e825d377e3fc39a8ba9b0d%3Ftab%3Dcontent&sourceInfoType=folder&sourceInfoOrigin=67e825d377e3fc39a8ba9b0d').catch((err: Error) => 
              console.error('An error occurred while opening the link:', err)
            );
          } 
        },
        { 
          text: t('monthlySupport'), 
          onPress: () => {
            Linking.openURL('https://nas.io/checkout-global?communityId=67e828db202755d3615d3a6b&communityCode=AD_FREE_ATHAN&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fcheckout-widget%3FcommunityCode%3DAD_FREE_ATHAN%26communitySlug%3D%252Fad-free-athan%26buttonText%3DJoin%2520as%2520member%26buttonTextColorHex%3D%2523000%26buttonBgColorHex%3D%2523fccb1d%26widgetTheme%3Dlight%26backgroundColorHex%3D%2523fff%2522%2520width%3D%2522100%25%2522%2520height%3D%2522320%2522%2520frameborder%3D%25220%2522%2520referrerpolicy%3D%2522no-referrer&fromWidget=1').catch((err: Error) => 
              console.error('An error occurred while opening the link:', err)
            );
          } 
        }
      ]
    );
  }; 
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {Platform.OS === 'android' ? (
        <View style={{ 
          height: StatusBar.currentHeight || 20, 
          backgroundColor: SepiaColors.background.primary 
        }} />
      ) : (
        <StatusBar 
          barStyle="dark-content" 
          backgroundColor={SepiaColors.background.primary} 
        />
      )}
      
      <Stack.Screen 
        options={{
          headerShown: false,
          title: t('settings')
        }} 
      />
      
      {/* ✨ MAGICAL GRADIENT BACKGROUND ✨ */}
      <ExpoLinearGradient
        colors={getTimeBasedGradient() as any}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.container}>
        {/* ✨ ENHANCED MAGICAL HEADER SECTION ✨ */}
        <MagicalHeader />
      
        <ScrollView 
          style={styles.enhancedScrollView}
          contentContainerStyle={styles.enhancedScrollViewContent}
          showsVerticalScrollIndicator={false}
        >
        {/* ✨ ENHANCED LANGUAGE SETTINGS SECTION ✨ */}
        <Animated.View style={[
          styles.enhancedSection,
          {
            transform: [{ scale: shimmerAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.02, 1],
            })}]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons 
              name="web" 
              size={20} 
              color={SepiaColors.accent.gold} 
            />
            <Text style={styles.enhancedSectionTitle}>{t('language')}</Text>
          </View>
          
          {Object.values(availableLanguages).map((lang) => {
            const typedLang = lang as LanguageItem;
            return (
              <MagicalButton
                key={typedLang.id}
                onPress={() => changeLanguage(typedLang.id)}
                style={[
                  styles.enhancedLanguageOption,
                  currentLang === typedLang.id && styles.selectedEnhancedLanguageOption
                ]}
                glowColor={currentLang === typedLang.id ? SepiaColors.accent.amber : SepiaColors.accent.gold}
              >
                <Text style={[
                  styles.enhancedLanguageName,
                  currentLang === typedLang.id && styles.selectedEnhancedLanguageName
                ]}>
                  {typedLang.name}
                </Text>
                {currentLang === typedLang.id && (
                  <MaterialCommunityIcons name="check" size={20} color={SepiaColors.accent.gold} />
                )}
              </MagicalButton>
            );
          })}
        </Animated.View>
        
        {/* ✨ ENHANCED NOTIFICATION SECTION ✨ */}
        <Animated.View style={[
          styles.enhancedSection,
          {
            transform: [{ scale: shimmerAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.02, 1],
            })}]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons 
              name="bell-outline" 
              size={20} 
              color={SepiaColors.accent.gold} 
            />
            <Text style={styles.enhancedSectionTitle}>{t('notifications')}</Text>
          </View>
          
          <Animated.View style={[
            styles.enhancedSettingContainer,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1]
              })
            }
          ]}>
            <Text style={styles.enhancedSettingLabel}>{t('enableNotifications')}</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: SepiaColors.special.disabled, true: SepiaColors.accent.gold }}
              thumbColor={notificationsEnabled ? SepiaColors.accent.gold : SepiaColors.surface.secondary}
            />
          </Animated.View>

          {notificationsEnabled && (
            <>
              <Animated.View style={[
                styles.enhancedPrayerNotificationSettings,
                {
                  opacity: breathingAnimation.interpolate({
                    inputRange: [1, 1.05],
                    outputRange: [0.9, 1]
                  })
                }
              ]}>
                <Text style={styles.enhancedSettingSubtitle}>{t('notifyMeFor')}:</Text>
                {Object.keys(notificationSettings).map((prayer) => (
                  <Animated.View 
                    key={prayer} 
                    style={[
                      styles.enhancedPrayerNotificationItem,
                      {
                        transform: [{ scale: breathingAnimation }]
                      }
                    ]}
                  >
                    <View style={styles.enhancedPrayerLabelContainer}>
                      <View style={styles.enhancedPrayerIcon}>
                        <MaterialCommunityIcons
                          name={
                            prayer === 'Fajr' ? 'weather-sunset-up' :
                            prayer === 'Sunrise' ? 'white-balance-sunny' :
                            prayer === 'Dhuhr' ? 'sun-wireless' :
                            prayer === 'Asr' ? 'weather-sunny' :
                            prayer === 'Maghrib' ? 'weather-sunset-down' :
                            'weather-night'
                          }
                          size={20}
                          color={SepiaColors.accent.gold}
                        />
                      </View>
                      <Text style={styles.enhancedPrayerLabel}>{t(prayer)}</Text>
                    </View>
                    <Switch
                      value={notificationSettings[prayer]}
                      onValueChange={(value: boolean) => togglePrayerNotification(prayer, value)}
                      trackColor={{ false: SepiaColors.special.disabled, true: SepiaColors.accent.gold }}
                      thumbColor={notificationSettings[prayer] ? SepiaColors.accent.gold : SepiaColors.surface.secondary}
                    />
                  </Animated.View>
                ))}
              </Animated.View>

              {/* Enhanced Notification Sound Preference */}
              <Animated.View style={[
                styles.enhancedSoundPreferenceContainer,
                {
                  transform: [{ scale: breathingAnimation }]
                }
              ]}>
                <View style={styles.enhancedSoundPrefTextContainer}>
                  <Text style={styles.enhancedSettingLabel}>{t('useAzanSound')}</Text>
                  <Text style={styles.enhancedSettingDescription}>
                    {t('beepExplanation')}
                  </Text>
                </View>
                <Switch
                  value={useAzanSound}
                  onValueChange={toggleSoundPreference}
                  trackColor={{ false: SepiaColors.special.disabled, true: SepiaColors.accent.gold }}
                  thumbColor={useAzanSound ? SepiaColors.accent.gold : SepiaColors.surface.secondary}
                />
              </Animated.View>

              {/* Enhanced Test Notification Buttons */}
              <View style={styles.enhancedTestButtonsContainer}>
                <MagicalButton 
                  style={styles.enhancedTestButton}
                  onPress={testNotification}
                  glowColor={SepiaColors.accent.amber}
                >
                  <MaterialCommunityIcons name="bell-ring" size={18} color={SepiaColors.text.inverse} />
                  <Text style={styles.enhancedTestButtonText}>{t('testNotification')}</Text>
                </MagicalButton>
                
                {/* Enhanced Notification Status Button */}
                <MagicalButton 
                  style={[styles.enhancedTestButton, { marginTop: 10, backgroundColor: SepiaColors.accent.copper }]}
                  onPress={checkNotificationStatus}
                  glowColor={SepiaColors.accent.copper}
                >
                  <MaterialCommunityIcons name="information-outline" size={18} color={SepiaColors.text.inverse} />
                  <Text style={styles.enhancedTestButtonText}>Status</Text>
                </MagicalButton>
              </View>
            </>
          )}
        </Animated.View>

        {/* ✨ ENHANCED LOCATION SECTION ✨ */}
        <Animated.View style={[
          styles.enhancedSection,
          {
            transform: [{ scale: shimmerAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.02, 1],
            })}]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons 
              name="map-marker" 
              size={20} 
              color={SepiaColors.accent.gold} 
            />
            <Text style={styles.enhancedSectionTitle}>{t('locationSettings')}</Text>
          </View>
          <Text style={styles.enhancedSectionDescription}>
            {t('selectLocation')}
          </Text>
          
          {/* Enhanced Country Selection */}
          <MagicalButton 
            style={styles.enhancedLocationSelector}
            onPress={() => toggleSection('country')}
            glowColor={SepiaColors.accent.amber}
          >
            <View style={styles.enhancedLocationSelectorHeader}>
              <Text style={styles.enhancedLocationLabel}>{t('country')}</Text>
              <View style={styles.enhancedLocationSelection}>
                <Text style={styles.enhancedLocationValue}>
                  {countries.find(c => c.id === selectedCountry)?.name || t('selectCountry')}
                </Text>
                <MaterialCommunityIcons 
                  name={expandedSection === 'country' ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color={SepiaColors.accent.gold} 
                />
              </View>
            </View>
          </MagicalButton>

          {expandedSection === 'country' && (
            <Animated.View style={[
              styles.enhancedOptionsContainer,
              {
                opacity: breathingAnimation.interpolate({
                  inputRange: [1, 1.05],
                  outputRange: [0.9, 1]
                })
              }
            ]}>
              {countries.map(country => (
                <MagicalButton 
                  key={country.id}
                  style={[
                    styles.enhancedOptionItem,
                    selectedCountry === country.id && styles.selectedEnhancedOptionItem
                  ]}
                  onPress={() => selectCountry(country.id)}
                  glowColor={selectedCountry === country.id ? SepiaColors.accent.amber : SepiaColors.accent.gold}
                >
                  <Text style={[
                    styles.enhancedOptionName,
                    selectedCountry === country.id && styles.selectedEnhancedOptionName
                  ]}>
                    {country.name}
                  </Text>
                  {selectedCountry === country.id && (
                    <MaterialCommunityIcons name="check" size={18} color={SepiaColors.accent.gold} />
                  )}
                </MagicalButton>
              ))}
            </Animated.View>
          )}

          {/* Enhanced State Selection */}
          <MagicalButton 
            style={[styles.enhancedLocationSelector, { marginTop: 16 }]}
            onPress={() => toggleSection('state')}
            glowColor={SepiaColors.accent.amber}
          >
            <View style={styles.enhancedLocationSelectorHeader}>
              <Text style={styles.enhancedLocationLabel}>{t('state')}</Text>
              <View style={styles.enhancedLocationSelection}>
                <Text style={styles.enhancedLocationValue}>
                  {states.find(s => s.id === selectedState)?.name || t('selectState')}
                </Text>
                <MaterialCommunityIcons 
                  name={expandedSection === 'state' ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color={SepiaColors.accent.gold} 
                />
              </View>
            </View>
          </MagicalButton>

          {expandedSection === 'state' && (
            <Animated.View style={[
              styles.enhancedOptionsContainer,
              {
                opacity: breathingAnimation.interpolate({
                  inputRange: [1, 1.05],
                  outputRange: [0.9, 1]
                })
              }
            ]}>
              {states.map(state => (
                <MagicalButton 
                  key={state.id}
                  style={[
                    styles.enhancedOptionItem,
                    selectedState === state.id && styles.selectedEnhancedOptionItem
                  ]}
                  onPress={() => selectState(state.id)}
                  glowColor={selectedState === state.id ? SepiaColors.accent.amber : SepiaColors.accent.gold}
                >
                  <Text style={[
                    styles.enhancedOptionName,
                    selectedState === state.id && styles.selectedEnhancedOptionName
                  ]}>
                    {state.name}
                  </Text>
                  {selectedState === state.id && (
                    <MaterialCommunityIcons name="check" size={18} color={SepiaColors.accent.gold} />
                  )}
                </MagicalButton>
              ))}
            </Animated.View>
          )}

          {/* Enhanced City Selection */}
          <MagicalButton 
            style={[styles.enhancedLocationSelector, { marginTop: 16 }]}
            onPress={() => toggleSection('city')}
            glowColor={SepiaColors.accent.amber}
          >
            <View style={styles.enhancedLocationSelectorHeader}>
              <Text style={styles.enhancedLocationLabel}>{t('city')}</Text>
              <View style={styles.enhancedLocationSelection}>
                <Text style={styles.enhancedLocationValue}>
                  {cities.find(c => c.id === selectedCity)?.name || t('selectCity')}
                </Text>
                <MaterialCommunityIcons 
                  name={expandedSection === 'city' ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color={SepiaColors.accent.gold} 
                />
              </View>
            </View>
          </MagicalButton>

          {expandedSection === 'city' && (
            <Animated.View style={[
              styles.enhancedOptionsContainer,
              {
                opacity: breathingAnimation.interpolate({
                  inputRange: [1, 1.05],
                  outputRange: [0.9, 1]
                })
              }
            ]}>
              {cities.map(city => (
                <MagicalButton 
                  key={city.id}
                  style={[
                    styles.enhancedOptionItem,
                    selectedCity === city.id && styles.selectedEnhancedOptionItem
                  ]}
                  onPress={() => selectCity(city.id)}
                  glowColor={selectedCity === city.id ? SepiaColors.accent.amber : SepiaColors.accent.gold}
                >
                  <Text style={[
                    styles.enhancedOptionName,
                    selectedCity === city.id && styles.selectedEnhancedOptionName
                  ]}>
                    {city.name}
                  </Text>
                  {selectedCity === city.id && (
                    <MaterialCommunityIcons name="check" size={18} color={SepiaColors.accent.gold} />
                  )}
                </MagicalButton>
              ))}
            </Animated.View>
          )}

          {/* Enhanced Location Summary */}
          <Animated.View style={[
            styles.enhancedLocationSummary,
            {
              transform: [{ scale: breathingAnimation }]
            }
          ]}>
            <MaterialCommunityIcons name="map-marker" size={20} color={SepiaColors.accent.gold} />
            <Text style={styles.enhancedLocationSummaryText}>
              {cities.find(c => c.id === selectedCity)?.name || 'City'}, {' '}
              {states.find(s => s.id === selectedState)?.name || 'State'}, {' '}
              {countries.find(c => c.id === selectedCountry)?.name || 'Country'}
            </Text>
          </Animated.View>

          {/* Enhanced Update Location Button */}
          <MagicalButton 
            style={styles.enhancedUpdateLocationButton}
            onPress={updateRegionId}
            glowColor={SepiaColors.accent.amber}
          >
            <MaterialCommunityIcons name="map-marker-check" size={18} color={SepiaColors.text.inverse} />
            <Text style={styles.enhancedUpdateLocationButtonText}>{t('updateLocation')}</Text>
          </MagicalButton>
        </Animated.View>
      
        {/* ✨ ENHANCED ABOUT SECTION ✨ */}
        <Animated.View style={[
          styles.enhancedSection,
          {
            transform: [{ scale: shimmerAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.02, 1],
            })}]
          }
        ]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons 
              name="information-outline" 
              size={20} 
              color={SepiaColors.accent.gold} 
            />
            <Text style={styles.enhancedSectionTitle}>{t('about')}</Text>
          </View>
          <Animated.View style={[
            styles.enhancedAboutContainer,
            {
              opacity: breathingAnimation.interpolate({
                inputRange: [1, 1.05],
                outputRange: [0.9, 1]
              })
            }
          ]}>
            <Text style={styles.enhancedAppVersion}>{t('appVersion')}</Text>
            <Text style={styles.enhancedAboutText}>
              {t('aboutText')}
            </Text>
            <View style={styles.enhancedSupportButtonsContainer}>
              <MagicalButton 
                style={styles.enhancedSupportButton} 
                onPress={openDonation}
                glowColor={SepiaColors.accent.amber}
              >
                <MaterialCommunityIcons name="gift" size={18} color={SepiaColors.text.inverse} />
                <Text style={styles.enhancedSupportButtonText}>{t('supportApp')}</Text>
              </MagicalButton>
            </View>
          </Animated.View>
        </Animated.View>
        
        {/* Footer Padding */}
        <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ✨ ENHANCED LAYOUT STYLES FROM HOMEPAGE ✨
  safeArea: {
    flex: 1,
    backgroundColor: SepiaColors.background.primary,
  },
  container: {
    flex: 1,
    paddingHorizontal: 12, // Match homepage padding
    paddingTop: 0,
    paddingBottom: 90, // Extra padding for tab bar
    backgroundColor: 'transparent', // Make transparent to show gradient
  },
  
  // ✨ MAGICAL HEADER STYLES ✨
  magicalHeader: {
    position: 'relative',
    paddingVertical: 4, // Reduced from 8 to 4
    paddingHorizontal: 12,
    marginBottom: 4, // Reduced from 8 to 4
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SepiaColors.accent.gold,
    borderRadius: 20,
  },
  
  // Enhanced Scroll View
  enhancedScrollView: {
    flex: 1,
  },
  enhancedScrollViewContent: {
    paddingBottom: 40,
  },
  
  // ✨ ENHANCED SECTION STYLES ✨
  enhancedSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(218, 165, 32, 0.15)',
  },
  enhancedSectionTitle: {
    color: SepiaColors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  
  // Enhanced Language Option Styles
  enhancedLanguageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.1)',
  },
  selectedEnhancedLanguageOption: {
    backgroundColor: 'rgba(218, 165, 32, 0.08)',
    borderColor: 'rgba(218, 165, 32, 0.25)',
  },
  enhancedLanguageName: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  selectedEnhancedLanguageName: {
    color: SepiaColors.accent.darkGold,
    fontWeight: '700',
  },
  
  // Enhanced Setting Container Styles
  enhancedSettingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.15)',
    marginBottom: 12,
  },
  enhancedSettingLabel: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  
  // Enhanced Prayer Notification Styles
  enhancedPrayerNotificationSettings: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.1)',
  },
  enhancedSettingSubtitle: {
    color: SepiaColors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  enhancedPrayerNotificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.08)',
  },
  enhancedPrayerLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  enhancedPrayerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(218, 165, 32, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  enhancedPrayerLabel: {
    color: SepiaColors.text.primary,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  
  // Enhanced Sound Preference Styles
  enhancedSoundPreferenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.15)',
    marginTop: 12,
  },
  enhancedSoundPrefTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  enhancedSettingDescription: {
    color: SepiaColors.text.secondary,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  
  // Enhanced Test Button Styles
  enhancedTestButtonsContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  enhancedTestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 180,
  },
  enhancedTestButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  
  // Enhanced Section Description
  enhancedSectionDescription: {
    color: SepiaColors.text.secondary,
    fontSize: 14,
    marginBottom: 16,
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  
  // Enhanced Location Selector Styles
  enhancedLocationSelector: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.15)',
    marginBottom: 8,
  },
  enhancedLocationSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  enhancedLocationLabel: {
    color: SepiaColors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  enhancedLocationSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(218, 165, 32, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  enhancedLocationValue: {
    color: SepiaColors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
    letterSpacing: 0.3,
  },
  
  // Enhanced Options Container Styles
  enhancedOptionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.1)',
  },
  enhancedOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.08)',
  },
  selectedEnhancedOptionItem: {
    backgroundColor: 'rgba(218, 165, 32, 0.08)',
    borderColor: 'rgba(218, 165, 32, 0.25)',
  },
  enhancedOptionName: {
    color: SepiaColors.text.primary,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  selectedEnhancedOptionName: {
    color: SepiaColors.accent.darkGold,
    fontWeight: '600',
  },
  
  // Enhanced Location Summary Styles
  enhancedLocationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(218, 165, 32, 0.06)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.2)',
  },
  enhancedLocationSummaryText: {
    color: SepiaColors.text.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  
  // Enhanced Update Location Button
  enhancedUpdateLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 16,
    minWidth: 180,
  },
  enhancedUpdateLocationButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  
  // Enhanced About Section Styles
  enhancedAboutContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.1)',
  },
  enhancedAppVersion: {
    color: SepiaColors.accent.gold,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  enhancedAboutText: {
    color: SepiaColors.text.secondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  enhancedSupportButtonsContainer: {
    alignItems: 'center',
  },
  enhancedSupportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 160,
  },
  enhancedSupportButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  
  // Original styles with homepage enhancements
  container_old: {
    flex: 1,
    backgroundColor: SepiaColors.background.primary, // Main sepia background like homepage
    paddingBottom: 90, // Account for tab bar height + safe area
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4, // Reduced from 8 to 4
    paddingHorizontal: 12,
    marginBottom: 0,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 4 : 8, // Reduced padding
  },
  backButton: {
    width: 32, // Reduced from 36 to 32
    height: 32, // Reduced from 36 to 32
    borderRadius: 16, // Reduced from 18 to 16
    backgroundColor: 'rgba(218, 165, 32, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: SepiaColors.text.primary,
    fontSize: 16, // Reduced from 20 to 16
    fontWeight: '600', // Reduced from 700 to 600
    letterSpacing: 0.3, // Reduced from 0.5 to 0.3
    textAlign: 'center',
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 12, // Match homepage padding
  },
  section: {
    margin: 8, // Reduced spacing like homepage
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)', // Exact same as homepage cards
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.15)',
    marginBottom: 12, // Add bottom margin for spacing
  },
  sectionTitle: {
    color: SepiaColors.accent.gold,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12, // Reduced from 16
    letterSpacing: 0.5,
  },
  sectionDescription: {
    color: SepiaColors.text.secondary,
    fontSize: 14, // Reduced from 16
    marginBottom: 12, // Reduced from 16
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  settingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12, // Reduced from 16
    borderBottomWidth: 0.5, // Thinner border
    borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
  },
  settingLabel: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    fontWeight: '600', // Increased from 500
    letterSpacing: 0.3,
  },
  settingSubtitle: {
    color: SepiaColors.text.primary,
    fontSize: 15, // Reduced from 16
    fontWeight: '600', // Increased from 500
    marginVertical: 8, // Reduced from 10
    letterSpacing: 0.3,
  },
  prayerNotificationSettings: {
    marginTop: 8, // Reduced from 10
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
    borderRadius: 16,
    padding: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.1)',
  },
  prayerNotificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10, // Reduced from 12
    borderBottomWidth: 0.5, // Thinner border
    borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
  },
  prayerLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(218, 165, 32, 0.05)', // Add subtle background
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  prayerLabel: {
    color: SepiaColors.text.primary,
    fontSize: 15, // Reduced from 16
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  collapsibleHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
    borderRadius: 16, // Increased for elegant look
    overflow: 'hidden',
    borderWidth: 0.5, // Thinner border
    borderColor: 'rgba(218, 165, 32, 0.2)', // Subtle gold border
  },
  locationSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12, // Reduced from 14
  },
  locationLabel: {
    color: SepiaColors.text.primary,
    fontSize: 15, // Reduced from 16
    fontWeight: '600', // Increased from 500
    letterSpacing: 0.3,
  },
  locationSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(218, 165, 32, 0.05)', // Add subtle background
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locationValue: {
    color: SepiaColors.accent.gold,
    fontSize: 15, // Reduced from 16
    fontWeight: '700', // Increased from 600
    marginRight: 6, // Reduced from 8
    letterSpacing: 0.3,
  },
  optionsContainer: {
    marginTop: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
    borderRadius: 12, // Increased for elegant look
    paddingVertical: 6, // Reduced from 8
    maxHeight: 200,
    borderWidth: 0.5, // Thinner border
    borderColor: 'rgba(218, 165, 32, 0.2)', // Subtle gold border
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10, // Reduced from 12
    paddingHorizontal: 16,
    borderBottomWidth: 0.5, // Thinner border
    borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
  },
  selectedOptionItem: {
    backgroundColor: 'rgba(218, 165, 32, 0.1)', // Subtle gold highlight
  },
  optionName: {
    color: SepiaColors.text.primary,
    fontSize: 15, // Reduced from 16
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  selectedOptionName: {
    color: SepiaColors.accent.gold,
    fontWeight: '700', // Increased from bold
    letterSpacing: 0.3,
  },
  locationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16, // Reduced from 20
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
    padding: 14, // Reduced from 16
    borderRadius: 16, // Increased for elegant look
    borderWidth: 0.5, // Thinner border
    borderColor: 'rgba(218, 165, 32, 0.2)', // Subtle gold border
  },
  locationSummaryText: {
    color: SepiaColors.text.primary,
    fontSize: 15, // Reduced from 16
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  aboutContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.1)',
  },
  appVersion: {
    color: SepiaColors.text.primary,
    fontSize: 16, // Reduced from 18
    fontWeight: '700', // Increased from bold
    marginBottom: 10, // Reduced from 12
    letterSpacing: 0.5,
  },
  aboutText: {
    color: SepiaColors.text.secondary,
    fontSize: 14, // Reduced from 16
    textAlign: 'center',
    lineHeight: 22, // Reduced from 24
    marginBottom: 16, // Reduced from 20
    letterSpacing: 0.3,
  },
  supportButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4, // Reduced from 5
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 18, // Reduced from 20
    paddingVertical: 10, // Reduced from 12
    borderRadius: 20, // Reduced from 24
    // Remove all shadow/elevation properties for clean look
  },
  supportButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 15, // Reduced from 16
    fontWeight: '700', // Increased from bold
    marginLeft: 6, // Reduced from 8
    letterSpacing: 0.3,
  },
  settingDescription: {
    color: SepiaColors.text.tertiary,
    fontSize: 13, // Reduced from 14
    marginTop: 3, // Reduced from 4
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  testButtonsContainer: {
    marginTop: 12, // Reduced from 16
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
    borderRadius: 16,
    padding: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(218, 165, 32, 0.1)',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 14, // Reduced from 16
    paddingVertical: 8, // Reduced from 10
    borderRadius: 20, // Reduced from 24
    alignSelf: 'center',
    minWidth: 180, // Reduced from 200
    marginVertical: 4, // Add spacing between buttons
    // Remove all shadow/elevation properties for clean look
  },
  testButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 14, // Reduced from 16
    fontWeight: '700', // Increased from bold
    marginLeft: 6, // Reduced from 8
    letterSpacing: 0.3,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12, // Reduced from 16
    paddingHorizontal: 16, // Reduced from 20
    borderBottomWidth: 0.5, // Thinner border
    borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
  },
  selectedLanguageOption: {
    backgroundColor: 'rgba(218, 165, 32, 0.1)', // Subtle gold highlight
  },
  languageName: {
    color: SepiaColors.text.primary,
    fontSize: 16, // Reduced from 18
    fontWeight: '600', // Increased from 500
    letterSpacing: 0.3,
  },
  updateLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 14, // Reduced from 16
    paddingVertical: 8, // Reduced from 10
    borderRadius: 20, // Reduced from 24
    alignSelf: 'center',
    minWidth: 180, // Reduced from 200
    // Remove all shadow/elevation properties for clean look
    marginTop: 12, // Reduced from 16
  },
  updateLocationButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 14, // Reduced from 16
    fontWeight: '700', // Increased from bold
    marginLeft: 6, // Reduced from 8
    letterSpacing: 0.3,
  },
  // Fixed sound preference container with proper layout
  soundPreferenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12, // Reduced from 16
    borderBottomWidth: 0.5, // Thinner border
    borderBottomColor: 'rgba(218, 165, 32, 0.15)', // Subtle gold border
  },
  soundPrefTextContainer: {
    flex: 1,
    paddingRight: 12, // Reduced from 16
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
    borderRadius: 12,
    padding: 8,
    marginRight: 8,
  },
});
