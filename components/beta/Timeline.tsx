'use client';

import { useMemo, useRef, useState } from 'react';
import { MOMENTS, ROUTES, TODAY, installDate, routeConflicts, membersOf, systemById, systemOf, type Moment, type SystemId } from '@/lib/beta/building';
import { byMark, type Model } from '@/lib/beta/model';
import { longDate, shortDate } from './format';
import ModelView, { type ModelHandle, type Overlay, type Tone } from './ModelView';
import { useThreads } from './store';
import ThreadView from './ThreadView';

// Approach 3: the building as a history. Scrub through design, build and operation, compare
// two moments, and keep engineering reviews pinned to the moment and view they concern.
const START = Date.UTC(2025, 0, 1);
const END = Date.UTC(2027, 5, 30);
const DAY = 86_400_000;
const dayOf = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - START) / DAY);
const isoOf = (d: number) => new Date(START + d * DAY).toISOString().slice(0, 10);
const SPAN = Math.round((END - START) / DAY);
const TRACKS: Moment['track'][] = ['Design', 'Build', 'Operate', 'Change'];
const DESIGNED = dayOf('2025-07-14');
const YEARS = ['2025', '2026', '2027'];

const pct = (d: number) => `${(d / SPAN) * 100}%`;

export default function Timeline({ model }: { model: Model }) {
  const [at, setAt] = useState(dayOf(TODAY));
  const [from, setFrom] = useState<number | null>(null); // compare start
  const [moment, setMoment] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<string | null>(null);
  const view = useRef<ModelHandle>(null);
  const { threads, raise } = useThreads();

  const m = MOMENTS.find((x) => x.id === moment) ?? null;
  const momentEls = (x: Moment) => [
    ...(x.marks ?? []).map((mk) => byMark(model, mk).i),
    ...(x.systems ?? []).flatMap((s: SystemId) => membersOf(model, systemById(s))),
  ];
  const installed = (i: number) => {
    const e = model.elements[i];
    if (e.s !== 'MEP') return 0;
    return dayOf(installDate(systemOf(model, i)?.id));
  };

  const { tones, overlays, counts } = useMemo(() => {
    const t = new Map<number, Tone>();
    const ov: Overlay[] = [];
    let added = 0, changed = 0;
    for (const e of model.elements) {
      const d = installed(e.i);
      if (from !== null) {
        if (d > at) t.set(e.i, at < DESIGNED ? 'hidden' : 'ghost');
        else if (d > from) { t.set(e.i, 'ok'); added++; }
        else t.set(e.i, 'ghost');
      } else if (d > at) t.set(e.i, at >= DESIGNED ? 'ghost' : 'hidden');
    }
    const lo = from ?? -1;
    for (const x of MOMENTS) {
      const d = dayOf(x.date);
      if (from !== null && d > lo && d <= at && x.track !== 'Build') for (const i of momentEls(x)) { if (t.get(i) !== 'ok') { t.set(i, 'warn'); changed++; } }
      if (x.planned && d <= at && d > dayOf(TODAY) && from === null) for (const i of momentEls(x)) t.set(i, 'info');
    }
    // Proposed routes show once their moment is in view, or when a proposal is opened
    const r110 = dayOf('2027-01-18');
    const shown = proposal ? [proposal] : at >= r110 ? ['high', 'low'] : [];
    if (proposal) for (const i of routeConflicts(model, ROUTES[proposal as 'high' | 'low'])) t.set(i, 'warn');
    for (const p of shown) ov.push({ box: ROUTES[p as 'high' | 'low'], colour: p === 'high' ? '#8EC5FF' : '#C4A0FF', dashed: !proposal });
    if (m && from === null) for (const i of momentEls(m)) t.set(i, 'focus');
    return { tones: t, overlays: ov, counts: { added, changed } };
  }, [model, at, from, m, proposal]); // eslint-disable-line react-hooks/exhaustive-deps

  const thread = threads.find((t) => t.id === threadId) ?? null;
  const mEls = m ? momentEls(m) : [];
  const frame = proposal ? { box: ROUTES[proposal as 'high' | 'low'], ids: routeConflicts(model, ROUTES[proposal as 'high' | 'low']) } : mEls.length ? { ids: mEls } : null;

  function openMoment(x: Moment) {
    const closing = x.id === moment;
    setMoment(closing ? null : x.id);
    if (!closing) setAt(Math.max(dayOf(x.date), from ?? 0));
    setProposal(null);
    const t = threads.find((th) => th.moment === x.id);
    setThreadId(t?.id ?? null);
  }

  function newThread() {
    const id = raise({
      title: m ? m.title : `Question about ${longDate(isoOf(at))}`, moment: m?.id,
      posts: [{ who: 'manager', name: 'Facilities manager', date: TODAY, text: m ? `About “${m.title}”: can you take a look?` : 'Can you take a look at this?', view: view.current?.getView(), marks: m?.marks }],
    });
    setThreadId(id);
  }

  return (
    <div className="ap ap-timeline">
      <section className="stage">
        <ModelView ref={view} model={model} tones={tones} rest={proposal ? 'ghost' : 'base'} overlays={overlays} frame={frame} frameKey={`${moment}|${proposal}`}
          onPick={(i) => { if (i === null) return; const x = MOMENTS.find((mm) => mm.marks?.includes(model.elements[i].m) || mm.systems?.includes(systemOf(model, i)?.id as SystemId)); if (x) openMoment(x); }} />
        <div className="stage-caption">
          <strong>{from === null ? longDate(isoOf(at)) : `${shortDate(isoOf(from))} → ${shortDate(isoOf(at))}`}</strong>
          {from !== null ? <span><i className="key is-ok" />{counts.added} added <i className="key is-warn" />{counts.changed} worked on</span>
            : at > dayOf(TODAY) ? <span><i className="key is-info" />Planned</span>
            : at < DESIGNED ? <span>Before coordination</span> : null}
        </div>
      </section>

      <aside className="side">
        <div className="side-head">
          <h3>Reviews</h3>
          <button className="btn-s" onClick={newThread}>New review</button>
        </div>
        {thread ? (
          <div className="stack">
            <button className="linkish" onClick={() => { setThreadId(null); setProposal(null); }}>All reviews</button>
            <h4 className="thread-title">{thread.title} <span className={`status is-${thread.status.toLowerCase()}`}>{thread.status}</span></h4>
            <ThreadView thread={thread} capture={() => view.current!.getView()} activeProposal={proposal}
              onProposal={setProposal}
              onView={(v) => v && view.current?.setView(v)} />
          </div>
        ) : (
          <ul className="threads">
            {threads.map((t) => (
              <li key={t.id}>
                <button onClick={() => {
                  setThreadId(t.id);
                  const x = MOMENTS.find((mm) => mm.id === t.moment);
                  if (x) { setMoment(x.id); setAt(dayOf(x.date)); }
                  const v = t.posts.find((p) => p.view)?.view;
                  if (v) view.current?.setView(v);
                }}>
                  <span>{t.title}</span>
                  <small><span className={`status is-${t.status.toLowerCase()}`}>{t.status}</span> {t.posts.length} {t.posts.length === 1 ? 'post' : 'posts'}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {m && !thread && (
          <div className="moment-card">
            <span className="mono">{longDate(m.date)}</span>
            <h4>{m.title}</h4>
            {m.detail && <p>{m.detail}</p>}
          </div>
        )}
      </aside>

      <section className="timeline">
        <div className="tl-controls">
          <button className={`btn-s${from !== null ? ' is-on' : ''}`} aria-pressed={from !== null} onClick={() => setFrom(from === null ? dayOf('2025-08-01') : null)}>
            Compare{from !== null ? ` from ${shortDate(isoOf(from))}` : ''}
          </button>
          <button className="btn-s" onClick={() => { setAt(dayOf(TODAY)); setMoment(null); }}>Today</button>
          </div>
        <div className="tl">
          <div className="tl-years">{YEARS.map((y) => <span key={y} style={{ left: pct(dayOf(`${y}-01-01`)) }}>{y}</span>)}</div>
          {TRACKS.map((track) => (
            <div key={track} className="tl-track">
              <span className="tl-label">{track}</span>
              <div className="tl-lane">
                {MOMENTS.filter((x) => x.track === track).map((x) => (
                  <button key={x.id} className={`tl-dot${x.planned ? ' is-planned' : ''}${moment === x.id ? ' is-on' : ''}${threads.some((t) => t.moment === x.id) ? ' has-thread' : ''}`}
                    style={{ left: pct(dayOf(x.date)) }} onClick={() => openMoment(x)} title={`${shortDate(x.date)} ${x.title}`}>
                    <span className="sr-only">{x.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="tl-overlay">
            {from !== null && <div className="tl-range" style={{ left: pct(from), width: pct(Math.max(at - from, 0)) }} />}
            <div className="tl-today" style={{ left: pct(dayOf(TODAY)) }} />
            <div className="tl-head" style={{ left: pct(at) }} />
          </div>
          <input className="tl-scrub" type="range" min={0} max={SPAN} value={at} aria-label="Point in time"
            onChange={(e) => { setAt(+e.target.value); setMoment(null); }} />
          {from !== null && (
            <input className="tl-scrub is-from" type="range" min={0} max={SPAN} value={from} aria-label="Compare from"
              onChange={(e) => setFrom(Math.min(+e.target.value, at))} />
          )}
        </div>
      </section>
    </div>
  );
}
