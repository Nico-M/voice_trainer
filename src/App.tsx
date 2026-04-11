import type { ReactElement } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import { Link } from "@tanstack/react-router";
import MangaPiano from "./components/MangaPiano.tsx";
import NativeAudioDebugPanel from "./components/NativeAudioDebugPanel.tsx";
import VoiceTrainerControls from "./components/VoiceTrainerControls.tsx";
import useExercisePlayback from "./hooks/useExercisePlayback.ts";
import useManagedPlayer from "./hooks/useManagedPlayer.ts";

export default function App(): ReactElement {
  // 页面层直接组合“音频能力”和“练习状态机”两个核心 hook，
  // 少一层只做转发的包装，阅读路径会更短。
  const isDev = import.meta.env.DEV;
  const { backend, isPlayerReady, player } = useManagedPlayer();
  const { controls, piano } = useExercisePlayback(player, isPlayerReady);

  return (
    <Box
      sx={{
        background:
          "radial-gradient(circle at top left, #f5f1e4 0%, #eef2f6 46%, #dde7ef 100%)",
        height: "100dvh",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          px: 1.5,
          py: 1.25,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              minHeight: 0,
              overflowY: "auto",
              overscrollBehavior: "contain",
              pr: 0.25,
            }}
          >
            <ButtonBase
              component={Link}
              to="/"
              sx={{
                mb: 1.25,
                px: 1.4,
                py: 0.85,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                borderRadius: "999px",
                border: "2px solid #000",
                bgcolor: "#fff8cf",
                boxShadow: "4px 4px 0px #000",
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontWeight: 900, fontSize: "0.82rem" }}>返回首页</Typography>
            </ButtonBase>
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
              {isDev ? (
                <>
                  <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="center"
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ mt: 1 }}
                  >
                    <Chip
                      label={`正式播放后端: ${backend.label}`}
                      color={backend.isNative ? "success" : "default"}
                      sx={{ fontWeight: 900 }}
                    />
                    <Chip
                      label={isPlayerReady ? "播放器已就绪" : "播放器预热中"}
                      color={isPlayerReady ? "primary" : "warning"}
                      sx={{ fontWeight: 900 }}
                    />
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ mt: 0.75, display: "block", fontWeight: 700, color: "#111" }}
                  >
                    {backend.description}
                  </Typography>
                </>
              ) : null}
            </Box>

            <VoiceTrainerControls {...controls} />
            {isDev ? <NativeAudioDebugPanel formalPlaybackBackendLabel={backend.label} /> : null}
          </Box>

          <Box sx={{ mt: 1, mb: 1, flexShrink: 0 }}>
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
        </Box>
      </Container>
    </Box>
  );
}
