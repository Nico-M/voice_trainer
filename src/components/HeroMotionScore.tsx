import type { ReactElement } from 'react';
import Box from '@mui/material/Box';

export default function HeroMotionScore(): ReactElement {
  return (
    <Box
      aria-hidden
      sx={{
        width: '100%',
        maxWidth: 360,
        mx: 'auto',
        filter: 'drop-shadow(0 18px 24px rgba(16, 24, 40, 0.16))',
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 360 280"
        sx={{
          width: '100%',
          height: 'auto',
          overflow: 'visible',
          '@keyframes floatSlow': {
            '0%, 100%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(-7px)' },
          },
          '@keyframes pulseSoft': {
            '0%, 100%': { opacity: 0.82 },
            '50%': { opacity: 1 },
          },
          '@keyframes sway': {
            '0%, 100%': { transform: 'rotate(-1.5deg)' },
            '50%': { transform: 'rotate(1.5deg)' },
          },
        }}
      >
        <defs>
          <linearGradient id="hero-panel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffdf4" />
            <stop offset="100%" stopColor="#f4ead0" />
          </linearGradient>
          <linearGradient id="hero-accent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#183153" />
            <stop offset="100%" stopColor="#315b8a" />
          </linearGradient>
        </defs>

        <g style={{ animation: 'floatSlow 6.4s ease-in-out infinite' }}>
          <rect x="16" y="26" width="328" height="220" rx="28" fill="url(#hero-panel)" stroke="#142033" strokeWidth="4" />
          <rect x="36" y="52" width="288" height="132" rx="18" fill="#fff" stroke="#142033" strokeWidth="3" />
          {[0, 1, 2, 3, 4].map((line) => (
            <line
              key={line}
              x1="58"
              x2="304"
              y1={82 + line * 20}
              y2={82 + line * 20}
              stroke="#304766"
              strokeWidth="2.5"
              opacity="0.88"
            />
          ))}

          <g style={{ transformOrigin: '120px 120px', animation: 'sway 5.8s ease-in-out infinite' }}>
            <ellipse cx="104" cy="126" rx="16" ry="12" fill="#183153" />
            <rect x="116" y="58" width="8" height="69" rx="4" fill="#183153" />
            <path d="M124 58 C164 70, 171 100, 145 115 L124 108 Z" fill="#183153" />
          </g>

          <g style={{ transformOrigin: '214px 124px', animation: 'sway 5.1s ease-in-out infinite reverse' }}>
            <ellipse cx="214" cy="132" rx="15" ry="11" fill="#22476f" />
            <rect x="226" y="70" width="8" height="64" rx="4" fill="#22476f" />
            <path d="M234 70 C270 78, 280 108, 256 122 L234 116 Z" fill="#22476f" />
          </g>

          <g style={{ animation: 'pulseSoft 4.4s ease-in-out infinite' }}>
            <circle cx="290" cy="84" r="11" fill="#d98d2b" stroke="#142033" strokeWidth="3" />
            <rect x="299" y="36" width="7" height="48" rx="3.5" fill="#142033" />
          </g>

          <rect x="52" y="199" width="256" height="24" rx="12" fill="#dde6f0" stroke="#142033" strokeWidth="3" />
          <rect x="67" y="206" width="78" height="10" rx="5" fill="url(#hero-accent)" />
          <rect x="154" y="206" width="58" height="10" rx="5" fill="#8aa4bf" />
          <rect x="220" y="206" width="70" height="10" rx="5" fill="#d2dbe5" />
          <circle cx="144" cy="211" r="12" fill="#f2b233" stroke="#142033" strokeWidth="3" />

          <path
            d="M40 230 C82 214, 119 251, 170 236 S257 212, 318 232"
            fill="none"
            stroke="#142033"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="9 10"
            opacity="0.72"
          />
        </g>
      </Box>
    </Box>
  );
}
