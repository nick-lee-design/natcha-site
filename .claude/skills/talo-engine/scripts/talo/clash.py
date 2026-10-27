"""Clash detection on the real triangles, with FCL through trimesh.

Services are tested against each other between disciplines, and against structure (beams, columns, slabs). A service meeting
a wall or a floor is a crossing: an opening question for openings.py, not a clash. Tests run level by level, so a riser that
spans 20 storeys is checked on each, and each pair is reported once.

Measures, as the reports state them:
- contacts: triangle pairs that intersect.
- depth: when both parts are closed solids, the thinnest side of their actual intersection solid (measure 'solid'). When
  either mesh is open, the smallest side of the box where their bounding boxes intersect (measure 'boxes'), which
  overstates the overlap at bends and inclined runs; the report says which was used.
Grades come from the project rules (tolerance, half the smaller part, insulation); until the project confirms them they are
marked provisional.
"""
import collections
import numpy as np
import trimesh

SERVICE = {'PIPE', 'DUCT', 'TRAY', 'CONDUIT', 'LITE', 'ELEC', 'MECH'}
STRUCTURE = {'STRUCT'}
CROSSED = {'WALL': 'wall', 'FLOOR': 'floor'}


def tm(e):
    if '_tm' not in e:
        e['_tm'] = trimesh.Trimesh(e['verts'], e['tris'], process=False)
    return e['_tm']


def solid(e):
    """The part as a closed solid, or None when its mesh is open."""
    if '_solid' not in e:
        m = trimesh.Trimesh(e['verts'], e['tris'], process=True)
        m.merge_vertices(digits_vertex=1)
        with np.errstate(all='ignore'):                   # flat or degenerate meshes have no volume; they are open, not errors
            e['_solid'] = m if m.is_watertight and m.volume > 0 else None
    return e['_solid']


def measure(A, B):
    """(depth mm, volume mm3 or None, measure) for two parts that touch."""
    a, b = solid(A), solid(B)
    if a is not None and b is not None:
        try:
            inter = trimesh.boolean.intersection([a, b], engine='manifold')
            if inter.is_empty or inter.volume < 1:
                return 0.0, 0.0, 'solid'
            ext = inter.bounding_box_oriented.primitive.extents
            return float(min(ext)), float(inter.volume), 'solid'
        except Exception:
            pass
    return float(min(box_overlap(A['bbox'], B['bbox']))), None, 'boxes'


def spans_levels(e, levels):
    """Levels an element's height range touches."""
    if not levels:
        return [None]
    lo, hi = e['bbox'][2], e['bbox'][5]
    out = []
    for k, l in enumerate(levels):
        top = levels[k + 1]['elevation'] if k + 1 < len(levels) else float('inf')
        if hi >= l['elevation'] - 50 and lo < top:
            out.append(l['id'])
    return out or [levels[0]['id']]


def box_overlap(a, b):
    return [max(0.0, min(a[k + 3], b[k + 3]) - max(a[k], b[k])) for k in range(3)]


def min_size(e):
    d = e.get('dims') or {}
    if d:
        return min(v for k, v in d.items() if k != 'length')
    b = e['bbox']
    return min(b[3] - b[0], b[4] - b[1], b[5] - b[2])


def detect(elements, cfg, levels):
    rules = cfg['clash']
    tol = rules['tolerance']
    by_level = collections.defaultdict(lambda: collections.defaultdict(list))
    for i, e in enumerate(elements):
        d = e['discipline']
        if e['role'] == 'opening':
            continue
        group = d if d in SERVICE else 'STRUCT' if d in STRUCTURE else d if d in CROSSED else None
        if group is None:
            continue
        for lv in spans_levels(e, levels):
            by_level[lv][group].append(i)

    hits = {}                                       # (i, j) -> contact count
    for lv, groups in by_level.items():
        mgrs = {}
        for g, ids in groups.items():
            m = trimesh.collision.CollisionManager()
            for i in ids:
                m.add_object(str(i), tm(elements[i]))
            mgrs[g] = m
        keys = sorted(mgrs)
        for a_ix, a in enumerate(keys):
            for b in keys[a_ix:]:
                if a == b and rules.get('pairs') != 'all':
                    continue
                if a not in SERVICE and b not in SERVICE:
                    continue
                ok, _, data = (mgrs[a].in_collision_internal(return_names=True, return_data=True) if a == b
                               else mgrs[a].in_collision_other(mgrs[b], return_names=True, return_data=True))
                if not ok:
                    continue
                for c in data:
                    i, j = sorted(int(n) for n in c.names)
                    if i == j:
                        continue
                    hits[(i, j)] = hits.get((i, j), 0) + 1
        for m in mgrs.values():
            del m

    clashes, crossings = [], []
    for (i, j), n in hits.items():
        A, B = elements[i], elements[j]
        if A.get('insulates') == j or B.get('insulates') == i:
            continue                                   # insulation on its own service
        ov = box_overlap(A['bbox'], B['bbox'])
        p = [round((max(A['bbox'][k], B['bbox'][k]) + min(A['bbox'][k + 3], B['bbox'][k + 3])) / 2, 1) for k in range(3)]
        cross = CROSSED.get(A['discipline']) or CROSSED.get(B['discipline'])
        if cross:
            svc, wall = (j, i) if A['discipline'] in CROSSED else (i, j)
            if elements[svc]['discipline'] not in SERVICE:
                continue
            crossings.append({'service': svc, 'wall': wall, 'kind': cross, 'point': p, 'overlap': [round(v, 1) for v in ov], 'contacts': n,
                              'pair': f"{elements[svc]['discipline']}-{elements[wall]['discipline']}"})
            continue
        depth, vol, how = measure(A, B)
        ins = A['role'] == 'insulation' or B['role'] == 'insulation'
        small = min(min_size(A), min_size(B))
        dtol = rules.get('disciplineTolerances', {}).get(A['discipline'] + '-' + B['discipline'],
               rules.get('disciplineTolerances', {}).get(B['discipline'] + '-' + A['discipline'], tol))
        if depth < rules.get('touchBelow', 1):
            grade = 'touch'
        elif not ins and (depth >= dtol or (rules.get('majorWhenHalfSmaller', True) and depth >= 0.5 * small)):
            grade = 'major'
        else:
            grade = 'minor'
        clashes.append({'a': i, 'b': j, 'grade': grade, 'point': p, 'overlap': [round(v, 1) for v in ov], 'contacts': n,
                        'pair': '-'.join(sorted([A['discipline'], B['discipline']])), 'tolerance': dtol, 'insulation': ins,
                        'depth': round(depth, 1), 'volume': None if vol is None else round(vol), 'measure': how})
    # ids in order along X, per level when levels exist
    for lst, prefix in ((clashes, 'C'), (crossings, 'WX')):
        lst.sort(key=lambda c: (c['point'][2] // 1 if not levels else levels_index(c['point'][2], levels), c['point'][0], c['point'][1]))
        width = 3 if len(lst) > 99 else 2
        for n, c in enumerate(lst, 1):
            c['id'] = f'{prefix}{n:0{width}d}'
    return clashes, crossings


def levels_index(z, levels):
    k = 0
    for n, l in enumerate(levels):
        if l['elevation'] <= z + 50:
            k = n
    return k
