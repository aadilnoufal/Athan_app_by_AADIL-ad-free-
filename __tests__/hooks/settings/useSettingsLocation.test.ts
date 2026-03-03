/**
 * Tests for useSettingsLocation hook.
 *
 * Verifies:
 * - Initial state loads from AsyncStorage (or defaults)
 * - Country → State → City cascading selection
 * - updateRegionId saves to AsyncStorage, cancels notifications, navigates home
 * - updateRegionId shows "No Change" alert when location unchanged
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mocks ──────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    getAllKeys: jest.fn().mockResolvedValue([]),
    multiRemove: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
  },
}));
const mockNotifee = jest.requireMock('@notifee/react-native').default;

// Mock prayer time config
const mockCountries = [
  { id: 'US', name: 'United States' },
  { id: 'PK', name: 'Pakistan' },
];
const mockStates: Record<string, Array<{ id: string; name: string }>> = {
  US: [
    { id: 'CA', name: 'California' },
    { id: 'NY', name: 'New York' },
  ],
  PK: [{ id: 'PB', name: 'Punjab' }],
};
const mockCities: Record<string, Array<{ id: string; name: string }>> = {
  'US-CA': [
    { id: 'LA', name: 'Los Angeles' },
    { id: 'SF', name: 'San Francisco' },
  ],
  'US-NY': [{ id: 'NYC', name: 'New York City' }],
  'PK-PB': [{ id: 'LHR', name: 'Lahore' }],
};

jest.mock('../../../app/config/prayerTimeConfig', () => ({
  getAvailableCountries: () => mockCountries,
  getStatesForCountry: (countryId: string) => mockStates[countryId] || [],
  getCitiesForState: (countryId: string, stateId: string) =>
    mockCities[`${countryId}-${stateId}`] || [],
  DEFAULT_REGION: 'US-CA-LA',
  parseRegionId: (regionId: string) => {
    const parts = regionId.split('-');
    return { countryId: parts[0] || '', stateId: parts[1] || '', cityId: parts.slice(2).join('-') || '' };
  },
}));

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

import { useSettingsLocation } from '../../../hooks/settings/useSettingsLocation';

const mockNavigateHome = jest.fn();

describe('useSettingsLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('loads default region when no saved region', async () => {
    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('US');
    });

    expect(result.current.selectedState).toBe('CA');
    expect(result.current.selectedCity).toBe('LA');
    expect(result.current.regionId).toBe('US-CA-LA');
  });

  it('loads saved region from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('PK-PB-LHR');

    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('PK');
    });

    expect(result.current.selectedState).toBe('PB');
    expect(result.current.selectedCity).toBe('LHR');
    expect(result.current.regionId).toBe('PK-PB-LHR');
  });

  it('selectCountry cascades to first state and first city', async () => {
    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('US');
    });

    act(() => {
      result.current.selectCountry('PK');
    });

    expect(result.current.selectedCountry).toBe('PK');
    expect(result.current.selectedState).toBe('PB');
    expect(result.current.selectedCity).toBe('LHR');
  });

  it('selectState cascades to first city', async () => {
    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('US');
    });

    act(() => {
      result.current.selectState('NY');
    });

    expect(result.current.selectedState).toBe('NY');
    expect(result.current.selectedCity).toBe('NYC');
  });

  it('selectCity updates only the city', async () => {
    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('US');
    });

    act(() => {
      result.current.selectCity('SF');
    });

    expect(result.current.selectedCity).toBe('SF');
    // Country and state unchanged
    expect(result.current.selectedCountry).toBe('US');
    expect(result.current.selectedState).toBe('CA');
  });

  it('selectCountry is a no-op when same country selected', async () => {
    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('US');
    });

    // Set city to SF first
    act(() => {
      result.current.selectCity('SF');
    });
    expect(result.current.selectedCity).toBe('SF');

    // Re-select same country — should NOT reset city
    act(() => {
      result.current.selectCountry('US');
    });
    expect(result.current.selectedCity).toBe('SF');
  });

  it('updateRegionId shows "No Change" alert when location is unchanged', async () => {
    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('US');
    });

    // Default region is US-CA-LA, selection is already US-CA-LA
    await act(async () => {
      await result.current.updateRegionId();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'No Change',
      expect.any(String),
      expect.any(Array),
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('updateRegionId saves and cancels notifications on change', async () => {
    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('US');
    });

    // Change city
    act(() => {
      result.current.selectCity('SF');
    });

    await act(async () => {
      await result.current.updateRegionId();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('selected_region', 'US-CA-SF');
    expect(mockNotifee.cancelAllNotifications).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Location Updated',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('returns derived country/state/city lists', async () => {
    const { result } = renderHook(() =>
      useSettingsLocation({ navigateHome: mockNavigateHome }),
    );

    await waitFor(() => {
      expect(result.current.selectedCountry).toBe('US');
    });

    expect(result.current.countries).toEqual(mockCountries);
    expect(result.current.states).toEqual(mockStates.US);
    expect(result.current.cities).toEqual(mockCities['US-CA']);
  });
});
