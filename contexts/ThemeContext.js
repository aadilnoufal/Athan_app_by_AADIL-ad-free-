import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { SepiaColors } from '../constants/sepiaColors';

// Dark color palette mirroring the structure of SepiaColors
export const DarkColors = {
  background: {
  primary: '#0E1317', // Slightly deeper for better glow contrast
  secondary: '#141B21', // Lightened a touch
  tertiary: '#1B252B', // Lightened to increase separation from primary
  overlay: 'rgba(14,19,23,0.92)'
  },
  surface: {
  primary: '#1C262D', // Lightened ~4% for more readable text on blocks
  secondary: '#223039', // Slightly brighter for contrast against primary
  elevated: '#27343C', // Keep elevation differentiation
  transparent: 'rgba(39,52,60,0.85)'
  },
  text: {
  primary: '#FAF6EE', // Brighter for improved readability
  secondary: '#E1D6C7', // Was #C9BFAF
  tertiary: '#B9AD9B', // Was #A39683
  inverse: '#0E1317',
  muted: '#A0917E'
  },
  accent: {
  gold: '#F0D661', // Slightly brighter
  darkGold: '#D0AC34',
  amber: '#E1C05A',
  copper: '#C08048'
  },
  border: {
  light: 'rgba(240,214,97,0.22)', // Increased alpha for clearer separation
  medium: 'rgba(240,214,97,0.32)',
  dark: 'rgba(240,214,97,0.42)',
  accent: 'rgba(240,214,97,0.42)'
  },
  shadow: {
    light: 'rgba(0,0,0,0.3)',
    medium: 'rgba(0,0,0,0.45)',
    dark: 'rgba(0,0,0,0.6)'
  },
  status: {
    success: '#3F6E4F',
    warning: '#7D6934',
    error: '#8A3F2C',
    info: '#6C5518'
  },
  special: {
  nextPrayer: '#F0D661',
  active: '#D0AC34',
  disabled: '#45525A', // Slightly lighter for legibility if text ends up inside
  highlight: 'rgba(240,214,97,0.18)'
  }
};

const THEME_KEY = 'app_theme_mode_v1';

const ThemeContext = createContext({
  colors: SepiaColors,
  isDark: false,
  mode: 'light',
  toggleTheme: () => {},
  setTheme: (_m) => {},
  // transition helpers
  transitionProgress: new Animated.Value(0)
});

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState('light');
  const [prevBg, setPrevBg] = useState(null);
  const transitionProgress = useRef(new Animated.Value(0)).current;

  // Load persisted theme or system preference
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark') {
          setMode(stored);
        } else {
          const system = Appearance.getColorScheme();
            setMode(system === 'dark' ? 'dark' : 'light');
        }
      } catch {
        const system = Appearance.getColorScheme();
        setMode(system === 'dark' ? 'dark' : 'light');
      }
    })();
  }, []);

  const setTheme = useCallback(async (nextMode) => {
    // prepare transition
    const currentColors = mode === 'dark' ? DarkColors : SepiaColors;
    setPrevBg(currentColors.background.primary);
    transitionProgress.setValue(1); // fully visible overlay of old color
    setMode(nextMode);
    try { await AsyncStorage.setItem(THEME_KEY, nextMode); } catch {}
    // animate fade of previous color
    Animated.timing(transitionProgress, {
      toValue: 0,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start(() => {
      setPrevBg(null);
    });
  }, [mode, transitionProgress]);

  const toggleTheme = useCallback(() => {
    setTheme(mode === 'light' ? 'dark' : 'light');
  }, [mode, setTheme]);

  const currentColors = mode === 'dark' ? DarkColors : SepiaColors;
  const value = {
    colors: currentColors,
    isDark: mode === 'dark',
    mode,
    toggleTheme,
    setTheme,
    transitionProgress
  };

  return (
    <ThemeContext.Provider value={value}>
      <React.Fragment>
        {children}
        {prevBg && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: prevBg,
              opacity: transitionProgress,
              zIndex: 9999
            }}
          />
        )}
      </React.Fragment>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
