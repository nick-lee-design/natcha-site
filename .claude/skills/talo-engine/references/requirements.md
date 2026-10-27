# Requirements coverage

Against "TALO Engine: Complete AI Skill Requirements" v1.0. **Skill** means this folder's scripts; **viewer** means `viewer/viewer.html`, which reads the package.

| Requirement | Where | State |
| --- | --- | --- |
| 2.1 Inspect the DWG: geometry, units, layers, ids, links, openings, levels, limitations | `extract`, `classify`, `locate`, report | Done |
| 2.2 Inspect the Excel: sheets, headings, order, owners, conventions, links to DWG objects | `schedule.inspect`, `match_existing` | Done. Links are by level, size, service type and material; DWG exports carry no BWIC references |
| 2.3 Optional project information | `config/default.json`, `--config` | Done |
| 3.1 Geometry in real proportions and positions; report what could not be converted | `extract`, report | Done |
| 3.2 Model, viewer, building grid and site coordinates kept apart | `locate` (building grid), `coordinates.siteGrid` | Building grid done. A site transform has a slot in the config, but is not applied yet |
| 3.3 Large models: load by level or area | Package chunks per system and level | Skill done. The viewer still loads every chunk at once |
| 4 Viewer controls, selection, layers, filters | Viewer | Done for the corridor. Level and grid display, and a building-scale level picker, still to do |
| 5.1 Section box clipping real geometry | Viewer | Done |
| 5.2–5.4 Saved named views, persistent, for meetings | Viewer | To do (agreed: in the browser first, shared later) |
| 6.1–6.2 Clashes on actual geometry, ids, location, tolerance, classification | `clash` | Done. Service against structure when the model has structure |
| 6.3 Tolerance per project and per discipline pair; provisional until confirmed | `config.clash` | Done |
| 6.3 Required clearance between services (soft clashes) | `config.clash.clearances` | To do |
| 6.4 Clash list, go to, highlight, section box, status | Viewer | Done, except status changes |
| 7.1 Services through walls without an adequate opening | `openings` | Done, for walls and floors aligned to X, Y or Z |
| 7.2 Circular or rectangular, sized to service, clearance and wall thickness | `openings` | Done. Openings in walls at an angle to the axes are not yet sized correctly |
| 7.3 The hole cut through the wall mesh | Viewer | To do (the package carries each opening's box, shape and axis) |
| 7.4 Proposed status; approve, reject, comment, adjust | Package `reviewStatus`; viewer | Skill done. Review in the viewer still to do |
| 7.5 Flags for structural, fire-rated or unknown walls | `openings.review` | Done |
| 7.6 The DWG is never modified | All | Done |
| 8 Opening record fields | Package `openings`, schedule | Done |
| 9.1 Report entry: image, location, description, measurement, tolerance, grade, status | Viewer clash report | Done for the corridor. Level and grid locations, and grouping, still to do in the viewer |
| 9.2–9.3 Grouping; report entry opens the viewer | Viewer | To do |
| 9.4 Source, calculated, suggested and missing kept apart | Package `provenance`, provisional flags, report | Done |
| 10.1 Template preserved | `schedule.export`, `validate` | Done, with a check |
| 10.2 Branding | `project.logo` swaps the template logo | Partly: the logo only, its aspect ratio not adjusted |
| 10.3–10.4 Populate from verified data; missing values use the template's word | `schedule.rows_for` | Done |
| 10.5 Editable .xlsx | `schedule.export` | Done |
| 11 Panels: saved views, issues, opening properties, schedule and export | Viewer | Issues and opening properties done; the rest to do |
| 12 Stages 1–9 | `run.py` | Done |
| 13 Deliverables in a runnable folder | `run.py` output | Done (serve over HTTP) |
