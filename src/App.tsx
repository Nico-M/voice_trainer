import type { ReactElement } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import MangaPiano from "./components/MangaPiano.tsx";
import NativeAudioDebugPanel from "./components/NativeAudioDebugPanel.tsx";
import VoiceTrainerControls from "./components/VoiceTrainerControls.tsx";
import useExercisePlayback from "./hooks/useExercisePlayback.ts";
import useManagedPlayer from "./hooks/useManagedPlayer.ts";
import { Typography } from "@mui/material";

export default function App(): ReactElement {
  // 页面层直接组合“音频能力”和“练习状态机”两个核心 hook，
  // 少一层只做转发的包装，阅读路径会更短。
  const { isPlayerReady, player } = useManagedPlayer();
  const { controls, piano } = useExercisePlayback(player, isPlayerReady);

  return (
    <Box
      sx={{
        bgcolor: "#ffde00",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          px: 1.5,
          py: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box>
          <Box sx={{ mb: 1, textAlign: "center" }}>
            <Box
              component="h1"
              sx={{
                m: 0,
                fontSize: "1.5rem",
                fontWeight: 900,
                fontStyle: "italic",
                color: "#000",
                textShadow: "3px 3px 0px #fff, 5px 5px 0px #000",
                WebkitTextStroke: "1px #000",
              }}
            >
              VOICE TRAINER
            </Box>
            <Typography variant="overline" sx={{ mt: 1, mb: 2, color: "info.dark" }}>
              跟着王老师学唱歌
            </Typography>
          </Box>

          <VoiceTrainerControls {...controls} />
          <NativeAudioDebugPanel />
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ mb: 1 }}>
          <Paper
            sx={{
              border: "4px solid #000",
              borderRadius: "15px",
              overflow: "hidden",
              boxShadow: "6px 6px 0px #000",
              bgcolor: "#fff",
            }}
          >
            <MangaPiano {...piano} />
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
