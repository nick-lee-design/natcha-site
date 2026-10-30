# Model package, version 1

The format the viewer reads and the TALO Engine skill (`.claude/skills/talo-engine/`) writes. The NCW corridor package in `public/experiments/ncw-corridor/` is the first one; the skill now writes them from any Revit DWG.

A package is a folder:

- `corridor.json`: everything except the geometry. Any name works; the viewer loads `?package=<url>`, and defaults to `ncw-corridor/corridor.json`.
- `geometry/<system>-<level>.bin`: one binary file per chunk, gzipped or raw (`<system>-all` when there are no levels). The viewer checks the first two bytes, so a server that gzips in transit is fine.

Units are millimetres in model coordinates.

## Agreed with Nick, 26 Oct 2026

1. **Parts are referenced by a stable string `id`:** the model plus the Revit element id (`MEP:9732017`), read from the REVIT xdata on every entity. Families inside a linked model carry the link's xdata, so they use their type id and position (`ARCH:T15663458@-6008,-6262,-1900`). Clashes, crossings, openings, duplicates and insulation all refer to parts by id.
2. **Openings live in the package.** The skill writes `openings`. A package without it still works: the viewer then finds the openings itself, as it did before.
3. **Zones get their full record now.** The fields stay null until Natcha sends zone heights and corridor dimensions.
4. **Geometry is split by system and level.** A system is the trade a part belongs to: Mechanical, Electrical, Public Health, Architectural, Structural. Each chunk holds one system, and later one system on one level, so the 19-storey block can load a system or a floor at a time.

## Top level

| Key | Required | What it holds |
| --- | --- | --- |
| `format`, `version` | yes | `"talo-model-package"`, `1` |
| `project` | yes | `name`, `scope` ("corridor", later "block" or "building"), `units`, `subtitle`, `source` (`file`, `format`, `view`, `modified`, `bytes`, `sha256`), `generated`, `revision`. Reports print the model version: the revision when set, otherwise the file, its date and the first 8 characters of its hash |
| `titleBlock` | no | `[{label, value, wide}]`. Values can use `{parts}`, `{sectionBox}` and any grade id such as `{major}` |
| `geometry` | yes | The chunks. See below |
| `bounds` | yes | `min`, `max` and `centre`, each `[x, y, z]`. `core` (`min`, `max`) when a stray part lies far outside the rest; the viewer frames and sections on the core |
| `models` | yes | The host file and its links: `id`, `name`, `desc`, `role` ("host" or "link"), `label`, `number`, `rev`, `contents`, `reviewer` (who reviews openings in its walls) |
| `systems` | yes | `[{id, name}]`: `architectural`, `structural`, `mechanical`, `electrical`, `public-health`. Names are set per project |
| `disciplines` | yes | `id`, `name`, `system`, `explode` (lift in metres when disciplines separate), `clearance` (mm all round an opening; a discipline with a clearance counts as a service) |
| `layers` | yes | `id`, `name`, `desc`, `colour`, `opacity` (start value), `role` ("wall" or "opening"). The opening layer also takes `proposedColour` |
| `lineLayers` | no | `id`, `name`, `desc`, `colour`, `darkColour`, `dash`, `model`, `discipline`, `chunk`, `offset`, `count` |
| `partTypes` | yes | In Parts tab order: `name`, `equipment` (tagged by default), `role` ("insulation", "support", "fire-damper", "opening", "proposed-opening") |
| `pipeSystems` | no | Pipe materials: `name`, `short`, `fireStopping` (overrides the pipe default) |
| `levels` | no | `[{id, name, elevation, source}]`, lowest first, read from the model's level lines and labels |
| `grid` | no | `[{label, a, b}]`: structural grid lines in plan, read from the model |
| `zones` | no | See below |
| `rooms` | no | `[{id, number, name, level, bbox}]`, searched by number or name. Neither NCW export carries rooms yet: Revit has to export rooms or spaces, or a room schedule with positions has to be supplied |
| `rules` | yes | See below |
| `checks` | no | `zoning`: `{status, summary}`, or null for "Not set". `validation`: what the skill read, counted and could not check |
| `ui` | no | `explodeNote` |
| `notes` | no | The Notes tab. See below |
| `reports` | yes | `clash` and `holeSchedule`. See below |
| `elements` | yes | One per part |
| `clashes` | no | Service against service |
| `wallCrossings` | no | Service against wall |
| `openings` | no | Builders' work holes, modelled and proposed |
| `duplicates` | no | `[{mep, arch, dz, dxy}]`, the same part in two models, by id |

## Geometry

`geometry` is a list of chunks: `id`, `system`, `level` (null for `-all` chunks), `uri`, `compression`, then `positions`, `indices` and optionally `lines`. Each block names `type` (`uint16`, `uint32`, `int32` or `float32`), `byteOffset` and `count`.

- `positions`: `count` vertices of x, y, z. With `origin` and `step`, a stored value `q` means `q × step + origin` mm. Without them the values are millimetres. The corridor reference package uses `uint16` at 0.25 mm, which caps a chunk at 16.4 m. The skill writes `float32` relative to each chunk's own `origin`, which keeps sub-millimetre precision across a 245 m building.
- `indices`: triangle indices, local to each element's vertices.
- `lines`: polyline vertices as segment pairs, in the same encoding as `positions`.

## Elements

| Key | Notes |
| --- | --- |
| `id` | Stable reference, as agreed above |
| `mark` | Shown everywhere, for example `D-10`. Unique |
| `layer`, `discipline`, `system`, `model`, `type` | Ids from the lists above. `type` is a part type name |
| `category` | The Revit category name (`Air terminals`, `Mechanical equipment`). The equipment reports go by it, so a family-name rule that renames a part does not move it out of its category |
| `level` | The level the part's underside sits on |
| `kind` | `segment`, `family` or `wall` |
| `size` | Text, for example `600 × 300, 3851 long, horizontal` |
| `description` | Plain description, for example `ELV cable basket 200 × 60`. Openings are described by the viewer |
| `bbox` | `[xmin, ymin, zmin, xmax, ymax, zmax]` |
| `mesh` | `chunk`, `vertexOffset`, `vertexCount`, `indexOffset`, `indexCount`, offsets within the chunk |
| `faces`, `plates` | Mesh face count, and how many loose plates were joined |
| `family`, `familyType`, `revitId`, `revitType` | From Revit, when known |
| `provenance` | Where `id`, `type`, `size` and `description` came from: `revit-xdata`, `type-and-position`, `revit-category`, `family-name`, `layer`, `geometry`, `rule` |
| `pipeSystem`, `pipeSystemFrom` | Pipe material and how it was inferred |
| `insulation`, `insulates` | Id of the insulation shell, or of the part it insulates |
| `insertedOn` | Layer the block was inserted on, when it differs |
| `fireRating` | Walls and doors. Shown on openings; none in the corridor yet |

## Clashes, wall crossings and openings

- Clash: `id`, `a`, `b`, `grade`, `point`, `overlap` (`[x, y, z]` of the bounding box intersection), `depth` (mm), `measure` (`solid`: the thinnest side of the actual intersection solid; `boxes`: the bounding box overlap, used when a mesh is open), `volume`, `tolerance`, `contacts`, `pair`, `level`, `grid`, `zone`, `status`.
- Wall crossing: `id`, `service`, `wall`, `kind` (`wall` or `floor`), `point`, `overlap`, `contacts`, `pair`, `hole` (id of a modelled hole, or null), `opening` (the opening it passes through, or null when the service runs along the wall).
- Opening, in numbered order: `id` (`BWH-1`), `status` ("modelled" or "proposed"), `element` (the hole family, modelled only), `shape` ("circular" or "rectangular"), `axis` (X, Y or Z, through the wall), `bbox`, `wallSpan`, `width`, `height`, `diameter`, `depth`, `services`, `walls`, `crossings`, `dampers`, `overlaps` (opening ids), `gaps` (`[{service, gap, need}]` in mm), `verdict` (`ok`, `tight`, `clash`, `empty`), `fireStopping` (`[{service, text}]`), `orientation` (`H` wall, `V` floor), `level`, `grid`, `reviewStatus` (`Proposed`, `Modelled`, later `Approved`, `Rejected`), `reviewFlags`, `provisional` (clearances not yet confirmed), `schedule` (the matched record, or candidates).

## Zones

`id`, `name`, `kind` ("corridor", later "core" or "riser"), `level`, `bounds`, `width`, `clearHeight`, `ceilingVoid`, `bands` (`[{discipline, zMin, zMax}]`, one per service discipline). The corridor's 6 zones are stretches along its length, with everything but the name still null.

## Rules

- `clash`: `tolerance` (mm), `summary` (the sentence shown with the list), `grades` in severity order: `id`, `name`, `colour`, `actionable` (false keeps a grade out of Fix first, as Touch is now).
- `openings`: `roundTo`, `clearanceNote`, `verdicts`, `fireStopping` (`damper`, `ductWithDamper` with `{dampers}`, `ductNoDamper`, `tray`, `insulatedPipe`, `pipe`, `unknownPipe`), `fireStoppingNote`. These are the defaults the viewer uses when a package has no `openings`.

## Notes

`[{heading, blocks}]`. A block is one of `{h3}`, `{p}`, `{small}` or `{table}`. Text is plain: `[[D-10]]` links a part by mark, `[[tab:open|Openings]]` opens a tab. Tables are drawn by the viewer from the data: `models`, `clashes`, `duplicates`, `proposedOpenings`, `inventory`.

## Reports

- `clash`: `title`, `source`, `sections` in order from `summary`, `locations`, `fixFirst`, `table`, `cards`.
- `holeSchedule`: `title`, `file`, `intro`, `columns` (`[{id, label, width}]`), `notes` (`[{label, text}]`). Column ids: `ref`, `status`, `shape`, `size`, `width`, `height`, `diameter`, `depth`, `x`, `y`, `zCentre`, `zUnderside`, `wall`, `wallSource`, `wallRating`, `services`, `serviceSizes`, `minGap`, `gapNeeded`, `clearance`, `fireStopping`, `reviewBy`, `modelMark`, `revitId`, `crossings`, `overlaps`, `siteCheck`. Natcha's template becomes a reordered, relabelled column list.

## Still open

1. All pipework sits under Public Health. Copper and stainless pipes may be heating or chilled water, which is Mechanical. Revit's System Name is not exported, so that needs the system names from Natcha or a project rule.
2. The Revit section box outline sits in the Architectural chunk.
3. Fix first is still worked out in the viewer.
