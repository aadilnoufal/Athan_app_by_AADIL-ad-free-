/**
 * Tests for useQuranAudio hook.
 *
 * Verifies:
 * - Initial state defaults
 * - stopAudio clears state and unloads sounds
 * - checkAudioStatus queries download status
 * - Reciter change invalidates cached audio data
 * - Auto-scroll pref syncs to ref
 * - playAyah sets state and plays audio
 * - togglePlayPause behavior
 * - prevAyah / nextAyah navigation
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

// ── Mock Audio.Sound ─────────────────────────────────────────────────

const mockSoundInstance = {
    stopAsync: jest.fn().mockResolvedValue(undefined),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
    playAsync: jest.fn().mockResolvedValue(undefined),
    pauseAsync: jest.fn().mockResolvedValue(undefined),
    getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, isPlaying: true }),
    setOnPlaybackStatusUpdate: jest.fn(),
};

jest.mock('expo-av', () => ({
    Audio: {
        setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
        Sound: {
            createAsync: jest.fn().mockResolvedValue({ sound: mockSoundInstance }),
        },
    },
}));

jest.mock('../../../lib/quranApi', () => ({
    __esModule: true,
    EDITIONS: {
        ARABIC: 'quran-uthmani',
        ENGLISH: 'en.sahih',
        DEFAULT_RECITER: 'ar.alafasy',
    },
    fetchSurahAudio: jest.fn().mockResolvedValue({
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        englishNameTranslation: 'The Opening',
        numberOfAyahs: 7,
        revelationType: 'Meccan',
        ayahs: [
            { number: 1, text: 'text1', numberInSurah: 1, audio: 'https://audio/1.mp3' },
            { number: 2, text: 'text2', numberInSurah: 2, audio: 'https://audio/2.mp3' },
            { number: 3, text: 'text3', numberInSurah: 3, audio: 'https://audio/3.mp3' },
        ],
    }),
}));

jest.mock('../../../utils/quranStorage', () => ({
    __esModule: true,
    isSurahAudioDownloaded: jest.fn().mockResolvedValue(false),
    downloadSurahAudio: jest.fn().mockResolvedValue(undefined),
    getLocalAudioUri: jest.fn().mockResolvedValue(null),
}));

// Spy on Alert.alert (no need to mock all of react-native)
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const quranStorage = jest.requireMock('../../../utils/quranStorage');
const quranApi = jest.requireMock('../../../lib/quranApi');
const { Audio } = jest.requireMock('expo-av');

import { useQuranAudio } from '../../../hooks/quran/useQuranAudio';
import type { UseQuranAudioParams } from '../../../hooks/quran/useQuranAudio';

// ── Helpers ──────────────────────────────────────────────────────────

const mockSurahAr = {
    number: 1,
    name: 'الفاتحة',
    englishName: 'Al-Fatiha',
    englishNameTranslation: 'The Opening',
    numberOfAyahs: 7,
    revelationType: 'Meccan' as const,
    ayahs: [
        { number: 1, text: 'بسم الله', numberInSurah: 1, juz: 1, page: 1, hizbQuarter: 1 },
        { number: 2, text: 'الحمد لله', numberInSurah: 2, juz: 1, page: 1, hizbQuarter: 1 },
        { number: 3, text: 'الرحمن الرحيم', numberInSurah: 3, juz: 1, page: 1, hizbQuarter: 1 },
    ],
};

const mockScrollRef = { current: { scrollTo: jest.fn() } } as any;
const mockT = (key: string) => key;

const defaultParams = {
    currentSurahAr: null as any,
    reciterEdition: 'ar.alafasy',
    autoScrollWithAudio: true,
    scrollRef: mockScrollRef,
    t: mockT,
};

describe('useQuranAudio', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSoundInstance.stopAsync.mockResolvedValue(undefined);
        mockSoundInstance.unloadAsync.mockResolvedValue(undefined);
        mockSoundInstance.playAsync.mockResolvedValue(undefined);
        mockSoundInstance.pauseAsync.mockResolvedValue(undefined);
        mockSoundInstance.getStatusAsync.mockResolvedValue({ isLoaded: true, isPlaying: true });
        Audio.Sound.createAsync.mockResolvedValue({ sound: mockSoundInstance });
        quranStorage.isSurahAudioDownloaded.mockResolvedValue(false);
    });

    // ── Initial state ────────────────────────────────────────────

    it('starts with correct defaults', () => {
        const { result } = renderHook(() => useQuranAudio(defaultParams));

        expect(result.current.currentAyahIndex).toBe(-1);
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.audioLoading).toBe(false);
        expect(result.current.audioDownloaded).toBe(false);
        expect(result.current.audioDownloading).toBe(false);
    });

    it('sets audio mode on mount', () => {
        renderHook(() => useQuranAudio(defaultParams));

        expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
        });
    });

    // ── stopAudio ────────────────────────────────────────────────

    it('stopAudio resets state', async () => {
        const { result } = renderHook(() => useQuranAudio({
            ...defaultParams,
            currentSurahAr: mockSurahAr,
        }));

        await act(async () => {
            await result.current.stopAudio();
        });

        expect(result.current.isPlaying).toBe(false);
        expect(result.current.currentAyahIndex).toBe(-1);
    });

    // ── checkAudioStatus ─────────────────────────────────────────

    it('checkAudioStatus updates downloaded state', async () => {
        quranStorage.isSurahAudioDownloaded.mockResolvedValue(true);
        const { result } = renderHook(() => useQuranAudio(defaultParams));

        await act(async () => {
            await result.current.checkAudioStatus(1);
        });

        expect(result.current.audioDownloaded).toBe(true);
        expect(quranStorage.isSurahAudioDownloaded).toHaveBeenCalledWith(1, 'ar.alafasy');
    });

    it('checkAudioStatus sets false on error', async () => {
        quranStorage.isSurahAudioDownloaded.mockRejectedValue(new Error('fail'));
        const { result } = renderHook(() => useQuranAudio(defaultParams));

        await act(async () => {
            await result.current.checkAudioStatus(1);
        });

        expect(result.current.audioDownloaded).toBe(false);
    });

    // ── Reciter change ───────────────────────────────────────────

    it('clears audio data when reciter changes', async () => {
        const { result, rerender } = renderHook(
            (props: UseQuranAudioParams) => useQuranAudio(props),
            { initialProps: { ...defaultParams, currentSurahAr: mockSurahAr } }
        );

        // Verify initial state
        await waitFor(() => expect(result.current.audioSurahData).toBeNull());

        // Change reciter
        rerender({ ...defaultParams, currentSurahAr: mockSurahAr, reciterEdition: 'ar.husary' });

        // Audio data should be cleared
        await waitFor(() => expect(result.current.audioSurahData).toBeNull());
    });

    // ── Auto-scroll sync ─────────────────────────────────────────

    it('syncs autoScrollEnabled ref with prop', () => {
        const { result, rerender } = renderHook(
            (props: UseQuranAudioParams) => useQuranAudio(props),
            { initialProps: defaultParams }
        );

        expect(result.current.autoScrollEnabled.current).toBe(true);

        rerender({ ...defaultParams, autoScrollWithAudio: false });
        expect(result.current.autoScrollEnabled.current).toBe(false);
    });

    // ── playAyah ─────────────────────────────────────────────────

    it('playAyah sets ayah index and plays', async () => {
        const { result } = renderHook(() => useQuranAudio({
            ...defaultParams,
            currentSurahAr: mockSurahAr,
        }));

        await act(async () => {
            await result.current.playAyah(0);
        });

        expect(result.current.currentAyahIndex).toBe(0);
        expect(result.current.isPlaying).toBe(true);
    });

    it('playAyah does nothing when no surah loaded', async () => {
        const { result } = renderHook(() => useQuranAudio(defaultParams));

        await act(async () => {
            await result.current.playAyah(0);
        });

        expect(result.current.currentAyahIndex).toBe(-1);
        expect(result.current.isPlaying).toBe(false);
    });

    // ── togglePlayPause ──────────────────────────────────────────

    it('togglePlayPause starts from beginning when no sound loaded', async () => {
        const { result } = renderHook(() => useQuranAudio({
            ...defaultParams,
            currentSurahAr: mockSurahAr,
        }));

        await act(async () => {
            await result.current.togglePlayPause();
        });

        expect(result.current.currentAyahIndex).toBe(0);
        expect(result.current.isPlaying).toBe(true);
    });

    // ── prev / next ──────────────────────────────────────────────

    it('playPrevAyah does nothing at index 0', async () => {
        const { result } = renderHook(() => useQuranAudio({
            ...defaultParams,
            currentSurahAr: mockSurahAr,
        }));

        // Play ayah 0 first
        await act(async () => {
            await result.current.playAyah(0);
        });

        // Try prev — should stay at 0
        await act(async () => {
            result.current.playPrevAyah();
        });

        // Still at 0 (prev at index 0 is no-op)
        expect(result.current.currentAyahIndex).toBe(0);
    });

    it('playNextAyah advances to next ayah', async () => {
        const { result } = renderHook(() => useQuranAudio({
            ...defaultParams,
            currentSurahAr: mockSurahAr,
        }));

        await act(async () => {
            await result.current.playAyah(0);
        });

        await act(async () => {
            result.current.playNextAyah();
        });

        // Should advance to index 1
        await waitFor(() => expect(result.current.currentAyahIndex).toBe(1));
    });

    // ── ayahLayoutsRef ───────────────────────────────────────────

    it('resets ayah layouts when surah changes', () => {
        const { result, rerender } = renderHook(
            (props: UseQuranAudioParams) => useQuranAudio(props),
            { initialProps: { ...defaultParams, currentSurahAr: mockSurahAr } }
        );

        // Simulate layout measurements
        result.current.ayahLayoutsRef.current = { 0: 100, 1: 200, 2: 300 };

        // Change surah
        const newSurah = { ...mockSurahAr, number: 2 };
        rerender({ ...defaultParams, currentSurahAr: newSurah });

        expect(result.current.ayahLayoutsRef.current).toEqual({});
    });

    // ── scrollToCurrentAyah ──────────────────────────────────────

    it('scrollToCurrentAyah scrolls to measured position', async () => {
        const { result } = renderHook(() => useQuranAudio({
            ...defaultParams,
            currentSurahAr: mockSurahAr,
        }));

        // Set up: play ayah 1, set its layout position
        await act(async () => {
            await result.current.playAyah(1);
        });
        result.current.ayahLayoutsRef.current[1] = 250;

        act(() => {
            result.current.scrollToCurrentAyah();
        });

        expect(mockScrollRef.current.scrollTo).toHaveBeenCalledWith({
            y: 238, // Math.max(0, 250 - 12)
            animated: true,
        });
    });

    // ── handleDownloadAudio ──────────────────────────────────────

    it('handleDownloadAudio downloads and updates state', async () => {
        quranStorage.downloadSurahAudio.mockResolvedValue(undefined);
        const { result } = renderHook(() => useQuranAudio({
            ...defaultParams,
            currentSurahAr: mockSurahAr,
        }));

        await act(async () => {
            await result.current.handleDownloadAudio();
        });

        expect(result.current.audioDownloaded).toBe(true);
        expect(result.current.audioDownloading).toBe(false);
    });
});
