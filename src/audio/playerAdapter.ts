import type { PlayMode } from '../config/voiceTrainerExercises.ts';

export interface PlaybackError {
  code: string;
  message: string;
  recoverable: boolean;
}

export type PlaybackEvent =
  | { type: 'noteStart'; note: string; stepIndex: number; roundIndex: number }
  | { type: 'sequenceComplete' }
  | { type: 'stopped' }
  | { type: 'error'; error: PlaybackError };

export interface PlaybackSequenceStep {
  note: string;
  durationMs: number;
  noteDurationMs: number;
  stepIndex: number;
  roundIndex: number;
}

export interface PlaybackSequence {
  steps: PlaybackSequenceStep[];
  bpm: number;
  startNote: string;
  playMode: PlayMode;
}

export type PlaybackListener = (event: PlaybackEvent) => void;

export interface PlayerAdapter {
  /**
   * 预热底层播放器资源；必须幂等，ready 后应立即 resolve。
   * 初始化失败时应该 reject，但后续允许再次重试 prepare。
   */
  prepare(): Promise<void>;

  isReady(): boolean;

  /**
   * 手动试音入口。若此时存在自动播放，调用方应先 stop 当前 sequence，
   * 再把手动按键交给 adapter，避免留下隐性并发行为。
   */
  startNote(note: string): Promise<void>;

  stopNote(note: string): Promise<void>;

  /**
   * 自动练习入口。sequence 的调度执行权完全归 adapter 所有，
   * 上层 hook 不能再偷偷保留逐音循环作为后门兜底。
   */
  playSequence(sequence: PlaybackSequence): Promise<void>;

  /**
   * 仅停止当前播放流程，不等价于销毁底层实例。
   */
  stop(): Promise<void>;

  /**
   * 只负责清干净当前残音，不承担上层状态收尾职责。
   */
  releaseAll(): Promise<void>;

  /**
   * 只销毁底层资源，不负责替上层派发 stopped 或清理 UI 状态。
   */
  dispose(): Promise<void> | void;

  /**
   * 允许多个 listener 订阅；订阅所有权归上层 hook，必须在 cleanup 中取消。
   */
  subscribe(listener: PlaybackListener): () => void;
}
