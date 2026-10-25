// The NCW corridor model as the Beta pages read it: public/beta/ncw, built by scripts/build-beta-model.mjs

export type Element = {
  i: number;
  m: string; // mark, e.g. FD-03
  l: number; // layer index
  g: 'WALL' | 'DUCT' | 'PIPE' | 'TRAY' | 'LITE';
  s: 'MEP' | 'ARCH' | 'STR';
  c: string; // category
  k: 'segment' | 'family' | 'wall';
  z: string; // size
  b: [number, number, number, number, number, number]; // bounding box, mm
  vo: number; vc: number; io: number; ic: number;
  f?: string; t?: string; sy?: string; r?: string;
  hasins?: number; // index of the insulation wrapping it, when the model has one
};

export type Clash = {
  id: string; a: number; b: number;
  sev: 'major' | 'minor' | 'touch' | 'penetration';
  p: [number, number, number]; pair: string; hole: number | null; zone?: number;
};

export type Circuit = { group: string; members: number[]; x0: number; x1: number };

export type Model = {
  origin: [number, number, number]; step: number; centre: [number, number, number];
  bmin: [number, number, number]; bmax: [number, number, number];
  npos: number; nidx: number;
  layers: string[];
  links: { code: string; label: string; number: string; rev: string }[];
  elements: Element[];
  clashes: Clash[];
  adj: number[][];
  circuitOf: number[];
  circuits: Circuit[];
  holes: { i: number; circuits: number[] }[];
  pos: Uint16Array;
  idx: Uint16Array;
};

let loading: Promise<Model> | null = null;

export function loadModel(): Promise<Model> {
  loading ??= (async () => {
    const [meta, bin] = await Promise.all([
      fetch('/beta/ncw/model.json').then((r) => r.json()),
      fetch('/beta/ncw/geom.bin').then((r) => r.blob()),
    ]);
    const buf = await new Response(bin.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const pos = new Uint16Array(buf, 0, meta.npos * 3);
    const idx = new Uint16Array(buf, meta.npos * 6, meta.nidx);
    return { ...meta, pos, idx } as Model;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

export type Box = [number, number, number, number, number, number];

export const centreOf = (b: Box): [number, number, number] => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];

export const overlaps = (a: Box, b: Box, tol = 0) => [0, 1, 2].every((k) => a[k] - tol <= b[k + 3] && b[k] - tol <= a[k + 3]);

export function unionBox(model: Model, ids: Iterable<number>): Box | null {
  let box: Box | null = null;
  for (const i of ids) {
    const b = model.elements[i].b;
    box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.min(box[2], b[2]), Math.max(box[3], b[3]), Math.max(box[4], b[4]), Math.max(box[5], b[5])] : [...b];
  }
  return box;
}

// Elements whose boxes enter a zone, e.g. what stands in a maintenance access envelope
export function inside(model: Model, zone: Box, skip: Set<number> = new Set()) {
  return model.elements.filter((e) => !skip.has(e.i) && e.g !== 'WALL' && overlaps(zone, e.b)).map((e) => e.i);
}

// Breadth-first tree over a circuit from its source elements; children[i] lists what i feeds
export function feedTree(model: Model, sources: number[]) {
  const parent = new Map<number, number>();
  const order: number[] = [];
  const queue = [...sources];
  for (const s of sources) parent.set(s, -1);
  while (queue.length) {
    const x = queue.shift()!;
    order.push(x);
    for (const y of model.adj[x]) if (!parent.has(y)) { parent.set(y, x); queue.push(y); }
  }
  const children = new Map<number, number[]>();
  for (const [c, p] of parent) if (p !== -1) (children.get(p) ?? children.set(p, []).get(p)!).push(c);
  return { parent, children, order };
}

// Everything that depends on an element: its subtree in the feed tree
export function downstream(tree: ReturnType<typeof feedTree>, from: number) {
  const out = new Set<number>([from]);
  const stack = [from];
  while (stack.length) for (const c of tree.children.get(stack.pop()!) ?? []) if (!out.has(c)) { out.add(c); stack.push(c); }
  return out;
}

// The route back to the source, for showing how something is fed
export function upstream(tree: ReturnType<typeof feedTree>, from: number) {
  const out: number[] = [];
  for (let x: number | undefined = from; x !== undefined && x !== -1; x = tree.parent.get(x)) out.push(x);
  return out;
}

export const byMark = (model: Model, mark: string) => model.elements.find((e) => e.m === mark)!;
