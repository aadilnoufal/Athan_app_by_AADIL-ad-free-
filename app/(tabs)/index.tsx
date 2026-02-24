import React, { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  Easing,
  Modal,
  FlatList,
  AppState,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Note: Using Expo's vector icons
import { format, addDays, differenceInSeconds } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { getAvailableRegions, getRegionConfig, DEFAULT_REGION } from '../config/prayerTimeConfig';
import Constants from 'expo-constants';
import { useLanguage } from '../../contexts/LanguageContext';
// Import prayer time utilities
import { applyLocalDataCityAdjustments, extractCityIdFromRegionId } from '../../utils/prayerTimeTuner';
import { getPrayerTimesFromLocalData } from '../../utils/localPrayerData';
import { SepiaColors } from '../../constants/sepiaColors';
import { useTheme } from '../../contexts/ThemeContext';
import RevenueCatPaywall from '../components/RevenueCatPaywall';
import { usePurchase } from '../contexts/RevenueCatContext';

// Get screen dimensions for magical effects
const { width: screenWidth } = Dimensions.get('window');

// Import time utilities for improved timezone and countdown handling
import {
  findNextPrayer,
  isSamePrayerTime
} from '../../utils/timeUtils';
// Import Notifee prayer notification services (enterprise-grade reliability)
import {
  initializeNotifeePrayerNotifications,
  cancelAllNotificationsCompletely,
  getScheduledNotifeePrayerNotifications,
  getNotifeeServiceStatus,
} from '../../utils/notifeePrayerService';
import { ensurePrayerNotificationWindow, forceRescheduleAllNotifications } from '../../utils/prayerNotificationScheduler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeAppStateSync } from '../../hooks/useHomeAppStateSync';
// Import background task utilities
import {
  setupBackgroundTask,
  unregisterBackgroundTask,
  getBackgroundFetchStatus
} from '../../utils/backgroundTask';

// Define interfaces for prayer data
interface PrayerData {
  date: string;
  hijriDate: string;
  hijriMonth: string;
  gregorianDate: string;
  times: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
  };
  times12h: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
  };
}

interface NextPrayer {
  name: string;
  time: string;      // This is already in 12h format from findNextPrayer
  timeRaw: string;   // Raw 24h format time
  date: Date;
}

// Define interfaces for region items
interface RegionItem {
  id: string;
  name: string;
  [key: string]: any;
}

// Define type for notification settings
interface NotificationSettings {
  Fajr: boolean;
  Sunrise: boolean;
  Dhuhr: boolean;
  Asr: boolean;
  Maghrib: boolean;
  Isha: boolean;
  [key: string]: boolean; // Add index signature for string keys
}

// Animated prayer icon component (now supports subtle mode for countdown center)
const AnimatedPrayerIcon = ({ prayer, active, size = 24, color, subtle = false }: { prayer: string; active: boolean; size?: number; color: string; subtle?: boolean }) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const rotate = React.useRef(new Animated.Value(0)).current;
  const isSolar = prayer === 'Sunrise' || prayer === 'Dhuhr' || prayer === 'Asr';

  React.useEffect(() => {
    scale.stopAnimation();
    rotate.stopAnimation();

    // Subtle mode: keep icon still (outer container may already have breathing animation)
    if (subtle) {
      scale.setValue(1);
      rotate.setValue(0);
      return;
    }

    // Reduced pulse magnitude overall
    const from = 1;
    const to = active ? 1.10 : 1.04;
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: to, duration: active ? 1400 : 2000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(scale, { toValue: from, duration: active ? 1400 : 2000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) })
      ])
    ).start();

    // Further slow rotation
    if (isSolar) {
      Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: active ? 16000 : 22000, useNativeDriver: true, easing: Easing.linear })
      ).start();
    } else if (prayer === 'Isha' || prayer === 'Maghrib') {
      Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: active ? 24000 : 32000, useNativeDriver: true, easing: Easing.linear })
      ).start();
    } else {
      rotate.setValue(0);
    }
  }, [prayer, active, isSolar, subtle]);

  const rotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const iconName = (
    prayer === 'Fajr' ? 'weather-sunset-up' :
      prayer === 'Sunrise' ? 'white-balance-sunny' :
        prayer === 'Dhuhr' ? 'sun-wireless' :
          prayer === 'Asr' ? 'weather-sunny' :
            prayer === 'Maghrib' ? 'weather-sunset-down' :
              'weather-night'
  );

  const transforms: any[] = subtle ? [] : [{ scale }];
  if (!subtle && isSolar) transforms.push({ rotate: rotation });

  return (
    <Animated.View style={{ transform: transforms }}>
      <MaterialCommunityIcons name={iconName as any} size={size} color={color} />
    </Animated.View>
  );
};

export default function Home() {
  // Theme integration (phase 1)
  const { colors, isDark } = useTheme();
  // Shorthand alias used during gradual migration from static SepiaColors styles
  const C = colors;
  // Dynamic themed styles (migrated from static StyleSheet at file end) so dark mode uses proper contrast
  const styles = React.useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background.primary,
    },
    container: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 0,
      // Reduced bottom padding now that tab bar height adapts; prevents stretched feel
      paddingBottom: 70,
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: C.text.primary,
      flex: 1,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 0,
      flexShrink: 0,
      zIndex: 10,
      elevation: 3,
    },
    refreshButton: {
      backgroundColor: `${C.surface.secondary}CC`,
      padding: 6,
      borderRadius: 20,
      marginRight: 6,
      borderWidth: 1,
      borderColor: C.border.light,
    },
    rotating: { transform: [{ rotate: '45deg' }] },
    donateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.accent.gold,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      minWidth: 140,
    },
    donateText: {
      color: C.text.inverse,
      marginLeft: 8,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    locationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      backgroundColor: `${C.surface.secondary}AA`,
      borderBottomWidth: 1,
      borderBottomColor: `${C.border.light}80`,
    },
    locationText: {
      color: C.text.primary,
      marginLeft: 8,
      fontSize: 16,
      fontWeight: '500',
      letterSpacing: 0.5,
      textTransform: 'capitalize',
    },
    dateNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: `${C.surface.elevated}88`,
      borderBottomWidth: 1,
      borderBottomColor: `${C.border.light}60`,
    },
    navButton: {
      padding: 4,
      borderRadius: 20,
      backgroundColor: C.surface.secondary,
      borderWidth: 1,
      borderColor: C.border.light,
    },
    dateText: {
      color: C.text.primary,
      fontSize: 16,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.background.primary,
    },
    loadingText: {
      color: C.text.secondary,
      marginTop: 16,
      fontSize: 16,
      letterSpacing: 0.5,
    },
    scrollView: { flex: 1, width: '100%' },
    scrollViewContent: { paddingHorizontal: 8, paddingBottom: 120 },
    dateContainer: {
      marginVertical: 6,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: `${C.surface.primary}DD`,
    },
    dateInnerContainer: {
      padding: 8,
      alignItems: 'center',
      backgroundColor: `${C.surface.elevated}BB`,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${C.border.accent}60`,
    },
    gregorianDate: {
      color: C.text.primary,
      fontSize: 16,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    hijriDate: {
      color: C.text.secondary,
      fontSize: 12,
      marginTop: 4,
      fontWeight: '400',
      letterSpacing: 0.5,
    },
    countdownContainer: {
      padding: 12,
      alignItems: 'center',
      backgroundColor: C.surface.primary,
      margin: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border.medium,
    },
    nextPrayerText: {
      color: C.text.primary,
      fontSize: 16,
      textAlign: 'center',
      letterSpacing: 0.5,
      fontWeight: '500',
    },
    nextPrayerTime: {
      color: C.accent.gold,
      fontSize: 26,
      fontWeight: 'bold',
      marginVertical: 6,
      textAlign: 'center',
      letterSpacing: 1,
    },
    countdownText: {
      color: C.text.primary,
      fontSize: 42,
      fontWeight: '300',
      letterSpacing: 2,
      textAlign: 'center',
    },
    timesContainer: { paddingHorizontal: 4, paddingVertical: 10 },
    prayerItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: `${C.surface.primary}CC`,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${C.border.light}80`,
    },
    nextPrayerItem: {
      backgroundColor: `${C.special.highlight}EE`,
      borderWidth: 0.5,
      borderColor: C.accent.gold,
    },
    prayerNameContainer: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.surface.secondary,
      borderWidth: 1,
      borderColor: C.border.medium,
    },
    prayerName: {
      color: C.text.primary,
      fontSize: 16,
      marginLeft: 12,
      fontWeight: '500',
      letterSpacing: 0.5,
    },
    prayerTime: {
      color: C.accent.gold,
      fontSize: 16,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    circularCountdownContainer: {
      alignItems: 'center',
      backgroundColor: C.surface.transparent,
      borderWidth: 1,
      borderColor: C.border.light,
    },
    progressCenter: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'center', padding: 10,
    },
    footer: {
      marginTop: 24, marginBottom: 16, alignItems: 'center', paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: C.border.light,
    },
    modalOverlay: {
      flex: 1, backgroundColor: `${C.text.primary}70`, justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    modalContent: {
      width: '90%', backgroundColor: C.surface.elevated, borderRadius: 16, borderWidth: 1,
      borderColor: C.border.medium, overflow: 'hidden', maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 16, borderBottomWidth: 1, borderBottomColor: C.border.light,
    },
    modalTitle: { color: C.text.primary, fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
    regionItem: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 16, borderBottomWidth: 1, borderBottomColor: C.border.light,
    },
    selectedRegionItem: { backgroundColor: C.special.highlight },
    regionName: { color: C.text.primary, fontSize: 18, letterSpacing: 0.5 },
    selectedRegionName: { color: C.accent.gold, fontWeight: 'bold' },
    dropdownIcon: { marginLeft: 'auto', marginRight: 10 },
    settingsButton: {
      backgroundColor: C.surface.secondary, padding: 10, borderRadius: 20, marginRight: 10,
      borderWidth: 0.5, borderColor: C.border.light,
    },
    countdownLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    countdownLoadingText: { color: C.text.secondary, fontSize: 16, marginLeft: 6, opacity: 0.8 },
    languageButton: {
      backgroundColor: C.surface.secondary, padding: 8, borderRadius: 20, marginRight: 4,
      borderWidth: 0.5, borderColor: C.border.light, alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
    },
    languageItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16,
      borderBottomWidth: 1, borderBottomColor: C.border.light,
    },
    selectedLanguageItem: { backgroundColor: C.special.highlight },
    languageName: { color: C.text.primary, fontSize: 18, letterSpacing: 0.5 },
    selectedLanguageName: { color: C.accent.gold, fontWeight: 'bold' },
    contentContainer: { flex: 1, width: '100%', backgroundColor: 'transparent' },
    progressIndicatorText: {
      color: C.accent.gold, fontSize: 12, marginTop: 4, fontWeight: '500', letterSpacing: 0.5, opacity: 0.8,
    },
    sparkle: { position: 'absolute', zIndex: 1 },
    magicalHeader: {
      position: 'relative', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 0, borderRadius: 20,
      backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent',
      // REMOVED: overflow: 'hidden' - this was blocking touch events on Android
    },
    headerGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.accent.gold, borderRadius: 20 },
    headerStar: { position: 'absolute', zIndex: 2 },
    magicalFooter: {
      position: 'relative', paddingVertical: 15, paddingHorizontal: 20, marginTop: 20, marginBottom: 10, borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 0.5, borderColor: isDark ? 'rgba(218,165,32,0.1)' : 'rgba(218,165,32,0.2)', overflow: 'hidden',
    },
    footerShimmer: { position: 'absolute', top: 0, bottom: 0, width: 100, backgroundColor: 'transparent' },
    footerElement: { position: 'absolute', zIndex: 2 },
    footerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 3, position: 'relative' },
    footerMoon: { marginRight: 10 },
    footerText: { color: C.text.secondary, fontSize: 14, fontWeight: '500', letterSpacing: 0.5, textAlign: 'center', flex: 1 },
    footerStar: { marginLeft: 10 },
    enhancedCircularContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 20, position: 'relative' },
    circularGlow: { position: 'absolute', backgroundColor: C.accent.gold, opacity: 0.05 },
    circularProgress: { position: 'relative', zIndex: 2 },
    circularContent: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
    nextPrayerLabel: { color: C.text.tertiary, fontSize: 12, marginBottom: 4, fontWeight: '500', letterSpacing: 1, textTransform: 'uppercase' },
    nextPrayerName: { color: C.text.primary, fontSize: 20, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.5 },
    countdown: { color: C.accent.gold, fontSize: 18, fontWeight: '600', marginTop: 8, letterSpacing: 0.5, textAlign: 'center', minHeight: 22 },
    activeIconContainer: { backgroundColor: C.special.highlight },
    activePrayerName: { color: C.accent.darkGold, fontWeight: 'bold' },
    activePrayerTime: { color: C.accent.amber, fontWeight: 'bold', fontSize: 18 },
    buttonShimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,220,140,0.15)', borderRadius: 8 },
    headerSection: { marginBottom: 8 },
    enhancedLocationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : C.surface.secondary,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 18,
      marginTop: 0,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(218,165,32,0.2)' : C.border.light,
    },
    locationIconWrapper: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(218,165,32,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    locationTextWrapper: { flex: 1 },
    locationLabel: { color: C.text.tertiary, fontSize: 12, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
    locationActionWrapper: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    dateNavigationSection: { marginBottom: 8 },
    enhancedDateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // Dark mode previously used a faint white overlay which appeared like the old light sepia.
      // Use themed surface color instead for a solid dark surface.
      backgroundColor: isDark ? C.surface.primary : C.surface.primary,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(218,165,32,0.15)' : C.border.light,
    },
    dateDisplayContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    primaryDateText: { color: C.text.primary, fontSize: 18, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
    secondaryDateText: { color: C.text.secondary, fontSize: 13, fontWeight: '500', letterSpacing: 0.3, textAlign: 'center', marginTop: 2, opacity: 0.8 },
    hijriDateText: { color: C.accent.amber, fontSize: 11, fontWeight: '400', letterSpacing: 0.2, textAlign: 'center', marginTop: 1, opacity: 0.9 },
    enhancedContentContainer: { flex: 1, backgroundColor: 'transparent' },
    enhancedLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    loadingIconWrapper: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 30, padding: 20, marginBottom: 20,
      borderWidth: 0.5, borderColor: 'rgba(218,165,32,0.2)',
    },
    enhancedLoadingText: { color: C.text.primary, fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8, letterSpacing: 0.3 },
    loadingSubtext: { color: C.text.secondary, fontSize: 14, textAlign: 'center', opacity: 0.7, letterSpacing: 0.2 },
    enhancedScrollView: { flex: 1 },
    enhancedScrollViewContent: { paddingBottom: 40 },
    enhancedDateContainer: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 16, marginBottom: 12, borderWidth: 0.5,
      borderColor: 'rgba(218,165,32,0.15)', overflow: 'hidden',
    },
    dateCardContent: { padding: 12 },
    gregorianDateSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    enhancedGregorianDate: { color: C.text.primary, fontSize: 14, fontWeight: '600', marginLeft: 8, letterSpacing: 0.3 },
    hijriDateSection: { flexDirection: 'row', alignItems: 'center' },
    enhancedHijriDate: { color: C.text.secondary, fontSize: 12, fontWeight: '500', marginLeft: 8, letterSpacing: 0.2, opacity: 0.9 },
    countdownSection: { alignItems: 'center', marginBottom: 15 },
    enhancedTimesContainer: {
      // Use proper themed elevated surface in dark mode instead of translucent white.
      backgroundColor: isDark ? C.surface.elevated : C.surface.primary,
      borderRadius: 20,
      padding: 12,
      marginBottom: 12,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(218,165,32,0.15)' : C.border.light,
    },
    timesHeader: {
      flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(218,165,32,0.15)',
    },
    timesHeaderText: { color: C.text.primary, fontSize: 18, fontWeight: '700', marginLeft: 10, letterSpacing: 0.5 },
    prayerTimesGrid: { gap: 8 },
    enhancedPrayerItem: {
      // Solid surface color for dark mode to avoid light sepia bleed-through.
      backgroundColor: isDark ? C.surface.primary : C.surface.secondary,
      borderRadius: 16,
      padding: 10,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(218,165,32,0.1)' : C.border.light,
      position: 'relative',
      overflow: 'hidden',
    },
    enhancedNextPrayerItem: {
      backgroundColor: isDark ? 'rgba(218,165,32,0.06)' : `${C.special.highlight}CC`,
      borderColor: isDark ? 'rgba(218,165,32,0.25)' : C.border.accent,
    },
    prayerItemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    enhancedIconContainer: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(218,165,32,0.08)', alignItems: 'center', justifyContent: 'center',
      marginRight: 12, borderWidth: 0.5, borderColor: 'rgba(218,165,32,0.15)'
    },
    activeEnhancedIconContainer: { backgroundColor: 'rgba(218,165,32,0.15)', borderColor: 'rgba(218,165,32,0.3)' },
    enhancedPrayerName: { color: C.text.primary, fontSize: 16, fontWeight: '600', letterSpacing: 0.3, flex: 1 },
    activeEnhancedPrayerName: { color: C.accent.darkGold, fontWeight: '700' },
    prayerTimeWrapper: { alignItems: 'flex-end' },
    enhancedPrayerTime: { color: C.text.primary, fontSize: 18, fontWeight: '600', letterSpacing: 0.5, textAlign: 'right' },
    activeEnhancedPrayerTime: { color: C.accent.amber, fontWeight: '700', fontSize: 20 },
    nextIndicator: {
      flexDirection: 'row', alignItems: 'center', marginTop: 2, backgroundColor: 'rgba(218,165,32,0.12)',
      paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10,
    },
    nextIndicatorText: { color: C.accent.darkGold, fontSize: 10, fontWeight: '600', marginLeft: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
    returnToTodayButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 6, paddingHorizontal: 14, marginTop: 6,
      borderRadius: 16, backgroundColor: 'rgba(218,165,32,0.10)',
      alignSelf: 'center',
    },
    returnToTodayText: {
      color: SepiaColors.accent.gold, fontSize: 12, fontWeight: '600', marginLeft: 5, letterSpacing: 0.3,
    },
    iqamaFooterContainer: {
      flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, marginBottom: 4,
      paddingHorizontal: 4, gap: 5,
    },
    iqamaFooterText: {
      color: C.text.secondary, fontSize: 11, fontWeight: '400', opacity: 0.65, flex: 1, lineHeight: 15,
    },
    // Compact header additions
    compactHeaderWrapper: {
      marginBottom: 8,
      paddingHorizontal: 4,
      gap: 6,
    },
    compactHeaderTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    compactLocationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : C.surface.secondary,
      borderRadius: 14,
      gap: 6,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(218,165,32,0.2)' : C.border.light,
      minWidth: 120,
      maxWidth: '55%',
    },
    compactLocationText: {
      flex: 1,
      color: C.text.primary,
      fontSize: 13,
      fontWeight: '500',
    },
    compactDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : C.surface.primary,
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 0.5,
      borderColor: isDark ? 'rgba(218,165,32,0.15)' : C.border.light,
      gap: 8,
    },
    compactDateCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
  }), [C, isDark]);
  const router = useRouter();
  const { t } = useLanguage();

  // Add isFirstLoad state to track first launch
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Core state
  const [prayerTimes, setPrayerTimes] = useState<PrayerData | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState(0);
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null);
  // Enhanced countdown with ratio-based calculation
  const [countdown, setCountdown] = useState('');
  const [countdownLoading, setCountdownLoading] = useState(true);
  const [lastPrayerTime, setLastPrayerTime] = useState<Date | null>(null);

  // Location and region settings
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [location, setLocation] = useState('');
  const [method, setMethod] = useState(0);
  const [tuningParams, setTuningParams] = useState('');
  const availableRegions = getAvailableRegions();

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [regionChanging, setRegionChanging] = useState(false);

  // Progress tracking
  const [progressAnimation] = useState(new Animated.Value(0));
  const [progressPercent, setProgressPercent] = useState(0);

  // Date management
  const [lastRefreshDate, setLastRefreshDate] = useState('');
  const [lastDateCheckTime, setLastDateCheckTime] = useState(0);

  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    Fajr: true,
    Sunrise: false,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true
  });

  // Modal management
  const modalLock = useRef(false);
  const toggleModal = (setter: Dispatch<SetStateAction<boolean>>): void => {
    if (modalLock.current) return;
    modalLock.current = true;
    setter(prev => !prev);
    setTimeout(() => {
      modalLock.current = false;
    }, 600);
  };

  // Enhanced notification setup and management

  useHomeAppStateSync({
    currentDay,
    currentDate,
    setCurrentDate,
    setCurrentDay,
    setLastRefreshDate,
    setAppState,
  });

  // ✨ MAGICAL ANIMATIONS & VISUAL ENHANCEMENTS ✨
  const [glowAnimation] = useState(new Animated.Value(0));
  const [breathingAnimation] = useState(new Animated.Value(1));
  const [shimmerAnimation] = useState(new Animated.Value(0));
  const [headerGlowAnimation] = useState(new Animated.Value(0));
  const [footerStarAnimation] = useState(new Animated.Value(0));
  const [moonPhaseAnimation] = useState(new Animated.Value(0));
  const [footerBreathingAnimation] = useState(new Animated.Value(1)); // Separate for footer opacity

  // ✨ MAGICAL BUTTON ANIMATIONS ✨
  const [arrowBounceAnimation] = useState(new Animated.Value(0)); // For translateX (non-native)
  const [refreshSpinAnimation] = useState(new Animated.Value(0));

  // Separate shimmer animations that require layout properties (non-native driver)
  const [footerShimmerAnimation] = useState(new Animated.Value(0));
  const [buttonShimmerAnimation] = useState(new Animated.Value(0));

  // Time-based gradient colors for dynamic backgrounds
  const getTimeBasedGradient = () => {
    const hour = new Date().getHours();
    // Provide a simplified darker gradient palette when in dark mode for better contrast
    if (isDark) {
      // Subtle variation using current theme colors (no hard-coded dark hexes here)
      return [
        C.background.primary,
        C.background.secondary,
        C.surface.primary
      ];
    }
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
      return [C.surface.secondary, C.background.tertiary, C.surface.secondary];
    }
  };

  // ✨ MAGICAL HEADER COMPONENT ✨
  const MagicalHeader = () => (
    // Ensure container doesn't eat touches on Android
    <View
      style={[styles.magicalHeader]}
      pointerEvents="box-none"
    >
      {/* Header background glow */}
      <Animated.View
        style={[
          styles.headerGlow,
          {
            opacity: headerGlowAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 0.5]
            })
          }
        ]}
        pointerEvents="none"
      />

      {/* Header content */}
      <View style={styles.header}>
        <Animated.Text
          style={[
            styles.headerTitle,
            {
              transform: [{ scale: breathingAnimation }]
            }
          ]}
        >
          {t('appName')}
        </Animated.Text>
        <View style={styles.headerButtons}>
          <MagicalButton
            onPress={handleRefreshPress}
            disabled={refreshing}
            style={styles.refreshButton}
          >
            <Animated.View
              style={[
                {
                  transform: [{
                    rotate: refreshing ? refreshSpinAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg']
                    }) : '0deg'
                  }]
                }
              ]}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={20}
                color={C.accent.gold}
              />
            </Animated.View>
          </MagicalButton>

          <MagicalButton
            onPress={openDonation}
            style={styles.donateButton}
            glowColor={C.accent.amber}
          >
            <MaterialCommunityIcons name="gift" size={20} color={C.text.inverse} />
            <Text style={styles.donateText}>{t('supportApp')}</Text>
          </MagicalButton>

          {/* Language selector removed (moved to Settings screen) */}
        </View>
      </View>
    </View>
  );

  // ✨ MAGICAL FOOTER COMPONENT ✨
  const MagicalFooter = () => (
    <Animated.View style={[
      styles.magicalFooter,
      {
        opacity: footerBreathingAnimation.interpolate({
          inputRange: [1, 1.05],
          outputRange: [0.9, 1]
        })
      }
    ]}>
      {/* Footer background shimmer */}
      <Animated.View
        style={[
          styles.footerShimmer,
          {
            opacity: footerShimmerAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 0.3, 0.1]
            }),
            transform: [{
              translateX: footerShimmerAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [-100, screenWidth + 100]
              })
            }]
          }
        ]}
      />

      {/* Footer content */}
      <View style={styles.footerContent}>
        <Animated.View
          style={[
            styles.footerMoon,
            {
              transform: [
                {
                  scale: moonPhaseAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.1]
                  })
                },
                {
                  rotate: moonPhaseAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '15deg']
                  })
                }
              ]
            }
          ]}
        >
          <MaterialCommunityIcons
            name="moon-waning-crescent"
            size={24}
            color={C.accent.amber}
            style={{ opacity: 0.8 }}
          />
        </Animated.View>

        <Text style={styles.footerText}>
          ✨ {t('appName')} - {new Date().getFullYear()} ✨
        </Text>

        <Animated.View
          style={[
            styles.footerStar,
            {
              transform: [
                {
                  scale: footerStarAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2]
                  })
                },
                {
                  rotate: footerStarAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }
              ]
            }
          ]}
        >
          <MaterialCommunityIcons
            name="star-four-points"
            size={20}
            color={C.accent.gold}
            style={{ opacity: 0.7 }}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );

  // ✨ MAGICAL BUTTON COMPONENT ✨
  const MagicalButton = ({
    onPress,
    onLongPress,
    disabled = false,
    style,
    children,
    glowColor = C.accent.gold,
    pulseSize = 1.1
  }: {
    onPress?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    style?: any;
    children: React.ReactNode;
    glowColor?: string;
    pulseSize?: number;
  }) => (
    // Ultra-simplified version
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        {
          // Basic styling
          backgroundColor: 'rgba(255,255,255,0.1)',
          padding: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: 'rgba(218,165,32,0.3)',
        },
        // Re-enable passed styles now that we fixed the container issue
        style
      ]}
    >
      {/* Button shimmer effect */}
      <Animated.View
        style={[
          styles.buttonShimmer,
          {
            opacity: buttonShimmerAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, 0.2, 0]
            }),
            transform: [{
              translateX: buttonShimmerAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [-100, 200]
              })
            }]
          }
        ]}
        pointerEvents="none"
      />
      {children}
    </TouchableOpacity>
  );

  // ✨ MAGICAL ARROW BUTTON ✨
  const MagicalArrowButton = ({
    direction,
    onPress,
    disabled = false,
    iconName
  }: {
    direction: 'left' | 'right';
    onPress: () => void;
    disabled?: boolean;
    iconName: string;
  }) => (
    <MagicalButton
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.navButton,
        {
          opacity: disabled ? 0.4 : 1,
        }
      ]}
      glowColor={disabled ? SepiaColors.special.disabled : SepiaColors.accent.gold}
    // TODO: migrate remaining SepiaColors within styles at bottom to use theme
    >
      <Animated.View
        style={[
          {
            transform: [
              {
                translateX: arrowBounceAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: direction === 'left' ? [-2, 2] : [2, -2]
                })
              },
              { scale: breathingAnimation }
            ]
          }
        ]}
      >
        <MaterialCommunityIcons
          name={iconName as any}
          size={28}
          color={disabled ? SepiaColors.special.disabled : SepiaColors.accent.gold}
        />
      </Animated.View>
    </MagicalButton>
  );

  // Enhanced circular progress with magical effects
  const EnhancedCircularProgress = ({ progress, size, strokeWidth }: { progress: number, size: number, strokeWidth: number }) => (
    <View style={styles.enhancedCircularContainer}>
      {/* Magical background glow */}
      <Animated.View
        style={[
          styles.circularGlow,
          {
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            opacity: glowAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 0.2]
            }),
          }
        ]}
        pointerEvents="none"
      />

      {/* Main circular progress */}
      <Svg width={size} height={size} style={styles.circularProgress}>
        <Defs>
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={SepiaColors.accent.gold} />
            <Stop offset="50%" stopColor={SepiaColors.accent.amber} />
            <Stop offset="100%" stopColor={SepiaColors.accent.copper} />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={(size - strokeWidth) / 2}
          stroke={SepiaColors.border.light}
          strokeWidth={strokeWidth / 2}
          fill="none"
          opacity={0.3}
        />

        {/* Progress circle with gradient */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={(size - strokeWidth) / 2}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${2 * Math.PI * ((size - strokeWidth) / 2)}`}
          strokeDashoffset={`${2 * Math.PI * ((size - strokeWidth) / 2) * (1 - progress)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center content with breathing animation */}
      <Animated.View
        style={[
          styles.circularContent,
          {
            transform: [{ scale: breathingAnimation }]
          }
        ]}
      >
        {nextPrayer && (
          <>
            <AnimatedPrayerIcon
              key={nextPrayer.name}
              prayer={nextPrayer.name}
              active={true}
              size={32}
              color={SepiaColors.accent.gold}
              subtle
            />
            <Text style={styles.nextPrayerLabel}>{t('nextPrayer')}</Text>
            <Text style={styles.nextPrayerName}>{t(nextPrayer.name)}</Text>
            <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
            <Text style={styles.countdown}>{countdown}</Text>
          </>
        )}
      </Animated.View>
    </View>
  );
  const notificationInitialized = useRef(false);

  useEffect(() => {
    // Prevent multiple notification system initializations
    if (notificationInitialized.current) {
      return;
    }

    notificationInitialized.current = true;

    const initializeNotifications = async () => {
      try {
        // Initialize the Notifee notification service (enterprise-grade reliability)
        // This single call handles: notification permission -> exact alarm -> battery optimization
        console.log('🔧 Initializing Notifee prayer notification system...');
        const initialized = await initializeNotifeePrayerNotifications();

        if (!initialized) {
          console.warn('Failed to initialize Notifee notifications - continuing without notifications');
          return;
        }

        // Check and update notification settings
        await checkNotificationSettings();

        // Setup background task for notification management
        const backgroundSetup = await setupBackgroundTask();
        if (!backgroundSetup) {
          console.warn('Background task setup failed - notifications may not work when app is closed');
        }

        // Check background fetch status
        const bgStatus = await getBackgroundFetchStatus();
        console.log('Background fetch status:', bgStatus.statusText);
      } catch (error) {
        console.error('❌ Critical error in notification initialization:', error);
        // Don't crash the app - continue without notifications
      }
    };

    initializeNotifications().catch(err => {
      console.error('❌ Unhandled notification init error:', err);
    });

    const checkForSettingsChanges = async () => {
      try {
        const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
        const notifSettings = await AsyncStorage.getItem('notification_settings');

        if (notifEnabled !== null) {
          const isEnabled = notifEnabled === 'true';
          if (isEnabled !== notificationsEnabled) {
            setNotificationsEnabled(isEnabled);

            if (isEnabled && prayerTimes) {
              // If notifications were just enabled, clear timestamp and schedule them
              console.log('Notifications enabled, clearing timestamp and scheduling...');
              await AsyncStorage.removeItem('last_notification_scheduled');
              setTimeout(() => scheduleNotificationsForToday(), 1000);
            } else if (!isEnabled) {
              // If disabled, cancel all notifications comprehensively
              console.log('Notifications disabled, cancelling all...');
              await cancelAllNotificationsCompletely();
              await unregisterBackgroundTask();
            }
          }
        }

        if (notifSettings !== null) {
          const parsed = JSON.parse(notifSettings);
          setNotificationSettings(prev => ({ ...prev, ...parsed }));
        }

        // Check for force reschedule flag from background task
        const forceReschedule = await AsyncStorage.getItem('force_notification_reschedule');
        if (forceReschedule === 'true' && notificationsEnabled && prayerTimes) {
          console.log('Background task requested notification reschedule');
          await AsyncStorage.removeItem('force_notification_reschedule');
          await AsyncStorage.removeItem('last_notification_scheduled'); // Clear timestamp
          setTimeout(() => scheduleNotificationsForToday(), 500);
        }
      } catch (error) {
        console.error('Error checking notification settings:', error);
      }
    };

    const settingsInterval = setInterval(checkForSettingsChanges, 10000);

    const notificationListener = async () => {
      const updateFlag = await AsyncStorage.getItem('notifications_updated');

      if (updateFlag) {
        console.log('🔄 Notification settings changed, forcing full reschedule...');
        await AsyncStorage.removeItem('notifications_updated');
        await AsyncStorage.removeItem('last_notification_scheduled'); // Clear timestamp for fresh scheduling
        await checkNotificationSettings();

        // Force a complete reschedule instead of just topping up
        await forceRescheduleAllNotifications();
      }

      // Check notification health
      if (notificationsEnabled && prayerTimes) {
        const status = await getScheduledNotifeePrayerNotifications();

        // If we have no scheduled notifications but should have them, reschedule
        if (status.length === 0) {
          const now = new Date();
          const hasRemainingPrayers = Object.entries(prayerTimes.times).some(([prayer, timeStr]) => {
            if (!timeStr || timeStr === '--:--') return false;

            const [hours, minutes] = timeStr.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes)) return false;

            const prayerDate = new Date();
            prayerDate.setHours(hours, minutes, 0, 0);
            return prayerDate > now && notificationSettings[prayer as keyof NotificationSettings];
          });

          if (hasRemainingPrayers) {
            console.log('Health check: Missing notifications, forcing reschedule...');
            // Clear the timestamp to allow immediate rescheduling
            await AsyncStorage.removeItem('last_notification_scheduled');
            setTimeout(() => scheduleNotificationsForToday(), 1000);
          }
        } else {
          console.log(`Health check: ${status.length} notifications are properly scheduled`);
        }
      }
    };

    const flagsInterval = setInterval(() => {
      notificationListener();
    }, 60000); // Check every 60 seconds to reduce frequency

    return () => {
      clearInterval(settingsInterval);
      clearInterval(flagsInterval);
    };
  }, []); // Remove dependency array to prevent re-initialization

  // Enhanced notification settings check with permission verification
  const checkNotificationSettings = async () => {
    try {
      console.log('🔍 ===== CHECKING NOTIFICATION SETTINGS =====');
      // Check notification permissions using Notifee service status instead of scheduled count
      const serviceStatus = await getNotifeeServiceStatus();
      console.log('🔍 Notifee service status check:', serviceStatus);

      // Check if permissions are actually granted (not just if notifications are scheduled)
      const hasPermissions = serviceStatus && serviceStatus.permissionsGranted;

      if (!hasPermissions) {
        console.log('❌ Notification permissions not granted, disabling notifications');
        setNotificationsEnabled(false);
        await AsyncStorage.setItem('notifications_enabled', 'false');
        return;
      }

      console.log('✅ Notification permissions are granted, checking settings...');
      const notifEnabled = await AsyncStorage.getItem('notifications_enabled');
      const notifSettings = await AsyncStorage.getItem('notification_settings');

      if (notifEnabled !== null) {
        const isEnabled = notifEnabled === 'true';
        console.log(`📱 Notification enabled from storage: ${isEnabled}`);
        setNotificationsEnabled(isEnabled);
      } else {
        // Default to enabled if permission is granted but no setting exists
        console.log('📱 No notification setting found, defaulting to enabled');
        setNotificationsEnabled(true);
        await AsyncStorage.setItem('notifications_enabled', 'true');
      }

      if (notifSettings !== null) {
        setNotificationSettings(JSON.parse(notifSettings));
      } else {
        // Set default notification settings
        const defaultSettings = {
          Fajr: true,
          Sunrise: false,
          Dhuhr: true,
          Asr: true,
          Maghrib: true,
          Isha: true
        };
        setNotificationSettings(defaultSettings);
        await AsyncStorage.setItem('notification_settings', JSON.stringify(defaultSettings));
      }

      // Log notification status for debugging
      const debugStatus = await getScheduledNotifeePrayerNotifications();
      console.log(`Notifee notification settings loaded - Enabled: ${notifEnabled === 'true'}, Scheduled: ${debugStatus.length}`);

    } catch (error) {
      console.error('Error loading notification settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);

      // Only disable notifications if it's a permission-related error
      // Don't disable for background task or other unrelated errors
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        console.log('🚫 Disabling notifications due to permission error');
        setNotificationsEnabled(false);
      } else {
        console.log('⚠️ Non-critical error, keeping notifications enabled');
        // Still try to set default enabled state if permissions are available
        try {
          const notificationStatus = await getScheduledNotifeePrayerNotifications();
          // Assume permissions are granted if we can check scheduled notifications
          setNotificationsEnabled(true);
          await AsyncStorage.setItem('notifications_enabled', 'true');
        } catch (fallbackError) {
          console.error('Fallback permission check failed:', fallbackError);
          setNotificationsEnabled(false);
        }
      }
    }
  };

  // Add cooldown mechanism to prevent infinite scheduling loops
  const lastScheduleAttempt = useRef<number>(0);
  const SCHEDULE_COOLDOWN = 5000; // 5 seconds cooldown between scheduling attempts

  const scheduleNotificationsForToday = async () => {
    try {
      // Implement cooldown to prevent infinite loops
      const now = Date.now();
      if (now - lastScheduleAttempt.current < SCHEDULE_COOLDOWN) {
        console.log(`⏱️ Schedule cooldown active, skipping (${SCHEDULE_COOLDOWN / 1000}s cooldown)`);
        return;
      }
      lastScheduleAttempt.current = now;

      console.log(`🔄 ===== SCHEDULING NOTIFICATIONS FOR TODAY =====`);
      console.log(`🔄 notificationsEnabled: ${notificationsEnabled}`);
      console.log(`🔄 prayerTimes available: ${!!(prayerTimes && prayerTimes.times)}`);
      console.log(`🔄 notificationSettings:`, notificationSettings);

      // Respect user's choice - if notifications are disabled, don't schedule anything
      if (!notificationsEnabled) {
        console.log('⏭️ Notifications disabled by user, skipping scheduling');
        return;
      }

      // Use the new improved notification system
      if (!prayerTimes || !prayerTimes.times) {
        console.log('❌ No prayer data available for scheduling notifications');
        return;
      }

      console.log('✅ All conditions met, ensuring rolling prayer notification window...');
      await ensurePrayerNotificationWindow();
      console.log('✅ Rolling prayer notification window ensured');

    } catch (error) {
      console.error('❌ Error with new notification system:', error);
    }
  };

  // Note: Individual prayer scheduling functions have been moved to 
  // the improved notification service for better reliability

  // Region configuration management
  const regionLoadingRef = useRef(false);

  useEffect(() => {
    // Prevent multiple region config loads
    if (regionLoadingRef.current) {
      return;
    }

    regionLoadingRef.current = true;
    loadRegionConfig().finally(() => {
      setTimeout(() => {
        regionLoadingRef.current = false;
      }, 1000); // Allow reload after 1 second
    });
  }, []);

  // Reload region config when screen becomes focused (e.g., returning from settings)
  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused, checking for region changes...');

      const checkForRegionChanges = async () => {
        try {
          const savedRegion = await AsyncStorage.getItem('selected_region');
          const regionToUse = savedRegion || DEFAULT_REGION;

          // Only reload if the region actually changed
          if (regionToUse !== regionId) {
            console.log(`Region changed from ${regionId} to ${regionToUse}, reloading...`);
            await loadRegionConfig();
          } else {
            console.log('No region change detected, skipping reload');
            // If already have prayer times and no region change, don't set loading
            if (prayerTimes) {
              setLoading(false);
            }
          }
        } catch (error) {
          console.error('Error checking for region changes:', error);
          // Fallback to current behavior if there's an error
          await loadRegionConfig();
        }
      };

      checkForRegionChanges();

      // Safety mechanism: if we're still loading after 5 seconds and have prayer times, stop loading
      const loadingTimeout = setTimeout(() => {
        if (loading && prayerTimes) {
          console.log('Safety timeout: stopping loading state when returning to home');
          setLoading(false);
        }
      }, 5000);

      return () => {
        clearTimeout(loadingTimeout);
      };
    }, [regionId, prayerTimes, loading])
  );

  const loadRegionConfig = async (): Promise<void> => {
    try {
      const savedRegion = await AsyncStorage.getItem('selected_region');
      const regionToUse = savedRegion || DEFAULT_REGION;

      console.log(`Loading region config for: ${regionToUse}`);

      const config = getRegionConfig(regionToUse);

      if (config) {
        console.log(`Setting region to: ${config.id}, location: ${config.location}`);

        // Always apply config on first load to ensure data is displayed
        if (isFirstLoad) {
          console.log('First load detected, applying region config and fetching data...');
          setRegionId(config.id);
          setLocation(config.location);
          setMethod(config.method);
          setTuningParams(config.tuningParams);
          setIsFirstLoad(false);

          // Set loading state for first load
          setPrayerTimes(null);
          setLoading(true);

          // Trigger an immediate fetch after setting the config
          setTimeout(() => {
            console.log('Triggering first data fetch...');
            fetchPrayerTimes().catch(err => {
              console.error('First fetch error:', err);
              setLoading(false);
            });
          }, 500);

          return;
        }

        // Regular flow for subsequent loads
        const regionChanged = config.id !== regionId || config.location !== location;

        if (regionChanged) {
          console.log('Region configuration changed, updating...');
          setRegionId(config.id);
          setLocation(config.location);
          setMethod(config.method);
          setTuningParams(config.tuningParams);

          // Clear prayer times to force refetch with new region
          setPrayerTimes(null);
          setLoading(true);
        } else {
          console.log('Region configuration unchanged, keeping current data');
          // Don't set loading if region hasn't changed
        }
      } else {
        const defaultConfig = getRegionConfig(DEFAULT_REGION);
        if (defaultConfig) {
          console.log('No config found, using default region');
          const regionChanged = DEFAULT_REGION !== regionId || defaultConfig.location !== location || isFirstLoad;

          if (regionChanged) {
            setRegionId(DEFAULT_REGION);
            setLocation(defaultConfig.location);
            setMethod(defaultConfig.method);
            setTuningParams(defaultConfig.tuningParams);

            // Clear prayer times to force refetch
            setPrayerTimes(null);
            setLoading(true);
            setIsFirstLoad(false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading region config:', error);
      const defaultConfig = getRegionConfig(DEFAULT_REGION);
      if (defaultConfig && (defaultConfig.id !== regionId || isFirstLoad)) {
        console.log('Error occurred, loading default region config');
        setRegionId(DEFAULT_REGION);
        setLocation(defaultConfig.location);
        setMethod(defaultConfig.method);
        setTuningParams(defaultConfig.tuningParams);
        setPrayerTimes(null);
        setLoading(true);
        setIsFirstLoad(false);
      }
    }
  };

  // Date change detection (optimized)
  const checkDayChange = () => {
    const now = Date.now();
    if (now - lastDateCheckTime < 60000) {
      return;
    }

    setLastDateCheckTime(now);

    const today = format(new Date(), 'yyyy-MM-dd');

    if (lastRefreshDate !== today) {
      setLastRefreshDate(today);

      if (lastRefreshDate !== '') {
        console.log('Auto-refreshing at new day');
        clearCache(false);
      } else {
        AsyncStorage.setItem('last_refresh_date', today);
      }
    }
  };

  const clearCache = async (showAlerts = true) => {
    try {
      setRefreshing(true);

      // Clear all cached data
      const keys = await AsyncStorage.getAllKeys();
      const prayerKeys = keys.filter(key => key.startsWith('prayer_'));

      if (prayerKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerKeys);
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem('last_refresh_date', today);
      setLastRefreshDate(today);

      // Fetch fresh data (no cache)
      await fetchAndCachePrayerTimes();

      // Only reschedule notifications if they are enabled and we haven't scheduled recently
      if (notificationsEnabled) {
        const lastScheduled = await AsyncStorage.getItem('last_notification_scheduled');
        const now = Date.now();

        // Only reschedule if it's been more than 1 minute since last scheduling to prevent spam
        if (!lastScheduled || now - parseInt(lastScheduled) > 60000) {
          console.log('Refresh: Rescheduling notifications after cache clear');
          await scheduleNotificationsForToday();
        } else {
          console.log('Refresh: Skipping notification rescheduling - recently scheduled');
        }
      }

      if (showAlerts) {
        Alert.alert(
          t('cacheCleared'),
          'Fresh prayer times loaded',
          [{ text: t('ok') }]
        );
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      if (showAlerts) {
        Alert.alert(
          t('error'),
          t('failedCache'),
          [{ text: t('ok') }]
        );
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Initialize last refresh date on startup
  useEffect(() => {
    const getLastRefreshDate = async () => {
      try {
        const storedDate = await AsyncStorage.getItem('last_refresh_date');
        if (storedDate) {
          setLastRefreshDate(storedDate);
        }
        setLastDateCheckTime(Date.now());
      } catch (error) {
        console.error('Error getting last refresh date:', error);
      }
    };

    getLastRefreshDate();
  }, []);

  // Main effect for data fetching and timer management
  useEffect(() => {
    setProgressPercent(0);
    progressAnimation.setValue(0);

    if (location && method !== undefined && tuningParams !== undefined) {
      console.log(`Fetching prayer times for day +${currentDay}, location: ${location}`);

      // Using a more reliable way to fetch data with a retry mechanism for first load
      const fetchDataWithRetry = async () => {
        try {
          await fetchPrayerTimes();
        } catch (error) {
          console.error('Error in data fetch effect:', error);

          // If this is first load or we have no prayer times, try one more time after a delay
          if (!prayerTimes) {
            console.log('Retrying data fetch in 2 seconds...');
            setTimeout(() => {
              fetchPrayerTimes().catch(err => {
                console.error('Retry fetch error:', err);
                setLoading(false);
              });
            }, 2000);
          } else {
            setLoading(false);
          }
        }
      };

      fetchDataWithRetry();
    } else {
      // If we don't have location config yet, ensure we're not stuck loading
      setTimeout(() => {
        if (loading && (!location || method === undefined || tuningParams === undefined)) {
          console.log('Configuration incomplete, stopping loading state');

          // If we're still in first load but have no config, force default config
          if (isFirstLoad) {
            console.log('First load with incomplete config, forcing default config...');
            const defaultConfig = getRegionConfig(DEFAULT_REGION);
            if (defaultConfig) {
              setRegionId(DEFAULT_REGION);
              setLocation(defaultConfig.location);
              setMethod(defaultConfig.method);
              setTuningParams(defaultConfig.tuningParams);
              setIsFirstLoad(false);
              return; // This will trigger the effect again with proper config
            }
          }

          setLoading(false);
        }
      }, 3000);
    }

    const dateCheckTimer = setInterval(() => {
      checkDayChange();
    }, 60000);

    return () => {
      clearInterval(dateCheckTimer);
    };
  }, [currentDay, lastRefreshDate, location, method, tuningParams, isFirstLoad]);

  // Prayer times fetching - NO CACHE, ALWAYS FRESH
  const fetchPrayerTimes = async () => {
    try {
      setLoading(true);
      console.log('Always fetching fresh data - no cache used');

      // Add a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000); // 15 second timeout
      });

      // Check if this is first load and add extra logging
      if (isFirstLoad || !prayerTimes) {
        console.log('Fetching prayer times for first load or after no data...');
      }

      await Promise.race([fetchAndCachePrayerTimes(), timeoutPromise]);
    } catch (error) {
      console.error('Error fetching prayer times:', error);

      // If we have existing prayer times and this is just a refresh, keep the old data
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (prayerTimes && errorMessage !== 'Request timeout') {
        console.log('Keeping existing prayer times due to fetch error');
        setLoading(false);
        return;
      }

      // Create fallback data if this is first load or we have no prayer times
      if (isFirstLoad || !prayerTimes) {
        console.log('Error on first load, creating fallback data');
        const today = new Date();
        const fallbackTimes = {
          date: format(today, 'dd MMM yyyy'),
          hijriDate: 'Unknown',
          hijriMonth: 'Unknown',
          gregorianDate: format(today, 'dd-MM-yyyy'),
          times: {
            Fajr: '--:--',
            Sunrise: '--:--',
            Dhuhr: '--:--',
            Asr: '--:--',
            Maghrib: '--:--',
            Isha: '--:--'
          },
          times12h: {
            Fajr: '--:--',
            Sunrise: '--:--',
            Dhuhr: '--:--',
            Asr: '--:--',
            Maghrib: '--:--',
            Isha: '--:--'
          }
        };
        setPrayerTimes(fallbackTimes);
        setIsFirstLoad(false);
      }

      Alert.alert(
        t('connectionError'),
        t('connectionErrorMessage'),
        [{ text: t('ok') }]
      );
      setLoading(false);
    }
  };

  // Convert 24h to 12h format
  const convertTo12HourFormat = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Fetch prayer times - NO CACHING, ALWAYS FRESH
  const fetchAndCachePrayerTimes = async (retryCount = 0) => {
    try {
      const fetchDate = addDays(new Date(), currentDay);
      const formattedDate = format(fetchDate, 'dd-MM-yyyy');

      console.log(`Fetching FRESH prayer times for ${formattedDate}, location: ${location}`);

      // Always use local CSV data (year-agnostic)
      const localData = getPrayerTimesFromLocalData(fetchDate) as PrayerData | null;

      if (localData) {
        console.log(`Using local CSV prayer time data for ${formattedDate}`);

        const cityId = extractCityIdFromRegionId(regionId);
        console.log(`Applying local data adjustments for city: ${cityId}`);

        let timings = { ...localData.times } as any;
        timings = applyLocalDataCityAdjustments(timings, cityId, true);

        const formattedTimes: PrayerData = {
          date: localData.date,
          hijriDate: localData.hijriDate,
          hijriMonth: localData.hijriMonth,
          gregorianDate: localData.gregorianDate,
          times: timings,
          times12h: {
            Fajr: convertTo12HourFormat(timings.Fajr),
            Sunrise: convertTo12HourFormat(timings.Sunrise),
            Dhuhr: convertTo12HourFormat(timings.Dhuhr),
            Asr: convertTo12HourFormat(timings.Asr),
            Maghrib: convertTo12HourFormat(timings.Maghrib),
            Isha: convertTo12HourFormat(timings.Isha)
          }
        };

        // NO CACHING - Just set the data directly
        setPrayerTimes(formattedTimes);
        updateNextPrayer(formattedTimes);
        setLoading(false);

        if (currentDay === 0 && notificationsEnabled) {
          setTimeout(async () => {
            console.log('Clearing old notifications and scheduling fresh ones for updated prayer times');
            await AsyncStorage.removeItem('last_notification_scheduled');
            await scheduleNotificationsForToday();
          }, 1000);
        }
        return;
      } else {
        console.log(`No local CSV data available for ${formattedDate}`);
        Alert.alert(
          'Data Not Available',
          `Prayer time data for ${formattedDate} is not available in local database. This should not happen as we have year-round data.`,
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error fetching prayer times:', error);

      if (retryCount < 3) {
        console.log(`Retrying prayer time fetch (attempt ${retryCount + 1} of 3)...`);
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          fetchAndCachePrayerTimes(retryCount + 1);
        }, delay);
        return;
      }

      // Fallback for any day when all retries fail
      console.log('Creating fallback prayer times data after all retries failed');
      const today = addDays(new Date(), currentDay);
      const fallbackTimes = {
        date: format(today, 'dd MMM yyyy'),
        hijriDate: 'Unknown',
        hijriMonth: 'Unknown',
        gregorianDate: format(today, 'dd-MM-yyyy'),
        times: {
          Fajr: '--:--',
          Sunrise: '--:--',
          Dhuhr: '--:--',
          Asr: '--:--',
          Maghrib: '--:--',
          Isha: '--:--'
        },
        times12h: {
          Fajr: '--:--',
          Sunrise: '--:--',
          Dhuhr: '--:--',
          Asr: '--:--',
          Maghrib: '--:--',
          Isha: '--:--'
        }
      };

      // Always set fallback data to prevent blank screen
      setPrayerTimes(fallbackTimes);

      // If this was the first load, mark it as complete
      if (isFirstLoad) {
        setIsFirstLoad(false);
      }

      setLoading(false);
    }
  };

  // ✨ MAGICAL ANIMATIONS SETUP ✨
  useEffect(() => {
    // TEMPORARILY DISABLED - All magical animations commented out to fix driver conflicts
    console.log('🚫 Magical animations temporarily disabled to fix driver conflicts');
  }, []);

  // Prayer Time Monitoring System - AlarmManager + Notifee own notification triggering.

  // Simplified and improved next prayer calculation
  const updateNextPrayer = (data: PrayerData): void => {
    if (!data || !data.times) {
      console.log('⚠️ updateNextPrayer: No prayer data available');
      return;
    }

    console.log('🔄 Calculating next prayer time...');

    // Use the improved utility function
    const next = findNextPrayer(data.times, data.times12h, currentDay) as NextPrayer | null;

    if (next) {
      console.log(`📋 findNextPrayer returned: ${next.name} at ${next.time}`);
      console.log(`📋 Current nextPrayer: ${nextPrayer?.name || 'none'}`);

      // Only update if the prayer is actually different (prevents unnecessary re-renders)
      const isDifferent = !nextPrayer ||
        nextPrayer.name !== next.name ||
        !isSamePrayerTime(nextPrayer.date, next.date);

      console.log(`📋 isDifferent: ${isDifferent}`);

      if (isDifferent) {
        console.log(`🔄 Next prayer updated: ${next.name} at ${next.time}`);
        setNextPrayer(next);

        // Reset countdown when prayer changes to fix stuck countdown
        setCountdown('');
        setCountdownLoading(true);

        // Reset the countdown trigger ref when prayer successfully changes
        countdownTriggeredRefresh.current = '';

        console.log(`🔄 Prayer changed from ${nextPrayer?.name || 'none'} to ${next.name} - countdown reset`);
      } else {
        console.log(`⏱️ Next prayer unchanged: ${next.name} at ${next.time}`);
      }
    } else {
      console.log('⚠️ Could not determine next prayer time');
    }
  };

  // Update countdown timer to next prayer
  const lastCountdownLog = useRef<string>('');
  const countdownTriggeredRefresh = useRef<string>('');

  // Helper function to find the last prayer that already passed
  const findLastPrayer = (times: any, times12h: any): Date | null => {
    if (!times) return null;

    const now = new Date();
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const prayerNames = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    let lastPrayer: Date | null = null;

    // Check today's prayers
    for (const prayerName of prayerNames) {
      const timeStr = times[prayerName];
      if (timeStr && timeStr !== '--:--') {
        const [hour, minute] = timeStr.split(':').map(Number);
        if (!isNaN(hour) && !isNaN(minute)) {
          const prayerDate = new Date(today);
          prayerDate.setHours(hour, minute, 0, 0);

          if (prayerDate <= now) {
            lastPrayer = prayerDate;
          } else {
            break; // Found the first future prayer, so previous one is the last
          }
        }
      }
    }

    // If no prayer passed today, get yesterday's Isha
    if (!lastPrayer) {
      // Try to get yesterday's data (simplified for now, assuming same times)
      const ishaTimeStr = times['Isha'];
      if (ishaTimeStr && ishaTimeStr !== '--:--') {
        const [hour, minute] = ishaTimeStr.split(':').map(Number);
        if (!isNaN(hour) && !isNaN(minute)) {
          const yesterdayIsha = new Date(yesterday);
          yesterdayIsha.setHours(hour, minute, 0, 0);
          lastPrayer = yesterdayIsha;
        }
      }
    }

    return lastPrayer;
  };
  const updateCountdown = useCallback(() => {
    if (!nextPrayer) return;

    const now = new Date();
    const prayerTime = new Date(nextPrayer.date);

    const diffSeconds = Math.max(0, differenceInSeconds(prayerTime, now));

    if (diffSeconds <= 0) {
      // Prayer time has passed! 

      // Only log this once per prayer to prevent spam
      const logKey = `${nextPrayer.name}-passed`;
      if (lastCountdownLog.current !== logKey) {
        console.log(`⏰ Countdown: ${nextPrayer.name} prayer time has passed`);
        lastCountdownLog.current = logKey;
      }

      // Show that time has passed
      setCountdown('00:00:00');

      // Immediately update to next prayer when countdown reaches zero
      // Only trigger once per prayer to prevent loops
      const refreshKey = `${nextPrayer.name}-${prayerTime.getTime()}`;

      console.log(`🔍 Countdown zero check - refreshKey: ${refreshKey}, stored: ${countdownTriggeredRefresh.current}, currentDay: ${currentDay}, hasPrayerTimes: ${!!prayerTimes}`);

      if (countdownTriggeredRefresh.current !== refreshKey && currentDay === 0 && prayerTimes) {
        countdownTriggeredRefresh.current = refreshKey;
        console.log('🔄 Countdown reached zero - advancing to next prayer immediately');
        // Update immediately, no setTimeout needed
        updateNextPrayer(prayerTimes);
      } else {
        console.log('⚠️ Countdown zero BUT not triggering update - already triggered or wrong conditions');
      }

      return;
    }

    // Reset log key when prayer is active
    const activeLogKey = `${nextPrayer.name}-active`;
    if (lastCountdownLog.current !== activeLogKey) {
      lastCountdownLog.current = activeLogKey;
    }

    // ✨ NEW ENHANCED COUNTDOWN LOGIC ✨

    // Find the last prayer that already passed
    const lastPrayer = findLastPrayer(prayerTimes?.times, prayerTimes?.times12h);

    if (lastPrayer) {
      // Calculate total time span between last prayer and next prayer
      const totalTimeSpan = differenceInSeconds(prayerTime, lastPrayer);
      const elapsedTime = differenceInSeconds(now, lastPrayer);
      const remainingTime = differenceInSeconds(prayerTime, now);

      // Calculate progress percentage (0-100)
      const progressPercentage = Math.min(100, Math.max(0, (elapsedTime / totalTimeSpan) * 100));

      console.log(`⏱️ Enhanced Countdown: ${Math.round(progressPercentage)}% progress, ${Math.floor(remainingTime / 60)}m remaining`);

      // Determine countdown display based on remaining time
      const oneHourInSeconds = 3600;

      if (remainingTime <= oneHourInSeconds) {
        // Final hour: Show time remaining
        const minutesRemaining = Math.floor(remainingTime / 60);
        const secondsRemaining = remainingTime % 60;

        // Show just time remaining in final hour
        const finalHourDisplay = `${minutesRemaining}m ${secondsRemaining}s`;

        if (countdown !== finalHourDisplay) {
          setCountdown(finalHourDisplay);
        }

        // Update the beautiful circular progress indicator to show hour proportion
        const hourElapsed = oneHourInSeconds - remainingTime;
        const hourProgress = Math.max(0, Math.min(1, hourElapsed / oneHourInSeconds));

        if (Math.abs(hourProgress - progressPercent) > 0.01) {
          setProgressPercent(hourProgress);

          Animated.timing(progressAnimation, {
            toValue: hourProgress,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease)
          }).start();
        }

      } else {
        // More than 1 hour: Show time remaining
        const hoursRemaining = Math.floor(remainingTime / 3600);
        const minutesRemaining = Math.floor((remainingTime % 3600) / 60);

        // Show just time remaining without percentage
        const progressDisplay = `${hoursRemaining}h ${minutesRemaining}m`;

        if (countdown !== progressDisplay) {
          setCountdown(progressDisplay);
        }

        // For more than 1 hour, show overall progress in the circular indicator
        // Scale the overall progress to fit the circle (0-1 range)
        const circularProgress = Math.max(0, Math.min(1, progressPercentage / 100));

        if (Math.abs(circularProgress - progressPercent) > 0.01) {
          setProgressPercent(circularProgress);

          Animated.timing(progressAnimation, {
            toValue: circularProgress,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease)
          }).start();
        }
      }

      // Update last prayer time state if it changed
      if (!lastPrayerTime || lastPrayerTime.getTime() !== lastPrayer.getTime()) {
        setLastPrayerTime(lastPrayer);
      }

    } else {
      // Fallback to proportional countdown if we can't determine last prayer
      const hoursRemaining = Math.floor(diffSeconds / 3600);
      const minutesRemaining = Math.floor((diffSeconds % 3600) / 60);
      const secondsRemaining = diffSeconds % 60;

      // Calculate a basic progress (assuming 6-hour prayer intervals)
      const basicProgress = Math.min(100, Math.max(0, 100 - (diffSeconds / (6 * 3600)) * 100));

      // Always show proportional display even in fallback
      const oneHourInSeconds = 3600;

      if (diffSeconds <= oneHourInSeconds) {
        // Final hour: Show time remaining
        const timeDisplay = `${minutesRemaining}m ${secondsRemaining}s`;

        if (countdown !== timeDisplay) {
          setCountdown(timeDisplay);
        }

        const hourElapsed = oneHourInSeconds - diffSeconds;
        const hourProgress = Math.max(0, Math.min(1, hourElapsed / oneHourInSeconds));

        if (Math.abs(hourProgress - progressPercent) > 0.01) {
          setProgressPercent(hourProgress);

          Animated.timing(progressAnimation, {
            toValue: hourProgress,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease)
          }).start();
        }
      } else {
        // More than 1 hour: Show time remaining
        const progressDisplay = `${hoursRemaining}h ${minutesRemaining}m`;

        if (countdown !== progressDisplay) {
          setCountdown(progressDisplay);
        }

        // Show basic progress in circular indicator
        const circularProgress = Math.max(0, Math.min(1, basicProgress / 100));

        if (Math.abs(circularProgress - progressPercent) > 0.01) {
          setProgressPercent(circularProgress);

          Animated.timing(progressAnimation, {
            toValue: circularProgress,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease)
          }).start();
        }
      }
    }

    // Mark countdown as loaded
    if (countdownLoading) {
      setCountdownLoading(false);
    }
  }, [nextPrayer, currentDay, progressPercent, countdown, prayerTimes, lastPrayerTime, countdownLoading, updateNextPrayer]);

  // Timer management for countdown - only when app is in foreground
  useEffect(() => {
    let countdownTimer: NodeJS.Timeout | null = null;

    if (nextPrayer && appState === 'active') { // Only run when app is active (foreground)
      updateCountdown();
      countdownTimer = setInterval(updateCountdown, 1000);
    }

    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [updateCountdown, nextPrayer, appState]); // Add appState dependency

  // Reset progress when next prayer changes (improved stability)
  useEffect(() => {
    if (nextPrayer) {
      // Only show loading very briefly to prevent glitching
      setCountdownLoading(true);

      // Shorter timeout to reduce glitching
      const resetTimeout = setTimeout(() => {
        // Reset progress animation to 0 when prayer changes
        progressAnimation.setValue(0);
        setProgressPercent(0);
        setCountdownLoading(false);
      }, 150); // Reduced to 150ms for faster response

      return () => clearTimeout(resetTimeout);
    }
  }, [nextPrayer]);

  // Day navigation functions
  const goToPreviousDay = () => {
    if (currentDay > 0) {
      const newDay = currentDay - 1;
      setCurrentDay(newDay);

      if (newDay === 0) {
        setCurrentDate(new Date());
      } else {
        setCurrentDate(prevDate => addDays(prevDate, -1));
      }

      setNextPrayer(null);
      setCountdown('');

      console.log(`Moving to day +${newDay}`);
    }
  };

  const goToNextDay = () => {
    if (currentDay < 9) {
      const newDay = currentDay + 1;
      setCurrentDay(newDay);

      setCurrentDate(prevDate => addDays(prevDate, 1));

      setNextPrayer(null);
      setCountdown('');

      console.log(`Moving to day +${newDay}`);
    }
  };

  const goToToday = () => {
    setCurrentDay(0);
    setCurrentDate(new Date());
    setNextPrayer(null);
    setCountdown('');
  };

  // Support / Donation flow (mirror Settings)
  const [showPaywall, setShowPaywall] = useState(false);
  const [iapRetryCount, setIapRetryCount] = useState(0);
  const { loading: iapLoading, fetchOfferings } = usePurchase();

  const openDonation = () => {
    const extra: any = (Constants.expoConfig?.extra || (Constants as any).manifest?.extra || {});
    const rciOSKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || extra?.revenuecat?.iosApiKey;
    const rcAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || extra?.revenuecat?.androidApiKey;
    const shouldUsePaywall = Platform.OS === 'ios' ? !!rciOSKey : (Platform.OS === 'android' ? !!rcAndroidKey : false);

    if (shouldUsePaywall) {
      if (iapLoading && iapRetryCount < 3) {
        setIapRetryCount(prev => prev + 1);
        fetchOfferings();
        setTimeout(() => setShowPaywall(true), 1000);
      } else {
        setShowPaywall(true);
      }
      return;
    }
    // Fallback: external links if no RevenueCat key configured for this platform
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

  // Listen for auto support trigger and show paywall (5s handled in layout)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const check = async () => {
      const trigger = await AsyncStorage.getItem('support_trigger');
      if (trigger) {
        await AsyncStorage.removeItem('support_trigger');
        if (Platform.OS === 'ios') {
          if (iapLoading) {
            fetchOfferings();
            timer = setTimeout(() => setShowPaywall(true), 500);
          } else {
            setShowPaywall(true);
          }
        } else {
          // Android: show the alert instead
          openDonation();
        }
      }
    };
    const interval = setInterval(check, 1500);
    return () => { clearInterval(interval); if (timer) clearTimeout(timer); };
  }, [iapLoading]);

  // Region selector component
  const RegionPicker = () => (
    <Modal
      transparent={true}
      visible={showRegionPicker}
      animationType="fade"
      onRequestClose={() => toggleModal(setShowRegionPicker)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('selectRegion')}</Text>
            <TouchableOpacity onPress={() => toggleModal(setShowRegionPicker)}>
              <MaterialCommunityIcons name="close" size={24} color={SepiaColors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={availableRegions as RegionItem[]}
            keyExtractor={(item: RegionItem) => item.id}
            renderItem={({ item }: { item: RegionItem }) => (
              <TouchableOpacity
                style={[
                  styles.regionItem,
                  regionId === item.id && styles.selectedRegionItem
                ]}
                onPress={() => changeRegion(item.id)}
              >
                <Text style={[
                  styles.regionName,
                  regionId === item.id && styles.selectedRegionName
                ]}>
                  {item.name}
                </Text>
                {regionId === item.id && (
                  <MaterialCommunityIcons name="check" size={20} color={SepiaColors.accent.gold} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  const changeRegion = async (newRegionId: string): Promise<void> => {
    try {
      console.log(`Changing region from ${regionId} to ${newRegionId}`);

      // Set loading states
      setRegionChanging(true);
      setLoading(true);

      // Save the new region first
      await AsyncStorage.setItem('selected_region', newRegionId);

      // Get config for new region
      const config = getRegionConfig(newRegionId);
      if (!config) {
        throw new Error('Invalid region configuration');
      }

      console.log(`New location config: ${config.location}`);

      // Clear ALL cached data (just in case some exists)
      console.log('Clearing any existing cached data...');
      const keys = await AsyncStorage.getAllKeys();
      const prayerKeys = keys.filter(key => key.startsWith('prayer_'));
      if (prayerKeys.length > 0) {
        await AsyncStorage.multiRemove(prayerKeys);
        console.log(`Removed ${prayerKeys.length} cached prayer entries`);
      }

      // Reset prayer states
      setPrayerTimes(null);
      setNextPrayer(null);
      setCountdown('');

      // Update state with new location config
      setRegionId(newRegionId);
      setLocation(config.location);
      setMethod(config.method);
      setTuningParams(config.tuningParams);

      // Close the modal
      toggleModal(setShowRegionPicker);

      // Force immediate fresh data fetch for new location
      console.log('Fetching FRESH data for new region (no cache)...');
      await fetchAndCachePrayerTimes();

      // Schedule notifications after successful data fetch
      if (notificationsEnabled && currentDay === 0) {
        setTimeout(() => {
          scheduleNotificationsForToday();
        }, 1000);
      }

      console.log('Region change completed successfully');
    } catch (error) {
      console.error('Error changing region:', error);
      Alert.alert('Error', 'Failed to change region. Please try again.');
    } finally {
      setLoading(false);
      setRegionChanging(false);
    }
  };

  useEffect(() => {
    checkDayChange();
  }, [currentDate, notificationsEnabled, currentDay]);

  const handleClearCache = (): void => {
    clearCache(true);
  };

  // Enhanced refresh button
  const handleRefreshPress = () => {
    handleClearCache();
  };

  // Render the UI
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? colors.background.primary : SepiaColors.background.primary }]} edges={['top', 'left', 'right']}>
      {Platform.OS === 'android' ? (
        <View style={{
          height: StatusBar.currentHeight || 20,
          backgroundColor: isDark ? colors.background.primary : SepiaColors.background.primary
        }} />
      ) : (
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={isDark ? colors.background.primary : SepiaColors.background.primary}
        />
      )}

      <Stack.Screen
        options={{
          headerShown: false, // Hide the default header
          title: t('appName') // This sets the title but since we're hiding the header, it won't show
        }}
      />

      {/* ✨ MAGICAL GRADIENT BACKGROUND ✨ */}
      <ExpoLinearGradient
        colors={isDark ? [colors.background.primary, colors.background.secondary, colors.background.tertiary] : (getTimeBasedGradient() as any)}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      <View style={styles.container}>

        {/* Region Picker Modal */}
        <RegionPicker />

        {/* Support Paywall Modal */}
        {showPaywall && (
          <Modal animationType="slide" transparent visible={showPaywall} onRequestClose={() => setShowPaywall(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' }}>
              <RevenueCatPaywall onClose={() => setShowPaywall(false)} />
            </View>
          </Modal>
        )}

        {/* Reverted: separate header + location + date nav (tightened spacing) */}
        <View style={[styles.headerSection, { marginBottom: 4 }]}>
          <MagicalHeader />
          <MagicalButton
            style={[styles.enhancedLocationContainer, { paddingVertical: 8, marginTop: 4 }]}
            onPress={() => {
              router.push('/settings');
            }}
            disabled={regionChanging}
            glowColor={SepiaColors.accent.amber}
          >
            <View style={styles.locationIconWrapper}>
              <MaterialCommunityIcons name="map-marker" size={20} color={SepiaColors.accent.gold} />
            </View>
            <View style={styles.locationTextWrapper}>
              <Text style={styles.locationLabel}>{t('location')}</Text>
              <Text style={styles.locationText} numberOfLines={1}>
                {regionChanging ? 'Changing location...' : (getRegionConfig(regionId)?.name || location)}
              </Text>
            </View>
            <View style={styles.locationActionWrapper}>
              {regionChanging ? (
                <ActivityIndicator size="small" color={SepiaColors.accent.gold} />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={20} color={SepiaColors.accent.gold} />
              )}
            </View>
          </MagicalButton>
        </View>
        <View style={[styles.dateNavigationSection, { marginBottom: 8 }]}>
          <View style={[styles.enhancedDateNav, { paddingVertical: 6 }]}>
            <MagicalArrowButton direction="left" onPress={goToPreviousDay} disabled={currentDay === 0} iconName="chevron-left" />
            <View style={styles.dateDisplayContainer}>
              <Text style={styles.primaryDateText}>
                {currentDay === 0 ? t('today') : currentDay === 1 ? t('tomorrow') : `+${currentDay} ${t('days')}`}
              </Text>
              {prayerTimes?.date && (
                <Text style={styles.secondaryDateText}>{format(addDays(new Date(), currentDay), 'MMM dd, yyyy')}</Text>
              )}
            </View>
            <MagicalArrowButton direction="right" onPress={goToNextDay} disabled={currentDay === 9} iconName="chevron-right" />
          </View>
          {currentDay > 1 && (
            <TouchableOpacity
              style={styles.returnToTodayButton}
              onPress={goToToday}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="calendar-today" size={14} color={SepiaColors.accent.gold} />
              <Text style={styles.returnToTodayText}>{t('returnToToday')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ✨ MAIN CONTENT AREA WITH ENHANCED LAYOUT ✨ */}
        <View style={styles.enhancedContentContainer}>
          {loading || regionChanging ? (
            <View style={styles.enhancedLoadingContainer}>
              <View style={styles.loadingIconWrapper}>
                <ActivityIndicator size="large" color={SepiaColors.accent.gold} />
              </View>
              <Text style={styles.enhancedLoadingText}>
                {regionChanging ? 'Loading prayer times for new location...' : t('loading')}
              </Text>
              <Text style={styles.loadingSubtext}>
                Please wait a moment...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.enhancedScrollView}
              contentContainerStyle={styles.enhancedScrollViewContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
            >
              {/* ✨ ENHANCED NEXT PRAYER COUNTDOWN SECTION ✨ */}
              {nextPrayer && currentDay === 0 && (
                <View style={styles.countdownSection}>
                  <EnhancedCircularProgress
                    progress={progressPercent}
                    size={Math.min(260, screenWidth * 0.75)}
                    strokeWidth={14}
                  />
                </View>
              )}

              {/* ✨ ENHANCED PRAYER TIMES GRID ✨ */}
              {prayerTimes?.times && (
                <View style={styles.enhancedTimesContainer}>
                  <View style={styles.timesHeader}>
                    <Animated.View style={{
                      transform: [{ rotate: shimmerAnimation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
                    }}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={20}
                        color={SepiaColors.accent.gold}
                      />
                    </Animated.View>
                    <Text style={styles.timesHeaderText}>{t('prayerTimes')}</Text>
                  </View>

                  <View style={styles.prayerTimesGrid}>
                    {Object.entries(prayerTimes.times).map(([prayer, time], index) => (
                      <Animated.View
                        key={prayer}
                        style={[
                          styles.enhancedPrayerItem,
                          nextPrayer && nextPrayer.name === prayer && currentDay === 0
                            ? styles.enhancedNextPrayerItem
                            : null,
                          {
                            transform: [{
                              scale: shimmerAnimation.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 1.02, 1],
                              })
                            }]
                          }
                        ]}
                      >
                        {/* Magical glow effect for next prayer */}
                        {nextPrayer && nextPrayer.name === prayer && currentDay === 0 && (
                          <Animated.View
                            style={[
                              StyleSheet.absoluteFillObject,
                              {
                                backgroundColor: SepiaColors.accent.gold,
                                opacity: shimmerAnimation.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.05, 0.15, 0.05],
                                }),
                                borderRadius: 16,
                              }
                            ]}
                            pointerEvents="none"
                          />
                        )}

                        <View style={styles.prayerItemHeader}>
                          <View style={[
                            styles.enhancedIconContainer,
                            nextPrayer && nextPrayer.name === prayer && currentDay === 0 && styles.activeEnhancedIconContainer
                          ]}>
                            <AnimatedPrayerIcon
                              prayer={prayer}
                              active={!!(nextPrayer && nextPrayer.name === prayer && currentDay === 0)}
                              size={24}
                              color={
                                nextPrayer && nextPrayer.name === prayer && currentDay === 0
                                  ? SepiaColors.accent.darkGold
                                  : SepiaColors.accent.gold
                              }
                            />
                          </View>
                          <Text style={[
                            styles.enhancedPrayerName,
                            // Apply active style for next prayer
                            nextPrayer && nextPrayer.name === prayer && currentDay === 0 && styles.activeEnhancedPrayerName,
                            // Dark mode accessibility: ensure strong contrast
                            isDark && { color: C.text.primary }
                          ]}>
                            {t(prayer)}
                          </Text>
                        </View>

                        <View style={styles.prayerTimeWrapper}>
                          <Text style={[
                            styles.enhancedPrayerTime,
                            nextPrayer && nextPrayer.name === prayer && currentDay === 0 && styles.activeEnhancedPrayerTime,
                            isDark && { color: nextPrayer && nextPrayer.name === prayer && currentDay === 0 ? C.accent.amber : C.text.secondary }
                          ]}>
                            {prayerTimes.times12h ? prayerTimes.times12h[prayer] : convertTo12HourFormat(time)}
                          </Text>
                          {nextPrayer && nextPrayer.name === prayer && currentDay === 0 && (
                            <View style={styles.nextIndicator}>
                              <MaterialCommunityIcons
                                name="clock-fast"
                                size={12}
                                color={SepiaColors.accent.darkGold}
                              />
                              <Text style={styles.nextIndicatorText}>{t('next')}</Text>
                            </View>
                          )}
                        </View>
                      </Animated.View>
                    ))}
                  </View>
                </View>
              )}

              {/* ✨ IQAMA EXPLANATION FOOTER ✨ */}
              {prayerTimes?.times && (
                <View style={styles.iqamaFooterContainer}>
                  <MaterialCommunityIcons name="information-outline" size={13} color={C.text.tertiary || C.text.secondary} />
                  <Text style={styles.iqamaFooterText}>
                    {t('iqamaExplanation')}
                  </Text>
                </View>
              )}

              {/* ✨ MAGICAL FOOTER ✨ */}
              <MagicalFooter />
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

