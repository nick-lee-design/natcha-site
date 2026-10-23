'use client';

import type { ReactNode } from 'react';
import { useMode, useSlide } from './ModeProvider';

type Tone = 'dark' | 'light';

// The base layout for content slides: a thin inset frame, the page count and the wordmark
export function ContentFrame({
  children,
  numberTone = 'dark',
  wordmarkTone = 'dark',
}: {
  children: ReactNode;
  numberTone?: Tone;
  wordmarkTone?: Tone;
}) {
  const { theme } = useMode();
  const { index, total } = useSlide();
  const { frame, margin } = theme.space;
  return (
    <>
      {children}
      <div className="pointer-events-none absolute border-[1.5px] border-frame" style={{ inset: frame }} />
      <div className={`d-folio absolute ${numberTone === 'light' ? 'text-white/80' : 'text-muted'}`} style={{ left: margin, bottom: frame + 14 }}>
        {index + 1} of {total}
      </div>
      <div className={`d-wordmark absolute ${wordmarkTone === 'light' ? 'text-white' : 'text-accent'}`} style={{ right: margin, bottom: frame + 14 }}>
        {theme.wordmark}
      </div>
    </>
  );
}
