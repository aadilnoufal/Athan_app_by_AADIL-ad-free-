/**
 * useQiblaCompass Hook
 * 
 * Main hook that combines location, compass, and calibration
 * to provide complete Qibla direction functionality.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  QiblaCompassResult,
  QiblaCompassConfig,
  DEFAULT_CONFIG,
  QiblaError,
  CompassAccuracy,
  CalibrationStatus,
} from '../types';
import { useLocation } from './useLocation';
import { useCompass } from './useCompass';
import { useCalibration } from './useCalibration';
import {
  calculateQiblaDirection,
  calculateQiblaRotation,
  isFacingQibla,
  getSimpleCompassDirection,
} from '../utils/qiblaCalculations';

export const useQiblaCompass = (
  config: QiblaCompassConfig = {}
): QiblaCompassResult => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const {
    updateInterval,
    filterCoefficient,
    qiblaThreshold,
    useSensorFusion,
    autoStart,
    locationUpdateInterval,
    showCalibrationWarnings,
  } = mergedConfig;

  // Use sub-hooks
  const {
    location,
    isLoading: locationLoading,
    error: locationError,
    refresh: refreshLocation,
    requestPermission: requestLocationPermission,
    hasPermission: hasLocationPermission,
  } = useLocation({
    autoStart,
    updateInterval: locationUpdateInterval,
  });

  const {
    compass,
    isAvailable: compassAvailable,
    isLoading: compassLoading,
    error: compassError,
    start: startCompass,
    stop: stopCompass,
    needsCalibration,
  } = useCompass({
    updateInterval,
    filterCoefficient,
    useTiltCompensation: useSensorFusion,
    autoStart,
  });

  const { calibration, startCalibration, completeCalibration, dismissWarning } = useCalibration({
    compassAccuracy: compass.accuracy,
    needsCalibration,
    showWarnings: showCalibrationWarnings,
  });

  // Calculate Qibla direction
  const qiblaDirection = useMemo(() => {
    if (!location) return 0;
    return calculateQiblaDirection(location.latitude, location.longitude);
  }, [location]);

  // Calculate rotation needed to face Qibla
  const qiblaRotation = useMemo(() => {
    return calculateQiblaRotation(compass.heading, qiblaDirection);
  }, [compass.heading, qiblaDirection]);

  // Check if facing Qibla
  const facingQibla = useMemo(() => {
    return isFacingQibla(compass.heading, qiblaDirection, qiblaThreshold);
  }, [compass.heading, qiblaDirection, qiblaThreshold]);

  // Get cardinal directions
  const qiblaCardinal = useMemo(() => {
    return getSimpleCompassDirection(qiblaDirection);
  }, [qiblaDirection]);

  const facingCardinal = useMemo(() => {
    return getSimpleCompassDirection(compass.heading);
  }, [compass.heading]);

  // Combined loading state
  const isLoading = locationLoading || compassLoading;

  // Combined error state
  const error = useMemo(() => {
    if (locationError.type) {
      return locationError;
    }
    if (compassError.type) {
      return compassError;
    }
    return { type: null, message: null };
  }, [locationError, compassError]);

  /**
   * Reinitialize everything
   */
  const reinitialize = useCallback(async () => {
    stopCompass();
    await refreshLocation();
    startCompass();
  }, [stopCompass, refreshLocation, startCompass]);

  /**
   * Start compass updates
   */
  const start = useCallback(() => {
    startCompass();
  }, [startCompass]);

  /**
   * Stop compass updates
   */
  const stop = useCallback(() => {
    stopCompass();
  }, [stopCompass]);

  // Auto-complete calibration when accuracy improves
  useEffect(() => {
    if (
      calibration.status === CalibrationStatus.IN_PROGRESS &&
      compass.accuracy >= CompassAccuracy.MEDIUM &&
      !needsCalibration
    ) {
      completeCalibration();
    }
  }, [compass.accuracy, needsCalibration, calibration.status, completeCalibration]);

  return {
    qiblaDirection,
    compassHeading: compass.heading,
    qiblaRotation,
    qiblaCardinal,
    facingCardinal,
    isFacingQibla: facingQibla,
    degreesOffQibla: Math.abs(qiblaRotation),
    compass,
    location,
    calibration,
    isLoading,
    error,
    reinitialize,
    start,
    stop,
  };
};
