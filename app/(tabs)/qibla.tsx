/**
 * Qibla Direction Screen
 * 
 * Uses the custom qibla-compass library for accurate Qibla direction finding.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Line, G, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useQiblaCompass } from '../../lib/qibla-compass';
import { CalibrationStatus, CompassAccuracy } from '../../lib/qibla-compass/types';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(screenWidth * 0.78, 320);

export default function QiblaScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();

  const compassRotateAnim = useRef(new Animated.Value(0)).current;
  const qiblaRotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showCalibrationTip, setShowCalibrationTip] = useState(true);

  // Time-based gradient colors for dynamic backgrounds (matching settings)
  const getTimeBasedGradient = (): [string, string, string] => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 7) {
      return [colors.background.primary, colors.background.secondary, colors.surface.secondary];
    } else if (hour >= 7 && hour < 12) {
      return [colors.background.primary, colors.surface.elevated, colors.background.tertiary];
    } else if (hour >= 12 && hour < 15) {
      return [colors.surface.elevated, colors.background.secondary, colors.surface.secondary];
    } else if (hour >= 15 && hour < 18) {
      return [colors.background.secondary, colors.background.tertiary, colors.surface.secondary];
    } else if (hour >= 18 && hour < 20) {
      return [colors.background.tertiary, colors.surface.secondary, '#F5F1E6'];
    } else {
      return [colors.surface.secondary, colors.surface.secondary, '#F2EEE1'];
    }
  };
  const gradientColors: [string, string, string] = isDark
    ? [colors.background.primary, colors.background.secondary, colors.surface.primary]
    : getTimeBasedGradient();

  const {
    qiblaDirection,
    compassHeading,
    qiblaRotation,
    qiblaCardinal,
    facingCardinal,
    isFacingQibla,
    degreesOffQibla,
    compass,
    location,
    calibration,
    isLoading,
    error,
    reinitialize,
  } = useQiblaCompass({
    updateInterval: 32,
    filterCoefficient: 0.5,
    qiblaThreshold: 5,
    useSensorFusion: true,
  });

  // Smooth compass rotation animation
  useEffect(() => {
    Animated.spring(compassRotateAnim, {
      toValue: -compassHeading,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [compassHeading]);

  // Smooth qibla indicator animation
  useEffect(() => {
    Animated.spring(qiblaRotateAnim, {
      toValue: qiblaDirection - compassHeading,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [qiblaDirection, compassHeading]);

  // Pulse animation when facing Qibla
  useEffect(() => {
    if (isFacingQibla) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isFacingQibla]);

  // Hide calibration tip after delay
  useEffect(() => {
    if (compass.accuracy >= CompassAccuracy.MEDIUM) {
      const timer = setTimeout(() => setShowCalibrationTip(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [compass.accuracy]);

  const compassRotateInterpolate = compassRotateAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  const qiblaRotateInterpolate = qiblaRotateAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  const getAccuracyLabel = () => {
    switch (compass.accuracy) {
      case CompassAccuracy.HIGH: return t('qiblaAccuracyHigh');
      case CompassAccuracy.MEDIUM: return t('qiblaAccuracyMedium');
      case CompassAccuracy.LOW: return t('qiblaAccuracyLow');
      default: return t('qiblaAccuracyPoor');
    }
  };

  const getAccuracyColor = () => {
    switch (compass.accuracy) {
      case CompassAccuracy.HIGH: return '#4CAF50';
      case CompassAccuracy.MEDIUM: return colors.accent.gold;
      case CompassAccuracy.LOW: return '#FF9800';
      default: return '#F44336';
    }
  };

  const styles = createStyles(colors, isDark, language, isFacingQibla);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ExpoLinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
        <View style={styles.container}>
          <View style={styles.headerWrapper}>
            <Text style={styles.headerTitle}>{t('qiblaTitle')}</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.gold} />
            <Text style={styles.loadingText}>{t('qiblaLoading')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error.type && !location) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ExpoLinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
        <View style={styles.container}>
          <View style={styles.headerWrapper}>
            <Text style={styles.headerTitle}>{t('qiblaTitle')}</Text>
          </View>
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="compass-off" size={56} color={colors.text.secondary} />
            <Text style={styles.errorTitle}>{t('qiblaErrorTitle')}</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={reinitialize}>
              <Text style={styles.retryText}>{t('qiblaRetry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const center = COMPASS_SIZE / 2;
  const radius = COMPASS_SIZE / 2 - 25;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ExpoLinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={styles.container}>
        {/* Minimal header like settings */}
        <View style={styles.headerWrapper}>
          <Text style={styles.headerTitle}>{t('qiblaTitle')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* Calibration Tip */}
          {showCalibrationTip && compass.accuracy < CompassAccuracy.HIGH && (
            <Animated.View style={styles.calibrationCard}>
              <View style={styles.calibrationHeader}>
                <MaterialCommunityIcons
                  name="information"
                  size={20}
                  color={colors.accent.gold}
                />
                <Text style={styles.calibrationTitle}>
                  {t('qiblaCalibrationTip')}
                </Text>
                <TouchableOpacity onPress={() => setShowCalibrationTip(false)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.calibrationText}>
                {t('qiblaCalibrationInstruction')}
              </Text>
              {/* Figure-8 animation hint */}
              <View style={styles.figure8Container}>
                <Text style={styles.figure8Text}>∞</Text>
              </View>
            </Animated.View>
          )}

          {/* Main Compass */}
          <View style={styles.compassWrapper}>
            <Animated.View
              style={[
                styles.compassContainer,
                { transform: [{ scale: pulseAnim }] },
                isFacingQibla && styles.compassGlow,
              ]}
            >
              {/* Outer decorative ring */}
              <View style={styles.outerRing}>
                {/* Compass rose - rotates with heading */}
                <Animated.View
                  style={[
                    styles.compassRose,
                    { transform: [{ rotate: compassRotateInterpolate }] }
                  ]}
                >
                  <Svg width={COMPASS_SIZE - 30} height={COMPASS_SIZE - 30}>
                    <G x={(COMPASS_SIZE - 30) / 2} y={(COMPASS_SIZE - 30) / 2}>
                      {/* Degree marks */}
                      {Array.from({ length: 72 }).map((_, i) => {
                        const angle = i * 5;
                        const isMajor = angle % 30 === 0;
                        const isCardinal = angle % 90 === 0;
                        const tickLength = isCardinal ? 15 : isMajor ? 10 : 5;
                        const tickWidth = isCardinal ? 2 : 1;
                        const r1 = radius - tickLength;
                        const r2 = radius;
                        const rad = (angle - 90) * (Math.PI / 180);

                        return (
                          <Line
                            key={i}
                            x1={r1 * Math.cos(rad)}
                            y1={r1 * Math.sin(rad)}
                            x2={r2 * Math.cos(rad)}
                            y2={r2 * Math.sin(rad)}
                            stroke={angle === 0 ? '#FF4444' : colors.text.secondary}
                            strokeWidth={tickWidth}
                            opacity={isMajor ? 0.8 : 0.4}
                          />
                        );
                      })}

                      {/* Cardinal directions */}
                      {['N', 'E', 'S', 'W'].map((dir, i) => {
                        const angle = i * 90;
                        const rad = (angle - 90) * (Math.PI / 180);
                        const r = radius - 35;
                        return (
                          <SvgText
                            key={dir}
                            x={r * Math.cos(rad)}
                            y={r * Math.sin(rad) + 6}
                            fill={dir === 'N' ? '#FF4444' : colors.text.primary}
                            fontSize={dir === 'N' ? 20 : 16}
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {dir}
                          </SvgText>
                        );
                      })}

                      {/* Inner circle */}
                      <Circle
                        r={radius - 55}
                        fill="none"
                        stroke={colors.text.secondary}
                        strokeWidth={1}
                        opacity={0.2}
                      />
                    </G>
                  </Svg>
                </Animated.View>

                {/* Qibla indicator - rotates independently */}
                <Animated.View
                  style={[
                    styles.qiblaIndicator,
                    { transform: [{ rotate: qiblaRotateInterpolate }] }
                  ]}
                >
                  <View style={[styles.kaabaMarker, { backgroundColor: colors.accent.gold }]}>
                    <Text style={styles.kaabaEmoji}>🕋</Text>
                  </View>
                  <View style={[styles.qiblaLine, { backgroundColor: colors.accent.gold }]} />
                </Animated.View>

                {/* Center info */}
                <View style={styles.centerInfo}>
                  <Text style={styles.degreesText}>{Math.round(qiblaDirection)}°</Text>
                  <Text style={styles.cardinalText}>{qiblaCardinal}</Text>
                  {isFacingQibla ? (
                    <View style={styles.facingQiblaContainer}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={colors.accent.gold}
                      />
                      <Text style={styles.facingQiblaText}>
                        {t('qiblaFacingQibla')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.turnText}>
                      {qiblaRotation > 0 ? '→ ' : '← '}
                      {Math.abs(Math.round(qiblaRotation))}°
                    </Text>
                  )}
                </View>

                {/* North indicator (fixed at top) */}
                <View style={styles.northIndicator}>
                  <View style={styles.northTriangle} />
                </View>
              </View>
            </Animated.View>
          </View>

          {/* Compact Info Box */}
          <View style={styles.compactInfoBox}>
            <View style={styles.compactInfoRow}>
              <View style={styles.compactInfoItem}>
                <MaterialCommunityIcons name="signal" size={14} color={getAccuracyColor()} />
                <Text style={styles.compactInfoLabel}>{t('qiblaAccuracy')}:</Text>
                <Text style={[styles.compactInfoValue, { color: getAccuracyColor() }]}>
                  {getAccuracyLabel()}
                </Text>
              </View>
              <View style={styles.compactInfoDivider} />
              {location && (
                <>
                  <View style={styles.compactInfoItem}>
                    <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.text.secondary} />
                    <Text style={styles.compactInfoLabel}>{t('qiblaDistance')}:</Text>
                    <Text style={styles.compactInfoValue}>{location.distanceToKaaba.toFixed(0)} km</Text>
                  </View>
                  <View style={styles.compactInfoDivider} />
                </>
              )}
              <View style={styles.compactInfoItem}>
                <MaterialCommunityIcons name="compass-outline" size={14} color={colors.text.secondary} />
                <Text style={styles.compactInfoLabel}>{t('qiblaHeading')}:</Text>
                <Text style={styles.compactInfoValue}>{Math.round(compassHeading)}° {facingCardinal}</Text>
              </View>
            </View>
          </View>

          {/* Refresh button */}
          <TouchableOpacity style={styles.refreshButton} onPress={reinitialize}>
            <MaterialCommunityIcons name="refresh" size={18} color={colors.text.primary} />
            <Text style={styles.refreshText}>{t('qiblaRecalibrate')}</Text>
          </TouchableOpacity>

          {/* Device orientation tip */}
          {!compass.isDeviceFlat && (
            <View style={styles.tiltWarning}>
              <MaterialCommunityIcons name="cellphone" size={18} color={colors.accent.gold} />
              <Text style={styles.tiltText}>
                {t('qiblaHoldFlat')}
              </Text>
            </View>
          )}

          {/* Islamic Disclaimer */}
          <View style={styles.disclaimerContainer}>
            <MaterialCommunityIcons name="information-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.disclaimerText}>
              {t('qiblaDisclaimer')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, language: string, isFacingQibla: boolean) => {
  // Helper functions for dynamic colors (matching settings pattern)
  const goldTint = (opacity: number) => {
    const gold = colors.accent.gold;
    return `${gold}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  };
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.7)';
  const subtleBorder = isDark ? goldTint(0.25) : goldTint(0.15);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    container: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 0,
      backgroundColor: 'transparent',
    },
    headerWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) - 6, 0) : 0,
      paddingHorizontal: 8,
      paddingBottom: 2,
      backgroundColor: 'transparent',
      minHeight: 32,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      letterSpacing: 0.4,
      textAlign: 'center',
    },
    scrollContent: {
      paddingBottom: 100,
      paddingTop: 4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 14,
      fontSize: 14,
      color: colors.text.secondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginTop: 14,
    },
    errorMessage: {
      fontSize: 13,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: 8,
    },
    retryButton: {
      marginTop: 20,
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 16,
    },
    retryText: {
      color: '#000',
      fontSize: 14,
      fontWeight: '600',
    },
    calibrationCard: {
      marginHorizontal: 4,
      marginTop: 8,
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 14,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent.gold,
    },
    calibrationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    calibrationTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginLeft: 8,
    },
    calibrationText: {
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 18,
    },
    figure8Container: {
      alignItems: 'center',
      marginTop: 8,
    },
    figure8Text: {
      fontSize: 32,
      color: colors.accent.gold,
      opacity: 0.6,
    },
    compassWrapper: {
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 16,
    },
    compassContainer: {
      width: COMPASS_SIZE,
      height: COMPASS_SIZE,
    },
    compassGlow: {
      shadowColor: colors.accent.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 8,
    },
    outerRing: {
      width: COMPASS_SIZE,
      height: COMPASS_SIZE,
      borderRadius: COMPASS_SIZE / 2,
      backgroundColor: cardBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isFacingQibla ? colors.accent.gold : subtleBorder,
    },
    compassRose: {
      position: 'absolute',
      width: COMPASS_SIZE - 30,
      height: COMPASS_SIZE - 30,
    },
    qiblaIndicator: {
      position: 'absolute',
      width: COMPASS_SIZE - 30,
      height: COMPASS_SIZE - 30,
      alignItems: 'center',
    },
    kaabaMarker: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      top: 5,
      shadowColor: colors.accent.gold,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    kaabaEmoji: {
      fontSize: 24,
    },
    qiblaLine: {
      position: 'absolute',
      top: 46,
      width: 2,
      height: (COMPASS_SIZE - 30) / 2 - 56,
      borderRadius: 1,
      opacity: 0.5,
    },
    centerInfo: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    degreesText: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.text.primary,
    },
    cardinalText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
      marginTop: 2,
    },
    turnText: {
      fontSize: 14,
      color: colors.text.secondary,
      marginTop: 6,
    },
    facingQiblaContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      backgroundColor: goldTint(0.15),
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
    },
    facingQiblaText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent.gold,
      marginLeft: 5,
    },
    northIndicator: {
      position: 'absolute',
      top: -2,
    },
    northTriangle: {
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderBottomWidth: 14,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: '#FF4444',
    },
    compactInfoBox: {
      marginHorizontal: 4,
      marginTop: 12,
      backgroundColor: cardBg,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 0.5,
      borderColor: subtleBorder,
    },
    compactInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    compactInfoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 5,
    },
    compactInfoLabel: {
      fontSize: 10,
      color: colors.text.secondary,
      marginLeft: 3,
    },
    compactInfoValue: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text.primary,
      marginLeft: 2,
    },
    compactInfoDivider: {
      width: 1,
      height: 10,
      backgroundColor: colors.text.secondary,
      opacity: 0.3,
      marginHorizontal: 3,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 4,
      marginTop: 12,
      paddingVertical: 10,
      backgroundColor: cardBg,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: subtleBorder,
    },
    refreshText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
      marginLeft: 6,
    },
    tiltWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
      paddingHorizontal: 16,
    },
    tiltText: {
      fontSize: 11,
      color: colors.text.secondary,
      marginLeft: 5,
    },
    disclaimerContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginHorizontal: 4,
      marginTop: 16,
      padding: 12,
      backgroundColor: cardBg,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: goldTint(0.1),
    },
    disclaimerText: {
      flex: 1,
      fontSize: 10,
      color: colors.text.secondary,
      marginLeft: 8,
      lineHeight: 14,
      textAlign: language === 'ar' ? 'right' : 'left',
      opacity: 0.8,
    },
  });
};
