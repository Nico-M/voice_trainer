package com.demo.voicetrainer.nativeaudio;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativeAudio")
public class NativeAudioPlugin extends Plugin {
    private static final String TAG = "NativeAudioPlugin";
    private NativeAudioEngine engine;

    @Override
    public void load() {
        super.load();
        engine = new NativeAudioEngine(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (engine != null) {
            engine.release();
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void prepareSamples(PluginCall call) {
        Log.d(TAG, "prepareSamples()");

        engine.prepareSamples(new NativeAudioEngine.PrepareListener() {
            @Override
            public void onPrepared(List<String> loadedNotes, int totalCount) {
                final JSObject payload = new JSObject();
                payload.put("loadedNotes", new JSArray(loadedNotes));
                payload.put("loadedCount", loadedNotes.size());
                payload.put("totalCount", totalCount);
                notifyListeners("prepareDone", payload);
                call.resolve(payload);
            }

            @Override
            public void onPrepareError(String code, String message) {
                emitNativeError(code, message);
                call.reject(message);
            }
        });
    }

    @PluginMethod
    public void playNote(PluginCall call) {
        final String note = call.getString("note");
        final Integer durationMs = call.getInt("durationMs");
        Log.d(TAG, "playNote(note=" + note + ", durationMs=" + durationMs + ")");

        if (note == null || note.isBlank()) {
            emitNativeError("invalid_note", "playNote requires a note");
            call.reject("playNote requires a note");
            return;
        }

        try {
            engine.playNote(note, durationMs);
            final JSObject payload = new JSObject();
            payload.put("note", note);
            notifyListeners("noteStarted", payload);
            call.resolve();
        } catch (IllegalArgumentException | IllegalStateException error) {
            emitNativeError("play_failed", error.getMessage());
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void playSequence(PluginCall call) {
        final JSArray rawSteps = call.getArray("steps");
        Log.d(TAG, "playSequence(stepCount=" + (rawSteps == null ? 0 : rawSteps.length()) + ")");

        if (rawSteps == null || rawSteps.length() == 0) {
            emitNativeError("invalid_sequence", "playSequence requires non-empty steps");
            call.reject("playSequence requires non-empty steps");
            return;
        }

        try {
            final List<NativeAudioEngine.SequenceStep> steps = parseSequenceSteps(rawSteps);
            engine.playSequence(steps, new NativeAudioEngine.SequenceListener() {
                @Override
                public void onStepStart(String note, int stepIndex, int roundIndex) {
                    final JSObject payload = new JSObject();
                    payload.put("note", note);
                    payload.put("stepIndex", stepIndex);
                    payload.put("roundIndex", roundIndex);
                    notifyListeners("stepStart", payload);
                }

                @Override
                public void onSequenceComplete() {
                    notifyListeners("sequenceComplete", new JSObject());
                }

                @Override
                public void onStopped() {
                    notifyListeners("stopped", new JSObject());
                }

                @Override
                public void onError(String code, String message) {
                    emitNativeError(code, message);
                }
            });
            call.resolve();
        } catch (IllegalArgumentException | IllegalStateException error) {
            emitNativeError("sequence_failed", error.getMessage());
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void stopSequence(PluginCall call) {
        Log.d(TAG, "stopSequence()");

        try {
            engine.stopSequence();
            call.resolve();
        } catch (IllegalStateException error) {
            emitNativeError("stop_sequence_failed", error.getMessage());
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void stopAll(PluginCall call) {
        Log.d(TAG, "stopAll()");

        try {
            engine.stopAll();
            call.resolve();
        } catch (IllegalStateException error) {
            emitNativeError("stop_failed", error.getMessage());
            call.reject(error.getMessage());
        }
    }

    private List<NativeAudioEngine.SequenceStep> parseSequenceSteps(JSArray rawSteps) {
        final List<NativeAudioEngine.SequenceStep> steps = new ArrayList<>();

        for (int index = 0; index < rawSteps.length(); index += 1) {
            try {
                final JSONObject rawStep = rawSteps.getJSONObject(index);
                final String note = rawStep.getString("note");
                final int durationMs = rawStep.getInt("durationMs");
                final int noteDurationMs = rawStep.getInt("noteDurationMs");
                final int stepIndex = rawStep.getInt("stepIndex");
                final int roundIndex = rawStep.getInt("roundIndex");

                if (note.isBlank()) {
                    throw new IllegalArgumentException("Sequence step note cannot be blank");
                }

                steps.add(new NativeAudioEngine.SequenceStep(note, durationMs, noteDurationMs, stepIndex, roundIndex));
            } catch (JSONException error) {
                throw new IllegalArgumentException("Invalid sequence step at index " + index, error);
            }
        }

        return steps;
    }

    private void emitNativeError(String code, String message) {
        final JSObject payload = new JSObject();
        payload.put("code", code);
        payload.put("message", message);
        notifyListeners("nativeError", payload);
    }
}
