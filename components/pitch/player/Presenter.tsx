'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { canvasSize } from '@/lib/pitch/format';
import type { Deck } from '@/lib/pitch/schema';
import { ModeProvider } from '../canvas/ModeProvider';
import { ScaleToFit } from '../canvas/ScaleToFit';
import { SlideCanvas } from '../canvas/SlideCanvas';
import { usePlayer } from './usePlayer';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Notes, the next slide and a timer. The audience window follows along.
export function Presenter({ deck }: { deck: Deck }) {
  const { slides, pos, entered, entering, next, prev, nextSlide, prevSlide, steps } = usePlayer(deck, { sync: true, hash: false });
  const { width, height } = canvasSize(deck.format);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const slide = slides[pos.slide];
  const upcoming = slides[pos.slide + 1];

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) (e.shiftKey ? nextSlide : next)();
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) (e.shiftKey ? prevSlide : prev)();
      else return;
      e.preventDefault();
      setStarted((s) => s ?? Date.now());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, nextSlide, prevSlide]);

  const elapsed = started && now ? Math.max(0, Math.round((now - started) / 1000)) : 0;

  return (
    <div className="flex h-svh flex-col bg-[#0E0F12] text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/pitch" className="pitch-bar-button">
            Exit
          </Link>
          <span className="font-mono text-sm text-white/70 tabular-nums">
            {pos.slide + 1} / {slides.length} · build {pos.step} of {steps}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-semibold tabular-nums tracking-[-.02em]">{clock(elapsed)}</span>
          <button type="button" className="pitch-bar-button" onClick={() => setStarted(started ? null : Date.now())}>
            {started ? 'Reset timer' : 'Start timer'}
          </button>
          <button
            type="button"
            className="pitch-bar-button"
            onClick={() => window.open(`/pitch/present/${deck.id}#slide-${pos.slide + 1}`, `pitch-audience-${deck.id}`)}
          >
            Open audience window
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 px-5 pb-5 lg:grid-cols-[1fr_360px]">
        <ModeProvider mode="present" deck={deck}>
          {/* Clicking the slide plays the next build, as in present mode */}
          <div
            className="min-h-0"
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('a, button, input, textarea, select, label')) next();
            }}
          >
            <ScaleToFit width={width} height={height} className="size-full">
              {slide ? <SlideCanvas key={slide.id} slide={slide} index={pos.slide} total={slides.length} entered={entered} entering={entering} /> : null}
            </ScaleToFit>
          </div>
        </ModeProvider>

        <aside className="flex min-h-0 flex-col gap-4">
          <div>
            <div className="mb-2 text-xs font-medium tracking-wide text-white/50 uppercase">Next</div>
            <div className="aspect-video overflow-hidden rounded-lg bg-white/5">
              {upcoming ? (
                <ModeProvider mode="print" deck={deck}>
                  <ScaleToFit width={width} height={height} className="size-full">
                    <SlideCanvas slide={upcoming} index={pos.slide + 1} total={slides.length} />
                  </ScaleToFit>
                </ModeProvider>
              ) : (
                <div className="grid size-full place-items-center text-sm text-white/40">End of deck</div>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 text-xs font-medium tracking-wide text-white/50 uppercase">Notes</div>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-white/5 p-4 text-lg leading-relaxed whitespace-pre-wrap text-white/90">
              {slide?.notes || <span className="text-white/40">No notes for this slide</span>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
