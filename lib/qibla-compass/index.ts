/**
 * React Native Qibla Compass Library
 * A robust, production-ready Qibla direction finder
 * 
 * Features:
 * - Accurate Qibla calculation using spherical geometry
 * - Sensor fusion (magnetometer + accelerometer) for stable readings
 * - Automatic calibration detection and guidance
 * - Low-pass filtering for smooth compass movement
 * - Cross-platform support (iOS & Android)
 * - Comprehensive error handling
 * - Battery-efficient sensor management
 * 
 * @author Your Name
 * @license MIT
 */

export { useQiblaCompass } from './hooks/useQiblaCompass';
export { useCompass } from './hooks/useCompass';
export { useLocation } from './hooks/useLocation';
export { useCalibration } from './hooks/useCalibration';

export { QiblaCompass } from './components/QiblaCompass';
export { CompassRose } from './components/CompassRose';
export { CalibrationGuide } from './components/CalibrationGuide';

export {
  calculateQiblaDirection,
  calculateDistance,
  getCompassDirection,
  normalizeAngle,
  getDirectionName,
} from './utils/qiblaCalculations';

export {
  CompassAccuracy,
  CalibrationStatus,
  LocationAccuracy,
} from './types';

export type {
  QiblaCompassResult,
  CompassData,
  LocationData,
  CalibrationData,
  QiblaCompassConfig,
} from './types';
