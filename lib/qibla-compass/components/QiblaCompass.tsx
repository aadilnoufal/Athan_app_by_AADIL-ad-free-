/**
 * QiblaCompass Component
 * 
 * A complete, ready-to-use Qibla compass component with
 * compass rose, Kaaba indicator, and calibration support.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Image,
  ImageSourcePropType,
} from 'react-native';
import Svg, { Path, Circle, G, Polygon, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useQiblaCompass } from '../hooks/useQiblaCompass';
import { CompassRose } from './CompassRose';
import { CalibrationGuide } from './CalibrationGuide';
import { QiblaCompassConfig, CalibrationStatus } from '../types';

interface QiblaCompassProps extends QiblaCompassConfig {
  /** Size of the compass */
  size?: number;
  /** Primary/accent color */
  primaryColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** Secondary text color */
  secondaryTextColor?: string;
  /** Container style */
  style?: ViewStyle;
  /** Custom Kaaba image */
  kaabaImage?: ImageSourcePropType;
  /** Whether to show the compass rose */
  showCompassRose?: boolean;
  /** Whether to show distance to Kaaba */
  showDistance?: boolean;
  /** Whether to show calibration guide */
  showCalibrationGuide?: boolean;
  /** Whether to show accuracy indicator */
  showAccuracyIndicator?: boolean;
  /** Called when facing Qibla */
  onFacingQibla?: () => void;
  /** Called when compass error occurs */
  onError?: (error: string) => void;
  /** Custom loading component */
  LoadingComponent?: React.ReactNode;
  /** Custom error component */
  ErrorComponent?: React.ReactNode;
}

// Animated SVG components
const AnimatedG = Animated.createAnimatedComponent(G);

export const QiblaCompass: React.FC<QiblaCompassProps> = ({
  size = 300,
  primaryColor = '#D4AF37',
  backgroundColor = '#1a1a1a',
  textColor = '#FFFFFF',
  secondaryTextColor = '#888888',
  style,
  kaabaImage,
  showCompassRose = true,
  showDistance = true,
  showCalibrationGuide = true,
  showAccuracyIndicator = true,
  onFacingQibla,
  onError,
  LoadingComponent,
  ErrorComponent,
  ...config
}) => {
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
  } = useQiblaCompass(config);

  // Animation values
  const compassRotateAnim = useRef(new Animated.Value(0)).current;
  const qiblaIndicatorAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Animate compass rotation
  useEffect(() => {
    Animated.spring(compassRotateAnim, {
      toValue: -compassHeading,
      useNativeDriver: true,
      friction: 10,
      tension: 40,
    }).start();
  }, [compassHeading, compassRotateAnim]);

  // Animate Qibla indicator
  useEffect(() => {
    Animated.spring(qiblaIndicatorAnim, {
      toValue: qiblaDirection - compassHeading,
      useNativeDriver: true,
      friction: 10,
      tension: 40,
    }).start();
  }, [qiblaDirection, compassHeading, qiblaIndicatorAnim]);

  // Pulse animation when facing Qibla
  useEffect(() => {
    if (isFacingQibla) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();

      onFacingQibla?.();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isFacingQibla, pulseAnim, glowAnim, onFacingQibla]);

  // Handle errors
  useEffect(() => {
    if (error.message) {
      onError?.(error.message);
    }
  }, [error.message, onError]);

  const center = size / 2;
  const radius = size / 2 - 30;

  // Interpolate rotation for Animated.View
  const compassRotateInterpolate = compassRotateAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  const qiblaRotateInterpolate = qiblaIndicatorAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  // Glow style for facing Qibla state
  const glowStyle = useMemo(() => ({
    shadowColor: primaryColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isFacingQibla ? 0.8 : 0.3,
    shadowRadius: isFacingQibla ? 20 : 10,
    elevation: isFacingQibla ? 15 : 5,
  }), [isFacingQibla, primaryColor]);

  // Loading state
  if (isLoading) {
    if (LoadingComponent) {
      return <>{LoadingComponent}</>;
    }

    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <View style={[styles.loadingContainer, { backgroundColor }]}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>
            Initializing compass...
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error.type && !location) {
    if (ErrorComponent) {
      return <>{ErrorComponent}</>;
    }

    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <View style={[styles.errorContainer, { backgroundColor }]}>
          <Text style={[styles.errorIcon]}>⚠️</Text>
          <Text style={[styles.errorText, { color: textColor }]}>
            {error.message}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: primaryColor }]}
            onPress={reinitialize}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Calibration needed state
  if (showCalibrationGuide && calibration.isCalibrationRecommended) {
    return (
      <View style={[styles.container, style]}>
        <CalibrationGuide
          calibration={calibration}
          primaryColor={primaryColor}
          backgroundColor={backgroundColor}
          textColor={textColor}
          onDismiss={() => {}}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Main compass container */}
      <Animated.View
        style={[
          styles.compassContainer,
          {
            width: size,
            height: size,
            transform: [{ scale: pulseAnim }],
          },
          glowStyle,
        ]}
      >
        {/* Outer ring */}
        <View
          style={[
            styles.outerRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: isFacingQibla ? primaryColor : 'rgba(255,255,255,0.1)',
              backgroundColor,
            },
          ]}
        >
          {/* Compass Rose */}
          {showCompassRose && (
            <Animated.View
              style={{
                transform: [{ rotate: compassRotateInterpolate }],
              }}
            >
              <CompassRose
                size={size - 20}
                primaryColor={primaryColor}
                textColor={textColor}
                secondaryColor={secondaryTextColor}
                backgroundColor="transparent"
              />
            </Animated.View>
          )}

          {/* Qibla indicator */}
          <Animated.View
            style={[
              styles.qiblaIndicatorContainer,
              {
                width: size - 20,
                height: size - 20,
                transform: [{ rotate: qiblaRotateInterpolate }],
              },
            ]}
          >
            <View style={[styles.qiblaIndicator, { top: 15 }]}>
              {/* Kaaba icon or custom image */}
              {kaabaImage ? (
                <Image source={kaabaImage} style={styles.kaabaImage} />
              ) : (
                <View style={[styles.kaabaIcon, { backgroundColor: primaryColor }]}>
                  <Text style={styles.kaabaText}>🕋</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Center information */}
          <View style={styles.centerInfo}>
            <Text style={[styles.degreesText, { color: textColor }]}>
              {Math.round(qiblaDirection)}°
            </Text>
            <Text style={[styles.directionText, { color: secondaryTextColor }]}>
              {qiblaCardinal}
            </Text>
            {isFacingQibla && (
              <Text style={[styles.facingText, { color: primaryColor }]}>
                ✓ Facing Qibla
              </Text>
            )}
          </View>

          {/* Fixed north indicator at top */}
          <View style={styles.northIndicator}>
            <View style={[styles.northTriangle, { borderBottomColor: '#FF4444' }]} />
          </View>
        </View>
      </Animated.View>

      {/* Bottom info */}
      <View style={styles.infoContainer}>
        {/* Distance to Kaaba */}
        {showDistance && location && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: secondaryTextColor }]}>
              Distance to Kaaba
            </Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {location.distanceToKaaba.toFixed(0)} km
            </Text>
          </View>
        )}

        {/* Accuracy indicator */}
        {showAccuracyIndicator && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: secondaryTextColor }]}>
              Accuracy
            </Text>
            <View style={styles.accuracyDots}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.accuracyDot,
                    {
                      backgroundColor:
                        i < compass.accuracy
                          ? primaryColor
                          : 'rgba(255,255,255,0.2)',
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Degrees off Qibla */}
        {!isFacingQibla && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: secondaryTextColor }]}>
              Turn
            </Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {qiblaRotation > 0 ? '→' : '←'} {Math.abs(Math.round(qiblaRotation))}°
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  qiblaIndicatorContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  qiblaIndicator: {
    position: 'absolute',
    alignItems: 'center',
  },
  kaabaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kaabaText: {
    fontSize: 24,
  },
  kaabaImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  centerInfo: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  degreesText: {
    fontSize: 36,
    fontWeight: '800',
  },
  directionText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  facingText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  northIndicator: {
    position: 'absolute',
    top: -5,
    alignItems: 'center',
  },
  northTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 30,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 200,
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  accuracyDots: {
    flexDirection: 'row',
    gap: 4,
  },
  accuracyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
