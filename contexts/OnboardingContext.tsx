import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage keys ──────────────────────────────────────
const KEYS = {
  welcomeComplete: 'onboarding_welcome_complete',
  tooltipHome: 'onboarding_tooltip_home',
  tooltipDua: 'onboarding_tooltip_dua',
  tooltipQuran: 'onboarding_tooltip_quran',
  tooltipQibla: 'onboarding_tooltip_qibla',
  tooltipSettings: 'onboarding_tooltip_settings',
} as const;

type TabName = 'home' | 'dua' | 'quran' | 'qibla' | 'settings';

interface OnboardingState {
  /** Whether the initial check has loaded from storage */
  isReady: boolean;
  /** Whether the welcome slides have been completed/skipped */
  welcomeComplete: boolean;
  /** Which tabs have already shown their tooltips */
  tooltipsShown: Record<TabName, boolean>;
}

interface OnboardingContextValue extends OnboardingState {
  /** Mark the welcome slides as done */
  completeWelcome: () => Promise<void>;
  /** Mark a tab's tooltips as shown */
  completeTooltip: (tab: TabName) => Promise<void>;
  /** Check whether a specific tab's tooltips should be shown */
  shouldShowTooltip: (tab: TabName) => boolean;
  /** Reset onboarding for testing/development */
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return ctx;
}

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [state, setState] = useState<OnboardingState>({
    isReady: false,
    welcomeComplete: false,
    tooltipsShown: {
      home: false,
      dua: false,
      quran: false,
      qibla: false,
      settings: false,
    },
  });

  // Load persisted state on mount
  useEffect(() => {
    const load = async () => {
      try {
        console.log('[PRYR_DEBUG] OnboardingContext: loading state from AsyncStorage');
        const results = await AsyncStorage.multiGet(Object.values(KEYS));
        const map = new Map(results as [string, string | null][]);

        setState({
          isReady: true,
          welcomeComplete: map.get(KEYS.welcomeComplete) === 'true',
          tooltipsShown: {
            home: map.get(KEYS.tooltipHome) === 'true',
            dua: map.get(KEYS.tooltipDua) === 'true',
            quran: map.get(KEYS.tooltipQuran) === 'true',
            qibla: map.get(KEYS.tooltipQibla) === 'true',
            settings: map.get(KEYS.tooltipSettings) === 'true',
          },
        });
      } catch (e) {
        console.error('[Onboarding] Failed to load state:', e);
        // Fall through with defaults — will show onboarding again
        setState(prev => ({ ...prev, isReady: true }));
      }
    };
    load();
  }, []);

  const completeWelcome = useCallback(async () => {
    try {
      await AsyncStorage.setItem(KEYS.welcomeComplete, 'true');
      setState(prev => ({ ...prev, welcomeComplete: true }));
    } catch (e) {
      console.error('[Onboarding] Failed to save welcome state:', e);
    }
  }, []);

  const completeTooltip = useCallback(async (tab: TabName) => {
    const key = KEYS[`tooltip${tab.charAt(0).toUpperCase()}${tab.slice(1)}` as keyof typeof KEYS];
    try {
      await AsyncStorage.setItem(key, 'true');
      setState(prev => ({
        ...prev,
        tooltipsShown: { ...prev.tooltipsShown, [tab]: true },
      }));
    } catch (e) {
      console.error(`[Onboarding] Failed to save tooltip state for ${tab}:`, e);
    }
  }, []);

  const shouldShowTooltip = useCallback(
    (tab: TabName): boolean => {
      return state.welcomeComplete && !state.tooltipsShown[tab];
    },
    [state.welcomeComplete, state.tooltipsShown],
  );

  const resetOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove(Object.values(KEYS));
      setState({
        isReady: true,
        welcomeComplete: false,
        tooltipsShown: {
          home: false,
          dua: false,
          quran: false,
          qibla: false,
          settings: false,
        },
      });
    } catch (e) {
      console.error('[Onboarding] Failed to reset:', e);
    }
  }, []);

  const value: OnboardingContextValue = useMemo(() => ({
    ...state,
    completeWelcome,
    completeTooltip,
    shouldShowTooltip,
    resetOnboarding,
  }), [state, completeWelcome, completeTooltip, shouldShowTooltip, resetOnboarding]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
