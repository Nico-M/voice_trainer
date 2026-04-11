import { describe, expect, it, vi } from 'vitest';
import TonePlayerAdapter from './tonePlayerAdapter.ts';
import type { PlaybackEvent, PlaybackSequence } from './playerAdapter.ts';

interface MockSamplerCallLog {
  attackRelease: Array<{ note: string; durationSeconds: number }>;
  attack: string[];
  release: string[];
  releaseAllCount: number;
  disposeCount: number;
}

function createMockSampler() {
  const calls: MockSamplerCallLog = {
    attackRelease: [],
    attack: [],
    release: [],
    releaseAllCount: 0,
    disposeCount: 0,
  };

  return {
    sampler: {
      loaded: true,
      async startAudioContext(): Promise<void> {
        return Promise.resolve();
      },
      async ready(): Promise<void> {
        return Promise.resolve();
      },
      async triggerAttackRelease(note: string, durationSeconds: number): Promise<void> {
        calls.attackRelease.push({ note, durationSeconds });
      },
      async triggerAttack(note: string): Promise<void> {
        calls.attack.push(note);
      },
      async triggerRelease(note: string): Promise<void> {
        calls.release.push(note);
      },
      async releaseAll(): Promise<void> {
        calls.releaseAllCount += 1;
      },
      dispose(): void {
        calls.disposeCount += 1;
      },
    },
    calls,
  };
}

function createSequence(): PlaybackSequence {
  return {
    bpm: 120,
    startNote: 'C4',
    playMode: 'once',
    steps: [
      { note: 'C4', durationMs: 500, noteDurationMs: 485, stepIndex: 0, roundIndex: 0 },
      { note: 'D4', durationMs: 500, noteDurationMs: 485, stepIndex: 1, roundIndex: 0 },
    ],
  };
}

describe('TonePlayerAdapter', () => {
  it('在 playSequence 时按 step 发出 noteStart 和 sequenceComplete', async () => {
    const { sampler, calls } = createMockSampler();
    const waitMs = vi.fn(async () => Promise.resolve());
    const events: PlaybackEvent[] = [];
    let resolveComplete!: () => void;
    const sequenceComplete = new Promise<void>((resolve) => {
      resolveComplete = resolve;
    });
    const adapter = new TonePlayerAdapter({ sampler, waitMs });

    adapter.subscribe((event) => {
      events.push(event);
      if (event.type === 'sequenceComplete') {
        resolveComplete();
      }
    });

    await adapter.playSequence(createSequence());
    await sequenceComplete;

    expect(waitMs).toHaveBeenCalledTimes(2);
    expect(calls.attackRelease).toEqual([
      { note: 'C4', durationSeconds: 0.485 },
      { note: 'D4', durationSeconds: 0.485 },
    ]);
    expect(events).toEqual([
      { type: 'noteStart', note: 'C4', stepIndex: 0, roundIndex: 0 },
      { type: 'noteStart', note: 'D4', stepIndex: 1, roundIndex: 0 },
      { type: 'sequenceComplete' },
    ]);
  });

  it('在自动播放中触发 startNote 时先中断 sequence 再执行手动试音', async () => {
    const { sampler, calls } = createMockSampler();
    let resolveWait: (() => void) | undefined;
    const waitMs = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWait = resolve;
        }),
    );
    const events: PlaybackEvent[] = [];
    const adapter = new TonePlayerAdapter({ sampler, waitMs });

    adapter.subscribe((event) => {
      events.push(event);
    });

    await adapter.playSequence(createSequence());
    while (waitMs.mock.calls.length === 0) {
      await Promise.resolve();
    }
    await adapter.startNote('E4');
    const releaseWait = resolveWait;
    if (releaseWait !== undefined) {
      releaseWait();
    }
    await Promise.resolve();

    expect(calls.releaseAllCount).toBe(1);
    expect(calls.attack).toEqual(['E4']);
    expect(events.some((event) => event.type === 'stopped')).toBe(true);
  });

  it('允许手动试音通过 stopNote 释放音符', async () => {
    const { sampler, calls } = createMockSampler();
    const adapter = new TonePlayerAdapter({ sampler });

    await adapter.startNote('G4');
    await adapter.stopNote('G4');

    expect(calls.attack).toEqual(['G4']);
    expect(calls.release).toEqual(['G4']);
  });
});
