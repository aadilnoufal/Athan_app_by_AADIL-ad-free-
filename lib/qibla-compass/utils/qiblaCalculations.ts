/**
 * Qibla Direction Calculations
 * 
 * This module provides accurate Qibla direction calculations using
 * spherical trigonometry. The formulas are based on the great circle
 * path between the user's location and the Kaaba.
 */

import { KAABA_COORDINATES } from '../types';

/**
 * Converts degrees to radians
 */
export const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Converts radians to degrees
 */
export const toDegrees = (radians: number): number => {
  return radians * (180 / Math.PI);
};

/**
 * Normalizes an angle to 0-360 range
 */
export const normalizeAngle = (angle: number): number => {
  let normalized = angle % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
};

/**
 * Normalizes an angle to -180 to 180 range
 */
export const normalizeAngleSigned = (angle: number): number => {
  let normalized = normalizeAngle(angle);
  if (normalized > 180) {
    normalized -= 360;
  }
  return normalized;
};

/**
 * Calculates the Qibla direction from a given location
 * 
 * Uses the forward azimuth formula for great-circle navigation:
 * θ = atan2(sin(Δλ) × cos(φ2), cos(φ1) × sin(φ2) − sin(φ1) × cos(φ2) × cos(Δλ))
 * 
 * Where:
 * - φ1, λ1 = user's latitude and longitude
 * - φ2, λ2 = Kaaba's latitude and longitude (21.4225°N, 39.8262°E)
 * - Δλ = difference in longitude
 * 
 * @param latitude User's latitude in degrees
 * @param longitude User's longitude in degrees
 * @returns Qibla direction in degrees from true North (0-360)
 */
export const calculateQiblaDirection = (
  latitude: number,
  longitude: number
): number => {
  // Convert to radians
  const φ1 = toRadians(latitude);
  const φ2 = toRadians(KAABA_COORDINATES.latitude);
  const Δλ = toRadians(KAABA_COORDINATES.longitude - longitude);

  // Calculate forward azimuth
  const x = Math.sin(Δλ) * Math.cos(φ2);
  const y = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  const θ = Math.atan2(x, y);
  
  // Convert to degrees and normalize to 0-360
  return normalizeAngle(toDegrees(θ));
};

/**
 * Calculates the distance to the Kaaba using the Haversine formula
 * 
 * @param latitude User's latitude in degrees
 * @param longitude User's longitude in degrees
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  latitude: number,
  longitude: number
): number => {
  const R = 6371; // Earth's radius in kilometers

  const φ1 = toRadians(latitude);
  const φ2 = toRadians(KAABA_COORDINATES.latitude);
  const Δφ = toRadians(KAABA_COORDINATES.latitude - latitude);
  const Δλ = toRadians(KAABA_COORDINATES.longitude - longitude);

  const a = 
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Gets the cardinal direction for a given angle
 * 
 * @param degrees Angle in degrees (0-360)
 * @returns Cardinal direction string
 */
export const getCompassDirection = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(normalizeAngle(degrees) / 22.5) % 16;
  return directions[index];
};

/**
 * Gets the simple cardinal direction (8 directions)
 * 
 * @param degrees Angle in degrees (0-360)
 * @returns Simple cardinal direction string
 */
export const getSimpleCompassDirection = (degrees: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalizeAngle(degrees) / 45) % 8;
  return directions[index];
};

/**
 * Gets the full direction name
 * 
 * @param direction Cardinal direction abbreviation
 * @returns Full direction name
 */
export const getDirectionName = (direction: string): string => {
  const names: Record<string, string> = {
    'N': 'North',
    'NNE': 'North-Northeast',
    'NE': 'Northeast',
    'ENE': 'East-Northeast',
    'E': 'East',
    'ESE': 'East-Southeast',
    'SE': 'Southeast',
    'SSE': 'South-Southeast',
    'S': 'South',
    'SSW': 'South-Southwest',
    'SW': 'Southwest',
    'WSW': 'West-Southwest',
    'W': 'West',
    'WNW': 'West-Northwest',
    'NW': 'Northwest',
    'NNW': 'North-Northwest',
  };
  return names[direction] || direction;
};

/**
 * Calculates the shortest rotation angle to face Qibla
 * 
 * @param currentHeading Current compass heading (0-360)
 * @param qiblaDirection Qibla direction (0-360)
 * @returns Rotation needed (-180 to 180, positive = clockwise)
 */
export const calculateQiblaRotation = (
  currentHeading: number,
  qiblaDirection: number
): number => {
  const diff = qiblaDirection - currentHeading;
  return normalizeAngleSigned(diff);
};

/**
 * Checks if currently facing Qibla within threshold
 * 
 * @param currentHeading Current compass heading
 * @param qiblaDirection Qibla direction
 * @param threshold Threshold in degrees (default: 5)
 * @returns Whether facing Qibla
 */
export const isFacingQibla = (
  currentHeading: number,
  qiblaDirection: number,
  threshold: number = 5
): boolean => {
  const rotation = Math.abs(calculateQiblaRotation(currentHeading, qiblaDirection));
  return rotation <= threshold;
};

/**
 * Magnetic declination estimation
 * This is a simplified model. For production, consider using a proper
 * World Magnetic Model (WMM) implementation.
 * 
 * @param latitude Latitude in degrees
 * @param longitude Longitude in degrees
 * @returns Estimated magnetic declination in degrees
 */
export const estimateMagneticDeclination = (
  latitude: number,
  longitude: number
): number => {
  // Simplified declination model
  // For accurate results, use NOAA's World Magnetic Model
  // This is a rough approximation for demonstration
  
  // Base declination varies by location
  // This simplified model assumes roughly:
  // - Eastern hemisphere: slight positive declination
  // - Western hemisphere: varies significantly
  
  let declination = 0;
  
  // Very rough approximation based on longitude
  if (longitude > 0) {
    // Eastern hemisphere - generally small positive declination
    declination = (longitude / 180) * 10;
  } else {
    // Western hemisphere - can vary widely
    declination = (longitude / 180) * 20;
  }
  
  // Latitude adjustment
  declination += (latitude / 90) * 5;
  
  // Clamp to reasonable range
  return Math.max(-30, Math.min(30, declination));
};
