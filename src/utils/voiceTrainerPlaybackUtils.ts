import {
  EXERCISES,
  NOTE_NAMES,
  type Exercise,
  type PlayMode,
} from '../config/voiceTrainerExercises.ts';

const PLAY_MODE_SEQUENCE: PlayMode[] = ['once', 'up', 'down'];
export const AUTO_PLAY_NOTE_GATE_RATIO = 0.995;
export const AUTO_PLAY_NOTE_MIN_DURATION_MS = 180;
export const DEFAULT_LOWER_BOUND_NOTE = 'C3';
export const DEFAULT_UPPER_BOUND_NOTE = 'C5';
export const MIN_BOUNDARY_NOTE = 'C2';
export const MAX_BOUNDARY_NOTE = 'C6';

export interface ExerciseIntervalBounds {
  minInterval: number;
  maxInterval: number;
}

export interface BoundaryNoteOption {
  label: string;
  value: string;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function getInitialExercise(): Exercise {
  const initialExercise = EXERCISES[0];

  if (!initialExercise) {
    throw new Error('未配置任何练习项');
  }

  return initialExercise;
}

// 音阶类练习需要先由用户在键盘上指定起始音。
export function shouldPickStartNote(exercise: Exercise | undefined): boolean {
  return Boolean(exercise && exercise.category === 'scale' && exercise.launchMode === 'pick-note');
}

export function getNextPlayMode(currentMode: PlayMode): PlayMode {
  const nextIndex = (PLAY_MODE_SEQUENCE.indexOf(currentMode) + 1) % PLAY_MODE_SEQUENCE.length;
  return PLAY_MODE_SEQUENCE[nextIndex];
}

// 把用户点击的音名转成统一的半音序索引，后续所有练习都基于这个索引偏移。
export function parseNoteToChromaticIndex(note: string): number | null {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) {
    return null;
  }

  const [, noteName, octaveText] = match;
  const noteIndex = NOTE_NAMES.indexOf(noteName);
  if (noteIndex < 0) {
    return null;
  }

  return Number(octaveText) * 12 + noteIndex;
}

export function getStepDurationMs(beats: number, bpm: number): number {
  return (60000 / bpm) * beats;
}

export function getStepNoteDurationMs(stepDurationMs: number): number {
  // gate 越接近 1，相邻两个自动播放音符之间的留白越小。
  return Math.max(stepDurationMs * AUTO_PLAY_NOTE_GATE_RATIO, AUTO_PLAY_NOTE_MIN_DURATION_MS);
}

// 时值略小于整步长，给相邻音一点点呼吸空间，避免采样重叠过脏。
export function getStepNoteDurationSeconds(stepDurationMs: number): number {
  return getStepNoteDurationMs(stepDurationMs) * 0.001;
}

export function buildNoteFromChromaticIndex(totalIndex: number): string {
  const octave = Math.floor(totalIndex / 12);
  const noteName = NOTE_NAMES[totalIndex % 12];
  return `${noteName}${octave}`;
}

export function isPlayableIndex(totalIndex: number): boolean {
  return totalIndex >= 9 && totalIndex <= 96;
}

// 边界音的选择项不必铺满整张钢琴，先限制在更常用的练声区间里，避免下拉过长。
export function getBoundaryNoteOptions(): BoundaryNoteOption[] {
  const minIndex = parseNoteToChromaticIndex(MIN_BOUNDARY_NOTE);
  const maxIndex = parseNoteToChromaticIndex(MAX_BOUNDARY_NOTE);

  if (minIndex === null || maxIndex === null || minIndex > maxIndex) {
    return [];
  }

  const options: BoundaryNoteOption[] = [];

  for (let currentIndex = minIndex; currentIndex <= maxIndex; currentIndex += 1) {
    const note = buildNoteFromChromaticIndex(currentIndex);
    options.push({
      label: note,
      value: note,
    });
  }

  return options;
}

// 练习的最高/最低实际发声音高，取决于 steps 里的相对 interval 范围。
export function getExerciseIntervalBounds(exercise: Exercise): ExerciseIntervalBounds {
  return exercise.steps.reduce<ExerciseIntervalBounds>(
    (bounds, step) => ({
      minInterval: Math.min(bounds.minInterval, step.interval),
      maxInterval: Math.max(bounds.maxInterval, step.interval),
    }),
    { minInterval: Number.POSITIVE_INFINITY, maxInterval: Number.NEGATIVE_INFINITY },
  );
}

// 起始音是否合法，不看根音本身，而是看整条练习实际发出的最低/最高音是否仍在钢琴可播放范围内。
export function isExerciseStartIndexPlayable(exercise: Exercise, startIndex: number): boolean {
  const { minInterval, maxInterval } = getExerciseIntervalBounds(exercise);
  return isPlayableIndex(startIndex + minInterval) && isPlayableIndex(startIndex + maxInterval);
}

export function isStartIndexWithinBounds(
  startIndex: number,
  lowerBoundIndex: number,
  upperBoundIndex: number,
): boolean {
  return startIndex >= lowerBoundIndex && startIndex <= upperBoundIndex;
}

interface AutoRoundStartIndexesOptions {
  exercise: Exercise;
  lowerBoundIndex: number;
  playMode: 'up' | 'down';
  startNoteIndex: number;
  upperBoundIndex: number;
}

function buildRoundTripStartIndexes(
  startNoteIndex: number,
  turnStartIndex: number,
  direction: 1 | -1,
): number[] {
  const roundStartIndexes = [startNoteIndex];

  if (startNoteIndex === turnStartIndex) {
    return roundStartIndexes;
  }

  if (direction === 1) {
    for (let nextStartIndex = startNoteIndex + 1; nextStartIndex <= turnStartIndex; nextStartIndex += 1) {
      roundStartIndexes.push(nextStartIndex);
    }

    for (let nextStartIndex = turnStartIndex - 1; nextStartIndex >= startNoteIndex; nextStartIndex -= 1) {
      roundStartIndexes.push(nextStartIndex);
    }

    return roundStartIndexes;
  }

  for (let nextStartIndex = startNoteIndex - 1; nextStartIndex >= turnStartIndex; nextStartIndex -= 1) {
    roundStartIndexes.push(nextStartIndex);
  }

  for (let nextStartIndex = turnStartIndex + 1; nextStartIndex <= startNoteIndex; nextStartIndex += 1) {
    roundStartIndexes.push(nextStartIndex);
  }

  return roundStartIndexes;
}

// 自动上行/下行不再无限推进，而是在“起始音范围”内构造一条“去程 + 回程”的播放计划。
export function buildAutoRoundStartIndexes({
  exercise,
  lowerBoundIndex,
  playMode,
  startNoteIndex,
  upperBoundIndex,
}: AutoRoundStartIndexesOptions): number[] | null {
  const turnStartIndex = playMode === 'up' ? upperBoundIndex : lowerBoundIndex;

  if (playMode === 'up' && startNoteIndex > turnStartIndex) {
    return null;
  }

  if (playMode === 'down' && startNoteIndex < turnStartIndex) {
    return null;
  }

  if (
    !isStartIndexWithinBounds(startNoteIndex, lowerBoundIndex, upperBoundIndex) ||
    !isStartIndexWithinBounds(turnStartIndex, lowerBoundIndex, upperBoundIndex) ||
    !isExerciseStartIndexPlayable(exercise, startNoteIndex) ||
    !isExerciseStartIndexPlayable(exercise, turnStartIndex)
  ) {
    return null;
  }

  return buildRoundTripStartIndexes(
    startNoteIndex,
    turnStartIndex,
    playMode === 'up' ? 1 : -1,
  );
}
