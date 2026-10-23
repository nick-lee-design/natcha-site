'use client';

import type { BlockMotion } from '@/lib/pitch/schema';
import { useBlocks, useMode } from '../canvas/ModeProvider';
import { TextBlock } from '../blocks/Text';

// The slide title, top left on the content grid
export function SlideTitle({ slot = 'title', width = 1000, fallback }: { slot?: string; width?: number; fallback?: BlockMotion }) {
  const { theme } = useMode();
  const title = useBlocks(slot).find((b) => b.type === 'title');
  if (!title || title.type !== 'title') return null;
  return <TextBlock block={title} fallback={fallback} style={{ position: 'absolute', left: theme.space.margin, top: theme.space.top, width }} />;
}

// A label block (with its optional note) at a canvas position
export function SlotLabel({ slot, x, y, width = 300 }: { slot: string; x: number; y: number; width?: number }) {
  const label = useBlocks(slot).find((b) => b.type === 'label');
  if (!label || label.type !== 'label') return null;
  return <TextBlock block={label} style={{ position: 'absolute', left: x, top: y, width }} />;
}
