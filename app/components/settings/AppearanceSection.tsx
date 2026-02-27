import React from 'react';
import { View, Text, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AppearanceSectionProps {
  colors: any;
  isDark: boolean;
  toggleTheme: () => void;
  styles: any;
  t: (key: string) => string;
}

/**
 * Appearance/Theme section — dark mode toggle.
 */
export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  colors: C,
  isDark,
  toggleTheme,
  styles,
  t,
}) => (
  <View style={styles.enhancedSection}>
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name="palette" size={20} color={C.accent.gold} />
      <Text style={styles.enhancedSectionTitle}>{t('appearance')}</Text>
    </View>
    <View style={styles.enhancedSettingContainer}>
      <Text style={styles.enhancedSettingLabel}>{t('darkMode')}</Text>
      <Switch
        value={isDark}
        onValueChange={toggleTheme}
        trackColor={{ false: C.special.disabled, true: C.accent.gold }}
        thumbColor={isDark ? C.accent.gold : C.surface.secondary}
      />
    </View>
  </View>
);
