#!/usr/bin/env python3
"""TALO Engine: DWG + Excel schedule -> coordination workspace (model package, viewer, filled schedule, validation report).

usage: run.py --dwg MODEL.dwg [--excel SCHEDULE.xlsx] --out DIR [--config project.json] [--name model] [--keep-dxf]
"""
import os
import re
import sys
import json
import time
import shutil
import argparse
import subprocess
import collections

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import ezdxf                                                     # noqa: E402
from talo.extract import Reader                                  # noqa: E402
from talo.classify import classify, BoxIndex                     # noqa: E402
from talo.locate import levels_from, grid_from, grid_ref, level_of   # noqa: E402
from talo.clash import detect                                    # noqa: E402
from talo.openings import Openings, fire_stopping, level_code    # noqa: E402
from talo import schedule as sched                               # noqa: E402
from talo import package                                         # noqa: E402
from talo.revit import CATEGORIES                                # noqa: E402


def deep_merge(a, b):
    for k, v in b.items():
        a[k] = deep_merge(dict(a.get(k) or {}), v) if isinstance(v, dict) and isinstance(a.get(k), dict) else v
    return a


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def dwg_to_dxf(dwg, work):
    """LibreDWG; its warnings and errors go to the validation report."""
    if not shutil.which('dwg2dxf'):
        raise SystemExit('dwg2dxf (LibreDWG) is not installed. Run scripts/setup.sh.')
    with open(dwg, 'rb') as f:
        version = f.read(6).decode('ascii', 'replace')
    out = os.path.join(work, 'model.dxf')
    p = subprocess.run(['dwg2dxf', '-y', '-o', out, dwg], capture_output=True, text=True)
    msgs = (p.stdout or '') + (p.stderr or '')
    errors = collections.Counter(re.sub(r'\s+\d+.*$', '', l.strip()) for l in msgs.splitlines() if l.startswith('ERROR'))
    unstable = sum(1 for l in msgs.splitlines() if 'Unstable Class' in l)
    if p.returncode != 0 or not os.path.exists(out):
        raise SystemExit(f'LibreDWG could not convert the DWG (exit {p.returncode}).')
    return out, {'version': version, 'errors': dict(errors.most_common(20)), 'unstableObjects': unstable}


def duplicates(E, tol=5.0):
    """The same family and type in the host and a linked model, at the same plan position."""
    host = [i for i, e in enumerate(E) if e['modelKey'] == 'HOST' and e['kind'] == 'family']
    link = [i for i, e in enumerate(E) if e['modelKey'] != 'HOST' and e['kind'] == 'family']
    if not host or not link:
        return []
    key = lambda e: (e['family'], e['familyType'])
    bi = BoxIndex([[E[i]['bbox'][0], E[i]['bbox'][1], -1e9, E[i]['bbox'][3], E[i]['bbox'][4], 1e9] for i in link])
    out = []
    for i in host:
        e = E[i]
        cx, cy = (e['bbox'][0] + e['bbox'][3]) / 2, (e['bbox'][1] + e['bbox'][4]) / 2
        for k in bi.near([cx, cy, 0, cx, cy, 0], tol):
            o = E[link[k]]
            ox, oy = (o['bbox'][0] + o['bbox'][3]) / 2, (o['bbox'][1] + o['bbox'][4]) / 2
            if key(o) == key(e) and abs(ox - cx) <= tol and abs(oy - cy) <= tol:
                out.append({'mep': i, 'arch': link[k], 'dz': round(e['bbox'][2] - o['bbox'][2], 1), 'dxy': round(max(abs(ox - cx), abs(oy - cy)), 1)})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dwg', required=True)
    ap.add_argument('--excel')
    ap.add_argument('--out', required=True)
    ap.add_argument('--config')
    ap.add_argument('--name', default='model')
    ap.add_argument('--dxf', help='use an existing DXF conversion of the DWG')
    ap.add_argument('--keep-dxf', action='store_true')
    a = ap.parse_args()
    t0 = time.time()
    cfg = json.load(open(os.path.join(SKILL, 'config', 'default.json')))
    if a.config:
        cfg = deep_merge(cfg, json.load(open(a.config)))
    os.makedirs(a.out, exist_ok=True)
    work = os.path.join(a.out, 'work'); os.makedirs(work, exist_ok=True)
    validation = {'inputs': {}, 'limits': [], 'counts': {}}

    # Stage 1: input and validation
    if not os.path.exists(a.dwg):
        raise SystemExit(f'DWG not found: {a.dwg}')
    validation['inputs']['dwg'] = {'file': os.path.basename(a.dwg), 'bytes': os.path.getsize(a.dwg)}
    prof = None
    if a.excel:
        log('inspecting the schedule')
        prof = sched.inspect(a.excel, cfg)
        validation['inputs']['excel'] = {'file': os.path.basename(a.excel), 'sheets': [s['name'] for s in prof['sheets']],
                                         'scheduleSheets': [s['name'] for s in prof['sheets'] if s['kind'] == 'schedule' and s['levels']],
                                         'records': sum(len(s['records']) for s in prof['sheets'] if s['levels']), 'missingWords': prof['missingWords']}
        if prof['missingWords']:
            cfg['schedule']['missingValue'] = 'TBC' if 'TBC' in prof['missingWords'] else max(prof['missingWords'], key=prof['missingWords'].get)
    else:
        validation['limits'].append('No Excel schedule supplied: no schedule export.')

    # Stage 2: geometry
    if a.dxf:
        dxf, conv = a.dxf, {'version': None, 'errors': {}, 'unstableObjects': 0}
    else:
        log('converting the DWG with LibreDWG')
        dxf, conv = dwg_to_dxf(a.dwg, work)
    validation['inputs']['dwg'].update(format=conv['version'], libredwgErrors=conv['errors'], unstableObjects=conv['unstableObjects'])
    log('reading the DXF')
    doc = ezdxf.readfile(dxf)
    units = doc.header.get('$INSUNITS')
    if units != 4:
        validation['limits'].append(f'Drawing units code {units}, not millimetres (4). Values are reported in drawing units.')
    log('extracting parts')
    x = Reader(doc, host_name=os.path.splitext(os.path.basename(a.dwg))[0]).run()
    del doc
    levels = levels_from(x.annotations, cfg['levels'].get('elevations'))
    grid = grid_from(x.annotations)
    if not levels:
        validation['limits'].append('No level lines in the model: elements are not assigned to storeys.')
    if not grid:
        validation['limits'].append('No structural grid in the model: locations are model coordinates only.')
    if not cfg['coordinates'].get('siteGrid'):
        validation['limits'].append('No site setting-out transform: coordinates are model coordinates, not site grid distances.')
    log(f'{len(x.parts)} parts, {len(levels)} levels, {len(grid)} grid lines; classifying')
    E, crep = classify(x, cfg, levels)
    validation['counts'].update(elements=len(E), noGeometry=len(x.empty), unsupported={f'{k[0]} on {k[1]}': v for k, v in x.unsupported.items()},
                                unknownCategories={str(k): v for k, v in crep['unknown categories'].items()}, pipesWithoutSystem=crep.get('pipes without a system', 0),
                                idSources=dict(collections.Counter(e['idSource'] for e in E)))
    if x.empty:
        validation['limits'].append(f'{len(x.empty)} families have no geometry in the exported view and are left out.')
    if crep['unknown categories']:
        validation['limits'].append('Unknown Revit categories, classified by layer: ' + ', '.join(f'{k} ({v})' for k, v in crep['unknown categories'].items()))
    host_services = sum(1 for e in E if e['modelKey'] == 'HOST' and e['discipline'] in ('PIPE', 'DUCT', 'TRAY', 'CONDUIT'))
    host_code = 'MEP' if host_services > 0.3 * max(1, sum(1 for e in E if e['modelKey'] == 'HOST')) else 'HOST'
    dups = duplicates(E)

    # Stage 5: coordination analysis
    log('detecting clashes and crossings')
    clashes, crossings = detect(E, cfg, levels)
    for c in clashes + crossings:
        c['level'] = level_of(c['point'][2], levels)
        c['grid'] = grid_ref(c['point'], grid)

    # Stage 6: openings, numbered after the schedule's own references so none collide
    log('working out openings')
    start = collections.Counter()
    if prof:
        for s in prof['sheets']:
            for r in s['records']:
                m = re.match(r'BWIC-(\w+)-([HV])-(\d+)', r['ref'] or '')
                if m:
                    start[(m.group(1), m.group(2))] = max(start[(m.group(1), m.group(2))], int(m.group(3)))
    O = Openings(E, crossings, cfg, levels, lambda z: level_of(z, levels))
    openings = O.run()
    if start:
        O.number(start)
    for o in openings:
        o['fire'] = [(i, fire_stopping(E, i, o, cfg, cfg['pipeSystems'])) for i in o['services']]
        o['grid'] = grid_ref(o['centre'], grid)
    validation['limits'] += [k for k in O.report]
    if any(o['provisional'] for o in openings if o['status'] == 'proposed'):
        validation['limits'].append('Opening clearances are provisional: proposed sizes use the default 25 mm for pipes and 50 mm for ducts and tray.')
    if cfg['clash'].get('provisional'):
        validation['limits'].append(f"Clash grades are provisional: {cfg['clash']['tolerance']} mm tolerance, not yet confirmed by the project.")

    # Stage 8: Excel
    reports = {'clash': {'title': f"{cfg['project'].get('name') or x.models['HOST']['name']}, clash report",
                         'source': f'Source: {os.path.basename(a.dwg)}. Locations are model coordinates in mm.', 'sections': ['summary', 'locations', 'fixFirst', 'table', 'cards']}}
    reports['holeSchedule'] = {'title': f"{cfg['project'].get('name') or x.models['HOST']['name']}, builders’ work hole schedule", 'file': 'Builders work hole schedule.xlsx',
                               'intro': f'X, Y and Z are model coordinates in mm from {os.path.basename(a.dwg)}. Check them against the setting-out grid before marking out.',
                               'columns': [{'id': c, 'label': l, 'width': w} for c, l, w in [
                                   ('ref', 'Ref', 16), ('status', 'Status', 11), ('shape', 'Shape', 12), ('size', 'Size mm', 13), ('depth', 'Depth mm', 10), ('x', 'X mm', 10), ('y', 'Y mm', 10),
                                   ('zCentre', 'Z centre mm', 12), ('zUnderside', 'Z underside mm', 14), ('wall', 'Wall', 18), ('wallSource', 'Wall source', 18), ('services', 'Services', 16),
                                   ('serviceSizes', 'Service sizes mm', 30), ('minGap', 'Smallest gap mm', 13), ('gapNeeded', 'Gap needed mm', 13), ('clearance', 'Clearance', 20),
                                   ('fireStopping', 'Fire-stopping (proposed)', 46), ('reviewBy', 'Review by', 20), ('modelMark', 'Model mark', 11), ('crossings', 'Wall crossings', 14)]],
                               'notes': []}
    sched_result = None
    if prof:
        log('filling the schedule')
        rows = sched.rows_for(openings, E, levels, cfg, cfg['pipeSystems'], cfg['systems'])
        matches = sched.match_existing(rows, prof)
        by_open = collections.defaultdict(list)
        for k, r in enumerate(rows):
            by_open[r['opening']].append((k, r))
        renamed = 0
        for o in openings:
            ms = [matches.get(k) for k, _ in by_open[o['id']]]
            refs = {m['ref'] for m in ms if m and m.get('ref')}
            if o['status'] == 'modelled' and ms and all(m and m.get('ref') for m in ms) and len(refs) == 1:
                o['schedule'] = {'ref': refs.pop(), 'sheet': ms[0]['sheet'], 'rows': [m['row'] for m in ms], 'matchedBy': ms[0]['confidence']}
                for k, r in by_open[o['id']]:
                    r['_matched'] = True
                old = o['id']; o['id'] = o['schedule']['ref']; renamed += 1
                for r in rows:
                    if r['opening'] == old:
                        r['opening'] = r['ref'] = o['id']
            elif any(m and m.get('candidates') for m in ms):
                o['schedule'] = {'candidates': sorted({x for m in ms if m for x in m.get('candidates', [])})[:12], 'matchedBy': 'ambiguous: same size, service type and material'}
        if not cfg['schedule'].get('addModelled'):
            for r in rows:
                if r['status'] != 'Proposed':
                    r['_matched'] = True                  # modelled holes go to the reconciliation workbook, not the schedule
        out_xlsx = os.path.join(a.out, 'schedule', os.path.basename(a.excel).replace('.xlsx', ' - TALO Engine.xlsx'))
        os.makedirs(os.path.dirname(out_xlsx), exist_ok=True)
        res = sched.export(a.excel, out_xlsx, prof, rows, cfg, brand={'logo': cfg['project'].get('logo')})
        problems = sched.validate(a.excel, out_xlsx)
        recon = os.path.join(a.out, 'schedule', 'Openings reconciliation.xlsx')
        sched.reconciliation(recon, openings, E, levels)
        sched_result = {'file': os.path.relpath(out_xlsx, a.out), 'rowsWritten': sum(len(v) for v in res['written'].values()), 'bySheet': {k: len(v) for k, v in res['written'].items()},
                        'notPlaced': len(res['skipped']), 'matchedToExisting': renamed, 'ambiguous': sum(1 for o in openings if o.get('schedule', {}).get('candidates')),
                        'templateProblems': problems, 'reconciliation': os.path.relpath(recon, a.out)}
        reports['holeSchedule']['workbook'] = sched_result['file']
        validation['schedule'] = sched_result
        if res['skipped']:
            validation['limits'].append(f"{len(res['skipped'])} schedule rows have no level sheet in the template and are listed in the report only.")
        if problems:
            validation['limits'].append('Schedule template check failed: ' + '; '.join(problems[:5]))

    # Stage 7 and 9: report, package, viewer
    nM = collections.Counter(c['grade'] for c in clashes)
    lo = [min(e['bbox'][k] for e in E) for k in range(3)]; hi = [max(e['bbox'][k + 3] for e in E) for k in range(3)]
    name = cfg['project'].get('name') or x.models['HOST']['name']
    notes = build_notes(E, x, levels, grid, clashes, crossings, openings, dups, validation, conv, a, cfg, host_code)
    extra = {
        'hostCode': host_code, 'hostName': f'{host_code} model' if host_code == 'MEP' else 'Host model', 'hostDesc': os.path.basename(a.dwg),
        'project': {'name': name, 'scope': 'building' if len(levels) > 2 else 'area', 'units': 'mm', 'subtitle': f'{os.path.basename(a.dwg)}, read from its Revit export',
                    'source': {'file': os.path.basename(a.dwg), 'format': f"DWG {conv['version'] or ''}".strip()}, 'reference': cfg['project'].get('reference'),
                    'revision': cfg['project'].get('revision'), 'company': cfg['project'].get('company')},
        'titleBlock': [{'label': 'Drawing', 'value': name, 'wide': True}, {'label': 'Format', 'value': f"DWG {conv['version'] or ''}".strip()}, {'label': 'Units', 'value': 'mm'},
                       {'label': 'Parts', 'value': '{parts}'}, {'label': 'Extent', 'value': '{sectionBox}'}, {'label': 'Clashes', 'value': '{major} major, {minor} minor'},
                       {'label': 'Levels', 'value': str(len(levels)) if levels else 'Not in model'}],
        'bounds': {'min': [round(v, 1) for v in lo], 'max': [round(v, 1) for v in hi], 'centre': [round((p + q) / 2, 1) for p, q in zip(lo, hi)]},
        'clashSummary': (f"Tolerance {cfg['clash']['tolerance']} mm{' (provisional)' if cfg['clash']['provisional'] else ''}. Major: {cfg['clash']['tolerance']} mm or more of overlap, "
                         'or half the smaller part. Minor: less, or into insulation. Touch: surfaces meet.'),
        'clearanceNote': 'Rule: ' + ', '.join(f"{d['clearance']} mm for {d['name'].lower()}" for d in cfg['disciplines'] if d.get('clearance') is not None) +
                         ('. Provisional until the project confirms it.' if cfg.get('clearancesProvisional', True) else '.'),
        'reports': reports, 'validation': validation,
    }
    log('writing the package')
    path, pkg = package.write(a.out, a.name, E, x, cfg, levels, grid, clashes, crossings, openings, dups, notes, extra)
    viewer_src = os.path.join(SKILL, 'viewer', 'viewer.html')
    if os.path.exists(viewer_src):
        html = open(viewer_src).read()
        if "'ncw-corridor/corridor.json'" not in html:
            raise SystemExit('viewer.html has no default package path to set')
        open(os.path.join(a.out, 'index.html'), 'w').write(html.replace("'ncw-corridor/corridor.json'", json.dumps(a.name + '.json').replace('"', "'")))
    summary = {'package': os.path.relpath(path, a.out), 'elements': len(E), 'levels': len(levels), 'clashes': dict(nM), 'crossings': len(crossings),
               'openings': dict(collections.Counter(o['status'] for o in openings)), 'schedule': sched_result, 'limits': validation['limits'],
               'seconds': round(time.time() - t0)}
    json.dump(summary, open(os.path.join(a.out, 'summary.json'), 'w'), indent=2, ensure_ascii=False)
    open(os.path.join(a.out, 'report.md'), 'w').write(report_md(summary, validation, pkg))
    if not a.keep_dxf and not a.dxf:
        shutil.rmtree(work, ignore_errors=True)
    log('done in', summary['seconds'], 's')
    print(json.dumps(summary, indent=2, ensure_ascii=False))


def build_notes(E, x, levels, grid, clashes, crossings, openings, dups, validation, conv, a, cfg, host_code):
    """The Notes tab: what the file is, what was found, and what could not be checked. Generated, never hand-written."""
    g = collections.Counter(c['grade'] for c in clashes)
    measured = collections.Counter(c['measure'] for c in clashes)
    links = [m for m in x.models.values() if m['role'] == 'link']
    ext = [max(e['bbox'][k + 3] for e in E) - min(e['bbox'][k] for e in E) for k in range(3)] if E else [0, 0, 0]
    prop = [o for o in openings if o['status'] == 'proposed']
    blocks = lambda *b: [x_ for x_ in b if x_]
    first = [{'p': f"A {conv['version'] or 'DWG'} drawing, {os.path.getsize(a.dwg) / 1e6:.1f} MB, exported from Revit. The model spans {ext[0] / 1000:.1f} m by {ext[1] / 1000:.1f} m "
                   f"and {ext[2] / 1000:.1f} m high. Units are millimetres, and every coordinate in this viewer is a model coordinate."},
             {'p': f"The host file carries {sum(1 for e in E if e['modelKey'] == 'HOST')} parts. " +
                   (f"{len(links)} linked models are attached, of which {sum(1 for m in links if any(e['modelKey'] == k for k, mm in x.models.items() if mm is m for e in E))} have geometry in this view." if links
                    else 'No linked models are attached, so there is no architectural or structural geometry beyond what the host file holds.')},
             {'p': (f"{len(levels)} levels are read from the model's level lines, from {levels[0]['name']} at {levels[0]['elevation']:,.0f} mm to {levels[-1]['name']} at {levels[-1]['elevation']:,.0f} mm."
                    if levels else 'The model has no level lines, so parts are not assigned to storeys.') +
                   (f" The structural grid has {len(grid)} lines, used to locate every issue." if grid else '')}]
    findings = [{'h3': 'Clashes between services'},
                {'p': f"The check found {g['major']} major and {g['minor']} minor clashes, plus {g['touch']} places where surfaces only touch. "
                      f"{measured['solid']} are measured on the actual intersection solid; {measured['boxes']} involve an open mesh and use the bounding boxes, which overstate the overlap."},
                {'table': 'clashes'}]
    if dups:
        findings += [{'h3': 'Parts modelled twice'}, {'p': f"{len(dups)} families exist in both the host and a linked model at the same plan position."}, {'table': 'duplicates'}]
    walls = any(e['discipline'] in ('WALL', 'FLOOR') for e in E)
    findings += [{'h3': 'Services crossing walls and floors'},
                 {'p': (f"Services meet walls or floors at {len(crossings)} points. {sum(1 for o in openings if o['status'] == 'modelled')} modelled holes and {len(prop)} proposed openings "
                        f"are in [[tab:open|Openings]]. Proposed openings are sized to the service plus the clearance and are not approved."
                        if walls else f"The model has no wall or floor geometry, so crossings cannot be found and no openings are proposed. "
                        f"{sum(1 for o in openings if o['status'] == 'modelled')} modelled hole families are listed in [[tab:open|Openings]] with the services through them.")},
                 {'table': 'proposedOpenings'} if prop else None]
    s = validation.get('schedule')
    if s:
        findings += [{'h3': 'Schedule'}, {'p': f"{s['rowsWritten']} rows for proposed openings were added to the schedule. {s['matchedToExisting']} modelled holes matched exactly one existing record "
                                               f"by size, service type and material, and {s['ambiguous']} have several possible records; all are listed in the reconciliation workbook. Existing records were not changed."}]
    limits = [{'p': l} for l in validation['limits']]
    return [
        {'heading': 'What this file is', 'blocks': first},
        {'heading': 'Models in the file', 'blocks': [{'table': 'models'}]},
        {'heading': 'Findings', 'blocks': blocks(*findings)},
        {'heading': 'Inventory', 'blocks': [{'table': 'inventory'}]},
        {'heading': 'Not checked or missing', 'blocks': limits or [{'p': 'Nothing.'}]},
        {'heading': 'How this was checked', 'blocks': [
            {'p': 'The DWG was converted with LibreDWG and read with ezdxf. Revit writes each element’s id, type and category on every entity, so plates are grouped by element and classified by category.'},
            {'p': 'Clashes are triangle intersections (FCL through trimesh) between disciplines, level by level. A part fully enclosed inside another without crossing a surface would be missed.'},
            {'p': 'Openings follow the clearance rule and round up to ' + str(cfg['openings']['roundTo']) + ' mm. Wall fire ratings and construction come from the model only; where they are missing, the opening is flagged for review.'}]},
    ]


def report_md(summary, validation, pkg):
    L = [f"# {pkg['project']['name']}: validation report", '',
         f"- Elements: {summary['elements']}", f"- Levels: {summary['levels']}", f"- Clashes: {summary['clashes']}", f"- Wall and floor crossings: {summary['crossings']}",
         f"- Openings: {summary['openings']}", '']
    if summary['schedule']:
        s = summary['schedule']
        L += ['## Schedule', '', f"- File: {s['file']}", f"- Rows written: {s['rowsWritten']} {s['bySheet']}", f"- Matched to existing records: {s['matchedToExisting']}",
              f"- Ambiguous: {s['ambiguous']}", f"- Reconciliation: {s['reconciliation']}", f"- Not placed (no level sheet): {s['notPlaced']}", f"- Template check: {'passed' if not s['templateProblems'] else s['templateProblems']}", '']
    L += ['## Not checked or missing', ''] + [f'- {l}' for l in summary['limits']] + ['']
    L += ['## Input', '', '```json', json.dumps(validation['inputs'], indent=2, ensure_ascii=False), json.dumps(validation['counts'], indent=2, ensure_ascii=False), '```', '']
    return '\n'.join(L)


if __name__ == '__main__':
    main()
