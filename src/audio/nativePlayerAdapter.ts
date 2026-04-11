import type {
  PlaybackError,
  PlaybackEvent,
  PlaybackListener,
  PlaybackSequence,
  PlayerAdapter,
} from './playerAdapter.ts';
import {
  NativeAudio,
  type NativeAudioErrorEvent,
  type NativeAudioPlugin,
  type NativeStepStartEvent,
} from '../native/nativeAudioPlugin.ts';

interface NativeListenerHandle {
  remove: () => Promise<void>;
}

interface PendingStopState {
  timeoutId: ReturnType<typeof globalThis.setTimeout>;
  promise: Promise<void>;
  reject: (error: unknown) => void;
  resolve: () => void;
}

interface NativePlayerAdapterOptions {
  nativeAudio?: NativeAudioPlugin;
}

const STOP_TIMEOUT_MS = 3000;

function toPlaybackError(event: NativeAudioErrorEvent): PlaybackError {
  return {
    code: event.code,
    message: event.message,
    recoverable: true,
  };
}

export default class NativePlayerAdapter implements PlayerAdapter {
  private readonly nativeAudio: NativeAudioPlugin;

  private readonly listeners = new Set<PlaybackListener>();

  private listenerHandlesPromise: Promise<NativeListenerHandle[]> | null = null;

  private preparePromise: Promise<void> | null = null;

  private pendingStop: PendingStopState | null = null;

  private ready = false;

  private disposed = false;

  private activeSequenceRunId: number | null = null;

  private nextSequenceRunId = 0;

  constructor(options: NativePlayerAdapterOptions = {}) {
    this.nativeAudio = options.nativeAudio ?? NativeAudio;
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

    this.preparePromise = this.attachNativeListeners()
      .then(() => this.nativeAudio.prepareSamples())
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
    await this.nativeAudio.playNote({ note });
  }

  async stopNote(_note: string): Promise<void> {
    if (this.disposed) {
      return;
    }

    // 当前手动试音一次只追踪一个音；在没有音名 -> streamId 反查表之前，
    // 先用 stopAll 保证“手松开就停”，不要把多音精细控制提前塞进阶段 5。
    await this.nativeAudio.stopAll();
  }

  async playSequence(sequence: PlaybackSequence): Promise<void> {
    await this.prepare();
    await this.stop();

    const runId = this.nextSequenceRunId + 1;
    this.nextSequenceRunId = runId;
    this.activeSequenceRunId = runId;

    try {
      await this.nativeAudio.playSequence(sequence);
    } catch (error) {
      if (this.activeSequenceRunId === runId) {
        this.activeSequenceRunId = null;
      }

      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (this.pendingStop) {
      return this.pendingStop.promise;
    }

    if (this.activeSequenceRunId === null) {
      return;
    }

    this.activeSequenceRunId = null;

    let resolveStop!: () => void;
    let rejectStop!: (error: unknown) => void;
    const stopPromise = new Promise<void>((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });
    const timeoutId = globalThis.setTimeout(() => {
      if (this.pendingStop?.promise !== stopPromise) {
        return;
      }

      this.pendingStop = null;
      this.activeSequenceRunId = null;

      // 原生 stopped 事件丢失时，至少要把前端等待链路解开，避免后续 start/play 全部卡死。
      void this.nativeAudio.stopAll().catch(() => undefined);
      resolveStop();
      this.emit({ type: 'stopped' });
    }, STOP_TIMEOUT_MS);

    this.pendingStop = {
      timeoutId,
      promise: stopPromise,
      reject: rejectStop,
      resolve: resolveStop,
    };

    try {
      await this.nativeAudio.stopSequence();
    } catch (error) {
      globalThis.clearTimeout(timeoutId);
      this.pendingStop = null;
      rejectStop(error);
      throw error;
    }

    return stopPromise;
  }

  async releaseAll(): Promise<void> {
    if (this.disposed) {
      return;
    }

    await this.nativeAudio.stopAll();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.activeSequenceRunId = null;
    this.ready = false;
    this.preparePromise = null;
    this.listeners.clear();

    if (this.pendingStop) {
      globalThis.clearTimeout(this.pendingStop.timeoutId);
      this.pendingStop.reject(new Error('播放器已销毁'));
      this.pendingStop = null;
    }

    const listenerHandlesPromise = this.listenerHandlesPromise;
    this.listenerHandlesPromise = null;

    if (!listenerHandlesPromise) {
      return;
    }

    const listenerHandles = await listenerHandlesPromise.catch(() => []);
    await Promise.all(listenerHandles.map((handle) => handle.remove()));
  }

  private emit(event: PlaybackEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private async attachNativeListeners(): Promise<NativeListenerHandle[]> {
    if (this.listenerHandlesPromise) {
      return this.listenerHandlesPromise;
    }

    this.listenerHandlesPromise = Promise.all([
      this.nativeAudio.addListener('stepStart', (event: NativeStepStartEvent) => {
        if (this.disposed || this.activeSequenceRunId === null) {
          return;
        }

        this.emit({
          type: 'noteStart',
          note: event.note,
          stepIndex: event.stepIndex,
          roundIndex: event.roundIndex,
        });
      }),
      this.nativeAudio.addListener('sequenceComplete', () => {
        if (this.disposed || this.activeSequenceRunId === null) {
          return;
        }

        this.activeSequenceRunId = null;
        this.emit({ type: 'sequenceComplete' });
      }),
      this.nativeAudio.addListener('stopped', () => {
        const pendingStop = this.pendingStop;
        const hadActiveSequence = this.activeSequenceRunId !== null;
        if (pendingStop) {
          globalThis.clearTimeout(pendingStop.timeoutId);
        }
        this.pendingStop = null;
        this.activeSequenceRunId = null;

        if (pendingStop) {
          pendingStop.resolve();
          this.emit({ type: 'stopped' });
          return;
        }

        // 这个分支是给未来可能出现的“Native 主动停止”留的兜底。
        if (!this.disposed && hadActiveSequence) {
          this.emit({ type: 'stopped' });
        }
      }),
      this.nativeAudio.addListener('nativeError', (event: NativeAudioErrorEvent) => {
        const pendingStop = this.pendingStop;
        if (pendingStop) {
          globalThis.clearTimeout(pendingStop.timeoutId);
        }
        this.pendingStop = null;

        if (pendingStop) {
          pendingStop.reject(new Error(event.message));
        }

        if (this.activeSequenceRunId === null) {
          return;
        }

        this.activeSequenceRunId = null;
        this.emit({
          type: 'error',
          error: toPlaybackError(event),
        });
      }),
    ]);

    return this.listenerHandlesPromise;
  }
}
