import { describe, expect, it } from 'vitest';
import { getExerciseById } from '../config/voiceTrainerExercises.ts';
import { getStepNoteDurationMs } from '../utils/voiceTrainerPlaybackUtils.ts';
import {
  buildExercisePlaybackSequence,
  ExerciseSequencePlannerError,
} from './exerciseSequencePlanner.ts';
import type { PlaybackSequence } from './playerAdapter.ts';

function getRequiredExercise(id: string) {
  const exercise = getExerciseById(id);

  if (!exercise) {
    throw new Error(`未找到练习配置: ${id}`);
  }

  return exercise;
}

function getPlannerError(execute: () => unknown): ExerciseSequencePlannerError {
  try {
    execute();
  } catch (error) {
    if (error instanceof ExerciseSequencePlannerError) {
      return error;
    }

    throw error;
  }

  throw new Error('预期应抛出 ExerciseSequencePlannerError，但没有抛错。');
}

function getRoundLeadNotes(sequence: PlaybackSequence): string[] {
  return sequence.steps.filter((step) => step.stepIndex === 0).map((step) => step.note);
}

describe('buildExercisePlaybackSequence', () => {
  it('在起始音无法解析时抛出 invalid-start-note', () => {
    const error = getPlannerError(() =>
      buildExercisePlaybackSequence({
        exercise: getRequiredExercise('scale-6'),
        startNote: 'H2',
        playMode: 'once',
        bpm: 90,
        lowerBoundNote: 'C3',
        upperBoundNote: 'C5',
      }),
    );

    expect(error.code).toBe('invalid-start-note');
  });

  it('在起始音超出练习可播放范围时抛出 start-note-out-of-range', () => {
    const error = getPlannerError(() =>
      buildExercisePlaybackSequence({
        exercise: getRequiredExercise('scale-2'),
        startNote: 'C8',
        playMode: 'once',
        bpm: 90,
        lowerBoundNote: 'C3',
        upperBoundNote: 'C5',
      }),
    );

    expect(error.code).toBe('start-note-out-of-range');
  });

  it('在往返模式边界起始音无法完整执行练习时抛出 round-trip-out-of-range', () => {
    const error = getPlannerError(() =>
      buildExercisePlaybackSequence({
        exercise: getRequiredExercise('scale-2'),
        startNote: 'C7',
        playMode: 'up',
        bpm: 90,
        lowerBoundNote: 'C7',
        upperBoundNote: 'C8',
      }),
    );

    expect(error.code).toBe('round-trip-out-of-range');
  });

  it('在 once 模式下生成单轮纯数据序列', () => {
    const sequence = buildExercisePlaybackSequence({
      exercise: getRequiredExercise('scale-6'),
      startNote: 'C4',
      playMode: 'once',
      bpm: 120,
      lowerBoundNote: 'C3',
      upperBoundNote: 'C5',
    });

    expect(sequence.playMode).toBe('once');
    expect(sequence.startNote).toBe('C4');
    expect(sequence.steps).toHaveLength(5);
    expect(sequence.steps.map((step) => step.note)).toEqual(['C4', 'D4', 'E4', 'D4', 'C4']);
    expect(sequence.steps.map((step) => step.durationMs)).toEqual([500, 500, 500, 500, 1000]);
    expect(sequence.steps.map((step) => step.noteDurationMs)).toEqual([
      getStepNoteDurationMs(500),
      getStepNoteDurationMs(500),
      getStepNoteDurationMs(500),
      getStepNoteDurationMs(500),
      getStepNoteDurationMs(1000),
    ]);
    expect(sequence.steps.map((step) => step.roundIndex)).toEqual([0, 0, 0, 0, 0]);
    expect(sequence.steps.map((step) => step.stepIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('在 up 模式下生成上行到顶再折返的轮次序列', () => {
    const sequence = buildExercisePlaybackSequence({
      exercise: getRequiredExercise('scale-6'),
      startNote: 'C4',
      playMode: 'up',
      bpm: 120,
      lowerBoundNote: 'C4',
      upperBoundNote: 'G4',
    });

    expect(getRoundLeadNotes(sequence)).toEqual([
      'C4',
      'C#4',
      'D4',
      'D#4',
      'E4',
      'F4',
      'F#4',
      'G4',
      'F#4',
      'F4',
      'E4',
      'D#4',
      'D4',
      'C#4',
      'C4',
    ]);
    expect(sequence.steps).toHaveLength(75);
    expect(sequence.steps.filter((step) => step.stepIndex === 4).map((step) => step.durationMs)).toEqual([
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1625,
      1000,
    ]);
  });

  it('在 once 模式下也要求起始音落在设定范围内', () => {
    const error = getPlannerError(() =>
      buildExercisePlaybackSequence({
        exercise: getRequiredExercise('scale-6'),
        startNote: 'B2',
        playMode: 'once',
        bpm: 90,
        lowerBoundNote: 'C3',
        upperBoundNote: 'C5',
      }),
    );

    expect(error.code).toBe('start-note-out-of-range');
  });

  it('在 down 模式下生成下行到底再折返的轮次序列', () => {
    const sequence = buildExercisePlaybackSequence({
      exercise: getRequiredExercise('scale-6'),
      startNote: 'E4',
      playMode: 'down',
      bpm: 120,
      lowerBoundNote: 'C4',
      upperBoundNote: 'G4',
    });

    expect(getRoundLeadNotes(sequence)).toEqual(['E4', 'D#4', 'D4', 'C#4', 'C4', 'C#4', 'D4', 'D#4', 'E4']);
    expect(sequence.steps).toHaveLength(45);
  });

  it('在不同 bpm 下按比例缩放 step duration 和 note duration', () => {
    const slowSequence = buildExercisePlaybackSequence({
      exercise: getRequiredExercise('scale-6'),
      startNote: 'C4',
      playMode: 'once',
      bpm: 60,
      lowerBoundNote: 'C3',
      upperBoundNote: 'C5',
    });
    const fastSequence = buildExercisePlaybackSequence({
      exercise: getRequiredExercise('scale-6'),
      startNote: 'C4',
      playMode: 'once',
      bpm: 120,
      lowerBoundNote: 'C3',
      upperBoundNote: 'C5',
    });

    expect(slowSequence.steps[0]?.durationMs).toBe(1000);
    expect(fastSequence.steps[0]?.durationMs).toBe(500);
    expect(slowSequence.steps[0]?.noteDurationMs).toBe(getStepNoteDurationMs(1000));
    expect(fastSequence.steps[0]?.noteDurationMs).toBe(getStepNoteDurationMs(500));
  });
});
