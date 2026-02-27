import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MagicalButton } from './MagicalButton';

interface LocationItem {
  id: string;
  name: string;
}

interface LocationSectionProps {
  colors: any;
  countries: LocationItem[];
  states: LocationItem[];
  cities: LocationItem[];
  selectedCountry: string;
  selectedState: string;
  selectedCity: string;
  selectCountry: (id: string) => void;
  selectState: (id: string) => void;
  selectCity: (id: string) => void;
  updateRegionId: () => void;
  styles: any;
  t: (key: string) => string;
}

/**
 * Location settings section — cascading Country → State → City pickers with
 * expandable option lists and an "Update Location" confirm button.
 *
 * The expand/collapse state is managed locally since it only affects this
 * section's UI.
 */
export const LocationSection: React.FC<LocationSectionProps> = ({
  colors: C,
  countries,
  states,
  cities,
  selectedCountry,
  selectedState,
  selectedCity,
  selectCountry,
  selectState,
  selectCity,
  updateRegionId,
  styles,
  t,
}) => {
  const [expandedSection, setExpandedSection] = useState('');
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  return (
    <View style={styles.enhancedSection}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="map-marker" size={20} color={C.accent.gold} />
        <Text style={styles.enhancedSectionTitle}>{t('locationSettings')}</Text>
      </View>
      <Text style={styles.enhancedSectionDescription}>{t('selectLocation')}</Text>

      {/* Country Selection */}
      <MagicalButton
        style={styles.enhancedLocationSelector}
        onPress={() => toggleSection('country')}
        glowColor={C.accent.amber}
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
              color={C.accent.gold}
            />
          </View>
        </View>
      </MagicalButton>

      {expandedSection === 'country' && (
        <View style={styles.enhancedOptionsContainer}>
          {countries.map(country => (
            <MagicalButton
              key={country.id}
              style={[
                styles.enhancedOptionItem,
                selectedCountry === country.id && styles.selectedEnhancedOptionItem,
              ]}
              onPress={() => selectCountry(country.id)}
              glowColor={selectedCountry === country.id ? C.accent.amber : C.accent.gold}
            >
              <Text style={[
                styles.enhancedOptionName,
                selectedCountry === country.id && styles.selectedEnhancedOptionName,
              ]}>
                {country.name}
              </Text>
              {selectedCountry === country.id && (
                <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
              )}
            </MagicalButton>
          ))}
        </View>
      )}

      {/* State Selection */}
      <MagicalButton
        style={[styles.enhancedLocationSelector, { marginTop: 16 }]}
        onPress={() => toggleSection('state')}
        glowColor={C.accent.amber}
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
              color={C.accent.gold}
            />
          </View>
        </View>
      </MagicalButton>

      {expandedSection === 'state' && (
        <View style={styles.enhancedOptionsContainer}>
          {states.map(state => (
            <MagicalButton
              key={state.id}
              style={[
                styles.enhancedOptionItem,
                selectedState === state.id && styles.selectedEnhancedOptionItem,
              ]}
              onPress={() => selectState(state.id)}
              glowColor={selectedState === state.id ? C.accent.amber : C.accent.gold}
            >
              <Text style={[
                styles.enhancedOptionName,
                selectedState === state.id && styles.selectedEnhancedOptionName,
              ]}>
                {state.name}
              </Text>
              {selectedState === state.id && (
                <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
              )}
            </MagicalButton>
          ))}
        </View>
      )}

      {/* City Selection */}
      <MagicalButton
        style={[styles.enhancedLocationSelector, { marginTop: 16 }]}
        onPress={() => toggleSection('city')}
        glowColor={C.accent.amber}
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
              color={C.accent.gold}
            />
          </View>
        </View>
      </MagicalButton>

      {expandedSection === 'city' && (
        <View style={styles.enhancedOptionsContainer}>
          {cities.map(city => (
            <MagicalButton
              key={city.id}
              style={[
                styles.enhancedOptionItem,
                selectedCity === city.id && styles.selectedEnhancedOptionItem,
              ]}
              onPress={() => selectCity(city.id)}
              glowColor={selectedCity === city.id ? C.accent.amber : C.accent.gold}
            >
              <Text style={[
                styles.enhancedOptionName,
                selectedCity === city.id && styles.selectedEnhancedOptionName,
              ]}>
                {city.name}
              </Text>
              {selectedCity === city.id && (
                <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
              )}
            </MagicalButton>
          ))}
        </View>
      )}

      {/* Location Summary */}
      <View style={styles.enhancedLocationSummary}>
        <MaterialCommunityIcons name="map-marker" size={20} color={C.accent.gold} />
        <Text style={styles.enhancedLocationSummaryText}>
          {cities.find(c => c.id === selectedCity)?.name || 'City'}, {' '}
          {states.find(s => s.id === selectedState)?.name || 'State'}, {' '}
          {countries.find(c => c.id === selectedCountry)?.name || 'Country'}
        </Text>
      </View>

      {/* Update Location Button */}
      <MagicalButton
        style={styles.enhancedUpdateLocationButton}
        onPress={updateRegionId}
        glowColor={C.accent.amber}
      >
        <MaterialCommunityIcons name="map-marker-check" size={18} color={C.text.inverse} />
        <Text style={styles.enhancedUpdateLocationButtonText}>{t('updateLocation')}</Text>
      </MagicalButton>
    </View>
  );
};
