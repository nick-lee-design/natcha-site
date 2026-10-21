// Services section behaviour: the service list, the wheel that lights the agents
// and tools a service uses, and the step-by-step run with its isometric figure.
// Ported from services-section.html; it builds its own markup inside the
// skeleton rendered by ServicesBench.tsx.
import { services, wheelNodes, type Service } from '@/lib/services';

type Figure = { set: (cur: number, from: number, animate: boolean) => void; highlight: (k: number) => void; drawGhosts: () => number };
type Animated = Element & { _a?: Animation };

export function startServices(root: HTMLElement): () => void {
  const $ = <T extends Element = HTMLElement>(id: string) => root.querySelector<T>(`#svc-${id}`)!;
  const bench = $('bench'), tasksEl = $('tasks'), nodesEl = $<SVGGElement>('nodes'), runEl = $('run'), railEl = $('rail'), cardEl = $('card');
  const headEl = $('c-head'), mainEl = $('c-main'), backBtn = $<HTMLButtonElement>('back'), nextBtn = $<HTMLButtonElement>('next'), rulerEl = $('ruler');
  const leader = $('leader'), kitSvg = $<SVGSVGElement>('kit'), announce = $('announce'), ringEl = $<SVGCircleElement>('ring');

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAN_ANIMATE = !REDUCED && 'IntersectionObserver' in window && 'animate' in Element.prototype;
  let selected = 1;
  let current = 0;
  let prev = 0;
  let booted = false;

  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  const ac = new AbortController();
  const on = { signal: ac.signal };

  function play(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) {
    const a = el as Animated;
    if (a._a) a._a.cancel();
    a._a = el.animate(frames, opts);
    return a._a;
  }

  /* ================================================================ wheel */
  const CX = 320, CY = 320;
  $('guides').innerHTML = wheelNodes.map((n) => {
    const c = n.kind === 'agent' ? n.at : [n.at[0] + 22, n.at[1] + 22];
    const dx = c[0] - CX, dy = c[1] - CY, r = Math.hypot(dx, dy), ux = dx / r, uy = dy / r;
    return `<line x1="${(CX + ux * 70).toFixed(1)}" y1="${(CY + uy * 70).toFixed(1)}" x2="${(CX + ux * 236).toFixed(1)}" y2="${(CY + uy * 236).toFixed(1)}"/>`;
  }).join('');

  nodesEl.innerHTML = wheelNodes.map((n, i) => {
    const c = n.kind === 'agent' ? n.at : [n.at[0] + 22, n.at[1] + 22];
    const dx = c[0] - CX, dy = c[1] - CY, r = Math.hypot(dx, dy), ux = dx / r, uy = dy / r;
    // spoke runs from the ring outwards, so the call travels from TALO to the agent or tool
    const [ox, oy, ix, iy] = n.spoke;
    const shape = n.kind === 'agent'
      ? `<circle class="halo" cx="${n.at[0]}" cy="${n.at[1]}" r="26" /><circle class="shape" cx="${n.at[0]}" cy="${n.at[1]}" r="26" /><text class="glyph" x="${n.at[0]}" y="${n.at[1]}">AI</text>`
      : `<rect class="halo" x="${n.at[0]}" y="${n.at[1]}" width="44" height="44" rx="3" /><rect class="shape" x="${n.at[0]}" y="${n.at[1]}" width="44" height="44" rx="3" />`;
    return `
    <g class="node" data-id="${n.id}" style="--i:${i};--tx:${(-ux * 10).toFixed(1)}px;--ty:${(-uy * 10).toFixed(1)}px;--ox:${(ux * 18).toFixed(1)}px;--oy:${(uy * 18).toFixed(1)}px">
      <line class="spoke-guide" x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" />
      <line class="spoke" pathLength="1" x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" />
      <circle class="pulse" cx="${ix}" cy="${iy}" r="4" data-dx="${(ox - ix).toFixed(1)}" data-dy="${(oy - iy).toFixed(1)}" />
      <g class="nb">
        ${shape}
        <text class="node-label"><tspan x="${n.labelX}" y="${n.labelY}">${n.label[0]}</tspan><tspan x="${n.labelX}" dy="1.2em">${n.label[1]}</tspan></text>
      </g>
    </g>`;
  }).join('');
  const nodeEls = [...nodesEl.querySelectorAll<SVGGElement>('.node')];
  const nodeById = Object.fromEntries(nodeEls.map((el) => [el.dataset.id!, el]));

  // Light the agents and tools a service uses. Each call leaves the ring as a pulse and the node snaps in towards TALO when it arrives.
  function lightWheel(ids: string[], animate: boolean) {
    nodeEls.forEach((el) => {
      if (!ids.includes(el.dataset.id!) && el.classList.contains('on')) {
        el.style.setProperty('--sd', '0ms'); el.style.setProperty('--bd', '0ms');
        el.classList.remove('on');
      }
    });
    ids.forEach((id, k) => {
      const el = nodeById[id];
      if (el.classList.contains('on')) return;
      const d = animate ? 140 + k * 110 : 0;
      el.style.setProperty('--sd', `${d}ms`);
      el.style.setProperty('--bd', `${animate ? d + 300 : 0}ms`);
      el.classList.add('on');
      if (!animate) return;
      const p = el.querySelector<SVGCircleElement>('.pulse')!;
      play(p, [
        { transform: 'translate(0px,0px)', opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { opacity: 1, offset: 0.8 },
        { transform: `translate(${p.dataset.dx}px,${p.dataset.dy}px)`, opacity: 0 },
      ], { duration: 460, delay: d, easing: 'cubic-bezier(.45,0,.2,1)' });
      play(el.querySelector('.halo')!, [
        { opacity: 0.7, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.55)' },
      ], { duration: 620, delay: d + 380, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
    if (animate) {
      play(ringEl, [
        { stroke: '#d9a05a', filter: 'drop-shadow(0 0 0px rgba(217,160,90,0))' },
        { stroke: '#f2c88a', filter: 'drop-shadow(0 0 14px rgba(217,160,90,.75))', offset: 0.3 },
        { stroke: '#d9a05a', filter: 'drop-shadow(0 0 0px rgba(217,160,90,0))' },
      ], { duration: 900, easing: 'ease-out' });
    }
  }
  function previewWheel(ids: string[] | null) {
    nodeEls.forEach((el) => el.classList.toggle('pv', !!ids && ids.includes(el.dataset.id!) && !el.classList.contains('on')));
  }

  /* ================================================================ service list */
  const names = Object.fromEntries(wheelNodes.map((n) => [n.id, n.label.join(' ').replace(/^./, (c) => c.toUpperCase())]));
  const listNames = (ids: string[]) => { const a = ids.map((id) => names[id]); return a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0]; };

  tasksEl.innerHTML = services.map((s, i) => `
    <li class="task" data-i="${i}">
      <button class="task-btn" type="button" aria-expanded="false" aria-controls="svc-task-${i}">
        <span>${s.label}</span>${s.steps ? `<span class="task-count">${s.steps.length} steps</span>` : ''}<span class="chev" aria-hidden="true"></span>
      </button>
      <div class="task-body" id="svc-task-${i}"><div>
        <dl class="flow">
          <div class="f-you" style="--r:0"><dt>You</dt><dd>${s.you}</dd></div>
          <div class="f-talo" style="--r:1"><dt>TALO</dt><dd>${s.talo}<span class="sr-only"> Uses ${listNames(s.on)}.</span></dd></div>
          <div class="f-get" style="--r:2"><dt>You get</dt><dd>${s.back}</dd></div>
        </dl>
      </div></div>
    </li>`).join('');
  const taskEls = [...tasksEl.querySelectorAll<HTMLLIElement>('.task')];
  const taskOf = (t: EventTarget | null) => (t as Element | null)?.closest<HTMLLIElement>('.task');

  tasksEl.addEventListener('click', (e) => {
    const li = (e.target as Element).closest('.task-btn')?.parentElement;
    if (li) select(+li.dataset.i!);
  }, on);
  tasksEl.addEventListener('pointerover', (e) => {
    const li = taskOf(e.target);
    previewWheel(li ? services[+li.dataset.i!].on : null);
  }, on);
  tasksEl.addEventListener('pointerleave', () => previewWheel(null), on);
  tasksEl.addEventListener('focusin', (e) => {
    const li = taskOf(e.target);
    if (li && (e.target as Element).matches(':focus-visible')) previewWheel(services[+li.dataset.i!].on);
  }, on);
  tasksEl.addEventListener('focusout', () => previewWheel(null), on);

  function select(i: number, initial?: boolean) {
    if (i === selected && !initial) return;
    selected = i;
    const s = services[i];

    taskEls.forEach((el, j) => {
      el.classList.toggle('is-on', j === i);
      el.querySelector('.task-btn')!.setAttribute('aria-expanded', String(j === i));
      el.querySelector<HTMLElement>('.task-body')!.inert = j !== i;
    });
    previewWheel(null);
    if (!initial || !CAN_ANIMATE) lightWheel(s.on, booted && CAN_ANIMATE);

    const wasHidden = runEl.hidden;
    runEl.hidden = !s.steps;
    if (!s.steps) return;

    $('run-h').textContent = s.stepsTitle ?? '';
    const dl = $<HTMLAnchorElement>('run-dl');
    dl.hidden = !s.downloadFile;
    if (s.downloadFile) { dl.href = `/files/${s.downloadFile}`; dl.textContent = s.downloadLabel ?? ''; }

    const animate = booted && CAN_ANIMATE;
    if (animate && wasHidden) play(runEl, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
    buildRun(s, animate);
  }

  /* ================================================================ run: rail, card, figure */
  let buttons: HTMLButtonElement[] = [], phaseEls: HTMLElement[] = [], ticks: HTMLElement[] = [], stepPhase: number[] = [];
  let fig: Figure | null = null;

  function buildRun(s: Service, animate: boolean) {
    const steps = s.steps!, phases = s.phases!;
    stepPhase = [];
    phases.forEach((p, pi) => { for (let k = 0; k < p.count; k++) stepPhase.push(pi); });
    let start = 0;
    railEl.style.gridTemplateColumns = phases.map((p) => `${p.count}fr`).join(' ');
    railEl.innerHTML = phases.map((p, pi) => {
      const idx = Array.from({ length: p.count }, (_, k) => start + k);
      start += p.count;
      const range = p.count > 1 ? `${idx[0] + 1}–${idx[idx.length - 1] + 1}` : `${idx[0] + 1}`;
      return `
        <div class="phase" data-phase="${pi}">
          <h4 class="phase-h">${p.name}<span class="range">${range}</span>${p.loop ? `<span class="loop"><span class="loop-ic" aria-hidden="true">↻</span> ${p.loop}</span>` : ''}</h4>
          <ol class="steps" start="${idx[0] + 1}">
            ${idx.map((k) => `
              <li><button class="step${steps[k].optional ? ' optional' : ''}" type="button" data-k="${k}" style="--i:${k}" aria-label="Step ${k + 1}: ${steps[k].title}">
                <span class="wire" aria-hidden="true"></span><span class="dot">${k + 1}</span><span class="name">${steps[k].title}</span>
              </button></li>`).join('')}
          </ol>
        </div>`;
    }).join('');
    buttons = [...railEl.querySelectorAll<HTMLButtonElement>('.step')];
    phaseEls = [...railEl.querySelectorAll<HTMLElement>('.phase')];

    const n = steps.length;
    rulerEl.innerHTML = '<span class="r-fill"></span>' +
      steps.map((_, i) => `<span class="tk${i === 0 || i === n - 1 ? ' end' : ''}" style="left:${(i / (n - 1)) * 100}%"></span>`).join('') +
      '<span class="r-node"></span>';
    ticks = [...rulerEl.querySelectorAll<HTMLElement>('.tk')];

    fig = makeAssembly(kitSvg, s);
    current = 0; prev = 0;
    render(false, true);

    if (animate) {
      runEl.classList.remove('in'); void runEl.offsetWidth; runEl.classList.add('in');
      const t = fig.drawGhosts();
      later(() => fig!.set(current, -1, true), Math.min(t, 520));
      later(() => runEl.classList.remove('in'), 1300);
    } else if (!bench.classList.contains('pre')) fig.set(current, -1, false);
  }

  function render(focusRail: boolean, fresh?: boolean) {
    const s = services[selected];
    const steps = s.steps!;
    const step = steps[current];
    const n = steps.length;
    const pi = stepPhase[current];
    const phase = s.phases![pi];
    const moved = !fresh && current !== prev;
    const dir = current >= prev ? 1 : -1;

    buttons.forEach((b, k) => {
      const wasDone = !fresh && k < prev, isDone = k < current;
      if (isDone !== wasDone) b.style.setProperty('--wd', `${(isDone ? k - prev : prev - 1 - k) * 60}ms`);
      b.classList.toggle('done', isDone);
      b.tabIndex = k === current ? 0 : -1;
      if (k === current) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    later(() => buttons.forEach((b) => b.style.removeProperty('--wd')), 900);
    if (moved) { const b = buttons[current]; b.classList.remove('snap'); void b.offsetWidth; b.classList.add('snap'); }

    phaseEls.forEach((el, j) => { el.classList.toggle('is-current', j === pi); el.classList.toggle('is-done', j < pi); });
    if (moved && phase.loop && (stepPhase[prev] !== pi || current > prev)) {
      phaseEls[pi].querySelectorAll('.loop-ic').forEach((ic) => { ic.classList.remove('spin'); void (ic as HTMLElement).offsetWidth; ic.classList.add('spin'); });
    }
    if (focusRail) buttons[current].focus();

    const sw = moved ? ' swap' : '';
    cardEl.style.setProperty('--dir', String(dir));
    const tags = [step.tag, step.optional && 'Optional', phase.loop && `<span class="loop-ic${moved ? ' spin' : ''}" aria-hidden="true">↻</span> Repeats ${phase.loop}`].filter(Boolean);
    headEl.innerHTML = `
      <p class="c-meta${sw}" style="--d:0">Step ${current + 1} of ${n} · ${phase.name}</p>
      <h4 class="c-title${sw}" style="--d:1">${step.title}</h4>
      <div class="c-tags${sw}" style="--d:2">${tags.map((t) => `<span class="c-tag">${t}</span>`).join('')}</div>`;
    mainEl.innerHTML = `
      <p class="c-body${sw}" style="--d:2">${step.body}</p>
      ${step.who ? `<dl class="c-facts${sw}" style="--d:3"><dt>Who</dt><dd>${step.who}</dd><dt>You get</dt><dd>${step.get}</dd></dl>` : ''}`;

    const atStart = current === 0, atEnd = current === n - 1;
    if (atStart && document.activeElement === backBtn) nextBtn.focus();
    if (atEnd && document.activeElement === nextBtn) backBtn.focus();
    backBtn.disabled = atStart;
    nextBtn.disabled = atEnd;

    rulerEl.style.setProperty('--p', String(current / (n - 1)));
    ticks.forEach((t, i) => t.classList.toggle('on', i <= current));

    if (moved) fig!.set(current, prev, CAN_ANIMATE);
    placeLeader(!!fresh);
    if (moved) announce.textContent = `${step.title}. Step ${current + 1} of ${n}, ${phase.name}.`;
    prev = current;
  }

  function go(k: number, focusRail = false) {
    const next = Math.max(0, Math.min(services[selected].steps!.length - 1, k));
    if (next === current) return;
    current = next;
    render(focusRail);
  }

  const stepOf = (t: EventTarget | null) => (t as Element | null)?.closest<HTMLButtonElement>('.step');
  railEl.addEventListener('click', (e) => {
    const b = stepOf(e.target);
    if (b) go(+b.dataset.k!);
  }, on);
  railEl.addEventListener('keydown', (e) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key in keys) { e.preventDefault(); go(current + keys[e.key], true); }
    else if (e.key === 'Home') { e.preventDefault(); go(0, true); }
    else if (e.key === 'End') { e.preventDefault(); go(Infinity, true); }
  }, on);
  railEl.addEventListener('pointerover', (e) => { const b = stepOf(e.target); if (fig) fig.highlight(b ? +b.dataset.k! : -1); }, on);
  railEl.addEventListener('pointerleave', () => fig && fig.highlight(-1), on);
  railEl.addEventListener('focusin', (e) => { const b = stepOf(e.target); if (b && fig && (e.target as Element).matches(':focus-visible')) fig.highlight(+b.dataset.k!); }, on);
  railEl.addEventListener('focusout', () => fig && fig.highlight(-1), on);
  backBtn.addEventListener('click', () => go(current - 1), on);
  nextBtn.addEventListener('click', () => go(current + 1), on);

  // Swipe between steps on touch screens
  let swipe: { x: number; y: number } | null = null;
  cardEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || (e.target as Element).closest('button,a')) return;
    swipe = { x: e.clientX, y: e.clientY };
  }, on);
  cardEl.addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
  }, on);
  cardEl.addEventListener('pointercancel', () => { swipe = null; }, on);

  function placeLeader(instant: boolean) {
    if (runEl.hidden || getComputedStyle(leader).display === 'none' || !buttons.length) return;
    const rr = runEl.getBoundingClientRect();
    const br = buttons[current].getBoundingClientRect();
    const dot = buttons[current].querySelector('.dot')!.getBoundingClientRect();
    const cr = cardEl.getBoundingClientRect();
    const x = dot.left + dot.width / 2 - rr.left;
    const y = br.bottom - rr.top + 8;
    const h = Math.max(0, cr.top - rr.top - y);
    if (instant) leader.classList.add('still');
    leader.style.transform = `translate(${x}px,${y}px)`;
    leader.style.height = `${h}px`;
    if (!bench.classList.contains('pre')) leader.classList.add('on');
    if (instant) requestAnimationFrame(() => leader.classList.remove('still'));
  }

  /* ================================================================ figure: isometric build-up, parts added step by step */
  function makeAssembly(svg: SVGSVGElement, svc: Service): Figure {
    const steps = svc.steps!;
    const n = steps.length;
    const map = svc.build || Array.from({ length: 9 }, (_, p) => Math.min(n - 1, Math.floor((p * n) / 9)));
    const K = 20, CS = Math.cos(Math.PI / 6), SN = 0.5;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    type Pt = [number, number];
    type V3 = [number, number, number];
    const P = (x: number, y: number, z: number): Pt => {
      const p: Pt = [(x - z) * CS * K, ((x + z) * SN - y) * K];
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      return p;
    };
    const pts = (a: Pt[]) => a.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const ln = (a: V3, b: V3) => { const p = P(...a), q = P(...b); return `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`; };
    const prims: { s: number; d: number; b: string; g: string; cls: string }[] = [];
    const add = (s: number, d: number, b: string, g: string, cls?: string) => prims.push({ s, d, b, g, cls: cls || '' });

    function box(s: number, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, cls?: string) {
      const T = ([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] as V3[]).map((q) => P(...q));
      const R = ([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] as V3[]).map((q) => P(...q));
      const F = ([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] as V3[]).map((q) => P(...q));
      add(s, (x0 + x1 + y0 + y1 + z0 + z1) / 2,
        `<polygon class="fz" points="${pts(F)}"/><polygon class="fx" points="${pts(R)}"/><polygon class="ft" points="${pts(T)}"/>`,
        `<polygon points="${pts(F)}"/><polygon points="${pts(R)}"/><polygon points="${pts(T)}"/>`, cls);
    }
    function hull(Q: Pt[]) {
      Q = Q.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo: Pt[] = [], up: Pt[] = [];
      for (const p of Q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (let i = Q.length - 1; i >= 0; i--) { const p = Q[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      up.pop(); lo.pop(); return lo.concat(up);
    }
    function pipe(s: number, x0: number, x1: number, y: number, z: number, r: number) {
      const ring = (x: number) => { const a: Pt[] = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2; a.push(P(x, y + r * Math.cos(t), z + r * Math.sin(t))); } return a; };
      const a = ring(x0), e = ring(x1), h = hull(a.concat(e));
      const sh = [P(x0, y + r * 0.7, z + r * 0.55), P(x1, y + r * 0.7, z + r * 0.55)];
      add(s, (x0 + x1) / 2 + y + z,
        `<polygon class="fx" points="${pts(h)}"/><polygon class="ft" points="${pts(e)}"/><polyline class="sh" points="${pts(sh)}"/>`,
        `<polygon points="${pts(h)}"/><polygon points="${pts(e)}"/>`);
    }
    function ellipse(c: V3, plane: 'xz' | 'yz', r: number, count?: number) {
      const a: Pt[] = []; const m = count || 28;
      for (let i = 0; i < m; i++) {
        const t = (i / m) * Math.PI * 2, u = r * Math.cos(t), w = r * Math.sin(t);
        a.push(plane === 'xz' ? P(c[0] + u, c[1], c[2] + w) : P(c[0], c[1] + u, c[2] + w));
      }
      return a;
    }
    function lines(s: number, d: number, segs: [V3, V3][], cls?: string, extra?: string) {
      const m = segs.map(([a, b]) => ln(a, b)).join('');
      add(s, d, `<g class="ln ${cls || ''}">${m}</g>${extra || ''}`, m);
    }

    // 1 Discovery: the plan grid
    { const F = ([[0, 0, 0], [6, 0, 0], [6, 0, 4], [0, 0, 4]] as V3[]).map((q) => P(...q)); const segs: [V3, V3][] = [];
      for (let x = 1; x < 6; x++) segs.push([[x, 0, 0], [x, 0, 4]]);
      for (let z = 1; z < 4; z++) segs.push([[0, 0, z], [6, 0, z]]);
      const m = segs.map(([a, b]) => ln(a, b)).join('');
      add(0, -100, `<polygon class="fl" points="${pts(F)}"/><g class="ln gl">${m}</g>`, `<polygon points="${pts(F)}"/>${m}`); }
    // 2 Audit: the existing columns
    for (const [cx, cz] of [[0.3, 0.3], [5.7, 0.3], [0.3, 3.7], [5.7, 3.7]]) {
      box(1, cx - 0.26, cx + 0.26, 0, 0.06, cz - 0.26, cz + 0.26);
      box(1, cx - 0.15, cx + 0.15, 0.06, 3.0, cz - 0.15, cz + 0.15);
    }
    // 3 Proposal: the frame that sets the scope
    box(2, 0.45, 5.55, 2.8, 3.0, 0.2, 0.4);
    box(2, 0.2, 0.4, 2.8, 3.0, 0.45, 3.55);
    box(2, 2.0, 2.2, 2.8, 2.98, 0.4, 3.6);
    box(2, 3.8, 4.0, 2.8, 2.98, 0.4, 3.6);
    box(2, 5.6, 5.8, 2.8, 3.0, 0.45, 3.55);
    box(2, 0.45, 5.55, 2.8, 3.0, 3.6, 3.8);
    // 4 Install: ductwork in three segments with flanges
    [[0.7, 2.2], [2.2, 3.75], [3.75, 5.3]].forEach(([a, b], k) => {
      box(3, a + 0.02, b - 0.02, 2.15, 2.55, 1.0, 1.8);
      if (k < 2) box(3, b - 0.03, b + 0.03, 2.11, 2.59, 0.96, 1.84);
    });
    // 5 Test: pipework
    pipe(4, 0.6, 5.4, 1.95, 2.55, 0.11);
    pipe(4, 0.6, 5.4, 1.95, 2.95, 0.08);
    // 6 Review: a valve that can be adjusted
    { const body = P(4.3, 1.95, 2.95), rr = (0.17 * K).toFixed(1);
      const fl1 = ellipse([4.1, 1.95, 2.95], 'yz', 0.14), fl2 = ellipse([4.5, 1.95, 2.95], 'yz', 0.14), wh = ellipse([4.3, 2.36, 2.95], 'xz', 0.15);
      const st = [P(4.3, 2.1, 2.95), P(4.3, 2.36, 2.95)];
      add(5, 4.3 + 2.0 + 2.95 + 0.3,
        `<polygon class="fx" points="${pts(fl1)}"/><circle class="ft" cx="${body[0].toFixed(1)}" cy="${body[1].toFixed(1)}" r="${rr}"/><polygon class="fx" points="${pts(fl2)}"/><polyline class="ln" points="${pts(st)}"/><polygon class="ln" points="${pts(wh)}"/>`,
        `<polygon points="${pts(fl1)}"/><circle cx="${body[0].toFixed(1)}" cy="${body[1].toFixed(1)}" r="${rr}"/><polygon points="${pts(fl2)}"/><polyline points="${pts(st)}"/><polygon points="${pts(wh)}"/>`); }
    // 7 Refine: hangers that tighten everything to the frame
    for (const x of [2.1, 3.9]) {
      for (const [z, top] of [[2.55, 2.06], [2.95, 2.03]]) {
        const clamp = ellipse([x, 1.95, z], 'yz', z === 2.55 ? 0.14 : 0.11, 20);
        lines(6, x + 2.4 + z + 0.05, [[[x, 2.8, z], [x, top, z]]], '', `<polygon class="ln" points="${pts(clamp)}"/>`);
      }
      for (const z of [1.05, 1.75]) lines(6, x + 2.68 + z, [[[x, 2.8, z], [x, 2.55, z]]]);
    }
    // 8 Handover: the drawing record, as dimension lines
    { const tick = (x: number, y: number, z: number): [V3, V3] => [[x - 0.12, y, z + 0.12], [x + 0.12, y, z - 0.12]];
      lines(7, 200, [
        [[0, 0, 4.1], [0, 0, 4.75]], [[6, 0, 4.1], [6, 0, 4.75]], [[0, 0, 4.55], [6, 0, 4.55]], tick(0, 0, 4.55), tick(6, 0, 4.55),
        [[6.05, 0, 3.85], [6.75, 0, 3.85]], [[6.05, 3.0, 3.85], [6.75, 3.0, 3.85]], [[6.6, 0, 3.85], [6.6, 3.0, 3.85]],
        [[6.48, -0.12, 3.85], [6.72, 0.12, 3.85]], [[6.48, 2.88, 3.85], [6.72, 3.12, 3.85]],
      ]); }
    // 9 Support (optional): a monitoring unit on the front column
    { box(8, 0.45, 0.62, 1.1, 1.5, 3.58, 3.82);
      const led = P(0.535, 1.38, 3.82);
      lines(8, 0.53 + 2.1 + 3.7 + 0.2, [[[0.535, 1.5, 3.7], [0.535, 2.8, 3.7]]], '', `<circle class="led" cx="${led[0].toFixed(1)}" cy="${led[1].toFixed(1)}" r="2.2"/>`);
    }

    prims.sort((a, b) => a.d - b.d);
    const pad = 12;
    svg.setAttribute('viewBox', [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].map((v) => v.toFixed(1)).join(' '));
    // prims carry their part number in p.s; data-s is the step that builds it, data-p the part
    const opt = (p: { s: number }) => (steps[map[p.s]].optional ? ' opt' : '');
    svg.innerHTML = `<g class="ghosts">${prims.map((p) => `<g class="gh" data-s="${map[p.s]}" data-p="${p.s}">${p.g}</g>`).join('')}</g>` +
      `<g class="built">${prims.map((p) => `<g class="pc ${p.cls}${opt(p)}" data-s="${map[p.s]}" data-p="${p.s}">${p.b}</g>`).join('')}</g>`;

    // Each part travels in along the way it would be installed: columns rise, the frame lowers, services slide along their run
    const ux = [CS * K, SN * K], uz = [-CS * K, SN * K];
    const OFF = [[0, 6], [0, 26], [0, -22], [-ux[0] * 1.8, -ux[1] * 1.8], [ux[0] * 1.8, ux[1] * 1.8], [0, -14], [0, -10], [uz[0] * 0.7, uz[1] * 0.7], [uz[0] * 1.1, uz[1] * 1.1]];
    // When one step adds several parts, they land in order (columns before the frame they carry)
    const rank = Array(9).fill(0), perStep = Array(n).fill(0);
    for (let p = 0; p < 9; p++) rank[p] = perStep[map[p]]++;
    return makeStepper(svg, n, (_s, el, isOn, delay) => {
      const part = +el.dataset.p!, off = OFF[part];
      return isOn
        ? play(el, [{ transform: `translate(${off[0]}px,${off[1]}px)`, opacity: 0 }, { transform: 'translate(0px,0px)', opacity: 1 }],
          { duration: 560, delay: delay + rank[part] * 150, easing: 'cubic-bezier(.2,.85,.25,1.15)', fill: 'backwards' })
        : play(el, [{ transform: 'translate(0px,0px)', opacity: 1 }, { transform: `translate(${off[0] * 0.6}px,${off[1] * 0.6}px)`, opacity: 0 }],
          { duration: 240, delay, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    }, (s) => (perStep[s] - 1) * 150);
  }

  /* Build and teardown: parts up to the current step are built, later parts stay as blueprint */
  function makeStepper(svg: SVGSVGElement, n: number, animatePart: (s: number, el: SVGGElement, isOn: boolean, delay: number) => Animation, landLag?: (s: number) => number): Figure {
    const pcBy = Array.from({ length: n }, () => [] as SVGGElement[]), ghBy = Array.from({ length: n }, () => [] as SVGGElement[]);
    svg.querySelectorAll<SVGGElement>('.pc').forEach((el) => pcBy[+el.dataset.s!].push(el));
    svg.querySelectorAll<SVGGElement>('.gh').forEach((el) => ghBy[+el.dataset.s!].push(el));
    const ghostOrder = [...svg.querySelectorAll<SVGGElement>('.gh')];
    const built = Array(n).fill(false), tok = Array(n).fill(0);
    function set(cur: number, from: number, animate: boolean) {
      for (let s = 0; s < n; s++) {
        pcBy[s].forEach((el) => el.classList.toggle('cur', s === cur));
        const want = s <= cur;
        if (want === built[s]) continue;
        built[s] = want;
        const t = ++tok[s];
        if (want) {
          pcBy[s].forEach((el) => el.classList.add('on'));
          if (animate) {
            const delay = Math.max(0, s - from - 1) * 110;
            pcBy[s].forEach((el) => animatePart(s, el, true, delay));
            later(() => { if (tok[s] === t) ghBy[s].forEach((g) => g.classList.add('off')); }, delay + 420 + (landLag ? landLag(s) : 0));
          } else ghBy[s].forEach((g) => g.classList.add('off'));
        } else {
          ghBy[s].forEach((g) => g.classList.remove('off'));
          if (animate) {
            const delay = Math.max(0, from - s) * 60;
            pcBy[s].forEach((el) => { const a = animatePart(s, el, false, delay); a.onfinish = () => { if (tok[s] === t) el.classList.remove('on'); a.cancel(); }; });
          } else pcBy[s].forEach((el) => el.classList.remove('on'));
        }
      }
    }
    function highlight(k: number) {
      pcBy.forEach((list, s) => list.forEach((el) => el.classList.toggle('hl', s === k)));
      ghBy.forEach((list, s) => list.forEach((el) => el.classList.toggle('hl', s === k)));
    }
    function drawGhosts() {
      if (!CAN_ANIMATE) return 0;
      ghostOrder.forEach((g, i) => play(g, [{ opacity: 0 }, { opacity: getComputedStyle(g).opacity }], { duration: 320, delay: i * 14, easing: 'ease-out', fill: 'backwards' }));
      return ghostOrder.length * 14 + 200;
    }
    return { set, highlight, drawGhosts };
  }

  /* ================================================================ boot */
  const ro = new ResizeObserver(() => placeLeader(true));
  ro.observe(bench);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!ac.signal.aborted) placeLeader(true); });

  let io: IntersectionObserver | null = null;
  if (CAN_ANIMATE) {
    bench.classList.add('pre');
    select(selected, true);
    booted = true;
    io = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io!.disconnect();
      bench.classList.replace('pre', 'in');
      placeLeader(true);
      // The wheel draws itself, then TALO calls the agents and tools for the selected service
      later(() => lightWheel(services[selected].on, true), 1450);
      if (services[selected].steps) {
        runEl.classList.add('in');
        const t = fig!.drawGhosts();
        later(() => fig!.set(current, -1, true), Math.min(t, 700));
        later(() => runEl.classList.remove('in'), 1500);
      }
      later(() => bench.classList.remove('in'), 1800);
    }, { threshold: 0.2 });
    io.observe(bench);
  } else {
    select(selected, true);
    if (fig) (fig as Figure).set(current, -1, false);
    booted = true;
  }

  return () => {
    ac.abort();
    ro.disconnect();
    io?.disconnect();
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
  };
}
