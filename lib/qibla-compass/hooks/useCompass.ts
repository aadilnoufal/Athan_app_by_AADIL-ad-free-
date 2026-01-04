/**
 * useCompass Hook
 * 
 * Manages compass/magnetometer sensor data with sensor fusion,
 * low-pass filtering, and calibration detection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { Magnetometer, Accelerometer } from 'expo-sensors';
import { CompassData, CompassAccuracy, QiblaError } from '../types';
import {
  lowPassFilter,
  lowPassFilter3D,
  calculateTiltCompensatedHeading,
  calculateSimpleHeading,
  calculateTiltAngle,
  isDeviceFlat,
  estimateCompassAccuracy,
  getMagneticFieldStrength,
  isCalibrationNeeded,
  weightedMovingAverage,
} from '../utils/sensorFusion';

interface UseCompassOptions {
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Low-pass filter coefficient (0-1) */
  filterCoefficient?: number;
  /** Whether to use tilt compensation */
  useTiltCompensation?: boolean;
  /** Auto-start compass */
  autoStart?: boolean;
}

interface UseCompassResult {
  /** Current compass data */
  compass: CompassData;
  /** Whether compass is available */
  isAvailable: boolean;
  /** Whether compass is loading */
  isLoading: boolean;
  /** Error information */
  error: { type: QiblaError | null; message: string | null };
  /** Start compass updates */
  start: () => void;
  /** Stop compass updates */
  stop: () => void;
  /** Whether calibration is needed */
  needsCalibration: boolean;
}

const DEFAULT_COMPASS_DATA: CompassData = {
  heading: 0,
  accuracy: CompassAccuracy.UNRELIABLE,
  magnetometer: { x: 0, y: 0, z: 0 },
  accelerometer: { x: 0, y: 0, z: 9.8 },
  magneticFieldStrength: 0,
  isDeviceFlat: true,
  tiltAngle: 0,
  timestamp: 0,
};

export const useCompass = (options: UseCompassOptions = {}): UseCompassResult => {
  const {
    updateInterval = 50,
    filterCoefficient = 0.4,
    useTiltCompensation = true,
    autoStart = true,
  } = options;

  const [compass, setCompass] = useState<CompassData>(DEFAULT_COMPASS_DATA);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [error, setError] = useState<{ type: QiblaError | null; message: string | null }>({
    type: null,
    message: null,
  });

  const magnetometerSubscription = useRef<any>(null);
  const accelerometerSubscription = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isRunningRef = useRef(false);

  // Sensor data refs for fusion
  const magnetometerDataRef = useRef({ x: 0, y: 0, z: 0 });
  const accelerometerDataRef = useRef({ x: 0, y: 0, z: 9.8 });
  const filteredMagRef = useRef({ x: 0, y: 0, z: 0 });
  const filteredAccRef = useRef({ x: 0, y: 0, z: 9.8 });
  const filteredHeadingRef = useRef(0);
  const headingHistoryRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(0);

  /**
   * Process sensor data and calculate heading
   */
  const processSensorData = useCallback(() => {
    const now = Date.now();
    
    // Throttle updates based on interval
    if (now - lastUpdateRef.current < updateInterval) {
      return;
    }
    lastUpdateRef.current = now;

    const rawMag = magnetometerDataRef.current;
    const rawAcc = accelerometerDataRef.current;

    // Apply low-pass filter to sensor data
    filteredMagRef.current = lowPassFilter3D(
      filteredMagRef.current,
      rawMag,
      filterCoefficient
    );
    filteredAccRef.current = lowPassFilter3D(
      filteredAccRef.current,
      rawAcc,
      filterCoefficient
    );

    const filteredMag = filteredMagRef.current;
    const filteredAcc = filteredAccRef.current;

    // Calculate heading
    let heading: number;
    const deviceFlat = isDeviceFlat(filteredAcc, 35);

    if (useTiltCompensation && !deviceFlat) {
      // Use tilt-compensated algorithm when device is tilted
      heading = calculateTiltCompensatedHeading(filteredMag, filteredAcc);
    } else {
      // Use simple algorithm when device is flat
      heading = calculateSimpleHeading(filteredMag);
    }

    // Apply lighter smoothing to heading for faster response
    filteredHeadingRef.current = lowPassFilter(
      filteredHeadingRef.current,
      heading,
      filterCoefficient * 0.8
    );

    // Track heading history for calibration detection
    headingHistoryRef.current.push(heading);
    if (headingHistoryRef.current.length > 20) {
      headingHistoryRef.current.shift();
    }

    // Check if calibration is needed
    const calibrationNeeded = isCalibrationNeeded(headingHistoryRef.current, 15);
    if (isMountedRef.current) {
      setNeedsCalibration(calibrationNeeded);
    }

    // Calculate other values
    const accuracy = estimateCompassAccuracy(filteredMag);
    const fieldStrength = getMagneticFieldStrength(filteredMag);
    const tiltAngle = calculateTiltAngle(filteredAcc);

    // Use filtered heading directly for faster response
    let finalHeading = filteredHeadingRef.current;

    // Ensure heading is in 0-360 range
    finalHeading = ((finalHeading % 360) + 360) % 360;

    const compassData: CompassData = {
      heading: finalHeading,
      accuracy: calibrationNeeded ? CompassAccuracy.UNRELIABLE : accuracy,
      magnetometer: filteredMag,
      accelerometer: filteredAcc,
      magneticFieldStrength: fieldStrength,
      isDeviceFlat: deviceFlat,
      tiltAngle,
      timestamp: now,
    };

    if (isMountedRef.current) {
      setCompass(compassData);
      setIsLoading(false);
    }
  }, [updateInterval, filterCoefficient, useTiltCompensation]);

  /**
   * Start compass sensors
   */
  const start = useCallback(async () => {
    if (isRunningRef.current) return;

    try {
      setIsLoading(true);
      setError({ type: null, message: null });

      // Check magnetometer availability
      const magAvailable = await Magnetometer.isAvailableAsync();
      if (!magAvailable) {
        if (isMountedRef.current) {
          setIsAvailable(false);
          setIsLoading(false);
          setError({
            type: QiblaError.MAGNETOMETER_UNAVAILABLE,
            message: 'Magnetometer is not available on this device',
          });
        }
        return;
      }

      // Check accelerometer availability
      const accAvailable = await Accelerometer.isAvailableAsync();
      if (!accAvailable && useTiltCompensation) {
        console.warn('Accelerometer not available, tilt compensation disabled');
      }

      if (isMountedRef.current) {
        setIsAvailable(true);
      }

      // Set update intervals
      Magnetometer.setUpdateInterval(updateInterval);
      if (accAvailable) {
        Accelerometer.setUpdateInterval(updateInterval);
      }

      // Subscribe to magnetometer
      magnetometerSubscription.current = Magnetometer.addListener((data) => {
        magnetometerDataRef.current = data;
        processSensorData();
      });

      // Subscribe to accelerometer if available
      if (accAvailable) {
        accelerometerSubscription.current = Accelerometer.addListener((data) => {
          accelerometerDataRef.current = data;
        });
      }

      isRunningRef.current = true;

    } catch (err) {
      if (isMountedRef.current) {
        setIsLoading(false);
        setError({
          type: QiblaError.SENSOR_ERROR,
          message: err instanceof Error ? err.message : 'Failed to start compass',
        });
      }
    }
  }, [updateInterval, useTiltCompensation, processSensorData]);

  /**
   * Stop compass sensors
   */
  const stop = useCallback(() => {
    isRunningRef.current = false;

    if (magnetometerSubscription.current) {
      magnetometerSubscription.current.remove();
      magnetometerSubscription.current = null;
    }

    if (accelerometerSubscription.current) {
      accelerometerSubscription.current.remove();
      accelerometerSubscription.current = null;
    }
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      isMountedRef.current = false;
      stop();
    };
  }, [autoStart, start, stop]);

  return {
    compass,
    isAvailable,
    isLoading,
    error,
    start,
    stop,
    needsCalibration,
  };
};
