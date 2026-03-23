import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Capacitor } from "@capacitor/core";
import noteMapping from "../config/noteMapping.ts";
import {
  NativeAudio,
  type NativeAudioErrorEvent,
  type NativeAudioNoteEvent,
  type PrepareSamplesResult,
} from "../native/nativeAudioPlugin.ts";

const DEBUG_NOTE_OPTIONS = Object.keys(noteMapping);
const DEFAULT_DEBUG_NOTE = DEBUG_NOTE_OPTIONS.includes("C4") ? "C4" : DEBUG_NOTE_OPTIONS[0];
const MAX_LOG_LINES = 12;

function formatLogLine(label: string, detail: string): string {
  return `${new Date().toLocaleTimeString()} ${label}: ${detail}`;
}

function normalizeLoadedNotes(loadedNotes: unknown): string[] {
  if (Array.isArray(loadedNotes)) {
    return loadedNotes.filter((note): note is string => typeof note === "string");
  }

  if (typeof loadedNotes === "string") {
    return loadedNotes
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((note) => note.trim())
      .filter(Boolean);
  }

  return [];
}

function appendLog(currentLogs: string[], nextLine: string): string[] {
  return [nextLine, ...currentLogs].slice(0, MAX_LOG_LINES);
}

function describeLoadedNotes(loadedNotes: string[]): string {
  if (loadedNotes.length === 0) {
    return "尚未收到已加载音符";
  }

  if (loadedNotes.length <= 8) {
    return loadedNotes.join(", ");
  }

  return `${loadedNotes.slice(0, 8).join(", ")} ... 共 ${loadedNotes.length} 个`;
}

export default function NativeAudioDebugPanel() {
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [selectedNote, setSelectedNote] = useState(DEFAULT_DEBUG_NOTE);
  const [prepareResult, setPrepareResult] = useState<PrepareSamplesResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const isAndroidNative = useMemo(() => Capacitor.getPlatform() === "android", []);

  useEffect(() => {
    if (!isAndroidNative) {
      return undefined;
    }

    const listenerHandles: Array<Promise<{ remove: () => Promise<void> }>> = [
      NativeAudio.addListener("prepareDone", (event: PrepareSamplesResult) => {
        const loadedNotes = normalizeLoadedNotes(event.loadedNotes);
        const normalizedResult: PrepareSamplesResult = {
          ...event,
          loadedNotes,
        };

        setIsPrepared(true);
        setPrepareResult(normalizedResult);
        setLastError(null);
        setLogs((currentLogs) =>
          appendLog(
            currentLogs,
            formatLogLine("prepareDone", `${event.loadedCount}/${event.totalCount} ${describeLoadedNotes(loadedNotes)}`),
          ),
        );
      }),
      NativeAudio.addListener("noteStarted", (event: NativeAudioNoteEvent) => {
        setLogs((currentLogs) => appendLog(currentLogs, formatLogLine("noteStarted", event.note)));
      }),
      NativeAudio.addListener("nativeError", (event: NativeAudioErrorEvent) => {
        setLastError(event.message);
        setLogs((currentLogs) =>
          appendLog(currentLogs, formatLogLine("nativeError", `${event.code} ${event.message}`)),
        );
      }),
    ];

    return () => {
      void Promise.all(listenerHandles).then((resolvedHandles) =>
        Promise.all(resolvedHandles.map((handle) => handle.remove())),
      );
    };
  }, [isAndroidNative]);

  async function handlePrepare(): Promise<void> {
    setIsPreparing(true);
    setLastError(null);

    try {
      const result = await NativeAudio.prepareSamples();
      const loadedNotes = normalizeLoadedNotes(result.loadedNotes);
      const normalizedResult: PrepareSamplesResult = {
        ...result,
        loadedNotes,
      };

      setIsPrepared(true);
      setPrepareResult(normalizedResult);
      setLogs((currentLogs) =>
        appendLog(
          currentLogs,
          formatLogLine("prepare", `loaded ${result.loadedCount}/${result.totalCount} ${describeLoadedNotes(loadedNotes)}`),
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "prepareSamples failed";
      setIsPrepared(false);
      setPrepareResult(null);
      setLastError(message);
      setLogs((currentLogs) => appendLog(currentLogs, formatLogLine("prepareError", message)));
    } finally {
      setIsPreparing(false);
    }
  }

  function handleSelectedNoteChange(event: SelectChangeEvent<string>): void {
    setSelectedNote(event.target.value);
  }

  async function handlePlayNote(note: string): Promise<void> {
    setLastError(null);

    try {
      await NativeAudio.playNote({ note });
      setLogs((currentLogs) => appendLog(currentLogs, formatLogLine("playNote", note)));
    } catch (error) {
      const message = error instanceof Error ? error.message : `playNote(${note}) failed`;
      setLastError(message);
      setLogs((currentLogs) => appendLog(currentLogs, formatLogLine("playError", `${note} ${message}`)));
    }
  }

  async function handleStopAll(): Promise<void> {
    setLastError(null);

    try {
      await NativeAudio.stopAll();
      setLogs((currentLogs) => appendLog(currentLogs, formatLogLine("stopAll", "stopped active native streams")));
    } catch (error) {
      const message = error instanceof Error ? error.message : "stopAll failed";
      setLastError(message);
      setLogs((currentLogs) => appendLog(currentLogs, formatLogLine("stopError", message)));
    }
  }

  if (!isAndroidNative) {
    return null;
  }

  return (
    <Paper
      sx={{
        mt: 1,
        p: 1.25,
        border: "3px dashed #000",
        bgcolor: "#fff8c6",
        boxShadow: "4px 4px 0px #000",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
          Native Audio Debug
        </Typography>
        <Chip
          label={
            isPrepared && prepareResult
              ? `Prepared ${prepareResult.loadedCount}/${prepareResult.totalCount}`
              : "Idle"
          }
          color={isPrepared ? "success" : "default"}
          size="small"
        />
      </Stack>

      <Typography variant="caption" sx={{ display: "block", mb: 1 }}>
        阶段 4 临时调试入口，只验证 Android 原生单音链路，不接正式练习流程。
      </Typography>

      <Stack spacing={1}>
        <Button variant="contained" size="small" onClick={() => void handlePrepare()} disabled={isPreparing}>
          {isPreparing ? "Preparing" : "Prepare"}
        </Button>

        <Stack direction="row" spacing={1} alignItems="stretch">
          <FormControl fullWidth size="small">
            <Select
              value={selectedNote}
              onChange={handleSelectedNoteChange}
              disabled={!isPrepared}
              sx={{
                bgcolor: "#fff",
                border: "2px solid #000",
                borderRadius: "10px",
                fontWeight: 900,
              }}
            >
              {DEBUG_NOTE_OPTIONS.map((note) => (
                <MenuItem key={note} value={note}>
                  {note}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handlePlayNote(selectedNote)}
            disabled={!isPrepared}
          >
            Play {selectedNote}
          </Button>
          <Button variant="outlined" color="error" size="small" onClick={() => void handleStopAll()}>
            Stop All
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          mt: 1,
          p: 1,
          border: "2px solid #000",
          borderRadius: "10px",
          bgcolor: "#fff",
        }}
      >
        <Typography variant="caption" sx={{ display: "block", fontWeight: 900 }}>
          采样状态
        </Typography>
        <Typography variant="caption" sx={{ display: "block", mt: 0.25 }}>
          {prepareResult
            ? `已加载 ${prepareResult.loadedCount}/${prepareResult.totalCount}`
            : "尚未执行 prepareSamples()"}
        </Typography>
        <Typography variant="caption" sx={{ display: "block", mt: 0.5, wordBreak: "break-word" }}>
          {prepareResult ? describeLoadedNotes(prepareResult.loadedNotes) : "等待准备结果..."}
        </Typography>
      </Box>

      {lastError ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {lastError}
        </Alert>
      ) : null}

      <Box
        sx={{
          mt: 1,
          p: 1,
          maxHeight: 140,
          overflowY: "auto",
          border: "2px solid #000",
          bgcolor: "#111",
          color: "#c8ff9e",
          fontFamily: "monospace",
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
        }}
      >
        {logs.length === 0 ? "等待原生调试日志..." : logs.join("\n")}
      </Box>
    </Paper>
  );
}
