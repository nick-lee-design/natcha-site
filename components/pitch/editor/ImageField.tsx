'use client';

import { useRef, useState } from 'react';
import { imageFromUrl, uploadImage, type Picked } from './upload';

// Replace an image by upload or by URL
export function ImageField({ deckId, src, onPick }: { deckId: string; src: string; onPick: (p: Picked) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});

  const run = async (job: () => Promise<Picked>) => {
    setState({ busy: true });
    try {
      onPick(await job());
      setState({});
      setUrl('');
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  };

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="aspect-video w-full rounded-lg border border-stone-200 bg-stone-50 object-contain" />
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && run(() => uploadImage(deckId, e.target.files![0]))} />
      <button type="button" className="ui-button w-full" disabled={state.busy} onClick={() => file.current?.click()}>
        {state.busy ? 'Uploading…' : 'Upload an image'}
      </button>
      <div className="flex gap-2">
        <input className="ui-input" placeholder="Or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="ui-button" disabled={!url || state.busy} onClick={() => run(() => imageFromUrl(url))}>
          Use
        </button>
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
    </div>
  );
}
