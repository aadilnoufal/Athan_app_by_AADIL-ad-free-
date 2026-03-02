import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { goldTint } from '../utils/colorHelpers';
import { getRegionConfig, DEFAULT_REGION } from '../app/config/prayerTimeConfig';
import type { Country } from '../app/config/prayerTimeConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import { getAllTranslations } from '../translations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Feature data for slide 2 ──────────────────────────
interface FeatureItem {
  icon: string;
  labelKey: string;
  descKey: string;
}

const FEATURES: FeatureItem[] = [
  { icon: 'clock-outline', labelKey: 'prayerTimes', descKey: 'onboardingFeaturePrayer' },
  { icon: 'book-open-variant', labelKey: 'dua', descKey: 'onboardingFeatureDua' },
  { icon: 'book-open-page-variant', labelKey: 'quran', descKey: 'onboardingFeatureQuran' },
  { icon: 'compass-outline', labelKey: 'qibla', descKey: 'onboardingFeatureQibla' },
  { icon: 'cog-outline', labelKey: 'settings', descKey: 'onboardingFeatureSettings' },
];

// ── Props ─────────────────────────────────────────────
interface WelcomeSlidesProps {
  onComplete: () => void;
}

export default function WelcomeSlides({ onComplete }: WelcomeSlidesProps) {
  const { colors, isDark } = useTheme();
  const { t, changeLanguage, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const gt = (alpha: number) => goldTint(alpha, colors);

  // Track selected language for visual highlight (initialise from context)
  const [selectedLang, setSelectedLang] = useState<'en' | 'ar'>(language === 'ar' ? 'ar' : 'en');

  const handleLanguageSelect = useCallback((lang: 'en' | 'ar') => {
    setSelectedLang(lang);
    changeLanguage(lang);
  }, [changeLanguage]);

  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = 3;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;

  // Setup state (slide 3)
  const [enableNotifs, setEnableNotifs] = useState(true);
  const [batteryOptEnabled, setBatteryOptEnabled] = useState(false);
  const [batteryCheckDone, setBatteryCheckDone] = useState(false);

  // Detect battery optimization status on Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      notifee.isBatteryOptimizationEnabled()
        .then((enabled) => {
          setBatteryOptEnabled(enabled);
          setBatteryCheckDone(true);
        })
        .catch(() => setBatteryCheckDone(true));
    } else {
      setBatteryCheckDone(true);
    }
  }, []);

  const handleDisableBatteryOpt = useCallback(async () => {
    try {
      await notifee.openBatteryOptimizationSettings();
      // Re-check after returning
      const stillEnabled = await notifee.isBatteryOptimizationEnabled();
      setBatteryOptEnabled(stillEnabled);
    } catch (_) {
      // Non-critical
    }
  }, []);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animate features when page 2 becomes visible
  useEffect(() => {
    if (currentPage === 1) {
      const staggered = featureAnims.map((anim, i) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: i * 100,
          useNativeDriver: true,
        })
      );
      Animated.stagger(100, staggered).start();
    }
  }, [currentPage]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / SCREEN_WIDTH);
      if (page !== currentPage && page >= 0 && page < totalPages) {
        setCurrentPage(page);
      }
    },
    [currentPage],
  );

  const goToPage = useCallback(
    (page: number) => {
      scrollRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: true });
      setCurrentPage(page);
    },
    [],
  );

  const handleNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, goToPage]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleFinish = useCallback(async () => {
    // Save notification preference
    try {
      await AsyncStorage.setItem('notifications_enabled', enableNotifs ? 'true' : 'false');
    } catch (_) {
      // Non-critical
    }
    onComplete();
  }, [onComplete, enableNotifs]);

  // ── Styles ──────────────────────────────────────────
  const bg = colors.background.primary;
  const surfaceBg = colors.surface.primary;
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;
  const gold = colors.accent.gold;

  // ── Slide 1: Welcome ────────────────────────────────
  const renderWelcome = () => (
    <View style={[localStyles.slide, { width: SCREEN_WIDTH }]}>
      <Animated.View
        style={[
          localStyles.welcomeContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: iconScale }],
          },
        ]}
      >
        {/* Decorative glow circle */}
        <View style={[localStyles.glowCircle, { backgroundColor: gt(0.08) }]}>
          <View style={[localStyles.glowCircleInner, { backgroundColor: gt(0.12) }]}>
            <MaterialCommunityIcons name="mosque" size={72} color={gold} />
          </View>
        </View>

        <Text style={[localStyles.bismillah, { color: gold }]}>
          {t('onboardingWelcomeTitle')}
        </Text>

        <Text style={[localStyles.appName, { color: textPrimary }]}>
          {t('onboardingWelcomeSubtitle')}
        </Text>

        <Text style={[localStyles.desc, { color: textSecondary }]}>
          {t('onboardingWelcomeDesc')}
        </Text>

        {/* Language picker */}
        <View style={localStyles.langRow}>
          <TouchableOpacity
            onPress={() => handleLanguageSelect('en')}
            style={[
              localStyles.langBtn,
              {
                backgroundColor: selectedLang === 'en' ? gold : surfaceBg,
                borderColor: selectedLang === 'en' ? gold : gt(0.2),
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                localStyles.langBtnText,
                { color: selectedLang === 'en' ? colors.text.inverse : textPrimary },
              ]}
            >
              English
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleLanguageSelect('ar')}
            style={[
              localStyles.langBtn,
              {
                backgroundColor: selectedLang === 'ar' ? gold : surfaceBg,
                borderColor: selectedLang === 'ar' ? gold : gt(0.2),
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                localStyles.langBtnText,
                { color: selectedLang === 'ar' ? colors.text.inverse : textPrimary },
              ]}
            >
              العربية
            </Text>
          </TouchableOpacity>
        </View>

        {/* Decorative crescent */}
        <View style={localStyles.crescentRow}>
          <MaterialCommunityIcons
            name="moon-waning-crescent"
            size={20}
            color={gt(0.4)}
          />
          <View style={[localStyles.dividerLine, { backgroundColor: gt(0.2) }]} />
          <MaterialCommunityIcons name="star-four-points" size={14} color={gt(0.4)} />
          <View style={[localStyles.dividerLine, { backgroundColor: gt(0.2) }]} />
          <MaterialCommunityIcons
            name="moon-waxing-crescent"
            size={20}
            color={gt(0.4)}
          />
        </View>
      </Animated.View>
    </View>
  );

  // ── Slide 2: Features ───────────────────────────────
  const renderFeatures = () => (
    <View style={[localStyles.slide, { width: SCREEN_WIDTH }]}>
      <View style={localStyles.featuresContent}>
        <Text style={[localStyles.slideTitle, { color: textPrimary }]}>
          {t('onboardingFeaturesTitle')}
        </Text>
        <Text style={[localStyles.slideSubtitle, { color: textSecondary }]}>
          {t('onboardingFeaturesDesc')}
        </Text>

        <View style={localStyles.featureList}>
          {FEATURES.map((feature, index) => (
            <Animated.View
              key={feature.icon}
              style={[
                localStyles.featureRow,
                {
                  backgroundColor: surfaceBg,
                  borderColor: gt(0.15),
                  opacity: featureAnims[index],
                  transform: [
                    {
                      translateX: featureAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [40, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[localStyles.featureIcon, { backgroundColor: gt(0.1) }]}>
                <MaterialCommunityIcons
                  name={feature.icon as any}
                  size={26}
                  color={gold}
                />
              </View>
              <View style={localStyles.featureTextCol}>
                <Text style={[localStyles.featureLabel, { color: textPrimary }]}>
                  {t(feature.labelKey)}
                </Text>
                <Text style={[localStyles.featureDesc, { color: textSecondary }]}>
                  {t(feature.descKey)}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );

  // ── Slide 3: Quick Setup ────────────────────────────
  const renderSetup = () => (
    <View style={[localStyles.slide, { width: SCREEN_WIDTH }]}>
      <View style={localStyles.setupContent}>
        <View style={[localStyles.setupIconBg, { backgroundColor: gt(0.1) }]}>
          <MaterialCommunityIcons name="cog-outline" size={48} color={gold} />
        </View>

        <Text style={[localStyles.slideTitle, { color: textPrimary }]}>
          {t('onboardingSetupTitle')}
        </Text>
        <Text style={[localStyles.slideSubtitle, { color: textSecondary }]}>
          {t('onboardingSetupDesc')}
        </Text>

        {/* Notification toggle */}
        <View
          style={[
            localStyles.setupCard,
            { backgroundColor: surfaceBg, borderColor: gt(0.15) },
          ]}
        >
          <View style={localStyles.setupCardRow}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={gold} />
            <Text style={[localStyles.setupCardLabel, { color: textPrimary }]}>
              {t('onboardingSetupNotifications')}
            </Text>
            <Switch
              value={enableNotifs}
              onValueChange={setEnableNotifs}
              trackColor={{ false: gt(0.15), true: gt(0.4) }}
              thumbColor={enableNotifs ? gold : colors.text.tertiary}
            />
          </View>
        </View>

        {/* Battery optimization card (Android only) */}
        {Platform.OS === 'android' && batteryCheckDone && batteryOptEnabled && (
          <TouchableOpacity
            onPress={handleDisableBatteryOpt}
            style={[
              localStyles.setupCard,
              { backgroundColor: surfaceBg, borderColor: gt(0.25) },
            ]}
            activeOpacity={0.7}
          >
            <View style={localStyles.setupCardRow}>
              <MaterialCommunityIcons name="battery-alert-variant-outline" size={24} color={gold} />
              <View style={{ flex: 1 }}>
                <Text style={[localStyles.setupCardLabel, { color: textPrimary }]}>
                  {t('onboardingBatteryOptTitle')}
                </Text>
                <Text style={[localStyles.batteryHint, { color: textSecondary }]}>
                  {t('onboardingBatteryOptDesc')}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={gold} />
            </View>
          </TouchableOpacity>
        )}

        {/* Battery optimization disabled confirmation */}
        {Platform.OS === 'android' && batteryCheckDone && !batteryOptEnabled && (
          <View
            style={[
              localStyles.setupCard,
              { backgroundColor: surfaceBg, borderColor: gt(0.15) },
            ]}
          >
            <View style={localStyles.setupCardRow}>
              <MaterialCommunityIcons name="battery-check-outline" size={24} color={gold} />
              <Text style={[localStyles.setupCardLabel, { color: textPrimary }]}>
                {t('onboardingBatteryOptDone')}
              </Text>
              <MaterialCommunityIcons name="check-circle" size={20} color={gold} />
            </View>
          </View>
        )}

        {/* Hint text */}
        <Text style={[localStyles.setupHint, { color: textSecondary }]}>
          {t('tooltipSettingsLocation')}
        </Text>
      </View>
    </View>
  );

  // ── Page indicators ─────────────────────────────────
  const renderDots = () => (
    <View style={localStyles.dotsRow}>
      {Array.from({ length: totalPages }).map((_, i) => (
        <TouchableOpacity key={i} onPress={() => goToPage(i)} activeOpacity={0.7}>
          <View
            style={[
              localStyles.dot,
              {
                backgroundColor: i === currentPage ? gold : gt(0.2),
                width: i === currentPage ? 24 : 8,
              },
            ]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Footer buttons ──────────────────────────────────
  const renderFooter = () => (
    <View style={[localStyles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {renderDots()}

      <View style={localStyles.footerButtons}>
        {currentPage < totalPages - 1 ? (
          <>
            <TouchableOpacity onPress={handleSkip} style={localStyles.skipBtn}>
              <Text style={[localStyles.skipText, { color: textSecondary }]}>
                {t('onboardingSkip')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              style={[localStyles.nextBtn, { backgroundColor: gold }]}
              activeOpacity={0.8}
            >
              <Text style={[localStyles.nextText, { color: colors.text.inverse }]}>
                {t('onboardingNext')}
              </Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={18}
                color={colors.text.inverse}
              />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={handleFinish}
            style={[localStyles.beginBtn, { backgroundColor: gold }]}
            activeOpacity={0.8}
          >
            <Text style={[localStyles.beginText, { color: colors.text.inverse }]}>
              {t('onboardingLetsBegin')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[localStyles.container, { backgroundColor: bg }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {renderWelcome()}
        {renderFeatures()}
        {renderSetup()}
      </ScrollView>

      {renderFooter()}
    </View>
  );
}

// ── Static styles ─────────────────────────────────────
const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Slides
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Slide 1: Welcome
  welcomeContent: {
    alignItems: 'center',
    width: '100%',
  },
  glowCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  glowCircleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bismillah: {
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 8,
    textAlign: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  crescentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  langRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  langBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  langBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dividerLine: {
    width: 40,
    height: 1,
  },

  // Slide 2: Features
  featuresContent: {
    width: '100%',
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  slideSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 28,
  },
  featureList: {
    width: '100%',
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextCol: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Slide 3: Setup
  setupContent: {
    width: '100%',
    alignItems: 'center',
  },
  setupIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  setupCard: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
  },
  setupCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setupCardLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  batteryHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  setupHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    gap: 6,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600',
  },
  beginBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 28,
  },
  beginText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
