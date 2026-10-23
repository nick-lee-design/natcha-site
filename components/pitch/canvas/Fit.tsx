'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const STEP = 0.05;

// A text slot with a maximum size. When its content runs past that size the font
// steps down (through --fit, which slot type sizes multiply by) until it fits or
// reaches the template's floor. Measures layout boxes only, so builds in progress
// (which move by transform) never change the result, and print matches the screen.
export function Fit({
  children,
  style,
  className = '',
  floor = 0.75,
  watch,
}: {
  children: ReactNode;
  style: CSSProperties;
  className?: string;
  floor?: number;
  // Changes when the slot's content changes
  watch?: unknown;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);

  useLayoutEffect(() => {
    let live = true;
    const measure = () => {
      const o = outer.current;
      const i = inner.current;
      if (!o || !i || !live) return;
      let fit = 1;
      o.style.setProperty('--fit', '1');
      while (i.offsetHeight > o.clientHeight && fit - STEP >= floor - 1e-6) {
        fit = Math.round((fit - STEP) * 100) / 100;
        o.style.setProperty('--fit', String(fit));
      }
      setOver(i.offsetHeight > o.clientHeight);
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      live = false;
    };
  }, [watch, floor]);

  return (
    <div ref={outer} className={`absolute ${className}`} style={style} data-overflow={over || undefined}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
