# Handoff: NCW corridor viewer

Written 26 Oct 2026 at the end of a session that ran from the wrong folder (`P-Code/n-code`). All the work below lives in this repo.

## Where things are

- **The viewer** is `public/experiments/ncw-corridor.html`: plain HTML and three.js 0.147 from jsDelivr, served by this Next.js site but not built by it. It carries no data. It loads a model package, `public/experiments/ncw-corridor/corridor.json` plus one geometry file per system in `geometry/`, or another package given as `?package=<url>`.
- **The package format** is in `docs/model-package.md`, agreed with Nick on 26 Oct 2026. The corridor package came from a one-off conversion of `NCW COORDINATED CORRIDOR.dwg` (LibreDWG, ezdxf, trimesh) done outside this repo, then split out of the old self-contained page on 26 Oct 2026.
- **Live:** https://taloengine.com/viewer, the TALO Viewer. The header pill links to it. It lists the projects in `lib/viewer-projects.ts` (Corridor, and the 19-storey Building in `public/experiments/ncw-building/`); each opens the viewer with `?package=`. `/experiments` redirects there. The viewer starts with tags and markers off, for speed. Each project is behind its own password (`VIEWER_PASSWORD_<ID>` in Vercel and `.env.local`); `proxy.ts` also refuses its model files without the unlock cookie (`lib/viewer-access.ts`).
- **Plan page** (private claude.ai artifact, front-end readiness against Natcha's requirements): https://claude.ai/artifact/62BMVMYYJhmS1bXMMmz4x8
- **Branches:** `develop-beta` (current), `develop` and `main` all point at `5a53dcd`.

## The skill

- **`.claude/skills/talo-engine/`** turns any Revit DWG plus the project's Excel schedule into a workspace: model package, viewer (`index.html`), clashes, wall and floor crossings, builders' work openings, a validation report and the schedule filled in its own template. Instructions in `SKILL.md`; the brief's requirements against what is done in `references/requirements.md`.
- **Project-only:** the skill lives in this repo's `.claude/skills/`, so Claude Code offers `/talo-engine` only in sessions opened in `natcha-site`. It is not installed globally.
- **Setup:** `.claude/skills/talo-engine/scripts/setup.sh` (LibreDWG via Homebrew, Python libraries in `.venv`, which is gitignored).
- **Run:** `.venv/bin/python scripts/run.py --dwg X.dwg --excel Y.xlsx --out DIR`, then `scripts/validate_package.py DIR/model.json`.
- **Tested on (26 Oct 2026):**
  - NCW corridor: 463 elements, 40 clashes, 84 crossings, 32 modelled and 15 proposed openings, 8 s.
  - `~/Downloads/3D OVERALL.dwg` (Newington Causeway, 104 MB) with `~/Downloads/GSI Schedule of Firestopping Requirements - Rev 1.xlsx`: 21,379 elements, 28 levels (B02 to L25), 19 grid lines, 933 clashes, 1,134 modelled holes, about 6.5 minutes and 4 GB of memory. That DWG is services only (no linked architectural or structural models), so crossings and proposed openings can't be checked on it.
- **Key facts about Revit DWGs** are in `references/revit-dwg.md`. Every entity carries REVIT xdata with its element id, type and category, and levels and grid are in the drawing. BWIC references and fire ratings are not.
- **Viewer copy:** the skill ships its own `viewer/viewer.html`. Copy `public/experiments/ncw-corridor.html` over it after editing the viewer.
- **Viewer work still to do for building scale:** saved views, opening review (approve, reject, comment), holes cut through walls, a level picker that loads chunks per level, and report grouping. See `references/requirements.md`.

## What the viewer does now

- **Clashes tab (opens first):** a corridor summary (38 clashes, 48 openings, zoning "Not set"), a Fix first list (D-10 clears 12 clashes, 7 major), the tolerance rule, an All/Major/Minor/Touch filter that also filters the 3D markers, and a written description per clash.
- **Clash report:** a printable page in a new tab. It has a plan with every clash marked, the Fix first list, a summary table, and a card per clash with an offscreen-rendered image, location, overlap against the 25 mm tolerance and both parts.
- **Builders' work holes:** 32 modelled hole families plus 16 proposed holes where a service crosses a wall with no hole. The openings are stored in the package; with no `openings` list the viewer works them out itself. Each is sized to the service and the wall thickness measured by raycasting, and all are numbered BWH-1 to BWH-48 along X. The Openings tab has a filter, grey-out isolation and an .xlsx schedule written by a hand-rolled SpreadsheetML zip with Schedule and Notes sheets. Clearance rule: 25 mm for pipes, 50 mm for ducts and tray. Fire-stopping is proposed from the service type, and wall ratings are not in the model.
- **Section box:** a header button shows the box with a drag arrow on each face. The six sliders in the left panel follow.
- **Dim:** an opacity slider for every layer. Walls start at 25%.
- **Service descriptions** come from the package, for example "ELV cable basket 200 × 60" or "Stainless steel pipe Ø114, insulated". Ducts have no system name in the data.
- **Systems:** every part belongs to Mechanical, Electrical, Plumbing, Architectural or Structural, shown in the Selection tab.
- **Tabs:** Clashes, Selection, Parts, Openings, Notes (the old Diagnostic narrative, hand-written for this corridor).
- **Debug hook:** `window.__viewer` exposes `st, E, OPEN, CL, fireFor, selectEl, selectClash, setBox, descOf, clashText, TRIAGE, handles, camera` and more, for testing.

## Next, agreed with Nick

1. Done: the viewer loads its model and results from the package, and the corridor's hard-coded text and tables now live in it (layers and colours, models, disciplines, part types, pipe systems, clash grades and tolerance, hole clearances and fire-stopping wording, part descriptions, title block, Notes narrative, report titles and the hole schedule columns). The page renders exactly as before: every tab, selection, clash, the Excel schedule and the clash report were compared against the old page with no differences.
2. Done: the package is agreed. Parts have stable string ids, openings are stored in the package, zones have their full record (values null until Natcha sends them), and geometry is split by system. Every tab, selection, clash, the Excel schedule and the clash report still match the old page, both when openings come from the package and when the viewer works them out.
3. Build the skill (DWG plus Excel in, package out) against `docs/model-package.md`. Its "Still open" list has what is left: Mechanical or Plumbing for copper and stainless pipe, and chunks by level.
4. Stay in HTML until the corridor is right. Move into Next.js with a database only when something must be saved (fire ratings, approvals, version history, site photos).

**Waiting on Natcha:** her Excel template for the hole schedule, a Navisworks clash report to beat, whether to keep three grades or two and where a 10 mm clash sits, zone heights and corridor dimensions, wall and door fire ratings, duct system names, the corridor DWG re-exported with ceilings, doors, slabs and structure, and the 19-storey block for building scale. For building scale the skill should write float32 positions: 16-bit at 0.25 mm caps a chunk at 16.4 m, and the viewer already reads float32.

## How to work here

- **Dev server:** `npx next dev -p 3111`. Test in Chrome via Playwright with `--enable-unsafe-swiftshader --use-angle=swiftshader` so WebGL works headless.
- **After editing the viewer**, syntax-check the inline script: extract the last `<script>` block and run `node --check` on it.
- **Deploy:** Vercel is not linked to GitHub, so a push does not deploy. Deploy from a clean worktree of `main` so local junk stays out: `git worktree add <tmp> main`, copy `.vercel` into it, run `vercel deploy --prod --yes` there, then remove the worktree.
- **Do not commit `decks/talo-base.json`.** It holds accidental test text ("htrytTalo Engine", "About Talo testertgtrgting 123") and Nick hasn't decided what to do with it.
- macOS sometimes revokes Documents access mid-session ("Operation not permitted"). Nick re-grants it in Privacy & Security.
- **Copy style:** tight wording with no filler, plain numbers (1, 2, 3, never 01), and commit messages ending with the Co-Authored-By line.
