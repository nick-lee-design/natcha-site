'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBuildSteps } from '@/lib/pitch/build-engine';
import type { Deck } from '@/lib/pitch/schema';

// `initial` marks the starting position before the URL has been read; it's never written back or shared
export type Position = { slide: number; step: number; forward: boolean; initial?: boolean };

type Options = {
  // Off: every slide arrives whole (the share view can turn builds off)
  builds?: boolean;
  // Keeps other windows of this deck (the presenter view) on the same build
  sync?: boolean;
  // Follow the URL hash
  hash?: boolean;
};

const fromHash = () => {
  const m = typeof location === 'undefined' ? null : location.hash.match(/^#slide-(\d+)$/);
  return m ? Number(m[1]) - 1 : 0;
};

// Walks a deck build by build. `step` counts the steps played on the current slide (at least 1).
export function usePlayer(deck: Deck, { builds = true, sync = false, hash = true }: Options = {}) {
  const slides = useMemo(() => deck.slides.filter((s) => !s.hidden), [deck]);
  const steps = useMemo(
    () =>
      slides.map((s) => {
        const all = getBuildSteps(s, deck);
        return builds || !all.length ? all : [all.flat()];
      }),
    [slides, deck, builds],
  );
  const count = useCallback((i: number) => Math.max(steps[i]?.length ?? 0, 1), [steps]);
  const clamp = useCallback((i: number) => Math.min(Math.max(i, 0), slides.length - 1), [slides.length]);

  const [pos, setPos] = useState<Position>({ slide: 0, step: 1, forward: true, initial: true });

  // The hash opens a slide directly (#slide-6) and follows the current one
  useEffect(() => {
    if (!hash) {
      setPos((p) => ({ ...p, initial: false }));
      return;
    }
    const open = () => setPos({ slide: clamp(fromHash()), step: 1, forward: true });
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [clamp, hash]);

  useEffect(() => {
    if (hash && !pos.initial) history.replaceState(null, '', `#slide-${pos.slide + 1}`);
  }, [pos.slide, pos.initial, hash]);

  const channel = useRef<BroadcastChannel | null>(null);
  const remote = useRef<string | null>(null);
  useEffect(() => {
    if (!sync || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(`pitch-${deck.id}`);
    ch.onmessage = (e: MessageEvent<Position>) => {
      const next = { slide: e.data.slide, step: e.data.step, forward: e.data.forward };
      remote.current = JSON.stringify(next);
      setPos(next);
    };
    channel.current = ch;
    return () => ch.close();
  }, [sync, deck.id]);
  useEffect(() => {
    if (pos.initial) return;
    const message = { slide: pos.slide, step: pos.step, forward: pos.forward };
    if (remote.current === JSON.stringify(message)) return;
    channel.current?.postMessage(message);
  }, [pos]);

  const next = useCallback(
    () =>
      setPos((p) =>
        p.step < count(p.slide)
          ? { ...p, step: p.step + 1, forward: true }
          : p.slide < slides.length - 1
            ? { slide: p.slide + 1, step: 1, forward: true }
            : p,
      ),
    [count, slides.length],
  );

  const prev = useCallback(
    () =>
      setPos((p) =>
        p.step > 1
          ? { ...p, step: p.step - 1, forward: false }
          : p.slide > 0
            ? { slide: p.slide - 1, step: count(p.slide - 1), forward: false }
            : p,
      ),
    [count],
  );

  // Whole-slide jumps: forward to a slide's start, back to its finished state
  const nextSlide = useCallback(
    () => setPos((p) => (p.slide < slides.length - 1 ? { slide: p.slide + 1, step: 1, forward: true } : p)),
    [slides.length],
  );
  const prevSlide = useCallback(
    () => setPos((p) => (p.slide > 0 ? { slide: p.slide - 1, step: count(p.slide - 1), forward: false } : p)),
    [count],
  );

  const current = steps[pos.slide] ?? [];
  const entered = useMemo(() => new Set(current.slice(0, pos.step).flat()), [current, pos.step]);
  // Only a step played forwards animates; stepping back lands instantly
  const entering = useMemo(
    () => new Map(pos.forward ? (current[pos.step - 1] ?? []).map((u, i) => [u, i] as const) : []),
    [current, pos.step, pos.forward],
  );

  const goTo = useCallback((slide: number) => setPos({ slide: clamp(slide), step: 1, forward: true }), [clamp]);

  return { slides, pos, entered, entering, next, prev, nextSlide, prevSlide, goTo, steps: count(pos.slide), stepsOf: count };
}
