export interface ScaleDemoTrack {
  id: string;
  title: string;
  duration: string;
  audioSrc: string;
}

// 示范音频先走 public 静态资源，后续把文件放到 public/demo-audio 后只需要改这里。
export const SCALE_DEMO_TRACKS: ScaleDemoTrack[] = [
  {
    id: 'daily-mixed-voice-men',
    title: 'Daily MIXED VOICE Exercises for Men',
    duration: '31:30',
    audioSrc: '/demo-audio/Daily MIXED VOICE Exercises for Men – Strengthen Your Range & Improve Control.m4a',
  },
  {
    id: 'daily-awesome-voice',
    title: 'Daily Singing Exercises for an AWESOME Voice',
    duration: '33:40',
    audioSrc: '/demo-audio/Daily Singing Exercises for an AWESOME Voice.m4a',
  },
  {
    id: 'daily-vocal-tone-guys',
    title: 'Daily Vocal Tone Exercises for Guys',
    duration: '10:22',
    audioSrc: '/demo-audio/Daily Vocal Tone Exercises for Guys ｜ Improve Your Singing Tone Fast.m4a',
  },
  {
    id: 'best-vocal-exercises-pitch',
    title: 'The BEST Vocal Exercises to IMPROVE Your Pitch',
    duration: '22:29',
    audioSrc: '/demo-audio/The BEST Vocal Exercises to IMPROVE Your Pitch.m4a',
  },
];
