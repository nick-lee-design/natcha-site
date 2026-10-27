"""Write the model package the viewer reads (docs/model-package.md): <name>.json plus geometry/<system>-<level>.bin chunks.

Positions are float32 relative to each chunk's own origin, so a 245 m building keeps sub-millimetre precision.
Every element records where its id, type and derived values came from.
"""
import os
import gzip
import json
import collections
import numpy as np

PALETTE = {'WALL': '#8E959C', 'FLOOR': '#A7A196', 'CEILING': '#C9C4BA', 'ROOF': '#9C8F80', 'DOOR': '#8B6B4A', 'WINDOW': '#7FA7C9', 'STRUCT': '#6E7781',
           'STAIR': '#9A9A9A', 'FURN': '#B9A88F', 'GENERIC': '#9AA3AB', 'DUCT': '#2F7FC1', 'MECH': '#1F5F99', 'PIPE': '#2E9E55',
           'TRAY': '#E07B1A', 'CONDUIT': '#C46A16', 'LITE': '#E3BD12', 'ELEC': '#B23A48', 'BWH': '#0F8B8D'}
LINE_COLOURS = {'PIPE': ('#1B6B3A', '#69C892'), 'DUCT': ('#1F5F99', '#7FB2E5'), 'TRAY': ('#A3560F', '#F0A45A'), None: ('#6B7480', '#94A0AC')}


def element_id(e, codes):
    m = codes[e['modelKey']]
    inst = e['part'].instance
    return f'{m}:{inst}'


def chunk_key(e):
    return f"{e['system']}-{(e.get('level') or 'all').lower()}"


def write(out_dir, name, elements, x, cfg, levels, grid, clashes, crossings, openings, dups, notes, extra):
    os.makedirs(os.path.join(out_dir, 'geometry'), exist_ok=True)
    codes = {k: (m.get('code') or k) for k, m in x.models.items()}
    codes['HOST'] = extra.get('hostCode', 'MEP')
    ids = [element_id(e, codes) for e in elements]
    if len(set(ids)) != len(ids):
        seen = collections.Counter()
        for k, v in enumerate(ids):
            seen[v] += 1
            if seen[v] > 1:
                ids[k] = f'{v}#{seen[v]}'
    ref = lambda i: None if i is None else ids[i]

    # geometry chunks, one per system and level
    groups = collections.OrderedDict()
    for i, e in enumerate(elements):
        groups.setdefault(chunk_key(e), []).append(i)
    line_sys = {}
    for layer in x.lines:
        d = next((dd for k, dd in sorted(((k, v) for k, v in cfg['layerDisciplines'].items() if not k.startswith('_')), key=lambda kv: -len(kv[0])) if layer.upper().startswith(k)), None)
        line_sys[layer] = d
    chunks, mesh_of, line_of = [], {}, {}
    disc_sys = {d['id']: d.get('system') for d in cfg['disciplines']}
    line_groups = collections.defaultdict(list)
    for layer, segs in x.lines.items():
        d = line_sys.get(layer)
        line_groups[f"{disc_sys.get(d) or 'architectural'}-all"].append(layer)
    for key in list(groups) + [k for k in line_groups if k not in groups]:
        ids_ = groups.get(key, [])
        vs, ts, off_v, off_t = [], [], 0, 0
        for i in ids_:
            v, t = elements[i]['verts'], elements[i]['tris']
            vs.append(v); ts.append(t)
            mesh_of[i] = {'chunk': key, 'vertexOffset': off_v, 'vertexCount': int(len(v)), 'indexOffset': off_t, 'indexCount': int(t.size)}
            off_v += len(v); off_t += t.size
        lines = []
        lo = 0
        for layer in line_groups.get(key, []):
            a = np.vstack(x.lines[layer])
            lines.append(a)
            line_of[layer] = {'chunk': key, 'offset': lo, 'count': int(len(a))}
            lo += len(a)
        allv = np.vstack(vs + lines) if (vs or lines) else np.zeros((0, 3))
        origin = allv.min(0) if len(allv) else np.zeros(3)
        pos = (np.vstack(vs) - origin).astype('<f4') if vs else np.zeros((0, 3), '<f4')
        maxlocal = max((int(t.max()) for t in ts if t.size), default=0)
        itype = 'uint16' if maxlocal < 65536 else 'uint32'
        idx = np.concatenate([t.ravel() for t in ts]).astype('<u2' if itype == 'uint16' else '<u4') if ts else np.zeros(0, '<u2')
        lin = (np.vstack(lines) - origin).astype('<f4') if lines else None
        parts = [pos.tobytes(), idx.tobytes()]
        pad = (-sum(len(p) for p in parts)) % 4
        parts.append(b'\0' * pad)
        c = {'id': key, 'system': key.rsplit('-', 1)[0], 'level': None if key.endswith('-all') else next((l['id'] for l in levels if l['id'].lower() == key.rsplit('-', 1)[1]), None),
             'uri': f'geometry/{key}.bin', 'compression': 'gzip',
             'positions': {'type': 'float32', 'byteOffset': 0, 'count': int(len(pos)), 'origin': [round(float(v), 3) for v in origin], 'step': 1},
             'indices': {'type': itype, 'byteOffset': len(parts[0]), 'count': int(idx.size)}}
        if lin is not None:
            c['lines'] = {'type': 'float32', 'byteOffset': sum(len(p) for p in parts), 'count': int(len(lin))}
            parts.append(lin.tobytes())
        with gzip.open(os.path.join(out_dir, c['uri']), 'wb', compresslevel=6) as f:
            for p in parts:
                f.write(p)
        chunks.append(c)

    # vocabularies, from what the model uses
    used_layers = collections.OrderedDict()
    for e in elements:
        used_layers.setdefault(e['layer'] if e['role'] != 'opening' else 'BWH', e['discipline'] if e['role'] != 'opening' else 'BWH')
    layers = []
    for lid, d in used_layers.items():
        L = {'id': lid, 'name': lid if lid != 'BWH' else 'Builders’ work holes', 'desc': next((dd['name'] for dd in cfg['disciplines'] if dd['id'] == d), ''), 'colour': PALETTE.get(d, '#9AA3AB')}
        if d == 'WALL':
            L.update(role='wall', opacity=0.25)
        if d in ('FLOOR', 'CEILING', 'ROOF'):
            L.update(opacity=0.35)
        if lid == 'BWH':
            L.update(role='opening', proposedColour='#7C3AED', desc='Modelled and proposed openings')
        layers.append(L)
    if not any(L['id'] == 'BWH' for L in layers):
        layers.append({'id': 'BWH', 'name': 'Builders’ work holes', 'desc': 'Modelled and proposed openings', 'colour': PALETTE['BWH'], 'role': 'opening', 'proposedColour': '#7C3AED'})
    line_layers = []
    for layer, lo in line_of.items():
        d = line_sys.get(layer)
        cat = x.line_meta.get(layer, {}).get('category')
        col = LINE_COLOURS.get(d if d in LINE_COLOURS else None)
        L = {'id': layer, 'name': 'Revit section box' if cat == -2000301 else f'{layer} lines', 'desc': 'Outline of the exported view' if cat == -2000301 else 'Single-line routes',
             'colour': col[0], 'darkColour': col[1], 'dash': cat == -2000301, **lo}
        if d and cat != -2000301:
            L.update(model=codes['HOST'], discipline=d)
        line_layers.append(L)
    types = collections.OrderedDict()
    for e in elements:
        t = types.setdefault(e['type'], {'name': e['type']})
        if e['equipment']:
            t['equipment'] = True
        if e['role'] in ('insulation', 'fire-damper', 'opening', 'support'):
            t['role'] = e['role']
    types['Builders’ work hole, proposed'] = {'name': 'Builders’ work hole, proposed', 'role': 'proposed-opening'}
    disciplines = [dict(d) for d in cfg['disciplines'] if any(e['discipline'] == d['id'] for e in elements) or d['id'] == 'BWH']
    models = [{'id': codes['HOST'], 'name': extra.get('hostName', 'Host model'), 'desc': extra.get('hostDesc', 'Host file'), 'role': 'host'}]
    for k, m in x.models.items():
        if m['role'] != 'link':
            continue
        cont = collections.Counter(e['layer'] for e in elements if e['modelKey'] == k)
        models.append({'id': codes[k], 'name': (m.get('label') or 'Linked model').capitalize() if m.get('label') else 'Linked model', 'label': m.get('label') or 'Linked model',
                       'number': m.get('number'), 'rev': m.get('rev'), 'role': 'link', 'contents': dict(cont),
                       'reviewer': {'STR': 'Structural engineer'}.get(codes[k], 'Architect')})

    def el(i, e):
        o = {'id': ids[i], 'mark': e['mark'], 'layer': 'BWH' if e['role'] == 'opening' else e['layer'], 'discipline': e['discipline'], 'system': e['system'],
             'model': codes[e['modelKey']], 'type': e['type'], 'kind': e['kind'], 'size': e['size']}
        if e.get('description'):
            o['description'] = e['description']
        if e.get('level'):
            o['level'] = e['level']
        o.update(bbox=e['bbox'], mesh=mesh_of[i], faces=e['faces'], plates=e['plates'])
        for k in ('family', 'familyType', 'revitId', 'revitType', 'pipeSystem', 'pipeSystemFrom', 'insertedOn', 'fireRating'):
            if e.get(k):
                o[k] = e[k]
        if e.get('insulation') is not None:
            o['insulation'] = ref(e['insulation'])
        if e.get('insulates') is not None:
            o['insulates'] = ref(e['insulates'])
        o['provenance'] = {'id': e['idSource'], 'type': e['typeSource'], 'size': 'geometry', 'description': 'rule'}
        return o

    open_ix = {id(o): o['id'] for o in openings}
    pkg = {
        'format': 'talo-model-package', 'version': 1,
        'project': extra['project'],
        'titleBlock': extra['titleBlock'],
        'geometry': chunks,
        'bounds': extra['bounds'],
        'models': models,
        'systems': cfg['systems'],
        'disciplines': disciplines,
        'layers': layers,
        'lineLayers': line_layers,
        'partTypes': list(types.values()),
        'pipeSystems': [{k: v for k, v in p.items() if k != 'match'} for p in cfg['pipeSystems']],
        'levels': levels,
        'grid': grid,
        'zones': [],
        'rules': {
            'clash': {'tolerance': cfg['clash']['tolerance'], 'provisional': cfg['clash']['provisional'], 'grades': cfg['clash']['grades'],
                      'summary': extra['clashSummary'], 'disciplineTolerances': cfg['clash'].get('disciplineTolerances', {})},
            'openings': {'roundTo': cfg['openings']['roundTo'], 'clearanceNote': extra['clearanceNote'], 'provisional': cfg.get('clearancesProvisional', True),
                         'verdicts': {'ok': 'Sufficient', 'tight': 'Below rule', 'clash': 'Service hits the edge', 'empty': 'No service found'},
                         'fireStopping': cfg['openings']['fireStopping'],
                         'fireStoppingNote': 'Proposed from the service type. Confirm against the wall’s fire rating and the project fire strategy.'},
        },
        'checks': {'zoning': None, 'validation': extra['validation']},
        'ui': {'explodeNote': 'Disciplines lift apart in height order. Spreading pushes every part outwards from the model’s centre.'},
        'notes': notes,
        'reports': extra['reports'],
        'elements': [el(i, e) for i, e in enumerate(elements)],
        'clashes': [{'id': c['id'], 'a': ref(c['a']), 'b': ref(c['b']), 'grade': c['grade'], 'point': c['point'], 'overlap': c['overlap'], 'depth': c['depth'],
                     'measure': c['measure'], 'volume': c['volume'], 'tolerance': c['tolerance'], 'contacts': c['contacts'], 'pair': c['pair'],
                     'level': c.get('level'), 'grid': c.get('grid'), 'zone': None, 'status': 'Open'} for c in clashes],
        'wallCrossings': [{'id': c['id'], 'service': ref(c['service']), 'wall': ref(c['wall']), 'kind': c['kind'], 'point': c['point'], 'overlap': c['overlap'],
                           'contacts': c['contacts'], 'pair': c['pair'], 'hole': None,
                           **({'opening': c['opening']['id'] if c['opening'] else None} if 'opening' in c else {})} for c in crossings],
        'openings': [{'id': o['id'], 'status': o['status'], **({'element': ref(o['element'])} if o['element'] is not None else {}),
                      'shape': o['shape'], 'axis': 'XYZ'[o['ax']], 'orientation': o['orientation'], 'level': o['level'], 'grid': o.get('grid'),
                      'bbox': [round(v, 1) for v in o['bbox']], 'wallSpan': [round(o['s0'], 1), round(o['s1'], 1)],
                      'width': round(o['width'], 1), 'height': round(o['height'], 1), 'diameter': None if o['diameter'] is None else round(o['diameter'], 1),
                      'depth': round(o['depth'], 1), 'services': [ref(i) for i in o['services']], 'walls': [ref(i) for i in o['walls']],
                      'crossings': o['crossings'], 'dampers': [ref(i) for i in o['dampers']], 'overlaps': [p['id'] for p in o['overlaps']],
                      'gaps': [{'service': ref(g['service']), 'gap': g['gap'], 'need': g['need']} for g in o['gaps']], 'verdict': o['verdict'],
                      'fireStopping': [{'service': ref(i), 'text': t} for i, t in o['fire']], 'reviewStatus': o['reviewStatus'], 'reviewFlags': o['reviewFlags'],
                      'provisional': o.get('provisional', False), **({'schedule': o['schedule']} if o.get('schedule') else {})} for o in openings],
        'duplicates': [{'mep': ref(d['mep']), 'arch': ref(d['arch']), 'dz': d['dz'], 'dxy': d['dxy']} for d in dups],
    }
    LISTS = ['elements', 'clashes', 'wallCrossings', 'openings', 'duplicates']
    body = [f'  {json.dumps(k)}: [\n' + ',\n'.join('    ' + json.dumps(v, ensure_ascii=False) for v in pkg[k]) + '\n  ]' if k in LISTS
            else f'  {json.dumps(k)}: ' + json.dumps(pkg[k], indent=2, ensure_ascii=False).replace('\n', '\n  ') for k in pkg]
    path = os.path.join(out_dir, name + '.json')
    with open(path, 'w') as f:
        f.write('{\n' + ',\n'.join(body) + '\n}\n')
    return path, pkg
