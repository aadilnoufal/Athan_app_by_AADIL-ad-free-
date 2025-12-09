import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  LayoutAnimation, 
  Platform, 
  UIManager,
  NativeScrollEvent,
  NativeSyntheticEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { DUA_CATEGORIES } from '../../constants/duas';
import { useLanguage } from '../../contexts/LanguageContext';

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
    <View style={[
      styles.duaItem, 
      isLast && styles.lastDuaItem,
      expanded && { backgroundColor: colors.surface.elevated }
    ]}>
      <TouchableOpacity 
        onPress={toggle} 
        activeOpacity={0.7}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}
      >
        <Text style={[styles.duaTitle, { marginBottom: 0, flex: 1, textAlign: language === 'ar' ? 'right' : 'left' }]}>{title}</Text>
        <MaterialCommunityIcons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={colors.text.secondary} 
        />
      </TouchableOpacity>
      
      {expanded && (
        <View style={{ marginTop: 12 }}>
          {dua.isInfo ? (
            <Text style={[styles.infoText, { textAlign: language === 'ar' ? 'right' : 'left' }]}>{text}</Text>
          ) : (
            <>
              {dua.arabic && <Text style={styles.arabicText}>{dua.arabic}</Text>}
              {dua.transliteration && <Text style={styles.transliteration}>{dua.transliteration}</Text>}
              {dua.translation && <Text style={styles.translation}>{dua.translation}</Text>}
              {dua.reference && <Text style={styles.reference}>Ref: {dua.reference}</Text>}
            </>
          )}
        </View>
      )}
    </View>
  );
};

export default function DuaScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const categoryPositions = useRef<Record<string, number>>({});

  const recordLayout = (id: string, y: number) => {
    categoryPositions.current[id] = y;
  };

  const toggleCategory = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const willExpand = expandedCategory !== id;
    setExpandedCategory(prev => (prev === id ? null : id));
    if (willExpand) {
      // Defer scroll until layout recalculates
      setTimeout(() => {
        const y = categoryPositions.current[id];
        if (y !== undefined && scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(y - 12, 0), animated: true });
        }
      }, 120); // slight delay for animation/layout
    }
  };

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      backgroundColor: colors.surface.primary,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
      zIndex: 10,
      marginBottom: 10,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text.primary,
      letterSpacing: 0.5,
      textAlign: language === 'ar' ? 'right' : 'left',
    },
    headerSubtitle: {
      fontSize: 15,
      color: colors.text.secondary,
      marginTop: 6,
      fontWeight: '500',
      textAlign: language === 'ar' ? 'right' : 'left',
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 120,
    },
    categoryCard: {
      backgroundColor: colors.surface.secondary,
      borderRadius: 16,
      marginBottom: 12,
      overflow: 'hidden',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    },
    categoryHeader: {
      flexDirection: language === 'ar' ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    categoryTitleContainer: {
      flexDirection: language === 'ar' ? 'row-reverse' : 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: language === 'ar' ? 0 : 14,
      marginLeft: language === 'ar' ? 14 : 0,
    },
    categoryTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text.primary,
      letterSpacing: 0.3,
      flex: 1,
      textAlign: language === 'ar' ? 'right' : 'left',
    },
    duasContainer: {
      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    },
    duaItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    },
    lastDuaItem: {
      borderBottomWidth: 0,
    },
    duaTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.accent.gold,
      letterSpacing: 0.2,
    },
    arabicText: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
      textAlign: 'right',
      marginBottom: 12,
      marginTop: 8,
      lineHeight: 40,
      fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'Roboto',
    },
    transliteration: {
      fontSize: 14,
      fontStyle: 'italic',
      color: colors.text.secondary,
      marginBottom: 8,
      lineHeight: 22,
    },
    translation: {
      fontSize: 15,
      color: colors.text.primary,
      marginBottom: 8,
      lineHeight: 24,
    },
    reference: {
      fontSize: 12,
      color: colors.text.tertiary,
      textAlign: 'right',
      marginTop: 4,
      fontStyle: 'italic',
    },
    infoText: {
      fontSize: 15,
      color: colors.text.primary,
      lineHeight: 24,
      marginTop: 4,
    },
  }), [colors, isDark, language]);

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('duasTitle')}</Text>
        <Text style={styles.headerSubtitle}>{t('duasSubtitle')}</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {DUA_CATEGORIES.map((category) => {
          const isExpanded = expandedCategory === category.id;
          const categoryTitle = language === 'ar' && category.titleAr ? category.titleAr : category.title;
          
          return (
            <View
              key={category.id}
              style={styles.categoryCard}
              onLayout={(e) => recordLayout(category.id, e.nativeEvent.layout.y)}
            >
              <TouchableOpacity 
                style={styles.categoryHeader} 
                onPress={() => toggleCategory(category.id)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryTitleContainer}>
                  <View style={styles.iconContainer}>
                    <MaterialCommunityIcons 
                      name={getCategoryIcon(category.id) as any} 
                      size={24} 
                      color={colors.accent.gold} 
                    />
                  </View>
                  <Text style={styles.categoryTitle}>{categoryTitle}</Text>
                </View>
                <MaterialCommunityIcons 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color={colors.text.secondary} 
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.duasContainer}>
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
    </SafeAreaView>
  );
}
