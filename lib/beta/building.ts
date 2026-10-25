// The building-management layer over the corridor model: spaces, systems, asset records, situations
// and the building's history. Geometry, marks, families and clashes come from the model; dates,
// manufacturers, costs and service records are sample data.
import { centreOf, downstream, feedTree, inside, overlaps, type Box, type Model } from './model';

export const TODAY = '2026-10-25';

/* ---------- spaces ---------- */

export type Space = { id: string; name: string; kind: 'room' | 'riser' | 'corridor' | 'beyond'; box: Box };

const Z: [number, number] = [-2400, -500];
const north: [number, number] = [-5600, -4300];
const south: [number, number] = [-7700, -7100];
const sp = (id: string, name: string, kind: Space['kind'], x: [number, number], y: [number, number]): Space =>
  ({ id, name, kind, box: [x[0], y[0], Z[0], x[1], y[1], Z[1]] });

export const SPACES: Space[] = [
  sp('R1', 'Riser 1', 'riser', [-9700, -9300], [-7300, -5600]),
  sp('R2', 'Riser 2', 'riser', [-5627, -2478], north),
  sp('1.01', 'Bedroom 1.01', 'room', [-9300, -8353], north),
  sp('1.03', 'Bedroom 1.03', 'room', [-8353, -5627], north),
  sp('1.05', 'Bedroom 1.05', 'room', [-2478, -700], north),
  sp('1.07', 'Bedroom 1.07', 'room', [-700, 1860], north),
  sp('1.02', 'Bedroom 1.02', 'room', [-9300, -7400], south),
  sp('1.04', 'Bedroom 1.04', 'room', [-7400, -6043], south),
  sp('1.06', 'Bedroom 1.06', 'room', [-6043, -4993], south),
  sp('1.08', 'Bedroom 1.08', 'room', [-4993, -3000], south),
  sp('1.10', 'Bedroom 1.10', 'room', [-3000, -1000], south),
  sp('1.12', 'Bedroom 1.12', 'room', [-1000, 1860], south),
  sp('C', 'Corridor', 'corridor', [-9300, 1860], [-7100, -5600]),
  sp('E', 'East wing', 'beyond', [1860, 3000], [-7700, -4300]),
];

export const spaceAt = (p: [number, number, number]) =>
  SPACES.find((s) => s.kind !== 'corridor' && p[0] >= s.box[0] && p[0] <= s.box[3] && p[1] >= s.box[1] && p[1] <= s.box[4]) ??
  SPACES.find((s) => s.id === 'C')!;

/* ---------- systems ---------- */

export type SystemId = 'hw' | 'chw' | 'drain' | 'spr' | 'vent' | 'power';

export type System = {
  id: SystemId; name: string; short: string; colour: string;
  group: string; // the model's run, a pipe material or DUCT / TRAY
  source: 'R1' | 'R2' | 'E'; // where it enters the corridor
  plant: { mark: string; name: string; where: string }[];
  flow: 'feeds' | 'drains'; // drainage runs toward its source
};

export const SYSTEMS: System[] = [
  { id: 'hw', name: 'Domestic hot water', short: 'Hot water', colour: '#E5484D', group: 'Copper, press-fit', source: 'R2', flow: 'feeds',
    plant: [{ mark: 'PU-HW-02', name: 'Secondary circulation pump', where: 'Basement plant room' }, { mark: 'CAL-01', name: 'Calorifier', where: 'Basement plant room' }] },
  { id: 'chw', name: 'Chilled water', short: 'Chilled water', colour: '#3E9BFF', group: 'Stainless steel, welded', source: 'R2', flow: 'feeds',
    plant: [{ mark: 'PU-CHW-01', name: 'Chilled water pump', where: 'Roof plant' }, { mark: 'CH-01', name: 'Air-cooled chiller', where: 'Roof plant' }] },
  { id: 'drain', name: 'Soil and waste', short: 'Drainage', colour: '#A18072', group: 'Geberit HDPE drainage', source: 'R2', flow: 'drains',
    plant: [{ mark: 'SVP-2', name: 'Soil stack', where: 'Riser 2' }] },
  { id: 'spr', name: 'Sprinklers', short: 'Sprinklers', colour: '#F76B15', group: 'Fire protection, Victaulic grooved', source: 'R2', flow: 'feeds',
    plant: [{ mark: 'SV-01', name: 'Sprinkler valve set', where: 'Basement plant room' }] },
  { id: 'vent', name: 'Supply air', short: 'Ventilation', colour: '#2EBDE5', group: 'DUCT', source: 'E', flow: 'feeds',
    plant: [{ mark: 'AHU-02', name: 'Air handling unit', where: 'Roof plant' }] },
  { id: 'power', name: 'Power and data containment', short: 'Power & data', colour: '#FFC53D', group: 'TRAY', source: 'R1', flow: 'feeds',
    plant: [{ mark: 'DB-L1', name: 'Level 1 distribution board', where: 'Riser 1' }] },
];

export const systemById = (id: SystemId) => SYSTEMS.find((s) => s.id === id)!;

export function systemOf(model: Model, i: number): System | null {
  const c = model.circuitOf[i];
  return c === -1 ? null : SYSTEMS.find((s) => s.group === model.circuits[c].group) ?? null;
}

export const circuitsOf = (model: Model, sys: System) => model.circuits.flatMap((c, k) => (c.group === sys.group ? [k] : []));

export const membersOf = (model: Model, sys: System) => circuitsOf(model, sys).flatMap((c) => model.circuits[c].members);

// Holes through walls, each with the space it opens into and the elements passing through it
export type Hole = { i: number; space: Space; through: number[] };

export function holesOf(model: Model): Hole[] {
  return model.holes.map((h) => {
    const e = model.elements[h.i];
    const through = model.elements.filter((x) => model.circuitOf[x.i] !== -1 && overlaps(e.b, x.b, 2)).map((x) => x.i);
    return { i: h.i, space: spaceAt(centreOf(e.b)), through };
  });
}

const touchesSource = (model: Model, i: number, src: Space) => overlaps(model.elements[i].b, src.box, 30);

// Where each system enters: members in its source space, or the circuit's end nearest it
export function systemTree(model: Model, sys: System) {
  const src = SPACES.find((s) => s.id === sys.source)!;
  const sources: number[] = [];
  for (const c of circuitsOf(model, sys)) {
    const m = model.circuits[c].members;
    const inSrc = m.filter((i) => touchesSource(model, i, src));
    if (inSrc.length) { sources.push(...inSrc); continue; }
    const sx = (src.box[0] + src.box[3]) / 2;
    const near = m.reduce((a, b) => (Math.abs(centreOf(model.elements[a].b)[0] - sx) <= Math.abs(centreOf(model.elements[b].b)[0] - sx) ? a : b));
    sources.push(near);
  }
  return feedTree(model, sources);
}

const within = (s: Space, p: [number, number, number]) => p[0] >= s.box[0] && p[0] <= s.box[3] && p[1] >= s.box[1] && p[1] <= s.box[4];

// Where a set of parts reaches into rooms: through wall holes, or by branching into the room's footprint.
// Runs cut by the model's east edge carry on into the next wing.
export type Entry = { space: Space; holes: number[]; branch: number[] };

export function entriesOf(model: Model, ids: Set<number>): Entry[] {
  const holes = holesOf(model);
  const out: Entry[] = [];
  for (const space of SPACES) {
    if (space.kind !== 'room' && space.kind !== 'beyond') continue;
    const via = holes.filter((h) => h.space.id === space.id && h.through.some((t) => ids.has(t))).map((h) => h.i);
    const branch = space.kind === 'beyond'
      ? [...ids].filter((i) => model.elements[i].b[3] > 1860)
      : [...ids].filter((i) => within(space, centreOf(model.elements[i].b)));
    if (via.length || branch.length) out.push({ space, holes: via, branch });
  }
  return out;
}

// What depends on an element: everything downstream of it, and the spaces that reaches
export function impactOf(model: Model, i: number) {
  const sys = systemOf(model, i);
  if (!sys) return null;
  const els = downstream(systemTree(model, sys), i);
  const entries = entriesOf(model, els);
  return { sys, els, entries, spaces: entries.map((e) => e.space) };
}

// Everything serving a space, system by system
export function servicesTo(model: Model, spaceId: string) {
  const out: { sys: System; entry: Entry }[] = [];
  for (const sys of SYSTEMS) {
    const entry = entriesOf(model, new Set(membersOf(model, sys))).find((e) => e.space.id === spaceId);
    if (entry) out.push({ sys, entry });
  }
  return out;
}

/* ---------- asset records ---------- */

export type Alternative = {
  maker: string; product: string; price: number; lead: string;
  checks: { ok: boolean; text: string }[];
};

export type Passport = {
  mark: string; name: string; maker: string; product: string; serial: string;
  installed: string; warranty: string; condition: 'Good' | 'Fair' | 'Poor' | 'Failed';
  lastService?: string; nextDue?: string; dutyNote?: string;
  documents: string[];
  history: { date: string; text: string; by: string }[];
  replace: { cost: number; lead: string; life: string; alternatives: Alternative[] };
};

const damper = (mark: string, serial: string, condition: Passport['condition'], last: string, extra: Passport['history'] = []): Passport => ({
  mark, name: 'Fire damper', maker: 'TROX', product: 'FKA2-EU 200 × 200 × 305, 230 V spring return', serial,
  installed: '2025-11-18', warranty: '2027-11-18', condition, lastService: last, nextDue: '2026-11-04',
  dutyNote: 'Annual drop test (BS 9999 Annex W)',
  documents: ['O&M manual, section 7.3', 'Declaration of performance', 'Drop test certificate, Mar 2026'],
  history: [{ date: '2026-03-12', text: 'Drop test passed, reset', by: 'Halton FM' }, ...extra, { date: '2025-11-18', text: 'Installed and commissioned', by: 'Northfield Mechanical' }],
  replace: {
    cost: 1180, lead: '3 weeks', life: '25 years',
    alternatives: [
      { maker: 'TROX', product: 'FKA2-EU, like for like', price: 1180, lead: '3 weeks', checks: [
        { ok: true, text: 'Same 305 mm casing, fits the existing opening' }, { ok: true, text: 'Keeps the fire-stopping certificate valid' }] },
      { maker: 'Actionair', product: 'Smokeshield 200 × 200', price: 940, lead: '1 week', checks: [
        { ok: true, text: 'Fits the opening' }, { ok: false, text: '375 mm casing, duct needs shortening by 70 mm' }, { ok: false, text: 'Fire-stopping must be redone and re-certified' }] },
      { maker: 'Ruskin', product: 'FSD60 retrofit actuator only', price: 410, lead: '4 days', checks: [
        { ok: true, text: 'No duct or fire-stopping work' }, { ok: false, text: 'Engineer to confirm it is approved for this casing' }] },
    ],
  },
});

export const PASSPORTS: Record<string, Passport> = {
  'PU-HW-02': {
    mark: 'PU-HW-02', name: 'Secondary hot water circulation pump', maker: 'Grundfos', product: 'MAGNA3 40-120 F', serial: 'GF-98221704',
    installed: '2025-12-02', warranty: '2027-12-02', condition: 'Failed', lastService: '2026-06-14', nextDue: '2026-12-14',
    dutyNote: 'Duty pump, PU-HW-01 on standby',
    documents: ['O&M manual, section 4.2', 'Pump curve and duty point', 'Commissioning record'],
    history: [
      { date: '2026-10-25', text: 'Tripped on overload, standby PU-HW-01 took over', by: 'BMS alarm' },
      { date: '2026-06-14', text: 'Six-month service, bearing noise noted', by: 'Halton FM' },
      { date: '2025-12-02', text: 'Installed and commissioned', by: 'Northfield Mechanical' }],
    replace: { cost: 2350, lead: '5 days', life: '15 years', alternatives: [
      { maker: 'Grundfos', product: 'MAGNA3 40-120 F, like for like', price: 2350, lead: '5 days', checks: [
        { ok: true, text: 'Same flanges and duty point' }, { ok: true, text: 'Keeps the existing BMS points' }] },
      { maker: 'Wilo', product: 'Stratos MAXO 40/0,5-12', price: 1960, lead: '2 days', checks: [
        { ok: true, text: 'Meets the duty point' }, { ok: false, text: '30 mm longer, pipework needs adapting' }, { ok: false, text: 'New Modbus mapping for the BMS' }] },
      { maker: 'Grundfos', product: 'Repair kit and new motor bearing', price: 620, lead: '3 days', checks: [
        { ok: true, text: 'No pipework change' }, { ok: false, text: 'Pump is 11 months old, warranty claim first' }] },
    ] },
  },
  'FD-01': damper('FD-01', 'TX-4410221', 'Good', '2026-03-12'),
  'FD-02': damper('FD-02', 'TX-4410225', 'Good', '2026-03-12'),
  'FD-03': damper('FD-03', 'TX-4410219', 'Failed', '2026-10-23', [{ date: '2026-10-23', text: 'Failed drop test, actuator did not release', by: 'Halton FM' }]),
  'FD-04': damper('FD-04', 'TX-4410230', 'Good', '2026-03-12'),
  'FD-05': damper('FD-05', 'TX-4410231', 'Fair', '2026-03-12', [{ date: '2026-03-12', text: 'Slow to close, within tolerance', by: 'Halton FM' }]),
};

const MAKERS: Partial<Record<string, string>> = {
  Downlight: 'Thorlux', 'PIR detector': 'Danlers', 'Fused connection unit': 'MK Electric', 'Exit sign': 'Eaton',
  'Volume control damper': 'Halton', 'Pipe segment': 'Contractor supply', 'Duct segment': 'Contractor supply',
};

// A record for anything in the model: sample passports where they exist, otherwise what the model knows
export function passportFor(model: Model, i: number): Passport {
  const e = model.elements[i];
  if (PASSPORTS[e.m]) return PASSPORTS[e.m];
  const sys = systemOf(model, i);
  return {
    mark: e.m, name: e.c, maker: MAKERS[e.c] ?? (e.sy?.split(',')[0] ?? 'Contractor supply'),
    product: [e.f, e.t].filter(Boolean).join(', ') || e.z, serial: e.r ? `Revit ${e.r}` : 'Not recorded',
    installed: installDate(sys?.id), warranty: '2027-02-01', condition: 'Good',
    documents: sys ? [`${sys.name} O&M manual`] : [],
    history: [{ date: installDate(sys?.id), text: 'Installed', by: 'Northfield Mechanical' }],
    replace: { cost: 0, lead: 'Stock item', life: '25 years', alternatives: [] },
  };
}

const INSTALL: Record<SystemId, string> = {
  power: '2025-09-15', drain: '2025-10-06', vent: '2025-10-27', spr: '2025-11-03', hw: '2025-11-10', chw: '2025-11-24',
};
export const installDate = (sys?: SystemId) => (sys ? INSTALL[sys] : '2025-12-08');

/* ---------- maintenance access ---------- */

// The space a technician needs below an item to reach it from the ceiling
export const accessZone = (b: Box): Box => [b[0] - 150, b[1] - 150, b[2] - 650, b[3] + 150, b[4] + 150, b[2]];

export function obstructions(model: Model, i: number) {
  const e = model.elements[i];
  // What it is fixed to (its own duct or pipe) is not in the way
  const skip = new Set<number>([i, ...model.adj[i]]);
  return inside(model, accessZone(e.b), skip).filter((x) => model.elements[x].c !== 'Wall penetration (builder’s work hole)');
}

/* ---------- situations ---------- */

export type Option = {
  id: string; title: string; cost: number; time: string; disruption: 'None' | 'Low' | 'Medium' | 'High';
  checks: { ok: boolean; text: string }[];
};

export type Situation = {
  id: string; when: 'Now' | 'This week' | 'Planned' | 'Opportunity';
  tone: 'alert' | 'warn' | 'info' | 'ok';
  title: string; summary: string;
  system?: SystemId; marks: string[]; // elements in focus
  options: Option[];
};

export const SITUATIONS: Situation[] = [
  { id: 'pump', when: 'Now', tone: 'alert', title: 'Hot water pump PU-HW-02 tripped',
    summary: 'The standby pump took over at 06:40. Hot water is running with no backup.',
    system: 'hw', marks: [],
    options: [
      { id: 'warranty', title: 'Warranty claim, repair the motor', cost: 0, time: '3 to 5 days', disruption: 'None', checks: [
        { ok: true, text: 'Pump is 11 months old, inside warranty' }, { ok: false, text: 'No standby while it is away' }] },
      { id: 'like', title: 'Replace like for like', cost: 2350, time: '5 days', disruption: 'Low', checks: [
        { ok: true, text: 'Same flanges, duty point and BMS points' }, { ok: true, text: 'Two-hour drain-down of the secondary circuit' }] },
      { id: 'wilo', title: 'Fit the Wilo alternative', cost: 1960, time: '2 days', disruption: 'Medium', checks: [
        { ok: false, text: 'Pipework needs adapting, 30 mm longer' }, { ok: false, text: 'Engineer to confirm the duty point' }] },
    ] },
  { id: 'inspect', when: 'This week', tone: 'warn', title: 'Fire damper drop tests due 4 Nov',
    summary: 'Five dampers above the corridor ceiling need their annual test.',
    system: 'vent', marks: ['FD-01', 'FD-02', 'FD-03', 'FD-04', 'FD-05'],
    options: [
      { id: 'night', title: 'Test overnight, one ceiling bay at a time', cost: 640, time: '1 night', disruption: 'Low', checks: [
        { ok: true, text: 'Corridor stays open' }, { ok: false, text: 'Two dampers have restricted access' }] },
      { id: 'panels', title: 'Fit access panels first, then test', cost: 1480, time: '2 nights', disruption: 'Medium', checks: [
        { ok: true, text: 'Clears access for future tests' }, { ok: false, text: 'Engineer to set panel positions' }] },
    ] },
  { id: 'replace', when: 'This week', tone: 'alert', title: 'FD-03 failed its drop test',
    summary: 'The actuator did not release. The damper must be fixed before the room above is re-let.',
    system: 'vent', marks: ['FD-03'],
    options: PASSPORTS['FD-03'].replace.alternatives.map((a, k) => ({
      id: `alt${k}`, title: `${a.maker} ${a.product}`, cost: a.price, time: a.lead, disruption: k === 1 ? 'High' : 'Low', checks: a.checks })),
  },
  { id: 'modify', when: 'Planned', tone: 'info', title: 'Room 1.10 refit needs a new extract duct',
    summary: 'A 200 × 200 extract has to cross the corridor ceiling to Riser 2.',
    system: 'vent', marks: [],
    options: [
      { id: 'high', title: 'Route A, high level above the trays', cost: 4200, time: '3 nights', disruption: 'Medium', checks: [] },
      { id: 'low', title: 'Route B, low level beside the sprinkler main', cost: 3600, time: '2 nights', disruption: 'Medium', checks: [] },
    ] },
  { id: 'cost', when: 'Opportunity', tone: 'ok', title: 'Cut the corridor’s running costs',
    summary: 'Lighting runs all night and part of the chilled water main is bare.',
    marks: [],
    options: [
      { id: 'pir', title: 'Dim the downlights on the existing PIRs', cost: 900, time: '1 day', disruption: 'None', checks: [
        { ok: true, text: 'Three PIR detectors are already in the ceiling' }, { ok: true, text: 'Emergency fittings stay at full output' }] },
      { id: 'lag', title: 'Insulate the bare chilled water pipe', cost: 2100, time: '2 nights', disruption: 'Low', checks: [
        { ok: false, text: 'Clearance to the drainage below is tight in places' }] },
    ] },
];

// Two candidate routes for the Room 1.10 extract, as boxes across the corridor ceiling void (mm)
export const ROUTES: Record<'high' | 'low', Box> = {
  high: [-2300, -7140, -900, -2100, -5500, -700],
  low: [-1900, -7140, -1300, -1700, -5500, -1100],
};

export function routeConflicts(model: Model, route: Box) {
  return inside(model, route).filter((i) => model.elements[i].s === 'MEP' && !model.elements[i].c.startsWith('Wall penetration'));
}

// The cost situation's evidence, read from the model
export function savings(model: Model) {
  const lights = model.elements.filter((e) => e.s === 'MEP' && (e.c === 'Downlight' || e.c === 'Exit sign'));
  const pirs = model.elements.filter((e) => e.s === 'MEP' && e.c === 'PIR detector');
  const chw = membersOf(model, systemById('chw')).map((i) => model.elements[i]);
  const bare = chw.filter((e) => e.c === 'Pipe segment' && e.hasins === undefined).map((e) => e.i);
  return { lights: lights.map((e) => e.i), pirs: pirs.map((e) => e.i), bare };
}

/* ---------- history ---------- */

export type Moment = {
  id: string; date: string; track: 'Design' | 'Build' | 'Operate' | 'Change';
  title: string; detail?: string;
  marks?: string[]; systems?: SystemId[];
  planned?: boolean;
};

export const MOMENTS: Moment[] = [
  { id: 'str', date: '2025-01-20', track: 'Design', title: 'Structural model P04', detail: 'NCW-FRM-ZZ-ZZ-M3-S-106-151' },
  { id: 'arch24', date: '2025-04-07', track: 'Design', title: 'Architectural model P24', detail: 'Riser 2 widened by 300 mm' },
  { id: 'arch28', date: '2025-07-14', track: 'Design', title: 'Architectural model P28', detail: 'Coordinated with MEP, 32 builder’s work holes agreed' },
  { id: 'bed4', date: '2025-08-04', track: 'Design', title: 'Bedroom interiors rev 4', detail: 'NCW-ADA-ZZ-ZZ-M3-I-106-801' },
  { id: 'i-power', date: INSTALL.power, track: 'Build', title: 'Containment installed', systems: ['power'] },
  { id: 'i-drain', date: INSTALL.drain, track: 'Build', title: 'Drainage installed', systems: ['drain'] },
  { id: 'i-vent', date: INSTALL.vent, track: 'Build', title: 'Ductwork and dampers installed', systems: ['vent'] },
  { id: 'i-spr', date: INSTALL.spr, track: 'Build', title: 'Sprinkler mains installed', systems: ['spr'] },
  { id: 'i-hw', date: INSTALL.hw, track: 'Build', title: 'Hot water installed', systems: ['hw'] },
  { id: 'i-chw', date: INSTALL.chw, track: 'Build', title: 'Chilled water installed', systems: ['chw'] },
  { id: 'handover', date: '2026-02-02', track: 'Build', title: 'Handover', detail: 'O&M manuals and asset register issued' },
  { id: 'fd-test', date: '2026-03-12', track: 'Operate', title: 'Fire damper drop tests', detail: 'All five passed, FD-05 slow', marks: ['FD-01', 'FD-02', 'FD-03', 'FD-04', 'FD-05'] },
  { id: 'pump-svc', date: '2026-06-14', track: 'Operate', title: 'Pump service', detail: 'Bearing noise noted on PU-HW-02', systems: ['hw'] },
  { id: 'fd3-fail', date: '2026-10-23', track: 'Operate', title: 'FD-03 failed its drop test', marks: ['FD-03'] },
  { id: 'pump-trip', date: '2026-10-25', track: 'Operate', title: 'PU-HW-02 tripped', systems: ['hw'] },
  { id: 'fd3-fix', date: '2026-11-12', track: 'Change', title: 'FD-03 replacement', marks: ['FD-03'], planned: true },
  { id: 'r110', date: '2027-01-18', track: 'Change', title: 'Room 1.10 refit, new extract', planned: true, detail: 'Two routes proposed' },
  { id: 'led', date: '2027-04-05', track: 'Change', title: 'Corridor lighting controls', planned: true },
];

/* ---------- review threads ---------- */

export type View = { pos: [number, number, number]; target: [number, number, number] };

export type Post = {
  who: 'manager' | 'engineer'; name: string; date: string; text: string;
  marks?: string[]; view?: View;
  proposals?: { id: string; title: string; text: string; route?: 'high' | 'low'; risk?: string }[];
};

export type Thread = { id: string; title: string; moment?: string; situation?: string; status: 'Open' | 'Proposal' | 'Agreed'; posts: Post[] };

export const THREADS: Thread[] = [
  { id: 't-r110', title: 'Room 1.10 extract route', moment: 'r110', situation: 'modify', status: 'Proposal', posts: [
    { who: 'manager', name: 'Facilities manager', date: '2026-10-14', text: 'The refit needs extract from the new ensuite. Can it reach Riser 2 without closing the corridor for a week?', marks: [] },
    { who: 'engineer', name: 'TALO Engine', date: '2026-10-17', text: 'Two routes work. Both need a new hole in the north wall.',
      proposals: [
        { id: 'high', title: 'Route A, high level', route: 'high', text: 'Runs above the cable trays. Fewer crossings, but the void is tight near the drainage.', risk: 'Needs the ELV basket lowered 50 mm for one bay.' },
        { id: 'low', title: 'Route B, low level', route: 'low', text: 'Runs beside the sprinkler main. Cheaper, one night less.', risk: 'Sits 40 mm above the ceiling grid; no room for future services.' },
      ] },
  ] },
  { id: 't-fd3', title: 'FD-03 access', moment: 'fd3-fail', situation: 'replace', status: 'Open', posts: [
    { who: 'manager', name: 'Facilities manager', date: '2026-10-23', text: 'FD-03 failed. The tester could not reach the actuator past the fused spur.', marks: ['FD-03', 'FCU-05'] },
  ] },
];
