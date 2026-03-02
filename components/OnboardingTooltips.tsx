import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { goldTint } from '../utils/colorHelpers';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Tooltip data ──────────────────────────────────────
export interface TooltipItem {
  /** Translation key for the tooltip message */
  messageKey: string;
  /** Icon name (MaterialCommunityIcons) */
  icon: string;
  /** Vertical position hint: 'top' | 'center' | 'bottom' */
  position: 'top' | 'center' | 'bottom';
}

// ── Props ─────────────────────────────────────────────
interface OnboardingTooltipsProps {
  /** Array of tooltip items to show sequentially */
  tooltips: TooltipItem[];
  /** Called when all tooltips have been dismissed */
  onComplete: () => void;
}

export default function OnboardingTooltips({
  tooltips,
  onComplete,
}: OnboardingTooltipsProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const gt = (alpha: number) => goldTint(alpha, colors);

  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  const gold = colors.accent.gold;
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;

  // Animate in when index changes
  useEffect(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.85);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    // Animate out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (currentIndex < tooltips.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onComplete();
      }
    });
  }, [currentIndex, tooltips.length, onComplete, fadeAnim]);

  if (tooltips.length === 0) {
    return null;
  }

  const tip = tooltips[currentIndex];
  const isLast = currentIndex === tooltips.length - 1;

  // Position the tooltip card vertically
  const getTopOffset = () => {
    switch (tip.position) {
      case 'top':
        return SCREEN_HEIGHT * 0.15;
      case 'bottom':
        return SCREEN_HEIGHT * 0.55;
      case 'center':
      default:
        return SCREEN_HEIGHT * 0.35;
    }
  };

  return (
    <Modal transparent animationType="none" visible>
      {/* Semi-transparent overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleNext}
      >
        <View style={[styles.overlayBg, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]} />

        {/* Tooltip card */}
        <Animated.View
          style={[
            styles.tooltipCard,
            {
              top: getTopOffset(),
              backgroundColor: isDark ? colors.surface.elevated : colors.surface.primary,
              borderColor: gt(0.25),
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.tooltipIconBg, { backgroundColor: gt(0.12) }]}>
            <MaterialCommunityIcons
              name={tip.icon as any}
              size={28}
              color={gold}
            />
          </View>

          {/* Message */}
          <Text style={[styles.tooltipMessage, { color: textPrimary }]}>
            {t(tip.messageKey)}
          </Text>

          {/* Progress dots */}
          {tooltips.length > 1 && (
            <View style={styles.progressRow}>
              {tooltips.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: i === currentIndex ? gold : gt(0.2),
                      width: i === currentIndex ? 16 : 6,
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Action button */}
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.gotItBtn, { backgroundColor: gold }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.gotItText, { color: colors.text.inverse }]}>
              {isLast ? t('tooltipGotIt') : t('onboardingNext')}
            </Text>
          </TouchableOpacity>

          {/* Step counter */}
          <Text style={[styles.stepCounter, { color: textSecondary }]}>
            {currentIndex + 1} / {tooltips.length}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Predefined tooltip sets per tab ───────────────────
export const HOME_TOOLTIPS: TooltipItem[] = [
  {
    messageKey: 'tooltipHomeCountdown',
    icon: 'timer-sand',
    position: 'center',
  },
  {
    messageKey: 'tooltipHomeArrows',
    icon: 'gesture-swipe-horizontal',
    position: 'center',
  },
  {
    messageKey: 'tooltipHomeRegion',
    icon: 'map-marker-outline',
    position: 'top',
  },
];

export const DUA_TOOLTIPS: TooltipItem[] = [
  {
    messageKey: 'tooltipDuaCategories',
    icon: 'book-open-outline',
    position: 'center',
  },
];

export const QURAN_TOOLTIPS: TooltipItem[] = [
  {
    messageKey: 'tooltipQuranSearch',
    icon: 'magnify',
    position: 'top',
  },
  {
    messageKey: 'tooltipQuranTapAyah',
    icon: 'play-circle-outline',
    position: 'center',
  },
  {
    messageKey: 'tooltipQuranSettings',
    icon: 'cog-outline',
    position: 'bottom',
  },
];

export const QIBLA_TOOLTIPS: TooltipItem[] = [
  {
    messageKey: 'tooltipQiblaCompass',
    icon: 'compass-outline',
    position: 'center',
  },
];

export const SETTINGS_TOOLTIPS: TooltipItem[] = [
  {
    messageKey: 'tooltipSettingsLocation',
    icon: 'map-marker-outline',
    position: 'top',
  },
  {
    messageKey: 'tooltipSettingsNotifications',
    icon: 'bell-outline',
    position: 'center',
  },
  {
    messageKey: 'tooltipSettingsQuran',
    icon: 'book-open-page-variant',
    position: 'bottom',
  },
];

// ── Styles ────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
  },
  tooltipCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tooltipMessage: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  progressDot: {
    height: 6,
    borderRadius: 3,
  },
  gotItBtn: {
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
    marginBottom: 8,
  },
  gotItText: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '400',
  },
});
