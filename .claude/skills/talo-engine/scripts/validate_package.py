#!/usr/bin/env python3
"""Check a model package without rendering it: required keys, every reference, every geometry chunk and range.

usage: validate_package.py PACKAGE.json      exit 0 when it passes, 1 with the problems listed
"""
import os
import sys
import gzip
import json

SIZES = {'uint16': 2, 'uint32': 4, 'int32': 4, 'float32': 4}
REQUIRED = ['format', 'version', 'project', 'geometry', 'bounds', 'models', 'disciplines', 'layers', 'partTypes', 'rules', 'reports', 'elements']
TABLES = {'models', 'clashes', 'duplicates', 'proposedOpenings', 'inventory'}


def check(path):
    P = json.load(open(path))
    base = os.path.dirname(os.path.abspath(path))
    bad = []
    for k in REQUIRED:
        if k not in P:
            bad.append(f'missing {k}')
    if P.get('format') != 'talo-model-package' or P.get('version') != 1:
        bad.append('not a version 1 talo-model-package')
    if bad:
        return bad
    chunks = {}
    for c in P['geometry']:
        f = os.path.join(base, c['uri'])
        if not os.path.exists(f):
            bad.append(f"chunk {c['id']}: {c['uri']} missing"); continue
        raw = open(f, 'rb').read()
        if raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        need = 0
        for blk, per in (('positions', 3), ('indices', 1), ('lines', 3)):
            b = c.get(blk)
            if not b:
                continue
            end = b['byteOffset'] + b['count'] * per * SIZES[b['type']]
            if b['byteOffset'] % SIZES[b['type']]:
                bad.append(f"chunk {c['id']}: {blk} offset not aligned")
            need = max(need, end)
        if len(raw) < need:
            bad.append(f"chunk {c['id']}: {len(raw)} bytes, needs {need}")
        chunks[c['id']] = c
    ids = [e['id'] for e in P['elements']]
    idset = set(ids)
    if len(idset) != len(ids):
        bad.append(f'{len(ids) - len(idset)} duplicate element ids')
    marks = [e['mark'] for e in P['elements']]
    if len(set(marks)) != len(marks):
        bad.append(f'{len(marks) - len(set(marks))} duplicate marks')
    layers = {L['id'] for L in P['layers']}
    models = {m['id'] for m in P['models']}
    discs = {d['id'] for d in P['disciplines']}
    types = {t['name'] for t in P['partTypes']}
    systems = {s['id'] for s in P.get('systems', [])}
    levels = {l['id'] for l in P.get('levels', [])}
    for e in P['elements']:
        m = e['mesh']
        c = chunks.get(m.get('chunk'))
        if c is None:
            bad.append(f"{e['id']}: chunk {m.get('chunk')} not declared")
        else:
            if m['vertexOffset'] + m['vertexCount'] > c['positions']['count']:
                bad.append(f"{e['id']}: vertices outside chunk {c['id']}")
            if m['indexOffset'] + m['indexCount'] > c['indices']['count']:
                bad.append(f"{e['id']}: indices outside chunk {c['id']}")
        for k, s in (('layer', layers), ('model', models), ('discipline', discs), ('type', types)):
            if e.get(k) not in s:
                bad.append(f"{e['id']}: {k} {e.get(k)} not declared")
        if systems and e.get('system') not in systems:
            bad.append(f"{e['id']}: system {e.get('system')} not declared")
        if e.get('level') and e['level'] not in levels:
            bad.append(f"{e['id']}: level {e['level']} not declared")
        for k in ('insulation', 'insulates'):
            if e.get(k) and e[k] not in idset:
                bad.append(f"{e['id']}: {k} {e[k]} not an element")
    for L in P.get('lineLayers', []):
        c = chunks.get(L.get('chunk'))
        if c is None or not c.get('lines') or L['offset'] + L['count'] > c['lines']['count']:
            bad.append(f"line layer {L['id']}: outside its chunk")
    grades = {g['id'] for g in P['rules']['clash']['grades']}
    for c in P.get('clashes', []):
        for k in ('a', 'b'):
            if c[k] not in idset:
                bad.append(f"clash {c['id']}: {k} {c[k]} not an element")
        if c['grade'] not in grades:
            bad.append(f"clash {c['id']}: grade {c['grade']} not declared")
    opening_ids = {o['id'] for o in P.get('openings', [])}
    if len(opening_ids) != len(P.get('openings', [])):
        bad.append('duplicate opening ids')
    for c in P.get('wallCrossings', []):
        for k in ('service', 'wall'):
            if c[k] not in idset:
                bad.append(f"crossing {c['id']}: {k} not an element")
        if c.get('opening') and c['opening'] not in opening_ids:
            bad.append(f"crossing {c['id']}: opening {c['opening']} not declared")
    for o in P.get('openings', []):
        for k in ('services', 'walls', 'dampers'):
            for i in o.get(k, []):
                if i not in idset:
                    bad.append(f"opening {o['id']}: {k} {i} not an element")
        if o.get('element') and o['element'] not in idset:
            bad.append(f"opening {o['id']}: element not declared")
        for i in o.get('overlaps', []):
            if i not in opening_ids:
                bad.append(f"opening {o['id']}: overlap {i} not an opening")
        if o['status'] not in ('modelled', 'proposed'):
            bad.append(f"opening {o['id']}: status {o['status']}")
    for d in P.get('duplicates', []):
        if d['mep'] not in idset or d['arch'] not in idset:
            bad.append('duplicate pair refers to a missing element')
    for s in P.get('notes', []):
        for b in s.get('blocks', []):
            if 'table' in b and b['table'] not in TABLES:
                bad.append(f"notes: unknown table {b['table']}")
    return bad


if __name__ == '__main__':
    problems = check(sys.argv[1])
    if problems:
        print(f'{len(problems)} problems'); [print(' ', p) for p in problems[:60]]
        sys.exit(1)
    print('package passes')
