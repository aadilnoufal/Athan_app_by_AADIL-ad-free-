import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { MagicalButton } from './MagicalButton';
import { goldTint } from '../../../utils/colorHelpers';
import type { QuranFontFamily, EditionPref } from '../../../utils/quranStorage';

interface QuranSettingsSectionProps {
  colors: any;
  isDark: boolean;
  quranEditionPref: string;
  quranFontScale: number;
  quranAutoScrollWithAudio: boolean;
  quranFontFamilyState: QuranFontFamily;
  quranTranslationEdition: string;
  quranReciter: string;
  translationEditions: Array<{ identifier: string; name: string;[key: string]: any }>;
  audioEditions: Array<{ identifier: string; name: string; englishName?: string;[key: string]: any }>;
  audioFullDownloading: boolean;
  audioDownloadProgress: { done: number; total: number } | null;
  translationDownloading: boolean;
  translationDownloadProgress: { done: number; total: number } | null;
  downloadedTranslationIds: Set<string>;
  setShowTranslationPicker: (show: boolean) => void;
  setShowReciterPicker: (show: boolean) => void;
  handleEditionPrefChange: (pref: EditionPref) => void;
  handleDownloadAllAudio: () => void;
  handleClearAllQuranDownloads: () => void;
  handleFontScaleChange: (value: number) => void;
  handleFontScaleChangeComplete: (value: number) => void;
  handleQuranAutoScrollToggle: (value: boolean) => void;
  handleFontFamilyChange: (family: QuranFontFamily) => void;
  styles: any;
  t: (key: string) => string;
}

/**
 * Quran settings section — edition preference, font size/family, auto-scroll,
 * translation & reciter pickers (open modals), and download/clear buttons.
 */
export const QuranSettingsSection: React.FC<QuranSettingsSectionProps> = ({
  colors: C,
  isDark,
  quranEditionPref,
  quranFontScale,
  quranAutoScrollWithAudio,
  quranFontFamilyState,
  quranTranslationEdition,
  quranReciter,
  translationEditions,
  audioEditions,
  audioFullDownloading,
  audioDownloadProgress,
  translationDownloading,
  translationDownloadProgress,
  downloadedTranslationIds,
  setShowTranslationPicker,
  setShowReciterPicker,
  handleEditionPrefChange,
  handleDownloadAllAudio,
  handleClearAllQuranDownloads,
  handleFontScaleChange,
  handleFontScaleChangeComplete,
  handleQuranAutoScrollToggle,
  handleFontFamilyChange,
  styles,
  t,
}) => {
  const gt = (alpha: number) => goldTint(alpha, C);
  const [sliderScale, setSliderScale] = useState(Number((Math.round(quranFontScale / 0.05) * 0.05).toFixed(2)));
  const isSlidingRef = useRef(false);

  // Keep slider synced with external state, but don't fight the user's drag.
  useEffect(() => {
    if (isSlidingRef.current) return;
    const next = Number((Math.round(quranFontScale / 0.05) * 0.05).toFixed(2));
    setSliderScale((prev) => (Math.abs(prev - next) >= 0.05 ? next : prev));
  }, [quranFontScale]);

  const stableScale = useMemo(
    () => Number((Math.round(sliderScale / 0.05) * 0.05).toFixed(2)),
    [sliderScale],
  );
  const scalePercent = Math.round(stableScale * 100);

  return (
    <View style={styles.enhancedSection}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons
          name="book-open-page-variant"
          size={20}
          color={C.accent.gold}
        />
        <Text style={styles.enhancedSectionTitle}>{t('quranSettings')}</Text>
      </View>

      {/* Default edition preference */}
      <Text style={styles.enhancedSettingSubtitle}>{t('defaultEdition')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <MagicalButton
          onPress={() => handleEditionPrefChange('arabic')}
          style={[
            styles.enhancedLanguageOption,
            { flex: 1 },
            quranEditionPref === 'arabic' && styles.selectedEnhancedLanguageOption,
          ]}
          glowColor={quranEditionPref === 'arabic' ? C.accent.amber : C.accent.gold}
        >
          <Text style={[
            styles.enhancedLanguageName,
            { fontSize: 13 },
            quranEditionPref === 'arabic' && styles.selectedEnhancedLanguageName,
          ]}>
            {t('arabicOnly')}
          </Text>
          {quranEditionPref === 'arabic' && (
            <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
          )}
        </MagicalButton>
        <MagicalButton
          onPress={() => handleEditionPrefChange('both')}
          style={[
            styles.enhancedLanguageOption,
            { flex: 1 },
            quranEditionPref === 'both' && styles.selectedEnhancedLanguageOption,
          ]}
          glowColor={quranEditionPref === 'both' ? C.accent.amber : C.accent.gold}
        >
          <Text style={[
            styles.enhancedLanguageName,
            { fontSize: 13 },
            quranEditionPref === 'both' && styles.selectedEnhancedLanguageName,
          ]}>
            {t('arabicAndTranslation')}
          </Text>
          {quranEditionPref === 'both' && (
            <MaterialCommunityIcons name="check" size={18} color={C.accent.gold} />
          )}
        </MagicalButton>
      </View>

      {/* Font size control */}
      <Text style={styles.enhancedSettingSubtitle}>{t('quranFontSize')}</Text>
      <View style={{ marginBottom: 14 }}>
        {/* Slider with min/max labels */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: C.text.tertiary, fontSize: 12 }}>A</Text>
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Slider
              minimumValue={0.75}
              maximumValue={1.5}
              step={0.05}
              value={stableScale}
              onSlidingStart={() => {
                isSlidingRef.current = true;
              }}
              onValueChange={(value) => {
                const next = Number((Math.round(value / 0.05) * 0.05).toFixed(2));
                setSliderScale(next);
                handleFontScaleChange(next);
              }}
              onSlidingComplete={(value) => {
                const next = Number((Math.round(value / 0.05) * 0.05).toFixed(2));
                setSliderScale(next);
                handleFontScaleChangeComplete(next);
                isSlidingRef.current = false;
              }}
              minimumTrackTintColor={C.accent.gold}
              maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}
              thumbTintColor={C.accent.gold}
            />
          </View>
          <Text style={{ color: C.text.tertiary, fontSize: 18, fontWeight: '700' }}>A</Text>
        </View>
        <Text style={{ color: C.accent.gold, fontWeight: '700', textAlign: 'center', fontSize: 14, marginBottom: 10 }}>
          {scalePercent}%
        </Text>

        {/* Live Arabic preview */}
        <View style={{
          borderRadius: 12,
          padding: 14,
          minHeight: 150,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderWidth: 0.5,
          borderColor: `${C.accent.gold}30`,
        }}>
          <Text style={{
            color: C.text.primary,
            fontSize: Math.round(24 * stableScale),
            lineHeight: Math.round(42 * stableScale),
            textAlign: 'right',
            marginBottom: 8,
          }}>
            {t('quranFontPreview')}
          </Text>
          <Text style={{
            color: C.text.secondary,
            fontSize: Math.round(16 * stableScale),
            lineHeight: Math.round(26 * stableScale),
          }}>
            {t('quranFontPreviewEn')}
          </Text>
        </View>
      </View>

      {/* Auto-scroll with audio */}
      <View style={[styles.enhancedSettingContainer, { marginBottom: 14 }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.enhancedSettingLabel}>{t('quranAutoScrollWithAudio')}</Text>
          <Text style={styles.enhancedSettingDescription}>{t('quranAutoScrollWithAudioDescription')}</Text>
        </View>
        <Switch
          value={quranAutoScrollWithAudio}
          onValueChange={handleQuranAutoScrollToggle}
          trackColor={{ false: C.special.disabled, true: C.accent.gold }}
          thumbColor={quranAutoScrollWithAudio ? C.accent.gold : C.surface.secondary}
        />
      </View>

      {/* Quran Arabic font family */}
      <Text style={styles.enhancedSettingSubtitle}>{t('quranFontFamily')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          { key: 'default' as QuranFontFamily, label: t('fontDefault') },
          { key: 'Amiri' as QuranFontFamily, label: t('fontAmiri') },
          { key: 'ScheherazadeNew' as QuranFontFamily, label: t('fontScheherazade') },
        ]).map(({ key, label }) => (
          <MagicalButton
            key={key}
            onPress={() => handleFontFamilyChange(key)}
            style={[
              styles.enhancedLanguageOption,
              { flex: 1, minWidth: 90 },
              quranFontFamilyState === key && styles.selectedEnhancedLanguageOption,
            ]}
            glowColor={quranFontFamilyState === key ? C.accent.amber : C.accent.gold}
          >
            <Text style={[
              styles.enhancedLanguageName,
              { fontSize: 12 },
              quranFontFamilyState === key && styles.selectedEnhancedLanguageName,
            ]}>
              {label}
            </Text>
            {quranFontFamilyState === key && (
              <MaterialCommunityIcons name="check" size={16} color={C.accent.gold} />
            )}
          </MagicalButton>
        ))}
      </View>

      {/* Translation edition picker */}
      <Text style={styles.enhancedSettingSubtitle}>{t('translationEdition')}</Text>
      <TouchableOpacity
        onPress={() => setShowTranslationPicker(true)}
        style={[styles.enhancedSettingContainer, { marginBottom: 14, borderWidth: 0.5, borderColor: gt(0.2), borderRadius: 10, paddingVertical: 10 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.enhancedSettingLabel, { fontWeight: '600' }]}>{t('currentTranslation')}</Text>
          <Text style={[styles.enhancedSettingDescription, { marginTop: 2 }]}>
            {translationEditions.find(e => e.identifier === quranTranslationEdition)?.name ?? quranTranslationEdition}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {downloadedTranslationIds.has(quranTranslationEdition) && (
            <MaterialCommunityIcons name="check-circle" size={16} color={C.accent.gold} style={{ marginRight: 6 }} />
          )}
          <MaterialCommunityIcons name="chevron-right" size={20} color={C.text.tertiary} />
        </View>
      </TouchableOpacity>

      {/* Translation download progress */}
      {translationDownloading && translationDownloadProgress && (
        <View style={[styles.enhancedSettingContainer, { marginBottom: 10, borderWidth: 0.5, borderColor: gt(0.15), borderRadius: 10, paddingVertical: 10, alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={C.accent.gold} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.enhancedSettingLabel, { fontWeight: '600', fontSize: 13 }]}>
              {t('downloadingTranslation') ?? 'Downloading translation for offline use...'}
            </Text>
            <View style={{ marginTop: 6, height: 4, borderRadius: 2, backgroundColor: gt(0.1), overflow: 'hidden' }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: C.accent.gold, width: `${Math.round((translationDownloadProgress.done / translationDownloadProgress.total) * 100)}%` }} />
            </View>
            <Text style={[styles.enhancedSettingDescription, { marginTop: 4, fontSize: 11 }]}>
              {`${translationDownloadProgress.done} / ${translationDownloadProgress.total} surahs`}
            </Text>
          </View>
        </View>
      )}

      {/* Reciter picker */}
      <Text style={styles.enhancedSettingSubtitle}>{t('reciter')}</Text>
      <TouchableOpacity
        onPress={() => setShowReciterPicker(true)}
        style={[styles.enhancedSettingContainer, { marginBottom: 14, borderWidth: 0.5, borderColor: gt(0.2), borderRadius: 10, paddingVertical: 10 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.enhancedSettingLabel, { fontWeight: '600' }]}>{t('selectReciter')}</Text>
          <Text style={[styles.enhancedSettingDescription, { marginTop: 2 }]}>
            {audioEditions.find(e => e.identifier === quranReciter)?.name ?? quranReciter}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={C.text.tertiary} />
      </TouchableOpacity>

      {/* Quran text is bundled offline — info note */}
      <View style={[styles.enhancedSettingContainer, { marginBottom: 8 }]}>
        <MaterialCommunityIcons name="check-circle" size={18} color={C.accent.gold} style={{ marginRight: 8 }} />
        <Text style={[styles.enhancedSettingDescription, { flex: 1 }]}>
          {t('quranBundledOffline') ?? 'Full Quran text (Arabic + English) is bundled offline — no download needed.'}
        </Text>
      </View>

      {/* Download all audio button */}
      <View style={[styles.enhancedTestButtonsContainer, { marginTop: 8 }]}>
        {audioFullDownloading && audioDownloadProgress ? (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <ActivityIndicator size="small" color={C.accent.gold} />
            <Text style={[styles.enhancedSettingDescription, { marginTop: 8, textAlign: 'center' }]}>
              {t('downloadProgress')
                .replace('{downloaded}', String(audioDownloadProgress.done))
                .replace('{total}', String(audioDownloadProgress.total))}
            </Text>
          </View>
        ) : (
          <MagicalButton
            style={styles.enhancedTestButton}
            onPress={handleDownloadAllAudio}
            disabled={audioFullDownloading}
            glowColor={C.accent.amber}
          >
            <MaterialCommunityIcons name="music-box-multiple" size={18} color={C.text.inverse} />
            <Text style={styles.enhancedTestButtonText}>{t('downloadAllAudio')}</Text>
          </MagicalButton>
        )}
      </View>

      {/* Clear cached data button (audio / extra translations) */}
      <View style={[styles.enhancedTestButtonsContainer, { marginTop: 8 }]}>
        <MagicalButton
          style={[styles.enhancedTestButton, { backgroundColor: C.accent.copper || '#B87333' }]}
          onPress={handleClearAllQuranDownloads}
          glowColor={C.accent.copper || '#B87333'}
        >
          <MaterialCommunityIcons name="delete-outline" size={18} color={C.text.inverse} />
          <Text style={styles.enhancedTestButtonText}>{t('deleteAllDownloads')}</Text>
        </MagicalButton>
      </View>
    </View>
  );
};
