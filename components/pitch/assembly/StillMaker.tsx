'use client';

import { useEffect, useRef } from 'react';
import { ASSEMBLY_FRAME } from './LivingAssembly';
import { createAssembly } from './scene';

export const STILL_SIZE = { width: 2560, height: 1440 };

// Draws the assembled state once and exposes it as a JPEG data URL on data-still
export function StillMaker() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || el.dataset.still) return;
    const scene = createAssembly(el, { still: true, size: STILL_SIZE, frame: ASSEMBLY_FRAME });
    el.dataset.still = scene ? el.toDataURL('image/jpeg', 0.9) : 'failed';
    scene?.dispose();
  }, []);

  return <canvas ref={canvas} style={{ width: 1600, height: 900, display: 'block' }} />;
}
