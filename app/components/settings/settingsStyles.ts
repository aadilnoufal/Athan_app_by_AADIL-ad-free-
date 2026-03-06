/**
 * Settings Screen Styles
 *
 * Factory function to create theme-aware styles for the settings screen.
 * Extracted from settings.tsx for maintainability.
 */
import { StyleSheet, StatusBar, Platform } from 'react-native';
import { goldTint, withAlpha } from '../../../utils/colorHelpers';

/**
 * Factory to create theme-aware styles so dark mode updates instantly.
 * Accepts the full theme `colors` palette and a `isDark` boolean.
 */
export const createSettingsStyles = (colors: any, isDark: boolean) => {
  // Use centralized color utilities - no more hardcoded gold RGB!
  const localGoldTint = (alpha: number) => goldTint(alpha, colors);

  // Keep dark mode overlays soft to preserve original visual tone
  const cardBg = isDark ? 'rgba(255,255,255,0.038)' : colors.background.secondary;
  const subCardBg = isDark ? 'rgba(255,255,255,0.030)' : colors.background.tertiary;
  const faintLayer = isDark ? 'rgba(255,255,255,0.022)' : withAlpha(colors.background.secondary, 0.5);
  const optionBg = isDark ? 'rgba(255,255,255,0.014)' : withAlpha(colors.background.secondary, 0.3);

  const selectionBg = isDark ? localGoldTint(0.10) : localGoldTint(0.08);
  const selectionBorder = isDark ? localGoldTint(0.35) : localGoldTint(0.25);
  const subtleBorder = isDark ? localGoldTint(0.25) : localGoldTint(0.15);
  const faintBorder = isDark ? localGoldTint(0.18) : localGoldTint(0.10);
  const extraFaintBorder = isDark ? localGoldTint(0.12) : localGoldTint(0.08);
  const translucentGoldLayer = isDark ? localGoldTint(0.05) : localGoldTint(0.1);

  return StyleSheet.create({
    // ✨ ENHANCED LAYOUT STYLES FROM HOMEPAGE ✨
    safeArea: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    container: {
      flex: 1,
      paddingHorizontal: 12, // Match homepage padding
      paddingTop: 0,
      paddingBottom: 90, // Extra padding for tab bar
      backgroundColor: 'transparent', // Make transparent to show gradient
    },

    // ✨ MAGICAL HEADER STYLES ✨
    // Standard header (replaces magical header)
    standardHeaderWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) - 6, 0) : 0,
      paddingHorizontal: 8,
      paddingBottom: 2,
      backgroundColor: 'transparent',
      minHeight: 32,
    },
    standardBackButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface.secondary,
      borderWidth: 0.5,
      borderColor: colors.border.light,
    },
    standardHeaderTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      letterSpacing: 0.4,
    },

    // Enhanced Scroll View
    enhancedScrollView: {
      flex: 1,
    },
    enhancedScrollViewContent: {
      paddingBottom: 40,
    },

    // ✨ ENHANCED SECTION STYLES ✨
    enhancedSection: {
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      position: 'relative',
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: subtleBorder,
    },
    enhancedSectionTitle: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
      letterSpacing: 0.4,
    },

    // ✨ THEME SELECTOR STYLES ✨
    themeGrid: {
      flexDirection: 'column',
      gap: 10,
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      backgroundColor: subCardBg,
      borderWidth: 1,
      borderColor: faintBorder,
      position: 'relative',
    },
    themeOptionSelected: {
      backgroundColor: selectionBg,
      borderColor: colors.accent.gold,
      borderWidth: 1.5,
    },
    themeSwatch: {
      width: 52,
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
      padding: 6,
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      overflow: 'hidden',
    },
    themeAccentBar: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      marginBottom: 5,
    },
    themeTextPreview: {
      width: '80%',
      height: 3,
      borderRadius: 1.5,
      marginBottom: 3,
      opacity: 0.7,
    },
    themeTextPreviewShort: {
      width: '50%',
      height: 3,
      borderRadius: 1.5,
      opacity: 0.5,
    },
    themeInfo: {
      flex: 1,
      marginLeft: 12,
    },
    themeNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    themeName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
      letterSpacing: 0.3,
    },
    themeNameSelected: {
      color: colors.accent.gold,
    },
    themeDescription: {
      fontSize: 12,
      color: colors.text.tertiary,
      letterSpacing: 0.2,
    },
    themeCheckmark: {
      position: 'absolute',
      top: 8,
      right: 8,
    },

    // Enhanced Language Option Styles
    enhancedLanguageOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: subCardBg,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    selectedEnhancedLanguageOption: {
      backgroundColor: selectionBg,
      borderColor: selectionBorder,
    },
    enhancedLanguageName: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    selectedEnhancedLanguageName: {
      color: colors.accent.darkGold,
      fontWeight: '700',
    },

    // Enhanced Setting Container Styles
    enhancedSettingContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: subCardBg,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      marginBottom: 10,
    },
    enhancedSettingLabel: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.25,
    },

    // Enhanced Prayer Notification Styles
    enhancedPrayerNotificationSettings: {
      backgroundColor: faintLayer,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    enhancedSettingSubtitle: {
      color: colors.text.secondary,
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 12,
      letterSpacing: 0.3,
    },
    enhancedPrayerNotificationItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: optionBg,
      marginBottom: 6,
      borderWidth: 0.5,
      borderColor: extraFaintBorder,
    },
    enhancedPrayerLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    enhancedPrayerIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: localGoldTint(isDark ? 0.12 : 0.10),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    enhancedPrayerLabel: {
      color: colors.text.primary,
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0.25,
    },

    // Enhanced Sound Preference Styles
    enhancedSoundPreferenceContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: subCardBg,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      marginTop: 10,
    },
    enhancedSoundPrefTextContainer: {
      flex: 1,
      paddingRight: 12,
    },
    enhancedSettingDescription: {
      color: colors.text.secondary,
      fontSize: 11,
      marginTop: 2,
      letterSpacing: 0.2,
      lineHeight: 14,
    },

    // Enhanced Test Button Styles
    enhancedTestButtonsContainer: {
      marginTop: 16,
      alignItems: 'center',
    },
    enhancedTestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 16,
      minWidth: 180,
    },
    enhancedTestButtonText: {
      color: colors.text.inverse,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
      letterSpacing: 0.3,
    },

    // Enhanced Section Description
    enhancedSectionDescription: {
      color: colors.text.secondary,
      fontSize: 14,
      marginBottom: 16,
      letterSpacing: 0.3,
      lineHeight: 20,
    },

    // Enhanced Location Selector Styles
    enhancedLocationSelector: {
      backgroundColor: subCardBg,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      marginBottom: 8,
    },
    enhancedLocationSelectorHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    enhancedLocationLabel: {
      color: colors.text.secondary,
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    enhancedLocationSelection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: selectionBg,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    enhancedLocationValue: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '600',
      marginRight: 8,
      letterSpacing: 0.3,
    },

    // Enhanced Options Container Styles
    enhancedOptionsContainer: {
      backgroundColor: optionBg,
      borderRadius: 12,
      padding: 8,
      marginBottom: 12,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    enhancedOptionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 4,
      backgroundColor: optionBg,
      borderWidth: 0.5,
      borderColor: extraFaintBorder,
    },
    selectedEnhancedOptionItem: {
      backgroundColor: selectionBg,
      borderColor: selectionBorder,
    },
    enhancedOptionName: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    selectedEnhancedOptionName: {
      color: colors.accent.darkGold,
      fontWeight: '600',
    },

    // Enhanced Location Summary Styles
    enhancedLocationSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: localGoldTint(isDark ? 0.08 : 0.06),
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
      borderWidth: 0.5,
      borderColor: selectionBorder,
    },
    enhancedLocationSummaryText: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 12,
      flex: 1,
      letterSpacing: 0.3,
      lineHeight: 20,
    },

    // Enhanced Update Location Button
    enhancedUpdateLocationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      marginTop: 16,
      minWidth: 180,
    },
    enhancedUpdateLocationButtonText: {
      color: colors.text.inverse,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
      letterSpacing: 0.3,
    },

    // Enhanced About Section Styles
    enhancedAboutContainer: {
      backgroundColor: faintLayer,
      borderRadius: 16,
      padding: 16,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    enhancedAppVersion: {
      color: colors.accent.gold,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    enhancedAboutText: {
      color: colors.text.secondary,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 20,
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    enhancedSupportButtonsContainer: {
      alignItems: 'center',
    },
    enhancedSupportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 16,
      minWidth: 160,
    },
    enhancedSupportButtonText: {
      color: colors.text.inverse,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
      letterSpacing: 0.3,
    },

    // =============================================================
    // The remaining (legacy/original) styles are kept mostly intact
    // but with palette references switched to current theme colors
    // for consistency across dark / light modes.
    // =============================================================

    // Original styles with homepage enhancements
    container_old: {
      flex: 1,
      backgroundColor: colors.background.primary, // Main background like homepage
      paddingBottom: 90, // Account for tab bar height + safe area
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 0,
      paddingHorizontal: 6,
      marginBottom: 0,
      borderRadius: 14,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 2 : 4,
      minHeight: 34,
    },
    backButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: localGoldTint(isDark ? 0.10 : 0.08),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    headerTitle: {
      color: colors.text.primary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      textAlign: 'center',
      flex: 1,
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: 12, // Match homepage padding
    },
    section: {
      margin: 8, // Reduced spacing like homepage
      padding: 16,
      backgroundColor: cardBg, // Themed card
      borderRadius: 20,
      borderWidth: 0.5,
      borderColor: subtleBorder,
      marginBottom: 12, // Add bottom margin for spacing
    },
    sectionTitle: {
      color: colors.accent.gold,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12, // Reduced from 16
      letterSpacing: 0.5,
    },
    sectionDescription: {
      color: colors.text.secondary,
      fontSize: 14, // Reduced from 16
      marginBottom: 12, // Reduced from 16
      letterSpacing: 0.3,
      lineHeight: 20,
    },
    settingContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12, // Reduced from 16
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: subtleBorder, // Subtle gold border
    },
    settingLabel: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600', // Increased from 500
      letterSpacing: 0.3,
    },
    settingSubtitle: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      fontWeight: '600', // Increased from 500
      marginVertical: 8, // Reduced from 10
      letterSpacing: 0.3,
    },
    prayerNotificationSettings: {
      marginTop: 8, // Reduced from 10
      backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
      borderRadius: 16,
      padding: 12,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    prayerNotificationItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10, // Reduced from 12
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: subtleBorder, // Subtle gold border
    },
    prayerLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: translucentGoldLayer, // Add subtle background
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    prayerLabel: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    collapsibleHeader: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
      borderRadius: 16, // Increased for elegant look
      overflow: 'hidden',
      borderWidth: 0.5, // Thinner border
      borderColor: selectionBorder, // Subtle gold border
    },
    locationSelectorHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12, // Reduced from 14
    },
    locationLabel: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      fontWeight: '600', // Increased from 500
      letterSpacing: 0.3,
    },
    locationSelection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: translucentGoldLayer, // Add subtle background
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    locationValue: {
      color: colors.accent.gold,
      fontSize: 15, // Reduced from 16
      fontWeight: '700', // Increased from 600
      marginRight: 6, // Reduced from 8
      letterSpacing: 0.3,
    },
    optionsContainer: {
      marginTop: 2,
      backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
      borderRadius: 12, // Increased for elegant look
      paddingVertical: 6, // Reduced from 8
      maxHeight: 200,
      borderWidth: 0.5, // Thinner border
      borderColor: selectionBorder, // Subtle gold border
    },
    optionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10, // Reduced from 12
      paddingHorizontal: 16,
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: subtleBorder, // Subtle gold border
    },
    selectedOptionItem: {
      backgroundColor: selectionBg, // Subtle gold highlight
    },
    optionName: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    selectedOptionName: {
      color: colors.accent.gold,
      fontWeight: '700', // Increased from bold
      letterSpacing: 0.3,
    },
    locationSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16, // Reduced from 20
      backgroundColor: 'rgba(255, 255, 255, 0.08)', // Transparent like main page
      padding: 14, // Reduced from 16
      borderRadius: 16, // Increased for elegant look
      borderWidth: 0.5, // Thinner border
      borderColor: selectionBorder, // Subtle gold border
    },
    locationSummaryText: {
      color: colors.text.primary,
      fontSize: 15, // Reduced from 16
      marginLeft: 10,
      flex: 1,
      fontWeight: '500',
      letterSpacing: 0.3,
      lineHeight: 20,
    },
    aboutContainer: {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
      borderRadius: 16,
      padding: 16,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    appVersion: {
      color: colors.text.primary,
      fontSize: 16, // Reduced from 18
      fontWeight: '700', // Increased from bold
      marginBottom: 10, // Reduced from 12
      letterSpacing: 0.5,
    },
    aboutText: {
      color: colors.text.secondary,
      fontSize: 14, // Reduced from 16
      textAlign: 'center',
      lineHeight: 22, // Reduced from 24
      marginBottom: 16, // Reduced from 20
      letterSpacing: 0.3,
    },
    supportButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      width: '100%',
      marginTop: 4, // Reduced from 5
    },
    supportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 18, // Reduced from 20
      paddingVertical: 10, // Reduced from 12
      borderRadius: 20, // Reduced from 24
    },
    supportButtonText: {
      color: colors.text.inverse,
      fontSize: 15, // Reduced from 16
      fontWeight: '700', // Increased from bold
      marginLeft: 6, // Reduced from 8
      letterSpacing: 0.3,
    },
    settingDescription: {
      color: colors.text.tertiary,
      fontSize: 13, // Reduced from 14
      marginTop: 3, // Reduced from 4
      letterSpacing: 0.3,
      lineHeight: 18,
    },
    testButtonsContainer: {
      marginTop: 12, // Reduced from 16
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
      borderRadius: 16,
      padding: 12,
      borderWidth: 0.5,
      borderColor: faintBorder,
    },
    testButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 14, // Reduced from 16
      paddingVertical: 8, // Reduced from 10
      borderRadius: 20, // Reduced from 24
      alignSelf: 'center',
      minWidth: 180, // Reduced from 200
      marginVertical: 4, // Add spacing between buttons
    },
    testButtonText: {
      color: colors.text.inverse,
      fontSize: 14, // Reduced from 16
      fontWeight: '700', // Increased from bold
      marginLeft: 6, // Reduced from 8
      letterSpacing: 0.3,
    },
    languageOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12, // Reduced from 16
      paddingHorizontal: 16, // Reduced from 20
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: subtleBorder, // Subtle gold border
    },
    selectedLanguageOption: {
      backgroundColor: selectionBg, // Subtle gold highlight
    },
    languageName: {
      color: colors.text.primary,
      fontSize: 16, // Reduced from 18
      fontWeight: '600', // Increased from 500
      letterSpacing: 0.3,
    },
    updateLocationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent.gold,
      paddingHorizontal: 14, // Reduced from 16
      paddingVertical: 8, // Reduced from 10
      borderRadius: 20, // Reduced from 24
      alignSelf: 'center',
      minWidth: 180, // Reduced from 200
      marginTop: 12, // Reduced from 16
    },
    updateLocationButtonText: {
      color: colors.text.inverse,
      fontSize: 14, // Reduced from 16
      fontWeight: '700', // Increased from bold
      marginLeft: 6, // Reduced from 8
      letterSpacing: 0.3,
    },
    // Fixed sound preference container with proper layout
    soundPreferenceContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12, // Reduced from 16
      borderBottomWidth: 0.5, // Thinner border
      borderBottomColor: subtleBorder, // Subtle gold border
    },
    soundPrefTextContainer: {
      flex: 1,
      paddingRight: 12, // Reduced from 16
      backgroundColor: faintLayer, // Subtle background themed
      borderRadius: 12,
      padding: 8,
      marginRight: 8,
    },
  });
};
