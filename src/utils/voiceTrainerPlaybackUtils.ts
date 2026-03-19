import {
  EXERCISES,
  NOTE_NAMES,
  type Exercise,
  type PlayMode,
} from '../config/voiceTrainerExercises.ts';

const PLAY_MODE_SEQUENCE: PlayMode[] = ['once', 'up', 'down'];

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

// 时值略小于整步长，给相邻音一点点呼吸空间，避免采样重叠过脏。
export function getStepNoteDurationSeconds(stepDurationMs: number): number {
  return Math.max(stepDurationMs * 0.001 * 0.97, 0.18);
}

export function buildNoteFromChromaticIndex(totalIndex: number): string {
  const octave = Math.floor(totalIndex / 12);
  const noteName = NOTE_NAMES[totalIndex % 12];
  return `${noteName}${octave}`;
}

export function isPlayableIndex(totalIndex: number): boolean {
  return totalIndex >= 9 && totalIndex <= 96;
}
