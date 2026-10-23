'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import { createContext, use, useRef, type CSSProperties, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { duration, EASE, stepDelay, variantsFor, type ResolvedMotion, type Timing } from '@/lib/pitch/motion/presets';
import type { BlockMotion, Deck, Slide } from '@/lib/pitch/schema';
import { useEdit } from './EditContext';
import { useMode, useSlide } from './ModeProvider';

const tags = { div: motion.div, span: motion.span, li: motion.li, section: motion.section };

type Props = Omit<HTMLAttributes<HTMLElement>, 'style' | 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> & {
  unit: string;
  // The block's own override
  motion?: BlockMotion;
  // The template's default for this element
  fallback?: BlockMotion;
  // Position in the step for staggering, when it isn't the order the step lists
  order?: number;
  as?: keyof typeof tags;
  // Off for a second element sharing a unit, so the build order overlay numbers it once
  badge?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
};

export function resolveMotion(deck: Deck, slide: Slide, own?: BlockMotion, fallback?: BlockMotion): ResolvedMotion {
  return {
    style: own?.style ?? slide.motion?.style ?? fallback?.style ?? deck.motion.style,
    direction: own?.direction ?? fallback?.direction ?? 'up',
    speed: slide.motion?.speed ?? deck.motion.speed,
    stagger: own?.stagger ?? slide.motion?.stagger ?? fallback?.stagger ?? deck.motion.stagger,
  };
}

const TimingContext = createContext<{ timing: Timing; style: ResolvedMotion['style'] } | null>(null);

// Wraps one unit. Its laid-out position is always the final one; in present mode it waits
// in the preset's hidden state (still taking its space) until its step plays.
export function Build({ unit, motion: own, fallback, order, as = 'div', badge: showBadge = true, children, onClick, ...rest }: Props) {
  const { mode, deck } = useMode();
  const edit = useEdit();
  const { slide, entered, entering } = useSlide();
  const reduced = useReducedMotion() ?? false;
  const m = resolveMotion(deck, slide, own, fallback);
  const final = mode !== 'present' || entered === 'all' || entered.has(unit);
  const index = entering.get(unit);
  // Units already in place when the slide mounts (stepping back) don't replay
  const instant = useRef(final && index === undefined).current;
  const timing: Timing = { delay: stepDelay(order ?? index ?? 0, m.stagger), duration: duration(m.speed), reduced };
  const Tag = tags[as] as typeof motion.div;

  // In the editor a click selects the block that owns this unit
  const blockId = unit.startsWith('@') ? null : unit.split('/')[0];
  const editable = mode === 'edit' && edit && blockId;
  const badge = editable && showBadge ? edit.buildOrder?.get(unit) : undefined;

  return (
    <TimingContext value={{ timing, style: m.style }}>
      <Tag
        {...(rest as object)}
        data-unit={unit}
        data-block={editable ? blockId : undefined}
        data-selected={editable && edit.selectedBlock === blockId ? '' : undefined}
        onClick={
          editable
            ? (e: MouseEvent<HTMLElement>) => {
                e.stopPropagation();
                edit.select(blockId);
                onClick?.(e);
              }
            : onClick
        }
        variants={variantsFor(m, reduced)}
        custom={timing}
        initial={mode !== 'present' || instant ? false : 'hidden'}
        animate={final ? 'entered' : 'hidden'}
      >
        {children}
        {badge ? <span className="build-badge">{badge}</span> : null}
      </Tag>
    </TimingContext>
  );
}

const drawn: Variants = {
  hidden: { pathLength: 0, transition: { duration: 0 } },
  entered: (t: Timing) => ({ pathLength: 1, transition: { duration: Math.min(t.duration * 1.5, 0.7), delay: t.delay, ease: EASE } }),
};

// Props for an SVG stroke inside a Build: it draws on when the unit's style is Draw
export function useDraw() {
  const ctx = use(TimingContext);
  if (!ctx || ctx.style !== 'draw' || ctx.timing.reduced) return {};
  return { variants: drawn, custom: ctx.timing };
}
