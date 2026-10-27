# Revit DWG exports

What a Revit 3D-view DWG export contains, as read from the NCW corridor and the 19-storey Newington Causeway model (both AC1032, AutoCAD 2018).

## Entities

| What | How it arrives |
| --- | --- |
| Pipes, ducts, tray, insulation, walls | Loose polyface meshes (`POLYLINE`, polyface mode), several per element |
| Fittings, accessories, equipment, light fittings | Block inserts. Block name: `<family> - <type>-<type id>-_<view>_` (a `V<n>` id marks an export variant) |
| Linked models | One block per link, inserted once: `<drawing number>_<label>_<rev>_..._rvt-1-_<view>_`. It holds the link's walls and its own family inserts |
| Centrelines | `LINE` and `ARC` on `*-CNTR` layers |
| Levels | `LINE` (category Levels) at each level's elevation, a level-head insert and an `MTEXT` label about 500 mm above the line |
| Grid | `LINE` (category Grids) and an `MTEXT` label near one end |
| Section box | `LINE` on `G-ANNO-SYMB` (category Section box) |

## REVIT xdata

Every entity carries xdata under the application name `REVIT`, as pairs of an integer code (1070) and a string (1000):

| Code | Meaning |
| --- | --- |
| 1 | Element id (the instance) |
| 2 | Built-in category id, for example −2008044 Pipes, −2000011 Walls |
| 3 | Subcategory (centrelines) |
| 4 | Material id (a number; material names are not exported) |
| 5 | Type id |

Inside a linked model every value is written `<element id>_<value>`. Family inserts inside a link carry the link's xdata, not their own, so they are identified by type id and position.

The type id in a block name is the family type's, shared by every instance. Only code 1 identifies an instance.

## What exports leave out

- Revit parameters: Mark, System Name and Classification, fire rating, level, room. The schedule's BWIC references are not in the DWG.
- Material names (only ids), and therefore wall construction.
- Linked models that are not loaded, or that are cropped out of the section box, arrive as empty blocks.
- A services-only export (no links loaded) has no walls or floors, so crossings cannot be found.

## LibreDWG

LibreDWG 0.14 converts both files. It reports `Unstable Class object MATERIAL` warnings (materials are partly supported) and, on large files, some `MTEXT` and table-style decode errors. Geometry is unaffected; the validation report lists the counts.

## Scale

The 19-storey model: 104 MB DWG, 947 MB DXF (32 s to convert), 169 s and 4.5 GB to load in ezdxf, about 29,000 Revit elements, 28 levels from B02 to L25, 19 grid lines.
