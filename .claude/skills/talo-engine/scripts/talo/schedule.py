"""The project's Excel schedule: inspect it, map openings onto its own columns, and export rows into it without disturbing it.

The supplied workbook is the source of truth for the format. Inspection finds each sheet's header row, its columns and who
completes them, the levels the sheet covers, its existing records and the words it uses for missing data. Export writes the
sheet XML directly (lxml), so logos, conditional formats, merges, print settings, formulas and every existing cell survive.
New records go into the sheet's pre-formatted blank rows, or below the last record with its styling. Existing cells are never
overwritten. Columns another party completes (the specialist, the fire engineer) are left empty.
"""
import re
import io
import zipfile
import collections
import openpyxl
from openpyxl.utils import get_column_letter, column_index_from_string
from lxml import etree
from .locate import schedule_levels

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
Q = lambda t: f'{{{NS}}}{t}'

# logical field -> heading patterns, tried in order against each column heading
FIELDS = [
    ('level', r'^Level\b|Level ?/ ?Location|^Floor'),
    ('ref', r'Reference ?/ ?Location|M&E Ref|^Ref(erence)?\b|^BWIC Ref|Opening (ID|Ref)'),
    ('description', r'^Description'),
    ('wallType', r'(Wall|Floor).*Type'),
    ('wallMaterial', r'(Wall|Floor).*(Material|Specification)'),
    ('wallThickness', r'(Wall|Floor).*Thickness'),
    ('penetrationType', r'Letterbox|direct seal|type of penetration'),
    ('fireRating', r'Fire Rating'),
    ('acousticRating', r'Acoustic'),
    ('headOfWall', r'^Head of wall$'),
    ('movement', r'Movement'),
    ('fullPartial', r'Full or Partial'),
    ('height', r'Nominal Height'),
    ('width', r'Nominal Width'),
    ('elevation', r'Elevation from Level'),
    ('bottom', r'Bottom of'),
    ('spacingConfirmed', r'Confirmation'),
    ('serviceName', r'^Service Name'),
    ('serviceType', r'^(Service )?Type$|^Service Type'),
    ('material', r'^Material'),
    ('serviceSize', r'Outside|Diameter|Maximum Size'),
    ('bwicSize', r'BWIC Size|Opening Size'),
    ('cables21', r'cables over'),
    ('insulationType', r'Insulation Type|lagging type'),
    ('insulationThickness', r'Insulation Thickness|lagging thickness'),
    ('coreHole', r'Core Hole'),
    ('support', r'support'),
    ('detail', r'Detail Reference'),
    ('headDetail', r'Head of wall detail'),
    ('specialistComments', r'comments, notes|observations'),
    ('fireEngineerComments', r'Fire Engineer'),
]
# columns the skill may fill, from geometry or the model; the rest belong to other parties
FILLABLE = {'level', 'ref', 'description', 'wallThickness', 'fireRating', 'height', 'width', 'elevation', 'bottom', 'serviceName',
            'serviceType', 'material', 'serviceSize', 'bwicSize', 'cables21', 'insulationType', 'insulationThickness'}


def _text(v):
    return '' if v is None else str(v).strip()


def inspect(path, cfg):
    """Profile of the workbook: sheets, headers, columns, owners, levels, records, conventions."""
    wb = openpyxl.load_workbook(path, data_only=False)
    prof = {'file': path, 'sheets': [], 'missingWords': collections.Counter(), 'images': 0}
    with zipfile.ZipFile(path) as z:
        prof['images'] = len([n for n in z.namelist() if n.startswith('xl/media/')])
    covers = schedule_levels(wb.sheetnames)
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(min_row=1, max_row=min(ws.max_row, 60), values_only=True))
        header, hscore = None, 0
        for r, row in enumerate(rows, 1):
            cells = [_text(v) for v in row]
            score = sum(1 for c in cells if c) + 3 * sum(1 for c in cells if re.search(r'Reference|Location|Service|Size|Rating', c, re.I))
            if score > hscore and sum(1 for c in cells if c) >= 5:
                header, hscore = r, score
        info = {'name': ws.title, 'header': header, 'columns': [], 'levels': covers.get(ws.title, []), 'records': [], 'kind': 'other'}
        if header and hscore >= 20:
            info['kind'] = 'schedule'
            heads = [_text(c.value) for c in ws[header]]
            owners = {}
            for r in range(max(1, header - 2), header):
                for c in ws[r]:
                    if _text(c.value):
                        owners[c.column] = _text(c.value)
            # owner labels span to the next label
            owner, own = None, {}
            for col in range(1, len(heads) + 1):
                owner = owners.get(col, owner)
                own[col] = owner
            used = set()
            for col, h in enumerate(heads, 1):
                if not h:
                    continue
                field = next((f for f, pat in FIELDS if f not in used and re.search(pat, h.replace('\n', ' '), re.I)), None)
                if field:
                    used.add(field)
                info['columns'].append({'col': get_column_letter(col), 'heading': re.sub(r'\s+', ' ', h), 'field': field, 'completedBy': own.get(col)})
            step_row = header + 1 if any(_text(c.value).startswith('Step') for c in ws[header + 1]) else None
            info['firstDataRow'] = (step_row or header) + 1
            refcol = next((c['col'] for c in info['columns'] if c['field'] == 'ref'), None)
            for r in range(info['firstDataRow'], ws.max_row + 1):
                vals = {c['col']: _text(ws[f"{c['col']}{r}"].value) for c in info['columns']}
                if not any(vals.values()):
                    continue
                for v in vals.values():
                    if v.upper() in ('TBC', 'N/A', 'NA', 'TBA', '-', '?'):
                        prof['missingWords'][v] += 1
                info['records'].append({'row': r, 'ref': vals.get(refcol), 'values': vals})
            info['lastRecordRow'] = max([x['row'] for x in info['records']], default=info['firstDataRow'] - 1)
            info['formulas'] = sum(1 for row in ws.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith('='))
        info['merged'] = len(ws.merged_cells.ranges)
        info['conditionalFormats'] = len(ws.conditional_formatting)
        prof['sheets'].append(info)
    prof['missingWords'] = dict(prof['missingWords'])
    return prof


def gsi_size(o):
    return f"{int(round(o['diameter']))} Ø" if o['shape'] == 'circular' else f"{int(round(o['width']))} x {int(round(o['height']))}"


def rows_for(openings, E, levels, cfg, pipe_systems, systems):
    """One schedule row per opening and service, as {field: value}. Missing values use the template's word."""
    miss, na = cfg['schedule']['missingValue'], cfg['schedule']['notApplicable']
    elev = {l['id']: l['elevation'] for l in levels}
    lname = {l['id']: l['name'] for l in levels}
    sname = {s['id']: s['name'] for s in systems}
    psys = {p['name']: p for p in pipe_systems}
    out = []
    for o in openings:
        base = elev.get(o['level'])
        services = o['services'] or [None]
        for i in services:
            s = E[i] if i is not None else None
            d = s.get('dims') if s else None
            if s is None:
                ssize = miss
            elif d and d.get('diameter'):
                ssize = f"{int(round(d['diameter']))} Ø"
            elif d and d.get('width'):
                ssize = f"{int(round(d['width']))} x {int(round(d['height']))}"
            else:
                ssize = miss
            ps = psys.get(s.get('pipeSystem')) if s else None
            stype = (ps or {}).get('service') if s and s['discipline'] == 'PIPE' else \
                    ('Ventilation' if s and s['discipline'] == 'DUCT' else
                     (s.get('trayKind') or 'Cable Tray').replace('LV ', '').replace('ELV ', '').title() if s and s['discipline'] == 'TRAY' else None)
            mat = (ps or {}).get('material') if s and s['discipline'] == 'PIPE' else ('Steel Ductwork' if s and s['discipline'] == 'DUCT' else None)
            ins = s.get('insulation') is not None if s else False
            ins_th = E[s['insulation']].get('insulationThickness') if ins else None
            walls = [E[w] for w in o['walls']]
            rating = ', '.join(sorted({w['fireRating'] for w in walls if w.get('fireRating')})) or miss
            out.append({
                'opening': o['id'], 'service': i, 'status': o['reviewStatus'], '_levelId': o['level'], '_serviceMark': s['mark'] if s else None,
                'level': lname.get(o['level'], miss) if o['level'] else miss,
                'ref': o['id'],
                'description': ('Proposed by TALO Engine, not approved' if o['status'] == 'proposed' else 'Modelled hole') +
                               (f"; review: {'; '.join(o['reviewFlags'])}" if o['reviewFlags'] else ''),
                'wallThickness': int(round(o['depth'])) if o.get('wallFound') else miss,
                'fireRating': rating,
                'height': int(round(o['diameter'] if o['shape'] == 'circular' else o['height'])),
                'width': int(round(o['diameter'] if o['shape'] == 'circular' else o['width'])),
                'elevation': int(round(o['centre'][2] - base)) if base is not None else miss,
                'bottom': int(round(o['bbox'][2] - base)) if base is not None else miss,
                'serviceName': sname.get(s['system'], miss) if s else miss,
                'serviceType': stype or miss,
                'material': mat or ('Galvanised Steel' if s and s['discipline'] == 'TRAY' else miss),
                'serviceSize': ssize,
                'bwicSize': gsi_size(o),
                'cables21': miss if s and s['discipline'] == 'TRAY' else na,
                'insulationType': miss if ins else na,
                'insulationThickness': (f'{int(round(ins_th))}mm' if ins_th else miss) if ins else na,
            })
    return out


def sheet_for(level, prof):
    for sh in prof['sheets']:
        if sh['kind'] == 'schedule' and level in sh['levels']:
            return sh
    return None


def match_existing(rows, prof):
    """Candidate existing records per row: same sheet, same BWIC size, service type and material. Unique and unclaimed is a match."""
    claimed, out = set(), {}
    for k, r in enumerate(rows):
        sh = sheet_for_level_name(r, prof)
        if not sh:
            continue
        cols = {c['field']: c['col'] for c in sh['columns'] if c['field']}
        def norm(v): return re.sub(r'\s+', ' ', str(v or '')).strip().lower()
        unknown = {'', 'tbc', 'n/a', 'na', 'tba', '-'}
        def same(x, f):
            a, b = norm(x['values'].get(cols.get(f))), norm(r[f])
            return a in unknown or b in unknown or a == b      # a field counts only where both sides know it
        cands = [x for x in sh['records'] if cols.get('bwicSize') and norm(x['values'].get(cols['bwicSize'])) == norm(r['bwicSize'])
                 and all(same(x, f) for f in ('serviceType', 'material', 'serviceSize') if cols.get(f))]
        free = [x for x in cands if (sh['name'], x['row']) not in claimed]
        if len(free) == 1:
            claimed.add((sh['name'], free[0]['row']))
            out[k] = {'sheet': sh['name'], 'row': free[0]['row'], 'ref': free[0]['ref'], 'confidence': 'unique match on size, service type and material'}
        elif free:
            out[k] = {'sheet': sh['name'], 'candidates': [x['ref'] for x in free][:12], 'confidence': 'ambiguous'}
    return out


def reconciliation(path, openings, E, levels):
    """A separate workbook: every opening, its match to the schedule's records, and what to check. The template is not touched."""
    from openpyxl.styles import Font, Alignment, PatternFill
    wb = openpyxl.Workbook()
    ws = wb.active; ws.title = 'Openings'
    head = ['Ref', 'Status', 'Level', 'Grid', 'Shape', 'Size mm', 'X mm', 'Y mm', 'Z mm', 'Services', 'Schedule record', 'Match', 'To check']
    ws.append(head)
    for o in openings:
        s = o.get('schedule') or {}
        ws.append([o['id'], o['reviewStatus'], o['level'] or '', o.get('grid') or '', o['shape'], gsi_size(o), *o['centre'],
                   ', '.join(E[i]['mark'] + ' ' + (E[i].get('description') or '') for i in o['services']) or 'None found in the model',
                   s.get('ref') or ', '.join(s.get('candidates', [])), s.get('matchedBy') or 'No record with this size, service type and material',
                   '; '.join(o['reviewFlags'])])
    font, bold = Font(name='Inter', size=10), Font(name='Inter', size=10, bold=True)
    for row in ws.iter_rows():
        for c in row:
            c.font = font; c.alignment = Alignment(vertical='top', wrap_text=c.column in (10, 11, 12, 13))
    for c in ws[1]:
        c.font = bold; c.fill = PatternFill('solid', fgColor='E6EAE9')
    for k, w in enumerate([16, 11, 8, 12, 12, 10, 9, 9, 9, 44, 30, 34, 50], 1):
        ws.column_dimensions[get_column_letter(k)].width = w
    ws.freeze_panes = 'A2'; ws.auto_filter.ref = f'A1:{get_column_letter(len(head))}{ws.max_row}'
    wb.save(path)


def sheet_for_level_name(r, prof):
    lvl = r.get('_levelId')
    return sheet_for(lvl, prof) if lvl else None


def export(template, out_path, prof, rows, cfg, brand=None):
    """Write rows into the template's level sheets. Returns what was written where."""
    zin = zipfile.ZipFile(template)
    files = {n: zin.read(n) for n in zin.namelist()}
    wbx = etree.fromstring(files['xl/workbook.xml'])
    rels = etree.fromstring(files['xl/_rels/workbook.xml.rels'])
    target = {r.get('Id'): 'xl/' + r.get('Target').lstrip('/').replace('xl/', '') for r in rels}
    path_of = {s.get('name'): target[s.get(f'{{{RNS}}}id')] for s in wbx.iter(Q('sheet'))}
    written = collections.defaultdict(list)
    by_sheet = collections.defaultdict(list)
    skipped = []
    for r in rows:
        sh = sheet_for(r.get('_levelId'), prof) if r.get('_levelId') else None
        if sh is None or r.get('_matched'):
            if sh is None:
                skipped.append(r)
            continue
        by_sheet[sh['name']].append(r)
    for name, rs in by_sheet.items():
        sh = next(s for s in prof['sheets'] if s['name'] == name)
        p = path_of[name]
        root = etree.fromstring(files[p])
        data = root.find(Q('sheetData'))
        rows_el = {int(r.get('r')): r for r in data.iter(Q('row'))}
        cols = {c['field']: c['col'] for c in sh['columns'] if c['field'] in FILLABLE}
        # the level as this sheet writes it ('Level 03'), when its records agree on one
        lv_words = collections.Counter(x['values'].get(cols.get('level')) for x in sh['records'] if cols.get('level') and x['values'].get(cols['level']))
        sheet_level = lv_words.most_common(1)[0][0] if lv_words and lv_words.most_common(1)[0][1] >= 0.8 * len(sh['records']) else None
        style_row = rows_el.get(sh['lastRecordRow'])
        style = {c.get('r').rstrip('0123456789'): c.get('s') for c in style_row.iter(Q('c'))} if style_row is not None else {}
        rn = sh['lastRecordRow'] + 1
        for r in rs:
            row = rows_el.get(rn)
            if row is None:
                row = etree.SubElement(data, Q('row'), r=str(rn))
                if style_row is not None:
                    for a in ('spans', 'ht', 'customHeight'):
                        if style_row.get(a):
                            row.set(a, style_row.get(a))
                rows_el[rn] = row
            cells = {c.get('r'): c for c in row.iter(Q('c'))}
            for field, col in cols.items():
                v = sheet_level if field == 'level' and sheet_level else r.get(field)
                if v is None or v == '':
                    continue
                ref = f'{col}{rn}'
                c = cells.get(ref)
                if c is not None and (c.find(Q('v')) is not None or c.find(Q('is')) is not None):
                    continue                          # never overwrite
                if c is None:
                    c = etree.Element(Q('c'), r=ref)
                    if style.get(col):
                        c.set('s', style[col])
                    # keep cells in column order
                    after = [x for x in row.iter(Q('c')) if column_index_from_string(x.get('r').rstrip('0123456789')) < column_index_from_string(col)]
                    (after[-1].addnext(c) if after else row.insert(0, c))
                    cells[ref] = c
                for ch in list(c):
                    c.remove(ch)
                if isinstance(v, (int, float)):
                    c.attrib.pop('t', None)
                    etree.SubElement(c, Q('v')).text = str(v)
                else:
                    c.set('t', 'inlineStr')
                    is_ = etree.SubElement(c, Q('is'))
                    t = etree.SubElement(is_, Q('t')); t.text = str(v)
                    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            written[name].append({'row': rn, 'ref': r.get('ref'), 'service': r.get('_serviceMark')})
            rn += 1
        # rows must stay in order; widen the used range
        ordered = sorted(data.iter(Q('row')), key=lambda e: int(e.get('r')))
        for e in ordered:
            data.append(e)
        dim = root.find(Q('dimension'))
        if dim is not None:
            m = re.match(r'([A-Z]+\d+):([A-Z]+)(\d+)', dim.get('ref') or '')
            if m and int(m.group(3)) < rn - 1:
                dim.set('ref', f'{m.group(1)}:{m.group(2)}{rn - 1}')
        files[p] = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
    if brand and brand.get('logo'):
        media = sorted(n for n in files if n.startswith('xl/media/'))
        if media:
            files[media[0]] = open(brand['logo'], 'rb').read()
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in zin.namelist():
            zout.writestr(zin.getinfo(n), files[n])
    return {'written': dict(written), 'skipped': skipped}


def validate(template, out_path):
    """The export keeps every sheet, its order, every existing value, every image and conditional format."""
    a = openpyxl.load_workbook(template, data_only=False)
    b = openpyxl.load_workbook(out_path, data_only=False)
    problems = []
    if a.sheetnames != b.sheetnames:
        problems.append('sheet names or order changed')
    for ws in a.worksheets:
        wb2 = b[ws.title]
        for row in ws.iter_rows():
            for c in row:
                if c.value is not None and wb2[c.coordinate].value != c.value:
                    problems.append(f'{ws.title}!{c.coordinate} changed')
        if len(ws.merged_cells.ranges) != len(wb2.merged_cells.ranges):
            problems.append(f'{ws.title}: merged cells changed')
        if len(ws.conditional_formatting) != len(wb2.conditional_formatting):
            problems.append(f'{ws.title}: conditional formatting changed')
    with zipfile.ZipFile(template) as z1, zipfile.ZipFile(out_path) as z2:
        if sorted(n for n in z1.namelist() if 'media' in n or 'drawing' in n) != sorted(n for n in z2.namelist() if 'media' in n or 'drawing' in n):
            problems.append('images or drawings changed')
    return problems
