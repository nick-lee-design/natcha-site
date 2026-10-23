'use client';

import { useEffect, useState } from 'react';
import type { Deck } from '@/lib/pitch/schema';
import { ModeProvider } from '../canvas/ModeProvider';
import { SlideCanvas } from '../canvas/SlideCanvas';

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

// Every visible slide in its finished state, one per page, with no motion
export function PrintDeck({ deck }: { deck: Deck }) {
  const slides = deck.slides.filter((s) => !s.hidden);
  const [ready, setReady] = useState(false);

  // The PDF generator waits for this: fonts loaded, images decoded, text slots fitted
  useEffect(() => {
    let live = true;
    (async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      await frame();
      if (live) setReady(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <ModeProvider mode="print" deck={deck}>
      <div className="pitch-print" data-print-ready={ready ? '' : undefined}>
        {slides.map((slide, i) => (
          <div key={slide.id} className="pitch-page">
            <SlideCanvas slide={slide} index={i} total={slides.length} />
          </div>
        ))}
      </div>
    </ModeProvider>
  );
}
