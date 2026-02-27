import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MagicalButton } from './MagicalButton';

interface LanguageItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface LanguageSectionProps {
  colors: any;
  availableLanguages: Record<string, any>;
  currentLang: string;
  changeLanguage: (langId: string) => void;
  styles: any;
  t: (key: string) => string;
}

/**
 * Language selection section — lists all available languages with a check mark
 * on the currently selected one.
 */
export const LanguageSection: React.FC<LanguageSectionProps> = ({
  colors: C,
  availableLanguages,
  currentLang,
  changeLanguage,
  styles,
  t,
}) => (
  <View style={styles.enhancedSection}>
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name="web" size={20} color={C.accent.gold} />
      <Text style={styles.enhancedSectionTitle}>{t('language')}</Text>
    </View>

    {Object.values(availableLanguages).map((lang) => {
      const typedLang = lang as LanguageItem;
      return (
        <MagicalButton
          key={typedLang.id}
          onPress={() => changeLanguage(typedLang.id)}
          style={[
            styles.enhancedLanguageOption,
            currentLang === typedLang.id && styles.selectedEnhancedLanguageOption,
          ]}
          glowColor={currentLang === typedLang.id ? C.accent.amber : C.accent.gold}
        >
          <Text
            style={[
              styles.enhancedLanguageName,
              currentLang === typedLang.id && styles.selectedEnhancedLanguageName,
            ]}
          >
            {typedLang.name}
          </Text>
          {currentLang === typedLang.id && (
            <MaterialCommunityIcons name="check" size={20} color={C.accent.gold} />
          )}
        </MagicalButton>
      );
    })}
  </View>
);
