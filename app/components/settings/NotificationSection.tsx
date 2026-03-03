import React from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
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
  // Iqama notification props
  iqamaNotificationsEnabled: boolean;
  iqamaNotificationSettings: Record<string, boolean>;
  iqamaMinutesBefore: number;
  toggleIqamaNotifications: (value: boolean) => void;
  toggleIqamaPrayerNotification: (prayer: string, value: boolean) => void;
  setIqamaMinutes: (minutes: number) => void;
  // Iqama countdown visibility props
  iqamaCountdownEnabled: boolean;
  toggleIqamaCountdown: (value: boolean) => void;
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
  iqamaNotificationsEnabled,
  iqamaNotificationSettings,
  iqamaMinutesBefore,
  toggleIqamaNotifications,
  toggleIqamaPrayerNotification,
  setIqamaMinutes,
  iqamaCountdownEnabled,
  toggleIqamaCountdown,
  styles,
  t,
}) => {
  // Iqama prayers (no Sunrise)
  const iqamaPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const minuteOptions = [0, 1, 2, 3, 4, 5];

  return (
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

        {/* ── Iqama Notification Settings (compact) ── */}
        <View style={{
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 0.5,
          borderTopColor: C.border?.light || C.special.disabled,
        }}>
          {/* Iqama Countdown on Home Screen */}
          <View style={styles.enhancedSettingContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.enhancedSettingLabel}>{t('iqamaCountdown')}</Text>
              <Text style={[styles.enhancedSettingDescription, { fontSize: 11 }]}>
                {t('iqamaCountdownDesc')}
              </Text>
            </View>
            <Switch
              value={iqamaCountdownEnabled}
              onValueChange={toggleIqamaCountdown}
              trackColor={{ false: C.special.disabled, true: C.accent.gold }}
              thumbColor={iqamaCountdownEnabled ? C.accent.gold : C.surface.secondary}
            />
          </View>

          {/* Iqama Notifications */}
          <View style={[styles.enhancedSettingContainer, { marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.enhancedSettingLabel}>{t('iqamaNotifications')}</Text>
              <Text style={[styles.enhancedSettingDescription, { fontSize: 11 }]}>
                {t('iqamaNotifDesc')}
              </Text>
            </View>
            <Switch
              value={iqamaNotificationsEnabled}
              onValueChange={toggleIqamaNotifications}
              trackColor={{ false: C.special.disabled, true: C.accent.gold }}
              thumbColor={iqamaNotificationsEnabled ? C.accent.gold : C.surface.secondary}
            />
          </View>

          {iqamaNotificationsEnabled && (
            <View style={{ marginTop: 6 }}>
              {/* Minutes before selector - compact row of buttons */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }}>
                <Text style={[styles.enhancedSettingDescription, { marginRight: 8, fontSize: 12 }]}>
                  {t('iqamaMinsBefore')}:
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {minuteOptions.map((min) => (
                    <TouchableOpacity
                      key={min}
                      onPress={() => setIqamaMinutes(min)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: iqamaMinutesBefore === min ? C.accent.gold : (C.surface?.secondary || C.special.disabled),
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: iqamaMinutesBefore === min ? '700' : '500',
                        color: iqamaMinutesBefore === min ? (C.text?.inverse || '#fff') : C.text.secondary,
                      }}>
                        {min}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Per-prayer compact inline toggles */}
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                paddingHorizontal: 4,
              }}>
                {iqamaPrayers.map((prayer) => (
                  <TouchableOpacity
                    key={prayer}
                    onPress={() => toggleIqamaPrayerNotification(prayer, !iqamaNotificationSettings[prayer])}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 14,
                      backgroundColor: iqamaNotificationSettings[prayer] ? C.accent.gold : (C.surface?.secondary || C.special.disabled),
                      opacity: iqamaNotificationSettings[prayer] ? 1 : 0.6,
                    }}
                  >
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: iqamaNotificationSettings[prayer] ? (C.text?.inverse || '#fff') : C.text.secondary,
                    }}>
                      {t(prayer)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
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
};