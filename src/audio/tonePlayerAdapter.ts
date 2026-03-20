import MySampler from './sampler.ts';
import type {
  PlaybackError,
  PlaybackEvent,
  PlaybackListener,
  PlaybackSequence,
  PlayerAdapter,
} from './playerAdapter.ts';
import { wait } from '../utils/voiceTrainerPlaybackUtils.ts';

interface TonePlayerSampler {
  loaded: boolean;
  ready(): Promise<void>;
  triggerAttackRelease(note: string, durationSeconds: number): Promise<void>;
  triggerAttack(note: string): Promise<void>;
  triggerRelease(note: string): Promise<void>;
  releaseAll(): Promise<void>;
  dispose(): void;
}

interface TonePlayerAdapterOptions {
  sampler?: TonePlayerSampler;
  waitMs?: (ms: number) => Promise<void>;
}

function toPlaybackError(error: unknown): PlaybackError {
  if (error instanceof Error) {
    return {
      code: 'tone-playback-failed',
      message: error.message,
      recoverable: true,
    };
  }

  return {
    code: 'tone-playback-failed',
    message: '浏览器播放器执行失败，请稍后重试。',
    recoverable: true,
  };
}

export default class TonePlayerAdapter implements PlayerAdapter {
  private readonly sampler: TonePlayerSampler;

  private readonly waitMs: (ms: number) => Promise<void>;

  private readonly listeners = new Set<PlaybackListener>();

  private preparePromise: Promise<void> | null = null;

  private ready = false;

  private disposed = false;

  private activeSequenceRunId = 0;

  private activeSequenceTask: Promise<void> | null = null;

  constructor(options: TonePlayerAdapterOptions = {}) {
    this.sampler = options.sampler ?? new MySampler();
    this.waitMs = options.waitMs ?? wait;
  }

  async prepare(): Promise<void> {
    if (this.disposed) {
      throw new Error('播放器已销毁，无法继续 prepare。');
    }

    if (this.ready) {
      return;
    }

    if (this.preparePromise) {
      return this.preparePromise;
    }

    this.preparePromise = this.sampler
      .ready()
      .then(() => {
        this.ready = true;
      })
      .catch((error: unknown) => {
        this.preparePromise = null;
        throw error;
      });

    return this.preparePromise;
  }

  isReady(): boolean {
    return this.ready;
  }

  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async startNote(note: string): Promise<void> {
    await this.prepare();
    await this.stop();
    await this.sampler.triggerAttack(note);
  }

  async stopNote(note: string): Promise<void> {
    if (this.disposed || !this.sampler.loaded) {
      return;
    }

    await this.sampler.triggerRelease(note);
  }

  async playSequence(sequence: PlaybackSequence): Promise<void> {
    await this.prepare();
    await this.stop();

    const runId = this.activeSequenceRunId + 1;
    this.activeSequenceRunId = runId;
    this.activeSequenceTask = this.runSequence(runId, sequence);

    return this.activeSequenceTask;
  }

  async stop(): Promise<void> {
    if (this.disposed) {
      return;
    }

    const hasActiveSequence = this.activeSequenceTask !== null;
    this.activeSequenceRunId += 1;
    this.activeSequenceTask = null;

    if (!hasActiveSequence) {
      return;
    }

    if (this.sampler.loaded) {
      await this.sampler.releaseAll();
    }

    this.emit({ type: 'stopped' });
  }

  async releaseAll(): Promise<void> {
    if (this.disposed || !this.sampler.loaded) {
      return;
    }

    await this.sampler.releaseAll();
  }

  dispose(): void {
    this.disposed = true;
    this.activeSequenceRunId += 1;
    this.activeSequenceTask = null;
    this.listeners.clear();
    this.sampler.dispose();
  }

  private emit(event: PlaybackEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private isSequenceRunActive(runId: number): boolean {
    return !this.disposed && this.activeSequenceRunId === runId;
  }

  private async runSequence(runId: number, sequence: PlaybackSequence): Promise<void> {
    try {
      for (const step of sequence.steps) {
        if (!this.isSequenceRunActive(runId)) {
          return;
        }

        this.emit({
          type: 'noteStart',
          note: step.note,
          stepIndex: step.stepIndex,
          roundIndex: step.roundIndex,
        });

        await this.sampler.triggerAttackRelease(step.note, step.noteDurationMs * 0.001);

        if (!this.isSequenceRunActive(runId)) {
          return;
        }

        await this.waitMs(step.durationMs);
      }

      if (!this.isSequenceRunActive(runId)) {
        return;
      }

      this.emit({ type: 'sequenceComplete' });
    } catch (error) {
      if (!this.isSequenceRunActive(runId)) {
        return;
      }

      this.emit({
        type: 'error',
        error: toPlaybackError(error),
      });
    } finally {
      if (this.activeSequenceRunId === runId) {
        this.activeSequenceTask = null;
      }
    }
  }
}
