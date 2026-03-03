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
  /** Optional custom content renderer — replaces the default icon + message */
  customContent?: (params: {
    colors: any;
    gold: string;
    t: (key: string) => string;
    isDark: boolean;
    gt: (alpha: number) => string;
  }) => React.ReactNode;
}

// ── Props ─────────────────────────────────────────────
interface OnboardingTooltipsProps {
  /** Array of tooltip items to show sequentially */
  tooltips: TooltipItem[];
  /** Called when all tooltips have been dismissed */
  onComplete: () => void;
  /**
   * Optional callback fired before each tooltip is shown.
   * Receives the tooltip index — use it for scrolling to the relevant section.
   * Return a promise if the scroll/animation needs to finish before the tooltip appears.
   */
  onBeforeShow?: (index: number) => void | Promise<void>;
}

export default function OnboardingTooltips({
  tooltips,
  onComplete,
  onBeforeShow,
}: OnboardingTooltipsProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const gt = (alpha: number) => goldTint(alpha, colors);

  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const isAnimatingRef = useRef(false); // Guard against rapid taps

  const gold = colors.accent.gold;
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;

  // Animate in when index changes, calling onBeforeShow first
  useEffect(() => {
    const show = async () => {
      if (onBeforeShow) {
        await onBeforeShow(currentIndex);
      }
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
      ]).start(() => {
        isAnimatingRef.current = false; // Allow next tap once entrance completes
      });
    };
    show();
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    // Guard against rapid taps during animation
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

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
          {tip.customContent
            ? tip.customContent({ colors, gold, t, isDark, gt })
            : (
              <>
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
              </>
            )}

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

/** Renders a visual replica of the audio player with labelled controls. */
function renderAudioPlayerVisual({
  colors,
  gold,
  t,
  isDark,
  gt,
}: {
  colors: any;
  gold: string;
  t: (key: string) => string;
  isDark: boolean;
  gt: (alpha: number) => string;
}): React.ReactNode {
  const lbl = colors.text.secondary;
  const pri = colors.text.primary;
  const barBg = isDark ? 'rgba(30,30,30,0.9)' : 'rgba(240,240,240,0.95)';

  // Legend data: [iconName, label, isHighlighted?]
  const legend: [string, string, boolean?][] = [
    ['download-outline', t('tooltipLabelDownload')],
    ['stop-circle-outline', t('tooltipLabelStop')],
    ['skip-previous', t('tooltipLabelPrev')],
    ['play', t('tooltipLabelPlayPause'), true],
    ['skip-next', t('tooltipLabelNext')],
    ['crosshairs-gps', t('tooltipLabelScrollTo')],
  ];

  return (
    <>
      {/* Title row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 14,
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: gt(0.12), marginRight: 10,
        }}>
          <MaterialCommunityIcons name="music-box-outline" size={22} color={gold} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '700', color: pri }}>
          {t('tooltipAudioPlayerTitle')}
        </Text>
      </View>

      {/* ── Mini Player Replica ─────────────── */}
      <View style={{
        width: '100%' as any,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: gt(0.3),
        backgroundColor: barBg,
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 8,
        marginBottom: 14,
      }}>
        {/* Now-playing row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <MaterialCommunityIcons name="music-note" size={12} color={gold} />
          <Text style={{ flex: 1, fontSize: 10, color: lbl, marginLeft: 4, fontWeight: '500' }}>
            {t('nowPlaying')} · 3 / 286
          </Text>
          <MaterialCommunityIcons name="close" size={14} color={lbl} />
        </View>

        {/* Controls row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="download-outline" size={16} color={lbl} style={{ marginHorizontal: 3 }} />
          <MaterialCommunityIcons name="stop-circle-outline" size={18} color={pri} style={{ marginHorizontal: 3 }} />
          <MaterialCommunityIcons name="skip-previous" size={22} color={pri} style={{ marginHorizontal: 2 }} />
          <View style={{
            width: 34, height: 34, borderRadius: 17, backgroundColor: gold,
            alignItems: 'center', justifyContent: 'center', marginHorizontal: 6,
          }}>
            <MaterialCommunityIcons name="play" size={22} color={colors.text.inverse} />
          </View>
          <MaterialCommunityIcons name="skip-next" size={22} color={pri} style={{ marginHorizontal: 2 }} />
          <Text style={{ fontSize: 10, fontWeight: '600', color: lbl, marginHorizontal: 4 }}>3/286</Text>
          <MaterialCommunityIcons name="crosshairs-gps" size={16} color={gold} style={{ marginHorizontal: 3 }} />
        </View>
      </View>

      {/* ── Legend: 2×3 grid ────────────────── */}
      <View style={{ width: '100%' as any, marginBottom: 10 }}>
        {[0, 1, 2].map(row => (
          <View key={row} style={{ flexDirection: 'row', marginBottom: 8 }}>
            {[0, 1].map(col => {
              const [icon, label, hi] = legend[row * 2 + col];
              return (
                <View key={col} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={15}
                    color={hi ? gold : lbl}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{
                    fontSize: 12,
                    color: hi ? pri : lbl,
                    fontWeight: hi ? '600' : '400',
                  }}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Hint */}
      <Text style={{ fontSize: 13, color: lbl, fontStyle: 'italic', textAlign: 'center', marginBottom: 4 }}>
        {t('tooltipAudioHint')}
      </Text>
    </>
  );
}

export const QURAN_TOOLTIPS: TooltipItem[] = [
  {
    messageKey: 'tooltipQuranSearch',
    icon: 'magnify',
    position: 'top',
  },
  {
    messageKey: 'tooltipQuranAudioPlayer',
    icon: 'music-box-outline',
    position: 'center',
    customContent: renderAudioPlayerVisual,
  },
  {
    messageKey: 'tooltipQuranBookmark',
    icon: 'bookmark-outline',
    position: 'center',
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
    position: 'center',
  },
  {
    messageKey: 'tooltipSettingsNotifications',
    icon: 'bell-outline',
    position: 'center',
  },
  {
    messageKey: 'tooltipSettingsQuran',
    icon: 'book-open-page-variant',
    position: 'center',
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
