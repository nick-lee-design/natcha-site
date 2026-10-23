'use client';

import type { ReactNode } from 'react';
import type { BlockMotion, BlockOf } from '@/lib/pitch/schema';
import { Build } from '../canvas/Build';
import { box, type Rect } from '../canvas/geometry';

// Where a contained image lands inside its box. Overlays (like plan markers) use the same rect.
export function containRect(img: { width: number; height: number }, area: Rect, ax = 0.5, ay = 0.5): Rect {
  const s = Math.min(area.w / img.width, area.h / img.height);
  const w = img.width * s;
  const h = img.height * s;
  return { x: area.x + (area.w - w) * ax, y: area.y + (area.h - h) * ay, w, h };
}

export function Picture({
  block,
  area,
  align = [0.5, 0.5],
  fallback,
  className = '',
  children,
}: {
  block: BlockOf<'image'>;
  area: Rect;
  align?: [number, number];
  fallback?: BlockMotion;
  className?: string;
  children?: ReactNode;
}) {
  const r = block.fit === 'cover' ? area : containRect(block, area, align[0], align[1]);
  return (
    <Build
      unit={block.id}
      motion={block.motion}
      fallback={fallback}
      className={`${block.fit === 'cover' ? 'overflow-hidden ' : ''}${className}`}
      style={box(r.x, r.y, r.w, r.h)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- print needs the plain element */}
      <img src={block.src} alt={block.alt} className="block size-full object-cover" draggable={false} />
      {children}
    </Build>
  );
}
