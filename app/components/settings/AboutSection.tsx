import React from 'react';
import { View, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { MagicalButton } from './MagicalButton';

interface AboutSectionProps {
  colors: any;
  openDonation: () => void;
  iapLoading: boolean;
  styles: any;
  t: (key: string) => string;
}

/**
 * About section — app version, description, donation / support button,
 * and RevenueCat subscription management link.
 */
export const AboutSection: React.FC<AboutSectionProps> = ({
  colors: C,
  openDonation,
  iapLoading,
  styles,
  t,
}) => (
  <View style={styles.enhancedSection}>
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons
        name="information-outline"
        size={20}
        color={C.accent.gold}
      />
      <Text style={styles.enhancedSectionTitle}>{t('about')}</Text>
    </View>
    <View style={styles.enhancedAboutContainer}>
      <Text style={styles.enhancedAppVersion}>
        {`${t('appVersion')} v${Application.nativeApplicationVersion || '4.0'}`}
      </Text>
      <Text style={styles.enhancedAboutText}>
        {t('aboutText')}
      </Text>
      <View style={styles.enhancedSupportButtonsContainer}>
        <MagicalButton
          style={styles.enhancedSupportButton}
          onPress={openDonation}
          glowColor={C.accent.amber}
        >
          <MaterialCommunityIcons name="gift" size={18} color={C.text.inverse} />
          <Text style={styles.enhancedSupportButtonText}>{t('supportDeveloper')}</Text>
        </MagicalButton>

        {/* Subscription management for iOS and Android */}
        {(Platform.OS === 'ios' || Platform.OS === 'android') && (
          <View style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
            <TouchableOpacity
              style={[styles.enhancedTestButton, { backgroundColor: '#333' }]}
              onPress={() => Linking.openURL(
                Platform.OS === 'ios'
                  ? 'https://apps.apple.com/account/subscriptions'
                  : 'https://play.google.com/store/account/subscriptions'
              )}
              disabled={iapLoading}
            >
              <Text style={styles.enhancedTestButtonText}>{t('manageSubscriptions')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  </View>
);
