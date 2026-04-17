import { useEffect, useMemo, useRef, useState } from 'react';
import type { MangaPianoProps } from '../components/MangaPiano.tsx';
import type { VoiceTrainerControlsProps } from '../components/VoiceTrainerControls.tsx';
import {
  DEFAULT_BPM,
  DEFAULT_PLAY_MODE,
  getExerciseById,
  type PlayMode,
} from '../config/voiceTrainerExercises.ts';
import type { Exercise } from '../config/voiceTrainerExercises.ts';
import {
  DEFAULT_LOWER_BOUND_NOTE,
  DEFAULT_UPPER_BOUND_NOTE,
  getNextPlayMode,
  parseNoteToChromaticIndex,
  shouldPickStartNote,
} from '../utils/voiceTrainerPlaybackUtils.ts';
import {
  buildExercisePlaybackSequence,
  ExerciseSequencePlannerError,
} from '../audio/exerciseSequencePlanner.ts';
import type { PlaybackEvent, PlaybackSequence, PlayerAdapter } from '../audio/playerAdapter.ts';

export interface UseExercisePlaybackResult {
  controls: VoiceTrainerControlsProps;
  piano: MangaPianoProps;
}

interface ActivePlaybackRuntime {
  sequence: PlaybackSequence;
  roundLeadNoteIndexes: Map<number, number>;
}

function getPlannerErrorMessage(
  error: ExerciseSequencePlannerError,
  lowerBoundNote: string,
  upperBoundNote: string,
): string {
  switch (error.code) {
    case 'invalid-start-note':
      return '当前起始音无法识别，请换一个键再试。';
    case 'invalid-boundary-note':
      return '起始音范围配置异常，请重新调整最低音和最高音。';
    case 'start-note-out-of-range':
      return `这个起始音不在当前设定的起始音范围 ${lowerBoundNote} 到 ${upperBoundNote} 内，或超出练习可播放范围，请换一个更合适的音。`;
    case 'round-trip-out-of-range':
      return `当前模式会在起始音范围 ${lowerBoundNote} 到 ${upperBoundNote} 内折返，请换一个起始音。`;
    default:
      return error.message;
  }
}

function getPlaybackFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '播放器执行失败，请稍后重试。';
}

function buildSequenceRoundLeadNoteIndexes(sequence: PlaybackSequence): Map<number, number> {
  const roundLeadNoteIndexes = new Map<number, number>();

  for (const step of sequence.steps) {
    if (step.stepIndex !== 0 || roundLeadNoteIndexes.has(step.roundIndex)) {
      continue;
    }

    const noteIndex = parseNoteToChromaticIndex(step.note);
    if (noteIndex !== null) {
      roundLeadNoteIndexes.set(step.roundIndex, noteIndex);
    }
  }

  return roundLeadNoteIndexes;
}

export default function useExercisePlayback(
  player: PlayerAdapter,
  isPlayerReady: boolean,
): UseExercisePlaybackResult {
  const playModeRef = useRef<PlayMode>(DEFAULT_PLAY_MODE);
  const manualHeldNoteRef = useRef<string | null>(null);
  const activePlaybackRef = useRef<ActivePlaybackRuntime | null>(null);
  const lastStartedRoundIndexRef = useRef<number | null>(null);

  const [autoCurrentNote, setAutoCurrentNote] = useState<string | null>(null);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [exerciseStartNote, setExerciseStartNote] = useState<string | null>(null);
  const [pendingExerciseId, setPendingExerciseId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [playMode, setPlayMode] = useState<PlayMode>(DEFAULT_PLAY_MODE);
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [lowerBoundNote, setLowerBoundNote] = useState(DEFAULT_LOWER_BOUND_NOTE);
  const [upperBoundNote, setUpperBoundNote] = useState(DEFAULT_UPPER_BOUND_NOTE);

  const selectedExercise = useMemo(
    () => (selectedExerciseId ? getExerciseById(selectedExerciseId) ?? null : null),
    [selectedExerciseId],
  );

  const pendingExercise = useMemo(
    () => (pendingExerciseId ? getExerciseById(pendingExerciseId) : undefined),
    [pendingExerciseId],
  );

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    return () => {
      manualHeldNoteRef.current = null;
    };
  }, []);

  function clearAutoPlaybackState(): void {
    activePlaybackRef.current = null;
    lastStartedRoundIndexRef.current = null;
    setAutoCurrentNote(null);
    setActiveExerciseId(null);
    setExerciseStartNote(null);
  }

  function armExercise(exercise: Exercise | undefined): void {
    setPlaybackError(null);

    if (!exercise) {
      setPendingExerciseId(null);
      return;
    }

    if (shouldPickStartNote(exercise)) {
      setPendingExerciseId(exercise.id);
      return;
    }

    setPendingExerciseId(null);
  }

  function setCurrentPlayMode(nextMode: PlayMode): void {
    playModeRef.current = nextMode;
    setPlayMode(nextMode);
  }

  async function ensurePlayerReady(): Promise<boolean> {
    if (player.isReady()) {
      return true;
    }

    try {
      await player.prepare();
      return player.isReady();
    } catch (error) {
      setPlaybackError(getPlaybackFailureMessage(error));
      return false;
    }
  }

  async function stopPlayback(): Promise<void> {
    try {
      await player.stop();
      await player.releaseAll();
    } catch (error) {
      setPlaybackError(getPlaybackFailureMessage(error));
      clearAutoPlaybackState();
    }
  }

  useEffect(() => {
    function syncRoundTripDirection(event: Extract<PlaybackEvent, { type: 'noteStart' }>): void {
      if (event.stepIndex !== 0) {
        return;
      }

      const activePlayback = activePlaybackRef.current;
      if (!activePlayback) {
        return;
      }

      if (activePlayback.sequence.playMode === 'once') {
        return;
      }

      if (lastStartedRoundIndexRef.current === event.roundIndex) {
        return;
      }

      const previousRoundIndex = lastStartedRoundIndexRef.current;
      lastStartedRoundIndexRef.current = event.roundIndex;

      if (previousRoundIndex === null) {
        return;
      }

      const previousRoundLeadNoteIndex =
        activePlayback.roundLeadNoteIndexes.get(previousRoundIndex) ?? null;
      const currentRoundLeadNoteIndex =
        activePlayback.roundLeadNoteIndexes.get(event.roundIndex) ?? null;

      if (previousRoundLeadNoteIndex === null || currentRoundLeadNoteIndex === null) {
        return;
      }

      // 播放方向仍由 hook 维护，adapter 只汇报“当前播到了哪一轮的第几个 step”。
      if (
        activePlayback.sequence.playMode === 'up' &&
        currentRoundLeadNoteIndex < previousRoundLeadNoteIndex
      ) {
        setCurrentPlayMode('down');
      }

      if (
        activePlayback.sequence.playMode === 'down' &&
        currentRoundLeadNoteIndex > previousRoundLeadNoteIndex
      ) {
        setCurrentPlayMode('up');
      }
    }

    const unsubscribe = player.subscribe((event) => {
      switch (event.type) {
        case 'noteStart':
          setAutoCurrentNote(event.note);
          syncRoundTripDirection(event);
          break;
        case 'sequenceComplete':
        case 'stopped':
          clearAutoPlaybackState();
          break;
        case 'error':
          setPlaybackError(event.error.message);
          clearAutoPlaybackState();
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [player]);

  function toggleMode(): void {
    setPlaybackError(null);
    setPlayMode((prevMode) => {
      const nextMode = getNextPlayMode(prevMode);
      playModeRef.current = nextMode;
      return nextMode;
    });
  }

  function handleBpmChange(nextBpm: number): void {
    setBpm(nextBpm);
  }

  function handleLowerBoundNoteChange(nextLowerBoundNote: string): void {
    const nextLowerBoundIndex = parseNoteToChromaticIndex(nextLowerBoundNote);
    const currentUpperBoundIndex = parseNoteToChromaticIndex(upperBoundNote);

    if (nextLowerBoundIndex === null || currentUpperBoundIndex === null) {
      return;
    }

    // 如果用户把最低音拖过了最高音，就顺手把最高音一起推到同一个值，减少无效状态。
    if (nextLowerBoundIndex > currentUpperBoundIndex) {
      setUpperBoundNote(nextLowerBoundNote);
    }

    setLowerBoundNote(nextLowerBoundNote);
    setPlaybackError(null);
    void stopPlayback();
  }

  function handleUpperBoundNoteChange(nextUpperBoundNote: string): void {
    const currentLowerBoundIndex = parseNoteToChromaticIndex(lowerBoundNote);
    const nextUpperBoundIndex = parseNoteToChromaticIndex(nextUpperBoundNote);

    if (currentLowerBoundIndex === null || nextUpperBoundIndex === null) {
      return;
    }

    // 同理，最高音不能落到最低音以下；这里直接把最低音收拢到同一格。
    if (nextUpperBoundIndex < currentLowerBoundIndex) {
      setLowerBoundNote(nextUpperBoundNote);
    }

    setUpperBoundNote(nextUpperBoundNote);
    setPlaybackError(null);
    void stopPlayback();
  }

  function handleNoteDown(note: string): void {
    if (pendingExercise) {
      // 当前按键只承担“选择起始音”的职责，不再额外触发手动弹奏。
      void playExercise(pendingExercise, note);
      return;
    }

    void startManualNote(note);
  }

  function handleNoteUp(note: string): void {
    if (manualHeldNoteRef.current !== note) {
      return;
    }

    manualHeldNoteRef.current = null;
    void player.stopNote(note).catch((error: unknown) => {
      setPlaybackError(getPlaybackFailureMessage(error));
    });
  }

  async function startManualNote(note: string): Promise<void> {
    manualHeldNoteRef.current = note;

    if (!(await ensurePlayerReady())) {
      manualHeldNoteRef.current = null;
      return;
    }

    // 如果用户在 prepare 或 adapter 停止旧流程期间已经松手，就不要再补 attack。
    if (manualHeldNoteRef.current !== note) {
      return;
    }

    setPlaybackError(null);

    try {
      await player.startNote(note);
    } catch (error) {
      if (manualHeldNoteRef.current === note) {
        manualHeldNoteRef.current = null;
      }

      setPlaybackError(getPlaybackFailureMessage(error));
    }
  }

  async function playExercise(exercise: Exercise, startNote: string): Promise<void> {
    if (!(await ensurePlayerReady())) {
      return;
    }

    if (activeExerciseId === exercise.id) {
      await stopPlayback();
      return;
    }

    const currentPlayMode = playModeRef.current;
    let sequence: PlaybackSequence;

    try {
      sequence = buildExercisePlaybackSequence({
        exercise,
        startNote,
        playMode: currentPlayMode,
        bpm,
        lowerBoundNote,
        upperBoundNote,
      });
    } catch (error) {
      if (error instanceof ExerciseSequencePlannerError) {
        setPlaybackError(getPlannerErrorMessage(error, lowerBoundNote, upperBoundNote));
        return;
      }

      setPlaybackError(getPlaybackFailureMessage(error));
      return;
    }

    await stopPlayback();
    setPlaybackError(null);
    setPendingExerciseId(null);
    setExerciseStartNote(startNote);
    activePlaybackRef.current = {
      sequence,
      roundLeadNoteIndexes: buildSequenceRoundLeadNoteIndexes(sequence),
    };
    lastStartedRoundIndexRef.current = null;
    setActiveExerciseId(exercise.id);

    void player.playSequence(sequence).catch((error: unknown) => {
      setPlaybackError(getPlaybackFailureMessage(error));
      clearAutoPlaybackState();
    });
  }

  function handleExerciseChange(nextExerciseId: string): void {
    if (!nextExerciseId) {
      return;
    }

    const nextExercise = getExerciseById(nextExerciseId);
    if (!nextExercise) {
      return;
    }

    setSelectedExerciseId(nextExercise.id);
    setPlaybackError(null);
    void stopPlayback();
    setPendingExerciseId(null);
  }

  function handlePrimaryAction(): void {
    if (activeExerciseId !== null) {
      void stopPlayback();
      if (selectedExercise) {
        armExercise(selectedExercise);
      }
      return;
    }

    if (!selectedExercise || pendingExerciseId !== null) {
      return;
    }

    setPlaybackError(null);
    armExercise(selectedExercise);
  }

  return {
    controls: {
      activeExerciseId,
      bpm,
      isPlayerReady,
      lowerBoundNote,
      pendingExerciseId,
      playMode,
      playbackError,
      selectedExercise,
      selectedExerciseId,
      upperBoundNote,
      onBpmChange: handleBpmChange,
      onExerciseChange: handleExerciseChange,
      onLowerBoundNoteChange: handleLowerBoundNoteChange,
      onPrimaryAction: handlePrimaryAction,
      onToggleMode: toggleMode,
      onUpperBoundNoteChange: handleUpperBoundNoteChange,
    },
    piano: {
      disabled: !isPlayerReady,
      onNoteDown: handleNoteDown,
      onNoteUp: handleNoteUp,
      pressedNotes: autoCurrentNote ? [autoCurrentNote] : [],
      followNote: autoCurrentNote,
      startNoteMarker: exerciseStartNote,
    },
  };
}
