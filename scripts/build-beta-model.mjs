// Pulls the NCW corridor model out of the Experiments viewer for the Beta pages:
// public/beta/ncw/model.json (elements, clashes, links, plus the connection graph and circuits)
// and public/beta/ncw/geom.bin (the same gzipped vertex and index buffers).
// Usage: node scripts/build-beta-model.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const src = new URL('../public/experiments/ncw-corridor.html', import.meta.url);
const outDir = new URL('../public/beta/ncw/', import.meta.url);

const html = await readFile(src, 'utf8');
const meta = JSON.parse(html.match(/<script type="application\/json" id="meta">([\s\S]*?)<\/script>/)[1]);
const geom = html.match(/<script type="text\/plain" id="geom">([\s\S]*?)<\/script>/)[1].trim();

const E = meta.elements;

// Which run an element belongs to: pipes by material system, ducts and tray as one each
const group = (e) => {
  if (e.s !== 'MEP') return null;
  if (e.g === 'PIPE') return e.m.startsWith('WP') ? null : e.sy ?? null;
  if (e.g === 'DUCT' || e.g === 'TRAY') return e.g;
  return null;
};
const touches = (a, b, tol) => [0, 1, 2].every((k) => a[k] - tol <= b[k + 3] && b[k] - tol <= a[k + 3]);

// Elements of the same run whose boxes touch are treated as connected
const adj = E.map(() => []);
for (let i = 0; i < E.length; i++) {
  const gi = group(E[i]);
  if (!gi) continue;
  for (let j = i + 1; j < E.length; j++) {
    if (group(E[j]) !== gi || !touches(E[i].b, E[j].b, 4)) continue;
    adj[i].push(j);
    adj[j].push(i);
  }
}

// Circuits: connected pieces of a run, numbered west to east within their system
const circuitOf = E.map(() => -1);
const circuits = [];
for (let i = 0; i < E.length; i++) {
  if (!group(E[i]) || circuitOf[i] !== -1) continue;
  const members = [];
  const stack = [i];
  circuitOf[i] = circuits.length;
  while (stack.length) {
    const x = stack.pop();
    members.push(x);
    for (const y of adj[x]) if (circuitOf[y] === -1) { circuitOf[y] = circuits.length; stack.push(y); }
  }
  const x0 = Math.min(...members.map((m) => E[m].b[0]));
  const x1 = Math.max(...members.map((m) => E[m].b[3]));
  circuits.push({ group: group(E[i]), members, x0: Math.round(x0), x1: Math.round(x1) });
}

// Wall holes carry the services that cross them; link each hole to the circuits passing through
const holes = E.filter((e) => e.c.startsWith('Wall penetration')).map((h) => {
  const through = new Set();
  for (const e of E) if (circuitOf[e.i] !== -1 && touches(h.b, e.b, 2)) through.add(circuitOf[e.i]);
  return { i: h.i, circuits: [...through] };
});

const model = { ...meta, adj, circuitOf, circuits, holes };
await mkdir(outDir, { recursive: true });
await writeFile(new URL('model.json', outDir), JSON.stringify(model));
await writeFile(new URL('geom.bin', outDir), Buffer.from(geom, 'base64'));
console.log(`${E.length} elements, ${circuits.length} circuits, ${holes.filter((h) => h.circuits.length).length} holes carrying services`);
