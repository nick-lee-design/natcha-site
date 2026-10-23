'use client';

import { useEffect, useRef, useState } from 'react';
import { useMode } from '../canvas/ModeProvider';
import { createAssembly } from './scene';

// Where the structure sits on the 1600 × 900 canvas: right of the cover text, pulled back to fit
export const ASSEMBLY_FRAME = { shift: 0.16, zoom: 0.68 };
// The assembled state, rendered by `npm run assembly-still`. Print, thumbnails and the editor use it.
export const ASSEMBLY_STILL = '/pitch-assets/living-assembly.jpg';

// Live in present mode, the still everywhere else (and when WebGL isn't available)
export function LivingAssembly() {
  const { mode } = useMode();
  const host = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const live = mode === 'present' && !failed;

  useEffect(() => {
    const el = host.current;
    if (!live || !el) return;
    // A fresh canvas per mount: a disposed renderer loses its context, and the canvas with it
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 size-full';
    el.prepend(canvas);
    const scene = createAssembly(canvas, { frame: ASSEMBLY_FRAME, marker: marker.current });
    if (!scene) {
      canvas.remove();
      setFailed(true);
      return;
    }
    return () => {
      scene.dispose();
      canvas.remove();
    };
  }, [live]);

  return (
    <div ref={host} className="d-assembly absolute inset-0" data-assembly={live ? 'live' : 'still'}>
      {live ? (
        <div ref={marker} className="d-assembly-snap" aria-hidden>
          <svg viewBox="-10 -10 20 20">
            <path className="mid" d="M0 -6.5 L6.5 5 L-6.5 5 Z" />
            <circle className="cen" r="6" />
            <rect className="end" x="-5.5" y="-5.5" width="11" height="11" />
          </svg>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ASSEMBLY_STILL} alt="" className="absolute inset-0 size-full" draggable={false} />
      )}
    </div>
  );
}
