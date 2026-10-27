"""Revit vocabulary: built-in category ids, the REVIT xdata a Revit DWG export writes, and link and family names."""
import re

# Revit BuiltInCategory ids written as xdata code 2. Each maps to (category name, discipline, part type).
# Unlisted ids are reported as unknown, never guessed.
CATEGORIES = {
    -2000011: ('Walls', 'WALL', 'Wall'),
    -2000032: ('Floors', 'FLOOR', 'Floor slab'),
    -2000038: ('Ceilings', 'CEILING', 'Ceiling'),
    -2000035: ('Roofs', 'ROOF', 'Roof'),
    -2000023: ('Doors', 'DOOR', 'Door'),
    -2000014: ('Windows', 'WINDOW', 'Window'),
    -2000100: ('Columns', 'STRUCT', 'Column'),
    -2001330: ('Structural columns', 'STRUCT', 'Structural column'),
    -2001320: ('Structural framing', 'STRUCT', 'Beam'),
    -2001300: ('Structural foundations', 'STRUCT', 'Foundation'),
    -2000120: ('Stairs', 'STAIR', 'Stair'),
    -2000126: ('Railings', 'STAIR', 'Railing'),
    -2000151: ('Generic models', 'GENERIC', 'Generic model'),
    -2000080: ('Furniture', 'FURN', 'Furniture'),
    -2001000: ('Casework', 'FURN', 'Casework'),
    -2001040: ('Electrical equipment', 'ELEC', 'Electrical equipment'),
    -2001060: ('Electrical fixtures', 'ELEC', 'Electrical fixture'),
    -2001120: ('Lighting fixtures', 'LITE', 'Light fitting'),
    -2008087: ('Lighting devices', 'LITE', 'Lighting device'),
    -2008085: ('Fire alarm devices', 'ELEC', 'Fire alarm device'),
    -2008083: ('Data devices', 'ELEC', 'Data device'),
    -2008081: ('Communication devices', 'ELEC', 'Communication device'),
    -2008079: ('Security devices', 'ELEC', 'Security device'),
    -2008130: ('Cable tray', 'TRAY', 'Cable tray segment'),
    -2008126: ('Cable tray fittings', 'TRAY', 'Cable tray fitting'),
    -2008132: ('Conduit', 'CONDUIT', 'Conduit'),
    -2008128: ('Conduit fittings', 'CONDUIT', 'Conduit fitting'),
    -2001140: ('Mechanical equipment', 'MECH', 'Mechanical equipment'),
    -2008000: ('Ducts', 'DUCT', 'Duct segment'),
    -2008010: ('Duct fittings', 'DUCT', 'Duct fitting'),
    -2008016: ('Duct accessories', 'DUCT', 'Duct accessory'),
    -2008013: ('Air terminals', 'DUCT', 'Air terminal'),
    -2008020: ('Flexible ducts', 'DUCT', 'Flexible duct'),
    -2008123: ('Duct insulation', 'DUCT', 'Duct insulation'),
    -2008124: ('Duct lining', 'DUCT', 'Duct lining'),
    -2008044: ('Pipes', 'PIPE', 'Pipe segment'),
    -2008049: ('Pipe fittings', 'PIPE', 'Pipe fitting'),
    -2008055: ('Pipe accessories', 'PIPE', 'Pipe accessory'),
    -2008050: ('Flexible pipes', 'PIPE', 'Flexible pipe'),
    -2008122: ('Pipe insulation', 'PIPE', 'Pipe insulation'),
    -2001160: ('Plumbing fixtures', 'PIPE', 'Sanitaryware'),
    -2008099: ('Sprinklers', 'PIPE', 'Sprinkler head'),
    -2000301: ('Section box', 'ANNO', 'Section box'),
    -2001350: ('Revit links', 'LINK', 'Linked model'),
    -2001352: ('Revit links', 'LINK', 'Linked model'),
    -2008077: ('Nurse call devices', 'ELEC', 'Nurse call device'),
    -2000240: ('Levels', 'ANNO', 'Level'),
    -2006020: ('Level heads', 'ANNO', 'Level head'),
    -2000220: ('Grids', 'ANNO', 'Grid line'),
    -2006040: ('Grid heads', 'ANNO', 'Grid head'),
}
ANNOTATION = {-2000240, -2006020, -2000220, -2006040, -2000301}
# centreline subcategories carried by LINE and ARC entities (xdata code 3)
CENTRELINE_SUBCATEGORIES = {-2008045, -2008049, -2008046}

INSULATION = {-2008122, -2008123, -2008124}
SEGMENTS = {-2008000, -2008044, -2008130, -2008132, -2008020, -2008050}


def parse_xdata(entity):
    """REVIT xdata as {code: value}. Inside a linked model every value is written as '<element id>_<value>'."""
    try:
        tags = list(entity.get_xdata('REVIT'))
    except Exception:
        return {}
    out, code = {}, None
    for t in tags:
        if t.code == 1070:
            code = t.value
        elif t.code == 1000 and code is not None:
            out[code] = t.value
    return out


def split_linked(value):
    """'9045883_-2000011' -> ('9045883', '-2000011'); a host value has no prefix."""
    if value is None:
        return None, None
    m = re.fullmatch(r'(\d+)_(-?\d+)', str(value))
    return (m.group(1), m.group(2)) if m else (None, str(value))


def category_of(xd):
    raw = xd.get(2)
    _, v = split_linked(raw)
    try:
        return int(v) if v is not None else None
    except ValueError:
        return None


# Revit names a block '<family> - <type>-<type id>-_<view>_'; family names can contain ' - ', so the type is after the last one
FAMILY_BLOCK = re.compile(r'^(?P<family>.*) - (?P<type>.*?)-(?P<id>\d+|V\d+)-_(?P<view>.*)_$')
FAMILY_BLOCK_NOTYPE = re.compile(r'^(?P<family>.*)-(?P<id>\d+|V\d+)-_(?P<view>.*)_$')


def parse_family_block(name):
    """'Elbow - Welded - SS - 1_5D-10211995-_3D - nkucita_' -> family, type, type id, view. Type ids starting with V are export variants."""
    m = FAMILY_BLOCK.match(name) or FAMILY_BLOCK_NOTYPE.match(name)
    if not m:
        return None
    d = m.groupdict()
    return {'family': d['family'].strip(), 'type': (d.get('type') or '').strip(), 'typeId': d['id'], 'view': d['view'].strip()}


LINK_BLOCK = re.compile(r'(_rvt-\d+-_|\.rvt)', re.I)


def is_link_block(name):
    return bool(LINK_BLOCK.search(name))


ROLE_NAMES = {'A': 'Architectural', 'S': 'Structural', 'M': 'Mechanical', 'E': 'Electrical', 'P': 'Public Health',
              'I': 'Interiors', 'C': 'Civil', 'L': 'Landscape', 'F': 'Fire', 'Y': 'Specialist', 'Z': 'General'}


def parse_link_name(name):
    """Link block name -> drawing number, revision, label and ISO 19650 role letter, each only when the name carries it."""
    base = re.sub(r'_rvt-\d+-_.*$', '', name)
    number = re.match(r'([A-Z0-9]+(?:-[A-Z0-9]+){4,})', base)
    number = number.group(1) if number else None
    rest = base[len(number):].strip('_ ') if number else base
    rev = re.search(r'(?:^|_)(P\d{2}|C\d{2}|rev ?\w+|\d{1,2})(?:_|$)', rest)
    parts = [p for p in rest.split('_') if p and p != (rev.group(1) if rev else None) and not p.lower().startswith('for informat')]
    label = ' '.join(parts).replace('Revit Model', 'model').strip() or None
    role = None
    if number:
        fields = number.split('-')
        singles = [f for f in fields[2:] if len(f) == 1 and f in ROLE_NAMES]
        role = singles[0] if singles else None
    return {'number': number, 'rev': rev.group(1) if rev else None, 'label': label, 'discipline': role}
