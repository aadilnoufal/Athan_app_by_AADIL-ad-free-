/**
 * useSettingsLocation
 *
 * Custom hook that encapsulates all location-related settings state and handlers 
 * for the Settings screen. Manages country/state/city selection and region updates.
 *
 * Note: updateRegionId cancels notifications and clears prayer cache when the
 * region changes — this is intentional cross-cutting behaviour required so that
 * prayer times are refreshed for the new location.
 */
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import {
  getAvailableCountries,
  getStatesForCountry,
  getCitiesForState,
  DEFAULT_REGION,
  parseRegionId,
} from '../../app/config/prayerTimeConfig';
import { updateCountryTopic } from '../../utils/pushNotifications';
import { useLanguage } from '../../contexts/LanguageContext';

interface UseSettingsLocationOptions {
  /** Expo Router push — used to navigate home after a location update */
  navigateHome: () => void;
}

export function useSettingsLocation({ navigateHome }: UseSettingsLocationOptions) {  const { t } = useLanguage();  // ── State ────────────────────────────────────────────────────────────
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Derived lists from config
  const countries = getAvailableCountries();
  const states = selectedCountry ? getStatesForCountry(selectedCountry) : [];
  const cities =
    selectedCountry && selectedState
      ? getCitiesForState(selectedCountry, selectedState)
      : [];

  // ── Load on mount ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const savedRegion = await AsyncStorage.getItem('selected_region');
        if (savedRegion) {
          setRegionId(savedRegion);
          const { countryId, stateId, cityId } = parseRegionId(savedRegion);
          setSelectedCountry(countryId);
          setSelectedState(stateId);
          setSelectedCity(cityId);
        } else {
          const { countryId, stateId, cityId } = parseRegionId(DEFAULT_REGION);
          setSelectedCountry(countryId);
          setSelectedState(stateId);
          setSelectedCity(cityId);
        }
      } catch (error) {
        console.error('Error loading location settings:', error);
      }
    })();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────

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
  };

  const selectState = (stateId: string) => {
    if (stateId === selectedState) return;

    setSelectedState(stateId);

    const stateCities = getCitiesForState(selectedCountry, stateId);
    const firstCity = stateCities.length > 0 ? stateCities[0].id : '';
    setSelectedCity(firstCity);
  };

  const selectCity = (cityId: string) => {
    if (cityId === selectedCity) return;
    setSelectedCity(cityId);
  };

  const updateRegionId = async () => {
    try {
      // Validate that all location components are selected
      if (!selectedCountry || !selectedState || !selectedCity) {
        Alert.alert(t('incompleteSelection'), t('incompleteSelectionMessage'), [{ text: t('ok') }]);
        return;
      }

      const newRegionId = `${selectedCountry}-${selectedState}-${selectedCity}`;

      if (newRegionId === regionId) {
        Alert.alert(t('noChange'), t('noChangeMessage'), [{ text: t('ok') }]);
        return;
      }

      setRegionId(newRegionId);
      await AsyncStorage.setItem('selected_region', newRegionId);

      // Cancel ALL existing notifications so they can be rescheduled for the new location
      await notifee.cancelAllNotifications();
      // Clear the scheduling flag so notifications will be rescheduled for the new region
      await AsyncStorage.removeItem('last_notification_scheduled');
      // Clear scheduler metadata to prevent stale-city race with in-flight scheduling
      await AsyncStorage.multiRemove([
        'prayer_sched_last_day',
        'prayer_sched_tz_offset',
        'prayer_sched_version',
        'prayer_sched_sound_pref',
      ]);
      console.log('Cancelled all scheduled notifications during region change');

      // Update FCM country topic subscription in case the country changed
      updateCountryTopic().catch(err =>
        console.log('⚠️ Could not update country topic after region change:', err),
      );

      // Clear any existing cached prayer data
      const cachedKeys = await AsyncStorage.getAllKeys();
      const prayerTimeKeys = cachedKeys.filter(
        (key: string) =>
          key.startsWith('prayer_') ||
          key.startsWith('last_updated_') ||
          key === 'cached_prayer_data' ||
          key === 'last_refresh_date',
      );
      if (prayerTimeKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerTimeKeys);
        console.log('Cleared any existing cached data during location change');
      }

      Alert.alert(
        t('locationUpdated'),
        t('locationUpdatedMessage'),
        [
          {
            text: t('ok'),
            onPress: () => navigateHome(),
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      console.error('Error updating region:', error);
      Alert.alert(t('error'), t('failedUpdateLocation'), [{ text: t('ok') }]);
    }
  };

  // ── Public API ───────────────────────────────────────────────────────
  return {
    regionId,
    selectedCountry,
    selectedState,
    selectedCity,
    countries,
    states,
    cities,
    selectCountry,
    selectState,
    selectCity,
    updateRegionId,
  };
}
