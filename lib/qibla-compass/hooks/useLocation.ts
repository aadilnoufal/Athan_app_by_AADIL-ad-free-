/**
 * useLocation Hook
 * 
 * Manages location services for Qibla direction calculation.
 * Handles permissions, caching, and error recovery.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { LocationData, LocationAccuracy, QiblaError } from '../types';
import { calculateDistance } from '../utils/qiblaCalculations';

interface UseLocationOptions {
  /** Auto-start location updates */
  autoStart?: boolean;
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Desired accuracy level */
  desiredAccuracy?: Location.Accuracy;
  /** Cache duration in milliseconds */
  cacheDuration?: number;
}

interface UseLocationResult {
  /** Current location data */
  location: LocationData | null;
  /** Whether location is loading */
  isLoading: boolean;
  /** Error information */
  error: { type: QiblaError | null; message: string | null };
  /** Refresh location */
  refresh: () => Promise<void>;
  /** Request permissions */
  requestPermission: () => Promise<boolean>;
  /** Check if permission granted */
  hasPermission: boolean;
}

// Location cache
let cachedLocation: LocationData | null = null;
let cacheTimestamp: number = 0;

export const useLocation = (options: UseLocationOptions = {}): UseLocationResult => {
  const {
    autoStart = true,
    updateInterval = 10000,
    desiredAccuracy = Location.Accuracy.High,
    cacheDuration = 60000, // 1 minute cache
  } = options;

  const [location, setLocation] = useState<LocationData | null>(cachedLocation);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<{ type: QiblaError | null; message: string | null }>({
    type: null,
    message: null,
  });

  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Convert accuracy in meters to accuracy level
   */
  const getAccuracyLevel = useCallback((accuracyMeters: number): LocationAccuracy => {
    if (accuracyMeters <= 10) return LocationAccuracy.HIGH;
    if (accuracyMeters <= 50) return LocationAccuracy.MEDIUM;
    if (accuracyMeters <= 500) return LocationAccuracy.LOW;
    return LocationAccuracy.UNAVAILABLE;
  }, []);

  /**
   * Request location permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus === 'granted') {
        if (isMountedRef.current) {
          setHasPermission(true);
          setError({ type: null, message: null });
        }
        return true;
      }
      
      if (isMountedRef.current) {
        setHasPermission(false);
        setError({
          type: QiblaError.LOCATION_PERMISSION_DENIED,
          message: 'Location permission is required to find Qibla direction',
        });
      }
      return false;
    } catch (err) {
      if (isMountedRef.current) {
        setError({
          type: QiblaError.LOCATION_UNAVAILABLE,
          message: 'Failed to request location permission',
        });
      }
      return false;
    }
  }, []);

  /**
   * Get current location
   */
  const getLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      // Check cache first
      const now = Date.now();
      if (cachedLocation && (now - cacheTimestamp) < cacheDuration) {
        return cachedLocation;
      }

      setIsLoading(true);

      // Check permission first
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setIsLoading(false);
          return null;
        }
      }

      // Get location with timeout
      const locationResult = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: desiredAccuracy,
        }),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Location timeout')), 15000)
        ),
      ]);

      if (!locationResult || !isMountedRef.current) {
        setIsLoading(false);
        return null;
      }

      const { latitude, longitude, accuracy, altitude } = locationResult.coords;

      const locationData: LocationData = {
        latitude,
        longitude,
        accuracy: accuracy || 0,
        altitude: altitude || null,
        accuracyLevel: getAccuracyLevel(accuracy || 0),
        distanceToKaaba: calculateDistance(latitude, longitude),
        timestamp: Date.now(),
      };

      // Update cache
      cachedLocation = locationData;
      cacheTimestamp = Date.now();

      if (isMountedRef.current) {
        setLocation(locationData);
        setError({ type: null, message: null });
        setIsLoading(false);
      }

      return locationData;
    } catch (err) {
      if (isMountedRef.current) {
        setIsLoading(false);
        
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        if (errorMessage.includes('timeout')) {
          setError({
            type: QiblaError.LOCATION_UNAVAILABLE,
            message: 'Location request timed out. Please ensure GPS is enabled.',
          });
        } else {
          setError({
            type: QiblaError.LOCATION_UNAVAILABLE,
            message: `Failed to get location: ${errorMessage}`,
          });
        }
      }
      return null;
    }
  }, [desiredAccuracy, cacheDuration, requestPermission, getAccuracyLevel]);

  /**
   * Refresh location manually
   */
  const refresh = useCallback(async (): Promise<void> => {
    // Clear cache to force fresh fetch
    cachedLocation = null;
    cacheTimestamp = 0;
    await getLocation();
  }, [getLocation]);

  /**
   * Start periodic location updates
   */
  const startUpdates = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    // Get initial location
    getLocation();

    // Set up periodic updates
    if (updateInterval > 0) {
      updateIntervalRef.current = setInterval(() => {
        getLocation();
      }, updateInterval);
    }
  }, [getLocation, updateInterval]);

  /**
   * Stop location updates
   */
  const stopUpdates = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  // Check initial permission status
  useEffect(() => {
    const checkPermission = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (isMountedRef.current) {
        setHasPermission(status === 'granted');
      }
    };
    checkPermission();
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart) {
      startUpdates();
    }

    return () => {
      stopUpdates();
    };
  }, [autoStart, startUpdates, stopUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      stopUpdates();
    };
  }, [stopUpdates]);

  return {
    location,
    isLoading,
    error,
    refresh,
    requestPermission,
    hasPermission,
  };
};
