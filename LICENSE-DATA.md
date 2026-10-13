# Data, font and software licences

The game's code is under [LICENSE](LICENSE): © Miticept Studios, all rights reserved (D14, D20). Everything else the game ships, or bakes its city from, is listed here with its licence and the credit it needs (PLAN §11, "Licences and credits"). This is not legal advice; the OSMF Licensing Working Group is asked before a paid release if anything is unclear. Web facts carry their URL and the date they were checked; check before relying on them.

## The city files

Boston comes to the game as two files, both published under the Open Database License (ODbL) 1.0 as release assets of this repository, with the bake that makes them in `tools/bake/` and its pinned, hashed inputs in `cities/boston/sources.lock.json` (D14): the map file (`cities/index.json`'s `tiles`) and the sim file (its `sim`).

| Source | What the game takes from it | Licence | Credit |
|---|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright), through Geofabrik's Massachusetts extract | Streets, buildings, water, parks, land use and place names in the map file; the street graph, land use and depot land in the sim file | ODbL 1.0 | "© OpenStreetMap contributors" in the map's corner whenever the map shows, linked to [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright) |
| [Protomaps](https://protomaps.com/) basemap daily build | The map file is cut from it: OpenStreetMap's data in Protomaps' layers | The tiles are an ODbL Produced Work that must credit OpenStreetMap ([downloads](https://docs.protomaps.com/basemaps/downloads)); the basemap's code, which draws them (`@protomaps/basemaps`), is BSD-3-Clause and its map design CC0 ([protomaps/basemaps](https://github.com/protomaps/basemaps)); both found by web search, 2026-10-13 | "Protomaps" in the map's corner; Protomaps asks for it rather than requiring it |
| [Overture Maps](https://overturemaps.org/), buildings theme, release 2026-09-23.1 | The height of each building OpenStreetMap gives none, joined onto the map file; the extract is mirrored as release `city-boston-overture-2026-09-23.1` | ODbL ([release notes](https://overturemaps.org/overture-january-2024-release-notes/), [FAQ](https://overturemaps.org/about/faq/), found by web search, 2026-10-13) | "Overture Maps" in the map's corner, its title reading "© OpenStreetMap contributors, Microsoft, Esri Community Maps contributors, Google Open Buildings"; some heights come from USGS 3DEP lidar |
| U.S. Census Bureau, 2020 TIGER/Line blocks and county subdivisions | Where each block lies and its 2020 population, so homes and commutes land on the map, and which town it is in, so the play area holds whole towns (gate G4) | Not copyrighted; the Census Bureau asks to be credited as the source, and "TIGER/Line" is its registered trademark (its metadata, read in secondary records such as [this one](https://gis.transportation.wv.gov/arcgis/rest/services/Boundaries/FeatureServer/19/metadata), found by web search, 2026-10-13; census.gov's own terms were not read) | "U.S. Census Bureau, 2020 TIGER/Line Shapefiles" |
| U.S. Census Bureau, LEHD Origin-Destination Employment Statistics (LODES 8.4), 2023 | Homes and jobs in each block, and the commutes between them | Public-use data ([LODES technical document](https://lehd.ces.census.gov/doc/help/onthemap/LODESTechDoc.pdf); described as public-use in [this catalogue](https://datacatalog.med.nyu.edu/dataset/10148); found by web search, 2026-10-13) | "U.S. Census Bureau, LEHD Origin-Destination Employment Statistics (LODES 8.4, 2023)" |
| MBTA | Bake-time calibration only | — | Never ships (D17): the city has no transit of its own, and no MBTA data reaches a player |

## The font

[Afacad Flux](https://github.com/google/fonts/tree/main/ofl/afacadflux), © 2023 The Afacad Project Authors, designed by Kristian Möller (Dicotype), under the SIL Open Font License 1.1 (checked 2026-10-12, DECISIONS D13). The game self-hosts static 400 and 600 instances built by `scripts/fonts/`, and the licence text ships beside them as `public/fonts/OFL.txt`.

## Software

[`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt) lists every package the game is built with, its version, its licence and the licence text it ships: 33 packages under MIT, ISC, BSD-2-Clause, BSD-3-Clause and MIT-or-Apache-2.0. `node scripts/notices.mjs write` makes it from `package-lock.json`, CI fails when it is out of date, and the preview serves it beside the game.

## The art

The studio's own art, once it lands, is under the licence `art/LICENSE.md` names when D20's choice is made; until then it stays all rights reserved (D20).

## Before a Steam build

- Three packages ship no licence text, so the notices name only their declared licences: `pmtiles` and `@protomaps/basemaps` (BSD-3-Clause, which asks for the copyright line to be reproduced) and `murmurhash-js` (MIT). Their upstream licence files join the notices before a build leaves the preview.
- The credits screen (PLAN §10, week 14) shows everything above in the game itself, and the store page credits OpenStreetMap.
- The OSMF Licensing Working Group is asked about the city files' share-alike before a paid release (PLAN §11).
