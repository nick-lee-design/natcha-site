'use client';

import { memo } from 'react';
import type { Deck, Slide } from '@/lib/pitch/schema';
import { ModeProvider } from '../canvas/ModeProvider';
import { ScaleToFit } from '../canvas/ScaleToFit';
import { SlideCanvas } from '../canvas/SlideCanvas';

// The same slide component, scaled down. Edit mode without editing: finished state, screen variants.
export const Thumb = memo(
  function Thumb({ deck, slide, index, total }: { deck: Deck; slide: Slide; index: number; total: number }) {
    return (
      <ModeProvider mode="edit" deck={deck}>
        {/* Inert: a picture of the slide, never a second set of controls */}
        <div inert aria-hidden>
          <ScaleToFit width={1600} height={900} className="pointer-events-none aspect-video w-full bg-white">
            <SlideCanvas slide={slide} index={index} total={total} />
          </ScaleToFit>
        </div>
      </ModeProvider>
    );
  },
  (a, b) => a.index === b.index && a.total === b.total && JSON.stringify(a.slide) === JSON.stringify(b.slide) && a.deck.client === b.deck.client && a.deck.date === b.deck.date,
);
