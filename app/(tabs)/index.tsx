import React, { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  FlatList,
  AppState,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { getRegionConfig, DEFAULT_REGION } from '../config/prayerTimeConfig';
import { useLanguage } from '../../contexts/LanguageContext';
import { SepiaColors } from '../../constants/sepiaColors';
import { useTheme } from '../../contexts/ThemeContext';
import { goldTint } from '../../utils/colorHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RevenueCatPaywall from '../components/RevenueCatPaywall';
import { createHomeStyles } from '../components/home/homeStyles';
import AnimatedPrayerIcon from '../components/home/AnimatedPrayerIcon';
import { useHomeAnimations } from '../../hooks/home/useHomeAnimations';
import { useSettingsDonation } from '../../hooks/settings/useSettingsDonation';
import { useHomeAppStateSync } from '../../hooks/useHomeAppStateSync';
import { useHomeNotifications } from '../../hooks/home/useHomeNotifications';
import { useHomeRegion } from '../../hooks/home/useHomeRegion';
import { useHomePrayerData } from '../../hooks/home/useHomePrayerData';
import type { RegionItem } from '../components/home/homeTypes';

// Get screen dimensions for magical effects
const { width: screenWidth } = Dimensions.get('window');

export default function Home() {
  // Theme integration (phase 1)
  const { colors, isDark } = useTheme();
  // Shorthand alias used during gradual migration from static SepiaColors styles
  const C = colors;
  // Theme-aware gold tint helper
  const gt = (alpha: number) => goldTint(alpha, colors);
  // Dynamic themed styles — extracted to homeStyles.ts for maintainability
  const styles = React.useMemo(() => createHomeStyles(C, isDark), [C, isDark]);
  const router = useRouter();
  const { t } = useLanguage();

  // ── Region hook (self-contained, called first) ─────
  const {
    regionId, setRegionId, location, setLocation, method, setMethod,
    tuningParams, setTuningParams, availableRegions, regionChanging,
    setRegionChanging, showRegionPicker, setShowRegionPicker,
    isFirstLoad, setIsFirstLoad, loadRegionConfig,
  } = useHomeRegion();

  // ── Notifications hook ──────────────────────────────
  const {
    notificationsEnabled,
    scheduleNotificationsForToday,
    syncPrayerTimes,
    syncCurrentDay,
  } = useHomeNotifications();

  // ── Prayer data hook (receives region + notification params) ──
  const [appState, setAppState] = useState(AppState.currentState);

  const {
    prayerTimes, setPrayerTimes, currentDate, setCurrentDate,
    loading, setLoading, currentDay, setCurrentDay,
    nextPrayer, setNextPrayer, countdown, setCountdown,
    countdownLoading, lastPrayerTime, refreshing,
    progressAnimation, progressPercent, lastRefreshDate, setLastRefreshDate,
    convertTo12HourFormat, fetchPrayerTimes, fetchAndCachePrayerTimes,
    clearCache, goToPreviousDay, goToNextDay, goToToday,
    handleRefreshPress, updateNextPrayer,
  } = useHomePrayerData({
    regionId, location, method, tuningParams,
    isFirstLoad, setIsFirstLoad,
    t, appState: appState as string,
    notificationsEnabled, scheduleNotificationsForToday,
  });

  // Sync prayer times + currentDay to notification refs whenever they change
  useEffect(() => {
    syncPrayerTimes(prayerTimes);
  }, [prayerTimes]);

  useEffect(() => {
    syncCurrentDay(currentDay);
  }, [currentDay]);

  // App-state sync (foreground-resume date detection)
  useHomeAppStateSync({
    currentDay,
    currentDate,
    setCurrentDate,
    setCurrentDay,
    setLastRefreshDate,
    setAppState,
  });

  // Region change detection on screen focus
  useFocusEffect(
    useCallback(() => {
      const checkForRegionChanges = async () => {
        const savedRegion = await AsyncStorage.getItem('selected_region');
        const regionToUse = savedRegion || DEFAULT_REGION;
        if (regionToUse !== regionId) {
          await loadRegionConfig();
        } else {
          if (prayerTimes) setLoading(false);
        }
      };
      checkForRegionChanges();

      // Safety timeout: if still loading after 5s but data exists, clear loading
      const loadingTimeout = setTimeout(() => {
        if (loading && prayerTimes) {
          setLoading(false);
        }
      }, 5000);

      return () => clearTimeout(loadingTimeout);
    }, [regionId, prayerTimes, loading])
  );

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

  // ✨ ANIMATIONS — extracted to useHomeAnimations hook ✨
  const {
    glowAnimation, breathingAnimation, shimmerAnimation,
    headerGlowAnimation, footerStarAnimation, moonPhaseAnimation,
    footerBreathingAnimation, arrowBounceAnimation, refreshSpinAnimation,
    footerShimmerAnimation, buttonShimmerAnimation,
    getTimeBasedGradient,
  } = useHomeAnimations(colors, isDark);

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
          borderColor: gt(0.3),
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
  // Support / Donation flow — reuses settings donation hook
  const { showPaywall, setShowPaywall, iapLoading, fetchOfferings, openDonation } = useSettingsDonation(t);

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

