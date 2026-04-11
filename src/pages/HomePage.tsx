import type { ReactElement } from 'react';
import KeyboardVoiceRoundedIcon from '@mui/icons-material/KeyboardVoiceRounded';
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded';
import NorthEastRoundedIcon from '@mui/icons-material/NorthEastRounded';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import HeroMotionScore from '../components/HeroMotionScore.tsx';

interface EntryCardProps {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
  to: '/exercise' | '/demo';
  icon: ReactElement;
  accentColor: string;
  background: string;
}

function EntryCard({
  accentColor,
  background,
  description,
  eyebrow,
  icon,
  meta,
  title,
  to,
}: EntryCardProps): ReactElement {
  return (
    <ButtonBase
      component={Link}
      to={to}
      sx={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        borderRadius: '28px',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          minHeight: 220,
          p: 2.25,
          borderRadius: '28px',
          border: '3px solid #112033',
          bgcolor: background,
          boxShadow: '0 16px 32px rgba(17, 32, 51, 0.14)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 22px 36px rgba(17, 32, 51, 0.18)',
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              bgcolor: accentColor,
              boxShadow: '0 10px 18px rgba(17, 32, 51, 0.18)',
            }}
          >
            {icon}
          </Box>
          <NorthEastRoundedIcon sx={{ color: '#112033', fontSize: 26 }} />
        </Stack>

        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            mt: 3.2,
            p: 1.6,
            borderRadius: '22px',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(246,241,229,0.86) 100%)',
            border: '1.5px solid rgba(17, 32, 51, 0.12)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
          }}
        >
          <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.12em', color: accentColor }}>
            {eyebrow}
          </Typography>
          <Typography sx={{ mt: 0.9, fontSize: '1.5rem', lineHeight: 1.1, fontWeight: 900, color: '#102132' }}>
            {title}
          </Typography>
          <Typography sx={{ mt: 1.2, fontSize: '0.92rem', lineHeight: 1.6, fontWeight: 600, color: '#37475d' }}>
            {description}
          </Typography>
          <Typography sx={{ mt: 2.2, fontSize: '0.78rem', fontWeight: 800, color: '#102132' }}>
            {meta}
          </Typography>
        </Box>
      </Box>
    </ButtonBase>
  );
}

export default function HomePage(): ReactElement {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at top left, #f5f1e4 0%, #eef2f6 46%, #dde7ef 100%)',
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          px: 2,
          py: 2,
        }}
      >
        <Box
          sx={{
            p: 2.2,
          }}
        >
          <Stack spacing={2.2}>
            <Box>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.14em', color: '#335278' }}>
                VOICE TRAINER
              </Typography>
              <Typography sx={{ mt: 1.1, fontSize: '2rem', lineHeight: 1.05, fontWeight: 900, color: '#102132' }}>
                练声训练与教师示范
              </Typography>
              <Box sx={{ mt: 2.1 }}>
                <HeroMotionScore />
              </Box>
            </Box>

            <Stack spacing={1.6}>
              <EntryCard
                to="/exercise"
                eyebrow="Guided Practice"
                title="音阶练习"
                description="进入钢琴训练界面，自选起始音、速度与往返模式，按当前设定完成整套练声流程。"
                meta="进入练习页面"
                icon={<KeyboardVoiceRoundedIcon sx={{ fontSize: 28 }} />}
                accentColor="#183153"
                background="linear-gradient(180deg, #fffef7 0%, #f1efe4 100%)"
              />
              <EntryCard
                to="/demo"
                eyebrow="Reference Audio"
                title="音阶示范"
                description="查看老师提供的成品音频列表，直接播放标准示范，作为练习前后的对照参考。"
                meta="收听老师示范"
                icon={<LibraryMusicRoundedIcon sx={{ fontSize: 28 }} />}
                accentColor="#5f4b1f"
                background="linear-gradient(180deg, #fff8ee 0%, #f2eadb 100%)"
              />
            </Stack>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
