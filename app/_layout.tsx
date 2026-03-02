import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform } from 'react-native';
import notifee from '@notifee/react-native';
import { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity, Vibration } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { playPrayerSound, preloadSounds, unloadSounds } from '../utils/audioHelper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { OnboardingProvider, useOnboarding } from '../contexts/OnboardingContext';
import { PurchaseProvider } from './contexts/RevenueCatContext';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import WelcomeSlides from '../components/WelcomeSlides';

// Minimal global type augmentation for our support paywall helper
declare global {
  // eslint-disable-next-line no-var
  var __openSupportPaywall: undefined | (() => Promise<void>);
}

// Notifee handles foreground notifications automatically - no configuration needed

// Custom in-app notification component
function InAppNotification({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  const translateY = useRef(new Animated.Value(-100)).current;
  
  useEffect(() => {
    console.log("In-app notification mounted with:", title, body);
    // Animate in
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Automatically dismiss after 7 seconds 
    const timer = setTimeout(() => {
      dismiss();
    }, 7000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };
  
  return (
    <Animated.View 
      style={[
        styles.notification,
        { transform: [{ translateY }] }
      ]}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationBody}>{body}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} style={styles.closeButton}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function InnerLayout() {
  const [notification, setNotification] = useState<{title: string; body: string; data?: any} | null>(null);
  const [lastReceivedAt, setLastReceivedAt] = useState(0); // Track when last notification was received
  // Removed blocking splash: we no longer delay initial render for assets
  const [assetsLoaded, setAssetsLoaded] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [shouldPromptSupport, setShouldPromptSupport] = useState(false);
  
  // Preload assets when the app loads
  useEffect(() => {
    // Fire-and-forget preload of sounds; UI not blocked anymore
    preloadSounds().catch(err => console.error('Error preloading sounds', err));
    return () => {
      unloadSounds();
    };
  }, []);

  // Auto-popup scheduler for support paywall
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const PLAN_KEYS = {
      firstInstall: 'first_install_ts',
      lastPromptMonth: 'support_last_prompt_month', // e.g., '2025-09'
    } as const;

  const shouldShowThisMonth = (now: Date, lastPromptMonth?: string | null) => {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return lastPromptMonth !== ym;
    };

    const sevenDaysPassed = (firstTs: number, nowMs: number) => nowMs - firstTs >= 7 * 24 * 60 * 60 * 1000;

    const checkSchedule = async () => {
      try {
        const now = new Date();
        const nowMs = now.getTime();
        const day = now.getDate();
  const [firstInstallTsStr, lastPromptMonth] = await AsyncStorage.multiGet([
          PLAN_KEYS.firstInstall,
          PLAN_KEYS.lastPromptMonth,
        ]).then(entries => entries.map(([, v]) => v));

        // Record first install time if missing
        let firstInstallTs = firstInstallTsStr ? Number(firstInstallTsStr) : NaN;
        if (!firstInstallTsStr || !Number.isFinite(firstInstallTs)) {
          firstInstallTs = nowMs;
          await AsyncStorage.setItem(PLAN_KEYS.firstInstall, String(firstInstallTs));
          // Don't prompt on first launch
          return;
        }

        const monthOk = shouldShowThisMonth(now, lastPromptMonth);
        const is25thOrLater = day >= 25;
        const is7DaysAfterInstall = sevenDaysPassed(firstInstallTs, nowMs);
        const hasPromptedBefore = !!lastPromptMonth;

        if (monthOk) {
          if (!hasPromptedBefore) {
            // First-ever prompt: after 7 days OR on/after 25th
            if (is7DaysAfterInstall || is25thOrLater) {
              timer = setTimeout(() => setShouldPromptSupport(true), 5000);
            }
          } else {
            // Subsequent months: only on/after 25th
            if (is25thOrLater) {
              timer = setTimeout(() => setShouldPromptSupport(true), 5000);
            }
          }
        }
      } catch (e) {
        console.log('[SupportPrompt] scheduling failed (non-fatal):', e);
      }
    };

    checkSchedule();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  // Expose a global function to let screens open/close the paywall
  useEffect(() => {
    // @ts-ignore
    global.__openSupportPaywall = async () => {
      setShouldPromptSupport(false);
      // Persist last prompt month so we only show once per month
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await AsyncStorage.setItem('support_last_prompt_month', ym);
      // We won’t render the paywall here; each screen already has its own modal.
      // Instead, we can signal via AsyncStorage and the Home/Settings will respond if mounted.
      await AsyncStorage.setItem('support_trigger', String(Date.now()));
    };
  }, []);

  // Configure RevenueCat on app launch (following official best practices)
  useEffect(() => {
    const configureRevenueCat = async () => {
      try {
        console.log('[RevenueCat] Configuring SDK...');
        
  // Set log level; quiet by default unless explicit debug flag is set
  const verboseRc = Boolean((process.env.EXPO_PUBLIC_RC_DEBUG || '').toString());
  Purchases.setLogLevel(verboseRc ? LOG_LEVEL.VERBOSE : LOG_LEVEL.WARN);
        
        // Configure based on platform (following official docs pattern)
  const publicIosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  const { revenuecat } = (Constants.expoConfig?.extra || (Constants as any).manifest?.extra || {}) as any;
        if (Platform.OS === 'ios') {
          const iosKey = publicIosKey || revenuecat?.iosApiKey || 'appl_HlFMTQjuEPSpeLuaudMrIpsLqsf';
          if (!iosKey) {
            console.log('[RevenueCat] iOS API key missing in app.json extra.revenuecat. Skipping configure.');
          } else {
            await Purchases.configure({ apiKey: iosKey });
          }
          console.log('[RevenueCat] ✅ iOS SDK configured successfully');

          // Development-only deep debug to inspect offerings & products
          if (__DEV__ && verboseRc) {
            try {
              console.log('[RevenueCat][DEBUG] Fetching detailed diagnostics...');
              const appUserId = await Purchases.getAppUserID();
              console.log('[RevenueCat][DEBUG] App User ID:', appUserId);

              const offerings = await Purchases.getOfferings();
              console.log('[RevenueCat][DEBUG] Raw offerings object:', JSON.stringify(offerings, null, 2));

              if (!offerings.current) {
                console.log('[RevenueCat][DEBUG] No current offering. Checklist:');
                console.log('  - Ensure an offering is marked CURRENT in RevenueCat dashboard');
                console.log('  - Make sure at least one package inside it references a valid product');
                console.log('  - Confirm product IDs in App Store Connect exactly match RevenueCat');
              } else {
                console.log('[RevenueCat][DEBUG] Current offering identifier:', offerings.current.identifier);
                console.log('[RevenueCat][DEBUG] Packages in current offering:', offerings.current.availablePackages.map(p => ({
                  pkgId: p.identifier,
                  storeProductId: p.product.identifier,
                  price: p.product.priceString,
                  currency: p.product.currencyCode
                })));
              }

              // Optional targeted product fetch (IDs inferred from previous IAP setup)
              const debugProductIds = [
                'support_athan_app_v1_4usd_1time',
                'monthly_support_athan_appv1'
              ];
              try {
                const directProducts = await Purchases.getProducts(debugProductIds);
                console.log('[RevenueCat][DEBUG] Direct getProducts result:', directProducts.map(p => ({ id: p.identifier, price: p.priceString })));
                if (directProducts.length === 0) {
                  console.log('[RevenueCat][DEBUG] getProducts returned empty. Propagation / mismatch likely.');
                }
              } catch (gpErr) {
                console.log('[RevenueCat][DEBUG] getProducts error (non-fatal):', gpErr);
              }
            } catch (dbgErr) {
              console.log('[RevenueCat][DEBUG] Diagnostics block failed:', dbgErr);
            }
          }
        } else if (Platform.OS === 'android') {
          const publicAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
          const androidKey = publicAndroidKey || revenuecat?.androidApiKey || 'goog_dfuJwpbmzyvVmySItVuilefFYFM';
          if (!androidKey) {
            console.log('[RevenueCat] Android API key missing in app.json extra.revenuecat. Skipping configure.');
          } else {
            await Purchases.configure({ apiKey: androidKey });
            console.log('[RevenueCat] ✅ Android SDK configured successfully');
          }

          // Development-only debug for Android
          if (__DEV__ && verboseRc) {
            try {
              console.log('[RevenueCat][DEBUG] Android - Fetching detailed diagnostics...');
              const appUserId = await Purchases.getAppUserID();
              console.log('[RevenueCat][DEBUG] App User ID:', appUserId);

              const offerings = await Purchases.getOfferings();
              console.log('[RevenueCat][DEBUG] Raw offerings object:', JSON.stringify(offerings, null, 2));

              if (!offerings.current) {
                console.log('[RevenueCat][DEBUG] No current offering. Checklist:');
                console.log('  - Ensure an offering is marked CURRENT in RevenueCat dashboard');
                console.log('  - Make sure at least one package inside it references a valid product');
                console.log('  - Confirm product IDs in Google Play Console exactly match RevenueCat');
              } else {
                console.log('[RevenueCat][DEBUG] Current offering identifier:', offerings.current.identifier);
                console.log('[RevenueCat][DEBUG] Packages in current offering:', offerings.current.availablePackages.map(p => ({
                  pkgId: p.identifier,
                  storeProductId: p.product.identifier,
                  price: p.product.priceString,
                  currency: p.product.currencyCode
                })));
              }
            } catch (dbgErr) {
              console.log('[RevenueCat][DEBUG] Android diagnostics failed:', dbgErr);
            }
          }
        }
        
      } catch (error) {
        console.log('[RevenueCat] Configuration error (normal in dev environment):', error);
      }
    };

    configureRevenueCat();
  }, []);
  
  // Helper function to directly show an in-app notification for testing
  const showTestInAppNotification = async () => {
    console.log("Showing test in-app notification");
    setNotification({
      title: "Test In-App Notification",
      body: "This is a test notification that should appear in-app",
      data: { prayerName: 'Test' }
    });
    
    // Also provide vibration feedback
    Vibration.vibrate([0, 300, 150, 300]);
  };

  // Simple function to play a sound directly (now just vibrates)
  const playSimpleSound = async () => {
    try {
      console.log("Providing vibration feedback");
      await playPrayerSound('Test', true); // This now just vibrates
    } catch (error) {
      console.error("Failed to provide feedback", error);
    }
  };
  
  useEffect(() => {
    console.log("Setting up notification listeners");
    
    // Setup notification channel for Android using Notifee
    if (Platform.OS === 'android') {
      notifee.createChannel({
        id: 'default',
        name: 'Default',
        importance: 4, // AndroidImportance.HIGH
        vibration: true,
        vibrationPattern: [300, 500],
      });
    }

    // Listen for foreground notifications with Notifee
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === 1) { // EventType.PRESS
        console.log('Notification pressed:', detail.notification);
        } else if (type === 0) { // EventType.DISPLAYED
        console.log("Notification displayed in foreground:", detail.notification);
        const notification = detail.notification;
        const prayerName = notification?.data?.prayerName as string || 'Prayer';
        const useAzanSound = String(notification?.data?.useAzanSound) === 'true';

        // Only show new notifications (avoid duplication from quick re-renders)
        const currentTime = new Date().getTime();
        if (currentTime - lastReceivedAt > 1000) {
          setLastReceivedAt(currentTime);

          // Set notification for display
          setNotification({
            title: notification?.title || `${prayerName} Time`,
            body: notification?.body || `It's time for ${prayerName}`,
            data: notification?.data || {}
          });

          // Avoid double-sounding: Notifee channels normally play the sound.
          // Only perform manual playback when the notification explicitly requests it
          // (legacy tests or special alarms set `playManualAzan: 'true'`).
          const playManual = String(notification?.data?.playManualAzan) === 'true' || String(notification?.data?.playManual) === 'true';
          if (playManual) {
            playPrayerSound(prayerName || 'Test', useAzanSound);
          } else {
            // Simple vibration feedback for foreground display (no double audio)
            Vibration.vibrate([0, 250]);
          }
        }
      }
    });

    // Check notification permissions
    const checkPermissions = async () => {
      const settings = await notifee.getNotificationSettings();
      console.log("Current notification permissions:", settings);
      
      if (settings.authorizationStatus === 1) { // AUTHORIZED
        // Uncomment to test on app start:
        // showTestInAppNotification();
      } else {
        console.log("No notification permissions granted yet");
      }
    };
    
    // Automatically check permissions after 2 seconds
    const timer = setTimeout(checkPermissions, 2000);
    
    // Cleanup function
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [lastReceivedAt]);
  
  // Expose test function globally for easier debugging (remove in production)
  if (__DEV__) {
    // @ts-ignore
    global.showTestNotification = showTestInAppNotification;
  }
  
  // (No startup animation / blocking screen anymore)
  
  // Onboarding state
  const { isReady: onboardingReady, welcomeComplete, completeWelcome } = useOnboarding();

  // Don't render anything until onboarding state is loaded from storage
  if (!onboardingReady) {
    return null;
  }

  // Show welcome slides on first launch
  if (!welcomeComplete) {
    return (
      <LanguageProvider>
        <SafeAreaProvider>
          <StatusBar
            style={isDark ? 'light' : 'dark'}
            backgroundColor={Platform.OS === 'android' ? 'transparent' : undefined}
            translucent={true}
          />
          <WelcomeSlides onComplete={completeWelcome} />
        </SafeAreaProvider>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <StatusBar 
          style={isDark ? 'light' : 'dark'} 
          backgroundColor={Platform.OS === 'android' ? 'transparent' : undefined}
          translucent={true}
        />
        <Stack 
          screenOptions={{
            headerShown: false,
            contentStyle: { 
              backgroundColor: isDark ? '#121212' : '#FFFFFF'
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        {notification && (
          <InAppNotification 
            title={notification.title}
            body={notification.body}
            onClose={() => setNotification(null)}
          />
        )}
        {/* If auto-schedule says we should prompt, set a trigger other screens can act on */}
        {shouldPromptSupport && (() => {
          // Immediately trigger global opener so the active screen can display its modal
          // @ts-ignore
          // Fire and reset the flag
          (globalThis as any).__openSupportPaywall?.();
          return null;
        })()}
      </SafeAreaProvider>
    </LanguageProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PurchaseProvider>
        <OnboardingProvider>
          <InnerLayout />
        </OnboardingProvider>
      </PurchaseProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  notification: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    padding: 16,
    margin: 8,
    marginTop: Constants.statusBarHeight + 8 || 36, // Reduced margin above status bar
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10, // Increase elevation for Android
    zIndex: 9999, // Very high z-index to ensure visibility
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  notificationBody: {
    color: 'white',
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
