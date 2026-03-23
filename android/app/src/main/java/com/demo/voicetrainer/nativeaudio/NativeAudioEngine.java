package com.demo.voicetrainer.nativeaudio;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.demo.voicetrainer.R;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class NativeAudioEngine {
    private static final String TAG = "NativeAudioEngine";
    private static final long PREPARE_TIMEOUT_MS = 10000L;
    private static final Map<String, Integer> NOTE_TO_RESOURCE = new LinkedHashMap<>();

    static {
        NOTE_TO_RESOURCE.put("A2", R.raw.a54);
        NOTE_TO_RESOURCE.put("A#2", R.raw.b54);
        NOTE_TO_RESOURCE.put("A3", R.raw.a69);
        NOTE_TO_RESOURCE.put("A4", R.raw.a80);
        NOTE_TO_RESOURCE.put("A5", R.raw.a74);
        NOTE_TO_RESOURCE.put("A6", R.raw.a66);
        NOTE_TO_RESOURCE.put("A#3", R.raw.b69);
        NOTE_TO_RESOURCE.put("A#4", R.raw.b80);
        NOTE_TO_RESOURCE.put("A#5", R.raw.b74);
        NOTE_TO_RESOURCE.put("A#6", R.raw.b66);
        NOTE_TO_RESOURCE.put("B2", R.raw.a55);
        NOTE_TO_RESOURCE.put("B3", R.raw.a82);
        NOTE_TO_RESOURCE.put("B4", R.raw.a65);
        NOTE_TO_RESOURCE.put("B5", R.raw.a75);
        NOTE_TO_RESOURCE.put("B6", R.raw.a78);
        NOTE_TO_RESOURCE.put("C2", R.raw.a49);
        NOTE_TO_RESOURCE.put("C3", R.raw.a56);
        NOTE_TO_RESOURCE.put("C4", R.raw.a84);
        NOTE_TO_RESOURCE.put("C5", R.raw.a83);
        NOTE_TO_RESOURCE.put("C6", R.raw.a76);
        NOTE_TO_RESOURCE.put("C7", R.raw.a77);
        NOTE_TO_RESOURCE.put("C#2", R.raw.b49);
        NOTE_TO_RESOURCE.put("C#3", R.raw.b56);
        NOTE_TO_RESOURCE.put("C#4", R.raw.b84);
        NOTE_TO_RESOURCE.put("C#5", R.raw.b83);
        NOTE_TO_RESOURCE.put("C#6", R.raw.b76);
        NOTE_TO_RESOURCE.put("D2", R.raw.a50);
        NOTE_TO_RESOURCE.put("D3", R.raw.a57);
        NOTE_TO_RESOURCE.put("D4", R.raw.a89);
        NOTE_TO_RESOURCE.put("D5", R.raw.a68);
        NOTE_TO_RESOURCE.put("D6", R.raw.a90);
        NOTE_TO_RESOURCE.put("D#2", R.raw.b50);
        NOTE_TO_RESOURCE.put("D#3", R.raw.b57);
        NOTE_TO_RESOURCE.put("D#4", R.raw.b89);
        NOTE_TO_RESOURCE.put("D#5", R.raw.b68);
        NOTE_TO_RESOURCE.put("D#6", R.raw.b90);
        NOTE_TO_RESOURCE.put("E2", R.raw.a51);
        NOTE_TO_RESOURCE.put("E3", R.raw.a48);
        NOTE_TO_RESOURCE.put("E4", R.raw.a85);
        NOTE_TO_RESOURCE.put("E5", R.raw.a70);
        NOTE_TO_RESOURCE.put("E6", R.raw.a88);
        NOTE_TO_RESOURCE.put("F2", R.raw.a52);
        NOTE_TO_RESOURCE.put("F3", R.raw.a81);
        NOTE_TO_RESOURCE.put("F4", R.raw.a73);
        NOTE_TO_RESOURCE.put("F5", R.raw.a71);
        NOTE_TO_RESOURCE.put("F6", R.raw.a67);
        NOTE_TO_RESOURCE.put("F#2", R.raw.b52);
        NOTE_TO_RESOURCE.put("F#3", R.raw.b81);
        NOTE_TO_RESOURCE.put("F#4", R.raw.b73);
        NOTE_TO_RESOURCE.put("F#5", R.raw.b71);
        NOTE_TO_RESOURCE.put("F#6", R.raw.b67);
        NOTE_TO_RESOURCE.put("G2", R.raw.a53);
        NOTE_TO_RESOURCE.put("G3", R.raw.a87);
        NOTE_TO_RESOURCE.put("G4", R.raw.a79);
        NOTE_TO_RESOURCE.put("G5", R.raw.a72);
        NOTE_TO_RESOURCE.put("G6", R.raw.a86);
        NOTE_TO_RESOURCE.put("G#2", R.raw.b53);
        NOTE_TO_RESOURCE.put("G#3", R.raw.b87);
        NOTE_TO_RESOURCE.put("G#4", R.raw.b79);
        NOTE_TO_RESOURCE.put("G#5", R.raw.b72);
        NOTE_TO_RESOURCE.put("G#6", R.raw.b86);
    }

    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, Integer> noteToSoundId = new LinkedHashMap<>();
    private final Map<Integer, String> sampleIdToNote = new HashMap<>();
    private final List<String> loadedNotes = new ArrayList<>();
    private final List<Integer> activeStreamIds = new ArrayList<>();
    private SoundPool soundPool;
    private Runnable prepareTimeoutTask;
    private PrepareListener activePrepareListener;
    private int pendingLoadCount = 0;
    private boolean prepared = false;

    public interface PrepareListener {
        void onPrepared(List<String> loadedNotes, int totalCount);
        void onPrepareError(String code, String message);
    }

    public NativeAudioEngine(Context context) {
        this.context = context.getApplicationContext();
    }

    public synchronized void prepareSamples(PrepareListener listener) {
        if (prepared && loadedNotes.size() == NOTE_TO_RESOURCE.size()) {
            listener.onPrepared(new ArrayList<>(loadedNotes), NOTE_TO_RESOURCE.size());
            return;
        }

        releaseSoundPool();
        activePrepareListener = listener;
        noteToSoundId.clear();
        sampleIdToNote.clear();
        loadedNotes.clear();
        activeStreamIds.clear();
        pendingLoadCount = NOTE_TO_RESOURCE.size();
        prepared = false;

        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        soundPool = new SoundPool.Builder()
            .setAudioAttributes(attributes)
            .setMaxStreams(8)
            .build();

        soundPool.setOnLoadCompleteListener((pool, sampleId, status) -> handleLoadComplete(sampleId, status));

        for (Map.Entry<String, Integer> entry : NOTE_TO_RESOURCE.entrySet()) {
            final String note = entry.getKey();
            final int sampleId = soundPool.load(context, entry.getValue(), 1);
            if (sampleId == 0) {
                notifyPrepareError("load_failed", "Failed to queue note " + note);
                return;
            }

            noteToSoundId.put(note, sampleId);
            sampleIdToNote.put(sampleId, note);
            Log.d(TAG, "Queued sample load for " + note + " sampleId=" + sampleId);
        }

        // 全量样本首次加载可能需要几秒，超时后直接给前端明确失败原因。
        prepareTimeoutTask = () -> notifyPrepareError(
            "prepare_timeout",
            "Timed out while loading native samples. Loaded " + loadedNotes.size() + "/" + NOTE_TO_RESOURCE.size()
        );
        mainHandler.postDelayed(prepareTimeoutTask, PREPARE_TIMEOUT_MS);
    }

    public synchronized void playNote(String note, Integer durationMs) {
        if (!prepared || soundPool == null) {
            throw new IllegalStateException("Native samples are not prepared");
        }

        final Integer soundId = noteToSoundId.get(note);
        if (soundId == null) {
            throw new IllegalArgumentException("Unsupported native note: " + note);
        }

        final int streamId = soundPool.play(soundId, 1f, 1f, 1, 0, 1f);
        if (streamId == 0) {
            throw new IllegalStateException("Failed to play note " + note);
        }

        activeStreamIds.add(streamId);

        if (durationMs != null && durationMs > 0) {
            mainHandler.postDelayed(() -> stopStreamInternal(streamId), durationMs);
        }
    }

    public synchronized void stopAll() {
        for (Integer streamId : new ArrayList<>(activeStreamIds)) {
            stopStreamInternal(streamId);
        }
    }

    public synchronized void release() {
        clearPrepareTimeout();
        activePrepareListener = null;
        prepared = false;
        noteToSoundId.clear();
        sampleIdToNote.clear();
        loadedNotes.clear();
        activeStreamIds.clear();
        releaseSoundPool();
    }

    private synchronized void handleLoadComplete(int sampleId, int status) {
        if (activePrepareListener == null) {
            return;
        }

        if (status != 0) {
            notifyPrepareError("load_failed", "SoundPool failed to load sampleId=" + sampleId + " status=" + status);
            return;
        }

        final String note = sampleIdToNote.get(sampleId);
        if (note != null && !loadedNotes.contains(note)) {
            loadedNotes.add(note);
        }

        pendingLoadCount -= 1;
        Log.d(TAG, "Loaded sampleId=" + sampleId + ", remaining=" + pendingLoadCount + ", loaded=" + loadedNotes.size());
        if (pendingLoadCount > 0) {
            return;
        }

        prepared = true;
        clearPrepareTimeout();
        final PrepareListener listener = activePrepareListener;
        activePrepareListener = null;
        listener.onPrepared(new ArrayList<>(loadedNotes), NOTE_TO_RESOURCE.size());
    }

    private synchronized void notifyPrepareError(String code, String message) {
        Log.e(TAG, code + ": " + message);
        clearPrepareTimeout();
        final PrepareListener listener = activePrepareListener;
        activePrepareListener = null;
        prepared = false;
        if (listener != null) {
            listener.onPrepareError(code, message);
        }
    }

    private synchronized void stopStreamInternal(int streamId) {
        if (soundPool == null) {
            return;
        }

        soundPool.stop(streamId);
        activeStreamIds.remove(Integer.valueOf(streamId));
    }

    private synchronized void releaseSoundPool() {
        if (soundPool != null) {
            soundPool.release();
            soundPool = null;
        }
    }

    private synchronized void clearPrepareTimeout() {
        if (prepareTimeoutTask != null) {
            mainHandler.removeCallbacks(prepareTimeoutTask);
            prepareTimeoutTask = null;
        }
    }
}
