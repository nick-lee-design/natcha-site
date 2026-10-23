import type { CSSProperties } from 'react';
import { talo } from './talo';
import type { DeckTheme } from './types';

export type { DeckTheme };

const themes: Record<string, DeckTheme> = { talo };

export function getTheme(id: string): DeckTheme {
  return themes[id] ?? talo;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// Tokens become --deck-* variables on the canvas, which Tailwind's theme maps to utilities
export function themeVars(theme: DeckTheme): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.color)) vars[`--deck-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(theme.type)) vars[`--deck-size-${k}`] = `${v}px`;
  vars['--deck-cover-gradient'] = theme.gradient.cover;
  vars['--deck-radius-card'] = `${theme.radius.card}px`;
  vars['--deck-radius-field'] = `${theme.radius.field}px`;
  vars['--deck-shadow-card'] = theme.shadow.card;
  return vars as CSSProperties;
}
