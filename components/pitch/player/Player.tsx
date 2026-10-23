'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasSize } from '@/lib/pitch/format';
import type { Deck, Slide } from '@/lib/pitch/schema';
import { ModeProvider } from '../canvas/ModeProvider';
import { ScaleToFit } from '../canvas/ScaleToFit';
import { SlideCanvas } from '../canvas/SlideCanvas';
import { DownloadPdf } from './DownloadPdf';
import { usePlayer } from './usePlayer';

const INTERACTIVE = 'a, button, input, textarea, select, label, [contenteditable="true"]';
const BAR_DELAY = 2000;

function imagesOf(slide?: Slide) {
  if (!slide) return [];
  return Object.values(slide.slots)
    .flat()
    .flatMap((b) => (b.type === 'image' ? [b.src] : b.type === 'image-grid' ? b.items.map((i) => i.src) : []));
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

// Present mode, and (as `share`) the client-facing view at /pitch/d/[deckId]
export function Player({ deck, exitHref, share = false }: { deck: Deck; exitHref?: string; share?: boolean }) {
  const { slides, pos, entered, entering, next, prev, nextSlide, prevSlide, steps } = usePlayer(deck, {
    builds: !share || deck.motion.buildsInShare,
    sync: !share,
  });
  const { width, height } = canvasSize(deck.format);
  const slide = slides[pos.slide];
  const [bar, setBar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Arrow keys, space and page keys step through builds. Fields keep their keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const forward = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key);
      const back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
      if (forward) (e.shiftKey ? nextSlide : next)();
      else if (back) (e.shiftKey ? prevSlide : prev)();
      else if (e.key === 'Escape' && exitHref && !document.fullscreenElement) window.location.assign(exitHref);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, nextSlide, prevSlide, exitHref]);

  // The next slide's images load in the background
  useEffect(() => {
    for (const src of imagesOf(slides[pos.slide + 1])) new Image().src = src;
  }, [slides, pos.slide]);

  // The bar fades two seconds after the mouse stops, unless the mouse is on it
  const showBar = useCallback((onBar: boolean) => {
    setBar(true);
    clearTimeout(timer.current);
    if (!onBar) timer.current = setTimeout(() => setBar(false), BAR_DELAY);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const transition = slide?.transition ?? deck.motion.transition;

  return (
    <ModeProvider mode="present" deck={deck}>
      <div
        className="pitch-stage fixed inset-0 cursor-default select-none bg-[#0E0F12]"
        data-slide-index={pos.slide}
        data-step={pos.step}
        data-steps={steps}
        onMouseMove={(e) => showBar(!!(e.target as HTMLElement).closest('.pitch-bar'))}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest(INTERACTIVE)) next();
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') touch.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.clientX - t.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - t.y)) (dx < 0 ? next : prev)();
        }}
      >
        <ScaleToFit width={width} height={height} className="size-full">
          <AnimatePresence initial={false} custom={pos.forward}>
            {slide ? (
              <motion.div
                key={slide.id}
                className="absolute inset-0"
                custom={pos.forward}
                variants={slideTransitions[transition]}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <SlideCanvas
                  slide={slide}
                  index={pos.slide}
                  total={slides.length}
                  entered={entered}
                  entering={entering}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </ScaleToFit>

        <div
          className={`pitch-bar absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-5 py-3 transition-opacity duration-200 ${bar || share ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <div className="flex items-center gap-3">
            {exitHref ? (
              <Link href={exitHref} className="pitch-bar-button">
                Exit
              </Link>
            ) : null}
            <span className="font-mono text-sm text-white/70 tabular-nums">
              {pos.slide + 1} / {slides.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="pitch-bar-button"
              onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
            >
              Full screen
            </button>
            <DownloadPdf deckId={deck.id} />
          </div>
        </div>
      </div>
    </ModeProvider>
  );
}

const ease = [0.22, 1, 0.36, 1] as const;

const slideTransitions = {
  fade: {
    enter: { opacity: 0 },
    center: { opacity: 1, transition: { duration: 0.35, ease } },
    exit: { opacity: 0, transition: { duration: 0.35, ease } },
  },
  push: {
    enter: (forward: boolean) => ({ x: forward ? '100%' : '-100%' }),
    center: { x: 0, transition: { duration: 0.5, ease } },
    exit: (forward: boolean) => ({ x: forward ? '-100%' : '100%', transition: { duration: 0.5, ease } }),
  },
  none: {
    enter: { opacity: 1 },
    center: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0 } },
  },
};
