'use client';

import { motion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';
import { canvasSize } from '@/lib/pitch/format';
import type { BlockOf } from '@/lib/pitch/schema';
import { Build, useDraw } from '../canvas/Build';
import { useMode } from '../canvas/ModeProvider';
import { IconGlyph } from './icons';

type Pt = { x: number; y: number };

const RING = 128;
const ICON = 31;
const HALO = 40;

const polar = (c: Pt, deg: number, r: number): Pt => ({
  x: c.x + r * Math.cos((deg * Math.PI) / 180),
  y: c.y + r * Math.sin((deg * Math.PI) / 180),
});

// Places a label beside a point on the ring: centred above or below near the poles, else to one side
function labelAt(c: Pt, deg: number, r: number, width: number): CSSProperties {
  const p = polar(c, deg, r);
  const cos = Math.cos((deg * Math.PI) / 180);
  const sin = Math.sin((deg * Math.PI) / 180);
  if (cos > 0.35) return { left: p.x, top: p.y, width, transform: 'translateY(-50%)', textAlign: 'left' };
  if (cos < -0.35) return { left: p.x - width, top: p.y, width, transform: 'translateY(-50%)', textAlign: 'right' };
  return {
    left: p.x - width / 2,
    top: p.y,
    width,
    transform: sin < 0 ? 'translateY(-100%)' : undefined,
    textAlign: 'center',
  };
}

function Layer({ children }: { children: ReactNode }) {
  const { deck } = useMode();
  const { width, height } = canvasSize(deck.format);
  return (
    <svg className="absolute inset-0" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {children}
    </svg>
  );
}

function Centre({ c, r, label }: { c: Pt; r: number; label: string }) {
  const draw = useDraw();
  return (
    <>
      <Layer>
        <defs>
          <radialGradient id="hub-glow">
            <stop offset="62%" stopColor="var(--deck-glow)" />
            <stop offset="100%" stopColor="var(--deck-glow)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="var(--deck-frame)" strokeWidth={2.5} strokeDasharray="0.1 9" strokeLinecap="round" />
        <circle cx={c.x} cy={c.y} r={RING + 34} fill="url(#hub-glow)" />
        <circle cx={c.x} cy={c.y} r={RING} fill="var(--deck-surface)" />
        <g transform={`rotate(-90 ${c.x} ${c.y})`}>
          <motion.circle cx={c.x} cy={c.y} r={RING} fill="none" stroke="var(--deck-accent)" strokeWidth={11} {...draw} />
        </g>
      </Layer>
      <div className="d-hub-centre absolute" style={{ left: c.x - 110, top: c.y, width: 220, transform: 'translateY(-50%)' }}>
        {label}
      </div>
    </>
  );
}

export function HubDiagram({ block, centre, radius }: { block: BlockOf<'hub-diagram'>; centre: Pt; radius: number }) {
  const n = block.benefits.length;
  const m = block.roles.length;
  const benefitAngle = (i: number) => -90 + (i * 360) / n;
  const roleAngle = (j: number) => -90 + 180 / n + (j * 360) / Math.max(m, 1);

  return (
    <>
      <Build unit={`${block.id}/centre`} motion={block.motion} fallback={{ style: 'draw' }} className="pointer-events-none absolute inset-0">
        <Centre c={centre} r={radius} label={block.centre} />
      </Build>

      {block.benefits.map((b, i) => {
        const deg = benefitAngle(i);
        const p = polar(centre, deg, radius);
        const from = polar(centre, deg, RING + 16);
        const to = polar(centre, deg, radius - HALO - 8);
        const side = Math.abs(Math.cos((deg * Math.PI) / 180)) > 0.35;
        return (
          <Build key={b.id} unit={`${block.id}/${b.id}`} motion={block.motion} fallback={{ style: 'gentle' }} className="pointer-events-none absolute inset-0">
            <Layer>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--deck-accent)" strokeWidth={2.5} strokeDasharray="7 6" />
              <circle cx={p.x} cy={p.y} r={HALO} fill="var(--deck-halo)" />
              <circle cx={p.x} cy={p.y} r={ICON} fill="var(--deck-accent)" />
            </Layer>
            <div className="absolute text-on-accent" style={{ left: p.x - 14, top: p.y - 14 }}>
              <IconGlyph name={b.icon} size={28} />
            </div>
            <div className="d-hub-benefit absolute" style={labelAt(centre, deg, radius + HALO + 16, side ? 190 : 250)}>
              {b.content}
            </div>
          </Build>
        );
      })}

      {block.roles.map((r, j) => {
        const deg = roleAngle(j);
        const q = polar(centre, deg, radius);
        const right = Math.cos((deg * Math.PI) / 180) >= 0;
        return (
          <Build key={r.id} unit={`${block.id}/${r.id}`} motion={block.motion} fallback={{ style: 'gentle' }} className="pointer-events-none absolute inset-0">
            <Layer>
              <circle cx={q.x} cy={q.y} r={8} fill="var(--deck-paper)" stroke="var(--deck-accent)" strokeWidth={2} />
              <circle cx={q.x} cy={q.y} r={3.5} fill="var(--deck-accent)" />
            </Layer>
            <div
              className="d-hub-role absolute"
              style={
                right
                  ? { left: q.x + 18, top: q.y, transform: 'translateY(-50%)' }
                  : { right: canvasRight(q.x - 18), top: q.y, transform: 'translateY(-50%)', textAlign: 'right' }
              }
            >
              {r.content}
            </div>
          </Build>
        );
      })}
    </>
  );
}

// Right offset for a canvas x, so right-aligned labels end at that x
const canvasRight = (x: number) => `calc(100% - ${x}px)`;

// The simple list variant
export function HubList({ block, x, y, width }: { block: BlockOf<'hub-diagram'>; x: number; y: number; width: number }) {
  return (
    <div className="absolute" style={{ left: x, top: y, width }}>
      {block.benefits.map((b) => (
        <Build key={b.id} unit={`${block.id}/${b.id}`} motion={block.motion} className="d-hub-row">
          <span className="d-hub-dot">
            <IconGlyph name={b.icon} size={24} />
          </span>
          <span className="d-hub-benefit">{b.content}</span>
        </Build>
      ))}
      <Build unit={`${block.id}/centre`} motion={block.motion} className="d-hub-roles">
        {block.roles.map((r) => r.content).join(' · ')}
      </Build>
    </div>
  );
}
