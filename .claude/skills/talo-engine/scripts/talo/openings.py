"""Builders' work openings: modelled hole families, and proposed openings where a service crosses a wall or floor with none.

Modelled holes take their through-axis and depth from the wall or floor they sit in (found by casting rays against its mesh),
and their services are what passes through that slab. A crossing with no adequate hole gets a proposed opening sized to the
service plus the clearance for its discipline, rounded up. Services whose openings would overlap share one rectangular opening.
Every proposed opening starts as Proposed, and is flagged for review when the wall is structural, fire-rated, of a listed
material, or of unknown construction. Nothing is proposed where the model has no wall or floor geometry.
"""
import re
import collections
import numpy as np
import trimesh
from .clash import SERVICE, tm
from .classify import BoxIndex

AXN = 'XYZ'


def cross_ax(ax):
    return (0, 1) if ax == 2 else ((1 if ax == 0 else 0), 2)


def box_hit(a, b, t=0.0):
    return all(a[k] < b[k + 3] - t and a[k + 3] > b[k] + t for k in range(3))


class Openings:
    def __init__(self, elements, crossings, cfg, levels, ref_level):
        self.E, self.X, self.cfg, self.levels = elements, crossings, cfg['openings'], levels
        self.need = {d['id']: d['clearance'] for d in cfg['disciplines'] if d.get('clearance') is not None}
        self.ref_level = ref_level
        self.rays = {}
        self.open = []                                  # opening dicts
        self.report = collections.Counter()
        self.index = BoxIndex([e['bbox'] for e in elements])     # neighbour queries instead of scanning every element

    def near(self, b, pad=0.0):
        return self.index.near(b, pad)

    # --- geometry helpers, all in model mm
    def is_service(self, e):
        return e['discipline'] in self.need and e['role'] not in ('insulation', 'support', 'opening')

    def slab_section(self, i, ax, a0, a1):
        """A service's cross-section inside the slab a0..a1 along ax: [u0, u1, v0, v1]."""
        v = self.E[i]['verts']
        u, w = cross_ax(ax)
        m = (v[:, ax] >= a0) & (v[:, ax] <= a1)
        if m.sum() >= 3:
            s = v[m]
            r = [s[:, u].min(), s[:, u].max(), s[:, w].min(), s[:, w].max()]
            if r[1] - r[0] > 5 and r[3] - r[2] > 5:
                return r
        b = self.E[i]['bbox']
        return [b[u], b[u + 3], b[w], b[w + 3]]

    def svc_section(self, i, ax, a0, a1):
        r = self.slab_section(i, ax, a0, a1)
        ins = self.E[i].get('insulation')
        if ins is None:
            return r
        q = self.slab_section(ins, ax, a0, a1)
        return [min(r[0], q[0]), max(r[1], q[1]), min(r[2], q[2]), max(r[3], q[3])]

    def spans_along(self, pt, ax, frm, to, walls):
        """Solid spans a ray along ax meets in the given walls (faces under 250 mm apart are one wall)."""
        o = np.array(pt, float); o[ax] = frm
        d = np.zeros(3); d[ax] = 1
        ts = []
        for w in walls:
            if w not in self.rays:
                self.rays[w] = trimesh.ray.ray_triangle.RayMeshIntersector(tm(self.E[w]))
            loc, _, _ = self.rays[w].intersects_location([o], [d], multiple_hits=True)
            ts += [frm + float(np.dot(p - o, d)) for p in loc if 0 <= np.dot(p - o, d) <= to - frm]
        ts.sort()
        spans = []
        for t in ts:
            if spans and t - spans[-1][1] < 250:
                spans[-1][1] = t
            else:
                spans.append([t, t])
        return [s for s in spans if 12 <= s[1] - s[0] <= 450]

    def passes(self, o, i):
        u, w = cross_ax(o['ax'])
        r = self.svc_section(i, o['ax'], o['s0'], o['s1'])
        su, sv = (r[0] + r[1]) / 2, (r[2] + r[3]) / 2
        b = o['bbox']
        return b[u] < su < b[u + 3] and b[w] < sv < b[w + 3]

    def clearance(self, o):
        u, w = cross_ax(o['ax'])
        b = o['bbox']
        cu, cv = (b[u] + b[u + 3]) / 2, (b[w] + b[w + 3]) / 2
        gaps = []
        for i in o['services']:
            r = self.svc_section(i, o['ax'], o['s0'], o['s1'])
            if o['shape'] == 'circular':
                R = o['diameter'] / 2
                g = R - (np.hypot((r[0] + r[1]) / 2 - cu, (r[2] + r[3]) / 2 - cv) + max(r[1] - r[0], r[3] - r[2]) / 2)
            else:
                g = min(r[0] - b[u], b[u + 3] - r[1], r[2] - b[w], b[w + 3] - r[3])
            need = 0 if self.E[i]['role'] == 'fire-damper' else self.need.get(self.E[i]['discipline'], 0)
            gaps.append({'service': i, 'gap': round(float(g), 1), 'need': need})
        o['gaps'] = gaps
        o['verdict'] = 'empty' if not gaps else 'clash' if any(g['gap'] < 0 for g in gaps) else 'tight' if any(g['gap'] < g['need'] for g in gaps) else 'ok'

    def round_up(self, v):
        r = self.cfg['roundTo']
        return int(np.ceil(v / r) * r)

    # --- the passes
    def run(self):
        E = self.E
        walls_present = any(e['discipline'] in ('WALL', 'FLOOR') for e in E)
        if not walls_present:
            self.report['no wall or floor geometry: crossings and proposed openings not checked'] = 1
        holes = [i for i, e in enumerate(E) if e['role'] == 'opening']
        for h in holes:
            self.modelled(h)
        pen = [c for c in self.X if self.is_service(E[c['service']])]
        cand = []
        for c in pen:
            self.crossing(c, cand)
        self.merge(cand)
        for q in cand:
            self.propose(q)
        for o in self.open:
            bb = list(o['bbox']); bb[o['ax']] -= 200; bb[o['ax'] + 3] += 200
            o['dampers'] = [i for i in sorted(self.near(bb)) if E[i]['role'] == 'fire-damper' and box_hit(E[i]['bbox'], bb)]
        self.number()
        for o in self.open:
            if o['status'] == 'proposed':
                o['overlaps'] = [p for p in self.open if p['status'] == 'modelled' and box_hit(p['bbox'], o['bbox'])]
            else:
                o['overlaps'] = []
            self.review(o)
        return self.open

    def modelled(self, h):
        E, e = self.E, self.E[h]
        hb = e['bbox']
        circ = bool(re.search(r'circular|round|core', ' '.join(filter(None, [e['family'], e['familyType']])), re.I))
        dims = [hb[k + 3] - hb[k] for k in range(3)]
        cen = [(hb[k] + hb[k + 3]) / 2 for k in range(3)]
        walls = sorted({c['wall'] for c in self.X if box_hit(E[c['wall']]['bbox'], hb, -20)}) or \
                [i for i in self.near(hb) if E[i]['discipline'] in ('WALL', 'FLOOR') and box_hit(E[i]['bbox'], hb)]
        span_at = lambda ax: next((s for s in self.spans_along(cen, ax, cen[ax] - 700, cen[ax] + 700, walls) if s[0] - 30 < cen[ax] < s[1] + 30), None) if walls else None
        ax = None
        if circ:
            ax = next((k for k in range(3) if abs(dims[cross_ax(k)[0]] - dims[cross_ax(k)[1]]) < 2), None)
        if ax is None and walls:
            best = float('inf')
            for k in range(3):
                s = span_at(k)
                if s and abs(s[1] - s[0] - dims[k]) < best:
                    best, ax = abs(s[1] - s[0] - dims[k]), k
        if ax is None:
            ax = int(np.argmin(dims))
        sp = span_at(ax)
        s0, s1 = (max(sp[0], hb[ax]), min(sp[1], hb[ax + 3])) if sp else (hb[ax], hb[ax + 3])
        u, w = cross_ax(ax)
        o = {'status': 'modelled', 'element': h, 'shape': 'circular' if circ else 'rectangular', 'ax': ax, 'bbox': list(hb), 's0': s0, 's1': s1,
             'width': dims[u], 'height': dims[w], 'diameter': (dims[u] + dims[w]) / 2 if circ else None, 'depth': dims[ax],
             'walls': walls, 'crossings': [], 'wallFound': bool(sp)}
        o['services'] = [i for i in sorted(self.near(hb)) for s in (E[i],) if self.is_service(s) and box_hit(s['bbox'], hb, 2)
                         and min(s['bbox'][ax + 3], s1) - max(s['bbox'][ax], s0) > min(20, (s1 - s0) / 2) and self.passes(o, i)]
        self.clearance(o)
        self.open.append(o)
        e['_open'] = o

    def in_hole(self, pt):
        for o in self.open:
            b = o['bbox']
            if all(b[k] - 20 < pt[k] < b[k + 3] + 20 for k in range(3)):
                return o
        return None

    def crossing(self, c, cand):
        E = self.E
        d = E[c['service']]
        if c.get('hole') is not None and E[c['hole']].get('_open') and c['service'] in E[c['hole']]['_open']['services']:
            o = E[c['hole']]['_open']; c['opening'] = o; o['crossings'].append(c['id']); return
        order = sorted(range(3), key=lambda k: -(d['bbox'][k + 3] - d['bbox'][k]))
        ax, spans = -1, []
        for k in order:
            lo, hi = c['point'][k] - c['overlap'][k] / 2 - 30, c['point'][k] + c['overlap'][k] / 2 + 30
            spans = [s for s in self.spans_along(c['point'], k, d['bbox'][k] - 20, d['bbox'][k + 3] + 20, [c['wall']]) if s[1] > lo and s[0] < hi]
            if spans:
                ax = k; break
        if ax < 0:
            c['opening'] = None; return                  # runs along the wall rather than through it
        for sp in spans:
            pt = list(c['point']); pt[ax] = (sp[0] + sp[1]) / 2
            h = self.in_hole(pt)
            if h is not None and (c['service'] in h['services'] or self.passes(h, c['service'])):
                c['opening'] = h
                if c['service'] not in h['services']:
                    h['services'].append(c['service']); self.clearance(h)
                h['crossings'].append(c['id']); continue
            same = next((q for q in cand if q['ax'] == ax and c['service'] in q['services'] and abs((q['a0'] + q['a1']) / 2 - pt[ax]) < self.cfg['mergeWithin']), None)
            if same:
                same['a0'], same['a1'] = min(same['a0'], sp[0]), max(same['a1'], sp[1])
                if c['wall'] not in same['walls']:
                    same['walls'].append(c['wall'])
                same['crossings'].append(c); continue
            cand.append({'ax': ax, 'a0': sp[0], 'a1': sp[1], 'services': [c['service']], 'walls': [c['wall']], 'crossings': [c]})

    def rect_of(self, q):
        need = max(self.need.get(self.E[i]['discipline'], 0) for i in q['services'])
        rs = [self.svc_section(i, q['ax'], q['a0'], q['a1']) for i in q['services']]
        return [min(r[0] for r in rs), max(r[1] for r in rs), min(r[2] for r in rs), max(r[3] for r in rs)], need

    def merge(self, cand):
        merged = True
        while merged:
            merged = False
            for x in range(len(cand)):
                for y in range(x + 1, len(cand)):
                    A, B = cand[x], cand[y]
                    if A['ax'] != B['ax'] or abs((A['a0'] + A['a1']) / 2 - (B['a0'] + B['a1']) / 2) > self.cfg['mergeWithin']:
                        continue
                    (ra, na), (rb, nb) = self.rect_of(A), self.rect_of(B)
                    if ra[0] - na < rb[1] + nb and ra[1] + na > rb[0] - nb and ra[2] - na < rb[3] + nb and ra[3] + na > rb[2] - nb:
                        A['a0'], A['a1'] = min(A['a0'], B['a0']), max(A['a1'], B['a1'])
                        A['services'] += [i for i in B['services'] if i not in A['services']]
                        A['walls'] += [i for i in B['walls'] if i not in A['walls']]
                        A['crossings'] += B['crossings']
                        del cand[y]; merged = True; break
                if merged:
                    break

    def propose(self, q):
        r, need = self.rect_of(q)
        ax = q['ax']; u, w = cross_ax(ax)
        single_pipe = len(q['services']) == 1 and self.E[q['services'][0]]['discipline'] in ('PIPE', 'CONDUIT')
        depth = max(q['a1'] - q['a0'], 12)
        cu, cv = (r[0] + r[1]) / 2, (r[2] + r[3]) / 2
        dia = self.round_up(max(r[1] - r[0], r[3] - r[2]) + 2 * need) if single_pipe else None
        W = dia if single_pipe else self.round_up(r[1] - r[0] + 2 * need)
        H = dia if single_pipe else self.round_up(r[3] - r[2] + 2 * need)
        b = [0.0] * 6
        b[ax], b[ax + 3] = q['a0'], q['a0'] + depth
        b[u], b[u + 3], b[w], b[w + 3] = cu - W / 2, cu + W / 2, cv - H / 2, cv + H / 2
        o = {'status': 'proposed', 'element': None, 'shape': 'circular' if single_pipe else 'rectangular', 'ax': ax, 'bbox': b, 's0': q['a0'], 's1': q['a1'],
             'width': W, 'height': H, 'diameter': dia, 'depth': depth, 'services': q['services'], 'walls': q['walls'],
             'crossings': [c['id'] for c in q['crossings']], 'wallFound': True, 'provisional': bool(self.cfg.get('clearancesProvisional', True))}
        self.clearance(o)
        for c in q['crossings']:
            c['opening'] = o
        self.open.append(o)

    def number(self, start=None):
        """BWIC references per level and orientation, numbered along X then Y: BWIC-03-H-01. start: {(level code, orientation): last number already used}."""
        fmt = self.cfg['reference']
        groups = collections.defaultdict(list)
        for o in self.open:
            c = [(o['bbox'][k] + o['bbox'][k + 3]) / 2 for k in range(3)]
            o['centre'] = [round(v) for v in c]
            o['level'] = self.ref_level(o['bbox'][2])
            o['orientation'] = self.cfg['orientation']['floor' if o['ax'] == 2 else 'wall']
            groups[(o['level'], o['orientation'])].append(o)
        for (lv, ori), lst in groups.items():
            lst.sort(key=lambda o: (o['centre'][0], o['centre'][1]))
            for n, o in enumerate(lst, (start or {}).get((level_code(lv), ori), 0) + 1):
                o['id'] = fmt.replace('{level}', level_code(lv)).replace('{orientation}', ori).replace('{n:02d}', f'{n:02d}')

    def review(self, o):
        """What has to be checked before an opening can be approved. Unknown wall construction is itself a flag."""
        rf, flags = self.cfg['reviewFlags'], []
        for w in o['walls']:
            e = self.E[w]
            if e.get('modelCode') == 'STR' or e['system'] == 'structural':
                flags.append(rf['structuralModel'] + ': wall is in the structural model')
            text = ' '.join(filter(None, [e.get('family'), e.get('familyType'), e.get('material')]))
            if any(re.search(m, text, re.I) for m in rf['materials']):
                flags.append(rf['structuralModel'] + ': wall construction ' + text)
            if not e.get('fireRating'):
                flags.append('Wall fire rating not recorded: verify')
        if not o['walls']:
            flags.append('No wall or floor found in the model at this opening: verify the construction')
        o['reviewFlags'] = sorted(set(flags))
        o['reviewStatus'] = 'Proposed' if o['status'] == 'proposed' else 'Modelled'


def level_code(lv):
    """'L03' -> '03', 'B01' -> 'B1', anything else unchanged; 'ZZ' (ISO 19650: no single level) when there are no levels."""
    if not lv:
        return 'ZZ'
    m = re.fullmatch(r'L(\d+)', lv)
    if m:
        return '%02d' % int(m.group(1))
    m = re.fullmatch(r'B0?(\d+)', lv)
    return 'B%d' % int(m.group(1)) if m else lv


def fire_stopping(E, i, o, cfg, pipe_systems):
    F = cfg['openings']['fireStopping']
    d = E[i]
    if d['role'] == 'fire-damper':
        return F['damper']
    if d['discipline'] == 'DUCT':
        return F['ductWithDamper'].replace('{dampers}', ', '.join(E[k]['mark'] for k in o['dampers'])) if o['dampers'] else F['ductNoDamper']
    if d['discipline'] in ('TRAY', 'CONDUIT'):
        return F['tray']
    ps = next((p for p in pipe_systems if p['name'] == d.get('pipeSystem')), None)
    if ps and ps.get('fireStopping'):
        return ps['fireStopping']
    if d.get('pipeSystem'):
        return F['insulatedPipe'] if d.get('insulation') is not None else F['pipe']
    return F['unknownPipe']
