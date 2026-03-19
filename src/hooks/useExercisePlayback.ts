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
import type { ManagedSamplerController } from './useManagedSampler.ts';
import {
  buildNoteFromChromaticIndex,
  getNextPlayMode,
  getStepDurationMs,
  getStepNoteDurationSeconds,
  isPlayableIndex,
  parseNoteToChromaticIndex,
  shouldPickStartNote,
  wait,
} from '../utils/voiceTrainerPlaybackUtils.ts';

export interface UseExercisePlaybackResult {
  controls: VoiceTrainerControlsProps;
  piano: MangaPianoProps;
}

export default function useExercisePlayback(
  sampler: ManagedSamplerController,
): UseExercisePlaybackResult {
  const playbackRunIdRef = useRef(0);
  const playModeRef = useRef<PlayMode>(DEFAULT_PLAY_MODE);
  const bpmRef = useRef(DEFAULT_BPM);
  const manualHeldNoteRef = useRef<string | null>(null);

  const [autoCurrentNote, setAutoCurrentNote] = useState<string | null>(null);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [pendingExerciseId, setPendingExerciseId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [playMode, setPlayMode] = useState<PlayMode>(DEFAULT_PLAY_MODE);
  const [bpm, setBpm] = useState(DEFAULT_BPM);

  const selectedExercise = useMemo(
    () => (selectedExerciseId ? getExerciseById(selectedExerciseId) ?? null : null),
    [selectedExerciseId],
  );

  const pendingExercise = useMemo(
    () => (pendingExerciseId ? getExerciseById(pendingExerciseId) : undefined),
    [pendingExerciseId],
  );

  // 通过 runId 取消旧的异步播放循环，防止切换练习后出现多个循环并发。
  function isRunActive(runId: number): boolean {
    return playbackRunIdRef.current === runId;
  }

  function armExercise(exercise: Exercise | undefined): void {
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

  function clearAutoPlaybackState(): void {
    setAutoCurrentNote(null);
    setActiveExerciseId(null);
  }

  function stopPlayback(): void {
    playbackRunIdRef.current += 1;
    clearAutoPlaybackState();

    // 这里主动 release，保证停止时不会残留长音或高亮状态。
    void sampler.releaseAll();
  }

  useEffect(() => {
    return () => {
      playbackRunIdRef.current += 1;
      manualHeldNoteRef.current = null;
    };
  }, []);

  function toggleMode(): void {
    setPlayMode((prevMode) => {
      const nextMode = getNextPlayMode(prevMode);
      playModeRef.current = nextMode;
      return nextMode;
    });
  }

  function handleBpmChange(nextBpm: number): void {
    bpmRef.current = nextBpm;
    setBpm(nextBpm);
  }

  function handleNoteDown(note: string): void {
    if (pendingExercise) {
      // 当前按键只承担“选择起始音”的职责，不再额外触发手动弹奏。
      setPendingExerciseId(null);
      void playExercise(pendingExercise, note);
      return;
    }

    manualHeldNoteRef.current = note;
    void sampler.triggerAttack(note);
  }

  function handleNoteUp(note: string): void {
    if (manualHeldNoteRef.current !== note) {
      return;
    }

    manualHeldNoteRef.current = null;
    void sampler.triggerRelease(note);
  }

  async function playExercise(exercise: Exercise, startNote: string): Promise<void> {
    if (!sampler.isReady()) {
      return;
    }

    const startNoteIndex = parseNoteToChromaticIndex(startNote);
    if (startNoteIndex === null) {
      return;
    }

    if (activeExerciseId === exercise.id) {
      stopPlayback();
      return;
    }

    stopPlayback();
    setPendingExerciseId(null);

    // 每次启动新的播放任务都生成新的 runId，旧任务会在下一次检查时自动退出。
    const runId = playbackRunIdRef.current + 1;
    playbackRunIdRef.current = runId;
    setActiveExerciseId(exercise.id);

    let currentStartIndex = startNoteIndex;

    try {
      while (isRunActive(runId)) {
        for (const step of exercise.steps) {
          if (!isRunActive(runId)) {
            break;
          }

          const totalIndex = currentStartIndex + step.interval;
          const fullNote = buildNoteFromChromaticIndex(totalIndex);
          const stepDurationMs = getStepDurationMs(step.beats, bpmRef.current);
          const noteDurationSeconds = getStepNoteDurationSeconds(stepDurationMs);

          setAutoCurrentNote(fullNote);
          await sampler.triggerAttackRelease(fullNote, noteDurationSeconds);

          if (!isRunActive(runId)) {
            break;
          }

          await wait(stepDurationMs);
        }

        if (!isRunActive(runId) || playModeRef.current === 'once') {
          break;
        }

        if (playModeRef.current === 'up') {
          currentStartIndex += 1;
        } else if (playModeRef.current === 'down') {
          currentStartIndex -= 1;
        }

        // 超出当前采样可播放范围后停止，避免继续生成不可用音名。
        if (!isPlayableIndex(currentStartIndex)) {
          break;
        }

        await wait(getStepDurationMs(1.25, bpmRef.current));
      }
    } finally {
      if (playbackRunIdRef.current === runId) {
        clearAutoPlaybackState();
      }
    }
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
    stopPlayback();
    setPendingExerciseId(null);
  }

  function handlePrimaryAction(): void {
    if (activeExerciseId !== null) {
      stopPlayback();
      if (selectedExercise) {
        armExercise(selectedExercise);
      }
      return;
    }

    if (!selectedExercise || pendingExerciseId !== null) {
      return;
    }

    armExercise(selectedExercise);
  }

  return {
    controls: {
      activeExerciseId,
      bpm,
      isSamplerReady: sampler.isSamplerReady,
      pendingExerciseId,
      playMode,
      selectedExercise,
      selectedExerciseId,
      onBpmChange: handleBpmChange,
      onExerciseChange: handleExerciseChange,
      onPrimaryAction: handlePrimaryAction,
      onToggleMode: toggleMode,
    },
    piano: {
      disabled: !sampler.isSamplerReady,
      onNoteDown: handleNoteDown,
      onNoteUp: handleNoteUp,
      pressedNotes: autoCurrentNote ? [autoCurrentNote] : [],
      followNote: autoCurrentNote,
    },
  };
}
