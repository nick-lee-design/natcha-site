"""Parts -> elements: discipline, system, part type, mark, size, pipe system, tray kind, insulation and description.

Everything here is either read from the source (Revit category, family and type names, geometry) or derived from it by a rule
in the project config. Each derived value records where it came from, so the viewer and reports can say so.
"""
import re
import collections
import numpy as np
from rtree import index as rindex
from .revit import CATEGORIES, SEGMENTS, INSULATION
from .locate import level_of

MARK_PREFIX = {
    'Duct segment': 'D', 'Duct fitting': 'DF', 'Duct insulation': 'DI', 'Duct accessory': 'DA', 'Duct lining': 'DLN', 'Air terminal': 'AT',
    'Flexible duct': 'FXD', 'Fire damper': 'FD', 'Volume control damper': 'VCD', 'Mechanical equipment': 'ME',
    'Pipe segment': 'P', 'Pipe fitting': 'PF', 'Pipe insulation': 'PI', 'Pipe accessory': 'PA', 'Flexible pipe': 'FXP', 'Sprinkler head': 'SPK', 'Sanitaryware': 'SAN',
    'Builders’ work hole, modelled': 'WP',
    'Cable tray segment': 'T', 'Cable tray fitting': 'TF', 'Conduit': 'C', 'Conduit fitting': 'CF',
    'Light fitting': 'LF', 'Downlight': 'DL', 'PIR detector': 'PIR', 'Exit sign': 'EX', 'Fire escape sign': 'FS', 'Fused connection unit': 'FCU',
    'Lighting device': 'LD', 'Electrical fixture': 'EF', 'Electrical equipment': 'EE', 'Fire alarm device': 'FA', 'Data device': 'DD',
    'Communication device': 'CD', 'Security device': 'SD',
    'Wall': 'W', 'Floor slab': 'FL', 'Ceiling': 'CL', 'Roof': 'RF', 'Door': 'DR', 'Window': 'WN', 'Column': 'COL', 'Structural column': 'SC',
    'Beam': 'B', 'Foundation': 'FN', 'Stair': 'ST', 'Railing': 'RL', 'Generic model': 'G', 'Furniture': 'FU', 'Casework': 'CW',
}
MODEL_CODES = {'A': 'ARCH', 'S': 'STR', 'I': 'INT', 'M': 'MECH', 'E': 'ELEC', 'P': 'PH', 'C': 'CIV', 'L': 'LAND', 'F': 'FIRE'}
FIT_KIND = [(r'Bend|Elbow', 'bend'), (r'Tee|Branch|Shoe|Cross', 'branch'), (r'Reduc|Transition', 'reducer'), (r'Coupling|Union', 'coupling'),
            (r'Blank|Cap|End', 'blank end'), (r'Offset', 'offset')]


class BoxIndex:
    """3D bounding boxes in an R-tree, for neighbour queries at building scale."""
    def __init__(self, boxes):
        p = rindex.Property(); p.dimension = 3
        self.idx = rindex.Index(properties=p, interleaved=True)
        for i, b in enumerate(boxes):
            self.idx.insert(i, tuple(b))

    def near(self, b, pad=0.0):
        return list(self.idx.intersection((b[0]-pad, b[1]-pad, b[2]-pad, b[3]+pad, b[4]+pad, b[5]+pad)))


def first_match(rules, text):
    for r in rules:
        if text and re.search(r['match'], text, re.I):
            return r
    return None


def fmt(n):
    return f'{int(round(n)):,}'


def segment_size(v, discipline):
    """Section and length of a straight run from its vertices: 'Ø114 outside, 2,500 long, horizontal' or '600 × 300, 3,851 long, vertical'."""
    c = v - v.mean(0)
    if len(v) < 4:
        return None, None
    _, _, vt = np.linalg.svd(c, full_matrices=False)
    ax = vt[0]
    proj = c @ vt.T
    ext = proj.max(0) - proj.min(0)
    length, w, h = ext[0], ext[1], ext[2]
    tilt = abs(ax[2])
    orient = 'vertical' if tilt > 0.97 else 'horizontal' if tilt < 0.03 else 'inclined'
    if discipline in ('PIPE', 'CONDUIT') or (abs(w - h) < 0.08 * max(w, h, 1) and discipline != 'TRAY' and discipline != 'DUCT'):
        d = max(w, h)
        return f'Ø{fmt(d)} outside, {fmt(length)} long, {orient}', {'diameter': round(float(d), 1), 'length': round(float(length), 1)}
    # sections are reported width × height: for a vertical run, the larger side first
    if orient != 'vertical':
        cross = sorted([w, h])
        hz = abs(vt[1][2]) < abs(vt[2][2])           # which cross axis is horizontal
        wide, high = (w, h) if hz else (h, w)
    else:
        wide, high = max(w, h), min(w, h)
    return f'{fmt(wide)} × {fmt(high)}, {fmt(length)} long, {orient}', {'width': round(float(wide), 1), 'height': round(float(high), 1), 'length': round(float(length), 1)}


def box_size(b):
    return f'{fmt(b[3]-b[0])} × {fmt(b[4]-b[1])} × {fmt(b[5]-b[2])} (X × Y × Z bounding box)'


def classify(x, cfg, levels=None):
    """Turn extracted parts into element dicts. Returns (elements, models, report)."""
    disc_cfg = {d['id']: d for d in cfg['disciplines']}
    layer_rules = sorted(((k, v) for k, v in cfg['layerDisciplines'].items() if not k.startswith('_')), key=lambda kv: -len(kv[0]))
    report = collections.Counter()
    unknown_categories = collections.Counter()

    # models: readable ids from the ISO 19650 role letter in the link's drawing number
    models, used = [], collections.Counter()
    for m in x.models.values():
        if m['role'] == 'host':
            continue
        code = MODEL_CODES.get(m.get('discipline'), 'LINK')
        used[code] += 1
        m['code'] = code if used[code] == 1 else f'{code}{used[code]}'
    elements = []
    for p in x.parts.values():
        v, t = p.mesh()
        cat = CATEGORIES.get(p.category)
        name = ' '.join(filter(None, [p.family, p.familyType]))
        if cat:
            disc, ptype = cat[1], cat[2]
            src = 'revit-category'
        else:
            if p.category is not None:
                unknown_categories[p.category] += 1
            disc = next((d for k, d in layer_rules if p.layer and p.layer.upper().startswith(k)), 'GENERIC')
            ptype = None
            src = 'layer'
        if disc in ('ANNO', 'LINK'):
            report['annotation parts skipped'] += 1
            continue
        rule = first_match(cfg['partTypeRules'], name) if p.kind == 'family' else None
        role, equipment = None, False
        if rule:
            ptype = rule['type']; role = rule.get('role'); equipment = rule.get('equipment', False)
            if rule.get('discipline'):
                disc = rule['discipline']
            src = 'family-name'
        if ptype is None:
            ptype = {'WALL': 'Wall', 'PIPE': 'Pipe fitting', 'DUCT': 'Duct fitting', 'TRAY': 'Cable tray fitting'}.get(disc, 'Generic model') if p.kind == 'family' else \
                    {'WALL': 'Wall', 'PIPE': 'Pipe segment', 'DUCT': 'Duct segment', 'TRAY': 'Cable tray segment', 'FLOOR': 'Floor slab'}.get(disc, 'Generic model')
        if p.category in INSULATION:
            role = 'insulation'
        lo, hi = v.min(0), v.max(0)
        e = {
            'part': p, 'verts': v, 'tris': t, 'bbox': [round(float(z), 1) for z in (*lo, *hi)],
            'modelKey': p.model, 'modelCode': x.models.get(p.model, {}).get('code'), 'layer': p.layer or '0', 'discipline': disc, 'type': ptype, 'role': role, 'equipment': equipment,
            'kind': 'wall' if disc == 'WALL' else 'segment' if (p.category in SEGMENTS or p.category in INSULATION or p.kind == 'element') and disc != 'WALL' else 'family',
            'family': p.family, 'familyType': p.familyType, 'revitId': p.revitId, 'revitType': p.typeId, 'idSource': p.source,
            'typeSource': src, 'plates': p.plates, 'faces': int(len(t)), 'insertedOn': p.insertLayer if p.insertLayer and p.insertLayer != p.layer else None,
        }
        elements.append(e)
        report['elements'] += 1

    # system: the discipline's, or for walls the model's trade
    model_trade = {'ARCH': 'architectural', 'STR': 'structural', 'INT': 'architectural'}
    for e in elements:
        d = disc_cfg.get(e['discipline'], {})
        sys_ = d.get('system')
        if sys_ is None:
            code = x.models[e['modelKey']].get('code') if e['modelKey'] in x.models else None
            sys_ = model_trade.get(code, 'architectural')
        e['system'] = sys_

    # neighbours, for spreading pipe systems and tray kinds from fittings to the runs they join
    bi = BoxIndex([e['bbox'] for e in elements])

    for e in elements:
        r = first_match(cfg['pipeSystems'], ' '.join(filter(None, [e['family'], e['familyType']]))) if e['discipline'] == 'PIPE' and e['kind'] == 'family' else None
        if r:
            e['pipeSystem'], e['pipeSystemFrom'] = r['name'], 'fitting family'
        r = first_match(cfg['trayKinds'], ' '.join(filter(None, [e['familyType'], e['family']]))) if e['discipline'] == 'TRAY' and e['kind'] == 'family' else None
        if r:
            e['trayKind'] = r['name']
    for key, src in (('pipeSystem', 'adjacent fitting or pipe'), ('trayKind', None)):
        disc = 'PIPE' if key == 'pipeSystem' else 'TRAY'
        for _ in range(12):
            grew = False
            for i, e in enumerate(elements):
                if e['discipline'] != disc or e.get(key) or e['role'] in ('insulation', 'opening'):
                    continue
                for j in bi.near(e['bbox'], 5):
                    o = elements[j]
                    if o['discipline'] == disc and o.get(key) and o['role'] != 'insulation':
                        e[key] = o[key]
                        if src:
                            e['pipeSystemFrom'] = src
                        grew = True
                        break
            if not grew:
                break

    # insulation belongs to the service it wraps: the same discipline, inside the insulation's box, the largest overlap
    for i, e in enumerate(elements):
        if e['role'] != 'insulation':
            continue
        b, best, bv = e['bbox'], None, 0
        for j in bi.near(b, 2):
            o = elements[j]
            if o is e or o['discipline'] != e['discipline'] or o['role'] in ('insulation', 'opening'):
                continue
            ob = o['bbox']
            ov = np.prod([max(0, min(b[k+3], ob[k+3]) - max(b[k], ob[k])) for k in range(3)])
            if ov > bv:
                best, bv = j, ov
        if best is not None:
            e['insulates'] = best
            elements[best].setdefault('insulation', i)
            if elements[best].get('pipeSystem') and not e.get('pipeSystem'):
                e['pipeSystem'], e['pipeSystemFrom'] = elements[best]['pipeSystem'], 'core pipe'
    for e in elements:
        if e.get('pipeSystem') is None and e['discipline'] == 'PIPE' and e['role'] != 'opening':
            report['pipes without a system'] += 1

    # sizes
    for e in elements:
        if e['kind'] == 'segment' and e['role'] != 'insulation':
            e['size'], e['dims'] = segment_size(e['verts'], e['discipline'])
            if e['size'] is None:
                e['size'] = box_size(e['bbox'])
        elif e['role'] == 'insulation':
            s, d = segment_size(e['verts'], e['discipline'])
            host = elements[e['insulates']] if e.get('insulates') is not None else None
            if s and host and host.get('dims') and d:
                th = ((d.get('diameter') or d.get('width', 0)) - (host['dims'].get('diameter') or host['dims'].get('width', 0))) / 2
                if th > 0:
                    s += f', ~{fmt(th)} mm thick'
                    e['insulationThickness'] = round(float(th), 1)
            e['size'] = s or box_size(e['bbox'])
        else:
            e['size'] = box_size(e['bbox'])

    # levels: each element sits on the highest level at or below its underside
    if levels:
        for e in elements:
            e['level'] = level_of(e['bbox'][2], levels)

    # marks: prefix by part type, link copies tagged with their model, numbered along X then Y then Z, per level when levels exist
    groups = collections.defaultdict(list)
    for i, e in enumerate(elements):
        prefix = MARK_PREFIX.get(e['type'], 'G')
        if e['discipline'] == 'WALL':
            prefix = {'ARCH': 'AW', 'STR': 'SW', 'INT': 'IW'}.get(x.models.get(e['modelKey'], {}).get('code'), 'W')
            if e['layer'].startswith('I-'):
                prefix = 'IW'
        mcode = x.models.get(e['modelKey'], {}).get('code')
        tag = '' if e['modelKey'] == 'HOST' or e['discipline'] == 'WALL' else (mcode or 'L')[0]
        groups[(prefix, tag, e.get('level'))].append(i)
    for (prefix, tag, lv), ids in groups.items():
        ids.sort(key=lambda i: ((elements[i]['bbox'][0] + elements[i]['bbox'][3]), (elements[i]['bbox'][1] + elements[i]['bbox'][4]), elements[i]['bbox'][2]))
        width = 3 if len(ids) > 99 else 2
        for n, i in enumerate(ids, 1):
            elements[i]['mark'] = '-'.join(filter(None, [prefix, lv, f'{tag}{n:0{width}d}']))

    # descriptions
    pshort = {r['name']: r.get('short') or r['name'] for r in cfg['pipeSystems']}
    for e in elements:
        e['description'] = describe(e, pshort, elements)

    report['unknown categories'] = dict(unknown_categories)
    return elements, report


def fit_kind(name):
    for pat, k in FIT_KIND:
        if re.search(pat, name or '', re.I):
            return k
    return 'fitting'


def describe(e, pshort, elements):
    size = e['size'].split(', ')[0].replace(' outside', '') if e.get('size') and 'bounding box' not in e['size'] else ''
    sysname = pshort.get(e.get('pipeSystem'))
    t, ty = None, e['type']
    if e['role'] == 'opening':
        return None                                       # openings are described once they are sized
    if ty == 'Pipe segment':
        t = (f'{sysname} pipe' if sysname else 'Pipe') + (f' {size}' if size else '')
    elif ty == 'Pipe fitting':
        t = (f'{sysname} ' if sysname else 'Pipe ') + fit_kind(e.get('family'))
    elif e['role'] == 'insulation':
        t = 'Pipe insulation' if e['discipline'] == 'PIPE' else 'Duct insulation'
    elif ty == 'Duct segment':
        t = 'Duct' + (f' {size}' if size else '')
    elif ty == 'Duct fitting':
        t = 'Duct ' + fit_kind(e.get('family'))
    elif ty == 'Cable tray segment':
        t = (e.get('trayKind') or 'Cable tray') + (f' {size}' if size else '')
    elif ty == 'Cable tray fitting':
        t = (e.get('trayKind') or 'Cable tray') + ' ' + fit_kind(e.get('family'))
    else:
        t = ty
    if e.get('insulation') is not None:
        t += ', insulated'
    return t[0].upper() + t[1:]
