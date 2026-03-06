import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { goldTint as centralGoldTint, withAlpha } from '../../utils/colorHelpers';
import { DUA_CATEGORIES } from '../../constants/duas';
import { useLanguage } from '../../contexts/LanguageContext';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useOnboarding } from '../../contexts/OnboardingContext';
import OnboardingTooltips, { DUA_TOOLTIPS } from '../../components/OnboardingTooltips';
import { getQuranFontScale, getQuranFontFamily, QuranFontFamily } from '../../utils/quranStorage';
import * as Font from 'expo-font';
import { useFocusEffect } from '@react-navigation/native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Helpers ─────────────────────────────────────────────────────
const getCategoryIcon = (id: string): string => {
  switch (id) {
    case 'morning':              return 'weather-sunset-up';
    case 'azan':                 return 'mosque';
    case 'sleeping':             return 'weather-night';
    case 'visiting_deceased':    return 'grave-stone';
    case 'death_news_category':  return 'alert-circle-outline';
    case 'eid':                  return 'star-crescent';
    case 'guidance':             return 'compass-outline';
    case 'funeral':              return 'account-group';
    default:                     return 'book-open-variant';
  }
};

const getCategoryDescription = (id: string, isRTL: boolean): string => {
  switch (id) {
    case 'morning':              return isRTL ? 'أذكار وأدعية الصباح والمساء' : 'Morning remembrance & protection';
    case 'azan':                 return isRTL ? 'دعاء بعد الأذان' : 'Supplication after the call to prayer';
    case 'sleeping':             return isRTL ? 'أذكار النوم وآيات قرآنية' : 'Night prayers & Quranic recitations';
    case 'visiting_deceased':    return isRTL ? 'ما يقال عند زيارة القبور' : 'What to say when visiting graves';
    case 'death_news_category':  return isRTL ? 'ما يقال عند سماع خبر الوفاة' : 'Words upon hearing of a death';
    case 'guidance':             return isRTL ? 'دعاء طلب الهداية والاستخارة' : 'Seeking divine guidance in decisions';
    case 'funeral':              return isRTL ? 'خطوات صلاة الجنازة الكاملة' : 'Step-by-step funeral prayer guide';
    default:                     return '';
  }
};

// ─── Dua Content (shared between modes) ─────────────────────────
const DuaContent = ({
  dua,
  colors,
  isDark,
  language,
  goldTint,
  duaArabicFontSize,
  duaArabicLineHeight,
  arabicFontFamily,
}: any) => {
  const isRTL = language === 'ar';
  const text = isRTL && dua.textAr ? dua.textAr : dua.text;
  const referencePillBg = isDark ? 'rgba(255,255,255,0.06)' : goldTint(0.06);

  if (dua.isInfo) {
    return (
      <View style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        paddingVertical: 4,
      }}>
        <MaterialCommunityIcons
          name="information-outline"
          size={15}
          color={colors.accent.gold}
          style={{
            marginRight: isRTL ? 0 : 8,
            marginLeft: isRTL ? 8 : 0,
            marginTop: 3,
          }}
        />
        <Text style={{
          fontSize: 15,
          color: colors.text.secondary,
          lineHeight: 24,
          flex: 1,
          textAlign: isRTL ? 'right' : 'left',
        }}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* ── Arabic text — gold left/right border accent (no card box) ── */}
      {dua.arabic && (
        <View style={{
          borderLeftWidth: isRTL ? 0 : 3,
          borderRightWidth: isRTL ? 3 : 0,
          borderColor: goldTint(0.30),
          paddingLeft: isRTL ? 0 : 14,
          paddingRight: isRTL ? 14 : 0,
          paddingVertical: 10,
          marginBottom: 14,
          backgroundColor: isDark ? 'rgba(255,255,255,0.018)' : goldTint(0.025),
          borderRadius: 4,
        }}>
          <Text style={{
            fontSize: duaArabicFontSize,
            fontWeight: '400',
            color: colors.text.primary,
            textAlign: 'right',
            lineHeight: duaArabicLineHeight,
            fontFamily: arabicFontFamily || (Platform.OS === 'ios' ? 'Geeza Pro' : undefined),
          }}>
            {dua.arabic}
          </Text>
        </View>
      )}

      {/* ── Transliteration ── */}
      {dua.transliteration && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: colors.accent.gold,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 4,
            textAlign: isRTL ? 'right' : 'left',
          }}>
            {isRTL ? 'النطق' : 'TRANSLITERATION'}
          </Text>
          <Text style={{
            fontSize: 14,
            fontStyle: 'italic',
            color: colors.text.secondary,
            lineHeight: 22,
            textAlign: isRTL ? 'right' : 'left',
          }}>
            {dua.transliteration}
          </Text>
        </View>
      )}

      {/* ── Translation ── */}
      {dua.translation && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: colors.accent.gold,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 4,
            textAlign: isRTL ? 'right' : 'left',
          }}>
            {isRTL ? 'المعنى' : 'MEANING'}
          </Text>
          <Text style={{
            fontSize: 15,
            color: colors.text.primary,
            lineHeight: 24,
            textAlign: isRTL ? 'right' : 'left',
          }}>
            {dua.translation}
          </Text>
        </View>
      )}

      {/* ── Reference pill ── */}
      {dua.reference ? (
        <View style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          backgroundColor: referencePillBg,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 8,
        }}>
          <MaterialCommunityIcons
            name="book-open-outline"
            size={11}
            color={colors.accent.gold}
            style={{ marginRight: isRTL ? 0 : 5, marginLeft: isRTL ? 5 : 0 }}
          />
          <Text style={{
            fontSize: 11,
            fontWeight: '500',
            color: colors.text.tertiary,
            fontStyle: 'italic',
          }}>
            {dua.reference}
          </Text>
        </View>
      ) : null}
    </>
  );
};

// ─── Individual Dua (flat, no card wrapper) ─────────────────────
const DuaItem = ({
  dua,
  index,
  isLast,
  isExpanded,
  onToggle,
  colors,
  isDark,
  language,
  goldTint,
  duaArabicFontSize,
  duaArabicLineHeight,
  arabicFontFamily,
}: any) => {
  const fadeAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const prevExpanded = useRef(isExpanded);

  // Animate on expansion change (only when toggled individually, not on initial readAll mount)
  useEffect(() => {
    if (isExpanded !== prevExpanded.current) {
      if (isExpanded) {
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      } else {
        fadeAnim.setValue(1);
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }
      prevExpanded.current = isExpanded;
    }
  }, [isExpanded, fadeAnim]);

  const isRTL = language === 'ar';
  const title = isRTL && dua.titleAr ? dua.titleAr : dua.title;
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : goldTint(0.08);

  return (
    <View>
      {/* ── Title row (tap to toggle single dua) ── */}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.6}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingVertical: 13,
        }}
      >
        {/* Number badge */}
        <View style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: isExpanded ? goldTint(0.15) : (isDark ? goldTint(0.08) : goldTint(0.06)),
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: isRTL ? 0 : 10,
          marginLeft: isRTL ? 10 : 0,
          borderWidth: 0.5,
          borderColor: goldTint(0.15),
        }}>
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.accent.gold,
            includeFontPadding: false,
          }}>
            {index + 1}
          </Text>
        </View>

        {/* Title */}
        <Text
          numberOfLines={isExpanded ? undefined : 2}
          style={{
            fontSize: 15,
            fontWeight: isExpanded ? '600' : '500',
            color: isExpanded ? colors.text.primary : colors.text.secondary,
            letterSpacing: 0.15,
            flex: 1,
            textAlign: isRTL ? 'right' : 'left',
            lineHeight: 20,
          }}
        >
          {title}
        </Text>

        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={isExpanded ? colors.accent.gold : colors.text.muted}
          style={{ marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}
        />
      </TouchableOpacity>

      {/* ── Expanded content (flat — no card wrapper) ── */}
      {isExpanded && (
        <Animated.View style={{
          opacity: fadeAnim,
          paddingBottom: 12,
        }}>
          <DuaContent
            dua={dua}
            colors={colors}
            isDark={isDark}
            language={language}
            goldTint={goldTint}
            duaArabicFontSize={duaArabicFontSize}
            duaArabicLineHeight={duaArabicLineHeight}
            arabicFontFamily={arabicFontFamily}
          />
        </Animated.View>
      )}

      {/* ── Divider (except last) ── */}
      {!isLast && (
        <View style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: dividerColor,
        }} />
      )}
    </View>
  );
};

// ─── Category Section ───────────────────────────────────────────
const CategoryCard = ({
  category,
  isExpanded,
  onToggle,
  onLayout,
  colors,
  isDark,
  language,
  goldTint,
  duaArabicFontSize,
  duaArabicLineHeight,
  arabicFontFamily,
}: any) => {
  const isRTL = language === 'ar';
  const categoryTitle = isRTL && category.titleAr ? category.titleAr : category.title;
  const duaCount = category.duas.length;
  const description = getCategoryDescription(category.id, isRTL);

  // Track which duas are expanded & "read all" mode
  const [expandedDuas, setExpandedDuas] = useState<Set<string>>(new Set());
  const [readAll, setReadAll] = useState(false);

  // Reset state when category collapses
  useEffect(() => {
    if (!isExpanded) {
      setExpandedDuas(new Set());
      setReadAll(false);
    }
  }, [isExpanded]);

  const toggleDua = useCallback((duaId: string) => {
    setExpandedDuas(prev => {
      const next = new Set(prev);
      if (next.has(duaId)) {
        next.delete(duaId);
        // If all were expanded and user collapses one, exit readAll
        if (readAll) setReadAll(false);
      } else {
        next.add(duaId);
        // If user manually expanded all, turn on readAll
        if (next.size === category.duas.length) setReadAll(true);
      }
      return next;
    });
  }, [readAll, category.duas.length]);

  const handleReadAll = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (readAll) {
      // Collapse all
      setExpandedDuas(new Set());
      setReadAll(false);
    } else {
      // Expand all
      const allIds = new Set<string>(category.duas.map((d: any) => d.id));
      setExpandedDuas(allIds);
      setReadAll(true);
    }
  }, [readAll, category.duas]);

  const cardBg = isDark ? 'rgba(255,255,255,0.035)' : colors.surface.primary;
  const cardBorder = isDark ? goldTint(0.18) : goldTint(0.12);

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 18,
        marginBottom: 14,
        borderWidth: 0.5,
        borderColor: isExpanded ? goldTint(0.25) : cardBorder,
        overflow: 'hidden',
        ...Platform.select({
          ios: {
            shadowColor: isDark ? '#000' : 'rgba(45,40,36,0.12)',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.25 : 0.10,
            shadowRadius: 10,
          },
          android: {
            elevation: isDark ? 0 : 2,
          },
        }),
      }}
      onLayout={onLayout}
    >
      {/* ── Category header ── */}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.65}
        style={{ padding: 16 }}
      >
        <View style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
        }}>
          {/* Icon circle */}
          <View style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: isDark ? goldTint(0.10) : goldTint(0.07),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: isRTL ? 0 : 14,
            marginLeft: isRTL ? 14 : 0,
            borderWidth: 0.5,
            borderColor: goldTint(0.20),
          }}>
            <MaterialCommunityIcons
              name={getCategoryIcon(category.id) as any}
              size={21}
              color={colors.accent.gold}
            />
          </View>

          {/* Title + subtitle */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 17,
              fontWeight: '700',
              color: colors.accent.gold,
              letterSpacing: 0.3,
              textAlign: isRTL ? 'right' : 'left',
            }}>
              {categoryTitle}
            </Text>
            {description ? (
              <Text style={{
                fontSize: 12,
                color: colors.text.tertiary,
                marginTop: 3,
                letterSpacing: 0.2,
                textAlign: isRTL ? 'right' : 'left',
                lineHeight: 16,
              }}>
                {description}
              </Text>
            ) : null}
          </View>

          {/* Count badge + chevron */}
          <View style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
          }}>
            <View style={{
              backgroundColor: isDark ? goldTint(0.10) : goldTint(0.06),
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 10,
              marginRight: isRTL ? 0 : 8,
              marginLeft: isRTL ? 8 : 0,
              minWidth: 24,
              alignItems: 'center',
            }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.accent.gold,
                includeFontPadding: false,
              }}>
                {duaCount}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={isExpanded ? colors.accent.gold : colors.text.secondary}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Expanded duas list ── */}
      {isExpanded && (
        <View style={{ paddingBottom: 6 }}>
          {/* ── Action bar: gold divider + Read All button ── */}
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: goldTint(0.15),
            }} />
            <TouchableOpacity
              onPress={handleReadAll}
              activeOpacity={0.6}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                alignSelf: isRTL ? 'flex-start' : 'flex-end',
                paddingVertical: 10,
                paddingHorizontal: 2,
              }}
            >
              <MaterialCommunityIcons
                name={readAll ? 'collapse-all-outline' : 'expand-all-outline'}
                size={15}
                color={colors.accent.gold}
                style={{ marginRight: isRTL ? 0 : 5, marginLeft: isRTL ? 5 : 0 }}
              />
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: colors.accent.gold,
                letterSpacing: 0.3,
              }}>
                {readAll
                  ? (isRTL ? 'طي الكل' : 'Collapse All')
                  : (isRTL ? 'قراءة الكل' : 'Read All')
                }
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Duas list (flat — no sub-cards, just dividers) ── */}
          <View style={{ paddingHorizontal: 16 }}>
            {category.duas.map((dua: any, index: number) => (
              <DuaItem
                key={dua.id}
                dua={dua}
                index={index}
                isLast={index === category.duas.length - 1}
                isExpanded={expandedDuas.has(dua.id)}
                onToggle={() => toggleDua(dua.id)}
                colors={colors}
                isDark={isDark}
                language={language}
                goldTint={goldTint}
                duaArabicFontSize={duaArabicFontSize}
                duaArabicLineHeight={duaArabicLineHeight}
                arabicFontFamily={arabicFontFamily}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ────────────────────────────────────────────────
export default function DuaScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const categoryPositions = useRef<Record<string, number>>({});

  // ── Arabic text settings (synced with Quran settings) ──────────
  const [fontScale, setFontScale] = useState(1.2);
  const [arabicFontFamily, setArabicFontFamily] = useState<string | undefined>(undefined);
  const [fontsReady, setFontsReady] = useState(false);

  // Load font scale & family on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [scale, fontFam] = await Promise.all([
          getQuranFontScale(),
          getQuranFontFamily(),
        ]);

        // Load custom fonts if needed
        try {
          await Font.loadAsync({
            'Amiri': require('../../assets/fonts/Amiri-Regular.ttf'),
            'ScheherazadeNew': require('../../assets/fonts/ScheherazadeNew-Regular.ttf'),
          });
        } catch { /* fonts may already be loaded */ }

        if (!cancelled) {
          setFontScale(scale);
          if (fontFam !== 'default') {
            setArabicFontFamily(fontFam);
          }
          setFontsReady(true);
        }
      } catch {
        if (!cancelled) setFontsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Refresh font settings when screen is focused (user may have changed in settings)
  useFocusEffect(
    React.useCallback(() => {
      if (!fontsReady) return; // Don't refresh until initial load completes
      (async () => {
        try {
          const [scale, fontFam] = await Promise.all([
            getQuranFontScale(),
            getQuranFontFamily(),
          ]);
          setFontScale(scale);
          setArabicFontFamily(fontFam === 'default' ? undefined : fontFam);
        } catch { /* ignore */ }
      })();
    }, [fontsReady]),
  );

  // Computed font sizes (same base values as Quran for Arabic text)
  const duaArabicFontSize = Math.round(24 * fontScale);
  const duaArabicLineHeight = Math.round(42 * fontScale);

  // Onboarding tooltips
  const { shouldShowTooltip, completeTooltip } = useOnboarding();
  const [showTooltips, setShowTooltips] = useState(false);
  useEffect(() => {
    if (shouldShowTooltip('dua')) {
      const timer = setTimeout(() => setShowTooltips(true), 600);
      return () => clearTimeout(timer);
    }
  }, [shouldShowTooltip]);

  // Time-based gradient colors for dynamic backgrounds (matching settings)
  const getTimeBasedGradient = (): [string, string, string] => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 7) {
      return [colors.background.primary, colors.background.secondary, colors.surface.secondary];
    } else if (hour >= 7 && hour < 12) {
      return [colors.background.primary, colors.surface.elevated, colors.background.tertiary];
    } else if (hour >= 12 && hour < 15) {
      return [colors.surface.elevated, colors.background.secondary, colors.surface.secondary];
    } else if (hour >= 15 && hour < 18) {
      return [colors.background.secondary, colors.background.tertiary, colors.surface.secondary];
    } else if (hour >= 18 && hour < 20) {
      return [colors.background.tertiary, colors.surface.secondary, colors.background.tertiary];
    } else {
      return [colors.surface.secondary, colors.surface.secondary, colors.background.tertiary];
    }
  };
  const gradientColors: [string, string, string] = isDark
    ? [colors.background.primary, colors.background.secondary, colors.surface.primary]
    : getTimeBasedGradient();

  const recordLayout = (id: string, y: number) => {
    categoryPositions.current[id] = y;
  };

  const toggleCategory = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const willExpand = expandedCategory !== id;
    setExpandedCategory(prev => (prev === id ? null : id));
    if (willExpand) {
      setTimeout(() => {
        const y = categoryPositions.current[id];
        if (y !== undefined && scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(y - 12, 0), animated: true });
        }
      }, 120);
    }
  };

  // Helper function for dynamic gold color
  const goldTint = (opacity: number) => centralGoldTint(opacity, colors);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={['top']}>
      <ExpoLinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={{
        flex: 1,
        paddingHorizontal: 12,
        paddingBottom: 90,
        backgroundColor: 'transparent',
      }}>
        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) - 6, 0) : 0,
          paddingHorizontal: 8,
          paddingBottom: 4,
          backgroundColor: 'transparent',
          minHeight: 32,
        }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.text.primary,
            letterSpacing: 0.4,
            textAlign: 'center',
          }}>
            {t('duasTitle')}
          </Text>
        </View>

        {/* ── Decorative divider ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
          paddingHorizontal: 40,
        }}>
          <View style={{
            flex: 1,
            height: StyleSheet.hairlineWidth,
            backgroundColor: goldTint(0.20),
          }} />
          <MaterialCommunityIcons
            name="star-four-points"
            size={10}
            color={goldTint(0.35)}
            style={{ marginHorizontal: 10 }}
          />
          <View style={{
            flex: 1,
            height: StyleSheet.hairlineWidth,
            backgroundColor: goldTint(0.20),
          }} />
        </View>

        {/* ── Category list ── */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {DUA_CATEGORIES.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              isExpanded={expandedCategory === category.id}
              onToggle={() => toggleCategory(category.id)}
              onLayout={(e: any) => recordLayout(category.id, e.nativeEvent.layout.y)}
              colors={colors}
              isDark={isDark}
              language={language}
              goldTint={goldTint}
              duaArabicFontSize={duaArabicFontSize}
              duaArabicLineHeight={duaArabicLineHeight}
              arabicFontFamily={arabicFontFamily}
            />
          ))}
        </ScrollView>
      </View>

      {/* Onboarding tooltips overlay */}
      {showTooltips && (
        <OnboardingTooltips
          tooltips={DUA_TOOLTIPS}
          onComplete={() => {
            setShowTooltips(false);
            completeTooltip('dua');
          }}
        />
      )}
    </SafeAreaView>
  );
}
