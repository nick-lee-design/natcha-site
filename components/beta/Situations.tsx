'use client';

import { useMemo, useRef, useState } from 'react';
import {
  PASSPORTS, ROUTES, SITUATIONS, SPACES, SYSTEMS, accessZone, entriesOf, membersOf, obstructions, routeConflicts, savings,
  servicesTo, systemById, systemOf, type Situation,
} from '@/lib/beta/building';
import { byMark, type Model } from '@/lib/beta/model';
import { gbp, longDate } from './format';
import ModelView, { type Frame, type ModelHandle, type Overlay, type Pin, type Tone } from './ModelView';
import Passport from './Passport';
import { useThreads } from './store';
import ThreadView from './ThreadView';

// Approach 1: start from what is happening in the building, not from a part in 3D
type Focus = { kind: 'situation'; id: string } | { kind: 'space'; id: string } | { kind: 'asset'; i: number };

const tonesOf = (groups: [number[], Tone][]) => {
  const m = new Map<number, Tone>();
  for (const [ids, tone] of groups) for (const i of ids) m.set(i, tone);
  return m;
};

const lengthOf = (z: string) => Number(z.match(/(\d+) long/)?.[1] ?? 0);

export default function Situations({ model }: { model: Model }) {
  const [focus, setFocus] = useState<Focus>({ kind: 'situation', id: 'pump' });
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [peek, setPeek] = useState<{ ids: number[]; tone: Tone } | null>(null);
  const [damper, setDamper] = useState<string | null>(null);
  const view = useRef<ModelHandle>(null);
  const { threads, raise } = useThreads();

  const open = (f: Focus) => { setFocus(f); setPeek(null); setDamper(null); setQuery(''); };

  /* ---------- ask ---------- */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const words = q.split(/\s+/).filter((w) => !['what', 'the', 'is', 'a', 'of', 'to', 'for', 'which', 'does', 'serves', 'serve', 'room'].includes(w));
    const score = (text: string) => words.filter((w) => text.toLowerCase().includes(w)).length;
    const out: { key: string; label: string; hint: string; s: number; go: Focus }[] = [];
    for (const s of SITUATIONS) out.push({ key: s.id, label: s.title, hint: s.when, s: score(`${s.title} ${s.summary}`), go: { kind: 'situation', id: s.id } });
    for (const s of SPACES) if (s.kind === 'room' || s.kind === 'riser') out.push({ key: s.id, label: `What serves ${s.name}`, hint: 'Space', s: score(`${s.name} ${s.id}`) * 1.5, go: { kind: 'space', id: s.id } });
    for (const e of model.elements) if (e.s === 'MEP' && e.k === 'family') out.push({ key: e.m, label: `${e.m} ${e.c}`, hint: systemOf(model, e.i)?.short ?? 'Part', s: score(`${e.m} ${e.c} ${e.f ?? ''}`), go: { kind: 'asset', i: e.i } });
    return out.filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 7);
  }, [query, model]);

  /* ---------- what the case shows ---------- */
  const sit = focus.kind === 'situation' ? SITUATIONS.find((s) => s.id === focus.id)! : null;
  const caseView = useMemo(() => {
    const overlays: Overlay[] = [];
    const pins: Pin[] = [];
    let tones = new Map<number, Tone>();
    let ids: number[] = [];

    if (sit?.id === 'pump') {
      ids = membersOf(model, systemById('hw'));
      const entries = entriesOf(model, new Set(ids));
      tones = tonesOf([[ids, 'alert']]);
      for (const e of entries) {
        const at = model.elements[e.holes[0] ?? e.branch[0]].b;
        if (e.space.kind === 'room') pins.push({ id: e.space.id, at: [at[3], (at[1] + at[4]) / 2, at[5]], label: e.space.id, tone: 'warn', onClick: () => open({ kind: 'space', id: e.space.id }) });
      }
    } else if (sit?.id === 'inspect' || sit?.id === 'replace') {
      const marks = sit.id === 'replace' ? ['FD-03'] : sit.marks;
      const ds = marks.map((m) => byMark(model, m));
      const show = damper ? [byMark(model, damper)] : ds;
      const blocked = show.flatMap((d) => obstructions(model, d.i));
      ids = show.map((d) => d.i);
      tones = tonesOf([[blocked, 'warn'], [ds.map((d) => d.i), 'focus']]);
      for (const d of show) overlays.push({ box: accessZone(d.b), colour: obstructions(model, d.i).length ? '#FFB224' : '#46C37B', dashed: true });
      for (const d of ds) pins.push({ id: d.m, at: [d.b[0], d.b[1], d.b[5]], label: d.m, tone: PASSPORTS[d.m]?.condition === 'Failed' ? 'alert' : obstructions(model, d.i).length ? 'warn' : 'ok', onClick: () => setDamper(d.m) });
    } else if (sit?.id === 'modify') {
      const pick = (choice.modify ?? 'high') as 'high' | 'low';
      const hits = routeConflicts(model, ROUTES[pick]);
      overlays.push({ box: ROUTES[pick], colour: '#8EC5FF' });
      tones = tonesOf([[hits, 'warn']]);
      return { tones, frame: { box: ROUTES[pick], ids: hits } as Frame, overlays, pins, rest: 'ghost' as Tone };
    } else if (sit?.id === 'cost') {
      const s = savings(model);
      tones = tonesOf([[s.lights, 'warn'], [s.pirs, 'ok'], [s.bare, 'alert']]);
      ids = [...s.lights, ...s.bare];
    } else if (focus.kind === 'space') {
      const sv = servicesTo(model, focus.id);
      ids = sv.flatMap(({ entry }) => [...entry.holes, ...entry.branch]);
      tones = tonesOf([[sv.flatMap(({ entry }) => entry.branch), 'focus'], [sv.flatMap(({ entry }) => entry.holes), 'warn']]);
      const space = SPACES.find((s) => s.id === focus.id)!;
      overlays.push({ box: space.box, colour: '#8EC5FF', dashed: true });
      return { tones, frame: { box: [space.box[0], space.box[1], model.bmin[2], space.box[3], space.box[4], model.bmax[2]], ids } as Frame, overlays, pins, rest: 'ghost' as Tone };
    } else if (focus.kind === 'asset') {
      ids = [focus.i];
      tones = tonesOf([[obstructions(model, focus.i), 'warn']]);
      overlays.push({ box: accessZone(model.elements[focus.i].b), colour: '#8EC5FF', dashed: true });
    }
    if (peek) { tones = tonesOf([[peek.ids, peek.tone], ...(focus.kind === 'asset' ? [[[focus.i], 'focus'] as [number[], Tone]] : [])]); ids = peek.ids; }
    return { tones, frame: { ids } as Frame, overlays, pins, rest: 'ghost' as Tone };
  }, [model, sit, focus, choice, peek, damper]);

  const frameKey = JSON.stringify([focus, choice.modify, peek?.ids.length, damper]);
  const thread = sit ? threads.find((t) => t.situation === sit.id) : undefined;

  function ask(s: Situation) {
    const opt = s.options.find((o) => o.id === choice[s.id]);
    raise({
      title: s.title, situation: s.id,
      posts: [{
        who: 'manager', name: 'Facilities manager', date: '2026-10-25',
        text: opt ? `${s.summary} We’re leaning towards: ${opt.title}. Can you check it?` : `${s.summary} What do you recommend?`,
        marks: s.marks, view: view.current?.getView(),
      }],
    });
  }

  return (
    <div className="ap ap-situations">
      <aside className="rail">
        <div className="ask">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask about a room, part or problem" aria-label="Ask about the building" />
          {results.length > 0 && (
            <ul className="results">
              {results.map((r) => (
                <li key={r.key}><button onClick={() => open(r.go)}><span>{r.label}</span><small>{r.hint}</small></button></li>
              ))}
            </ul>
          )}
        </div>
        {(['Now', 'This week', 'Planned', 'Opportunity'] as const).map((when) => (
          <section key={when} className="rail-group">
            <h4>{when}</h4>
            <ul>
              {SITUATIONS.filter((s) => s.when === when).map((s) => (
                <li key={s.id}>
                  <button className={`sit is-${s.tone}${sit?.id === s.id ? ' is-on' : ''}`} onClick={() => open({ kind: 'situation', id: s.id })}>
                    <span className="dot" />{s.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </aside>

      <section className="bm-case">
        {sit && (
          <>
            <header className="case-head">
              <span className={`when is-${sit.tone}`}>{sit.when}</span>
              <h2>{sit.title}</h2>
              <p>{sit.summary}</p>
            </header>
            <Evidence sit={sit} model={model} damper={damper} setDamper={setDamper} choice={choice.modify} onAsset={(i) => open({ kind: 'asset', i })} />
            <section className="block">
              <h3>Decide</h3>
              <ul className="options">
                {sit.options.map((o) => {
                  const hits = sit.id === 'modify' ? routeConflicts(model, ROUTES[o.id as 'high' | 'low']) : null;
                  const restricted = sit.id === 'inspect' ? sit.marks.filter((m) => obstructions(model, byMark(model, m).i).length).length : 0;
                  const checks = hits ? [{ ok: hits.length < 6, text: `Crosses ${hits.length} parts of existing services` }, ...o.checks]
                    : o.checks.map((c) => (c.text === 'Two dampers have restricted access' ? { ...c, text: `${restricted} of ${sit.marks.length} dampers have restricted access` } : c));
                  return (
                    <li key={o.id}>
                      <button className={`option${choice[sit.id] === o.id ? ' is-on' : ''}`} onClick={() => setChoice({ ...choice, [sit.id]: o.id })} aria-pressed={choice[sit.id] === o.id}>
                        <span className="opt-title">{o.title}</span>
                        <span className="opt-facts"><span className="mono">{gbp(o.cost)}</span><span>{o.time}</span><span>{o.disruption === 'None' ? 'No' : o.disruption} disruption</span></span>
                        <ul className="checks">{checks.map((c) => <li key={c.text} className={c.ok ? 'ok' : 'no'}>{c.text}</li>)}</ul>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="block">
              <h3>Engineering review</h3>
              {thread ? (
                <ThreadView thread={thread} capture={() => view.current!.getView()}
                  onView={(v, marks) => { if (v) view.current?.setView(v); if (marks?.length) setPeek({ ids: marks.map((m) => byMark(model, m).i), tone: 'warn' }); }}
                  activeProposal={sit.id === 'modify' ? choice.modify : null}
                  onProposal={(id) => id && setChoice({ ...choice, modify: id })} />
              ) : (
                <button className="btn-p" onClick={() => ask(sit)}>Ask engineering to review</button>
              )}
            </section>
          </>
        )}
        {focus.kind === 'space' && <SpaceCase model={model} id={focus.id} onAsset={(i) => open({ kind: 'asset', i })} />}
        {focus.kind === 'asset' && (
          <Passport key={focus.i} model={model} i={focus.i} onShow={(ids, tone) => setPeek({ ids, tone })} />
        )}
      </section>

      <section className="stage">
        <ModelView ref={view} model={model} tones={caseView.tones} rest={caseView.rest} overlays={caseView.overlays} pins={caseView.pins}
          frame={caseView.frame} frameKey={frameKey}
          selected={focus.kind === 'asset' ? focus.i : null}
          onPick={(i) => i !== null && open({ kind: 'asset', i })} />
      </section>
    </div>
  );
}

function Evidence({ sit, model, damper, setDamper, choice, onAsset }: {
  sit: Situation; model: Model; damper: string | null; setDamper: (m: string | null) => void; choice?: string; onAsset: (i: number) => void;
}) {
  if (sit.id === 'pump') {
    const p = PASSPORTS['PU-HW-02'];
    const ids = membersOf(model, systemById('hw'));
    const entries = entriesOf(model, new Set(ids));
    const rooms = entries.filter((e) => e.space.kind === 'room').map((e) => e.space.id);
    const onward = entries.some((e) => e.space.kind === 'beyond');
    return (
      <section className="block">
        <h3>What it affects</h3>
        <ol className="chain">
          <li><strong>{p.maker} {p.product}</strong><small>Basement plant room · {p.condition}</small></li>
          <li><strong>Standby PU-HW-01</strong><small>Running, no backup left</small></li>
          <li><strong>Riser 2</strong><small>Flow and return to Level 1</small></li>
          <li><strong>{ids.length} parts in this corridor</strong><small>Copper, press-fit</small></li>
          <li><strong>{rooms.length} bedrooms branch off here</strong><small>{rooms.join(', ')}{onward ? ', then on to the east wing' : ''}</small></li>
        </ol>
        <p className="note">If the standby fails too, return water drops below 50 °C within hours, a Legionella risk under ACoP L8.</p>
        <ol className="history compact">
          {p.history.slice(0, 2).map((h) => <li key={h.date}><span className="mono">{longDate(h.date)}</span>{h.text}</li>)}
        </ol>
      </section>
    );
  }
  if (sit.id === 'inspect' || sit.id === 'replace') {
    const marks = sit.id === 'replace' ? ['FD-03'] : sit.marks;
    return (
      <section className="block">
        <h3>{sit.id === 'replace' ? 'Where it is' : 'Access from the ceiling'}</h3>
        <ul className="bm-rows">
          {marks.map((m) => {
            const d = byMark(model, m);
            const blocked = obstructions(model, d.i);
            const p = PASSPORTS[m];
            return (
              <li key={m}>
                <button className={`bm-row${damper === m ? ' is-on' : ''}`} onClick={() => setDamper(damper === m ? null : m)}>
                  <span className="mono tag">{m}</span>
                  <span className="row-main">{blocked.length ? `Blocked by ${blocked.map((b) => model.elements[b].m).slice(0, 3).join(', ')}` : 'Clear'}<small>{p.condition}, tested {longDate(p.lastService!)}</small></span>
                  <span className={`state is-${blocked.length ? 'warn' : 'ok'}`}>{blocked.length ? 'Restricted' : 'Clear'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {sit.id === 'replace' && <button className="linkish" onClick={() => onAsset(byMark(model, 'FD-03').i)}>Open the FD-03 record</button>}
      </section>
    );
  }
  if (sit.id === 'modify') {
    const pick = (choice ?? 'high') as 'high' | 'low';
    const hits = routeConflicts(model, ROUTES[pick]);
    const bySys = new Map<string, number>();
    for (const h of hits) { const s = systemOf(model, h)?.short ?? model.elements[h].c; bySys.set(s, (bySys.get(s) ?? 0) + 1); }
    return (
      <section className="block">
        <h3>What the new duct crosses</h3>
        <p className="bm-lead">Route {pick === 'high' ? 'A' : 'B'} meets <strong>{hits.length}</strong> parts of existing services.</p>
        <div className="chips">{[...bySys].map(([s, n]) => <span key={s} className="chip">{s} <span className="mono">{n}</span></span>)}</div>
      </section>
    );
  }
  if (sit.id === 'cost') {
    const s = savings(model);
    const metres = s.bare.reduce((a, i) => a + lengthOf(model.elements[i].z), 0) / 1000;
    return (
      <section className="block">
        <h3>Where the waste is</h3>
        <ul className="figures">
          <li><span className="big">{s.lights.length}</span><span>light fittings on all night</span></li>
          <li><span className="big">{s.pirs.length}</span><span>presence detectors already fitted</span></li>
          <li><span className="big">{metres.toFixed(1)} m</span><span>of chilled water pipe with no insulation</span></li>
        </ul>
        <p className="note">Dimming to 20% between 23:00 and 06:00 saves about {gbp(1240)} a year on this corridor.</p>
      </section>
    );
  }
  return null;
}

function SpaceCase({ model, id, onAsset }: { model: Model; id: string; onAsset: (i: number) => void }) {
  const space = SPACES.find((s) => s.id === id)!;
  const sv = servicesTo(model, id);
  return (
    <>
      <header className="case-head">
        <span className="when is-info">Space</span>
        <h2>{space.name}</h2>
        <p>{sv.length ? `Served from this corridor by ${sv.length} ${sv.length === 1 ? 'system' : 'systems'}.` : 'Nothing enters it from this corridor.'}</p>
      </header>
      <section className="block">
        <ul className="bm-rows">
          {sv.map(({ sys, entry }) => (
            <li key={sys.id}>
              <button className="bm-row" onClick={() => onAsset(entry.holes[0] ?? entry.branch[0])}>
                <span className="swatch" style={{ background: sys.colour }} />
                <span className="row-main">{sys.name}<small>{entry.holes.length ? `Through ${entry.holes.map((h) => model.elements[h].m).join(', ')}` : `Branches in, ${entry.branch.length} parts`}</small></span>
              </button>
            </li>
          ))}
        </ul>
        {sv.length < SYSTEMS.length && <p className="note">No {SYSTEMS.filter((s) => !sv.some((x) => x.sys.id === s.id)).map((s) => s.short.toLowerCase()).join(', ')} from here.</p>}
      </section>
    </>
  );
}
