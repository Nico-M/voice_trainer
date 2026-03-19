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
  buildAutoRoundStartIndexes,
  buildNoteFromChromaticIndex,
  DEFAULT_LOWER_BOUND_NOTE,
  DEFAULT_UPPER_BOUND_NOTE,
  getNextPlayMode,
  getStepDurationMs,
  getStepNoteDurationSeconds,
  isExerciseStartIndexPlayable,
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

  // 通过 runId 取消旧的异步播放循环，防止切换练习后出现多个循环并发。
  function isRunActive(runId: number): boolean {
    return playbackRunIdRef.current === runId;
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

  function clearAutoPlaybackState(): void {
    setAutoCurrentNote(null);
    setActiveExerciseId(null);
    setExerciseStartNote(null);
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
    setPlaybackError(null);
    setPlayMode((prevMode) => {
      const nextMode = getNextPlayMode(prevMode);
      playModeRef.current = nextMode;
      return nextMode;
    });
  }

  function setCurrentPlayMode(nextMode: PlayMode): void {
    playModeRef.current = nextMode;
    setPlayMode(nextMode);
  }

  function handleBpmChange(nextBpm: number): void {
    bpmRef.current = nextBpm;
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
    stopPlayback();
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
    stopPlayback();
  }

  function handleNoteDown(note: string): void {
    if (pendingExercise) {
      // 当前按键只承担“选择起始音”的职责，不再额外触发手动弹奏。
      void playExercise(pendingExercise, note);
      return;
    }

    setPlaybackError(null);
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
      setPlaybackError('当前起始音无法识别，请换一个键再试。');
      return;
    }

    if (activeExerciseId === exercise.id) {
      stopPlayback();
      return;
    }

    // 单次模式也需要先确认整条练习能完整落在采样可播放区间里。
    if (!isExerciseStartIndexPlayable(exercise, startNoteIndex)) {
      setPlaybackError('这个起始音超出当前练习的可播放范围，请换一个更合适的音。');
      return;
    }

    const currentPlayMode = playModeRef.current;
    const lowerBoundIndex = parseNoteToChromaticIndex(lowerBoundNote);
    const upperBoundIndex = parseNoteToChromaticIndex(upperBoundNote);
    let roundStartIndexes = [startNoteIndex];

    if (currentPlayMode === 'up' || currentPlayMode === 'down') {
      if (lowerBoundIndex === null || upperBoundIndex === null) {
        setPlaybackError('练习音域配置异常，请重新调整最低音和最高音。');
        return;
      }

      const autoRoundStartIndexes = buildAutoRoundStartIndexes({
        exercise,
        lowerBoundIndex,
        playMode: currentPlayMode,
        startNoteIndex,
        upperBoundIndex,
      });

      if (!autoRoundStartIndexes) {
        setPlaybackError(
          `当前模式会在 ${lowerBoundNote} 到 ${upperBoundNote} 范围内折返，请换一个起始音。`,
        );
        return;
      }

      roundStartIndexes = autoRoundStartIndexes;
    }

    stopPlayback();
    setPlaybackError(null);
    setPendingExerciseId(null);
    setExerciseStartNote(startNote);

    // 每次启动新的播放任务都生成新的 runId，旧任务会在下一次检查时自动退出。
    const runId = playbackRunIdRef.current + 1;
    playbackRunIdRef.current = runId;
    setActiveExerciseId(exercise.id);

    try {
      for (const [roundIndex, roundStartIndex] of roundStartIndexes.entries()) {
        if (!isRunActive(runId)) {
          break;
        }

        for (const step of exercise.steps) {
          if (!isRunActive(runId)) {
            break;
          }

          const totalIndex = roundStartIndex + step.interval;
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

        const nextRoundStartIndex = roundStartIndexes[roundIndex + 1];

        // 到达折返点后，直接把界面模式同步切到返程方向，避免 UI 仍停留在旧方向上造成误解。
        if (currentPlayMode === 'up' && nextRoundStartIndex !== undefined && nextRoundStartIndex < roundStartIndex) {
          setCurrentPlayMode('down');
        }

        if (currentPlayMode === 'down' && nextRoundStartIndex !== undefined && nextRoundStartIndex > roundStartIndex) {
          setCurrentPlayMode('up');
        }

        // 最后一轮已经回到用户选择的起始音，不再追加额外等待或新一轮推进。
        if (!isRunActive(runId) || roundIndex === roundStartIndexes.length - 1) {
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
    setPlaybackError(null);
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

    setPlaybackError(null);
    armExercise(selectedExercise);
  }

  return {
    controls: {
      activeExerciseId,
      bpm,
      isSamplerReady: sampler.isSamplerReady,
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
      disabled: !sampler.isSamplerReady,
      onNoteDown: handleNoteDown,
      onNoteUp: handleNoteUp,
      pressedNotes: autoCurrentNote ? [autoCurrentNote] : [],
      followNote: autoCurrentNote,
      startNoteMarker: exerciseStartNote,
    },
  };
}
