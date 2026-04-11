import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ScaleDemoTrack } from '../config/scaleDemoTracks.ts';
import type { DemoTrackViewState } from '../hooks/useDemoAudioPlayer.ts';

export interface DemoTrackCardProps {
  onProgressPointerDown: (
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onProgressPointerEnd: (
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onProgressPointerMove: (
    track: ScaleDemoTrack,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onToggle: (track: ScaleDemoTrack) => Promise<void> | void;
  track: ScaleDemoTrack;
  viewState: DemoTrackViewState;
}

export default function DemoTrackCard({
  onProgressPointerDown,
  onProgressPointerEnd,
  onProgressPointerMove,
  onToggle,
  track,
  viewState,
}: DemoTrackCardProps): ReactElement {
  return (
    <Paper
      sx={{
        p: 1.5,
        borderRadius: '24px',
        border: '2px solid #102132',
        bgcolor: viewState.isActive ? '#eef3f8' : 'rgba(255,255,255,0.82)',
        boxShadow: '0 10px 22px rgba(16, 33, 50, 0.08)',
      }}
    >
      <Stack direction="row" spacing={1.4} alignItems="stretch">
        <Box
          onPointerDown={(event) => onProgressPointerDown(track, event)}
          onPointerMove={(event) => onProgressPointerMove(track, event)}
          onPointerUp={(event) => onProgressPointerEnd(track, event)}
          onPointerCancel={(event) => onProgressPointerEnd(track, event)}
          onLostPointerCapture={(event) => onProgressPointerEnd(track, event)}
          sx={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            borderRadius: '18px',
            border: '2px solid rgba(16, 33, 50, 0.12)',
            bgcolor: 'rgba(255,255,255,0.72)',
            touchAction: viewState.isSeekEnabled ? 'none' : 'auto',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              width: `${viewState.progressRatio * 100}%`,
              minWidth: viewState.progressRatio > 0 ? '18px' : 0,
              background: viewState.isActive
                ? 'linear-gradient(90deg, rgba(24,49,83,0.18) 0%, rgba(73,122,177,0.38) 100%)'
                : 'linear-gradient(90deg, rgba(213,222,232,0.24) 0%, rgba(213,222,232,0.08) 100%)',
              transition: 'width 120ms linear',
            }}
          />
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              minHeight: 86,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              p: 1.25,
            }}
          >
            <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#102132' }}>
              {track.title}
            </Typography>
            <Box
              sx={{
                mt: 1.1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: '#38506b' }}>
                {viewState.positionLabel}
              </Typography>
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: '#6b7d93' }}>
                {viewState.durationLabel}
              </Typography>
            </Box>
          </Box>
        </Box>
        <ButtonBase
          onClick={() => void onToggle(track)}
          sx={{
            width: 70,
            height: 70,
            flexShrink: 0,
            borderRadius: '20px',
            border: '2px solid #102132',
            bgcolor: viewState.isActive ? '#102132' : '#fff',
            color: viewState.isActive ? '#fff' : '#102132',
          }}
        >
          <Stack spacing={0.3} alignItems="center">
            {viewState.isActive ? (
              <PauseCircleRoundedIcon sx={{ fontSize: 32 }} />
            ) : (
              <PlayCircleRoundedIcon sx={{ fontSize: 32 }} />
            )}
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 900 }}>
              {viewState.isActive ? '停止' : '播放'}
            </Typography>
          </Stack>
        </ButtonBase>
      </Stack>
    </Paper>
  );
}
