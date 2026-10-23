import type { DeckTheme } from './types';

// Sampled from the TALO Engine PDF (Oct 2026)
export const talo: DeckTheme = {
  id: 'talo',
  name: 'TALO Engine',
  wordmark: 'TALO ENGINE',
  color: {
    accent: '#1950C7',
    onAccent: '#FFFFFF',
    ink: '#2D2D2D',
    muted: '#5A5A5A',
    paper: '#FFFFFF',
    surface: '#F5F6FA',
    surfaceAlt: '#F6F7F9',
    line: '#D5D8DE',
    gridLine: '#AAADB2',
    field: '#C9CDD4',
    frame: '#B1B2B6',
    glow: 'rgba(25, 80, 199, .22)',
    halo: '#E6EDFA',
  },
  gradient: {
    cover: 'linear-gradient(130deg, #F3F4F6 0%, #EEF2FB 32%, #E6EDF8 62%, #D4E1F4 100%)',
  },
  type: {
    display: 92,
    title: 34,
    heading: 26,
    lead: 24,
    body: 23,
    small: 15,
    caption: 14,
    label: 13,
    micro: 11,
  },
  space: { frame: 36, margin: 84, top: 64 },
  radius: { card: 10, field: 4 },
  shadow: { card: '0 1px 2px rgba(20, 30, 60, .06)' },
};
