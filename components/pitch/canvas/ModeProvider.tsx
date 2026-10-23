'use client';

import { createContext, use, type ReactNode } from 'react';
import type { Block, Deck, Slide } from '@/lib/pitch/schema';
import { getTheme, type DeckTheme } from '@/lib/pitch/theme';

export type Mode = 'edit' | 'present' | 'print';

type ModeValue = { mode: Mode; deck: Deck; theme: DeckTheme };

const ModeContext = createContext<ModeValue | null>(null);

export function ModeProvider({ mode, deck, children }: { mode: Mode; deck: Deck; children: ReactNode }) {
  return <ModeContext value={{ mode, deck, theme: getTheme(deck.theme) }}>{children}</ModeContext>;
}

export function useMode() {
  const value = use(ModeContext);
  if (!value) throw new Error('useMode needs a ModeProvider');
  return value;
}

// Units already in place ('all' in edit and print) and the ones entering now, with their order in the step
export type SlideState = {
  slide: Slide;
  index: number;
  total: number;
  entered: ReadonlySet<string> | 'all';
  entering: ReadonlyMap<string, number>;
};

const SlideContext = createContext<SlideState | null>(null);
export const SlideProvider = SlideContext;

export function useSlide() {
  const value = use(SlideContext);
  if (!value) throw new Error('useSlide needs a SlideProvider');
  return value;
}

// The blocks of a slot that belong in the current mode
export function useBlocks(slot: string): Block[] {
  const { mode } = useMode();
  const { slide } = useSlide();
  return (slide.slots[slot] ?? []).filter((b) =>
    mode === 'present' ? b.showIn !== 'print' : mode === 'print' ? b.showIn !== 'present' : true,
  );
}

export function useBlock<T extends Block['type']>(slot: string, type: T) {
  return useBlocks(slot).find((b): b is Extract<Block, { type: T }> => b.type === type);
}
