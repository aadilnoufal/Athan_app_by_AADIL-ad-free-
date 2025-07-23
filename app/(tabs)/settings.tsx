import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  View, 
  StatusBar, 
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  Linking,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
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
  scheduleImmediateNotification, 
  setupNotificationChannels, 
  requestBatteryOptimizationExemption, 
  checkAndRequestNotificationPermissions, 
  setupForegroundNotificationHandler 
} from '../../utils/notificationService';
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

export default function SettingsScreen() {
  const router = useRouter();
  const { t, currentLang, changeLanguage, isRTL, availableLanguages } = useLanguage();
  
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
  
  // Load saved settings when component mounts
  useEffect(() => {
    loadSettings();
    setupNotificationChannels();
    setupForegroundNotificationHandler(); // Add this to handle in-app notifications
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
      }
      
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('notifications_enabled', value ? 'true' : 'false');
      
      // Broadcast an event so other parts of the app know about this change
      if (value) {
        // Let the home screen know to schedule notifications
        await AsyncStorage.setItem('notifications_updated', Date.now().toString());
      } else {
        // Cancel all notifications if they're being disabled
        await Notifications.cancelAllScheduledNotificationsAsync();
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
      // First ensure channels are set up (Android)
      await setupNotificationChannels();
      
      // Request battery optimization exemption (Android)
      await requestBatteryOptimizationExemption();
      
      // Schedule a test notification
      await scheduleImmediateNotification('Test');
      
      Alert.alert(
        'Test Notification Sent',
        'You should receive a notification in about 5 seconds. If not, please check your notification permissions.',
        [{ text: 'OK' }]
      );
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
      // Check for notification permissions first
      const hasPermission = await checkAndRequestNotificationPermissions();
      
      if (hasPermission) {
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
      const prayerTimeKeys = cachedKeys.filter(key => 
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
            Linking.openURL('https://nas.io/checkout-global?communityId=640f2dbae2d22dff16a554d9&communityCode=AADIL_NOUFAL&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fportal%2Fproducts%2F67e825d377e3fc39a8ba9b0d%3Ftab%3Dcontent&sourceInfoType=folder&sourceInfoOrigin=67e825d377e3fc39a8ba9b0d').catch(err => 
              console.error('An error occurred while opening the link:', err)
            );
          } 
        },
        { 
          text: t('monthlySupport'), 
          onPress: () => {
            Linking.openURL('https://nas.io/checkout-global?communityId=67e828db202755d3615d3a6b&communityCode=AD_FREE_ATHAN&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fcheckout-widget%3FcommunityCode%3DAD_FREE_ATHAN%26communitySlug%3D%252Fad-free-athan%26buttonText%3DJoin%2520as%2520member%26buttonTextColorHex%3D%2523000%26buttonBgColorHex%3D%2523fccb1d%26widgetTheme%3Dlight%26backgroundColorHex%3D%2523fff%2522%2520width%3D%2522100%25%2522%2520height%3D%2522320%2522%2520frameborder%3D%25220%2522%2520referrerpolicy%3D%2522no-referrer&fromWidget=1').catch(err => 
              console.error('An error occurred while opening the link:', err)
            );
          } 
        }
      ]
    );
  }; 
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: false,
          title: t('settings')
        }} 
      />
      <StatusBar barStyle="dark-content" backgroundColor={SepiaColors.background.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons 
            name="arrow-left" 
            size={24} 
            color={SepiaColors.accent.gold} 
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView 
        style={[styles.scrollView, {direction: isRTL ? 'rtl' : 'ltr'}]}
        showsVerticalScrollIndicator={false}
      >
        {/* Language Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('language')}</Text>
          
          {Object.values(availableLanguages).map((lang) => {
            const typedLang = lang as LanguageItem;
            return (
              <TouchableOpacity
                key={typedLang.id}
                style={[
                  styles.languageOption,
                  currentLang === typedLang.id && styles.selectedLanguageOption
                ]}
                onPress={() => changeLanguage(typedLang.id)}
              >
                <Text style={styles.languageName}>{typedLang.name}</Text>
                {currentLang === typedLang.id && (
                  <MaterialCommunityIcons name="check" size={24} color={SepiaColors.accent.gold} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Notification Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notifications')}</Text>
          
          <View style={styles.settingContainer}>
            <Text style={styles.settingLabel}>{t('enableNotifications')}</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: SepiaColors.special.disabled, true: SepiaColors.accent.gold }}
              thumbColor={notificationsEnabled ? SepiaColors.accent.gold : SepiaColors.surface.secondary}
            />
          </View>

          {notificationsEnabled && (
            <>
              <View style={styles.prayerNotificationSettings}>
                <Text style={styles.settingSubtitle}>{t('notifyMeFor')}:</Text>
                {Object.keys(notificationSettings).map((prayer) => (
                  <View key={prayer} style={styles.prayerNotificationItem}>
                    <View style={styles.prayerLabelContainer}>
                      <MaterialCommunityIcons
                        name={
                          prayer === 'Fajr' ? 'weather-sunset-up' :
                          prayer === 'Sunrise' ? 'white-balance-sunny' :
                          prayer === 'Dhuhr' ? 'sun-wireless' :
                          prayer === 'Asr' ? 'weather-sunny' :
                          prayer === 'Maghrib' ? 'weather-sunset-down' :
                          'weather-night'
                        }
                        size={22}
                        color={SepiaColors.accent.gold}
                        style={{ marginRight: 12 }}
                      />
                      <Text style={styles.prayerLabel}>{t(prayer)}</Text>
                    </View>
                    <Switch
                      value={notificationSettings[prayer]}
                      onValueChange={(value) => togglePrayerNotification(prayer, value)}
                      trackColor={{ false: SepiaColors.special.disabled, true: SepiaColors.accent.gold }}
                      thumbColor={notificationSettings[prayer] ? SepiaColors.accent.gold : SepiaColors.surface.secondary}
                    />
                  </View>
                ))}
              </View>

              {/* Notification Sound Preference - Fixed layout */}
              <View style={[styles.soundPreferenceContainer, { marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }]}>
                <View style={styles.soundPrefTextContainer}>
                  <Text style={styles.settingLabel}>{t('useAzanSound')}</Text>
                  <Text style={styles.settingDescription}>
                    {t('beepExplanation')}
                  </Text>
                </View>
                <Switch
                  value={useAzanSound}
                  onValueChange={toggleSoundPreference}
                  trackColor={{ false: SepiaColors.special.disabled, true: SepiaColors.accent.gold }}
                  thumbColor={useAzanSound ? SepiaColors.accent.gold : SepiaColors.surface.secondary}
                />
              </View>

              {/* Test buttons container */}
              <View style={styles.testButtonsContainer}>
                <TouchableOpacity 
                  style={styles.testButton}
                  onPress={testNotification}
                >
                  <MaterialCommunityIcons name="bell-ring" size={20} color={SepiaColors.text.inverse} />
                  <Text style={styles.testButtonText}>{t('testNotification')}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.testButton, {marginTop: 10}]}
                  onPress={testDirectSound}
                >
                  <MaterialCommunityIcons name="volume-high" size={20} color={SepiaColors.text.inverse} />
                  <Text style={styles.testButtonText}>{t('testSound')}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.testButton, {marginTop: 10}]}
                  onPress={testInAppNotification}
                >
                  <MaterialCommunityIcons name="message-alert" size={20} color={SepiaColors.text.inverse} />
                  <Text style={styles.testButtonText}>{t('testInAppAlert')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('locationSettings')}</Text>
          <Text style={styles.sectionDescription}>
            {t('selectLocation')}
          </Text>
          
          {/* Country Selection */}
          <TouchableOpacity 
            style={styles.collapsibleHeader}
            onPress={() => toggleSection('country')}
          >
            <View style={styles.locationSelectorHeader}>
              <Text style={styles.locationLabel}>{t('country')}</Text>
              <View style={styles.locationSelection}>
                <Text style={styles.locationValue}>
                  {countries.find(c => c.id === selectedCountry)?.name || t('selectCountry')}
                </Text>
                <MaterialCommunityIcons 
                  name={expandedSection === 'country' ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color={SepiaColors.accent.gold} 
                />
              </View>
            </View>
          </TouchableOpacity>

          {expandedSection === 'country' && (
            <View style={styles.optionsContainer}>
              {countries.map(country => (
                <TouchableOpacity 
                  key={country.id}
                  style={[
                    styles.optionItem,
                    selectedCountry === country.id && styles.selectedOptionItem
                  ]}
                  onPress={() => selectCountry(country.id)}
                >
                  <Text style={[
                    styles.optionName,
                    selectedCountry === country.id && styles.selectedOptionName
                  ]}>
                    {country.name}
                  </Text>
                  {selectedCountry === country.id && (
                    <MaterialCommunityIcons name="check" size={20} color={SepiaColors.accent.gold} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* State Selection */}
          <TouchableOpacity 
            style={[styles.collapsibleHeader, { marginTop: 16 }]}
            onPress={() => toggleSection('state')}
          >
            <View style={styles.locationSelectorHeader}>
              <Text style={styles.locationLabel}>{t('state')}</Text>
              <View style={styles.locationSelection}>
                <Text style={styles.locationValue}>
                  {states.find(s => s.id === selectedState)?.name || t('selectState')}
                </Text>
                <MaterialCommunityIcons 
                  name={expandedSection === 'state' ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color={SepiaColors.accent.gold} 
                />
              </View>
            </View>
          </TouchableOpacity>

          {expandedSection === 'state' && (
            <View style={styles.optionsContainer}>
              {states.map(state => (
                <TouchableOpacity 
                  key={state.id}
                  style={[
                    styles.optionItem,
                    selectedState === state.id && styles.selectedOptionItem
                  ]}
                  onPress={() => selectState(state.id)}
                >
                  <Text style={[
                    styles.optionName,
                    selectedState === state.id && styles.selectedOptionName
                  ]}>
                    {state.name}
                  </Text>
                  {selectedState === state.id && (
                    <MaterialCommunityIcons name="check" size={20} color={SepiaColors.accent.gold} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* City Selection */}
          <TouchableOpacity 
            style={[styles.collapsibleHeader, { marginTop: 16 }]}
            onPress={() => toggleSection('city')}
          >
            <View style={styles.locationSelectorHeader}>
              <Text style={styles.locationLabel}>{t('city')}</Text>
              <View style={styles.locationSelection}>
                <Text style={styles.locationValue}>
                  {cities.find(c => c.id === selectedCity)?.name || t('selectCity')}
                </Text>
                <MaterialCommunityIcons 
                  name={expandedSection === 'city' ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color={SepiaColors.accent.gold} 
                />
              </View>
            </View>
          </TouchableOpacity>

          {expandedSection === 'city' && (
            <View style={styles.optionsContainer}>
              {cities.map(city => (
                <TouchableOpacity 
                  key={city.id}
                  style={[
                    styles.optionItem,
                    selectedCity === city.id && styles.selectedOptionItem
                  ]}
                  onPress={() => selectCity(city.id)}
                >
                  <Text style={[
                    styles.optionName,
                    selectedCity === city.id && styles.selectedOptionName
                  ]}>
                    {city.name}
                  </Text>
                  {selectedCity === city.id && (
                    <MaterialCommunityIcons name="check" size={20} color={SepiaColors.accent.gold} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected Location Summary */}
          <View style={styles.locationSummary}>
            <MaterialCommunityIcons name="map-marker" size={24} color={SepiaColors.accent.gold} />
            <Text style={styles.locationSummaryText}>
              {cities.find(c => c.id === selectedCity)?.name || 'City'}, {' '}
              {states.find(s => s.id === selectedState)?.name || 'State'}, {' '}
              {countries.find(c => c.id === selectedCountry)?.name || 'Country'}
            </Text>
          </View>

          {/* Update Location Button - Prominent and clear */}
          <TouchableOpacity 
            style={styles.updateLocationButton}
            onPress={updateRegionId}
          >
            <MaterialCommunityIcons name="map-marker-check" size={20} color={SepiaColors.text.inverse} />
            <Text style={styles.updateLocationButtonText}>{t('updateLocation')}</Text>
          </TouchableOpacity>
        </View>
      
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about')}</Text>
          <View style={styles.aboutContainer}>
            <Text style={styles.appVersion}>{t('appVersion')}</Text>
            <Text style={styles.aboutText}>
              {t('aboutText')}
            </Text>
            <View style={styles.supportButtonsContainer}>
              <TouchableOpacity style={styles.supportButton} onPress={openDonation}>
                <MaterialCommunityIcons name="gift" size={20} color={SepiaColors.text.inverse} />
                <Text style={styles.supportButtonText}>{t('supportApp')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Footer Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SepiaColors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: SepiaColors.surface.elevated,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 18,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: SepiaColors.text.primary,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
    backgroundColor: SepiaColors.surface.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
  },
  sectionTitle: {
    color: SepiaColors.accent.gold,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  sectionDescription: {
    color: SepiaColors.text.secondary,
    fontSize: 16,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  settingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  settingLabel: {
    color: SepiaColors.text.primary,
    fontSize: 18,
    fontWeight: '500',
  },
  settingSubtitle: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    fontWeight: '500',
    marginVertical: 10,
  },
  prayerNotificationSettings: {
    marginTop: 10,
  },
  prayerNotificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  prayerLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prayerLabel: {
    color: SepiaColors.text.primary,
    fontSize: 16,
  },
  collapsibleHeader: {
    backgroundColor: SepiaColors.surface.secondary,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
  },
  locationSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  locationLabel: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  locationSelection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationValue: {
    color: SepiaColors.accent.gold,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  optionsContainer: {
    marginTop: 2,
    backgroundColor: SepiaColors.surface.elevated,
    borderRadius: 10,
    paddingVertical: 8,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: SepiaColors.border.light,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  selectedOptionItem: {
    backgroundColor: SepiaColors.special.highlight,
  },
  optionName: {
    color: SepiaColors.text.primary,
    fontSize: 16,
  },
  selectedOptionName: {
    color: SepiaColors.accent.gold,
    fontWeight: 'bold',
  },
  locationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: SepiaColors.surface.secondary,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SepiaColors.border.medium,
  },
  locationSummaryText: {
    color: SepiaColors.text.primary,
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  aboutContainer: {
    alignItems: 'center',
  },
  appVersion: {
    color: SepiaColors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  aboutText: {
    color: SepiaColors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  supportButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 5,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: SepiaColors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  supportButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  settingDescription: {
    color: SepiaColors.text.tertiary,
    fontSize: 14,
    marginTop: 4,
  },
  testButtonsContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    alignSelf: 'center',
    minWidth: 200,
    shadowColor: SepiaColors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  testButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  selectedLanguageOption: {
    backgroundColor: SepiaColors.special.highlight,
  },
  languageName: {
    color: SepiaColors.text.primary,
    fontSize: 18,
    fontWeight: '500',
  },
  updateLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SepiaColors.accent.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    alignSelf: 'center',
    minWidth: 200,
    shadowColor: SepiaColors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    marginTop: 20,
  },
  updateLocationButtonText: {
    color: SepiaColors.text.inverse,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Fixed sound preference container with proper layout
  soundPreferenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: SepiaColors.border.light,
  },
  soundPrefTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
});
