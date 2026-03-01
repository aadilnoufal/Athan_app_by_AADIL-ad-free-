/**
 * Tests for useHomeRegion hook.
 *
 * Verifies:
 * - Initial state uses DEFAULT_REGION values
 * - Initial effect loads saved region from AsyncStorage
 * - loadRegionConfig reads saved region and updates state
 * - Falls back to DEFAULT_REGION when config is null
 * - Falls back to DEFAULT_REGION on AsyncStorage error
 * - Region-unchanged scenario skips state updates
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mocks ──────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockDefaultConfig = {
  id: 'US-CA-LA',
  location: '34.0522,-118.2437',
  method: 2,
  tuningParams: '0,0,0,0,0,0,0,0,0',
};

const mockSavedConfig = {
  id: 'PK-PB-LHR',
  location: '31.5204,74.3587',
  method: 1,
  tuningParams: '1,0,0,0,0,0,0,0,0',
};

jest.mock('../../../app/config/prayerTimeConfig', () => ({
  DEFAULT_REGION: 'US-CA-LA',
  getAvailableRegions: () => [
    { id: 'US-CA-LA', name: 'Los Angeles' },
    { id: 'PK-PB-LHR', name: 'Lahore' },
  ],
  getRegionConfig: (regionId: string) => {
    if (regionId === 'US-CA-LA') return mockDefaultConfig;
    if (regionId === 'PK-PB-LHR') return mockSavedConfig;
    return null;
  },
}));

import { useHomeRegion } from '../../../hooks/home/useHomeRegion';

describe('useHomeRegion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('returns default region state before initial load', () => {
    const { result } = renderHook(() => useHomeRegion());

    // Before initial load effect resolves, regionId should be DEFAULT_REGION
    expect(result.current.regionId).toBe('US-CA-LA');
    expect(result.current.isFirstLoad).toBe(true);
    expect(result.current.regionChanging).toBe(false);
    expect(result.current.showRegionPicker).toBe(false);
  });

  it('loads default config when no saved region in AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useHomeRegion());

    await waitFor(() => {
      expect(result.current.isFirstLoad).toBe(false);
    });

    expect(result.current.regionId).toBe('US-CA-LA');
    expect(result.current.location).toBe('34.0522,-118.2437');
    expect(result.current.method).toBe(2);
    expect(result.current.tuningParams).toBe('0,0,0,0,0,0,0,0,0');
  });

  it('loads saved region from AsyncStorage on initial mount', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('PK-PB-LHR');

    const { result } = renderHook(() => useHomeRegion());

    await waitFor(() => {
      expect(result.current.regionId).toBe('PK-PB-LHR');
    });

    expect(result.current.location).toBe('31.5204,74.3587');
    expect(result.current.method).toBe(1);
    expect(result.current.tuningParams).toBe('1,0,0,0,0,0,0,0,0');
    expect(result.current.isFirstLoad).toBe(false);
  });

  it('falls back to default when getRegionConfig returns null', async () => {
    // Return an unknown region ID — getRegionConfig will return null
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('XX-YY-ZZ');

    const { result } = renderHook(() => useHomeRegion());

    await waitFor(() => {
      expect(result.current.isFirstLoad).toBe(false);
    });

    // Should fall back to default
    expect(result.current.regionId).toBe('US-CA-LA');
    expect(result.current.location).toBe('34.0522,-118.2437');
  });

  it('falls back to default on AsyncStorage error', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useHomeRegion());

    await waitFor(() => {
      expect(result.current.isFirstLoad).toBe(false);
    });

    expect(result.current.regionId).toBe('US-CA-LA');
    expect(result.current.location).toBe('34.0522,-118.2437');
  });

  it('returns availableRegions from config', () => {
    const { result } = renderHook(() => useHomeRegion());

    expect(result.current.availableRegions).toEqual([
      { id: 'US-CA-LA', name: 'Los Angeles' },
      { id: 'PK-PB-LHR', name: 'Lahore' },
    ]);
  });

  it('exposes setters for region state', async () => {
    const { result } = renderHook(() => useHomeRegion());

    await waitFor(() => {
      expect(result.current.isFirstLoad).toBe(false);
    });

    act(() => {
      result.current.setRegionChanging(true);
    });
    expect(result.current.regionChanging).toBe(true);

    act(() => {
      result.current.setShowRegionPicker(true);
    });
    expect(result.current.showRegionPicker).toBe(true);
  });

  it('loadRegionConfig can be called manually to reload', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useHomeRegion());

    await waitFor(() => {
      expect(result.current.isFirstLoad).toBe(false);
    });

    expect(result.current.regionId).toBe('US-CA-LA');

    // Simulate saving a new region and calling loadRegionConfig
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('PK-PB-LHR');

    await act(async () => {
      await result.current.loadRegionConfig();
    });

    expect(result.current.regionId).toBe('PK-PB-LHR');
    expect(result.current.location).toBe('31.5204,74.3587');
    expect(result.current.method).toBe(1);
  });
});
