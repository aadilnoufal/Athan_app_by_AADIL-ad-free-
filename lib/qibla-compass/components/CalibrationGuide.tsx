/**
 * CalibrationGuide Component
 * 
 * Shows calibration instructions and animation to help users
 * calibrate their device's compass.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { CalibrationData, CalibrationStatus } from '../types';

interface CalibrationGuideProps {
  /** Calibration data */
  calibration: CalibrationData;
  /** Called when user starts calibration */
  onStartCalibration?: () => void;
  /** Called when user dismisses the guide */
  onDismiss?: () => void;
  /** Primary color */
  primaryColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** Container style */
  style?: ViewStyle;
  /** Title style */
  titleStyle?: TextStyle;
  /** Instruction style */
  instructionStyle?: TextStyle;
  /** Whether to show the animated figure-8 guide */
  showAnimation?: boolean;
  /** Custom title text */
  title?: string;
}

export const CalibrationGuide: React.FC<CalibrationGuideProps> = ({
  calibration,
  onStartCalibration,
  onDismiss,
  primaryColor = '#D4AF37',
  backgroundColor = 'rgba(0, 0, 0, 0.8)',
  textColor = '#FFFFFF',
  style,
  titleStyle,
  instructionStyle,
  showAnimation = true,
  title,
}) => {
  const figure8Anim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Figure-8 animation
  useEffect(() => {
    if (calibration.status === CalibrationStatus.IN_PROGRESS && showAnimation) {
      Animated.loop(
        Animated.timing(figure8Anim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      figure8Anim.setValue(0);
    }
  }, [calibration.status, showAnimation, figure8Anim]);

  // Pulse animation for button
  useEffect(() => {
    if (calibration.status === CalibrationStatus.NEEDED) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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
    } else {
      pulseAnim.setValue(1);
    }
  }, [calibration.status, pulseAnim]);

  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: calibration.progress / 100,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [calibration.progress, progressAnim]);

  // Calculate figure-8 path
  const translateX = figure8Anim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 40, 0, -40, 0],
  });

  const translateY = figure8Anim.interpolate({
    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    outputRange: [0, -20, 0, 20, 0, -20, 0, 20, 0],
  });

  const getTitle = () => {
    if (title) return title;
    switch (calibration.status) {
      case CalibrationStatus.NEEDED:
        return 'Calibration Needed';
      case CalibrationStatus.IN_PROGRESS:
        return 'Calibrating...';
      case CalibrationStatus.CALIBRATED:
        return 'Calibration Complete';
      default:
        return 'Compass Calibration';
    }
  };

  const getButtonText = () => {
    switch (calibration.status) {
      case CalibrationStatus.NEEDED:
        return 'Start Calibration';
      case CalibrationStatus.IN_PROGRESS:
        return `${calibration.progress}%`;
      case CalibrationStatus.CALIBRATED:
        return 'Done';
      default:
        return 'Calibrate';
    }
  };

  if (calibration.status === CalibrationStatus.CALIBRATED && !calibration.isCalibrationRecommended) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <Text style={[styles.title, { color: textColor }, titleStyle]}>
        {getTitle()}
      </Text>

      {showAnimation && calibration.status === CalibrationStatus.IN_PROGRESS && (
        <View style={styles.animationContainer}>
          <Animated.View
            style={[
              styles.phoneIcon,
              {
                backgroundColor: primaryColor,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          >
            <View style={[styles.phoneScreen, { backgroundColor }]} />
          </Animated.View>
          {/* Figure-8 path indicator */}
          <View style={styles.pathContainer}>
            <View style={[styles.pathCircle, styles.pathLeft, { borderColor: primaryColor }]} />
            <View style={[styles.pathCircle, styles.pathRight, { borderColor: primaryColor }]} />
          </View>
        </View>
      )}

      <Text style={[styles.instruction, { color: textColor }, instructionStyle]}>
        {calibration.instruction}
      </Text>

      {calibration.status === CalibrationStatus.IN_PROGRESS && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: primaryColor,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {calibration.status !== CalibrationStatus.IN_PROGRESS && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor }]}
              onPress={
                calibration.status === CalibrationStatus.CALIBRATED
                  ? onDismiss
                  : onStartCalibration
              }
            >
              <Text style={styles.buttonText}>{getButtonText()}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {calibration.status === CalibrationStatus.IN_PROGRESS && (
          <View style={[styles.statusBadge, { backgroundColor: primaryColor }]}>
            <Text style={styles.statusText}>{calibration.progress}%</Text>
          </View>
        )}
      </View>

      {calibration.status === CalibrationStatus.NEEDED && onDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={[styles.dismissText, { color: textColor }]}>Skip for now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  animationContainer: {
    width: 120,
    height: 80,
    marginVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneIcon: {
    width: 30,
    height: 50,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  phoneScreen: {
    width: 22,
    height: 38,
    borderRadius: 3,
  },
  pathContainer: {
    position: 'absolute',
    width: 120,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  pathLeft: {
    marginRight: -10,
  },
  pathRight: {
    marginLeft: -10,
  },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    opacity: 0.9,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  dismissButton: {
    marginTop: 16,
    padding: 8,
  },
  dismissText: {
    fontSize: 14,
    opacity: 0.7,
  },
});
