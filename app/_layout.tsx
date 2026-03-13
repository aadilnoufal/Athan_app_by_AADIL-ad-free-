import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import notifee from '@notifee/react-native';
import { useEffect, useState, useRef } from "react";
import { Platform, View, Text, Animated, TouchableOpacity, Easing } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { preloadSounds, unloadSounds } from '../utils/audioHelper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

// ── In-app prayer notification banner ──────────────────────────────────
// Only shown when a real prayer/iqama notification fires while app is open.
// Theme-aware, no sound/vibration (system notification handles that).
function InAppNotification({ title, body, prayerName, onClose }: { title: string; body: string; prayerName?: string; onClose: () => void }) {
  const translateY = useRef(new Animated.Value(-160)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  // Progress bar animates from 1 (full) → 0 (empty) over the auto-dismiss duration.
  // useNativeDriver:false is required for layout-based animations like 'width'.
  const progressAnim = useRef(new Animated.Value(1)).current;
  const dismissedRef = useRef(false);
  const { isDark, colors: C } = useTheme();

  const AUTO_DISMISS_MS = 8000;

  // Prayer-specific icons removed — no icon shown in the banner.

  useEffect(() => {
    // Slide in with spring feel
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true }),
    ]).start();

    // Progress bar depletes linearly over the auto-dismiss window
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: AUTO_DISMISS_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, { toValue: -160, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  // Gradient colours mirror the app's card/surface palette exactly
  const gradientColors: readonly [string, string] = isDark
    ? ['#141D24', '#1C2830']
    : ['#FFFFFF', '#F6F3EC'];

  const accent = C.accent.gold;
  // Icon container: same treatment as enhancedIconContainer in prayer cards
  const outerBorder = isDark ? 'rgba(240,214,97,0.15)' : 'rgba(212,175,55,0.18)';
  const progressTrack = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const closeBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          marginTop: (Constants.statusBarHeight || 28) + 8,
          marginHorizontal: 12,
          borderRadius: 20,
          overflow: 'hidden',
          elevation: 14,
          zIndex: 9999,
          // iOS shadow — neutral, not gold-tinted
          shadowColor: isDark ? '#000000' : '#1A1A1A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 12,
          borderWidth: 1,
          borderColor: outerBorder,
        },
        { transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      {/* Gradient background — matches the app's card surface palette */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 }}>

          {/* Left vertical gold accent stripe — gives the banner its character */}
          <View style={{
            width: 3,
            height: 44,
            borderRadius: 2,
            backgroundColor: accent,
            marginRight: 14,
            opacity: 0.85,
          }} />

          {/* Icon container removed — clean text-only layout */}

          {/* Text block */}
          <View style={{ flex: 1, marginRight: 4 }}>
            {/* Prayer name — primary text, the gold stripe/icon carry the accent */}
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: C.text.primary,
                letterSpacing: 0.2,
                marginBottom: 3,
              }}
            >
              {prayerName ? `${prayerName} Prayer` : title}
            </Text>
            {/* Body / subtitle */}
            <Text
              numberOfLines={2}
              style={{
                fontSize: 13,
                fontWeight: '400',
                color: C.text.secondary,
                lineHeight: 17,
              }}
            >
              {body}
            </Text>
          </View>

          {/* Close button */}
          <TouchableOpacity
            onPress={dismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: closeBg,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'flex-start',
              marginTop: 1,
            }}
          >
            <MaterialCommunityIcons name="close" size={13} color={C.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Countdown progress bar — depletes over the auto-dismiss duration */}
        <View style={{ height: 2.5, backgroundColor: progressTrack }}>
          <Animated.View
            style={{
              height: '100%',
              backgroundColor: accent,
              opacity: 0.55,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function InnerLayout() {
  console.log('[PRYR_DEBUG] InnerLayout: render');
  const [notification, setNotification] = useState<{ title: string; body: string; data?: any } | null>(null);
  const lastReceivedAtRef = useRef(0); // Track when last notification was received (ref to avoid re-subscribing listener)
  // Removed blocking splash: we no longer delay initial render for assets
  const [assetsLoaded, setAssetsLoaded] = useState(true);
  const { isDark, colors: themeColors } = useTheme();
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

  // When the scheduler says we should prompt, trigger the opener via useEffect
  // (not during render) to avoid React state-update-during-render warnings.
  useEffect(() => {
    if (shouldPromptSupport) {
      (globalThis as any).__openSupportPaywall?.();
    }
  }, [shouldPromptSupport]);

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
    }; return () => {
      // @ts-ignore
      global.__openSupportPaywall = undefined;
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

    // ── Foreground notification listener ──────────────────────────────────
    // Show in-app banner ONLY for real prayer/iqama notifications that fire
    // at the exact prayer time while the app is open. No banner for test,
    // push, or stale notifications. No sound/vibration — the system
    // notification already handles that.
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      // PRESS → handle deep-link actions (app-update, open-surah, etc.)
      if (type === 1) { // EventType.PRESS
        try {
          const { handleNotificationAction } = require('../utils/pushNotifications');
          handleNotificationAction(detail.notification?.data as Record<string, string>);
        } catch (e) {
          console.log('⚠️ Notification action handler failed:', (e as any)?.message);
        }
        return;
      }

      // Only proceed on DELIVERED (type 3 in Notifee v7+) or DISPLAYED (type 0)
      // to cover all Notifee versions
      if (type !== 3 && type !== 0) return;

      const notification = detail.notification;
      const data = notification?.data;
      const notifType = data?.type as string | undefined;

      // Only show banner for real prayer / iqama notifications
      if (notifType !== 'prayer-time' && notifType !== 'prayer-reminder' && notifType !== 'iqama-reminder') {
        return;
      }

      // Staleness guard: if the notification was scheduled for >90s ago, skip.
      // This prevents banners from appearing when reopening the app after prayer time.
      const scheduledTs = Number(data?.scheduledTimestamp);
      if (scheduledTs && (Date.now() - scheduledTs) > 90 * 1000) {
        console.log(`🔕 Skipping stale in-app banner for ${data?.prayerName} (${Math.round((Date.now() - scheduledTs) / 1000)}s old)`);
        return;
      }

      // De-duplicate rapid deliveries (e.g. re-renders)
      const now = Date.now();
      if (now - lastReceivedAtRef.current < 1500) return;
      lastReceivedAtRef.current = now;

      const prayerName = data?.prayerName as string || 'Prayer';
      setNotification({
        title: notification?.title || `${prayerName} Time`,
        body: notification?.body || `It's time for ${prayerName}`,
        data: { ...data, prayerName },
      });
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Stable subscription — lastReceivedAtRef is a ref, no deps needed

  // ── Push Notifications (Firebase Cloud Messaging) ──────────────────────
  // Initialize FCM: get token, subscribe to topics, set up foreground handler.
  // Runs once on mount. Foreground handler displays remote pushes via Notifee.
  useEffect(() => {
    let foregroundUnsub: (() => void) | null = null;
    let tokenRefreshUnsub: (() => void) | null = null;
    let onOpenedAppUnsub: (() => void) | null = null;

    const initPush = async () => {
      try {
        console.log('[PRYR_DEBUG] _layout initPush: starting FCM setup');
        const {
          initializePushNotifications,
          setupForegroundHandler,
          setupTokenRefreshListener,
          handleNotificationAction,
        } = require('../utils/pushNotifications');
        const messaging = require('@react-native-firebase/messaging').default;

        await initializePushNotifications();
        foregroundUnsub = setupForegroundHandler();
        tokenRefreshUnsub = setupTokenRefreshListener();

        // ── Background → foreground: user tapped a system-displayed FCM notification ──
        // Notifee's onForegroundEvent only tracks Notifee-created notifications.
        // FCM notification-type messages are auto-displayed by the OS, so we must
        // use Firebase's own listener to detect taps when the app was backgrounded.
        onOpenedAppUnsub = messaging().onNotificationOpenedApp(
          async (remoteMessage: any) => {
            console.log('🔔 Firebase onNotificationOpenedApp:', remoteMessage?.data);
            if (remoteMessage?.data) {
              await handleNotificationAction(remoteMessage.data as Record<string, string>);
            }
          },
        );

        // ── Cold start: app was killed, user tapped a system-displayed FCM notification ──
        // messaging().getInitialNotification() returns the message that opened the app.
        const initialMessage = await messaging().getInitialNotification();
        if (initialMessage?.data) {
          console.log('🔔 Firebase getInitialNotification:', initialMessage.data);
          await handleNotificationAction(initialMessage.data as Record<string, string>);
        }
      } catch (e) {
        console.log('⚠️ Push notification init skipped:', e);
      }
    };

    initPush();

    return () => {
      foregroundUnsub?.();
      tokenRefreshUnsub?.();
      onOpenedAppUnsub?.();
    };
  }, []);



  // (No startup animation / blocking screen anymore)

  // Onboarding state
  const { isReady: onboardingReady, welcomeComplete, completeWelcome } = useOnboarding();

  // Don't render anything until onboarding state is loaded from storage
  if (!onboardingReady) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#0E1317' : '#F5F1E6' }} />;
  }

  // Show welcome slides on first launch
  if (!welcomeComplete) {
    return (
      <>
        <StatusBar
          style={isDark ? 'light' : 'dark'}
          backgroundColor={Platform.OS === 'android' ? 'transparent' : undefined}
          translucent={true}
        />
        <WelcomeSlides onComplete={completeWelcome} />
      </>
    );
  }

  return (
    <>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={Platform.OS === 'android' ? 'transparent' : undefined}
        translucent={true}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: themeColors.background.primary
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {notification && (
        <InAppNotification
          title={notification.title}
          body={notification.body}
          prayerName={notification.data?.prayerName as string}
          onClose={() => setNotification(null)}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SafeAreaProvider>
          <PurchaseProvider>
            <OnboardingProvider>
              <InnerLayout />
            </OnboardingProvider>
          </PurchaseProvider>
        </SafeAreaProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

// InAppNotification styles are now inline & theme-driven — no static StyleSheet needed.
