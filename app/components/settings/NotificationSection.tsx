import React from 'react';
import { View, Text, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MagicalButton } from './MagicalButton';

interface NotificationSectionProps {
  colors: any;
  notificationsEnabled: boolean;
  notificationSettings: Record<string, boolean>;
  useAzanSound: boolean;
  toggleNotifications: (value: boolean) => void;
  togglePrayerNotification: (prayer: string, value: boolean) => void;
  toggleSoundPreference: (value: boolean) => void;
  testNotification: () => void;
  checkNotificationStatus: () => void;
  styles: any;
  t: (key: string) => string;
}

/**
 * Notification settings section — master toggle, per-prayer toggles, azan sound
 * preference, and test / status buttons.
 *
 * ⚠️  All notification *logic* lives in `useSettingsNotifications` hook.
 * This component is purely presentational.
 */
export const NotificationSection: React.FC<NotificationSectionProps> = ({
  colors: C,
  notificationsEnabled,
  notificationSettings,
  useAzanSound,
  toggleNotifications,
  togglePrayerNotification,
  toggleSoundPreference,
  testNotification,
  checkNotificationStatus,
  styles,
  t,
}) => (
  <View style={styles.enhancedSection}>
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name="bell-outline" size={20} color={C.accent.gold} />
      <Text style={styles.enhancedSectionTitle}>{t('notifications')}</Text>
    </View>

    <View style={styles.enhancedSettingContainer}>
      <Text style={styles.enhancedSettingLabel}>{t('enableNotifications')}</Text>
      <Switch
        value={notificationsEnabled}
        onValueChange={toggleNotifications}
        trackColor={{ false: C.special.disabled, true: C.accent.gold }}
        thumbColor={notificationsEnabled ? C.accent.gold : C.surface.secondary}
      />
    </View>

    {notificationsEnabled && (
      <>
        <View style={styles.enhancedPrayerNotificationSettings}>
          <Text style={styles.enhancedSettingSubtitle}>{t('notifyMeFor')}:</Text>
          {Object.keys(notificationSettings).map((prayer) => (
            <View key={prayer} style={styles.enhancedPrayerNotificationItem}>
              <View style={styles.enhancedPrayerLabelContainer}>
                <View style={styles.enhancedPrayerIcon}>
                  <MaterialCommunityIcons
                    name={
                      prayer === 'Fajr' ? 'weather-sunset-up' :
                        prayer === 'Sunrise' ? 'white-balance-sunny' :
                          prayer === 'Dhuhr' ? 'sun-wireless' :
                            prayer === 'Asr' ? 'weather-sunny' :
                              prayer === 'Maghrib' ? 'weather-sunset-down' :
                                'weather-night'
                    }
                    size={20}
                    color={C.accent.gold}
                  />
                </View>
                <Text style={styles.enhancedPrayerLabel}>{t(prayer)}</Text>
              </View>
              <Switch
                value={notificationSettings[prayer]}
                onValueChange={(value: boolean) => togglePrayerNotification(prayer, value)}
                trackColor={{ false: C.special.disabled, true: C.accent.gold }}
                thumbColor={notificationSettings[prayer] ? C.accent.gold : C.surface.secondary}
              />
            </View>
          ))}
        </View>

        {/* Sound Preference */}
        <View style={styles.enhancedSoundPreferenceContainer}>
          <View style={styles.enhancedSoundPrefTextContainer}>
            <Text style={styles.enhancedSettingLabel}>{t('useAzanSound')}</Text>
            <Text style={styles.enhancedSettingDescription}>
              {t('beepExplanation')}
            </Text>
          </View>
          <Switch
            value={useAzanSound}
            onValueChange={toggleSoundPreference}
            trackColor={{ false: C.special.disabled, true: C.accent.gold }}
            thumbColor={useAzanSound ? C.accent.gold : C.surface.secondary}
          />
        </View>

        {/* Test Notification Buttons */}
        <View style={styles.enhancedTestButtonsContainer}>
          <MagicalButton
            style={styles.enhancedTestButton}
            onPress={testNotification}
            glowColor={C.accent.amber}
          >
            <MaterialCommunityIcons name="bell-ring" size={18} color={C.text.inverse} />
            <Text style={styles.enhancedTestButtonText}>{t('testNotification')}</Text>
          </MagicalButton>

          <MagicalButton
            style={[styles.enhancedTestButton, { marginTop: 10, backgroundColor: C.accent.copper }]}
            onPress={checkNotificationStatus}
            glowColor={C.accent.copper}
          >
            <MaterialCommunityIcons name="information-outline" size={18} color={C.text.inverse} />
            <Text style={styles.enhancedTestButtonText}>{t('status')}</Text>
          </MagicalButton>
        </View>
      </>
    )}
  </View>
);
