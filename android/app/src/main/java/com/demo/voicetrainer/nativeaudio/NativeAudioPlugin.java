package com.demo.voicetrainer.nativeaudio;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

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

    private void emitNativeError(String code, String message) {
        final JSObject payload = new JSObject();
        payload.put("code", code);
        payload.put("message", message);
        notifyListeners("nativeError", payload);
    }
}
