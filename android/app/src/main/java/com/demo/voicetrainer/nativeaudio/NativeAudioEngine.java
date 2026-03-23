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
    private static final int MAX_REPITCH_SEMITONES = 12;
    private static final float MIN_PLAYBACK_RATE = 0.5f;
    private static final float MAX_PLAYBACK_RATE = 2.0f;
    private static final Map<String, Integer> NOTE_TO_RESOURCE = new LinkedHashMap<>();
    private static final Map<String, Integer> NOTE_NAME_TO_SEMITONE = new HashMap<>();

    static {
        NOTE_NAME_TO_SEMITONE.put("C", 0);
        NOTE_NAME_TO_SEMITONE.put("C#", 1);
        NOTE_NAME_TO_SEMITONE.put("D", 2);
        NOTE_NAME_TO_SEMITONE.put("D#", 3);
        NOTE_NAME_TO_SEMITONE.put("E", 4);
        NOTE_NAME_TO_SEMITONE.put("F", 5);
        NOTE_NAME_TO_SEMITONE.put("F#", 6);
        NOTE_NAME_TO_SEMITONE.put("G", 7);
        NOTE_NAME_TO_SEMITONE.put("G#", 8);
        NOTE_NAME_TO_SEMITONE.put("A", 9);
        NOTE_NAME_TO_SEMITONE.put("A#", 10);
        NOTE_NAME_TO_SEMITONE.put("B", 11);

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

    public interface PrepareListener {
        void onPrepared(List<String> loadedNotes, int totalCount);
        void onPrepareError(String code, String message);
    }

    public interface SequenceListener {
        void onStepStart(String note, int stepIndex, int roundIndex);
        void onSequenceComplete();
        void onStopped();
        void onError(String code, String message);
    }

    public static final class SequenceStep {
        private final String note;
        private final int durationMs;
        private final int noteDurationMs;
        private final int stepIndex;
        private final int roundIndex;

        public SequenceStep(String note, int durationMs, int noteDurationMs, int stepIndex, int roundIndex) {
            this.note = note;
            this.durationMs = durationMs;
            this.noteDurationMs = noteDurationMs;
            this.stepIndex = stepIndex;
            this.roundIndex = roundIndex;
        }

        public String getNote() {
            return note;
        }

        public int getDurationMs() {
            return durationMs;
        }

        public int getNoteDurationMs() {
            return noteDurationMs;
        }

        public int getStepIndex() {
            return stepIndex;
        }

        public int getRoundIndex() {
            return roundIndex;
        }
    }

    private static final class ResolvedSample {
        private final String requestedNote;
        private final String sourceNote;
        private final int soundId;
        private final int semitoneOffset;
        private final float playbackRate;

        private ResolvedSample(
            String requestedNote,
            String sourceNote,
            int soundId,
            int semitoneOffset,
            float playbackRate
        ) {
            this.requestedNote = requestedNote;
            this.sourceNote = sourceNote;
            this.soundId = soundId;
            this.semitoneOffset = semitoneOffset;
            this.playbackRate = playbackRate;
        }

        public boolean isDirectMatch() {
            return semitoneOffset == 0;
        }
    }

    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, Integer> noteToSoundId = new LinkedHashMap<>();
    private final Map<Integer, String> sampleIdToNote = new HashMap<>();
    private final List<String> loadedNotes = new ArrayList<>();
    private final List<Integer> activeStreamIds = new ArrayList<>();
    private SoundPool soundPool;
    private Runnable prepareTimeoutTask;
    private Runnable activeSequenceRunnable;
    private PrepareListener activePrepareListener;
    private SequenceListener activeSequenceListener;
    private int pendingLoadCount = 0;
    private int activeSequenceRunId = 0;
    private boolean prepared = false;

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

        final ResolvedSample resolvedSample = resolvePlayableSample(note);
        logResolvedSample(resolvedSample);

        final int streamId = soundPool.play(
            resolvedSample.soundId,
            1f,
            1f,
            1,
            0,
            resolvedSample.playbackRate
        );
        if (streamId == 0) {
            throw new IllegalStateException(
                "Failed to play note " + note + " from sample " + resolvedSample.sourceNote
            );
        }

        activeStreamIds.add(streamId);

        if (durationMs != null && durationMs > 0) {
            mainHandler.postDelayed(() -> stopStreamInternal(streamId), durationMs);
        }
    }

    public synchronized void playSequence(List<SequenceStep> steps, SequenceListener listener) {
        if (!prepared || soundPool == null) {
            throw new IllegalStateException("Native samples are not prepared");
        }

        if (steps.isEmpty()) {
            throw new IllegalArgumentException("playSequence requires at least one step");
        }

        cancelActiveSequence(false);

        activeSequenceRunId += 1;
        final int runId = activeSequenceRunId;
        activeSequenceListener = listener;
        activeSequenceRunnable = () -> executeSequenceStep(runId, steps, 0);
        mainHandler.post(activeSequenceRunnable);
    }

    public synchronized void stopSequence() {
        cancelActiveSequence(true);
    }

    public synchronized void stopAll() {
        cancelActiveSequence(false);
        stopAllStreamsInternal();
    }

    public synchronized void release() {
        clearPrepareTimeout();
        cancelActiveSequence(false);
        activePrepareListener = null;
        prepared = false;
        noteToSoundId.clear();
        sampleIdToNote.clear();
        loadedNotes.clear();
        activeStreamIds.clear();
        releaseSoundPool();
    }

    private void executeSequenceStep(int runId, List<SequenceStep> steps, int index) {
        final SequenceStep step;
        final SequenceListener listener;

        synchronized (this) {
            if (!isSequenceRunActive(runId)) {
                return;
            }

            if (index >= steps.size()) {
                completeSequence(runId);
                return;
            }

            step = steps.get(index);
            listener = activeSequenceListener;
        }

        try {
            playNote(step.getNote(), step.getNoteDurationMs());
            if (listener != null) {
                listener.onStepStart(step.getNote(), step.getStepIndex(), step.getRoundIndex());
            }
        } catch (IllegalArgumentException | IllegalStateException error) {
            failSequence(runId, "step_failed", error.getMessage());
            return;
        }

        final Runnable nextStepRunnable = index >= steps.size() - 1
            ? () -> completeSequence(runId)
            : () -> executeSequenceStep(runId, steps, index + 1);
        synchronized (this) {
            if (!isSequenceRunActive(runId)) {
                return;
            }

            activeSequenceRunnable = nextStepRunnable;
            mainHandler.postDelayed(nextStepRunnable, Math.max(step.getDurationMs(), 0));
        }
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

    private synchronized void completeSequence(int runId) {
        if (!isSequenceRunActive(runId)) {
            return;
        }

        final SequenceListener listener = activeSequenceListener;
        activeSequenceListener = null;
        clearActiveSequenceRunnable();
        if (listener != null) {
            listener.onSequenceComplete();
        }
    }

    private synchronized void failSequence(int runId, String code, String message) {
        if (!isSequenceRunActive(runId)) {
            return;
        }

        final SequenceListener listener = activeSequenceListener;
        activeSequenceListener = null;
        clearActiveSequenceRunnable();
        stopAllStreamsInternal();
        if (listener != null) {
            listener.onError(code, message);
        }
    }

    private synchronized void cancelActiveSequence(boolean notifyStopped) {
        if (activeSequenceListener == null) {
            return;
        }

        activeSequenceRunId += 1;
        final SequenceListener listener = activeSequenceListener;
        activeSequenceListener = null;
        clearActiveSequenceRunnable();
        stopAllStreamsInternal();
        if (notifyStopped && listener != null) {
            listener.onStopped();
        }
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

    private synchronized boolean isSequenceRunActive(int runId) {
        return activeSequenceListener != null && activeSequenceRunId == runId;
    }

    private synchronized void clearActiveSequenceRunnable() {
        if (activeSequenceRunnable != null) {
            mainHandler.removeCallbacks(activeSequenceRunnable);
            activeSequenceRunnable = null;
        }
    }

    private synchronized void stopStreamInternal(int streamId) {
        if (soundPool == null) {
            return;
        }

        soundPool.stop(streamId);
        activeStreamIds.remove(Integer.valueOf(streamId));
    }

    private synchronized void stopAllStreamsInternal() {
        for (Integer streamId : new ArrayList<>(activeStreamIds)) {
            stopStreamInternal(streamId);
        }
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

    private ResolvedSample resolvePlayableSample(String note) {
        final Integer requestedIndex = parseNoteToChromaticIndex(note);
        if (requestedIndex == null) {
            final String message = "Unsupported native note format: " + note;
            Log.e(TAG, message);
            throw new IllegalArgumentException(message);
        }

        final Integer directSoundId = noteToSoundId.get(note);
        if (directSoundId != null) {
            return new ResolvedSample(note, note, directSoundId, 0, 1f);
        }

        String closestNote = null;
        Integer closestSoundId = null;
        Integer closestIndex = null;
        int smallestDistance = Integer.MAX_VALUE;

        // 先在已准备好的样本里找最近锚点，再用 SoundPool 的 playbackRate 做补音。
        for (Map.Entry<String, Integer> entry : noteToSoundId.entrySet()) {
            final Integer candidateIndex = parseNoteToChromaticIndex(entry.getKey());
            if (candidateIndex == null) {
                continue;
            }

            final int distance = Math.abs(requestedIndex - candidateIndex);
            if (distance >= smallestDistance) {
                continue;
            }

            smallestDistance = distance;
            closestNote = entry.getKey();
            closestSoundId = entry.getValue();
            closestIndex = candidateIndex;
        }

        if (closestNote == null || closestSoundId == null || closestIndex == null) {
            final String message = "No native sample anchor available for note " + note;
            Log.e(TAG, message);
            throw new IllegalArgumentException(message);
        }

        final int semitoneOffset = requestedIndex - closestIndex;
        final float playbackRate = (float) Math.pow(2d, semitoneOffset / 12d);
        if (
            Math.abs(semitoneOffset) > MAX_REPITCH_SEMITONES ||
            playbackRate < MIN_PLAYBACK_RATE ||
            playbackRate > MAX_PLAYBACK_RATE
        ) {
            final String message =
                "No nearby native sample for note " +
                note +
                " within supported repitch range. Closest anchor=" +
                closestNote +
                ", semitones=" +
                semitoneOffset;
            Log.e(TAG, message);
            throw new IllegalArgumentException(message);
        }

        return new ResolvedSample(note, closestNote, closestSoundId, semitoneOffset, playbackRate);
    }

    private void logResolvedSample(ResolvedSample resolvedSample) {
        if (resolvedSample.isDirectMatch()) {
            Log.d(
                TAG,
                "playNote direct target=" + resolvedSample.requestedNote + " sample=" + resolvedSample.sourceNote
            );
            return;
        }

        final String message =
            "playNote repitched target=" +
            resolvedSample.requestedNote +
            " sample=" +
            resolvedSample.sourceNote +
            " semitones=" +
            resolvedSample.semitoneOffset +
            " rate=" +
            resolvedSample.playbackRate;

        if (Math.abs(resolvedSample.semitoneOffset) > 7) {
            Log.w(TAG, message);
            return;
        }

        Log.i(TAG, message);
    }

    private Integer parseNoteToChromaticIndex(String note) {
        if (note == null || note.isBlank() || note.length() < 2) {
            return null;
        }

        final int octaveStart = note.length() - 1;
        final char octaveChar = note.charAt(octaveStart);
        if (!Character.isDigit(octaveChar)) {
            return null;
        }

        final String noteName = note.substring(0, octaveStart);
        final Integer semitone = NOTE_NAME_TO_SEMITONE.get(noteName);
        if (semitone == null) {
            return null;
        }

        return Character.getNumericValue(octaveChar) * 12 + semitone;
    }
}
