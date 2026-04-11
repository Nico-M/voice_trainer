import { afterEach, describe, expect, it, vi } from 'vitest';
import NativePlayerAdapter from './nativePlayerAdapter.ts';
import type { PlaybackEvent, PlaybackSequence } from './playerAdapter.ts';
import type {
  NativeAudioErrorEvent,
  NativeAudioPlugin,
  NativeStepStartEvent,
  PrepareSamplesResult,
} from '../native/nativeAudioPlugin.ts';

type NativeEventName = 'stepStart' | 'sequenceComplete' | 'stopped' | 'nativeError';

interface MockNativeAudioCalls {
  playNote: Array<{ note: string; durationMs?: number }>;
  playSequence: PlaybackSequence[];
  prepareSamples: number;
  stopAll: number;
  stopSequence: number;
}

interface MockNativeAudioPluginController {
  calls: MockNativeAudioCalls;
  emitNativeError(event: NativeAudioErrorEvent): void;
  emitSequenceComplete(): void;
  emitStepStart(event: NativeStepStartEvent): void;
  emitStopped(): void;
  plugin: NativeAudioPlugin;
}

function createSequence(): PlaybackSequence {
  return {
    bpm: 120,
    startNote: 'C4',
    playMode: 'once',
    steps: [
      { note: 'C4', durationMs: 500, noteDurationMs: 485, stepIndex: 0, roundIndex: 0 },
      { note: 'E4', durationMs: 500, noteDurationMs: 485, stepIndex: 1, roundIndex: 0 },
    ],
  };
}

function createMockNativeAudioPlugin(): MockNativeAudioPluginController {
  const calls: MockNativeAudioCalls = {
    playNote: [],
    playSequence: [],
    prepareSamples: 0,
    stopAll: 0,
    stopSequence: 0,
  };

  const listeners: Partial<Record<NativeEventName, ((event?: unknown) => void)>> = {};

  const plugin: NativeAudioPlugin = {
    async prepareSamples(): Promise<PrepareSamplesResult> {
      calls.prepareSamples += 1;
      return {
        loadedNotes: ['C4', 'E4', 'G4'],
        loadedCount: 3,
        totalCount: 3,
      };
    },
    async playNote(options): Promise<void> {
      calls.playNote.push(options);
    },
    async playSequence(sequence): Promise<void> {
      calls.playSequence.push(sequence);
    },
    async stopSequence(): Promise<void> {
      calls.stopSequence += 1;
    },
    async stopAll(): Promise<void> {
      calls.stopAll += 1;
    },
    async addListener(eventName, listenerFunc) {
      if (
        eventName === 'stepStart' ||
        eventName === 'sequenceComplete' ||
        eventName === 'stopped' ||
        eventName === 'nativeError'
      ) {
        listeners[eventName] = listenerFunc as (event?: unknown) => void;
      }

      return {
        async remove(): Promise<void> {
          if (
            eventName === 'stepStart' ||
            eventName === 'sequenceComplete' ||
            eventName === 'stopped' ||
            eventName === 'nativeError'
          ) {
            delete listeners[eventName];
          }
        },
      };
    },
  };

  return {
    calls,
    emitNativeError(event) {
      listeners.nativeError?.(event);
    },
    emitSequenceComplete() {
      listeners.sequenceComplete?.();
    },
    emitStepStart(event) {
      listeners.stepStart?.(event);
    },
    emitStopped() {
      listeners.stopped?.();
    },
    plugin,
  };
}

describe('NativePlayerAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('在 playSequence 后依赖原生 stepStart 和 sequenceComplete 事件驱动 UI', async () => {
    const nativeAudio = createMockNativeAudioPlugin();
    const adapter = new NativePlayerAdapter({ nativeAudio: nativeAudio.plugin });
    const events: PlaybackEvent[] = [];

    adapter.subscribe((event) => {
      events.push(event);
    });

    await adapter.prepare();
    await adapter.playSequence(createSequence());
    nativeAudio.emitStepStart({ note: 'C4', stepIndex: 0, roundIndex: 0 });
    nativeAudio.emitSequenceComplete();

    expect(nativeAudio.calls.prepareSamples).toBe(1);
    expect(nativeAudio.calls.playSequence).toHaveLength(1);
    expect(events).toEqual([
      { type: 'noteStart', note: 'C4', stepIndex: 0, roundIndex: 0 },
      { type: 'sequenceComplete' },
    ]);
  });

  it('在 stop 时等待原生 stopped 事件后再 resolve', async () => {
    const nativeAudio = createMockNativeAudioPlugin();
    const adapter = new NativePlayerAdapter({ nativeAudio: nativeAudio.plugin });
    const events: PlaybackEvent[] = [];

    adapter.subscribe((event) => {
      events.push(event);
    });

    await adapter.prepare();
    await adapter.playSequence(createSequence());
    const stopPromise = adapter.stop();
    expect(nativeAudio.calls.stopSequence).toBe(1);

    let stoppedResolved = false;
    void stopPromise.then(() => {
      stoppedResolved = true;
    });
    await Promise.resolve();
    expect(stoppedResolved).toBe(false);

    nativeAudio.emitStopped();
    await stopPromise;

    expect(stoppedResolved).toBe(true);
    expect(events[events.length - 1]).toEqual({ type: 'stopped' });
  });

  it('在手动试音时先停掉 sequence 再调用原生 playNote', async () => {
    const nativeAudio = createMockNativeAudioPlugin();
    const adapter = new NativePlayerAdapter({ nativeAudio: nativeAudio.plugin });

    await adapter.prepare();
    await adapter.playSequence(createSequence());
    const startTask = adapter.startNote('G4');
    await Promise.resolve();
    expect(nativeAudio.calls.stopSequence).toBe(1);
    expect(nativeAudio.calls.playNote).toEqual([]);

    nativeAudio.emitStopped();
    await startTask;

    expect(nativeAudio.calls.playNote).toEqual([{ note: 'G4' }]);
  });

  it('在原生 stopped 事件丢失时用超时兜底解开 stop', async () => {
    vi.useFakeTimers();

    const nativeAudio = createMockNativeAudioPlugin();
    const adapter = new NativePlayerAdapter({ nativeAudio: nativeAudio.plugin });
    const events: PlaybackEvent[] = [];

    adapter.subscribe((event) => {
      events.push(event);
    });

    await adapter.prepare();
    await adapter.playSequence(createSequence());

    const stopPromise = adapter.stop();
    expect(nativeAudio.calls.stopSequence).toBe(1);

    await vi.advanceTimersByTimeAsync(3000);
    await stopPromise;

    expect(nativeAudio.calls.stopAll).toBe(1);
    expect(events[events.length - 1]).toEqual({ type: 'stopped' });
  });
});
