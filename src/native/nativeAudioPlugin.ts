import { registerPlugin } from "@capacitor/core";
import type { PlaybackSequence } from "../audio/playerAdapter.ts";

export interface PrepareSamplesResult {
  loadedNotes: string[];
  loadedCount: number;
  totalCount: number;
}

export interface PlayNoteOptions {
  note: string;
  durationMs?: number;
}

export interface NativeAudioNoteEvent {
  note: string;
}

export interface NativeStepStartEvent {
  note: string;
  stepIndex: number;
  roundIndex: number;
}

export interface NativeAudioErrorEvent {
  code: string;
  message: string;
}

export interface NativeAudioPlugin {
  prepareSamples(): Promise<PrepareSamplesResult>;
  playNote(options: PlayNoteOptions): Promise<void>;
  playSequence(sequence: PlaybackSequence): Promise<void>;
  stopSequence(): Promise<void>;
  stopAll(): Promise<void>;
  addListener(
    eventName: "noteStarted",
    listenerFunc: (event: NativeAudioNoteEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "stepStart",
    listenerFunc: (event: NativeStepStartEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "sequenceComplete",
    listenerFunc: () => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "stopped",
    listenerFunc: () => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "prepareDone",
    listenerFunc: (event: PrepareSamplesResult) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "nativeError",
    listenerFunc: (event: NativeAudioErrorEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const NativeAudio = registerPlugin<NativeAudioPlugin>("NativeAudio");
