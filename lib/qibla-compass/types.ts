/**
 * Type definitions for the Qibla Compass Library
 */

// Compass accuracy levels
export enum CompassAccuracy {
  /** Compass is unreliable, needs calibration */
  UNRELIABLE = 0,
  /** Low accuracy, calibration recommended */
  LOW = 1,
  /** Medium accuracy, acceptable for general use */
  MEDIUM = 2,
  /** High accuracy, optimal for Qibla direction */
  HIGH = 3,
}

// Calibration status
export enum CalibrationStatus {
  /** Unknown calibration state */
  UNKNOWN = 'unknown',
  /** Calibration is needed */
  NEEDED = 'needed',
  /** Currently calibrating */
  IN_PROGRESS = 'in_progress',
  /** Calibration complete */
  CALIBRATED = 'calibrated',
}

// Location accuracy levels
export enum LocationAccuracy {
  /** Location unavailable */
  UNAVAILABLE = 0,
  /** Low accuracy (WiFi/Cell) */
  LOW = 1,
  /** Medium accuracy */
  MEDIUM = 2,
  /** High accuracy (GPS) */
  HIGH = 3,
}

// Error types
export enum QiblaError {
  LOCATION_PERMISSION_DENIED = 'LOCATION_PERMISSION_DENIED',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  MAGNETOMETER_UNAVAILABLE = 'MAGNETOMETER_UNAVAILABLE',
  ACCELEROMETER_UNAVAILABLE = 'ACCELEROMETER_UNAVAILABLE',
  CALIBRATION_NEEDED = 'CALIBRATION_NEEDED',
  SENSOR_ERROR = 'SENSOR_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Compass data from sensors
export interface CompassData {
  /** Current heading in degrees (0-360, 0 = North) */
  heading: number;
  /** Compass accuracy level */
  accuracy: CompassAccuracy;
  /** Raw magnetometer data */
  magnetometer: {
    x: number;
    y: number;
    z: number;
  };
  /** Raw accelerometer data */
  accelerometer: {
    x: number;
    y: number;
    z: number;
  };
  /** Magnetic field strength in microteslas */
  magneticFieldStrength: number;
  /** Whether the device is flat (good for compass reading) */
  isDeviceFlat: boolean;
  /** Device tilt angle in degrees */
  tiltAngle: number;
  /** Timestamp of the reading */
  timestamp: number;
}

// Location data
export interface LocationData {
  /** Latitude in degrees */
  latitude: number;
  /** Longitude in degrees */
  longitude: number;
  /** Accuracy in meters */
  accuracy: number;
  /** Altitude in meters (if available) */
  altitude: number | null;
  /** Location accuracy level */
  accuracyLevel: LocationAccuracy;
  /** Distance to Kaaba in kilometers */
  distanceToKaaba: number;
  /** Timestamp of the location fix */
  timestamp: number;
}

// Calibration data
export interface CalibrationData {
  /** Current calibration status */
  status: CalibrationStatus;
  /** Calibration quality (0-100) */
  quality: number;
  /** Whether calibration is recommended */
  isCalibrationRecommended: boolean;
  /** Calibration instruction text */
  instruction: string;
  /** Progress of current calibration (0-100) */
  progress: number;
}

// Main Qibla compass result
export interface QiblaCompassResult {
  /** Qibla direction in degrees from North (0-360) */
  qiblaDirection: number;
  /** Current compass heading in degrees (0-360, 0 = North) */
  compassHeading: number;
  /** Rotation needed to face Qibla (-180 to 180) */
  qiblaRotation: number;
  /** Cardinal direction of Qibla (N, NE, E, SE, S, SW, W, NW) */
  qiblaCardinal: string;
  /** Current facing cardinal direction */
  facingCardinal: string;
  /** Whether currently facing Qibla (within threshold) */
  isFacingQibla: boolean;
  /** Degrees off from Qibla direction */
  degreesOffQibla: number;
  /** Compass data */
  compass: CompassData;
  /** Location data */
  location: LocationData | null;
  /** Calibration data */
  calibration: CalibrationData;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Error information */
  error: {
    type: QiblaError | null;
    message: string | null;
  };
  /** Reinitialize the compass */
  reinitialize: () => Promise<void>;
  /** Start compass updates */
  start: () => void;
  /** Stop compass updates */
  stop: () => void;
}

// Configuration options
export interface QiblaCompassConfig {
  /** Update interval in milliseconds (default: 100) */
  updateInterval?: number;
  /** Low-pass filter coefficient (0-1, higher = smoother, default: 0.2) */
  filterCoefficient?: number;
  /** Threshold in degrees to consider "facing Qibla" (default: 5) */
  qiblaThreshold?: number;
  /** Whether to use sensor fusion (default: true) */
  useSensorFusion?: boolean;
  /** Whether to auto-start compass (default: true) */
  autoStart?: boolean;
  /** Location update interval in milliseconds (default: 10000) */
  locationUpdateInterval?: number;
  /** Whether to show calibration warnings (default: true) */
  showCalibrationWarnings?: boolean;
}

// Kaaba coordinates
export const KAABA_COORDINATES = {
  latitude: 21.4225,
  longitude: 39.8262,
} as const;

// Default configuration
export const DEFAULT_CONFIG: Required<QiblaCompassConfig> = {
  updateInterval: 100,
  filterCoefficient: 0.2,
  qiblaThreshold: 5,
  useSensorFusion: true,
  autoStart: true,
  locationUpdateInterval: 10000,
  showCalibrationWarnings: true,
};
