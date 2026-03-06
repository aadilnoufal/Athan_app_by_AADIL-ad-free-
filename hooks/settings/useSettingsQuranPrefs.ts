/**
 * useSettingsQuranPrefs
 *
 * Custom hook that encapsulates all Quran-related settings state and handlers
 * for the Settings screen. This isolates Quran preferences from notification/
 * location/donation concerns, making each easier to debug and test.
 */
import { useState, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import {
  getEditionPref,
  setEditionPref as saveEditionPref,
  EditionPref,
  deleteAllQuranData,
  getQuranFontScale,
  setQuranFontScale,
  getQuranAutoScrollWithAudio,
  setQuranAutoScrollWithAudio,
  getTranslationEdition,
  setTranslationEdition,
  getReciterPref,
  setReciterPref,
  getTranslationEditionsCached,
  getAudioEditionsCached,
  downloadAllAudio,
  getQuranFontFamily,
  setQuranFontFamily,
  QuranFontFamily,
  downloadTranslationEdition,
  getDownloadedTranslationIds,
  isTranslationDownloaded,
} from '../../utils/quranStorage';
import { EditionInfo, EDITIONS } from '../../lib/quranApi';

// ISO 639-1 language code → English name (for search by language name)
const LANG_NAMES: Record<string, string> = {
  ar: 'arabic', az: 'azerbaijani', ba: 'bashkir', bn: 'bengali', bs: 'bosnian',
  cs: 'czech', de: 'german', dv: 'divehi maldivian', en: 'english', es: 'spanish',
  fa: 'persian farsi', fr: 'french', ha: 'hausa', hi: 'hindi', id: 'indonesian',
  it: 'italian', ja: 'japanese', ko: 'korean', ku: 'kurdish', ml: 'malayalam',
  ms: 'malay', nl: 'dutch', no: 'norwegian', pl: 'polish', ps: 'pashto',
  pt: 'portuguese', ro: 'romanian', ru: 'russian', sd: 'sindhi', so: 'somali',
  sq: 'albanian', sv: 'swedish', sw: 'swahili', ta: 'tamil', te: 'telugu',
  tg: 'tajik', th: 'thai', tr: 'turkish', tt: 'tatar', ug: 'uyghur',
  uk: 'ukrainian', ur: 'urdu', uz: 'uzbek', zh: 'chinese',
};

/** Translation function signature (from useLanguage) */
type TFunc = (key: string) => string;

export function useSettingsQuranPrefs(t: TFunc) {
  // ── State ────────────────────────────────────────────────────────────
  const [quranEditionPref, setQuranEditionPref] = useState<EditionPref>('both');
  const [quranFontScale, setQuranFontScaleState] = useState(1.2);
  const [quranAutoScrollWithAudio, setQuranAutoScrollWithAudioState] = useState(true);
  const [quranTranslationEdition, setQuranTranslationEditionState] = useState<string>(EDITIONS.ENGLISH);
  const [quranReciter, setQuranReciterState] = useState<string>(EDITIONS.DEFAULT_RECITER);
  const [translationEditions, setTranslationEditions] = useState<EditionInfo[]>([]);
  const [audioEditions, setAudioEditions] = useState<EditionInfo[]>([]);
  const [showTranslationPicker, setShowTranslationPicker] = useState(false);
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [editionSearchQuery, setEditionSearchQuery] = useState('');
  const [audioFullDownloading, setAudioFullDownloading] = useState(false);
  const [audioDownloadProgress, setAudioDownloadProgress] = useState<{ done: number; total: number } | null>(null);
  const [quranFontFamilyState, setQuranFontFamilyState] = useState<QuranFontFamily>('default');
  const [translationDownloading, setTranslationDownloading] = useState(false);
  const [translationDownloadProgress, setTranslationDownloadProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloadedTranslationIds, setDownloadedTranslationIds] = useState<Set<string>>(new Set([EDITIONS.ENGLISH]));

  // ── Load on mount ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [pref, fontSc, autoScrollPref, trEd, recPref, fontFamPref] = await Promise.all([
          getEditionPref(),
          getQuranFontScale(),
          getQuranAutoScrollWithAudio(),
          getTranslationEdition(),
          getReciterPref(),
          getQuranFontFamily(),
        ]);
        setQuranEditionPref(pref);
        setQuranFontScaleState(fontSc);
        setQuranAutoScrollWithAudioState(autoScrollPref);
        setQuranTranslationEditionState(trEd);
        setQuranReciterState(recPref);
        setQuranFontFamilyState(fontFamPref);
      } catch (e) {
        console.log('Error loading Quran settings:', e);
      }
    })();
    // Pre-load edition lists + downloaded translation IDs
    (async () => {
      try {
        const [trEditions, auEditions, dlIds] = await Promise.all([
          getTranslationEditionsCached(),
          getAudioEditionsCached(),
          getDownloadedTranslationIds(),
        ]);
        setTranslationEditions(trEditions);
        setAudioEditions(auEditions);
        setDownloadedTranslationIds(dlIds);
      } catch { /* silent */ }
    })();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleEditionPrefChange = async (pref: EditionPref) => {
    setQuranEditionPref(pref);
    await saveEditionPref(pref);
  };

  const handleDownloadAllAudio = async () => {
    const reciterName = audioEditions.find(e => e.identifier === quranReciter)?.name ?? quranReciter;
    Alert.alert(
      t('downloadAllAudio'),
      t('downloadAllAudioConfirm').replace('{reciter}', reciterName),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: async () => {
            setAudioFullDownloading(true);
            setAudioDownloadProgress({ done: 0, total: 114 });
            try {
              await downloadAllAudio(quranReciter, (done, total) => {
                setAudioDownloadProgress({ done, total });
              });
              Alert.alert(t('downloadComplete'), t('allAudioDownloaded'));
            } catch (e: any) {
              Alert.alert(t('downloadFailed'), t('downloadFailedMsg'));
            } finally {
              setAudioFullDownloading(false);
              setAudioDownloadProgress(null);
            }
          },
        },
      ],
    );
  };

  const handleClearAllQuranDownloads = async () => {
    Alert.alert(
      t('deleteAllDownloads'),
      t('clearCachedDataConfirm') ?? 'This will remove cached audio files and extra translations. Bundled Arabic + English text will remain available.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteAllQuranData();
            // Reset downloaded IDs back to default (bundled English always available)
            setDownloadedTranslationIds(new Set([EDITIONS.ENGLISH]));
            Alert.alert(t('deleteAllSuccess'));
          },
        },
      ],
    );
  };

  const handleFontScaleChange = async (value: number) => {
    const rounded = parseFloat(value.toFixed(2));
    setQuranFontScaleState(rounded);
  };

  const handleFontScaleChangeComplete = async (value: number) => {
    const rounded = parseFloat(value.toFixed(2));
    setQuranFontScaleState(rounded);
    await setQuranFontScale(rounded);
  };

  const handleQuranAutoScrollToggle = async (value: boolean) => {
    setQuranAutoScrollWithAudioState(value);
    await setQuranAutoScrollWithAudio(value);
  };

  const handleTranslationEditionChange = async (identifier: string) => {
    setQuranTranslationEditionState(identifier);
    await setTranslationEdition(identifier);
    setShowTranslationPicker(false);
    setEditionSearchQuery('');

    // Download the selected translation for offline use (unless it's English or already downloaded)
    if (identifier !== EDITIONS.ENGLISH && identifier !== 'en.sahih') {
      const alreadyDownloaded = await isTranslationDownloaded(identifier);
      if (!alreadyDownloaded) {
        setTranslationDownloading(true);
        setTranslationDownloadProgress({ done: 0, total: 114 });
        try {
          await downloadTranslationEdition(identifier, (done, total) => {
            setTranslationDownloadProgress({ done, total });
          });
          // Refresh downloaded translation IDs
          const dlIds = await getDownloadedTranslationIds();
          setDownloadedTranslationIds(dlIds);
        } catch (e: any) {
          console.log('Translation download failed (will use online):', e?.message);
        } finally {
          setTranslationDownloading(false);
          setTranslationDownloadProgress(null);
        }
      }
    }
  };

  const handleReciterChange = async (identifier: string) => {
    setQuranReciterState(identifier);
    await setReciterPref(identifier);
    setShowReciterPicker(false);
  };

  const handleFontFamilyChange = async (family: QuranFontFamily) => {
    setQuranFontFamilyState(family);
    await setQuranFontFamily(family);
  };

  // ── Derived data ─────────────────────────────────────────────────────

  const filteredTranslations = useMemo(() => {
    let list = translationEditions.filter((ed) => {
      if (!editionSearchQuery) return true;
      const q = editionSearchQuery.toLowerCase();
      const langName = LANG_NAMES[ed.language] ?? '';
      return (
        ed.name.toLowerCase().includes(q) ||
        ed.language.toLowerCase().includes(q) ||
        ed.identifier.toLowerCase().includes(q) ||
        ed.englishName.toLowerCase().includes(q) ||
        langName.includes(q)
      );
    });

    // Always put English (en.sahih) at the top of the list
    const englishIdx = list.findIndex(e => e.identifier === EDITIONS.ENGLISH);
    if (englishIdx > 0) {
      const [english] = list.splice(englishIdx, 1);
      list.unshift(english);
    }

    return list;
  }, [translationEditions, editionSearchQuery]);

  // ── Public API ───────────────────────────────────────────────────────
  return {
    // State
    quranEditionPref,
    quranFontScale,
    quranAutoScrollWithAudio,
    quranTranslationEdition,
    quranReciter,
    translationEditions,
    audioEditions,
    showTranslationPicker,
    setShowTranslationPicker,
    showReciterPicker,
    setShowReciterPicker,
    editionSearchQuery,
    setEditionSearchQuery,
    audioFullDownloading,
    audioDownloadProgress,
    quranFontFamilyState,
    filteredTranslations,
    translationDownloading,
    translationDownloadProgress,
    downloadedTranslationIds,

    // Handlers
    handleEditionPrefChange,
    handleDownloadAllAudio,
    handleClearAllQuranDownloads,
    handleFontScaleChange,
    handleFontScaleChangeComplete,
    handleQuranAutoScrollToggle,
    handleTranslationEditionChange,
    handleReciterChange,
    handleFontFamilyChange,
  };
}
