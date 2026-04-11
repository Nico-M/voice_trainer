import type { ReactElement } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import DemoTrackCard from '../components/DemoTrackCard.tsx';
import { SCALE_DEMO_TRACKS } from '../config/scaleDemoTracks.ts';
import useDemoAudioPlayer from '../hooks/useDemoAudioPlayer.ts';

export default function ScaleDemoPage(): ReactElement {
  const {
    audioRef,
    getTrackViewState,
    handleProgressPointerDown,
    handleProgressPointerEnd,
    handleProgressPointerMove,
    playbackError,
    toggleTrack,
  } = useDemoAudioPlayer();

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #f6f2e9 0%, #e7edf3 100%)',
      }}
    >
      <Container maxWidth="sm" sx={{ px: 2, py: 2 }}>
        <ButtonBase
          component={Link}
          to="/"
          sx={{
            mb: 2,
            px: 1.4,
            py: 0.9,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            borderRadius: '999px',
            border: '2px solid #102132',
            bgcolor: '#fff',
            boxShadow: '0 8px 20px rgba(16, 33, 50, 0.1)',
          }}
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
          <Typography sx={{ fontWeight: 800, fontSize: '0.84rem' }}>返回首页</Typography>
        </ButtonBase>

        <Paper
          sx={{
            p: 2.25,
            borderRadius: '28px',
            border: '3px solid #102132',
            bgcolor: 'rgba(255,255,255,0.82)',
            boxShadow: '0 16px 36px rgba(16, 33, 50, 0.12)',
          }}
        >
          <Typography sx={{ fontSize: '0.76rem', fontWeight: 900, letterSpacing: '0.14em', color: '#335278' }}>
            REFERENCE AUDIO
          </Typography>
          <Typography sx={{ mt: 1, fontSize: '1.8rem', lineHeight: 1.08, fontWeight: 900, color: '#102132' }}>
            音阶示范
          </Typography>
        </Paper>

        <Stack spacing={1.4} sx={{ mt: 1.8 }}>
          {SCALE_DEMO_TRACKS.length === 0 ? (
            <Paper
              sx={{
                p: 2,
                borderRadius: '24px',
                border: '2px dashed #8ca0b7',
                bgcolor: 'rgba(255,255,255,0.7)',
              }}
            >
              <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: '#102132' }}>
                还没有示范音频
              </Typography>
              <Typography sx={{ mt: 0.8, fontSize: '0.88rem', lineHeight: 1.65, fontWeight: 600, color: '#52657c' }}>
                你后续把音频放到 `public`，然后在 [src/config/scaleDemoTracks.ts](/Users/nico/Documents/program/voice_trainer/src/config/scaleDemoTracks.ts:1) 里填入标题、时长和音频地址，这个列表页就会自动展示。
              </Typography>
            </Paper>
          ) : (
            SCALE_DEMO_TRACKS.map((track) => (
              <DemoTrackCard
                key={track.id}
                onProgressPointerDown={handleProgressPointerDown}
                onProgressPointerEnd={handleProgressPointerEnd}
                onProgressPointerMove={handleProgressPointerMove}
                onToggle={toggleTrack}
                track={track}
                viewState={getTrackViewState(track)}
              />
            ))
          )}

          {playbackError ? (
            <Typography sx={{ px: 0.5, fontSize: '0.8rem', fontWeight: 800, color: '#c5352b' }}>
              {playbackError}
            </Typography>
          ) : null}
        </Stack>
      </Container>
      <audio ref={audioRef} preload="none" />
    </Box>
  );
}
