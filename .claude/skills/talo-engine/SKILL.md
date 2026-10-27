---
name: talo-engine
description: Turn a Revit-exported DWG and the project's Excel schedule (such as a builders' work fire-stopping schedule) into a TALO Engine coordination workspace - a model package and 3D viewer, clash and wall or floor crossing detection, proposed builders' work openings (BWIC), a validation report, and the schedule filled in its own template. Use when someone supplies a DWG (a corridor, a floor or a whole multi-storey building) with or without an Excel schedule and wants clashes, openings, a coordination report or a filled schedule.
---

# TALO Engine

Takes a DWG and an Excel schedule and produces a coordination workspace from the real engineering data. Works on any Revit DWG export, from a corridor to a 19-storey block. Never fabricates geometry, dimensions, fire ratings or construction: what the files do not say is reported as missing.

## Before the first run

`scripts/setup.sh` installs LibreDWG (Homebrew) and the Python libraries into `.venv` inside this folder. It is safe to rerun.

Disk and memory: a 100 MB DWG becomes a ~1 GB DXF while it runs (deleted afterwards) and needs about 5 GB of memory.

## Run

```sh
.venv/bin/python scripts/run.py --dwg MODEL.dwg --excel SCHEDULE.xlsx --out OUTPUT_DIR [--config project.json] [--name model]
.venv/bin/python scripts/validate_package.py OUTPUT_DIR/model.json
```

Copy uploaded files into their own empty folder first, and pass paths as arguments. A large model takes several minutes; run it in the background and wait for it.

`project.json` overrides anything in `config/default.json`: project name, reference, revision, company and logo, clash tolerance and grades, clearances per discipline, reference format, level elevations, a site grid transform. Ask the user for these when they matter; never guess them.

## What it does, in order

1. **Inputs.** Inspects the workbook (sheets, header row, columns, who completes each, the levels each sheet covers, existing records, its words for missing data) and checks the DWG.
2. **Geometry.** Converts the DWG with LibreDWG and reads it with ezdxf. Revit writes each entity's element id, type and category as xdata, so plates are grouped by Revit element and classified by Revit category. Linked models (architectural, structural) are read from their blocks. Family names refine part types by the rules in the config.
3. **Levels and grid.** Read from the model's level lines and labels and its grid lines and labels. Every element gets a level; every issue gets a level and a grid reference such as `C–D / 4`.
4. **Clashes.** Triangle intersection between disciplines, level by level, measured on the actual intersection solid where both meshes are closed. Graded by the project's tolerance; grades stay marked provisional until the project confirms them.
5. **Crossings and openings.** A service meeting a wall or floor is a crossing. Modelled hole families take their axis and depth from the wall; services through them are checked against the clearance. Where there is no adequate hole, a proposed opening is sized to the service plus clearance, rounded up. Every proposed opening is `Proposed` and carries review flags (structural model, construction, fire rating unknown).
6. **Schedule.** One row per opening and service, mapped onto the template's own headings. Only proposed openings are added to the schedule, numbered after the references it already uses. Modelled holes are usually in it already, so they go to a separate reconciliation workbook with the records each one may match (exactly one record with the same level sheet and BWIC size, and the same service type, material and size where both sides know them, is a match). New rows go into the sheet's pre-formatted blank rows. Existing cells are never overwritten; columns another party completes are left empty; missing values use the template's own word (`TBC`, `N/A`). The result is checked against the template.
7. **Package and viewer.** Writes `model.json`, geometry chunks per system and level, `index.html` (the viewer, opening this package), `report.md` and `summary.json`.

## Outputs

| File | What it is |
| --- | --- |
| `index.html` + `model.json` + `geometry/` | The workspace. Serve the folder over HTTP (`python3 -m http.server`); a browser will not load the chunks from `file://` |
| `schedule/<template> - TALO Engine.xlsx` | The supplied workbook with the proposed openings added |
| `schedule/Openings reconciliation.xlsx` | Every opening, modelled and proposed, with its schedule match and what to check |
| `report.md` | Validation report: counts, what was not checked, what is missing |
| `summary.json` | The same, for tools |

## Rules

- Source data, calculated values, suggestions and missing information stay distinct. Every element records where its id and type came from; derived values say how they were derived.
- Never invent a fire rating, wall construction, level, grid origin or site coordinate. Report it as missing.
- Proposed openings are never approved, and the source DWG is never modified.
- If the model has no wall or floor geometry (a services-only export), say that crossings and proposed openings could not be checked, and ask for the architectural and structural models or a DWG exported with links.
- Report what LibreDWG could not decode, unknown Revit categories, families with no geometry, and pipes with no inferred system.

## Telling the user

Lead with what was produced and the numbers (elements, levels, clashes by grade, crossings, openings modelled and proposed, schedule rows written and matched). Then list what could not be checked and what is needed to close each gap. Keep it short.

## References

- `references/model-package.md`: the package format the viewer reads.
- `references/revit-dwg.md`: how Revit DWG exports are structured, and what they leave out.
- `references/schedule.md`: how the schedule is read, mapped and written.
- `references/requirements.md`: the TALO Engine requirements, and which stage meets each.
