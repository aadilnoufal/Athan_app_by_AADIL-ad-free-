import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, MakePurchaseResult, PRODUCT_CATEGORY } from 'react-native-purchases';

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
  purchaseSucceeded: boolean;
  customerInfo: CustomerInfo | null;
  purchase: (purchasePackage: PurchasesPackage) => Promise<void>;
  purchaseProductById: (productId: string) => Promise<void>;
  fetchOfferings: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  checkEntitlements: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  resetPurchaseSuccess: () => void;
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
  const [purchaseSucceeded, setPurchaseSucceeded] = useState(false);

  const resetPurchaseSuccess = () => setPurchaseSucceeded(false);

  // Gate logs/calls - now supports both iOS and Android
  const IS_MOBILE = Platform.OS === 'ios' || Platform.OS === 'android';
  const IS_IOS = Platform.OS === 'ios';
  const IS_ANDROID = Platform.OS === 'android';
  // Enable verbose logging for debugging on Android
  const VERBOSE_RC = IS_ANDROID || Boolean((process.env.EXPO_PUBLIC_RC_DEBUG || '').toString());
  const debugLog = (...args: any[]) => {
    // Always log on Android for debugging, or when VERBOSE_RC is enabled
    if (IS_ANDROID || (__DEV__ && VERBOSE_RC)) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  // Additional one-time support products to display alongside offerings
  // These IDs should match the products configured in both App Store Connect and Google Play Console
  const DONATION_PRODUCT_IDS = Platform.OS === 'ios' 
    ? [
        'support_athan_app_26usd_1time',
        'support_athan_app_500qr_1time',
      ]
    : [
        // Google Play product IDs
        // Including subscription here ensures it appears even if Offerings aren't configured perfectly
        
        'support_athan_app_v1_4usd_1time',
        'support_athan_app_26usd_1time',
        'support_athan_app_500qr_1time',
        'monthly_support_athan_app_4usd',
      ];

  useEffect(() => {
    if (!IS_MOBILE) {
      // Skip RC network calls on non-mobile platforms
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
    if (!IS_MOBILE) return;
    setLoading(true);
    try {
      console.log('[RevenueCat] Fetching offerings...');
      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] All offerings:', JSON.stringify(Object.keys(offerings.all || {})));
      if (offerings.current) {
        console.log('[RevenueCat] Found current offering:', offerings.current.identifier);
        console.log('[RevenueCat] Available packages:', offerings.current.availablePackages.map(p => p.identifier));
        setPackages(offerings.current.availablePackages);
      } else {
        console.log('[RevenueCat] No current offering found - make sure you have set a CURRENT offering in RevenueCat dashboard');
        setPackages([]);
      }
    } catch (e) {
      console.log('[RevenueCat] Fetch offerings error:', e);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!IS_MOBILE) return;
    try {
      console.log('[RevenueCat] Fetching products with IDs:', DONATION_PRODUCT_IDS);
      if (!DONATION_PRODUCT_IDS.length) { setProducts([]); return; }
      
      let storeProducts: any[] = [];
      if (Platform.OS === 'android') {
        const subsIds = DONATION_PRODUCT_IDS.filter(id => id.includes('monthly'));
        const inAppIds = DONATION_PRODUCT_IDS.filter(id => !id.includes('monthly'));

        // Helper to fetch gracefully
        const safeFetch = async (ids: string[], type: PRODUCT_CATEGORY) => {
          if (!ids.length) return [];
          try { return await Purchases.getProducts(ids, type); } 
          catch (e) { console.log(`[RC] Failed to fetch ${type}:`, e); return []; }
        };

        // 1. Try to fetch as intended
        let subs = await safeFetch(subsIds, PRODUCT_CATEGORY.SUBSCRIPTION);
        let inApps = await safeFetch(inAppIds, PRODUCT_CATEGORY.NON_SUBSCRIPTION);

        // 2. Fallback: If INAPPs are missing, maybe they were configured as Subs?
        if (inAppIds.length > 0 && inApps.length === 0) {
           console.log('[RC] InApps missing, retrying as SUBS...');
           const retryInApps = await safeFetch(inAppIds, PRODUCT_CATEGORY.SUBSCRIPTION);
           if (retryInApps.length > 0) inApps = retryInApps;
        }

        storeProducts = [...subs, ...inApps];
      } else {
        // iOS
        storeProducts = await Purchases.getProducts(DONATION_PRODUCT_IDS);
      }
      
      console.log('[RevenueCat] Raw store products:', storeProducts?.length || 0, 'items');
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
      console.log('[RevenueCat] Products fetched:', sorted.map(p => `${p.identifier} (${p.priceString})`));
    } catch (e) {
      console.log('[RevenueCat] Fetch products error:', e);
      setProducts([]);
    }
  };

  const checkEntitlements = async () => {
    if (!IS_MOBILE) return;
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
    if (!IS_MOBILE) {
      Alert.alert('Purchases Unavailable', 'In-app purchases are only available on mobile devices.');
      return;
    }
    if (isPurchasing) return;
    setIsPurchasing(true);
    try {
      const { customerInfo }: MakePurchaseResult = await Purchases.purchasePackage(purchasePackage);
      setCustomerInfo(customerInfo);
      setPurchaseSucceeded(true);
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
    if (!IS_MOBILE) {
      Alert.alert('Purchases Unavailable', 'In-app purchases are only available on mobile devices.');
      return;
    }
    if (isPurchasing) return;
    setIsPurchasing(true);
    try {
      console.log('[RevenueCat] Attempting purchase for product:', productId);
      
      // For Android, we need to fetch the actual product first to get the correct type
      let storeProduct: any = null;
      if (Platform.OS === 'android') {
        // If ID contains a colon (productId:basePlanId), use only the productId for fetching
        const rawProductId = productId.split(':')[0];
        console.log(`[RC] Fetching details for ${rawProductId} (original: ${productId})`);

        // Fetch both types in parallel to ensure we find the product regardless of ID or configuration
        // This handles cases where a product might be configured differently than its ID suggests
        const [subs, inApps] = await Promise.all([
          Purchases.getProducts([rawProductId], PRODUCT_CATEGORY.SUBSCRIPTION).catch(e => {
            console.log('[RC] Sub fetch failed:', e); return [];
          }),
          Purchases.getProducts([rawProductId], PRODUCT_CATEGORY.NON_SUBSCRIPTION).catch(e => {
            console.log('[RC] InApp fetch failed:', e); return [];
          })
        ]);

        if (subs.length > 0) {
          storeProduct = subs[0];
          console.log('[RevenueCat] Found as SUBSCRIPTION');
        } else if (inApps.length > 0) {
          storeProduct = inApps[0];
          console.log('[RevenueCat] Found as NON_SUBSCRIPTION');
        }
        
        if (storeProduct) {
          // Use purchaseStoreProduct for proper Android billing
          const { customerInfo }: MakePurchaseResult = await Purchases.purchaseStoreProduct(storeProduct);
          setCustomerInfo(customerInfo);
          setPurchaseSucceeded(true);
        } else {
          console.log('[RevenueCat] Product not found in either category:', productId);
          // Fallback check: try legacy purchase if strictly necessary, 
          // but usually if getProducts fails, purchase will fail too.
          Alert.alert('Error', 'Product not found. Please try again later.', [{ text: 'OK' }]);
        }
      } else {
        // iOS - original method works fine
        const { customerInfo }: MakePurchaseResult = await (Purchases as any).purchaseProduct(productId);
        setCustomerInfo(customerInfo);
        setPurchaseSucceeded(true);
      }
    } catch (e: any) {
      console.log('[RevenueCat] Purchase error:', e?.code, e?.message, e);
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
    if (!IS_MOBILE) {
      Alert.alert('Purchases Unavailable', 'Restore is only available on mobile devices.');
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
    purchaseSucceeded,
    customerInfo,
    purchase,
    purchaseProductById,
    fetchOfferings,
    fetchProducts,
    checkEntitlements,
    restorePurchases,
    resetPurchaseSuccess,
  };

  return (
    <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>
  );
};
