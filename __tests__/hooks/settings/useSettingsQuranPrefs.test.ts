/**
 * Tests for useSettingsQuranPrefs hook.
 *
 * Verifies:
 * - Initial state defaults are correct
 * - Edition preference changes persist to storage
 * - Font scale changes work (live + persist)
 * - Auto-scroll toggle works
 * - Font family selection works
 * - Translation/reciter picker modal state
 * - filteredTranslations filtering logic
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

// ── Mock data ──────────────────────────────────────────────────────────

const mockTranslations = [
  { identifier: 'en.sahih', name: 'Sahih International', englishName: 'Sahih International', language: 'en', direction: 'ltr', type: 'translation' },
  { identifier: 'fr.hamidullah', name: 'Muhammad Hamidullah', englishName: 'Muhammad Hamidullah', language: 'fr', direction: 'ltr', type: 'translation' },
  { identifier: 'ur.jalandhry', name: 'Fateh Muhammad Jalandhari', englishName: 'Fateh Muhammad Jalandhari', language: 'ur', direction: 'rtl', type: 'translation' },
];
const mockAudioEditions = [
  { identifier: 'ar.alafasy', name: 'Mishary Rashid Alafasy', englishName: 'Alafasy', language: 'ar', type: 'versebyverse' },
  { identifier: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', englishName: 'Al-Husary', language: 'ar', type: 'versebyverse' },
];

// ── Mocks (all inline to avoid hoisting issues with jest-expo) ─────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../utils/quranStorage', () => ({
  __esModule: true,
  getEditionPref: jest.fn().mockResolvedValue('both'),
  setEditionPref: jest.fn().mockResolvedValue(undefined),
  deleteAllQuranData: jest.fn().mockResolvedValue(undefined),
  getQuranFontScale: jest.fn().mockResolvedValue(1.2),
  setQuranFontScale: jest.fn().mockResolvedValue(undefined),
  getQuranAutoScrollWithAudio: jest.fn().mockResolvedValue(true),
  setQuranAutoScrollWithAudio: jest.fn().mockResolvedValue(undefined),
  getTranslationEdition: jest.fn().mockResolvedValue('en.sahih'),
  setTranslationEdition: jest.fn().mockResolvedValue(undefined),
  getReciterPref: jest.fn().mockResolvedValue('ar.alafasy'),
  setReciterPref: jest.fn().mockResolvedValue(undefined),
  getTranslationEditionsCached: jest.fn().mockResolvedValue(mockTranslations),
  getAudioEditionsCached: jest.fn().mockResolvedValue(mockAudioEditions),
  downloadAllAudio: jest.fn().mockResolvedValue(undefined),
  getQuranFontFamily: jest.fn().mockResolvedValue('default'),
  setQuranFontFamily: jest.fn().mockResolvedValue(undefined),
  downloadTranslationEdition: jest.fn().mockResolvedValue(0),
  getDownloadedTranslationIds: jest.fn().mockResolvedValue(new Set(['en.sahih'])),
  isTranslationDownloaded: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../lib/quranApi', () => ({
  __esModule: true,
  EDITIONS: {
    ARABIC: 'quran-uthmani',
    ENGLISH: 'en.sahih',
    DEFAULT_RECITER: 'ar.alafasy',
  },
}));

// Get mock references via requireMock (safe from hoisting)
const quranStorage = jest.requireMock('../../../utils/quranStorage');

import { useSettingsQuranPrefs } from '../../../hooks/settings/useSettingsQuranPrefs';

const mockT = (key: string) => key;

describe('useSettingsQuranPrefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to defaults
    quranStorage.getEditionPref.mockResolvedValue('both');
    quranStorage.getQuranFontScale.mockResolvedValue(1.2);
    quranStorage.getQuranAutoScrollWithAudio.mockResolvedValue(true);
    quranStorage.getTranslationEdition.mockResolvedValue('en.sahih');
    quranStorage.getReciterPref.mockResolvedValue('ar.alafasy');
    quranStorage.getQuranFontFamily.mockResolvedValue('default');
    quranStorage.getTranslationEditionsCached.mockResolvedValue(mockTranslations);
    quranStorage.getAudioEditionsCached.mockResolvedValue(mockAudioEditions);
  });

  it('returns correct default state before loading', () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    // Default useState values (before useEffect runs)
    expect(result.current.quranEditionPref).toBe('both');
    expect(result.current.quranFontScale).toBe(1.2);
    expect(result.current.quranAutoScrollWithAudio).toBe(true);
    expect(result.current.quranTranslationEdition).toBe('en.sahih');
    expect(result.current.quranReciter).toBe('ar.alafasy');
    expect(result.current.showTranslationPicker).toBe(false);
    expect(result.current.showReciterPicker).toBe(false);
    expect(result.current.editionSearchQuery).toBe('');
    expect(result.current.audioFullDownloading).toBe(false);
    expect(result.current.audioDownloadProgress).toBeNull();
  });

  it('loads saved preferences from storage', async () => {
    quranStorage.getEditionPref.mockResolvedValue('arabic');
    quranStorage.getQuranFontScale.mockResolvedValue(1.5);
    quranStorage.getQuranAutoScrollWithAudio.mockResolvedValue(false);
    quranStorage.getTranslationEdition.mockResolvedValue('fr.hamidullah');
    quranStorage.getReciterPref.mockResolvedValue('ar.husary');
    quranStorage.getQuranFontFamily.mockResolvedValue('Amiri');

    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    await waitFor(() => {
      expect(result.current.quranEditionPref).toBe('arabic');
    });

    expect(result.current.quranFontScale).toBe(1.5);
    expect(result.current.quranAutoScrollWithAudio).toBe(false);
    expect(result.current.quranTranslationEdition).toBe('fr.hamidullah');
    expect(result.current.quranReciter).toBe('ar.husary');
    expect(result.current.quranFontFamilyState).toBe('Amiri');
  });

  it('loads translation and audio edition lists', async () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    await waitFor(() => {
      expect(result.current.translationEditions.length).toBeGreaterThan(0);
    });

    expect(result.current.translationEditions).toEqual(mockTranslations);
    expect(result.current.audioEditions).toEqual(mockAudioEditions);
  });

  it('handleEditionPrefChange saves the new preference', async () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    // Wait for initial useEffect to fully resolve before calling handler
    await waitFor(() => {
      expect(result.current.quranEditionPref).toBe('both');
    });

    await act(async () => {
      await result.current.handleEditionPrefChange('arabic');
    });

    expect(result.current.quranEditionPref).toBe('arabic');
    expect(quranStorage.setEditionPref).toHaveBeenCalledWith('arabic');
  });

  it('handleFontScaleChange updates state without persisting (live preview)', () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    act(() => {
      result.current.handleFontScaleChange(1.35);
    });

    expect(result.current.quranFontScale).toBe(1.35);
    // Should not persist yet (only on sliding complete)
    expect(quranStorage.setQuranFontScale).not.toHaveBeenCalled();
  });

  it('handleFontScaleChangeComplete persists to storage', async () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    await act(async () => {
      await result.current.handleFontScaleChangeComplete(1.35);
    });

    expect(quranStorage.setQuranFontScale).toHaveBeenCalledWith(1.35);
  });

  it('handleQuranAutoScrollToggle toggles and saves', async () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    await waitFor(() => {
      expect(result.current.quranAutoScrollWithAudio).toBe(true);
    });

    await act(async () => {
      await result.current.handleQuranAutoScrollToggle(false);
    });

    expect(result.current.quranAutoScrollWithAudio).toBe(false);
    expect(quranStorage.setQuranAutoScrollWithAudio).toHaveBeenCalledWith(false);
  });

  it('handleTranslationEditionChange saves, closes picker, clears search', async () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.quranTranslationEdition).toBe('en.sahih');
    });

    // Open picker and set search query
    act(() => {
      result.current.setShowTranslationPicker(true);
      result.current.setEditionSearchQuery('french');
    });
    expect(result.current.showTranslationPicker).toBe(true);
    expect(result.current.editionSearchQuery).toBe('french');

    await act(async () => {
      await result.current.handleTranslationEditionChange('fr.hamidullah');
    });

    expect(result.current.quranTranslationEdition).toBe('fr.hamidullah');
    expect(quranStorage.setTranslationEdition).toHaveBeenCalledWith('fr.hamidullah');
    expect(result.current.showTranslationPicker).toBe(false);
    expect(result.current.editionSearchQuery).toBe('');
  });

  it('handleReciterChange saves and closes picker', async () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    await waitFor(() => {
      expect(result.current.quranReciter).toBe('ar.alafasy');
    });

    act(() => {
      result.current.setShowReciterPicker(true);
    });

    await act(async () => {
      await result.current.handleReciterChange('ar.husary');
    });

    expect(result.current.quranReciter).toBe('ar.husary');
    expect(quranStorage.setReciterPref).toHaveBeenCalledWith('ar.husary');
    expect(result.current.showReciterPicker).toBe(false);
  });

  it('handleFontFamilyChange saves to storage', async () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    await waitFor(() => {
      expect(result.current.quranFontFamilyState).toBe('default');
    });

    await act(async () => {
      await result.current.handleFontFamilyChange('Amiri');
    });

    expect(result.current.quranFontFamilyState).toBe('Amiri');
    expect(quranStorage.setQuranFontFamily).toHaveBeenCalledWith('Amiri');
  });

  it('filteredTranslations filters by name, language, and identifier', async () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    await waitFor(() => {
      expect(result.current.translationEditions.length).toBeGreaterThan(0);
    });

    // No filter — all translations
    expect(result.current.filteredTranslations.length).toBe(mockTranslations.length);

    // Filter by language name ("french" — should match via LANG_NAMES map)
    act(() => {
      result.current.setEditionSearchQuery('french');
    });
    expect(result.current.filteredTranslations.length).toBe(1);
    expect(result.current.filteredTranslations[0].identifier).toBe('fr.hamidullah');

    // Filter by identifier
    act(() => {
      result.current.setEditionSearchQuery('ur.');
    });
    expect(result.current.filteredTranslations.length).toBe(1);
    expect(result.current.filteredTranslations[0].identifier).toBe('ur.jalandhry');

    // Filter with no matches
    act(() => {
      result.current.setEditionSearchQuery('zzzznonexistent');
    });
    expect(result.current.filteredTranslations.length).toBe(0);
  });

  it('setShowTranslationPicker and setShowReciterPicker toggle modals', () => {
    const { result } = renderHook(() => useSettingsQuranPrefs(mockT));

    act(() => { result.current.setShowTranslationPicker(true); });
    expect(result.current.showTranslationPicker).toBe(true);

    act(() => { result.current.setShowTranslationPicker(false); });
    expect(result.current.showTranslationPicker).toBe(false);

    act(() => { result.current.setShowReciterPicker(true); });
    expect(result.current.showReciterPicker).toBe(true);

    act(() => { result.current.setShowReciterPicker(false); });
    expect(result.current.showReciterPicker).toBe(false);
  });
});
