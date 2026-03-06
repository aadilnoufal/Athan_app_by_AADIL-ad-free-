import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import type { ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import {
    SurahData,
    fetchSurahAudio,
    EDITIONS,
} from '../../lib/quranApi';
import {
    isSurahAudioDownloaded,
    downloadSurahAudio,
    getLocalAudioUri,
} from '../../utils/quranStorage';
import type { UseQuranAudioReturn } from './quranTypes';

export interface UseQuranAudioParams {
    /** Current surah Arabic data (synced to ref internally) */
    currentSurahAr: SurahData | null;
    /** Reciter edition string (loaded by useQuranData) */
    reciterEdition: string;
    /** Whether auto-scroll with audio is enabled (loaded by useQuranData) */
    autoScrollWithAudio: boolean;
    /** Scroll view ref for auto-scroll */
    scrollRef: React.RefObject<ScrollView | null>;
    /** Translation function for alerts */
    t: (key: string, params?: any) => string;
}

/**
 * Manages Quran audio playback: play/pause/stop, preloading,
 * download management, auto-scroll with audio, and reciter switching.
 */
export function useQuranAudio({
    currentSurahAr,
    reciterEdition,
    autoScrollWithAudio,
    scrollRef,
    t,
}: UseQuranAudioParams): UseQuranAudioReturn {
    // ── Audio state ──────────────────────────────────────────────
    const [audioSurahData, setAudioSurahData] = useState<SurahData | null>(null);
    const [currentAyahIndex, setCurrentAyahIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioDownloaded, setAudioDownloaded] = useState(false);
    const [audioDownloading, setAudioDownloading] = useState(false);
    const [audioDownloadProgress, setAudioDownloadProgress] = useState({ downloaded: 0, total: 0 });

    // ── Audio refs (for stable callbacks — avoids stale closures) ─
    const soundRef = useRef<Audio.Sound | null>(null);
    const nextSoundRef = useRef<Audio.Sound | null>(null);
    const nextSoundIndexRef = useRef<number>(-1);
    const currentAyahIndexRef = useRef(-1);
    const isPlayingLockRef = useRef(false);
    const currentSurahArRef = useRef<SurahData | null>(null);
    const audioSurahDataRef = useRef<SurahData | null>(null);
    const audioDownloadedRef = useRef(false);
    const reciterEditionRef = useRef<string>(EDITIONS.DEFAULT_RECITER);

    // ── Auto-scroll refs ─────────────────────────────────────────
    const ayahLayoutsRef = useRef<Record<number, number>>({});
    const autoScrollEnabled = useRef(true);
    const autoScrollResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Keep refs in sync with state / props ─────────────────────
    useEffect(() => { currentSurahArRef.current = currentSurahAr; }, [currentSurahAr]);
    useEffect(() => { audioSurahDataRef.current = audioSurahData; }, [audioSurahData]);
    useEffect(() => { audioDownloadedRef.current = audioDownloaded; }, [audioDownloaded]);
    useEffect(() => { reciterEditionRef.current = reciterEdition; }, [reciterEdition]);

    // ── Reciter change: invalidate cached audio data ─────────────
    const prevReciterRef = useRef(reciterEdition);
    useEffect(() => {
        if (prevReciterRef.current !== reciterEdition) {
            prevReciterRef.current = reciterEdition;
            setAudioSurahData(null);
            audioSurahDataRef.current = null;
            if (nextSoundRef.current) {
                nextSoundRef.current.unloadAsync().catch(() => { });
                nextSoundRef.current = null;
                nextSoundIndexRef.current = -1;
            }
            const surahNum = currentSurahArRef.current?.number;
            if (surahNum) {
                isSurahAudioDownloaded(surahNum, reciterEdition)
                    .then(d => setAudioDownloaded(d))
                    .catch(() => setAudioDownloaded(false));
            }
        }
    }, [reciterEdition]);

    // ── Audio mode setup ─────────────────────────────────────────
    useEffect(() => {
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
        }).catch((e) => { console.error('⚠️ Audio mode setup failed — playback in silent/background may not work:', e); });
        return () => {
            soundRef.current?.unloadAsync().catch(() => { });
            nextSoundRef.current?.unloadAsync().catch(() => { });
        };
    }, []);

    // ── Auto-scroll pref sync ────────────────────────────────────
    useEffect(() => {
        if (!autoScrollWithAudio) {
            autoScrollEnabled.current = false;
            return;
        }
        autoScrollEnabled.current = true;
    }, [autoScrollWithAudio]);

    // ── Reset ayah layouts and stop audio when surah changes ────
    useEffect(() => {
        // Stop any currently playing audio when switching surahs
        if (soundRef.current) {
            soundRef.current.stopAsync().catch(() => { });
            soundRef.current.unloadAsync().catch(() => { });
            soundRef.current = null;
        }
        if (nextSoundRef.current) {
            nextSoundRef.current.unloadAsync().catch(() => { });
            nextSoundRef.current = null;
            nextSoundIndexRef.current = -1;
        }
        isPlayingLockRef.current = false;
        setIsPlaying(false);
        setCurrentAyahIndex(-1);
        currentAyahIndexRef.current = -1;

        ayahLayoutsRef.current = {};
        if (autoScrollResumeTimeoutRef.current) {
            clearTimeout(autoScrollResumeTimeoutRef.current);
            autoScrollResumeTimeoutRef.current = null;
        }
    }, [currentSurahAr?.number]);

    // ── Cleanup auto-scroll timeout on unmount ───────────────────
    useEffect(() => {
        return () => {
            if (autoScrollResumeTimeoutRef.current) {
                clearTimeout(autoScrollResumeTimeoutRef.current);
                autoScrollResumeTimeoutRef.current = null;
            }
        };
    }, []);

    // ── Auto-scroll when current ayah changes ────────────────────
    useEffect(() => {
        if (currentAyahIndex >= 0 && autoScrollEnabled.current && scrollRef.current) {
            const scrollToAyah = () => {
                const y = ayahLayoutsRef.current[currentAyahIndex];
                if (typeof y !== 'number') return false;
                const offset = Math.max(0, y - 12);
                scrollRef.current?.scrollTo({ y: offset, animated: true });
                return true;
            };

            if (!scrollToAyah()) {
                const retry = setTimeout(scrollToAyah, 90);
                return () => clearTimeout(retry);
            }
        }
    }, [currentAyahIndex, currentSurahAr?.number, scrollRef]);

    // ── Stop audio ───────────────────────────────────────────────
    const stopAudio = useCallback(async () => {
        isPlayingLockRef.current = false;
        try {
            if (soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }
        } catch { }
        try {
            if (nextSoundRef.current) {
                await nextSoundRef.current.unloadAsync();
                nextSoundRef.current = null;
                nextSoundIndexRef.current = -1;
            }
        } catch { }
        setIsPlaying(false);
        setCurrentAyahIndex(-1);
        currentAyahIndexRef.current = -1;
    }, []);

    // ── Resolve URI for a given ayah (local file or remote) ──────
    const resolveAyahAudioUri = useCallback(async (
        surah: SurahData,
        ayahIndex: number,
    ): Promise<string | null> => {
        const ayah = surah.ayahs[ayahIndex];
        if (!ayah) return null;

        if (audioDownloadedRef.current) {
            const localUri = await getLocalAudioUri(reciterEditionRef.current, ayah.number);
            if (localUri) return localUri;
        }

        let audioData = audioSurahDataRef.current;
        if (!audioData) {
            audioData = await fetchSurahAudio(surah.number, reciterEditionRef.current);
            setAudioSurahData(audioData);
            audioSurahDataRef.current = audioData;
        }
        return audioData.ayahs[ayahIndex]?.audio ?? null;
    }, []);

    // ── Preload the next ayah in the background ──────────────────
    const preloadNextAyah = useCallback(async (nextIndex: number) => {
        const surah = currentSurahArRef.current;
        if (!surah || nextIndex >= surah.ayahs.length) return;
        if (nextSoundIndexRef.current === nextIndex && nextSoundRef.current) return;

        try {
            if (nextSoundRef.current) {
                await nextSoundRef.current.unloadAsync();
                nextSoundRef.current = null;
                nextSoundIndexRef.current = -1;
            }
        } catch { }

        try {
            const uri = await resolveAyahAudioUri(surah, nextIndex);
            if (!uri) return;
            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: false },
            );
            // Guard: surah may have changed during async createAsync
            if (currentSurahArRef.current?.number !== surah.number) {
                sound.unloadAsync().catch(() => {});
                return;
            }
            nextSoundRef.current = sound;
            nextSoundIndexRef.current = nextIndex;
        } catch {
            // Preload is best-effort
        }
    }, [resolveAyahAudioUri]);

    // ── Play a specific ayah (ref-based, no stale closures) ──────
    const playAyah = useCallback(async (ayahIndex: number) => {
        const surah = currentSurahArRef.current;
        if (!surah) return;
        const ayah = surah.ayahs[ayahIndex];
        if (!ayah) return;

        if (isPlayingLockRef.current) return;
        isPlayingLockRef.current = true;

        setAudioLoading(true);
        setCurrentAyahIndex(ayahIndex);
        currentAyahIndexRef.current = ayahIndex;

        try {
            if (soundRef.current) {
                try {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                } catch { }
                soundRef.current = null;
            }

            let sound: Audio.Sound | null = null;
            if (nextSoundRef.current && nextSoundIndexRef.current === ayahIndex) {
                sound = nextSoundRef.current;
                nextSoundRef.current = null;
                nextSoundIndexRef.current = -1;
            }

            if (sound) {
                // Assign ref BEFORE playAsync to prevent race condition with stopAudio
                soundRef.current = sound;
                let didAdvance = false;
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish && !didAdvance) {
                        didAdvance = true;
                        const currentIdx = currentAyahIndexRef.current;
                        const surahNow = currentSurahArRef.current;
                        const nextIdx = currentIdx + 1;
                        if (surahNow && nextIdx < surahNow.ayahs.length) {
                            isPlayingLockRef.current = false;
                            playAyah(nextIdx);
                        } else {
                            isPlayingLockRef.current = false;
                            setIsPlaying(false);
                            setCurrentAyahIndex(-1);
                            currentAyahIndexRef.current = -1;
                        }
                    }
                });
                await sound.playAsync();
            } else {
                const uri = await resolveAyahAudioUri(surah, ayahIndex);
                if (!uri) {
                    Alert.alert(t('audioError'), t('audioErrorMsg'));
                    setAudioLoading(false);
                    isPlayingLockRef.current = false;
                    return;
                }

                let didAdvance = false;
                const result = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: false },
                    (status) => {
                        if (status.isLoaded && status.didJustFinish && !didAdvance) {
                            didAdvance = true;
                            const currentIdx = currentAyahIndexRef.current;
                            const surahNow = currentSurahArRef.current;
                            const nextIdx = currentIdx + 1;
                            if (surahNow && nextIdx < surahNow.ayahs.length) {
                                isPlayingLockRef.current = false;
                                playAyah(nextIdx);
                            } else {
                                isPlayingLockRef.current = false;
                                setIsPlaying(false);
                                setCurrentAyahIndex(-1);
                                currentAyahIndexRef.current = -1;
                            }
                        }
                    }
                );
                sound = result.sound;
                // Guard: surah may have changed during async createAsync
                if (currentSurahArRef.current?.number !== surah.number) {
                    sound.unloadAsync().catch(() => {});
                    setAudioLoading(false);
                    isPlayingLockRef.current = false;
                    return;
                }
                // Assign ref before playAsync so stopAudio can find it during playback
                soundRef.current = sound;
                await sound.playAsync();
            }

            setIsPlaying(true);

            const nextIdx = ayahIndex + 1;
            if (nextIdx < surah.ayahs.length) {
                preloadNextAyah(nextIdx);
            }
        } catch (e: any) {
            // Clean up the sound that was assigned but failed to play
            if (soundRef.current) {
                try { await soundRef.current.unloadAsync(); } catch { }
                soundRef.current = null;
            }
            Alert.alert(t('audioError'), t('audioErrorMsg'));
        } finally {
            setAudioLoading(false);
            isPlayingLockRef.current = false;
        }
    }, [t, resolveAyahAudioUri, preloadNextAyah]);

    // ── Toggle play / pause ──────────────────────────────────────
    const togglePlayPause = useCallback(async () => {
        if (!soundRef.current) {
            const startIdx = currentAyahIndexRef.current >= 0 ? currentAyahIndexRef.current : 0;
            playAyah(startIdx);
            return;
        }
        try {
            // Capture ref to guard against nullification across await boundary
            const sound = soundRef.current;
            const status = await sound.getStatusAsync();
            // Guard: soundRef may have been cleared (e.g. surah change) during await
            if (!soundRef.current || soundRef.current !== sound) return;
            if (status.isLoaded) {
                if (status.isPlaying) {
                    await sound.pauseAsync();
                    setIsPlaying(false);
                } else {
                    await sound.playAsync();
                    setIsPlaying(true);
                }
            }
        } catch {
            playAyah(0);
        }
    }, [playAyah]);

    // ── Prev / Next ayah ─────────────────────────────────────────
    const playPrevAyah = useCallback(() => {
        const idx = currentAyahIndexRef.current;
        if (idx > 0) playAyah(idx - 1);
    }, [playAyah]);

    const playNextAyah = useCallback(() => {
        const idx = currentAyahIndexRef.current;
        const surah = currentSurahArRef.current;
        if (surah && idx < surah.ayahs.length - 1) {
            playAyah(idx + 1);
        }
    }, [playAyah]);

    // ── Scroll to currently playing ayah (manual trigger) ────────
    const scrollToCurrentAyah = useCallback(() => {
        const idx = currentAyahIndexRef.current;
        if (idx >= 0 && scrollRef.current) {
            const y = ayahLayoutsRef.current[idx];
            if (typeof y === 'number') {
                autoScrollEnabled.current = true;
                scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
            }
        }
    }, [scrollRef]);

    // ── Check if audio is downloaded for current surah ───────────
    const checkAudioStatus = useCallback(async (surahNumber: number) => {
        try {
            const downloaded = await isSurahAudioDownloaded(surahNumber, reciterEditionRef.current);
            setAudioDownloaded(downloaded);
        } catch {
            setAudioDownloaded(false);
        }
    }, []);

    // ── Download surah audio ─────────────────────────────────────
    const handleDownloadAudio = useCallback(async () => {
        const surah = currentSurahArRef.current;
        if (!surah) return;
        setAudioDownloading(true);
        setAudioDownloadProgress({ downloaded: 0, total: surah.numberOfAyahs });
        try {
            if (!audioSurahDataRef.current) {
                const audioData = await fetchSurahAudio(surah.number, reciterEditionRef.current);
                setAudioSurahData(audioData);
                audioSurahDataRef.current = audioData;
            }
            await downloadSurahAudio(
                surah.number,
                reciterEditionRef.current,
                (downloaded: number, total: number) => setAudioDownloadProgress({ downloaded, total })
            );
            setAudioDownloaded(true);
        } catch (e: any) {
            Alert.alert(t('downloadFailed'), t('audioErrorMsg'));
        } finally {
            setAudioDownloading(false);
        }
    }, [t]);

    return {
        audioSurahData, setAudioSurahData,
        currentAyahIndex, setCurrentAyahIndex,
        isPlaying, audioLoading,
        audioDownloaded, audioDownloading, audioDownloadProgress,
        currentSurahArRef, currentAyahIndexRef, audioSurahDataRef,
        ayahLayoutsRef, autoScrollEnabled, autoScrollResumeTimeoutRef,
        stopAudio, playAyah, togglePlayPause,
        playPrevAyah, playNextAyah,
        checkAudioStatus, handleDownloadAudio, scrollToCurrentAyah,
    };
}
