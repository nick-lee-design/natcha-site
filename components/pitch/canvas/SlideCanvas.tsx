'use client';

import { canvasSize } from '@/lib/pitch/format';
import type { Slide } from '@/lib/pitch/schema';
import { themeVars } from '@/lib/pitch/theme';
import { templates } from '../templates';
import { SlideProvider, useMode, type SlideState } from './ModeProvider';

const NONE = new Map<string, number>();

// One slide on its fixed canvas. Thumbnails, the player and print all render this.
export function SlideCanvas({
  slide,
  index,
  total,
  entered = 'all',
  entering = NONE,
}: {
  slide: Slide;
  index: number;
  total: number;
  entered?: SlideState['entered'];
  entering?: SlideState['entering'];
}) {
  const { deck, theme } = useMode();
  const { width, height } = canvasSize(deck.format);
  const template = templates[slide.template];
  return (
    <SlideProvider value={{ slide, index, total, entered, entering }}>
      <div
        className="deck-canvas relative overflow-hidden bg-paper text-ink"
        style={{ width, height, ...themeVars(theme) }}
        data-slide={slide.id}
      >
        {template ? (
          <template.Component slide={slide} />
        ) : (
          <div className="grid size-full place-items-center text-muted">Unknown template “{slide.template}”</div>
        )}
      </div>
    </SlideProvider>
  );
}
