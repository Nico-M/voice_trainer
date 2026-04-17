import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { ScaleDemoTrack } from '../config/scaleDemoTracks.ts';

interface SeekGestureState {
  pointerId: number;
  trackId: string;
}

export interface DemoTrackViewState {
  durationLabel: string;
  isActive: boolean;
  isLoading: boolean;
  isSeekEnabled: boolean;
  positionLabel: string;
  progressRatio: number;
}

export interface UseDemoAudioPlayerResult {
  audioRef: RefObject<HTMLAudioElement | null>;
  getTrackViewState: (track: ScaleDemoTrack) => DemoTrackViewState;
  handleProgressPointerDown: (
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  handleProgressPointerEnd: (
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  handleProgressPointerMove: (
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  playbackError: string | null;
  toggleTrack: (track: ScaleDemoTrack) => Promise<void>;
}

function parseDurationLabel(durationLabel: string): number {
  const segments = durationLabel.split(':').map((part) => Number.parseInt(part, 10));

  if (segments.some((segment) => Number.isNaN(segment))) {
    return 0;
  }

  if (segments.length === 2) {
    return segments[0]! * 60 + segments[1]!;
  }

  if (segments.length === 3) {
    return segments[0]! * 3600 + segments[1]! * 60 + segments[2]!;
  }

  return 0;
}

function formatPlaybackTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function clampPlaybackTime(nextTime: number, duration: number): number {
  return Math.min(Math.max(nextTime, 0), duration);
}

function getProgressRatio(position: number, duration: number): number {
  if (duration <= 0) {
    return 0;
  }

  return clampPlaybackTime(position, duration) / duration;
}

function waitForLoadedMetadata(audio: HTMLAudioElement): Promise<number> {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return Promise.resolve(audio.duration);
  }

  return new Promise<number>((resolve, reject) => {
    function cleanup(): void {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
    }

    function handleLoadedMetadata(): void {
      cleanup();
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    }

    function handleError(): void {
      cleanup();
      reject(new Error('示范音频元数据读取失败。'));
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
  });
}

export default function useDemoAudioPlayer(): UseDemoAudioPlayerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioSrcRef = useRef<string | null>(null);
  const pendingRequestIdRef = useRef(0);
  const seekGestureRef = useRef<SeekGestureState | null>(null);

  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [dragPreviewTime, setDragPreviewTime] = useState<number | null>(null);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }
    const audioElement = audio;

    function handleLoadedMetadata(): void {
      setPlaybackDuration(Number.isFinite(audioElement.duration) ? audioElement.duration : 0);
    }

    function handleTimeUpdate(): void {
      if (seekGestureRef.current) {
        return;
      }

      setPlaybackPosition(audioElement.currentTime);
    }

    function handleEnded(): void {
      setLoadingTrackId(null);
      setActiveTrackId(null);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
      setDragPreviewTime(null);
    }

    function handleError(): void {
      setPlaybackError('示范音频加载失败，请检查 public 目录下的音频路径。');
      setLoadingTrackId(null);
      setActiveTrackId(null);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
      setDragPreviewTime(null);
    }

    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('error', handleError);

    return () => {
      audioElement.pause();
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
    };
  }, []);

  const stopTrack = useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    // 每次手动停止都让之前挂起的加载结果失效，避免慢网返回后把 UI 又切回播放态。
    pendingRequestIdRef.current += 1;
    audio.pause();
    audio.currentTime = 0;
    seekGestureRef.current = null;
    setLoadingTrackId(null);
    setActiveTrackId(null);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setDragPreviewTime(null);
  }, []);

  const startTrack = useCallback(async (
    trackId: string,
    audioSrc: string,
    startTimeSeconds = 0,
  ): Promise<void> => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const requestId = pendingRequestIdRef.current + 1;
    pendingRequestIdRef.current = requestId;

    if (!audioSrc) {
      setLoadingTrackId(null);
      setPlaybackError('当前示范条目还没有配置音频地址。');
      return;
    }

    setPlaybackError(null);
    setLoadingTrackId(trackId);
    setActiveTrackId(null);
    setPlaybackPosition(0);
    setDragPreviewTime(null);

    try {
      audio.pause();

      if (currentAudioSrcRef.current !== audioSrc) {
        audio.src = audioSrc;
        currentAudioSrcRef.current = audioSrc;
        audio.load();
      }

      const resolvedDuration = await waitForLoadedMetadata(audio);
      if (pendingRequestIdRef.current !== requestId) {
        return;
      }

      const nextTime = clampPlaybackTime(startTimeSeconds, resolvedDuration || startTimeSeconds);

      audio.currentTime = nextTime;
      setPlaybackDuration(resolvedDuration);
      setPlaybackPosition(nextTime);
      setDragPreviewTime(null);
      await audio.play();
      if (pendingRequestIdRef.current !== requestId) {
        audio.pause();
        return;
      }

      setLoadingTrackId(null);
      setActiveTrackId(trackId);
    } catch (error) {
      if (pendingRequestIdRef.current !== requestId) {
        return;
      }

      setLoadingTrackId(null);
      setPlaybackError(error instanceof Error ? error.message : '示范音频播放失败。');
      setActiveTrackId(null);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
      setDragPreviewTime(null);
    }
  }, []);

  const getResolvedTrackDuration = useCallback((track: ScaleDemoTrack, isActive: boolean): number => {
    if (isActive && playbackDuration > 0) {
      return playbackDuration;
    }

    return parseDurationLabel(track.duration);
  }, [playbackDuration]);

  const getResolvedTrackPosition = useCallback((isActive: boolean): number => {
    if (!isActive) {
      return 0;
    }

    return dragPreviewTime ?? playbackPosition;
  }, [dragPreviewTime, playbackPosition]);

  const updateSeekFromPointer = useCallback((
    track: ScaleDemoTrack,
    clientX: number,
    currentTarget: HTMLDivElement,
  ): void => {
    const audio = audioRef.current;
    if (!audio || activeTrackId !== track.id) {
      return;
    }

    const duration = getResolvedTrackDuration(track, true);
    if (duration <= 0) {
      return;
    }

    const rect = currentTarget.getBoundingClientRect();
    const nextRatio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const nextTime = clampPlaybackTime(nextRatio * duration, duration);

    audio.currentTime = nextTime;
    setPlaybackPosition(nextTime);
    setDragPreviewTime(nextTime);
  }, [activeTrackId, getResolvedTrackDuration]);

  const toggleTrack = useCallback(async (track: ScaleDemoTrack): Promise<void> => {
    if (activeTrackId === track.id) {
      stopTrack();
      return;
    }

    await startTrack(track.id, track.audioSrc, 0);
  }, [activeTrackId, startTrack, stopTrack]);

  const handleProgressPointerDown = useCallback((
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    if (activeTrackId !== track.id) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    seekGestureRef.current = {
      pointerId: event.pointerId,
      trackId: track.id,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSeekFromPointer(track, event.clientX, event.currentTarget);
  }, [activeTrackId, updateSeekFromPointer]);

  const handleProgressPointerMove = useCallback((
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    if (
      seekGestureRef.current?.trackId !== track.id ||
      seekGestureRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    updateSeekFromPointer(track, event.clientX, event.currentTarget);
  }, [updateSeekFromPointer]);

  const handleProgressPointerEnd = useCallback((
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    if (
      seekGestureRef.current?.trackId !== track.id ||
      seekGestureRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    seekGestureRef.current = null;
    setDragPreviewTime(null);
  }, []);

  const getTrackViewState = useCallback((track: ScaleDemoTrack): DemoTrackViewState => {
    const isActive = activeTrackId === track.id;
    const isLoading = loadingTrackId === track.id;
    const durationSeconds = getResolvedTrackDuration(track, isActive);
    const positionSeconds = getResolvedTrackPosition(isActive);

    return {
      durationLabel: formatPlaybackTime(durationSeconds),
      isActive,
      isLoading,
      isSeekEnabled: isActive && durationSeconds > 0,
      positionLabel: formatPlaybackTime(positionSeconds),
      progressRatio: getProgressRatio(positionSeconds, durationSeconds),
    };
  }, [activeTrackId, getResolvedTrackDuration, getResolvedTrackPosition, loadingTrackId]);

  return {
    audioRef,
    getTrackViewState,
    handleProgressPointerDown,
    handleProgressPointerEnd,
    handleProgressPointerMove,
    playbackError,
    toggleTrack,
  };
}
