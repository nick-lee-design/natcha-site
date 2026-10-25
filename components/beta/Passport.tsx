'use client';

import { useState } from 'react';
import { impactOf, obstructions, passportFor } from '@/lib/beta/building';
import type { Model } from '@/lib/beta/model';
import { gbp, longDate } from './format';

// An asset record, opened at the depth of the question being asked
const QUESTIONS = [
  { id: 'what', label: 'What is it?' },
  { id: 'ok', label: 'Is it OK?' },
  { id: 'fails', label: 'If it fails?' },
  { id: 'replace', label: 'Replace it' },
] as const;
type Q = (typeof QUESTIONS)[number]['id'];

export default function Passport({ model, i, onShow, start = 'what' }: {
  model: Model; i: number; start?: Q;
  onShow?: (ids: number[], tone: 'alert' | 'warn') => void;
}) {
  const [q, setQ] = useState<Q>(start);
  const e = model.elements[i];
  const p = passportFor(model, i);
  const impact = q === 'fails' ? impactOf(model, i) : null;
  const blocked = q === 'ok' ? obstructions(model, i) : [];

  return (
    <article className="passport">
      <header>
        <span className="mono tag">{p.mark}</span>
        <h3>{p.name}</h3>
        <span className={`cond is-${p.condition.toLowerCase()}`}>{p.condition}</span>
      </header>
      <div className="qtabs" role="tablist">
        {QUESTIONS.map((x) => (
          <button key={x.id} role="tab" aria-selected={q === x.id} onClick={() => setQ(x.id)}>{x.label}</button>
        ))}
      </div>

      {q === 'what' && (
        <dl className="kv">
          <dt>Maker</dt><dd>{p.maker}</dd>
          <dt>Product</dt><dd>{p.product}</dd>
          <dt>Size</dt><dd className="mono">{e.z}</dd>
          <dt>Serial</dt><dd className="mono">{p.serial}</dd>
          <dt>Installed</dt><dd>{longDate(p.installed)}</dd>
          <dt>Warranty</dt><dd>to {longDate(p.warranty)}</dd>
          {p.documents.length > 0 && <><dt>Documents</dt><dd><ul className="docs">{p.documents.map((d) => <li key={d}>{d}</li>)}</ul></dd></>}
        </dl>
      )}

      {q === 'ok' && (
        <div className="stack">
          <dl className="kv">
            {p.dutyNote && <><dt>Duty</dt><dd>{p.dutyNote}</dd></>}
            {p.lastService && <><dt>Last checked</dt><dd>{longDate(p.lastService)}</dd></>}
            {p.nextDue && <><dt>Next due</dt><dd>{longDate(p.nextDue)}</dd></>}
            <dt>Access</dt>
            <dd>
              {blocked.length === 0 ? 'Clear from the ceiling below' : (
                <button className="linkish" onClick={() => onShow?.(blocked, 'warn')}>
                  Blocked by {blocked.slice(0, 3).map((b) => model.elements[b].m).join(', ')}{blocked.length > 3 ? ` and ${blocked.length - 3} more` : ''}
                </button>
              )}
            </dd>
          </dl>
          <ol className="history">
            {p.history.map((h) => (
              <li key={h.date + h.text}><span className="mono">{longDate(h.date)}</span>{h.text}<small>{h.by}</small></li>
            ))}
          </ol>
        </div>
      )}

      {q === 'fails' && (
        impact ? (
          <div className="stack">
            <p className="bm-lead"><strong>{impact.spaces.length}</strong> {impact.spaces.length === 1 ? 'space depends' : 'spaces depend'} on it through {impact.sys.short.toLowerCase()}, and <strong>{impact.els.size - 1}</strong> {impact.els.size === 2 ? 'part' : 'parts'} downstream.</p>
            <div className="chips">{impact.spaces.map((s) => <span key={s.id} className="chip">{s.name}</span>)}</div>
            <button className="btn-s" onClick={() => onShow?.([...impact.els], 'alert')}>Show the knock-on</button>
          </div>
        ) : <p className="muted">Not part of a traced system. Nothing downstream depends on it.</p>
      )}

      {q === 'replace' && (
        p.replace.alternatives.length ? (
          <div className="stack">
            <dl className="kv"><dt>Expected life</dt><dd>{p.replace.life}</dd></dl>
            <ul className="alts">
              {p.replace.alternatives.map((a) => (
                <li key={a.product}>
                  <div className="alt-head"><span>{a.maker} {a.product}</span><span className="mono">{gbp(a.price)}</span></div>
                  <small>{a.lead}</small>
                  <ul className="checks">{a.checks.map((c) => <li key={c.text} className={c.ok ? 'ok' : 'no'}>{c.text}</li>)}</ul>
                </li>
              ))}
            </ul>
          </div>
        ) : <p className="muted">Stock item, replaced like for like by the contractor.</p>
      )}
    </article>
  );
}
