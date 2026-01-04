/**
 * Sensor Fusion Utilities
 * 
 * Implements sensor fusion algorithms to combine magnetometer and
 * accelerometer data for accurate compass heading calculations.
 * 
 * This module uses:
 * - Tilt compensation to correct for device orientation
 * - Low-pass filtering for smooth readings
 * - Magnetic field strength analysis for calibration detection
 */

import { CompassAccuracy } from '../types';

/**
 * Low-pass filter for smoothing sensor data
 * 
 * @param previousValue Previous filtered value
 * @param newValue New raw value
 * @param coefficient Filter coefficient (0-1, higher = smoother)
 * @returns Filtered value
 */
export const lowPassFilter = (
  previousValue: number,
  newValue: number,
  coefficient: number = 0.2
): number => {
  // Handle angle wrapping for compass headings
  let diff = newValue - previousValue;
  
  // Normalize difference to -180 to 180
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  
  return previousValue + coefficient * diff;
};

/**
 * Vector low-pass filter for 3D sensor data
 */
export const lowPassFilter3D = (
  previous: { x: number; y: number; z: number },
  current: { x: number; y: number; z: number },
  coefficient: number = 0.2
): { x: number; y: number; z: number } => {
  return {
    x: previous.x + coefficient * (current.x - previous.x),
    y: previous.y + coefficient * (current.y - previous.y),
    z: previous.z + coefficient * (current.z - previous.z),
  };
};

/**
 * Calculates the magnitude of a 3D vector
 */
export const vectorMagnitude = (v: { x: number; y: number; z: number }): number => {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
};

/**
 * Normalizes a 3D vector
 */
export const normalizeVector = (
  v: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => {
  const mag = vectorMagnitude(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / mag,
    y: v.y / mag,
    z: v.z / mag,
  };
};

/**
 * Cross product of two 3D vectors
 */
export const crossProduct = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
};

/**
 * Dot product of two 3D vectors
 */
export const dotProduct = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number => {
  return a.x * b.x + a.y * b.y + a.z * b.z;
};

/**
 * Calculates compass heading using tilt-compensated algorithm
 * 
 * This algorithm compensates for device tilt using accelerometer data
 * to provide accurate compass readings when the device is not flat.
 * 
 * @param magnetometer Magnetometer reading (in microteslas)
 * @param accelerometer Accelerometer reading (in m/s²)
 * @returns Compass heading in degrees (0-360)
 */
export const calculateTiltCompensatedHeading = (
  magnetometer: { x: number; y: number; z: number },
  accelerometer: { x: number; y: number; z: number }
): number => {
  // Normalize accelerometer to get gravity direction
  const gravity = normalizeVector(accelerometer);
  
  // Calculate pitch and roll from accelerometer
  const pitch = Math.asin(-gravity.x);
  const roll = Math.atan2(gravity.y, gravity.z);
  
  // Tilt-compensated magnetic field components
  const magX = magnetometer.x;
  const magY = magnetometer.y;
  const magZ = magnetometer.z;
  
  // Apply tilt compensation
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);
  
  // Tilt-compensated X and Y components
  const xH = magX * cosPitch + magY * sinRoll * sinPitch + magZ * cosRoll * sinPitch;
  const yH = magY * cosRoll - magZ * sinRoll;
  
  // Calculate heading - negate both to fix opposite direction issue
  let heading = Math.atan2(yH, -xH) * (180 / Math.PI);
  
  // Convert to compass bearing (0 = North)
  heading = heading + 90;
  
  // Normalize to 0-360
  heading = ((heading % 360) + 360) % 360;
  
  return heading;
};

/**
 * Simple heading calculation for when device is flat
 * 
 * @param magnetometer Magnetometer reading
 * @returns Heading in degrees (0-360)
 */
export const calculateSimpleHeading = (
  magnetometer: { x: number; y: number; z: number }
): number => {
  // Calculate angle from magnetometer X and Y
  // Note: On Android, the coordinate system may differ
  let heading = Math.atan2(-magnetometer.y, -magnetometer.x) * (180 / Math.PI);
  
  // Convert to compass heading (0 = North, 90 = East, etc.)
  heading = heading + 90;
  
  // Normalize to 0-360
  heading = ((heading % 360) + 360) % 360;
  
  return heading;
};

/**
 * Calculates device tilt angle from accelerometer
 * 
 * @param accelerometer Accelerometer reading
 * @returns Tilt angle in degrees (0 = flat, 90 = upright)
 */
export const calculateTiltAngle = (
  accelerometer: { x: number; y: number; z: number }
): number => {
  const magnitude = vectorMagnitude(accelerometer);
  if (magnitude === 0) return 0;
  
  // Calculate angle from vertical (z-axis for flat device)
  const zNormalized = Math.abs(accelerometer.z) / magnitude;
  const tiltAngle = Math.acos(zNormalized) * (180 / Math.PI);
  
  return tiltAngle;
};

/**
 * Checks if device is approximately flat
 * 
 * @param accelerometer Accelerometer reading
 * @param threshold Maximum tilt angle in degrees (default: 30)
 * @returns Whether device is flat
 */
export const isDeviceFlat = (
  accelerometer: { x: number; y: number; z: number },
  threshold: number = 30
): boolean => {
  return calculateTiltAngle(accelerometer) < threshold;
};

/**
 * Estimates compass accuracy based on magnetic field strength
 * 
 * Normal Earth's magnetic field is 25-65 microteslas.
 * Values outside this range indicate interference.
 * 
 * @param magnetometer Magnetometer reading
 * @returns Compass accuracy level
 */
export const estimateCompassAccuracy = (
  magnetometer: { x: number; y: number; z: number }
): CompassAccuracy => {
  const fieldStrength = vectorMagnitude(magnetometer);
  
  // Earth's magnetic field typically ranges from 25-65 µT
  if (fieldStrength < 10 || fieldStrength > 100) {
    return CompassAccuracy.UNRELIABLE;
  }
  
  if (fieldStrength < 20 || fieldStrength > 80) {
    return CompassAccuracy.LOW;
  }
  
  if (fieldStrength < 25 || fieldStrength > 65) {
    return CompassAccuracy.MEDIUM;
  }
  
  return CompassAccuracy.HIGH;
};

/**
 * Calculates magnetic field strength
 * 
 * @param magnetometer Magnetometer reading
 * @returns Field strength in microteslas
 */
export const getMagneticFieldStrength = (
  magnetometer: { x: number; y: number; z: number }
): number => {
  return vectorMagnitude(magnetometer);
};

/**
 * Detects if compass calibration is needed based on reading stability
 * 
 * @param readings Array of recent heading readings
 * @param threshold Maximum acceptable variance (default: 10)
 * @returns Whether calibration is needed
 */
export const isCalibrationNeeded = (
  readings: number[],
  threshold: number = 10
): boolean => {
  if (readings.length < 5) return false;
  
  const recentReadings = readings.slice(-10);
  
  // Calculate variance in readings
  let sumDiff = 0;
  for (let i = 1; i < recentReadings.length; i++) {
    let diff = Math.abs(recentReadings[i] - recentReadings[i - 1]);
    // Handle angle wrapping
    if (diff > 180) diff = 360 - diff;
    sumDiff += diff;
  }
  
  const avgDiff = sumDiff / (recentReadings.length - 1);
  
  // If readings are jumping around too much, calibration is needed
  return avgDiff > threshold;
};

/**
 * Smooths heading using a weighted moving average
 * 
 * @param readings Array of recent readings (newest last)
 * @param weights Weights for each reading (must match readings length)
 * @returns Smoothed heading
 */
export const weightedMovingAverage = (
  readings: number[],
  weights?: number[]
): number => {
  if (readings.length === 0) return 0;
  if (readings.length === 1) return readings[0];
  
  // Default to exponential weights if not provided
  const w = weights || readings.map((_, i) => Math.pow(2, i));
  const totalWeight = w.reduce((a, b) => a + b, 0);
  
  // Convert to unit vectors to handle angle wrapping
  let sumX = 0;
  let sumY = 0;
  
  readings.forEach((heading, i) => {
    const rad = heading * (Math.PI / 180);
    const weight = w[i] / totalWeight;
    sumX += Math.cos(rad) * weight;
    sumY += Math.sin(rad) * weight;
  });
  
  let avgHeading = Math.atan2(sumY, sumX) * (180 / Math.PI);
  if (avgHeading < 0) avgHeading += 360;
  
  return avgHeading;
};
