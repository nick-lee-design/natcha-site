"""Levels and the structural grid, read from the model's own annotation, so a point can be named 'L03, grid C–D / 4'.

Levels: Revit level lines (category Levels) give elevations; each level's label sits just above its line.
Grid: grid lines (category Grids) with a label near one end. Lines that run along Y are lettered or numbered the same way in
both directions on most projects, so each line takes whichever label is closest to either of its ends.
Nothing here is invented: with no level or grid annotation in the file, both come back empty and the report says so.
"""
import re
import numpy as np

LEVEL_CATS, LEVEL_HEAD = -2000240, -2006020
GRID_CATS, GRID_HEAD = -2000220, -2006040


def levels_from(annotations, override=None):
    """[{'id': 'L03', 'name': 'L03', 'elevation': 10200.0, 'source': ...}] lowest first."""
    if override:
        return [{'id': l['id'], 'name': l.get('name', l['id']), 'elevation': float(l['elevation']), 'source': 'project'} for l in override]
    lines = [a for a in annotations if a['category'] == LEVEL_CATS and a['what'] == 'line']
    if not lines:
        return []
    layers = {a['layer'] for a in lines} | {a['layer'] for a in annotations if a['category'] == LEVEL_HEAD}
    zs = sorted({round(p[2], 1) for a in lines for p in a['points']})
    out = {}
    for t in annotations:
        if t['what'] != 'text' or t['layer'] not in layers or not t['text']:
            continue
        name = t['text'].split('\n')[0].strip()
        tz = t['points'][0][2]
        below = [z for z in zs if z <= tz + 1 and tz - z < 1500]
        if not below:
            continue
        z = max(below)
        # two labels on one line: keep the nearer
        if name not in out or abs(tz - z) < abs(out[name]['_d']):
            out[name] = {'id': name, 'name': name, 'elevation': z, 'source': 'level lines and labels', '_d': tz - z}
    lv = sorted(out.values(), key=lambda l: l['elevation'])
    for l in lv:
        l.pop('_d')
    return lv


def grid_from(annotations):
    """[{'label': 'C', 'a': (x, y), 'b': (x, y)}] from grid lines and their labels."""
    lines = [a for a in annotations if a['category'] == GRID_CATS and a['what'] == 'line']
    if not lines:
        return []
    layers = {a['layer'] for a in annotations if a['category'] == GRID_HEAD} | {a['layer'] for a in lines}
    texts = [t for t in annotations if t['what'] == 'text' and t['text'] and (t['layer'] in layers or re.search(r'GRID', t['layer'], re.I))]
    out = []
    for a in lines:
        p = np.array(a['points'], float)
        for k in range(0, len(p) - 1, 2):
            s, e = p[k][:2], p[k + 1][:2]
            best, bd = None, 4000.0
            for t in texts:
                q = np.array(t['points'][0][:2])
                d = min(np.linalg.norm(q - s), np.linalg.norm(q - e))
                if d < bd:
                    best, bd = t['text'].strip(), d
            out.append({'label': best, 'a': tuple(map(float, s)), 'b': tuple(map(float, e))})
    return out


def _dist_signed(pt, g):
    a, b = np.array(g['a']), np.array(g['b'])
    d = b - a
    n = np.array([-d[1], d[0]]) / (np.linalg.norm(d) or 1)
    return float(np.dot(np.array(pt[:2]) - a, n))


def grid_ref(pt, grid):
    """'C–D / 4' style location: the gridlines either side of the point, in each direction, or the one it sits on."""
    if not grid:
        return None
    along_y = [g for g in grid if abs(g['b'][0] - g['a'][0]) < abs(g['b'][1] - g['a'][1])]
    along_x = [g for g in grid if g not in along_y]
    parts = []
    for fam in (along_y, along_x):
        named = [g for g in fam if g['label']]
        if not named:
            continue
        d = sorted(((_dist_signed(pt, g), g['label']) for g in named))
        on = [lab for v, lab in d if abs(v) < 300]
        if on:
            parts.append(on[0]); continue
        neg = [x for x in d if x[0] < 0]; pos = [x for x in d if x[0] > 0]
        if neg and pos:
            a, b = sorted([neg[-1][1], pos[0][1]])
            parts.append(f'{a}–{b}')
        else:
            parts.append(('outside ' + (neg[-1][1] if neg else pos[0][1])))
    return ' / '.join(parts) if parts else None


def level_of(z, levels):
    if not levels:
        return None
    below = [l for l in levels if l['elevation'] <= z + 50]
    return (below[-1] if below else levels[0])['id']


def schedule_levels(sheet_names):
    """'L04-15' -> ['L04', ..., 'L15'], 'LB1' -> ['B01'], 'L00' -> ['L00']: the levels a schedule's sheets cover."""
    out = {}
    for n in sheet_names:
        m = re.fullmatch(r'L(B?)(\d{1,2})(?:-(\d{1,2}))?', n.strip())
        if not m:
            continue
        if m.group(1):
            out[n] = ['B%02d' % int(m.group(2))]
        elif m.group(3):
            out[n] = ['L%02d' % k for k in range(int(m.group(2)), int(m.group(3)) + 1)]
        else:
            out[n] = ['L%02d' % int(m.group(2))]
    return out
