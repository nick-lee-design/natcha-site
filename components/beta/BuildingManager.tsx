'use client';

import { useEffect, useState } from 'react';
import { loadModel, type Model } from '@/lib/beta/model';
import Situations from './Situations';
import Systems from './Systems';
import Timeline from './Timeline';

const APPROACHES = [
  { id: 'situations', label: 'Situations', View: Situations },
  { id: 'systems', label: 'Systems', View: Systems },
  { id: 'timeline', label: 'Timeline', View: Timeline },
] as const;
type Id = (typeof APPROACHES)[number]['id'];

export default function BuildingManager() {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approach, setApproach] = useState<Id>('situations');

  useEffect(() => {
    const a = new URLSearchParams(location.search).get('approach');
    if (APPROACHES.some((x) => x.id === a)) setApproach(a as Id);
    loadModel().then(setModel, (e: Error) => setError(e.message));
  }, []);

  function go(id: Id) {
    setApproach(id);
    history.replaceState(null, '', `?approach=${id}`);
  }

  const { View } = APPROACHES.find((x) => x.id === approach)!;

  return (
    <div className="bm">
      <div className="bm-bar">
        <h1>Building manager</h1>
        <div className="bm-tabs" role="tablist" aria-label="Approach">
          {APPROACHES.map((a, k) => (
            <button key={a.id} role="tab" aria-selected={approach === a.id} onClick={() => go(a.id)}>
              <span className="mono">{k + 1}</span>{a.label}
            </button>
          ))}
        </div>
        <span className="bm-sample">NCW corridor · sample data</span>
      </div>
      {model ? <View model={model} /> : <div className="bm-loading">{error ? `The model didn’t load: ${error}` : 'Loading the model'}</div>}
    </div>
  );
}
