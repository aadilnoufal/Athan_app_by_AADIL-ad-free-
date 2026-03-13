/**
 * useHomeRegion
 *
 * Manages region configuration state for the Home screen:
 * - Current region ID, location, method, tuning params
 * - First-load tracking
 * - Region picker modal visibility
 * - Region-changing loading flag
 * - Initial region config loading
 *
 * This hook is self-contained: it does NOT depend on prayer data or
 * notification hooks. Cross-cutting actions (changeRegion, useFocusEffect
 * for region-change detection) live in the orchestrator.
 */
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getAvailableRegions,
  getRegionConfig,
  DEFAULT_REGION,
} from '../../app/config/prayerTimeConfig';

export function useHomeRegion() {
  console.log('[PRYR_DEBUG] useHomeRegion: Hook initialized');
  // ── State ───────────────────────────────────────────
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [location, setLocation] = useState('');
  const [method, setMethod] = useState(0);
  const [tuningParams, setTuningParams] = useState('');
  const availableRegions = getAvailableRegions();
  const [regionChanging, setRegionChanging] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  // ── Refs ────────────────────────────────────────────
  const regionLoadingRef = useRef(false);

  // ── loadRegionConfig ────────────────────────────────
  /** Reads the saved region from AsyncStorage and updates region state.
   *  Does NOT directly touch prayer data or loading — the prayer data hook
   *  detects region param changes via its effect dependency array.
   */
  const loadRegionConfig = async (): Promise<void> => {
    console.log('[PRYR_DEBUG] useHomeRegion.loadRegionConfig: Starting region config load');
    try {
      const savedRegion = await AsyncStorage.getItem('selected_region');
      console.log('[PRYR_DEBUG] useHomeRegion.loadRegionConfig: savedRegion from AsyncStorage:', savedRegion);
      const regionToUse = savedRegion || DEFAULT_REGION;

      console.log(`Loading region config for: ${regionToUse}`);
      const config = getRegionConfig(regionToUse);

      if (config) {
        console.log(`Setting region to: ${config.id}, location: ${config.location}`);
        const regionChanged = config.id !== regionId || config.location !== location;

        if (isFirstLoad || regionChanged) {
          setRegionId(config.id);
          setLocation(config.location);
          setMethod(config.method);
          setTuningParams(config.tuningParams);
          if (isFirstLoad) setIsFirstLoad(false);
        } else {
          console.log('Region configuration unchanged, keeping current data');
        }
      } else {
        const defaultConfig = getRegionConfig(DEFAULT_REGION);
        if (defaultConfig) {
          console.log('No config found, using default region');
          const changed =
            DEFAULT_REGION !== regionId ||
            defaultConfig.location !== location ||
            isFirstLoad;

          if (changed) {
            setRegionId(DEFAULT_REGION);
            setLocation(defaultConfig.location);
            setMethod(defaultConfig.method);
            setTuningParams(defaultConfig.tuningParams);
            setIsFirstLoad(false);
          }
        }
      }
    } catch (error) {
      console.error('[PRYR_DEBUG] useHomeRegion.loadRegionConfig: ERROR:', error);
      console.error('Error loading region config:', error);
      const defaultConfig = getRegionConfig(DEFAULT_REGION);
      if (defaultConfig && (defaultConfig.id !== regionId || isFirstLoad)) {
        console.log('Error occurred, loading default region config');
        setRegionId(DEFAULT_REGION);
        setLocation(defaultConfig.location);
        setMethod(defaultConfig.method);
        setTuningParams(defaultConfig.tuningParams);
        setIsFirstLoad(false);
      }
    }
  };

  // ── Initial region load (runs once) ─────────────────
  useEffect(() => {
    console.log('[PRYR_DEBUG] useHomeRegion: Initial load effect, regionLoadingRef:', regionLoadingRef.current);
    if (regionLoadingRef.current) return;
    regionLoadingRef.current = true;

    loadRegionConfig().finally(() => {
      setTimeout(() => {
        regionLoadingRef.current = false;
      }, 1000);
    });
  }, []);

  return {
    regionId,
    setRegionId,
    location,
    setLocation,
    method,
    setMethod,
    tuningParams,
    setTuningParams,
    availableRegions,
    regionChanging,
    setRegionChanging,
    showRegionPicker,
    setShowRegionPicker,
    isFirstLoad,
    setIsFirstLoad,
    loadRegionConfig,
  };
}
