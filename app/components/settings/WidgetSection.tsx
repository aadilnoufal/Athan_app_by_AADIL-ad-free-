import React from 'react';
import { View, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeModules } from 'react-native';

interface WidgetSectionProps {
  colors: any;
  styles: any;
  t: (key: string) => string;
}

/**
 * Widget section — lets users add home-screen widgets directly from settings.
 *
 * Android: Uses AppWidgetManager.requestPinAppWidget() (API 26+) to prompt
 *          the user to place a widget. Falls back to an instruction alert on
 *          older devices.
 * iOS:     Shows inline step-by-step instructions with visual guidance since
 *          iOS does not allow programmatic widget placement (WidgetKit has no
 *          API equivalent to Android's requestPinAppWidget). Users must add
 *          widgets manually via the home screen long-press → "+" menu.
 */
export const WidgetSection: React.FC<WidgetSectionProps> = ({
  colors: C,
  styles,
  t,
}) => {
  const handleAddWidget = () => {
    if (Platform.OS === 'android') {
      // Try native pin-widget API (Android 8.0+ / API 26+)
      try {
        const { WidgetPinModule } = NativeModules;
        if (WidgetPinModule?.requestPinWidget) {
          WidgetPinModule.requestPinWidget('small')
            .then((result: boolean) => {
              if (!result) {
                // Launcher doesn't support pinning or user dismissed
                showAndroidFallbackInstructions();
              }
            })
            .catch(() => {
              showAndroidFallbackInstructions();
            });
        } else {
          showAndroidFallbackInstructions();
        }
      } catch {
        showAndroidFallbackInstructions();
      }
    }
  };

  const handleAddLargeWidget = () => {
    if (Platform.OS === 'android') {
      try {
        const { WidgetPinModule } = NativeModules;
        if (WidgetPinModule?.requestPinWidget) {
          WidgetPinModule.requestPinWidget('large')
            .then((result: boolean) => {
              if (!result) {
                showAndroidFallbackInstructions();
              }
            })
            .catch(() => {
              showAndroidFallbackInstructions();
            });
        } else {
          showAndroidFallbackInstructions();
        }
      } catch {
        showAndroidFallbackInstructions();
      }
    }
  };

  const showAndroidFallbackInstructions = () => {
    Alert.alert(
      t('widgetAddTitle'),
      t('widgetAndroidInstructions'),
      [{ text: t('tooltipGotIt'), style: 'default' }],
    );
  };

  // ── iOS: inline step-by-step instructions ────────────────────────────
  if (Platform.OS === 'ios') {
    const steps = [
      { icon: 'gesture-tap-hold' as const, text: t('widgetIOSStep1') || 'Long-press on your home screen' },
      { icon: 'plus-circle-outline' as const, text: t('widgetIOSStep2') || 'Tap the "+" button (top-left corner)' },
      { icon: 'magnify' as const, text: t('widgetIOSStep3') || 'Search for "Prayer Times"' },
      { icon: 'check-circle-outline' as const, text: t('widgetIOSStep4') || 'Choose size & tap "Add Widget"' },
    ];

    return (
      <View style={styles.enhancedSection}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="widgets-outline" size={20} color={C.accent.gold} />
          <Text style={styles.enhancedSectionTitle}>{t('widgetSectionTitle')}</Text>
        </View>

        <Text style={[styles.enhancedSettingLabel, { marginBottom: 16, fontSize: 13, opacity: 0.7 }]}>
          {t('widgetSectionDesc')}
        </Text>

        {/* Widget previews */}
        <View style={{
          flexDirection: 'row',
          gap: 12,
          marginBottom: 20,
        }}>
          {/* Compact widget preview */}
          <View style={{
            flex: 1,
            backgroundColor: C.accent.gold + '10',
            borderRadius: 16,
            padding: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: C.accent.gold + '20',
          }}>
            <MaterialCommunityIcons name="clock-outline" size={28} color={C.accent.gold} />
            <Text style={{ color: C.text.primary, fontSize: 12, fontWeight: '600', marginTop: 6 }}>
              {t('widgetSmallTitle')}
            </Text>
            <Text style={{ color: C.text.secondary, fontSize: 10, marginTop: 2, textAlign: 'center' }}>
              {t('widgetSmallDesc')}
            </Text>
          </View>

          {/* Full widget preview */}
          <View style={{
            flex: 1,
            backgroundColor: C.accent.gold + '10',
            borderRadius: 16,
            padding: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: C.accent.gold + '20',
          }}>
            <MaterialCommunityIcons name="view-grid-outline" size={28} color={C.accent.gold} />
            <Text style={{ color: C.text.primary, fontSize: 12, fontWeight: '600', marginTop: 6 }}>
              {t('widgetLargeTitle')}
            </Text>
            <Text style={{ color: C.text.secondary, fontSize: 10, marginTop: 2, textAlign: 'center' }}>
              {t('widgetLargeDesc')}
            </Text>
          </View>
        </View>

        {/* How to add — inline steps */}
        <View style={{
          backgroundColor: C.accent.gold + '08',
          borderRadius: 14,
          padding: 16,
          borderWidth: 1,
          borderColor: C.accent.gold + '15',
        }}>
          <Text style={{
            color: C.text.primary,
            fontSize: 13,
            fontWeight: '600',
            marginBottom: 14,
          }}>
            {t('widgetIOSHowToAdd') || 'How to add:'}
          </Text>

          {steps.map((step, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: index < steps.length - 1 ? 12 : 0,
              }}
            >
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: C.accent.gold + '18',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <MaterialCommunityIcons name={step.icon} size={18} color={C.accent.gold} />
              </View>
              <Text style={{
                color: C.text.secondary,
                fontSize: 13,
                flex: 1,
                lineHeight: 18,
              }}>
                <Text style={{ color: C.accent.gold, fontWeight: '700' }}>{index + 1}. </Text>
                {step.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Android: add-to-home-screen buttons ──────────────────────────────
  return (
    <View style={styles.enhancedSection}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="widgets-outline" size={20} color={C.accent.gold} />
        <Text style={styles.enhancedSectionTitle}>{t('widgetSectionTitle')}</Text>
      </View>

      <Text style={[styles.enhancedSettingLabel, { marginBottom: 12, fontSize: 13, opacity: 0.7 }]}>
        {t('widgetSectionDesc')}
      </Text>

      {/* Small widget (2×2) */}
      <TouchableOpacity
        style={[styles.enhancedSettingContainer, { marginBottom: 8 }]}
        onPress={handleAddWidget}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: C.accent.gold + '15',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <MaterialCommunityIcons name="clock-outline" size={22} color={C.accent.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.enhancedSettingLabel}>{t('widgetSmallTitle')}</Text>
            <Text style={{ fontSize: 12, color: C.text.secondary, marginTop: 2 }}>
              {t('widgetSmallDesc')}
            </Text>
          </View>
        </View>
        <MaterialCommunityIcons name="plus-circle-outline" size={22} color={C.accent.gold} />
      </TouchableOpacity>

      {/* Large widget (4×2) */}
      <TouchableOpacity
        style={styles.enhancedSettingContainer}
        onPress={handleAddLargeWidget}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: C.accent.gold + '15',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <MaterialCommunityIcons name="view-grid-outline" size={22} color={C.accent.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.enhancedSettingLabel}>{t('widgetLargeTitle')}</Text>
            <Text style={{ fontSize: 12, color: C.text.secondary, marginTop: 2 }}>
              {t('widgetLargeDesc')}
            </Text>
          </View>
        </View>
        <MaterialCommunityIcons name="plus-circle-outline" size={22} color={C.accent.gold} />
      </TouchableOpacity>
    </View>
  );
};
