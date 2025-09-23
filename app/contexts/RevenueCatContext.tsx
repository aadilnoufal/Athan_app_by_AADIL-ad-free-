import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, MakePurchaseResult } from 'react-native-purchases';

// Minimal StoreProduct shape used in this app to avoid SDK type dependency mismatches
export type StoreProduct = {
  identifier: string;
  priceString: string;
  title: string;
  description?: string;
};

interface PurchaseContextType {
  loading: boolean;
  packages: PurchasesPackage[];
  products: StoreProduct[];
  isPurchasing: boolean;
  customerInfo: CustomerInfo | null;
  purchase: (purchasePackage: PurchasesPackage) => Promise<void>;
  purchaseProductById: (productId: string) => Promise<void>;
  fetchOfferings: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  checkEntitlements: () => Promise<void>;
  restorePurchases: () => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);

export const usePurchase = () => {
  const context = useContext(PurchaseContext);
  if (!context) throw new Error('usePurchase must be used within a PurchaseProvider');
  return context;
};

interface PurchaseProviderProps { children: ReactNode }

export const PurchaseProvider: React.FC<PurchaseProviderProps> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Gate logs/calls
  const IS_IOS = Platform.OS === 'ios';
  const VERBOSE_RC = Boolean((process.env.EXPO_PUBLIC_RC_DEBUG || '').toString());
  const debugLog = (...args: any[]) => {
    if (__DEV__ && VERBOSE_RC) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  // Additional one-time support products to display alongside offerings
  const DONATION_PRODUCT_IDS = [
    'support_athan_app_26usd_1time',
    'support_athan_app_500qr_1time',
  ];

  useEffect(() => {
    if (!IS_IOS) {
      // Skip RC network calls on Android in this project
      setPackages([]);
      setProducts([]);
      setCustomerInfo(null);
      return;
    }
    const t = setTimeout(() => {
      fetchOfferings();
      fetchProducts();
      checkEntitlements();
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const fetchOfferings = async () => {
    if (!IS_IOS) return;
    setLoading(true);
    try {
      debugLog('[RevenueCat] Fetching offerings...');
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        debugLog('[RevenueCat] Found current offering:', offerings.current.identifier);
        setPackages(offerings.current.availablePackages);
      } else {
        debugLog('[RevenueCat] No current offering found');
        setPackages([]);
      }
    } catch (e) {
      debugLog('[RevenueCat] Fetch offerings error:', e);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!IS_IOS) return;
    try {
      if (!DONATION_PRODUCT_IDS.length) { setProducts([]); return; }
      const storeProducts = await (Purchases as any).getProducts(DONATION_PRODUCT_IDS);
      const simplified: StoreProduct[] = (storeProducts || []).map((p: any) => ({
        identifier: p.identifier,
        priceString: p.priceString,
        title: p.title,
        description: p.description,
      }));
      const desiredOrder = DONATION_PRODUCT_IDS;
      const sorted = simplified.slice().sort((a, b) => {
        const aIsQr = a.identifier === 'support_athan_app_500qr_1time';
        const bIsQr = b.identifier === 'support_athan_app_500qr_1time';
        if (aIsQr && !bIsQr) return 1;
        if (!aIsQr && bIsQr) return -1;
        const ai = desiredOrder.indexOf(a.identifier);
        const bi = desiredOrder.indexOf(b.identifier);
        const na = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
        const nb = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
        return na - nb;
      });
      setProducts(sorted);
      debugLog('[RevenueCat] Products fetched:', sorted.map(p => `${p.identifier} (${p.priceString})`));
    } catch (e) {
      debugLog('[RevenueCat] Fetch products error:', e);
      setProducts([]);
    }
  };

  const checkEntitlements = async () => {
    if (!IS_IOS) return;
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const active = Object.keys(info.entitlements.active);
      debugLog('[RevenueCat] Active entitlements:', active);
    } catch (e) {
      debugLog('[RevenueCat] getCustomerInfo error:', e);
      setCustomerInfo(null);
    }
  };

  const purchase = async (purchasePackage: PurchasesPackage) => {
    if (!IS_IOS) {
      Alert.alert('Purchases Unavailable', 'In-app purchases are only available on iOS in this project.');
      return;
    }
    if (isPurchasing) return;
    setIsPurchasing(true);
    try {
      const { customerInfo }: MakePurchaseResult = await Purchases.purchasePackage(purchasePackage);
      setCustomerInfo(customerInfo);
      const active = Object.keys(customerInfo.entitlements.active);
      if (active.length > 0) {
        Alert.alert('🙏 Thank You!', 'Thanks for supporting our app!', [{ text: "You're Welcome! 😊" }]);
      }
    } catch (e: any) {
      if (e?.userCancelled) return;
      if (__DEV__) {
        Alert.alert('Development Mode', 'Purchases need a real device/App Store sandbox.', [{ text: 'OK' }]);
      } else {
        Alert.alert('Purchase Error', 'Something went wrong. Please try again.', [{ text: 'OK' }]);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const purchaseProductById = async (productId: string) => {
    if (!IS_IOS) {
      Alert.alert('Purchases Unavailable', 'In-app purchases are only available on iOS in this project.');
      return;
    }
    if (isPurchasing) return;
    setIsPurchasing(true);
    try {
      const { customerInfo }: MakePurchaseResult = await (Purchases as any).purchaseProduct(productId);
      setCustomerInfo(customerInfo);
      const active = Object.keys(customerInfo.entitlements.active);
      if (active.length > 0) {
        Alert.alert('🙏 Thank You!', 'Thank you for supporting our app!', [{ text: "You're Welcome! 😊" }]);
      }
    } catch (e: any) {
      if (e?.userCancelled) return;
      if (__DEV__) {
        Alert.alert('Development Mode', 'Purchases need a real device/App Store sandbox.', [{ text: 'OK' }]);
      } else {
        Alert.alert('Purchase Error', 'Something went wrong. Please try again.', [{ text: 'OK' }]);
      }
    } finally {
      setIsPurchasing(false);
    }

  };

  const restorePurchases = async () => {
    if (!IS_IOS) {
      Alert.alert('Purchases Unavailable', 'Restore is only available on iOS in this project.');
      return;
    }
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const active = Object.keys(info.entitlements.active);
      if (active.length > 0) {
        Alert.alert('Purchases Restored', 'Your previous purchases have been restored.', [{ text: 'OK' }]);
      } else {
        Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.', [{ text: 'OK' }]);
      }
    } catch (e) {
      Alert.alert('Restore Failed', 'Something went wrong while restoring purchases. Please try again later.', [{ text: 'OK' }]);
    }
  };

  const value: PurchaseContextType = {
    loading,
    packages,
    products,
    isPurchasing,
    customerInfo,
    purchase,
    purchaseProductById,
    fetchOfferings,
    fetchProducts,
    checkEntitlements,
    restorePurchases,
  };

  return (
    <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>
  );
};
