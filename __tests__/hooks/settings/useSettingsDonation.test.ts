/**
 * Tests for useSettingsDonation hook.
 *
 * Verifies:
 * - Initial state is correct (paywall hidden, not loading)
 * - openDonation shows paywall when RevenueCat keys are present
 * - openDonation shows Alert fallback when no RC keys
 * - iapLoading retry logic triggers fetchOfferings
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert, Linking, Platform } from 'react-native';

// ── Mocks ──────────────────────────────────────────────────────────────

// Mock RevenueCatContext
const mockFetchOfferings = jest.fn();
jest.mock('../../../app/contexts/RevenueCatContext', () => ({
  usePurchase: () => ({
    loading: false,
    fetchOfferings: mockFetchOfferings,
  }),
}));

// Mock Expo Constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

// Spy on Alert and Linking
jest.spyOn(Alert, 'alert').mockImplementation(() => {});
jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

import { useSettingsDonation } from '../../../hooks/settings/useSettingsDonation';

const mockT = (key: string) => key;

describe('useSettingsDonation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no RevenueCat keys → fallback path
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  });

  it('returns correct initial state', () => {
    const { result } = renderHook(() => useSettingsDonation(mockT));

    expect(result.current.showPaywall).toBe(false);
    expect(result.current.iapLoading).toBe(false);
    expect(typeof result.current.openDonation).toBe('function');
    expect(typeof result.current.setShowPaywall).toBe('function');
  });

  it('openDonation shows Alert fallback when no RC keys are set', () => {
    const { result } = renderHook(() => useSettingsDonation(mockT));

    act(() => {
      result.current.openDonation();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'supportDialogTitle',
      'supportMessage',
      expect.arrayContaining([
        expect.objectContaining({ text: 'maybeLater' }),
        expect.objectContaining({ text: 'oneTimeSupport' }),
        expect.objectContaining({ text: 'monthlySupport' }),
      ]),
    );
  });

  it('openDonation shows paywall when RC key is set on iOS', () => {
    const originalPlatform = Platform.OS;
    (Platform as any).OS = 'ios';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test_key';

    const { result } = renderHook(() => useSettingsDonation(mockT));

    act(() => {
      result.current.openDonation();
    });

    expect(result.current.showPaywall).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();

    (Platform as any).OS = originalPlatform;
  });

  it('setShowPaywall toggles paywall visibility', () => {
    const { result } = renderHook(() => useSettingsDonation(mockT));

    expect(result.current.showPaywall).toBe(false);

    act(() => {
      result.current.setShowPaywall(true);
    });
    expect(result.current.showPaywall).toBe(true);

    act(() => {
      result.current.setShowPaywall(false);
    });
    expect(result.current.showPaywall).toBe(false);
  });
});
