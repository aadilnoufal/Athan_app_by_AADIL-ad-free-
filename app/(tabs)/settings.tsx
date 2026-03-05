import { Modal } from 'react-native';
import RevenueCatPaywall from '../components/RevenueCatPaywall';
import { createSettingsStyles } from '../components/settings/settingsStyles';
import {
  AppearanceSection,
  LanguageSection,
  NotificationSection,
  LocationSection,
  QuranSettingsSection,
  WidgetSection,
  AboutSection,
  TranslationPickerModal,
  ReciterPickerModal,
} from '../components/settings';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getTimeBasedGradientColors } from '../../utils/colorHelpers';
import { useSettingsQuranPrefs } from '../../hooks/settings/useSettingsQuranPrefs';
import { useSettingsLocation } from '../../hooks/settings/useSettingsLocation';
import { useSettingsDonation } from '../../hooks/settings/useSettingsDonation';
import { useSettingsNotifications } from '../../hooks/settings/useSettingsNotifications';
import { useOnboarding } from '../../contexts/OnboardingContext';
import OnboardingTooltips, { SETTINGS_TOOLTIPS } from '../../components/OnboardingTooltips';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, currentLang, changeLanguage, availableLanguages } = useLanguage();
  const { isDark, toggleTheme, colors } = useTheme();
  const C = colors;
  const styles = React.useMemo(() => createSettingsStyles(colors, isDark), [colors, isDark]);

  // Onboarding tooltips
  const { shouldShowTooltip, completeTooltip } = useOnboarding();
  const [showSettingsTooltips, setShowSettingsTooltips] = useState(false);
  const settingsScrollRef = useRef<ScrollView>(null);
  // Y-positions of sections: [Location, Notification, QuranSettings]
  const sectionYPositions = useRef<number[]>([0, 0, 0]);

  useEffect(() => {
    if (shouldShowTooltip('settings')) {
      const timer = setTimeout(() => setShowSettingsTooltips(true), 600);
      return () => clearTimeout(timer);
    }
  }, [shouldShowTooltip]);

  /**
   * Before each settings tooltip is shown, scroll to the corresponding section.
   * Index 0 → Location, Index 1 → Notification, Index 2 → Quran Settings.
   */
  const handleSettingsBeforeShow = useCallback(async (index: number) => {
    const y = sectionYPositions.current[index] || 0;
    settingsScrollRef.current?.scrollTo({ y, animated: true });
    // Give the scroll animation time to settle
    await new Promise<void>(resolve => setTimeout(resolve, 400));
  }, []);


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
    iqamaNotificationsEnabled,
    iqamaNotificationSettings,
    iqamaMinutesBefore,
    toggleIqamaNotifications,
    toggleIqamaPrayerNotification,
    setIqamaMinutes,
    iqamaCountdownEnabled,
    toggleIqamaCountdown,
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
          ref={settingsScrollRef}
          style={styles.enhancedScrollView}
          contentContainerStyle={styles.enhancedScrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {showPaywall && (
            <Modal animationType="fade" transparent visible={showPaywall} onRequestClose={() => setShowPaywall(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <RevenueCatPaywall onClose={() => setShowPaywall(false)} />
              </View>
            </Modal>
          )}

          <AppearanceSection
            colors={C}
            isDark={isDark}
            toggleTheme={toggleTheme}
            styles={styles}
            t={t}
          />

          <LanguageSection
            colors={C}
            availableLanguages={availableLanguages}
            currentLang={currentLang}
            changeLanguage={changeLanguage}
            styles={styles}
            t={t}
          />

          <View onLayout={(e) => { sectionYPositions.current[1] = e.nativeEvent.layout.y; }}>
          <NotificationSection
            colors={C}
            notificationsEnabled={notificationsEnabled}
            notificationSettings={notificationSettings}
            useAzanSound={useAzanSound}
            toggleNotifications={toggleNotifications}
            togglePrayerNotification={togglePrayerNotification}
            toggleSoundPreference={toggleSoundPreference}
            testNotification={testNotification}
            checkNotificationStatus={checkNotificationStatus}
            iqamaNotificationsEnabled={iqamaNotificationsEnabled}
            iqamaNotificationSettings={iqamaNotificationSettings}
            iqamaMinutesBefore={iqamaMinutesBefore}
            toggleIqamaNotifications={toggleIqamaNotifications}
            toggleIqamaPrayerNotification={toggleIqamaPrayerNotification}
            setIqamaMinutes={setIqamaMinutes}
            iqamaCountdownEnabled={iqamaCountdownEnabled}
            toggleIqamaCountdown={toggleIqamaCountdown}
            styles={styles}
            t={t}
          />
          </View>

          <View onLayout={(e) => { sectionYPositions.current[0] = e.nativeEvent.layout.y; }}>
          <LocationSection
            colors={C}
            countries={countries}
            states={states}
            cities={cities}
            selectedCountry={selectedCountry}
            selectedState={selectedState}
            selectedCity={selectedCity}
            selectCountry={selectCountry}
            selectState={selectState}
            selectCity={selectCity}
            updateRegionId={updateRegionId}
            styles={styles}
            t={t}
          />
          </View>

          <View onLayout={(e) => { sectionYPositions.current[2] = e.nativeEvent.layout.y; }}>
          <QuranSettingsSection
            colors={C}
            isDark={isDark}
            quranEditionPref={quranEditionPref}
            quranFontScale={quranFontScale}
            quranAutoScrollWithAudio={quranAutoScrollWithAudio}
            quranFontFamilyState={quranFontFamilyState}
            quranTranslationEdition={quranTranslationEdition}
            quranReciter={quranReciter}
            translationEditions={translationEditions}
            audioEditions={audioEditions}
            audioFullDownloading={audioFullDownloading}
            audioDownloadProgress={audioDownloadProgress}
            setShowTranslationPicker={setShowTranslationPicker}
            setShowReciterPicker={setShowReciterPicker}
            handleEditionPrefChange={handleEditionPrefChange}
            handleDownloadAllAudio={handleDownloadAllAudio}
            handleClearAllQuranDownloads={handleClearAllQuranDownloads}
            handleFontScaleChange={handleFontScaleChange}
            handleFontScaleChangeComplete={handleFontScaleChangeComplete}
            handleQuranAutoScrollToggle={handleQuranAutoScrollToggle}
            handleFontFamilyChange={handleFontFamilyChange}
            styles={styles}
            t={t}
          />
          </View>

          <WidgetSection
            colors={C}
            styles={styles}
            t={t}
          />

          <AboutSection
            colors={C}
            openDonation={openDonation}
            iapLoading={iapLoading}
            styles={styles}
            t={t}
          />

          {/* Footer Padding */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <TranslationPickerModal
        visible={showTranslationPicker}
        colors={C}
        isDark={isDark}
        t={t}
        editionSearchQuery={editionSearchQuery}
        setEditionSearchQuery={setEditionSearchQuery}
        filteredTranslations={filteredTranslations}
        quranTranslationEdition={quranTranslationEdition}
        handleTranslationEditionChange={handleTranslationEditionChange}
        onClose={() => setShowTranslationPicker(false)}
      />

      <ReciterPickerModal
        visible={showReciterPicker}
        colors={C}
        t={t}
        audioEditions={audioEditions}
        quranReciter={quranReciter}
        handleReciterChange={handleReciterChange}
        onClose={() => setShowReciterPicker(false)}
      />

      {/* Onboarding tooltips overlay */}
      {showSettingsTooltips && (
        <OnboardingTooltips
          tooltips={SETTINGS_TOOLTIPS}
          onBeforeShow={handleSettingsBeforeShow}
          onComplete={() => {
            setShowSettingsTooltips(false);
            completeTooltip('settings');
          }}
        />
      )}
    </SafeAreaView>
  );
}
