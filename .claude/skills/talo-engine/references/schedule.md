# The schedule

The supplied workbook sets the format. The skill reads it, maps openings onto it and adds rows to it. It never replaces its structure.

## Reading it (`schedule.inspect`)

- **Header row:** the row in the first 60 with the most filled cells and headings such as Reference, Location, Service, Size, Rating.
- **Owners:** the labels one or two rows above the header ("MEP to complete", "GSI to complete"), each spanning to the next.
- **Data start:** the row after the header, or after a "Step" row when there is one.
- **Levels per sheet:** from the sheet name. `L03` covers L03, `LB1` covers B01, and `L04-15` covers L04 to L15.
- **Records:** every data row with a value. Their references show which BWIC numbers are taken.
- **Missing-data words:** `TBC`, `N/A` and similar, counted, so new rows use the template's own convention.

## Mapping

Each heading is matched to one field by pattern (`schedule.FIELDS`). For the GSI Builders Work Fire Stopping Schedule:

| Col | Heading | Field | Filled by the skill |
| --- | --- | --- | --- |
| A | Level / Location | level | Level name |
| B | M&E Reference / Location | ref | BWIC reference |
| C | Description / Reference | description | Proposed or modelled, plus review flags |
| F | Wall (or Floor) Thickness OA in mm | wallThickness | Measured, when the wall was found |
| H | Fire Rating required | fireRating | From the model, or TBC |
| M, N | Nominal Height, Width of BWIC | height, width | Opening size |
| O, P | Elevation from Level, Bottom of BWIC | elevation, bottom | Centre and underside above the level |
| R | Service Name | serviceName | Mechanical, Electrical or Public Health |
| S | Service Type | serviceType | Drainage, Ventilation, Cable Tray… from the pipe system or discipline, or TBC |
| T | Material | material | From the pipe system, or TBC |
| U | Outside Diameter / Maximum Size | serviceSize | `110 Ø` or `220 x 90` |
| V | BWIC Size (L x W) | bwicSize | `200 Ø` or `350 x 200` |
| W | Are any cables over 21mm? | cables21 | TBC for tray, N/A otherwise |
| X, Y | Insulation type, thickness | insulationType, insulationThickness | TBC and measured thickness when insulated, N/A when not |

Columns D, E, G, I to L and Q (architect, designer and main contractor decisions) and Z to AE (GSI and the fire engineer) are left empty.

## Writing (`schedule.export`)

- The workbook is a zip of XML parts. Only the level sheets that receive rows are rewritten, with lxml, so namespaces, styles, conditional formats, merges, print settings, the `TODAY()` date and the logo are untouched.
- Rows go into the pre-formatted blank rows below the last record, keeping each cell's style. Beyond those, new rows copy the last record's styling.
- One row per opening and service, as the template does (several services share a BWIC reference).
- Only proposed openings are added (`schedule.addModelled: false`). Modelled holes are usually in the schedule already, so they go to `Openings reconciliation.xlsx` instead.
- A modelled hole matches a record when exactly one record on its level sheet has the same BWIC size, and the same service type, material and service size wherever both sides know them. A match takes that record's reference. Several candidates are listed, never guessed.
- New references continue after the highest number already used on that level and orientation, so none collide.
- Existing cells are never overwritten.

## Checking (`schedule.validate`)

Same sheets in the same order, every existing value unchanged, same merges and conditional formats, same images and drawings.
