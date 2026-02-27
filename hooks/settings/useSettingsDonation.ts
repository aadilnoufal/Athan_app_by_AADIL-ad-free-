/**
 * useSettingsDonation
 *
 * Custom hook that encapsulates the donation / paywall logic for the Settings
 * screen. Manages the RevenueCat paywall modal, IAP retry state, and the
 * fallback external donation links.
 */
import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { usePurchase } from '../../app/contexts/RevenueCatContext';

/** Translation function signature (from useLanguage) */
type TFunc = (key: string) => string;

export function useSettingsDonation(t: TFunc) {
  const [showPaywall, setShowPaywall] = useState(false);
  const [iapRetryCount, setIapRetryCount] = useState(0);
  const { loading: iapLoading, fetchOfferings } = usePurchase();

  const openDonation = () => {
    const extra: any =
      Constants.expoConfig?.extra || (Constants as any).manifest?.extra || {};
    const rciOSKey =
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || extra?.revenuecat?.iosApiKey;
    const rcAndroidKey =
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || extra?.revenuecat?.androidApiKey;
    const shouldUsePaywall =
      Platform.OS === 'ios' ? !!rciOSKey : Platform.OS === 'android' ? !!rcAndroidKey : false;

    if (shouldUsePaywall) {
      if (iapLoading && iapRetryCount < 3) {
        setIapRetryCount((prev) => prev + 1);
        fetchOfferings();
        setTimeout(() => setShowPaywall(true), 1000);
      } else {
        setShowPaywall(true);
      }
      return;
    }

    // Fallback – external links
    Alert.alert(t('supportTitle'), t('supportMessage'), [
      { text: t('maybeLater'), style: 'cancel' },
      {
        text: t('oneTimeSupport'),
        onPress: () => {
          Linking.openURL(
            'https://nas.io/checkout-global?communityId=640f2dbae2d22dff16a554d9&communityCode=AADIL_NOUFAL&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fportal%2Fproducts%2F67e825d377e3fc39a8ba9b0d%3Ftab%3Dcontent&sourceInfoType=folder&sourceInfoOrigin=67e825d377e3fc39a8ba9b0d',
          ).catch((err: Error) => console.error('An error occurred while opening the link:', err));
        },
      },
      {
        text: t('monthlySupport'),
        onPress: () => {
          Linking.openURL(
            'https://nas.io/checkout-global?communityId=67e828db202755d3615d3a6b&communityCode=AD_FREE_ATHAN&requestor=signupRequestor&linkClicked=https%3A%2F%2Fnas.io%2Fcheckout-widget%3FcommunityCode%3DAD_FREE_ATHAN%26communitySlug%3D%252Fad-free-athan%26buttonText%3DJoin%2520as%2520member%26buttonTextColorHex%3D%2523000%26buttonBgColorHex%3D%2523fccb1d%26widgetTheme%3Dlight%26backgroundColorHex%3D%2523fff%2522%2520width%3D%2522100%25%2522%2520height%3D%2522320%2522%2520frameborder%3D%25220%2522%2520referrerpolicy%3D%2522no-referrer&fromWidget=1',
          ).catch((err: Error) => console.error('An error occurred while opening the link:', err));
        },
      },
    ]);
  };

  return {
    showPaywall,
    setShowPaywall,
    iapLoading,
    openDonation,
  };
}
