export type PlayMode = 'once' | 'up' | 'down';
export type ExerciseLaunchMode = 'pick-note' | 'instant';
export type ExerciseCategory = 'scale' | 'other';

// 每个练习步骤同时描述“音高偏移”和“持续拍数”，这样后续扩展节奏会更自然。
export interface ExerciseStep {
  interval: number;
  beats: number;
}

export interface Exercise {
  id: string;
  name: string;
  steps: ExerciseStep[];
  desc: string;
  category: ExerciseCategory;
  launchMode: ExerciseLaunchMode;
}

export const DEFAULT_PLAY_MODE: PlayMode = 'up';
export const DEFAULT_BPM = 70;
export const MIN_BPM = 50;
export const MAX_BPM = 140;
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const MODE_LABELS: Record<PlayMode, string> = {
  once: '单次循环',
  up: '自动上行',
  down: '自动下行',
};

// 这里集中维护练习配置，让页面只负责渲染和播放控制，不再直接堆叠业务常量。
export const EXERCISES: Exercise[] = [
  {
    id: 'scale-1',
    name: '音阶1',
    steps: [
      { interval: 0, beats: 1 },
      { interval: 2, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 5, beats: 1 },
      { interval: 7, beats: 1 },
      { interval: 5, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 2, beats: 1 },
      { interval: 0, beats: 2 },
    ],
    desc: '1 2 3 4 | 5 4 3 2 | 1 -',
    category: 'scale',
    launchMode: 'pick-note',
  },
  {
    id: 'scale-2',
    name: '音阶2',
    steps: [
      { interval: 0, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 7, beats: 1 },
      { interval: 12, beats: 1 },
      { interval: 7, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 0, beats: 1 },
    ],
    desc: '1 3 5 i | 5 3 1',
    category: 'scale',
    launchMode: 'pick-note',
  },
  {
    id: 'scale-3',
    name: '音阶3',
    steps: [
      { interval: 0, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 2, beats: 1 },
      { interval: 5, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 7, beats: 1 },
      { interval: 5, beats: 1 },
      { interval: 2, beats: 1 },
      { interval: 0, beats: 2 },
    ],
    desc: '1 3 2 4 | 3 5 4 2 | 1 -',
    category: 'scale',
    launchMode: 'pick-note',
  },
  {
    id: 'scale-4',
    name: '音阶4',
    steps: [
      { interval: 7, beats: 1 },
      { interval: 5, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 2, beats: 1 },
      { interval: 0, beats: 2 },
    ],
    desc: '5 4 | 3 2 | 1 -',
    category: 'scale',
    launchMode: 'pick-note',
  },
  {
    id: 'scale-5',
    name: '音阶5',
    steps: [
      { interval: 7, beats: 1 },
      { interval: 5, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 2, beats: 1 },
      { interval: 0, beats: 2 },
    ],
    desc: '5 4 3 2 | 1 -',
    category: 'scale',
    launchMode: 'pick-note',
  },
  {
    id: 'scale-6',
    name: '音阶6',
    steps: [
      { interval: 0, beats: 1 },
      { interval: 2, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 2, beats: 1 },
      { interval: 0, beats: 2 },
    ],
    desc: '1 2 | 3 2 | 1 -',
    category: 'scale',
    launchMode: 'pick-note',
  },
  {
    id: 'scale-7',
    name: '音阶7',
    steps: [
      { interval: 0, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 7, beats: 1 },
      { interval: 4, beats: 1 },
      { interval: 0, beats: 2 },
    ],
    desc: '1 3 | 5 3 | 1 -',
    category: 'scale',
    launchMode: 'pick-note',
  },
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}
