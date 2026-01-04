/**
 * useCalibration Hook
 * 
 * Manages compass calibration state and provides calibration guidance.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CalibrationData, CalibrationStatus, CompassAccuracy } from '../types';

interface UseCalibrationOptions {
  /** Compass accuracy level */
  compassAccuracy: CompassAccuracy;
  /** Whether compass needs calibration based on sensor data */
  needsCalibration: boolean;
  /** Whether to show calibration warnings */
  showWarnings?: boolean;
}

interface UseCalibrationResult {
  /** Calibration data */
  calibration: CalibrationData;
  /** Start calibration process */
  startCalibration: () => void;
  /** Mark calibration as complete */
  completeCalibration: () => void;
  /** Dismiss calibration warning */
  dismissWarning: () => void;
}

const CALIBRATION_INSTRUCTIONS = {
  default: 'Move your phone in a figure-8 pattern to calibrate the compass',
  tilt: 'Tilt and rotate your phone in all directions',
  interference: 'Move away from metal objects and electronic devices',
  complete: 'Calibration complete! The compass is now accurate',
};

export const useCalibration = (options: UseCalibrationOptions): UseCalibrationResult => {
  const { compassAccuracy, needsCalibration, showWarnings = true } = options;

  const [calibration, setCalibration] = useState<CalibrationData>({
    status: CalibrationStatus.UNKNOWN,
    quality: 0,
    isCalibrationRecommended: false,
    instruction: '',
    progress: 0,
  });

  const calibrationStartTimeRef = useRef<number | null>(null);
  const dismissedRef = useRef(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calculate calibration quality from accuracy
   */
  const calculateQuality = useCallback((accuracy: CompassAccuracy): number => {
    switch (accuracy) {
      case CompassAccuracy.HIGH:
        return 100;
      case CompassAccuracy.MEDIUM:
        return 70;
      case CompassAccuracy.LOW:
        return 40;
      case CompassAccuracy.UNRELIABLE:
      default:
        return 10;
    }
  }, []);

  /**
   * Get appropriate instruction based on state
   */
  const getInstruction = useCallback((accuracy: CompassAccuracy, inProgress: boolean): string => {
    if (inProgress) {
      return CALIBRATION_INSTRUCTIONS.tilt;
    }

    if (accuracy === CompassAccuracy.UNRELIABLE) {
      return CALIBRATION_INSTRUCTIONS.interference;
    }

    if (accuracy === CompassAccuracy.HIGH) {
      return CALIBRATION_INSTRUCTIONS.complete;
    }

    return CALIBRATION_INSTRUCTIONS.default;
  }, []);

  /**
   * Start calibration process
   */
  const startCalibration = useCallback(() => {
    calibrationStartTimeRef.current = Date.now();
    dismissedRef.current = false;

    setCalibration(prev => ({
      ...prev,
      status: CalibrationStatus.IN_PROGRESS,
      instruction: CALIBRATION_INSTRUCTIONS.tilt,
      progress: 0,
    }));

    // Simulate calibration progress
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      setCalibration(prev => {
        const newProgress = Math.min(prev.progress + 5, 100);
        
        if (newProgress >= 100) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          return {
            ...prev,
            status: CalibrationStatus.CALIBRATED,
            progress: 100,
            instruction: CALIBRATION_INSTRUCTIONS.complete,
          };
        }

        return {
          ...prev,
          progress: newProgress,
        };
      });
    }, 200);
  }, []);

  /**
   * Mark calibration as complete
   */
  const completeCalibration = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    calibrationStartTimeRef.current = null;

    setCalibration(prev => ({
      ...prev,
      status: CalibrationStatus.CALIBRATED,
      progress: 100,
      instruction: CALIBRATION_INSTRUCTIONS.complete,
    }));
  }, []);

  /**
   * Dismiss calibration warning
   */
  const dismissWarning = useCallback(() => {
    dismissedRef.current = true;
    setCalibration(prev => ({
      ...prev,
      isCalibrationRecommended: false,
    }));
  }, []);

  // Update calibration state based on compass accuracy
  useEffect(() => {
    // Don't update if in progress or dismissed
    if (calibration.status === CalibrationStatus.IN_PROGRESS) {
      return;
    }

    const quality = calculateQuality(compassAccuracy);
    const shouldRecommend = showWarnings && 
                           !dismissedRef.current && 
                           (needsCalibration || compassAccuracy <= CompassAccuracy.LOW);

    let status: CalibrationStatus;
    if (compassAccuracy === CompassAccuracy.HIGH && !needsCalibration) {
      status = CalibrationStatus.CALIBRATED;
    } else if (needsCalibration || compassAccuracy === CompassAccuracy.UNRELIABLE) {
      status = CalibrationStatus.NEEDED;
    } else {
      status = CalibrationStatus.UNKNOWN;
    }

    setCalibration({
      status,
      quality,
      isCalibrationRecommended: shouldRecommend,
      instruction: getInstruction(compassAccuracy, false),
      progress: status === CalibrationStatus.CALIBRATED ? 100 : 0,
    });
  }, [compassAccuracy, needsCalibration, showWarnings, calculateQuality, getInstruction, calibration.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return {
    calibration,
    startCalibration,
    completeCalibration,
    dismissWarning,
  };
};
