'use client';

import { useMemo, useState } from 'react';
import {
  PASSPORTS, SPACES, SYSTEMS, entriesOf, holesOf, impactOf, membersOf, systemOf, systemTree, type SystemId,
} from '@/lib/beta/building';
import { centreOf, upstream, type Element, type Model } from '@/lib/beta/model';
import ModelView, { type Tone } from './ModelView';
import Passport from './Passport';

// Approach 2: navigate by what is connected to what. A line diagram leads; 3D follows it.
const W = 760, H = 300;
const LINE = 150, NORTH = [24, 86] as const, SOUTH = [214, 276] as const;

const NOTABLE = new Set(['Fire damper', 'Volume control damper']);

// Which of several labels along the line have room to show, west to east
function spaced(xs: number[], gap: number) {
  const keep = new Set<number>();
  let last = -Infinity;
  for (const k of xs.map((x, k) => [x, k]).sort((a, b) => a[0] - b[0])) if (k[0] - last >= gap) { keep.add(k[1]); last = k[0]; }
  return keep;
}

export default function Systems({ model }: { model: Model }) {
  const [sysId, setSysId] = useState<SystemId>('hw');
  const [sel, setSel] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const sys = SYSTEMS.find((s) => s.id === sysId)!;

  const x0 = model.bmin[0], x1 = model.bmax[0];
  const sx = (x: number) => 40 + ((Math.min(Math.max(x, x0), x1) - x0) / (x1 - x0)) * (W - 80);

  const data = useMemo(() => {
    const members = membersOf(model, sys);
    const set = new Set(members);
    const tree = systemTree(model, sys);
    const depth = new Map(tree.order.map((i, k) => [i, k]));
    const through = new Map(holesOf(model).map((h) => [h.i, h.through]));
    // One stop per room the system reaches; tracing from it starts at the part nearest the source
    const stops = entriesOf(model, set).map((e) => {
      const cands = [...e.holes.flatMap((h) => through.get(h)!.filter((t) => set.has(t))), ...e.branch];
      const head = cands.sort((p, q) => (depth.get(p) ?? 1e9) - (depth.get(q) ?? 1e9))[0];
      const at = centreOf(model.elements[e.holes[0] ?? head].b);
      return { space: e.space, head, x: e.space.kind === 'beyond' ? 1860 : at[0], label: e.holes.length ? model.elements[e.holes[0]].m : null };
    });
    const roots = tree.order.filter((i) => tree.parent.get(i) === -1);
    const srcX = roots.reduce((t, i) => t + centreOf(model.elements[i].b)[0], 0) / Math.max(roots.length, 1);
    const span = members.length ? [Math.min(...members.map((i) => model.elements[i].b[0])), Math.max(...members.map((i) => model.elements[i].b[3]))] : [x0, x0];
    const marks = members.filter((i) => NOTABLE.has(model.elements[i].c));
    return { members, set, tree, stops, srcX, span, marks };
  }, [model, sys, x0]);

  const impact = useMemo(() => (sel !== null && data.set.has(sel) ? impactOf(model, sel) : null), [model, sel, data.set]);
  const route = useMemo(() => (sel !== null && data.set.has(sel) ? upstream(data.tree, sel) : []), [sel, data]);

  const tones = useMemo(() => {
    const m = new Map<number, Tone>();
    for (const i of data.members) m.set(i, 'base');
    if (impact) for (const i of impact.els) m.set(i, failed ? 'alert' : 'warn');
    for (const i of route) m.set(i, 'info');
    if (failed && impact) for (const e of impact.entries) for (const h of e.holes) m.set(h, 'alert');
    return m;
  }, [data, impact, route, failed]);

  const affected = new Set(impact?.spaces.map((s) => s.id));

  function pick(i: number | null) {
    setFailed(false);
    if (i === null) return setSel(null);
    const s = systemOf(model, i);
    if (s && s.id !== sysId) setSysId(s.id);
    setSel(i);
  }

  const stopLabels = spaced(data.stops.map((st) => sx(st.x)), 48);
  const partLabels = spaced(data.marks.map((i) => sx(centreOf(model.elements[i].b)[0])), 48);
  const selEl: Element | null = sel !== null ? model.elements[sel] : null;
  const rooms = SPACES.filter((s) => s.kind === 'room' || s.kind === 'riser');

  return (
    <div className="ap ap-systems">
      <nav className="sys-tabs" aria-label="Systems">
        {SYSTEMS.map((s) => (
          <button key={s.id} className={s.id === sysId ? 'is-on' : ''} onClick={() => { setSysId(s.id); setSel(null); setFailed(false); }}>
            <span className="swatch" style={{ background: s.colour }} />{s.short}
          </button>
        ))}
      </nav>

      <section className="diagram">
        <div className="upstream">
          {sys.plant.map((p) => (
            <div key={p.mark} className="plant">
              <span className="mono tag">{p.mark}</span><span>{p.name}<small>{p.where}{PASSPORTS[p.mark] ? ` · ${PASSPORTS[p.mark].condition}` : ''}</small></span>
            </div>
          ))}
          <span className="arrow">{sys.flow === 'drains' ? 'drains to' : 'feeds'}</span>
          <div className="plant is-src"><span>{SPACES.find((s) => s.id === sys.source)!.name}</span></div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="line-diagram" role="img" aria-label={`${sys.name} along the corridor`}>
          {rooms.map((r) => {
            const north = r.box[1] > -6000;
            const [a, b] = north ? NORTH : SOUTH;
            const on = affected.has(r.id) && failed;
            return (
              <g key={r.id} className={`ld-room${r.kind === 'riser' ? ' is-riser' : ''}${data.stops.some((st) => st.space.id === r.id) ? ' is-served' : ''}${on ? ' is-hit' : ''}${affected.has(r.id) && !failed ? ' is-warn' : ''}`}>
                <rect x={sx(r.box[0]) + 2} y={a} width={Math.max(sx(r.box[3]) - sx(r.box[0]) - 4, 18)} height={b - a} rx={3} />
                <text x={sx(r.box[0]) + 8} y={a + 18}>{r.id}</text>
              </g>
            );
          })}
          <line x1={sx(data.span[0])} x2={sx(data.span[1])} y1={LINE} y2={LINE} className="ld-main" stroke={sys.colour} />
          {sys.source !== 'E' && (
            <line className="ld-src" x1={sx(data.srcX)} x2={sx(data.srcX)} y1={LINE} y2={sys.source === 'R2' ? NORTH[1] : SOUTH[0]} stroke={sys.colour} />
          )}
          {data.stops.map((st, k) => {
            const north = st.space.box[1] > -6000;
            const x = sx(st.x);
            const on = affected.has(st.space.id);
            if (st.space.kind === 'beyond') return (
              <g key={st.space.id} className={`ld-stop${on ? (failed ? ' is-hit' : ' is-warn') : ''}`} onClick={() => pick(st.head)}>
                <text x={W - 36} y={LINE - 10} className="ld-edge">East wing →</text>
              </g>
            );
            return (
              <g key={st.space.id} className={`ld-stop${on ? (failed ? ' is-hit' : ' is-warn') : ''}${sel === st.head ? ' is-sel' : ''}`} onClick={() => pick(st.head)}>
                <line x1={x} x2={x} y1={LINE} y2={north ? NORTH[1] : SOUTH[0]} stroke={sys.colour} />
                <circle cx={x} cy={LINE} r={5} fill={sys.colour} />
                {st.label && (stopLabels.has(k) || sel === st.head) && <text x={x + 5} y={north ? LINE - 10 : LINE + 18}>{st.label}</text>}
              </g>
            );
          })}
          {data.marks.map((i, k) => {
            const c = centreOf(model.elements[i].b);
            return (
              <g key={i} className={`ld-part${sel === i ? ' is-sel' : ''}${impact?.els.has(i) ? (failed ? ' is-hit' : ' is-warn') : ''}`} onClick={() => pick(i)}>
                <rect x={sx(c[0]) - 6} y={LINE - 6} width={12} height={12} transform={`rotate(45 ${sx(c[0])} ${LINE})`} />
                {(partLabels.has(k) || sel === i) && <text x={sx(c[0])} y={LINE + 34} textAnchor="middle">{model.elements[i].m}</text>}
              </g>
            );
          })}
          {selEl && data.set.has(selEl.i) && <circle className="ld-here" cx={sx(centreOf(selEl.b)[0])} cy={LINE} r={9} />}
        </svg>

        <div className="trace-bar">
          {selEl && impact ? (
            <>
              <p><strong className="mono">{selEl.m}</strong> {failed ? 'out of service: ' : 'feeds '}<strong>{impact.spaces.length}</strong> {impact.spaces.length === 1 ? 'space' : 'spaces'} and {impact.els.size - 1} {impact.els.size === 2 ? 'part' : 'parts'} beyond it. {route.length - 1} {route.length === 2 ? 'part' : 'parts'} back to {SPACES.find((s) => s.id === sys.source)!.name}.</p>
              <button className={failed ? 'btn-s' : 'btn-p'} onClick={() => setFailed(!failed)}>{failed ? 'Restore' : 'What if it fails?'}</button>
            </>
          ) : <p className="muted">Pick a stop, a part or anything in the model to trace it.</p>}
        </div>

        <div className="reach">
          <h4>Reaches</h4>
          <div className="chips">
            {data.stops.map((st) => (
              <button key={st.space.id} className={`chip${affected.has(st.space.id) ? (failed ? ' is-hit' : ' is-warn') : ''}`} onClick={() => pick(st.head)}>{st.space.name}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="stage">
        <ModelView model={model} tones={tones} rest="ghost" selected={sel}
          colourOf={(e) => (data.set.has(e.i) ? sys.colour : null)}
          frame={sel !== null ? { ids: [...route, ...(impact?.els ?? [sel])] } : { ids: data.members }}
          frameKey={`${sysId}|${sel}|${failed}`}
          onPick={pick} />
      </section>

      <aside className="side">
        {sel !== null ? <Passport key={sel} model={model} i={sel} start={data.set.has(sel) ? 'fails' : 'what'} onShow={() => setFailed(true)} /> : (
          <div className="side-empty">
            <h3>{sys.name}</h3>
            <dl className="kv">
              <dt>In this corridor</dt><dd><span className="mono">{data.members.length}</span> parts</dd>
              <dt>Reaches</dt><dd><span className="mono">{data.stops.length}</span> {data.stops.length === 1 ? 'space' : 'spaces'}</dd>
              <dt>Enters from</dt><dd>{SPACES.find((s) => s.id === sys.source)!.name}</dd>
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}
