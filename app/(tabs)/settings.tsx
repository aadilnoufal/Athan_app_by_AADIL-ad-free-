import Slider from '@react-native-community/slider';
import { Modal } from 'react-native';
import RevenueCatPaywall from '../components/RevenueCatPaywall';
import { createSettingsStyles } from '../components/settings/settingsStyles';
import { MagicalButton } from '../components/settings/MagicalButton';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  Switch,
  ScrollView,
  Linking,
  Platform,
  Dimensions,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../../contexts/LanguageContext';
import { SepiaColors } from '../../constants/sepiaColors';
import { useTheme } from '../../contexts/ThemeContext';
import { goldTint, getTimeBasedGradientColors } from '../../utils/colorHelpers';
import { useSettingsQuranPrefs } from '../../hooks/settings/useSettingsQuranPrefs';
import { useSettingsLocation } from '../../hooks/settings/useSettingsLocation';
import { useSettingsDonation } from '../../hooks/settings/useSettingsDonation';
import { useSettingsNotifications } from '../../hooks/settings/useSettingsNotifications';
import { QuranFontFamily } from '../../utils/quranStorage';

// Define interfaces
interface LanguageItem {
  id: string;
  name: string;
  [key: string]: any;
}

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function SettingsScreen() {
  const router = useRouter();
  const { t, currentLang, changeLanguage, availableLanguages } = useLanguage();
  const { isDark, toggleTheme, colors } = useTheme();
  const C = colors; // alias
  // Theme-aware dynamic styles
  const styles = React.useMemo(() => createSettingsStyles(colors, isDark), [colors, isDark]);

  // Helper for inline styles - use theme's gold color instead of hardcoded rgba(218,165,32,...)
  const gt = (alpha: number) => goldTint(alpha, colors);

  // Animations removed

  // Notifications (all state, loading, and handlers via custom hook — DO NOT INLINE)
  const {
    notificationsEnabled,
    notificationSettings,
    useAzanSound,
    notificationStatus,
    toggleNotifications,
    togglePrayerNotification,
    toggleSoundPreference,
    testNotification,
    testDirectSound,
    testAzanSoundFix,
    testInAppNotification,
    checkNotificationStatus,
    resetNotifications,
  } = useSettingsNotifications();

  // Location (all state, loading, and handlers via custom hook)
  const {
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
  } = useSettingsLocation({ navigateHome: () => router.push('/') });

  // State for UI sections
  const [expandedSection, setExpandedSection] = useState('');

  // Quran settings (all state, effects, and handlers via custom hook)
  const {
    quranEditionPref,
    quranFontScale,
    quranAutoScrollWithAudio,
    quranTranslationEdition,
    quranReciter,
    translationEditions,
    audioEditions,
    showTranslationPicker,
    setShowTranslationPicker,
    showReciterPicker,
    setShowReciterPicker,
    editionSearchQuery,
    setEditionSearchQuery,
    audioFullDownloading,
    audioDownloadProgress,
    quranFontFamilyState,
    filteredTranslations,
    handleEditionPrefChange,
    handleDownloadAllAudio,
    handleClearAllQuranDownloads,
    handleFontScaleChange,
    handleFontScaleChangeComplete,
    handleQuranAutoScrollToggle,
    handleTranslationEditionChange,
    handleReciterChange,
    handleFontFamilyChange,
  } = useSettingsQuranPrefs(t);

  // Time-based gradient colors for dynamic backgrounds (light mode only)
  const getTimeBasedGradient = () => {
    const hour = new Date().getHours();
    // Use theme colors for consistent gradients
    const base = getTimeBasedGradientColors(C, isDark);

    if (hour >= 5 && hour < 7) { // Fajr time - ultra soft dawn
      return [C.background.primary, C.background.secondary, C.surface.secondary];
    } else if (hour >= 7 && hour < 12) { // Morning - ultra light warm
      return [C.background.primary, C.surface.elevated, C.background.tertiary];
    } else if (hour >= 12 && hour < 15) { // Midday - bright light sepia
      return [C.surface.elevated, C.background.secondary, C.surface.secondary];
    } else if (hour >= 15 && hour < 18) { // Afternoon - light golden sepia
      return [C.background.secondary, C.background.tertiary, C.surface.secondary];
    } else if (hour >= 18 && hour < 20) { // Maghrib - light sunset sepia
      return [C.background.tertiary, C.surface.secondary, C.background.tertiary];
    } else { // Night/Isha - slightly deeper but still light sepia
      return [C.surface.secondary, C.surface.secondary, C.background.tertiary];
    }
  };
  const gradientColors = isDark ? [C.background.primary, C.background.secondary, C.surface.primary] : getTimeBasedGradient();

  // ✨ MAGICAL HEADER COMPONENT ✨
  // Standard simple header (no glow/animations) for consistency with platform defaults
  const StandardHeader = () => (
    <View style={styles.standardHeaderWrapper}>
      <TouchableOpacity style={styles.standardBackButton} onPress={() => router.back()} activeOpacity={0.7}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={C.accent.gold} />
      </TouchableOpacity>
      <Text style={styles.standardHeaderTitle}>{t('settings')}</Text>
      {/* Right placeholder for symmetry */}
      <View style={{ width: 32 }} />
    </View>
  );

  // Toggle a section's expanded state
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  // Donation / paywall (all state and handlers via custom hook)
  const { showPaywall, setShowPaywall, iapLoading, openDonation } = useSettingsDonation(t);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {Platform.OS === 'android' ? (
        <View style={{
          height: StatusBar.currentHeight || 20,
          backgroundColor: C.background.primary
        }} />
      ) : (
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={C.background.primary}
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
        colors={gradientColors as any}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.container}>
        {/* ✨ ENHANCED MAGICAL HEADER SECTION ✨ */}
        <StandardHeader />

        <ScrollView
          style={styles.enhancedScrollView}
          contentContainerStyle={styles.enhancedScrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {showPaywall && (
            <Modal animationType="slide" transparent visible={showPaywall} onRequestClose={() => setShowPaywall(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' }}>
                <RevenueCatPaywall onClose={() => setShowPaywall(false)} />
              </View>
            </Modal>
          )}
          {/* Appearance / Theme Section */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="palette"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('appearance')}</Text>
            </View>
            <View style={styles.enhancedSettingContainer}>
              <Text style={styles.enhancedSettingLabel}>{t('darkMode')}</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                thumbColor={isDark ? C.accent.gold : C.surface.secondary}
              />
            </View>
          </View>
          {/* ✨ ENHANCED LANGUAGE SETTINGS SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="web"
                size={20}
                color={C.accent.gold}
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
                  glowColor={currentLang === typedLang.id ? C.accent.amber : C.accent.gold}
                >
                  <Text style={[
                    styles.enhancedLanguageName,
                    currentLang === typedLang.id && styles.selectedEnhancedLanguageName
                  ]}>
                    {typedLang.name}
                  </Text>
                  {currentLang === typedLang.id && (
                    <MaterialCommunityIcons name="check" size={20} color={C.accent.gold} />
                  )}
                </MagicalButton>
              );
            })}
          </View>

          {/* ✨ ENHANCED NOTIFICATION SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="bell-outline"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('notifications')}</Text>
            </View>

            <View style={styles.enhancedSettingContainer}>
              <Text style={styles.enhancedSettingLabel}>{t('enableNotifications')}</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                thumbColor={notificationsEnabled ? C.accent.gold : C.surface.secondary}
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={styles.enhancedPrayerNotificationSettings}>
                  <Text style={styles.enhancedSettingSubtitle}>{t('notifyMeFor')}:</Text>
                  {Object.keys(notificationSettings).map((prayer) => (
                    <View
                      key={prayer}
                      style={styles.enhancedPrayerNotificationItem}
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
                            color={C.accent.gold}
                          />
                        </View>
                        <Text style={styles.enhancedPrayerLabel}>{t(prayer)}</Text>
                      </View>
                      <Switch
                        value={notificationSettings[prayer]}
                        onValueChange={(value: boolean) => togglePrayerNotification(prayer, value)}
                        trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                        thumbColor={notificationSettings[prayer] ? C.accent.gold : C.surface.secondary}
                      />
                    </View>
                  ))}
                </View>

                {/* Enhanced Notification Sound Preference */}
                <View style={styles.enhancedSoundPreferenceContainer}>
                  <View style={styles.enhancedSoundPrefTextContainer}>
                    <Text style={styles.enhancedSettingLabel}>{t('useAzanSound')}</Text>
                    <Text style={styles.enhancedSettingDescription}>
                      {t('beepExplanation')}
                    </Text>
                  </View>
                  <Switch
                    value={useAzanSound}
                    onValueChange={toggleSoundPreference}
                    trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                    thumbColor={useAzanSound ? C.accent.gold : C.surface.secondary}
                  />
                </View>

                {/* Enhanced Test Notification Buttons */}
                <View style={styles.enhancedTestButtonsContainer}>
                  <MagicalButton
                    style={styles.enhancedTestButton}
                    onPress={testNotification}
                    glowColor={C.accent.amber}
                  >
                    <MaterialCommunityIcons name="bell-ring" size={18} color={C.text.inverse} />
                    <Text style={styles.enhancedTestButtonText}>{t('testNotification')}</Text>
                  </MagicalButton>

                  {/* Enhanced Notification Status Button */}
                  <MagicalButton
                    style={[styles.enhancedTestButton, { marginTop: 10, backgroundColor: C.accent.copper }]}
                    onPress={checkNotificationStatus}
                    glowColor={C.accent.copper}
                  >
                    <MaterialCommunityIcons name="information-outline" size={18} color={C.text.inverse} />
                    <Text style={styles.enhancedTestButtonText}>{t('status')}</Text>
                  </MagicalButton>
                </View>
              </>
            )}
          </View>

          {/* ✨ ENHANCED LOCATION SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="map-marker"
                size={20}
                color={C.accent.gold}
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
                      selectedCountry === country.id && styles.selectedEnhancedOptionItem
                    ]}
                    onPress={() => selectCountry(country.id)}
                    glowColor={selectedCountry === country.id ? C.accent.amber : C.accent.gold}
                  >
                    <Text style={[
                      styles.enhancedOptionName,
                      selectedCountry === country.id && styles.selectedEnhancedOptionName
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

            {/* Enhanced State Selection */}
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
                      selectedState === state.id && styles.selectedEnhancedOptionItem
                    ]}
                    onPress={() => selectState(state.id)}
                    glowColor={selectedState === state.id ? C.accent.amber : C.accent.gold}
                  >
                    <Text style={[
                      styles.enhancedOptionName,
                      selectedState === state.id && styles.selectedEnhancedOptionName
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

            {/* Enhanced City Selection */}
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
                      selectedCity === city.id && styles.selectedEnhancedOptionItem
                    ]}
                    onPress={() => selectCity(city.id)}
                    glowColor={selectedCity === city.id ? C.accent.amber : C.accent.gold}
                  >
                    <Text style={[
                      styles.enhancedOptionName,
                      selectedCity === city.id && styles.selectedEnhancedOptionName
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

            {/* Enhanced Location Summary */}
            <View style={styles.enhancedLocationSummary}>
              <MaterialCommunityIcons name="map-marker" size={20} color={C.accent.gold} />
              <Text style={styles.enhancedLocationSummaryText}>
                {cities.find(c => c.id === selectedCity)?.name || 'City'}, {' '}
                {states.find(s => s.id === selectedState)?.name || 'State'}, {' '}
                {countries.find(c => c.id === selectedCountry)?.name || 'Country'}
              </Text>
            </View>

            {/* Enhanced Update Location Button */}
            <MagicalButton
              style={styles.enhancedUpdateLocationButton}
              onPress={updateRegionId}
              glowColor={C.accent.amber}
            >
              <MaterialCommunityIcons name="map-marker-check" size={18} color={C.text.inverse} />
              <Text style={styles.enhancedUpdateLocationButtonText}>{t('updateLocation')}</Text>
            </MagicalButton>
          </View>

          {/* ✨ QURAN SETTINGS SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('quranSettings')}</Text>
            </View>

            {/* Default edition preference */}
            <Text style={styles.enhancedSettingSubtitle}>{t('defaultEdition')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <MagicalButton
                onPress={() => handleEditionPrefChange('arabic')}
                style={[
                  styles.enhancedLanguageOption,
                  { flex: 1 },
                  quranEditionPref === 'arabic' && styles.selectedEnhancedLanguageOption,
                ]}
                glowColor={quranEditionPref === 'arabic' ? C.accent.amber : C.accent.gold}
              >
                <Text style={[
                  styles.enhancedLanguageName,
                  { fontSize: 13 },
                  quranEditionPref === 'arabic' && styles.selectedEnhancedLanguageName,
                ]}>
                  {t('arabicOnly')}
                </Text>
                {quranEditionPref === 'arabic' && (
                  <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
                )}
              </MagicalButton>
              <MagicalButton
                onPress={() => handleEditionPrefChange('both')}
                style={[
                  styles.enhancedLanguageOption,
                  { flex: 1 },
                  quranEditionPref === 'both' && styles.selectedEnhancedLanguageOption,
                ]}
                glowColor={quranEditionPref === 'both' ? C.accent.amber : C.accent.gold}
              >
                <Text style={[
                  styles.enhancedLanguageName,
                  { fontSize: 13 },
                  quranEditionPref === 'both' && styles.selectedEnhancedLanguageName,
                ]}>
                  {t('arabicAndTranslation')}
                </Text>
                {quranEditionPref === 'both' && (
                  <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
                )}
              </MagicalButton>
            </View>

            {/* Font size control */}
            <Text style={styles.enhancedSettingSubtitle}>{t('quranFontSize')}</Text>
            <View style={{ marginBottom: 14 }}>
              {/* Slider with min/max labels */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: C.text.tertiary, fontSize: 12 }}>A</Text>
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Slider
                    minimumValue={0.75}
                    maximumValue={1.5}
                    step={0.05}
                    value={quranFontScale}
                    onValueChange={handleFontScaleChange}
                    onSlidingComplete={handleFontScaleChangeComplete}
                    minimumTrackTintColor={C.accent.gold}
                    maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}
                    thumbTintColor={C.accent.gold}
                  />
                </View>
                <Text style={{ color: C.text.tertiary, fontSize: 18, fontWeight: '700' }}>A</Text>
              </View>
              <Text style={{ color: C.accent.gold, fontWeight: '700', textAlign: 'center', fontSize: 14, marginBottom: 10 }}>
                {Math.round(quranFontScale * 100)}%
              </Text>

              {/* Live Arabic preview */}
              <View style={{
                borderRadius: 12,
                padding: 14,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderWidth: 0.5,
                borderColor: `${C.accent.gold}30`,
              }}>
                <Text style={{
                  color: C.text.primary,
                  fontSize: Math.round(24 * quranFontScale),
                  lineHeight: Math.round(42 * quranFontScale),
                  textAlign: 'right',
                  marginBottom: 8,
                }}>
                  {t('quranFontPreview')}
                </Text>
                <Text style={{
                  color: C.text.secondary,
                  fontSize: Math.round(16 * quranFontScale),
                  lineHeight: Math.round(26 * quranFontScale),
                }}>
                  {t('quranFontPreviewEn')}
                </Text>
              </View>
            </View>

            {/* Auto-scroll with audio */}
            <View style={[styles.enhancedSettingContainer, { marginBottom: 14 }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.enhancedSettingLabel}>{t('quranAutoScrollWithAudio')}</Text>
                <Text style={styles.enhancedSettingDescription}>{t('quranAutoScrollWithAudioDescription')}</Text>
              </View>
              <Switch
                value={quranAutoScrollWithAudio}
                onValueChange={handleQuranAutoScrollToggle}
                trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                thumbColor={quranAutoScrollWithAudio ? C.accent.gold : C.surface.secondary}
              />
            </View>

            {/* Quran Arabic font family */}
            <Text style={styles.enhancedSettingSubtitle}>{t('quranFontFamily')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {([
                { key: 'default' as QuranFontFamily, label: t('fontDefault') },
                { key: 'Amiri' as QuranFontFamily, label: t('fontAmiri') },
                { key: 'ScheherazadeNew' as QuranFontFamily, label: t('fontScheherazade') },
              ]).map(({ key, label }) => (
                <MagicalButton
                  key={key}
                  onPress={() => handleFontFamilyChange(key)}
                  style={[
                    styles.enhancedLanguageOption,
                    { flex: 1, minWidth: 90 },
                    quranFontFamilyState === key && styles.selectedEnhancedLanguageOption,
                  ]}
                  glowColor={quranFontFamilyState === key ? C.accent.amber : C.accent.gold}
                >
                  <Text style={[
                    styles.enhancedLanguageName,
                    { fontSize: 12 },
                    quranFontFamilyState === key && styles.selectedEnhancedLanguageName,
                  ]}>
                    {label}
                  </Text>
                  {quranFontFamilyState === key && (
                    <MaterialCommunityIcons name="check" size={16} color={C.accent.gold} />
                  )}
                </MagicalButton>
              ))}
            </View>

            {/* Translation edition picker */}
            <Text style={styles.enhancedSettingSubtitle}>{t('translationEdition')}</Text>
            <TouchableOpacity
              onPress={() => setShowTranslationPicker(true)}
              style={[styles.enhancedSettingContainer, { marginBottom: 14, borderWidth: 0.5, borderColor: gt(0.2), borderRadius: 10, paddingVertical: 10 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.enhancedSettingLabel, { fontWeight: '600' }]}>{t('currentTranslation')}</Text>
                <Text style={[styles.enhancedSettingDescription, { marginTop: 2 }]}>
                  {translationEditions.find(e => e.identifier === quranTranslationEdition)?.name ?? quranTranslationEdition}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.text.tertiary} />
            </TouchableOpacity>

            {/* Reciter picker */}
            <Text style={styles.enhancedSettingSubtitle}>{t('reciter')}</Text>
            <TouchableOpacity
              onPress={() => setShowReciterPicker(true)}
              style={[styles.enhancedSettingContainer, { marginBottom: 14, borderWidth: 0.5, borderColor: gt(0.2), borderRadius: 10, paddingVertical: 10 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.enhancedSettingLabel, { fontWeight: '600' }]}>{t('selectReciter')}</Text>
                <Text style={[styles.enhancedSettingDescription, { marginTop: 2 }]}>
                  {audioEditions.find(e => e.identifier === quranReciter)?.name ?? quranReciter}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.text.tertiary} />
            </TouchableOpacity>

            {/* Quran text is bundled offline — info note */}
            <View style={[styles.enhancedSettingContainer, { marginBottom: 8 }]}>
              <MaterialCommunityIcons name="check-circle" size={18} color={C.accent.gold} style={{ marginRight: 8 }} />
              <Text style={[styles.enhancedSettingDescription, { flex: 1 }]}>
                {t('quranBundledOffline') ?? 'Full Quran text (Arabic + English) is bundled offline — no download needed.'}
              </Text>
            </View>

            {/* Download all audio button */}
            <View style={[styles.enhancedTestButtonsContainer, { marginTop: 8 }]}>
              {audioFullDownloading && audioDownloadProgress ? (
                <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                  <ActivityIndicator size="small" color={C.accent.gold} />
                  <Text style={[styles.enhancedSettingDescription, { marginTop: 8, textAlign: 'center' }]}>
                    {t('downloadProgress')
                      .replace('{downloaded}', String(audioDownloadProgress.done))
                      .replace('{total}', String(audioDownloadProgress.total))}
                  </Text>
                </View>
              ) : (
                <MagicalButton
                  style={styles.enhancedTestButton}
                  onPress={handleDownloadAllAudio}
                  disabled={audioFullDownloading}
                  glowColor={C.accent.amber}
                >
                  <MaterialCommunityIcons name="music-box-multiple" size={18} color={C.text.inverse} />
                  <Text style={styles.enhancedTestButtonText}>{t('downloadAllAudio')}</Text>
                </MagicalButton>
              )}
            </View>

            {/* Clear cached data button (audio / extra translations) */}
            <View style={[styles.enhancedTestButtonsContainer, { marginTop: 8 }]}>
              <MagicalButton
                style={[styles.enhancedTestButton, { backgroundColor: C.accent.copper || '#B87333' }]}
                onPress={handleClearAllQuranDownloads}
                glowColor={C.accent.copper || '#B87333'}
              >
                <MaterialCommunityIcons name="delete-outline" size={18} color={C.text.inverse} />
                <Text style={styles.enhancedTestButtonText}>{t('deleteAllDownloads')}</Text>
              </MagicalButton>
            </View>
          </View>

          {/* ✨ ENHANCED ABOUT SECTION ✨ */}
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                color={C.accent.gold}
              />
              <Text style={styles.enhancedSectionTitle}>{t('about')}</Text>
            </View>
            <View style={styles.enhancedAboutContainer}>
              <Text style={styles.enhancedAppVersion}>{t('appVersion')}</Text>
              <Text style={styles.enhancedAboutText}>
                {t('aboutText')}
              </Text>
              <View style={styles.enhancedSupportButtonsContainer}>
                <MagicalButton
                  style={styles.enhancedSupportButton}
                  onPress={openDonation}
                  glowColor={C.accent.amber}
                >
                  <MaterialCommunityIcons name="gift" size={18} color={C.text.inverse} />
                  <Text style={styles.enhancedSupportButtonText}>{t('supportDeveloper')}</Text>
                </MagicalButton>

                {/* RevenueCat management (production-safe) for iOS and Android */}
                {(Platform.OS === 'ios' || Platform.OS === 'android') && (
                  <View style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
                    <Text style={{ color: C.text.secondary, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
                      RevenueCat Status: Ready
                    </Text>
                    <TouchableOpacity
                      style={[styles.enhancedTestButton, { backgroundColor: '#333' }]}
                      onPress={() => Linking.openURL(
                        Platform.OS === 'ios'
                          ? 'https://apps.apple.com/account/subscriptions'
                          : 'https://play.google.com/store/account/subscriptions'
                      )}
                      disabled={iapLoading}
                    >
                      <Text style={styles.enhancedTestButtonText}>{t('manageSubscriptions')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Footer Padding */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* ── Translation Edition Picker Modal ───────────────────── */}
      <Modal visible={showTranslationPicker} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 30 }}>
            {/* Modal header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: gt(0.15) }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text.primary }}>{t('selectTranslation')}</Text>
              <TouchableOpacity onPress={() => { setShowTranslationPicker(false); setEditionSearchQuery(''); }}>
                <MaterialCommunityIcons name="close" size={22} color={C.text.tertiary} />
              </TouchableOpacity>
            </View>
            {/* Search input */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderWidth: 0.5, borderColor: gt(0.15) }}>
              <MaterialCommunityIcons name="magnify" size={18} color={C.text.tertiary} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: 14, color: C.text.primary, paddingVertical: 0 }}
                placeholder={t('searchTranslations')}
                placeholderTextColor={C.text.tertiary}
                value={editionSearchQuery}
                onChangeText={setEditionSearchQuery}
                autoCorrect={false}
              />
            </View>
            {/* Edition list */}
            <FlatList
              data={filteredTranslations}
              keyExtractor={(item) => item.identifier}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleTranslationEditionChange(item.identifier)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: gt(0.08) }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text.primary }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: C.text.secondary, marginTop: 2 }}>{item.language} · {item.identifier}</Text>
                  </View>
                  {quranTranslationEdition === item.identifier && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={C.accent.gold} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <Text style={{ color: C.text.secondary, fontSize: 14 }}>{t('noTranslationsFound')}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ── Reciter Picker Modal ───────────────────────────────── */}
      <Modal visible={showReciterPicker} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 30 }}>
            {/* Modal header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: gt(0.15) }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text.primary }}>{t('selectReciter')}</Text>
              <TouchableOpacity onPress={() => setShowReciterPicker(false)}>
                <MaterialCommunityIcons name="close" size={22} color={C.text.tertiary} />
              </TouchableOpacity>
            </View>
            {/* Reciter list */}
            <FlatList
              data={audioEditions}
              keyExtractor={(item) => item.identifier}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleReciterChange(item.identifier)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: gt(0.08) }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text.primary }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: C.text.secondary, marginTop: 2 }}>{item.englishName}</Text>
                  </View>
                  {quranReciter === item.identifier && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={C.accent.gold} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <ActivityIndicator size="small" color={C.accent.gold} />
                  <Text style={{ color: C.text.secondary, fontSize: 14, marginTop: 8 }}>{t('loading')}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
