import type { Exercise, PlayMode } from '../config/voiceTrainerExercises.ts';
import type { PlaybackSequence, PlaybackSequenceStep } from './playerAdapter.ts';
import {
  buildAutoRoundStartIndexes,
  buildNoteFromChromaticIndex,
  getStepDurationMs,
  getStepNoteDurationMs,
  isExerciseStartIndexPlayable,
  parseNoteToChromaticIndex,
} from '../utils/voiceTrainerPlaybackUtils.ts';

const ROUND_BREAK_BEATS = 1.25;

export type ExerciseSequencePlannerErrorCode =
  | 'invalid-start-note'
  | 'invalid-boundary-note'
  | 'start-note-out-of-range'
  | 'round-trip-out-of-range';

export class ExerciseSequencePlannerError extends Error {
  readonly code: ExerciseSequencePlannerErrorCode;

  constructor(code: ExerciseSequencePlannerErrorCode, message: string) {
    super(message);
    this.name = 'ExerciseSequencePlannerError';
    this.code = code;
  }
}

export interface BuildExercisePlaybackSequenceOptions {
  exercise: Exercise;
  startNote: string;
  playMode: PlayMode;
  bpm: number;
  lowerBoundNote: string;
  upperBoundNote: string;
}

interface ResolvedBoundaryIndexes {
  lowerBoundIndex: number;
  upperBoundIndex: number;
}

function resolveBoundaryIndexes(
  lowerBoundNote: string,
  upperBoundNote: string,
): ResolvedBoundaryIndexes {
  const lowerBoundIndex = parseNoteToChromaticIndex(lowerBoundNote);
  const upperBoundIndex = parseNoteToChromaticIndex(upperBoundNote);

  if (lowerBoundIndex === null || upperBoundIndex === null || lowerBoundIndex > upperBoundIndex) {
    throw new ExerciseSequencePlannerError(
      'invalid-boundary-note',
      '播放边界音配置无效，无法生成练习序列。',
    );
  }

  return {
    lowerBoundIndex,
    upperBoundIndex,
  };
}

function resolveRoundStartIndexes({
  exercise,
  lowerBoundIndex,
  playMode,
  startNoteIndex,
  upperBoundIndex,
}: {
  exercise: Exercise;
  lowerBoundIndex: number;
  playMode: PlayMode;
  startNoteIndex: number;
  upperBoundIndex: number;
}): number[] {
  if (playMode === 'once') {
    return [startNoteIndex];
  }

  const roundStartIndexes = buildAutoRoundStartIndexes({
    exercise,
    lowerBoundIndex,
    playMode,
    startNoteIndex,
    upperBoundIndex,
  });

  if (!roundStartIndexes) {
    throw new ExerciseSequencePlannerError(
      'round-trip-out-of-range',
      '当前起始音无法在目标模式和边界内完成折返。',
    );
  }

  return roundStartIndexes;
}

function buildSequenceSteps(
  exercise: Exercise,
  roundStartIndexes: number[],
  bpm: number,
): PlaybackSequenceStep[] {
  const roundBreakDurationMs = getStepDurationMs(ROUND_BREAK_BEATS, bpm);

  return roundStartIndexes.flatMap((roundStartIndex, roundIndex) =>
    exercise.steps.map((exerciseStep, stepIndex) => {
      const note = buildNoteFromChromaticIndex(roundStartIndex + exerciseStep.interval);
      const baseStepDurationMs = getStepDurationMs(exerciseStep.beats, bpm);
      const isLastStepOfRound = stepIndex === exercise.steps.length - 1;
      const isLastRound = roundIndex === roundStartIndexes.length - 1;

      // 非最后一轮的收尾额外留一拍多一点空隙，让换轮次时听感更像练声口令的起承转合。
      const durationMs =
        isLastStepOfRound && !isLastRound
          ? baseStepDurationMs + roundBreakDurationMs
          : baseStepDurationMs;

      return {
        note,
        durationMs,
        noteDurationMs: getStepNoteDurationMs(baseStepDurationMs),
        stepIndex,
        roundIndex,
      };
    }),
  );
}

export function buildExercisePlaybackSequence({
  exercise,
  startNote,
  playMode,
  bpm,
  lowerBoundNote,
  upperBoundNote,
}: BuildExercisePlaybackSequenceOptions): PlaybackSequence {
  const startNoteIndex = parseNoteToChromaticIndex(startNote);

  if (startNoteIndex === null) {
    throw new ExerciseSequencePlannerError(
      'invalid-start-note',
      '当前起始音无法解析成半音索引。',
    );
  }

  if (!isExerciseStartIndexPlayable(exercise, startNoteIndex)) {
    throw new ExerciseSequencePlannerError(
      'start-note-out-of-range',
      '当前起始音超出练习可播放范围。',
    );
  }

  const { lowerBoundIndex, upperBoundIndex } = resolveBoundaryIndexes(
    lowerBoundNote,
    upperBoundNote,
  );
  const roundStartIndexes = resolveRoundStartIndexes({
    exercise,
    lowerBoundIndex,
    playMode,
    startNoteIndex,
    upperBoundIndex,
  });

  return {
    steps: buildSequenceSteps(exercise, roundStartIndexes, bpm),
    bpm,
    startNote,
    playMode,
  };
}
