import React, { useState, useRef, useEffect } from 'react';
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

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DuaItem = ({ dua, isLast, styles, colors, language }: any) => {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const title = language === 'ar' && dua.titleAr ? dua.titleAr : dua.title;
  const text = language === 'ar' && dua.textAr ? dua.textAr : dua.text;

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.7}
      style={[
        styles.duaItem,
        isLast && styles.lastDuaItem,
      ]}
    >
      <View style={styles.duaRow}>
        <Text style={[styles.duaTitle, { textAlign: language === 'ar' ? 'right' : 'left' }]}>{title}</Text>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.text.secondary}
        />
      </View>

      {expanded && (
        <View style={styles.duaContent}>
          {dua.isInfo ? (
            <Text style={[styles.infoText, { textAlign: language === 'ar' ? 'right' : 'left' }]}>{text}</Text>
          ) : (
            <>
              {dua.arabic && <Text style={styles.arabicText}>{dua.arabic}</Text>}
              {dua.transliteration && <Text style={styles.transliteration}>{dua.transliteration}</Text>}
              {dua.translation && <Text style={styles.translation}>{dua.translation}</Text>}
              {dua.reference && <Text style={styles.reference}>— {dua.reference}</Text>}
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function DuaScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const categoryPositions = useRef<Record<string, number>>({});

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

  // Helper functions for dynamic colors (using centralized utilities)
  const goldTint = (opacity: number) => centralGoldTint(opacity, colors);

  // Keep dark mode cards on soft white overlay to match prior visual tone
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.035)' : colors.background.secondary;
  const subtleBorder = isDark ? goldTint(0.25) : goldTint(0.15);

  const styles = React.useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    container: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 0,
      paddingBottom: 90,
      backgroundColor: 'transparent',
    },
    headerWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) - 6, 0) : 0,
      paddingHorizontal: 8,
      paddingBottom: 2,
      backgroundColor: 'transparent',
      minHeight: 32,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      letterSpacing: 0.4,
      textAlign: 'center',
    },
    content: {
      paddingTop: 8,
      paddingBottom: 40,
    },
    // Single unified section card (like settings sections)
    sectionCard: {
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: language === 'ar' ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: goldTint(0.15),
    },
    sectionTitleRow: {
      flexDirection: language === 'ar' ? 'row-reverse' : 'row',
      alignItems: 'center',
      flex: 1,
    },
    sectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : goldTint(0.08),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: language === 'ar' ? 0 : 10,
      marginLeft: language === 'ar' ? 10 : 0,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.accent.gold,
      letterSpacing: 0.3,
      flex: 1,
      textAlign: language === 'ar' ? 'right' : 'left',
    },
    // Duas list inside the card (left-aligned, minimal styling)
    duasListContainer: {
      marginTop: 8,
    },
    duaItem: {
      paddingVertical: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    lastDuaItem: {
      borderBottomWidth: 0,
    },
    duaRow: {
      flexDirection: language === 'ar' ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    duaTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      letterSpacing: 0.2,
      flex: 1,
    },
    duaContent: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 0.5,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    arabicText: {
      fontSize: 26,
      fontWeight: '600',
      color: colors.text.primary,
      textAlign: 'right',
      marginBottom: 12,
      lineHeight: 42,
      fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'Roboto',
    },
    transliteration: {
      fontSize: 15,
      fontStyle: 'italic',
      color: colors.text.secondary,
      marginBottom: 10,
      lineHeight: 24,
      textAlign: language === 'ar' ? 'right' : 'left',
    },
    translation: {
      fontSize: 16,
      color: colors.text.primary,
      marginBottom: 8,
      lineHeight: 26,
      textAlign: language === 'ar' ? 'right' : 'left',
    },
    reference: {
      fontSize: 13,
      color: colors.text.tertiary,
      marginTop: 6,
      fontStyle: 'italic',
      textAlign: language === 'ar' ? 'right' : 'left',
    },
    infoText: {
      fontSize: 16,
      color: colors.text.primary,
      lineHeight: 26,
    },
  }), [colors, isDark, language, cardBg, subtleBorder]);

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'morning': return 'weather-sunset-up';
      case 'azan': return 'mosque';
      case 'sleeping': return 'bed';
      case 'visiting_deceased': return 'grave-stone';
      case 'death_news_category': return 'alert-circle-outline';
      case 'eid': return 'star-crescent';
      case 'guidance': return 'compass';
      case 'funeral': return 'account-group';
      default: return 'book-open-variant';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ExpoLinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={styles.container}>
        {/* Minimal header like settings */}
        <View style={styles.headerWrapper}>
          <Text style={styles.headerTitle}>{t('duasTitle')}</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {DUA_CATEGORIES.map((category) => {
            const isExpanded = expandedCategory === category.id;
            const categoryTitle = language === 'ar' && category.titleAr ? category.titleAr : category.title;

            return (
              <View
                key={category.id}
                style={styles.sectionCard}
                onLayout={(e) => recordLayout(category.id, e.nativeEvent.layout.y)}
              >
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleCategory(category.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionIcon}>
                      <MaterialCommunityIcons
                        name={getCategoryIcon(category.id) as any}
                        size={18}
                        color={colors.accent.gold}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>{categoryTitle}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.duasListContainer}>
                    {category.duas.map((dua: any, index: number) => (
                      <DuaItem
                        key={dua.id}
                        dua={dua}
                        isLast={index === category.duas.length - 1}
                        styles={styles}
                        colors={colors}
                        language={language}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
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
