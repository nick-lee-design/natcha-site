import type { CSSProperties } from 'react';

// Absolute placement in canvas pixels
export function box(x: number, y: number, w?: number, h?: number): CSSProperties {
  return { position: 'absolute', left: x, top: y, width: w, height: h };
}

export type Rect = { x: number; y: number; w: number; h: number };
