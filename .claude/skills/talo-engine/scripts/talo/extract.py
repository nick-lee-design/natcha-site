"""DXF -> parts. Each part is one Revit element: its triangles in model millimetres, its category and where it came from.

Revit writes services as loose polyface plates in model space and families as blocks. A linked model arrives as one block
holding its walls and its own family inserts. Every entity carries REVIT xdata naming its element, type and category, so
plates are grouped by element id, never by guessing from shared vertices.

Block meshes are built once and transformed per insert, so repeated families across storeys cost one matrix multiply each.
"""
import collections
import numpy as np
from ezdxf.render import MeshBuilder
from ezdxf.math import Matrix44
from .revit import parse_xdata, category_of, split_linked, parse_family_block, is_link_block, parse_link_name, ANNOTATION

MESH_TYPES = {'POLYLINE', 'MESH', '3DFACE', 'POLYFACE'}
LINE_TYPES = {'LINE', 'ARC', 'LWPOLYLINE', 'SPLINE', 'CIRCLE'}


def polyface_arrays(e):
    """Triangles of one mesh-like entity: (vertices Nx3, triangles Mx3), or None when it is not a surface."""
    t = e.dxftype()
    try:
        if t == 'POLYLINE':
            if not e.is_poly_face_mesh and not e.is_polygon_mesh:
                return None
            mb = MeshBuilder.from_polyface(e)
        elif t == 'MESH':
            mb = MeshBuilder.from_mesh(e)
        elif t == '3DFACE':
            pts = [e.dxf.vtx0, e.dxf.vtx1, e.dxf.vtx2, e.dxf.vtx3]
            v = np.array([tuple(p) for p in pts], float)
            tri = [[0, 1, 2]] if np.allclose(v[2], v[3]) else [[0, 1, 2], [0, 2, 3]]
            return v, np.array(tri, np.int64)
        else:
            return None
    except Exception:
        return None
    if not mb.vertices or not mb.faces:
        return None
    v = np.array([tuple(p) for p in mb.vertices], float)
    tris = []
    for f in mb.faces:
        f = [i for k, i in enumerate(f) if k == 0 or i != f[k - 1]]
        for k in range(1, len(f) - 1):
            if f[0] != f[k] and f[k] != f[k + 1] and f[0] != f[k + 1]:
                tris.append((f[0], f[k], f[k + 1]))
    if not tris:
        return None
    return v, np.array(tris, np.int64)


def line_points(e):
    """Segment pairs of a line-like entity, in WCS."""
    t = e.dxftype()
    try:
        if t == 'LINE':
            return np.array([tuple(e.dxf.start), tuple(e.dxf.end)], float)
        pts = [tuple(p) for p in e.flattening(2.0)] if t in ('ARC', 'CIRCLE', 'SPLINE') else None
        if t == 'LWPOLYLINE':
            ocs = e.ocs()
            pts = [tuple(ocs.to_wcs((x, y, e.dxf.elevation))) for x, y in e.get_points('xy')]
        if not pts or len(pts) < 2:
            return None
        a = np.array(pts, float)
        return np.repeat(a, 2, axis=0)[1:-1]
    except Exception:
        return None


class Part:
    __slots__ = ('key', 'model', 'instance', 'typeId', 'family', 'familyType', 'category', 'layer', 'insertLayer',
                 'kind', 'verts', 'tris', 'plates', 'revitId', 'source', 'layers')

    def __init__(self, key, model):
        self.key, self.model = key, model
        self.instance = self.typeId = self.family = self.familyType = self.category = self.layer = self.insertLayer = None
        self.kind, self.verts, self.tris, self.plates, self.revitId, self.source = None, [], [], 0, None, 'revit-xdata'
        self.layers = collections.Counter()

    def add(self, v, t, layer=None):
        if layer and layer != '0':
            self.layers[layer] += len(t)
        n = sum(len(x) for x in self.verts)
        self.verts.append(v)
        self.tris.append(t + n)
        self.plates += 1

    def mesh(self):
        if not self.verts:
            return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
        return np.vstack(self.verts), np.vstack(self.tris)


class Extraction:
    def __init__(self):
        self.parts = collections.OrderedDict()
        self.lines = collections.defaultdict(list)       # layer -> list of segment-pair arrays
        self.line_meta = {}                               # layer -> {'category': .., 'model': ..}
        self.models = collections.OrderedDict()           # model id -> info
        self.unsupported = collections.Counter()          # (entity type, layer) the converter could not use
        self.no_xdata = 0
        self.empty = []
        self.annotations = []                             # level and grid lines and labels: {'what', 'layer', 'category', 'text', 'points'}
        self.units = None
        self.extents = None

    def part(self, key, model):
        p = self.parts.get(key)
        if p is None:
            p = self.parts[key] = Part(key, model)
        return p


def _xf(m, v):
    """Transform Nx3 by a Matrix44 with numpy."""
    if m is None:
        return v
    a = np.array([list(r) for r in m.rows()], float)       # ezdxf matrices act on row vectors
    return v @ a[:3, :3] + a[3, :3]


class Reader:
    def __init__(self, doc, host_id='HOST', host_name=None):
        self.doc, self.x = doc, Extraction()
        self.host = host_id
        self.x.models[host_id] = {'id': host_id, 'role': 'host', 'name': host_name or 'Host model'}
        self.block_cache = {}
        self.x.units = doc.header.get('$INSUNITS')
        self.x.extents = (tuple(doc.header.get('$EXTMIN', (0, 0, 0))), tuple(doc.header.get('$EXTMAX', (0, 0, 0))))

    # --- blocks: local meshes built once
    def block_items(self, name):
        """[(kind, entity-like data)] for a block in block coordinates: ('mesh', layer, xd, v, t), ('line', layer, xd, pts), ('insert', entity)."""
        if name in self.block_cache:
            return self.block_cache[name]
        items = []
        blk = self.doc.blocks.get(name)
        if blk is not None:
            for e in blk:
                t = e.dxftype()
                if t == 'INSERT':
                    items.append(('insert', e))
                elif t in MESH_TYPES:
                    a = polyface_arrays(e)
                    if a is not None:
                        items.append(('mesh', e.dxf.layer, parse_xdata(e), a[0], a[1]))
                    else:
                        self.x.unsupported[(t, e.dxf.layer)] += 1
                elif t in LINE_TYPES:
                    p = line_points(e)
                    if p is not None:
                        items.append(('line', e.dxf.layer, parse_xdata(e), p))
                elif t not in ('ATTDEF', 'ATTRIB', 'TEXT', 'MTEXT', 'POINT', 'HATCH', 'DIMENSION'):
                    self.x.unsupported[(t, e.dxf.layer)] += 1
        self.block_cache[name] = items
        return items

    def run(self):
        msp = self.doc.modelspace()
        for e in msp:
            t = e.dxftype()
            xd = parse_xdata(e)
            cat = category_of(xd)
            if t in ('TEXT', 'MTEXT'):
                txt = e.plain_text() if t == 'MTEXT' else e.dxf.text
                self.x.annotations.append({'what': 'text', 'layer': e.dxf.layer, 'category': cat, 'text': txt.strip(), 'points': [tuple(e.dxf.insert)]})
                continue
            if cat in ANNOTATION and cat != -2000301:
                pts = line_points(e) if t in LINE_TYPES else None
                pos = [tuple(e.dxf.insert)] if t == 'INSERT' else pts.tolist() if pts is not None else []
                self.x.annotations.append({'what': 'insert' if t == 'INSERT' else 'line', 'layer': e.dxf.layer, 'category': cat, 'text': None, 'points': pos})
                continue
            if t == 'INSERT':
                if is_link_block(e.dxf.name):
                    self.read_link(e, xd)
                else:
                    self.read_family(e, xd, self.host, None, None)
            elif t in MESH_TYPES:
                a = polyface_arrays(e)
                if a is None:
                    self.x.unsupported[(t, e.dxf.layer)] += 1
                    continue
                self.add_loose(self.host, e.dxf.layer, xd, a[0], a[1], e.dxf.handle)
            elif t in LINE_TYPES:
                p = line_points(e)
                if p is not None:
                    self.add_line(e.dxf.layer, xd, p, self.host)
            elif t not in ('POINT', 'HATCH', 'DIMENSION', 'VIEWPORT'):
                self.x.unsupported[(t, e.dxf.layer)] += 1
        # parts with no geometry in the exported view are dropped and reported
        self.x.empty = [p for p in self.x.parts.values() if not p.verts]
        for p in self.x.empty:
            del self.x.parts[p.key]
        return self.x

    def add_line(self, layer, xd, pts, model):
        self.x.lines[layer].append(pts)
        self.x.line_meta.setdefault(layer, {'category': category_of(xd), 'model': model})

    def add_loose(self, model, layer, xd, v, t, handle):
        """A loose plate: one piece of an element written as separate polyfaces."""
        raw = xd.get(1)
        inst = raw if model == self.host else (split_linked(raw)[0] if raw else None)
        if not inst:
            self.x.no_xdata += 1
            inst, src = 'H' + handle, 'dxf-handle'
        else:
            src = 'revit-xdata'
        p = self.x.part((model, inst), model)
        if p.kind is None:
            p.instance, p.category, p.layer, p.kind, p.source = inst, category_of(xd), layer, 'element', src
            tid = xd.get(5)
            p.typeId = split_linked(tid)[1] if tid else None
            p.revitId = inst if src == 'revit-xdata' else None
        p.add(v, t)

    def read_family(self, ins, xd, model, parent_m, parent_layer, link_prefix=None):
        """A family instance: every mesh in its block, transformed, becomes one part."""
        name = ins.dxf.name
        info = parse_family_block(name) or {'family': name, 'type': '', 'typeId': None, 'view': None}
        m = ins.matrix44()
        if parent_m is not None:
            m = m @ parent_m
        layer = ins.dxf.layer if ins.dxf.layer != '0' or parent_layer is None else parent_layer
        inst = xd.get(1)
        if model != self.host or not inst:
            # families inside a linked model carry the link's xdata, not their own: name them by type and position
            pos = _xf(m, np.zeros((1, 3)))[0]
            inst = 'T%s@%d,%d,%d' % (info['typeId'], *np.round(pos).astype(int))
            src = 'type-and-position'
        else:
            src = 'revit-xdata'
        p = self.x.part((model, inst), model)
        p.instance, p.kind, p.source = inst, 'family', src
        p.family, p.familyType, p.typeId = info['family'], info['type'], info['typeId']
        p.category = category_of(xd) if model == self.host else None
        p.revitId = inst if src == 'revit-xdata' else None
        p.layer = p.insertLayer = layer
        for it in self.block_items(name):
            if it[0] == 'mesh':
                p.add(_xf(m, it[3]), it[4], it[1])
            elif it[0] == 'line':
                self.add_line(it[1] if it[1] != '0' else layer, it[2], _xf(m, it[3]), model)
            elif it[0] == 'insert':
                self.read_family(it[1], parse_xdata(it[1]), model, m, layer)
        if p.layers:
            p.layer = p.layers.most_common(1)[0][0]           # the geometry's layer; the insert's is kept as insertLayer
        if mcount(ins) > 1:
            self.x.unsupported[('MINSERT', layer)] += 1

    def read_link(self, ins, xd):
        info = parse_link_name(ins.dxf.name)
        lid = 'L%d' % (len(self.x.models))
        self.x.models[lid] = {'id': lid, 'role': 'link', 'block': ins.dxf.name, **info, 'revitLinkId': split_linked(xd.get(1))[0]}
        m = ins.matrix44()
        for it in self.block_items(ins.dxf.name):
            if it[0] == 'mesh':
                layer, ixd = it[1], it[2]
                self.add_loose(lid, layer, ixd, _xf(m, it[3]), it[4], 'L')
            elif it[0] == 'line':
                self.add_line(it[1], it[2], _xf(m, it[3]), lid)
            elif it[0] == 'insert':
                sub = it[1]
                if is_link_block(sub.dxf.name):
                    self.x.unsupported[('NESTED LINK', sub.dxf.layer)] += 1
                    continue
                self.read_family(sub, parse_xdata(sub), lid, m, sub.dxf.layer)


def mcount(ins):
    try:
        return ins.mcount
    except Exception:
        return 1
