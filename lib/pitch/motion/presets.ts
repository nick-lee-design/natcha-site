import type { Transition, Variants } from 'motion/react';
import type { Direction, MotionStyle, Speed, Stagger } from '../schema';

export const EASE = [0.22, 1, 0.36, 1] as const;
const BASE = 0.45;
const MAX = 0.7;
const REDUCED = 0.2;

export const SPEED: Record<Speed, number> = { relaxed: 1.3, normal: 1, brisk: 0.75 };
export const STAGGER: Record<Stagger, number> = { tight: 0.04, normal: 0.07, loose: 0.11 };

export type ResolvedMotion = {
  style: MotionStyle;
  direction: Direction;
  speed: Speed;
  stagger: Stagger;
};

// Passed to variants through Motion's `custom`
export type Timing = { delay: number; duration: number; reduced: boolean };

export function duration(speed: Speed) {
  return Math.min(BASE * SPEED[speed], MAX);
}

const offset = (d: Direction, px: number) =>
  ({ up: { y: px }, down: { y: -px }, left: { x: px }, right: { x: -px } })[d];

// Clip insets that start fully hidden on the side the element travels away from
const clipFrom = (d: Direction) =>
  ({
    up: 'inset(100% 0% 0% 0%)',
    down: 'inset(0% 0% 100% 0%)',
    left: 'inset(0% 0% 0% 100%)',
    right: 'inset(0% 100% 0% 0%)',
  })[d];

const CLIP_FULL = 'inset(0% 0% 0% 0%)';
const HIDE: Transition = { duration: 0 };

const tween = (t: Timing): Transition => ({ duration: t.duration, delay: t.delay, ease: EASE });

// Each style returns the waiting state and the entered (laid-out) state.
// Only opacity, transform, clip-path and SVG stroke-dashoffset are animated.
type Preset = (direction: Direction) => Variants;

const fade: Variants = {
  hidden: { opacity: 0, transition: HIDE },
  entered: (t: Timing) => ({ opacity: 1, transition: tween(t) }),
};

export const presets: Record<MotionStyle, Preset> = {
  gentle: () => ({
    hidden: { opacity: 0, y: 16, transition: HIDE },
    entered: (t: Timing) => ({ opacity: 1, y: 0, transition: tween(t) }),
  }),
  pop: () => ({
    hidden: { opacity: 0, scale: 0.96, transition: HIDE },
    entered: (t: Timing) => ({
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', bounce: 0.18, duration: t.duration, delay: t.delay },
    }),
  }),
  slide: (d) => ({
    hidden: { opacity: 0, ...offset(d, 48), transition: HIDE },
    entered: (t: Timing) => ({ opacity: 1, x: 0, y: 0, transition: tween(t) }),
  }),
  wipe: (d) => ({
    hidden: { clipPath: clipFrom(d), transition: HIDE },
    entered: (t: Timing) => ({ clipPath: CLIP_FULL, transition: { ...tween(t), duration: Math.min(t.duration * 1.4, MAX) } }),
  }),
  // The wrapper fades; SVG strokes inside draw on through DrawPath
  draw: () => fade,
  none: () => ({
    hidden: { opacity: 0, transition: HIDE },
    entered: { opacity: 1, transition: { duration: 0 } },
  }),
};

export const reducedPreset: Variants = {
  hidden: { opacity: 0, transition: HIDE },
  entered: (t: Timing) => ({ opacity: 1, transition: { duration: REDUCED, delay: t.delay } }),
};

export function variantsFor(m: ResolvedMotion, reduced: boolean): Variants {
  return reduced ? reducedPreset : presets[m.style](m.direction);
}

export function stepDelay(index: number, stagger: Stagger) {
  return index * STAGGER[stagger];
}
