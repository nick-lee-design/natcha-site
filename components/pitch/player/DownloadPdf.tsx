'use client';

import { useState } from 'react';

// Shows a short preparing state while a new PDF is made, then starts the download
export function DownloadPdf({
  deckId,
  className = 'pitch-bar-button',
  prepare,
}: {
  deckId: string;
  className?: string;
  // Runs first; the editor saves unsaved changes here
  prepare?: () => Promise<boolean>;
}) {
  const [state, setState] = useState<'idle' | 'preparing' | 'error'>('idle');

  const download = async () => {
    setState('preparing');
    try {
      if (prepare && !(await prepare())) throw new Error();
      const res = await fetch(`/api/pitch/pdf/${deckId}`);
      if (!res.ok) throw new Error();
      const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `${deckId}.pdf`;
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <button type="button" className={className} onClick={download} disabled={state === 'preparing'} aria-live="polite">
      {state === 'preparing' ? 'Preparing your PDF…' : state === 'error' ? 'Try the PDF again' : 'Download PDF'}
    </button>
  );
}
