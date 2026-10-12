# interbus: the plan

*Written Monday 2026-10-12 for Miticept Studios and revised the same day after your decisions (§13, [docs/DECISIONS.md](docs/DECISIONS.md)): real cities first with Boston as the test city; a flat 2D map that tilts into 3D, far more detailed than before; GitHub Pages now and Steam later; the co-developer as the 3D artist; versions only on your say. "You" means the studio owner; "the artist" means the co-developer. **Call:** marks a settled question and its reason.*

**Citations.** Lesson IDs ([GD-01](docs/history/lessons-ledger.md) …) link to the [lessons ledger](docs/history/lessons-ledger.md); bug and salvage IDs ([K01](docs/history/salvage-matrix.md), [S01](docs/history/salvage-matrix.md), [R01](docs/history/salvage-matrix.md) …) to the [salvage matrix](docs/history/salvage-matrix.md). Prior code is `repo@ref:path`: V1 `Intralines@7af45b1`, V2 `Intralines_City_dep@archive/intralines-city-v1` (game under `Gaming/`), V3 `Intralines_City@dc63602`. Web facts carry their URL and were checked 2026-10-12, some only through search excerpts; fees and policies change, so check before relying on them. "Measured" means measured on 2026-10-12; "estimate" means not.

---

## 0. One-page summary

**What we build.** A calm bus-company game on real Boston. Streets and buildings come from real data, the city starts with no buses, trains or ferries of any kind (D17), and people live and work where the 2020 census and real commute records put them. You draw lines, set how often buses run and what each line charges, and watch riders and money flow. The map reads flat and crisp in 2D and tilts into 3D on the same camera, where the artist's buses glide between real buildings. The city offers contracts and grades you every quarter. It is V1's loop on V3's engineering with V2's measured economy fixes, cut to what a two-person part-time studio can finish.

**For whom.** You first: if you do not want to keep playing it, it has failed. Then people who like Mini Metro's calm but want a company with real money in a real city, in 20–60 minute sessions: in a browser now, on Steam later.

**By when.** First fare dollar, on a Back Bay–Longwood clip of Boston, **Sun Nov 1**. Prototype tagged **Sun Dec 20**. Soft launch on an unlisted Pages URL **Fri Jan 22**. **You ship v1.0.0 on GitHub Pages, target Sun Feb 7 2027**; hard deadline Sun Feb 28. Steam is a proposal for afterwards: code from Mon Mar 1 (or two weeks after v1.0 ships, if later), release Tue Jul 13 2027 (§11).

**The calls that shape everything**
1. **Money before presentation.** Income in week 3, costs in week 4, the full money loop by Nov 22, on a committed mini-Boston fixture that never waits for the bake or for 3D. Until M3, at most one session in three is look, 3D or art work ([GD-01](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)).
2. **Boston first, baked offline from pinned static files** (D1) behind ten numeric gates, the last proving no transit survives (D17); browsers never fetch source data ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md)).
3. **One renderer, two views** (D2): MapLibre draws one detailed map, flat or tilted; three.js only draws the artist's buses inside it, lazily: proven behind a flag in week 5, shipped in January ([RN-03](docs/history/lessons-ledger.md)).
4. **Pages now, Steam as packaging later** (D3): a platform module, async saves and an updates adapter from week 1 ([DP-09](docs/history/lessons-ledger.md)).
5. **Art built around real files** (D6): the first box-level bus is due Sun Oct 25, and its CI check follows in week 5 ([RN-07](docs/history/lessons-ledger.md)).
6. **Fewer controls, fewer exploits.** One service day, no per-bus wear, undo only while paused, express behind a test ([GD-06](docs/history/lessons-ledger.md), [K22](docs/history/salvage-matrix.md)).
7. **No new system after Sun Dec 6.** January is models, content and look ([SC-08](docs/history/lessons-ledger.md)).
8. **Versions only on your say:** only `/ship <version>`, typed by you, creates one. CI fails any version not added by its own `Release v<version>` commit; it cannot tell who made that commit, so your yes inside `/ship` is the guard ([PR-15](docs/history/lessons-ledger.md)).
9. **Triggers cut scope first; only the M5 and RC triggers move the target, and never past Feb 28.** The decisions add about three Claude-weeks net, nearly all in weeks 1–7, paid by more sessions a week and checked from Oct 18 (§9, §10).

**How.** One Claude session owns `main`; no agent crew; ≤150-line specs; PR checks within 8 minutes ([PR-04](docs/history/lessons-ledger.md), [PR-08](docs/history/lessons-ledger.md)).

**This week:** give Claude read access to the three earlier repos; protect `main` (§14 item 2); answer D6, D9 and D11 (Boston's play area) by Sun Oct 18; the artist reviews [docs/art/MODELS.md](docs/art/MODELS.md) §3, §3.1, §5, §6 and §10 (about a page); run the V1 baseline (§14).

---

## 1. Vision and pitch

**Pitch.** *Run the buses of Boston. Its real streets, buildings, river and harbour are drawn quiet and fine, no bus, train or ferry runs until you start one, and the only colour is your network. Find where people live and work, draw lines down streets you know, and decide how often buses run and what each line charges. Read it flat like a transit map, or tilt it to watch your buses glide past Back Bay. Every rule is drawn on the map, and the money comes in until the city hands you its next contract or the bank stops calling back.*

**For whom.** Transit fans, Mini Metro players who want money and real streets, and people who know Boston.

**How it differs** (check before store copy). Unlike Mini Metro it has money, a grade, contracts and a real city; unlike City Bus Manager it has no chores ([GD-03](docs/history/lessons-ledger.md), [GD-09](docs/history/lessons-ledger.md)). Subway Builder ([Steam](https://store.steampowered.com/app/4039140/Subway_Builder/)) is the plan's reference for "sleek but detailed" until your own screens arrive (§14 item 14); interbus is buses on streets, in shorter sessions, and plays offline.

**Against V1–V3.** V1's only goal was "profit go up" ([SC-03](docs/history/lessons-ledger.md)), V2 covered 41.2% of the map with chrome ([UX-01](docs/history/lessons-ledger.md)), V3 never earned a dollar ([K40](docs/history/salvage-matrix.md)); this plan answers all three.

**Working title.** **Intralines**; **interbus** stays the repo, package and storage-key name. Check both names before any store page (D5).

---

## 2. Pillars and non-goals

1. **A calm, detailed map where every rule is drawn.** An intricate real city in quiet tones with only the player's network in colour; ≤6% chrome at rest, ≤8 words beside any control ([UX-01](docs/history/lessons-ledger.md), [UX-02](docs/history/lessons-ledger.md)). One function drives each rule's check, money and drawing ([GD-05](docs/history/lessons-ledger.md)).
2. **Network shape is the game; the economy is honest.** No control is best at its extreme; more service never loses riders ([GD-02](docs/history/lessons-ledger.md), [GD-13](docs/history/lessons-ledger.md), [EC-02](docs/history/lessons-ledger.md)).
3. **It just works.** Saves never corrupt, updates never break a game, the map works offline (*"bugs out every time it updates"*, `Intralines@7af45b1:scripts/retain-assets.mjs:5`; [DP-01](docs/history/lessons-ledger.md)).

A mechanic that needs a second mechanic to explain it is cut ([GD-06](docs/history/lessons-ledger.md)). **3D is a view, not a mechanic:** no rule, number or save field depends on the camera.

**In, by your decisions:** Boston from real data; a detailed vector map; 2D that tilts into 3D; the artist's three bus families; platform seams for Steam; owner-only versions. **Paid for by cuts taken now:** procedural cities as the default (river and grid cities, the generator, "buildings from cells"), January's third city, the separate Boston spike, itch.io, the symbol-layer bus and map extras (cut 1); the rest by more sessions a week (§10 has the arithmetic).

| Out for v1.0 | Why | Status |
|---|---|---|
| Procedural cities (except test fixtures); a second city | D1; one city done well | Second real city after v1.0 |
| itch.io | D3; its iframe save test has no purpose now | Dropped |
| Live APIs, browser data fetches, third-party tiles | [WD-01](docs/history/lessons-ledger.md) | Never |
| Terrain, sky, a second renderer, a Canvas fallback | [RN-02](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md) | Never |
| Company type, lobbying; staff, mechanics, Environment; fuel; schedule assistant | [GD-03](docs/history/lessons-ledger.md), [GD-09](docs/history/lessons-ledger.md), [GD-12](docs/history/lessons-ledger.md) | Never |
| Mk tiers, per-bus wear; per-line hours; undo across time | No lever ([K02](docs/history/salvage-matrix.md)); exploits ([EC-03](docs/history/lessons-ledger.md), [K22](docs/history/salvage-matrix.md)) | Later |
| Local lanes, night palettes, a second map palette | [K36](docs/history/salvage-matrix.md), [RN-14](docs/history/lessons-ledger.md) | One palette ships (D13) |
| Pedestrians, diorama, landmark models | [SC-05](docs/history/lessons-ledger.md) | Landmarks 1.1+ |
| Desktop build, Steamworks, achievements, signing | Steam workstream, Mar 2027 ([DP-09](docs/history/lessons-ledger.md)) | Steam release |
| Accessibility browser gate; V1 save import | [UX-08](docs/history/lessons-ledger.md), [DP-08](docs/history/lessons-ledger.md) | Never |
| Audio; phones; regional rail, >3 overlays | [SC-08](docs/history/lessons-ledger.md) | Later |

**Call: one city service day (05:00–24:00), no per-line hours;** a midnight-only V2 line paid +149% ([EC-03](docs/history/lessons-ledger.md)). **Call: no per-bus wear;** it has no lever ([GD-03](docs/history/lessons-ledger.md)). **Call: express lines are in behind I3** ([EC-05](docs/history/lessons-ledger.md), [X-20](docs/history/lessons-ledger.md)), second on the cut list; not green by Dec 6 means 1.1.

---

## 3. Core loop

**Second to second.** Buses glide, riders gather, cash ticks; the game starts paused ([UX-10](docs/history/lessons-ledger.md)).

**Minute to minute: six verbs**, each paying off within a game day ([GD-02](docs/history/lessons-ledger.md)): **draw or extend a line**; **share a stop** (within 250 m it joins, [EC-10](docs/history/lessons-ledger.md)); **set a headway** per period, and the game shows "needs 3 buses, you have 2" with the price ([GD-09](docs/history/lessons-ledger.md)); **set a fare** inside a printed band ([EC-09](docs/history/lessons-ledger.md)); **prune or upgrade a stop** flagged QUIET or LOSS ([UX-13](docs/history/lessons-ledger.md)); **place a depot** on the green tint, knowing dead-heading costs ([EC-13](docs/history/lessons-ledger.md), [UX-06](docs/history/lessons-ledger.md)).

**Session.** A quarter (10 game days) ends with a report card and a **Next quarter** preview ([UX-03](docs/history/lessons-ledger.md)).

**The first ten minutes in Boston** (playtest targets; V1 prices, [X-09](docs/history/lessons-ledger.md); head counts illustrative until the bake)

| Time | What happens |
|---|---|
| 0:00 | Name, colour. The board opens paused and flat over Back Bay at zoom 14, every arterial named (local names from z14.5); chip "1/5 Place a depot" ([UX-07](docs/history/lessons-ledger.md)) |
| 1:00 | Legal land tints green, mostly industrial strips; card "Industrial ✓ · street 40 m ✓ · $150k" |
| 2:00 | "2/5 Draw a line" along Massachusetts Avenue: a 650 m walk ring, "≈9,000 people within a walk" |
| 3:00 | Four stops to the Longwood Medical Area. "Every 20 min needs 1 Sparrow · $95k"; about $49k of $310k left |
| 3:30 | "3/5 Press play". The bus pulls out; riders board at the 06:30 peak |
| 4:30 | The 2D/3D chip (or `T`) tilts the map: Back Bay rises around the bus; again to flatten. Nothing in the game changes |
| 5:30 | First daily close, every figure a ledger row ([AR-12](docs/history/lessons-ledger.md)); "QUIET · 3 boardings" |
| 7:00 | "4/5 Make a profitable day": prune the stop or nudge the fare |
| 8:00 | "5/5 Take a contract": "Every 15 min at Longwood, 10 days, $120k" |

No tutorial text: a first line fits the starting cash and the best four-bus line does not ([GD-11](docs/history/lessons-ledger.md)). Inner Boston is roughly 7–10× as dense as V1's Riverton (estimate), where V1's starter economics were measured ([X-08](docs/history/lessons-ledger.md)), so prices stay V1's and demand is scaled by `calib.tripScale`, set on the fixture's first-line band in week 3 and re-measured on `city-boston-r1` in week 5.

**Goals.**
- **Contracts, three slots:** HEADWAY near a landmark such as Longwood or Kendall, and RIDERSHIP (150, 400 or 800 boardings a day), held 10 days within 20 ([GD-04](docs/history/lessons-ledger.md)).
- **Events**, one at a time, hatched a day ahead: roadworks, festival, snow.
- **Report card:** Coverage by service ([EC-07](docs/history/lessons-ledger.md)), Reliability against the line's timetable ([K03](docs/history/salvage-matrix.md)), Comfort, Money ([EC-14](docs/history/lessons-ledger.md)).
- **Medals**, three for Boston; silver unlocks the Goliath. "Bronze unlocks the next city" returns with a second city.

**Call: one failure floor with a way back.** Cash may go negative to a credit limit with one lender (V1's Talon & Grasp); five days below it ends the run, with a countdown chip and **Restart this quarter** from an automatic save. Sandbox turns failure off ([GD-06](docs/history/lessons-ledger.md)).

**Call: undo only while paused**, restoring cash exactly; refused with a reason once time has passed ([K22](docs/history/salvage-matrix.md), [UX-09](docs/history/lessons-ledger.md), [X-11](docs/history/lessons-ledger.md)).

**Pacing targets** ([GD-10](docs/history/lessons-ledger.md)), scripted in week 9: first line in 3–5 minutes; profit by 8; second line after 15–25; report card by 20; Boston's top medal in 2–4 hours. Starting cash V1's $310k ([X-09](docs/history/lessons-ledger.md)), re-checked on `city-boston-r1` in week 5.

---

## 4. Scope by release

### Prototype: tagged Sun Dec 20 2026

Boston end to end, balanced, saved and onboarded, flat and tilted. **No new system after Sun Dec 6** (a system changes the sim's rules or money; UI, copy, art and tunables can still land).
- **Foundation:** CI, Pages, offline app with update prompt; platform module; fixed-step worker sim; `{ok, reason}` commands; cent ledger; async saves with a schema hash ([AR-07](docs/history/lessons-ledger.md), [AR-13](docs/history/lessons-ledger.md), [K01](docs/history/salvage-matrix.md)).
- **World:** Inner Boston baked offline, about 800 cells at 350 m; the mini-Boston fixture; the detailed map; hourly congestion by road class in the sim ([EC-15](docs/history/lessons-ledger.md), [R10](docs/history/salvage-matrix.md), [AR-04](docs/history/lessons-ledger.md)).
- **Economy:** uncapped demand; **income from week 3**; per-km, wage, upkeep and deadhead costs; headway → buses → purchase; fare bands; stop tiers and flags; transfers ([K04](docs/history/salvage-matrix.md), [K05](docs/history/salvage-matrix.md), [EC-10](docs/history/lessons-ledger.md)).
- **Goals and failure:** report card; HEADWAY and RIDERSHIP contracts; events; medals; credit line, floor, restart.
- **Player tools:** calm shell; line tool with remove, extend, insert; depot tint; undo; slots, autosave, export; the 2D/3D control; express behind I3.
- **Onboarding:** Home, founding, checklist (week 6), pacing ladder ([UX-07](docs/history/lessons-ledger.md)).
- **Tests:** invariants, sweep, balance bands, bake gates, bench, e2e smoke ([EC-12](docs/history/lessons-ledger.md), [TS-06](docs/history/lessons-ledger.md)).

**Call: every bus type, event kind and route edit lands before the cutoff** ([SC-08](docs/history/lessons-ledger.md)): Sparrow (28 seats, $95k), Metro 40 (70, $260k), Goliath (115, $440k) are config rows ([C01](docs/history/salvage-matrix.md)), all in the sim in week 5, so no cut can strand finished art. Their art follows the artist's dates; art is not a system.

### v1.0 on GitHub Pages: Jan 4 to Feb 7 2027

Models, content, look and release only: the artist's three families as 3D models at close zoom (lazy three.js, proven in week 5; cut 3); splash, bus wipe, day/night tint, dusk lights, report-card stamp ([S18](docs/history/salvage-matrix.md)); help, settings, accessibility; credits and the landing page; close-zoom lane markings (§8 rule 9), render-only and the first January item cut. You ship it with `/ship 1.0.0`.

### Steam release: proposal, from Mar 1 2027

V1's Electron shell ([S19](docs/history/salvage-matrix.md)), a Windows build with Steam Cloud and achievements, the artist's capsule art; release Tue Jul 13 2027 (§11). What Steam adds over the free web build is D4, decided with D15 on Jan 31.

### Post-launch backlog (ordered)

A second real city; all of Boston with variable 350/700 m cells; the artist's landmarks; per-line hours ([EC-03](docs/history/lessons-ledger.md)); undo across time; player-built bus lanes, painted red on the lane markings (the only red lanes in the city, since none exist at the start, D17); real commute flows instead of gravity; a keyboard map cursor ([UX-11](docs/history/lessons-ledger.md)). Steam takes March, then alternates with the second city.

---

## 5. World: Boston first

**Decided (D1): real cities first; Boston is the first and test city.** Procedural generation survives only as test fixtures. The design answers V1's pipeline failures ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md), [WD-04](docs/history/lessons-ledger.md), [WD-11](docs/history/lessons-ledger.md)).

**Call: bake "Inner Boston" first**: the land of Boston, Cambridge, Somerville and Brookline inside lon −71.16…−70.98, lat 42.315…42.405. Measured on Overture Maps release 2026-09-23.1 (OSM-derived; land areas match the census within 1%):

| Extent | Land | Buildings | Cells at 350 m | Street nodes, collapsed |
|---|---|---|---|---|
| **Inner Boston** | 94 km² | 80,145 | 790–840 | 9,330–9,953 |
| R2, a larger box | 105 km² | 89,182 | 890–935 | 10,813 |
| Boston city limits | 124.5 km² | 105,603 | 1,030–1,110 | 11,390 |
| V3's 20 × 16 km box | 229 km² | 205,096 | 1,910–2,000 | 21,144 |

Inner Boston keeps the river and harbour crossings, Longwood, Kendall, Logan and downtown, with 20% headroom under the 1,000-cell cap and 42% under the 16,000-node cap ([WD-09](docs/history/lessons-ledger.md), [AR-15](docs/history/lessons-ledger.md)); it leaves out south Dorchester, Mattapan, Hyde Park, Chelsea and Everett. Boston's city limits break the cell cap and leave Cambridge a grey void. R2 needs recompute ≤100 ms p95 in week 3 (D11). **The extent flexes; Boston stays:** if the full pack is not green by Sun Nov 8, a core box that passes G1–G10 ships instead (§10). Beyond the extent polygon the board fades to grey, as in V1.

**Sources: static files only, no API, no key**, so V1's quota pages, rate limits and missing CORS cannot recur.

| Layer | Pinned source | Use |
|---|---|---|
| Residents | 2020 block counts (`POP20`) in TIGER/Line `tabblock20` ([files](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.2020.html)) | Residents and dot sub-points |
| Workers, jobs, commutes | LODES 8.4, year 2023, on the same 2020 blocks ([LODES8](https://lehd.ces.census.gov/data/lodes/LODES8/)) | Jobs by sector, inbound commuters, the gravity β fit |
| Streets, depot land, lane tags | One dated Geofabrik Massachusetts `.osm.pbf`, ~292–296 MB ([page](https://download.geofabrik.de/north-america/us/massachusetts.html)), via osmium | The sim graph, and from week 3 the tiles |
| Map | Week 1 a cut of a pinned Protomaps build; from week 3 Planetiler on the same extract ([docs](https://docs.protomaps.com/basemaps/build)) | The 2D/3D map |
| Heights | OSM height, else levels × 3.2 m + 1 m, else a type default. Overture's lidar heights (93–95% coverage, measured) are joined in the r1 bake if fewer than about half of Inner Boston's buildings carry `height` or `building:levels` (counted in week 2, recorded in DECISIONS; likely, since every Overture height in Boston came from outside OSM) | Extrusions |
| MBTA GTFS, ridership | Bake-time calibration report only, comparing modelled demand with real ridership; never drawn, simulated or shipped (D17; revocable licence) | Sanity check |

**Call: 350 m square cells, about 800, built from 2020 blocks.** Blocks are a count, not a sample, and LODES joins on the same ids. Each cell holds residents, workers, jobs by sector, inbound commuters and up to 8 weighted sub-points, so dots sit where people live and catchments sum sub-points, not a centroid ([EC-15](docs/history/lessons-ledger.md), [WD-06](docs/history/lessons-ledger.md)). Logan and the main road entries are gateways. With no transit in the city (D17), today's T riders are not a special case: the bus–car–walk choice runs from scratch, and r1 checks the no-car (captive) share against ACS vehicles-available. V1's gravity and visitor matrices stay ([R01](docs/history/salvage-matrix.md)); M1 uses V1's β, and r1 fits β to LODES flows; at ~800 cells recompute interpolates to 50–130 ms ([AR-07](docs/history/lessons-ledger.md)). Buildings are real, so the bake checks that map and demand agree.

**The bake** (`tools/bake/`, a port of V1's pipeline).
- **Fetch**, the only step that touches the source servers, hashes inputs into `sources.lock.json` and mirrors them to a GitHub Release. If the servers refuse GitHub's runners, you run `npm run bake:fetch` once (about 30 minutes).
- **The full bake** is a manually dispatched Actions job reading only the mirror, on two runners whose hashes must match. It publishes `sim.json`, the `.pmtiles` map and a report as release `city-boston-r<N>`.
- **PR CI** bakes only the committed mini-Boston fixture in under 30 s: every input clipped to lon −71.11…−71.07, lat 42.335…42.36 (3.3 × 2.8 km, Back Bay to Longwood, with Kenmore and Storrow Drive). Economy and e2e tests run on it and **M1 runs on it by default**; the full Inner Boston pack is due with the format freeze, Sun Nov 8.
- **The deploy** downloads the files named in `cities/index.json`, checks SHA-256 and **fails** if one is missing; it never bakes. Bake and game read that one list ([K18](docs/history/salvage-matrix.md)).

**Pack: two files per city.** `sim.json` (JSON format 1; degree-2 collapse mandatory; service roads stay out of the routable graph) holds streets, cells, gateways, depot land and `calib`, budget ≤1 MB gzip; the Inner Boston street graph measured 208 kB gzip. The `.pmtiles` map has a hard gate of ≤40 MB, target ≤15 MB, largest tile ≤200 kB; buildings, streets, paths, rail and water measured 4.0 MB gzip at z12–14 with a test encoder (rail included; the shipped tiles drop it, D17), while a z15 Protomaps cut is larger and unmeasured. Both use content-hashed URLs and no IndexedDB pack cache ([WD-04](docs/history/lessons-ledger.md)). **Format 1 freezes Sun Nov 8.** Saves record city, revision and hash and anchor stops by place ([WD-10](docs/history/lessons-ledger.md)); a missing pack is a readable refusal, never a substitute city; both land in week 5, with an r1→r2 rebake save test. A rebake reaches the unlisted site when its `cities/index.json` change merges (after the Jan 22 soft launch, only with your OK); the city revision freezes on Jan 17; after launch only a version you ship carries one.

**Bus access.** The routable graph honours `access`, `bus`/`psv`, `hgv=no` and `maxheight` under 3.5 m, so parkways closed to buses, such as Storrow and Memorial Drives, drop out; a name list in `adjust.json` covers any OSM leaves untagged. The bake report lists every excluded named road, and a fixture test keeps lines off Storrow Drive.

**No existing transit (D17).** The game starts from zero, so the bake strips every public-transport feature from both the sim graph and the tiles:
- **Bus lanes become general lanes.** `busway=*`, `lanes:bus`/`lanes:psv` and `bus:lanes`/`psv:lanes` are rewritten so the lane counts as ordinary traffic (a street with `lanes=3` and one bus lane bakes as 3 general lanes), which also returns that capacity to the congestion model. Surface streets that are bus- or PSV-only (`access=no` + `bus`/`psv=yes|designated`) open to all traffic; `highway=busway` and dedicated transitways or bus tunnels that are not ordinary streets are dropped.
- **No stops, stations or routes:** `highway=bus_stop`, `public_transport=*`, `amenity=bus_station`, transit shelters and every `route=bus|trolleybus|subway|light_rail|tram|train|ferry` relation go. Bus garages stay as plain buildings with no transit label.
- **No rail or ferries:** every `railway=*` line, platform and station (subway, light rail, tram, commuter rail, Amtrak and freight spurs alike) and ferry routes and terminals are removed. Former corridors draw as plain ground in their land-use tint, not as gaps. Logan Airport stays: it is a destination, not part of a transit system.
- **Kept for drawing:** `lanes`, `lanes:forward`/`lanes:backward`, `oneway`, `turn:lanes`, marked crossings and `highway=traffic_signals`, after the rewrite above, for §8 rule 9.
- **Checked:** gate **G10** fails the bake if any transit feature survives in either file; the report lists every rewrite and removal by name; a fixture test asserts a Back Bay street mapped with a bus lane bakes as general lanes. Bringing transit back later (for example the T as a feature) is new work behind its own decision, not a bake flag.

**Bake gates** (the bake refuses to write and names the number): G1 400–1,000 cells; G2 ≤16,000 nodes, one component with ≥98% of drivable km; G3 ≥99% of residents within 300 m of a street; G4 Σ `POP20` over Boston = 675,647 exactly, catching V1's 12-digit join bug; G5 geography sanity (no residents in water, Logan holds the airport gateway); G6 map and demand agree; G7 sizes; G8 two-runner determinism; G9 load ≤300 ms; G10 no transit feature in either file (D17).

**If a dataset fails:** servers refuse CI → your one local fetch; a source rolls over → the lock mismatches and re-pinning is a deliberate PR; the Protomaps build disappears → Planetiler, or at worst V1's offline style drawn from the sim pack (`Intralines@7af45b1:src/map/basemapStyle.ts:375-547`); few height tags → the r1 height join; over a cap or 150 ms → stay at Inner Boston; full pack not green by Nov 8 → the core box (§10); tiles over budget → a slim Planetiler profile; demand wrong where players know the city → per-cell overrides in `adjust.json`, listed in the report.

**Balance.** Inner Boston holds roughly 0.6–0.7 million residents (estimate), about five times Riverton's 128,010. **Boston is the reference city for every balance band.**

**City invariants (I10):** the same inputs give the same bytes; one connected network; ≥90% of built-up street nodes within 650 m of a populated cell; a stop with residents within 300 m draws riders within a game day ([K24](docs/history/salvage-matrix.md)); a first line fits the starting cash and the best four-bus line does not ([GD-11](docs/history/lessons-ledger.md)).

**A second city** takes one or two Claude-weeks; non-US cities lack LODES.

---

## 6. Architecture and tech stack

**Call: one renderer, MapLibre GL JS pinned exactly at 6.11.2**, the newest release at least two weeks old (WebGL2 required; [CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)). One camera draws flat 2D and tilted 3D. V3's three.js scene ([R13](docs/history/salvage-matrix.md)) has no tile pipeline and cost a 2.93× critical path ([RN-03](docs/history/lessons-ledger.md)), so the old Oct 25 renderer fallback is dropped. **No renderer change after Sun Nov 1, including the custom-layer interface (every bus, icon or mesh, draws in one MapLibre custom layer); never two renderers.** three.js 0.186.1 draws only the artist's models in that layer, lazily, and the game runs without it. A week-5 proof behind a flag draws the `metro-40` blockout as one instanced mesh and measures chunk size and frame rate, so January only swaps assets.

**Stack.** Strict TypeScript, Vite, React 18 for chrome only, MapLibre in a lazy chunk (about 430 KiB gzip with its worker, measured), `pmtiles` 4.5.0, a style built from `@protomaps/basemaps` 5.7.2, Vitest, pinned Playwright ([K53](docs/history/salvage-matrix.md)), `vite-plugin-pwa` 1.3.0, GitHub Actions. Pins are the newest releases at least two weeks old ([npm registry](https://registry.npmjs.org/), publish dates checked 2026-10-12): maplibre-gl 6.11.2 (2026-09-24), pmtiles 4.5.0 (2026-08-10), @protomaps/basemaps 5.7.2 (2026-03-10), vite-plugin-pwa 1.3.0 (2026-05-05; 2.0.0 of 2026-10-03 is too new), three 0.186.1 (2026-09-24).

**The map.**
- **City files offline.** A small `CityTileSource` reads tiles by HTTP Range on the first visit while saving the whole file to its own cache, then reads the stored copy; old hashes are evicted on boot. If Pages refuses Range (checked in week 1), the first visit downloads the file with a progress bar.
- **2D and 3D.** In 2D buildings are flat footprints with a hairline outline; in 3D, extrusions, cross-faded once per mode change, never per frame ([RN-04](docs/history/lessons-ledger.md)). From week 2 `T` sets pitch 50° with extrusions (a raw tilt); the chip, the eased cross-fade, right-drag and the snap flat below 12° land in week 10. 3D allows 25–60° at zoom ≥14. Bounds are the extent plus 1.5 km behind V1's board mask (`Intralines@7af45b1:src/map/overlays.ts:55-114`). The mode is never saved.
- **Buses.** One custom vehicle layer from week 4, the code-drawn glyph first: top-down icons as instanced quads in one draw call, kept flat to the screen when tilted, at least 20 px long (Sparrow), 24 (Metro 40) and 32 (Goliath) ([RN-05](docs/history/lessons-ledger.md)). **Meshes replace icons only in 3D at zoom ≥17**, where a pixel is 0.44 m at Boston's latitude (512 px tiles) and a Sparrow 19 px at true scale; at zoom 15 it would be 5 px, V3's failure again. A mesh is drawn at the larger of true scale and its icon length, at most 2.5×, one draw call per family (V1 scaled buses 1.15–29×, `Intralines@7af45b1:src/map/busLayer3d.ts:591`). Positions come from V3's pure `busPositionAt` ([S03](docs/history/salvage-matrix.md)); a per-frame GeoJSON source lags the clock, so there is no symbol-layer stage.
- **No GPU.** Since Chrome 139, machines without a usable GPU get no WebGL at all ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM/m/oLrB5up_BwAJ)). The ladder: hardware; then **Low graphics** (2D only, no extrusions, 30 fps); then a calm "turn on hardware acceleration" card, saves and Export intact.

**Platform seams for Steam** (D3). Only `src/platform/` may touch browser storage, caches, the service worker, fullscreen, external links or `version.json`; a lint rule enforces it, and a build alias picks `web/` now, `desktop/` from March 2027. It holds an **async `SaveStore`** whose export file equals a desktop save, so Export then Import carries a company into Steam; an **updates adapter** (V3's prompt flow on the web, inert on desktop, where Steam updates); the city file source; allowlisted links; quit hooks (never bind Shift+Tab); and build info. Relative URLs throughout. Cost: about a day.

**Module layout**
```
src/sim/       pure TS in the worker; no DOM, React, MapLibre, Date or Math.random
  config/ core/ rules/ commands/ city/ demand/ traffic/ fleet/ economy/ goals/ events/ save/
  step.ts      simStep(), the only door that advances time (AR-09)
src/worker/    fixed-step host, snapshots, command log
src/render/    style/ tiles/ camera/ vehicles/ overlays/; reads snapshots only
src/platform/  types.ts, web/, memory/; the only door to host APIs
src/ui/        React shell, cursor cards, menus; reason codes -> copy
cities/        index.json; boston/ (city.json, extent, sources.lock.json, adjust.json)
tools/bake/    fetch, osm, census, tiles, pack, check; fixtures/
tools/models/  check.mjs, icon.mjs (written when the first model lands)
art/           the artist's deliveries in Git LFS; LICENSE.md, CREDITS.md
```

**Boundaries.** The worker owns state; commands apply at the next fixed step, so replays are exact. Cursor cards call the `rules/` function the worker re-checks ([K10](docs/history/salvage-matrix.md)). The renderer computes no game number ([AR-04](docs/history/lessons-ledger.md)); React never re-renders per frame ([AR-08](docs/history/lessons-ledger.md)). Lint: `ui/` and `render/` import only `sim/rules` and types; no `Date` or `Math.random` in `src/sim`; host APIs only in `src/platform/`. **Export session** writes the quarter-start save plus every command since, and the deterministic sim replays it ([AR-06](docs/history/lessons-ledger.md)).

**Save format.** V3's envelope with migrations ([K11](docs/history/salvage-matrix.md)), intent only ([DP-05](docs/history/lessons-ledger.md)): city, revision and hash; `nextIds` for every kind ([K01](docs/history/salvage-matrix.md)); clock and RNG; stops by place; lines, depots, cash in cents, contracts, medals. No demand, geometry ([K12](docs/history/salvage-matrix.md)) or camera. **A schema-hash test fails CI on an unversioned schema change** ([SC-10](docs/history/lessons-ledger.md)). Until the soft launch a bump may set old saves aside ([DP-06](docs/history/lessons-ledger.md)); after it, every bump ships a migration.

**Invariants that become tests**, each shown to fail with the old bug restored ([TS-04](docs/history/lessons-ledger.md)):

| # | Invariant | Kills |
|---|---|---|
| I1 | Cash = start + Σ ledger rows; the day card is ledger rows | [K40](docs/history/salvage-matrix.md), [AR-12](docs/history/lessons-ledger.md) |
| I2 | Adding a line, stop or bus never cuts linked trips by >0.1% | [EC-02](docs/history/lessons-ledger.md), [K04](docs/history/salvage-matrix.md) |
| I3 | Fare and headway have interior optima; express peaks below $5; starving a line earns ≤60% of the optimum | [GD-13](docs/history/lessons-ledger.md), [EC-05](docs/history/lessons-ledger.md), [K28](docs/history/salvage-matrix.md), [K49](docs/history/salvage-matrix.md) |
| I4 | Splitting a line raises revenue plus subsidy ≤1% | [EC-04](docs/history/lessons-ledger.md), [K05](docs/history/salvage-matrix.md) |
| I5 | Every line at a 6-line hub boards riders | [K23](docs/history/salvage-matrix.md) |
| I6 | Cursor-card verdict equals command verdict; a bus loops in the billed cycle | [GD-05](docs/history/lessons-ledger.md), [K10](docs/history/salvage-matrix.md), [K07](docs/history/salvage-matrix.md) |
| I7 | Random create, delete, save and load never reuse an id | [K01](docs/history/salvage-matrix.md), [DP-04](docs/history/lessons-ledger.md) |
| I8 | N days in one call equal N days in 72 chunks; save-load-save is identical | [AR-06](docs/history/lessons-ledger.md), [K41](docs/history/salvage-matrix.md) |
| I9 | Undo refused after time passes; undo while paused restores cash exactly | [K22](docs/history/salvage-matrix.md), [TS-05](docs/history/lessons-ledger.md) |
| I10 | The §5 city invariants on Boston and the fixture | [K24](docs/history/salvage-matrix.md), [GD-11](docs/history/lessons-ledger.md) |
| I11 | Contract income over 10 seeds within ±30% of the median | [GD-04](docs/history/lessons-ledger.md) |
| I12 | 1366×768, 50 buses of every family, heading away from the camera, at three cameras: 2D zoom 14; the `T` default (zoom 14, pitch 50°); the mesh switch (zoom 17, pitch 60°). Each bus is at least its family's minimum (20, 24, 32 px) and the layer changes ≥200 px; a 4 px meta-test must fail | [RN-05](docs/history/lessons-ledger.md), [K46](docs/history/salvage-matrix.md), [TS-07](docs/history/lessons-ledger.md) |
| I13 | Chrome ≤6% at rest, ≤26% with a panel, at three laptop sizes; reason-code copy ≤8 words | [UX-01](docs/history/lessons-ledger.md), [K31](docs/history/salvage-matrix.md) |
| I14 | Recompute ≤150 ms p95 on Boston; gzip menu ≤200 KiB, board ≤520 KiB, model chunk ≤200 KiB (three.js with its loaders measured about 160 KiB), loaded only when a tilted camera first reaches the mesh switch; `chunkSizeWarningLimit` stays at the default, the bundle test is the gate; first frame ≤2.5 s on software GL; style validates; no frames while paused | [AR-07](docs/history/lessons-ledger.md), [AR-18](docs/history/lessons-ledger.md), [K21](docs/history/salvage-matrix.md), [RN-04](docs/history/lessons-ledger.md) |
| I15 | E2E on every PR: found, depot, draw, run a day, check cash, reload, compare | [TS-06](docs/history/lessons-ledger.md) |
| I16 | 2D/3D parity: switching modes changes no number, save byte or verdict; every layer and bus draws in both | [GD-05](docs/history/lessons-ledger.md), [AR-04](docs/history/lessons-ledger.md) |
| I17 | Bake gates G1–G10; the fixture bakes twice to its golden hash | [WD-03](docs/history/lessons-ledger.md), [WD-09](docs/history/lessons-ledger.md) |
| I18 | Each model passes `check.mjs`; all v1.0 models ≤600 KB; bad fixtures fail | [RN-07](docs/history/lessons-ledger.md) |
| I19 | Host APIs only in `src/platform/`; the nightly desktop-flavour build has no service worker or outside URL | [DP-09](docs/history/lessons-ledger.md), [K15](docs/history/salvage-matrix.md) |

**Budgets on real laptops** (weeks 4, 7, 10): 2D ≥55 fps on yours and ≥30 on the slowest with 200 buses; 3D at zoom 17, pitch 60, ≥30 fps; ≤7 vehicle draw calls; ≤10% heap growth over 30 minutes.

**CI and deploy.** The adversarial sweep runs on Boston and the fixture ([EC-12](docs/history/lessons-ledger.md)); economy PRs quote before and after ([PR-02](docs/history/lessons-ledger.md)).
- **PR checks, 8 minutes:** typecheck, lint, tests, save fixtures, bundle budget, offline check ([S20](docs/history/salvage-matrix.md)), `bake:fixture`, style test, I12, changelog check, smoke with axe-core, art check, a 60-second sweep. Slower checks go nightly and never block ([UX-08](docs/history/lessons-ledger.md)).
- **Nightly:** full sweep, bench, offline reload with the network cut ([TS-11](docs/history/lessons-ledger.md)), `npm audit`, the MBTA realism report; from week 9 the update test and desktop-flavour build.
- **Deploy:** one workflow holds both triggers from week 1. While the repository variable `LAUNCHED` is unset, every merge to `main` deploys the unlisted site; the v1.0 release checklist sets `LAUNCHED=true`, and from then only `v*` tags deploy, each first running `node scripts/changelog.mjs check --tag "$GITHUB_REF_NAME"` (or `needs:` that job). The Pages environment admits both, no cancelling ([DP-02](docs/history/lessons-ledger.md)); poll `version.json` for the SHA. **`main` is protected:** changes arrive by PR; "Versions only via /ship" is a required status check; squash and rebase merges are off, merge commits only, so a release commit keeps its SHA; a ruleset on `v*` tags blocks update and deletion. LFS before the first binary ([PR-07](docs/history/lessons-ledger.md), [DP-11](docs/history/lessons-ledger.md)).

---

## 7. Salvage plan

Copy from code, never from the manuals ([X-09](docs/history/lessons-ledger.md), [X-16](docs/history/lessons-ledger.md)). A port is done when the shipped app uses it and the smoke reaches it ([SC-09](docs/history/lessons-ledger.md)); its PR names the K-ids it closes, each with a failing-without-the-fix test.

| What | Mode | From | Fix on the way in |
|---|---|---|---|
| Real-city pipeline | **PORT on `main`** [S14](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/data/pipeline.js`, `scripts/{bake-city,test-pipeline}.mjs` | Static files; 15-digit blocks (V1 sliced to 12, `pipeline.js:524`); degree-2 collapse; one city list ([K18](docs/history/salvage-matrix.md)); offline ([K19](docs/history/salvage-matrix.md)) |
| Pack design | REWRITE-FROM | `Intralines_City_dep@archive/intralines-city-v1:Gaming/tools/pack.js`; `Intralines_City@dc63602:studio/docs/design/city-packs.md` | 16k cap, bake-twice check, refusals, lock file; never `buildZones` ([K26](docs/history/salvage-matrix.md)) |
| Ledger | PORT [S01](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/economy/` | Income, real km, deadhead, upkeep ([K40](docs/history/salvage-matrix.md)) |
| Saves | PORT [S02](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/save/*` | Async store; bus counter ([K01](docs/history/salvage-matrix.md)); intent only ([K12](docs/history/salvage-matrix.md)); moving version ([K11](docs/history/salvage-matrix.md)); honest Save ([K29](docs/history/salvage-matrix.md)) |
| Bus motion | PORT [S03](docs/history/salvage-matrix.md), [S17](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/buses/*`; `Intralines@7af45b1:src/map/busLayer3d.ts:146-199` (maths only) | One cycle formula ([K07](docs/history/salvage-matrix.md)); no mesh code ([K09](docs/history/salvage-matrix.md)) |
| Lines, pathfinding | PORT [S04](docs/history/salvage-matrix.md), [S16](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/lines/*`; `Intralines@7af45b1:src/game/routing.ts` | Spatial index ([K52](docs/history/salvage-matrix.md)); A* on (node, edge) ([K13](docs/history/salvage-matrix.md)) |
| Calendar, depots, errors | PORT [S05](docs/history/salvage-matrix.md)–[S07](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/{clock,depots,errors}/` | Clock out of React ([K44](docs/history/salvage-matrix.md)); tint and deadhead ([K43](docs/history/salvage-matrix.md)); one `DepotId` ([K54](docs/history/salvage-matrix.md)) |
| PWA, tsconfig, CI | PORT [S08](docs/history/salvage-matrix.md), [S09](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/pwa/*`, `.github/workflows/ci.yml` | Behind the updates adapter; pinned plugin and browser ([K53](docs/history/salvage-matrix.md)) |
| Loop, RNG, graph, A*, offline audit, palette maths | PORT [S11](docs/history/salvage-matrix.md), [S12](docs/history/salvage-matrix.md), [S20](docs/history/salvage-matrix.md)–[S22](docs/history/salvage-matrix.md) | `Intralines_City_dep@archive/intralines-city-v1:Gaming/{src,tools}/` | Loop in the worker |
| Geo, icons, splash, wipe | PORT [S15](docs/history/salvage-matrix.md), [S18](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/geo.ts`, `src/ui/{icons.tsx,BusWipe.tsx}` | One geo module; tokens ([RN-08](docs/history/lessons-ledger.md)) |
| Map style, board | REWRITE-FROM [R12](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/map/basemapStyle.ts:9-32, 262-283`, `src/map/overlays.ts:55-114` | V1's hues as tokens, the board mask, the zoom ramp; bundled glyphs; style tests ([K21](docs/history/salvage-matrix.md)) |
| Art pipeline | REWRITE-FROM, when a file lands | `Intralines@7af45b1:{docs/MODELS.md, scripts/check-models.mjs, scripts/make-sample-model.mjs}`; `Intralines_City@dc63602:{scripts/models/build.ts, src/render/three/modelBudgets.ts, studio/viewer/}` | glTF axes; instancing, not per-bus clones ([K09](docs/history/salvage-matrix.md)); no KTX2 or auto-decimation |
| Demand model | REWRITE-FROM [R01](docs/history/salvage-matrix.md)–[R03](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/sim/demand.worker.ts`; V2 `Gaming/src/30-sim.js` | No caps ([K04](docs/history/salvage-matrix.md), [K23](docs/history/salvage-matrix.md)); per-boarding fare ([K05](docs/history/salvage-matrix.md)); hourly crowding ([K27](docs/history/salvage-matrix.md)); captive ceiling ([K28](docs/history/salvage-matrix.md)); linked trips ([K47](docs/history/salvage-matrix.md)); 130 m radius ([K50](docs/history/salvage-matrix.md)) |
| Fares, express | REWRITE-FROM | V2 `Gaming/src/30-sim.js:70-103, 2636-2662`; `Intralines@7af45b1:src/game/constants.ts:397-412` | Taper ([K49](docs/history/salvage-matrix.md)); starters are not express ([K16](docs/history/salvage-matrix.md)) |
| Headway, fleet, report card | REWRITE-FROM [R04](docs/history/salvage-matrix.md), [R05](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/constants.ts:310-387`, `src/game/store.ts:403-520` | Buses cost money ([K42](docs/history/salvage-matrix.md)); real reliability ([K03](docs/history/salvage-matrix.md)) |
| Traffic | REWRITE-FROM [R10](docs/history/salvage-matrix.md) | V2 `Gaming/src/20-city.js:1387-1490` | One `congestionAt()` for timing and ridership ([K06](docs/history/salvage-matrix.md)) |
| Contracts, events, undo, route edits, transfers | REWRITE-FROM [R06](docs/history/salvage-matrix.md), [R08](docs/history/salvage-matrix.md), [R09](docs/history/salvage-matrix.md) | V2 `Gaming/src/30-sim.js:4576-4972`, `Gaming/docs/design/` | Bounded variance ([GD-04](docs/history/lessons-ledger.md)); no sim snapshots ([K22](docs/history/salvage-matrix.md)); buses anchored ([K32](docs/history/salvage-matrix.md)) |
| Shell, menu, founding | REWRITE-FROM [R07](docs/history/salvage-matrix.md), [R11](docs/history/salvage-matrix.md) | V2 `Gaming/docs/design/screen-layout.md`; `Intralines@7af45b1:src/ui/` | Labelled chips ([K20](docs/history/salvage-matrix.md)); one draft preview ([K10](docs/history/salvage-matrix.md)) |
| Electron shell | PORT [S19](docs/history/salvage-matrix.md), Steam workstream | `Intralines@7af45b1:electron/main.cjs` | Sandbox kept; a real build id; no service worker ([K15](docs/history/salvage-matrix.md)) |
| Harness seeds | Rebuild as tests ([T01](docs/history/salvage-matrix.md)–[T07](docs/history/salvage-matrix.md)) | Salvage matrix §B5, if handed over | Named tests as systems land ([TS-08](docs/history/lessons-ledger.md)) |
| DROP | — | V1 store, panels, mesh layer, recovery layers, IndexedDB pack cache, online tiles, city generator; V2 UI and company type; V3's three.js scene and model pipeline | [K09](docs/history/salvage-matrix.md), [DP-01](docs/history/lessons-ledger.md), [WD-04](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md) |

---

## 8. Look, feel and UX

**Decided (D8): "sleek but detailed and intricate." Call: quiet base, loud data.** The whole real city is drawn in low-chroma tones with fine linework; saturated colour is reserved for what the player builds. Subway Builder does this ([review](https://punishedbacklog.com/subway-builder-review/)), and Protomaps' light flavor builds road hierarchy from width, not hue ([flavors.ts](https://github.com/protomaps/basemaps/blob/main/styles/src/flavors.ts)). V1's identity ([RN-08](docs/history/lessons-ledger.md)) carries over as a hue family and the board.

**Style rules** (palette tests enforce the chroma limits, [S21](docs/history/salvage-matrix.md)):
1. Base colours at OKLCH chroma ≤0.04 (water ≤0.07); game colours ≥0.12.
2. Road hierarchy by width and casing in five classes: white streets, pale amber arterials, casings from z14.
3. Intricacy from hairlines that arrive with zoom: the street grid at overview, then building outlines, shorelines and cased bridges from z15, footpaths from z16, lane markings from z17 (rule 9). Detail never piles up at overview.
4. Buildings: in 2D a fill a notch darker than land with an outline; in 3D a warm-to-cool height ramp with a vertical gradient. Land use tints the ground (parks, water, campuses, industrial land), never the buildings.
5. One typeface (Noto Sans or Inter, D13), 10–14 px; neighbourhoods letter-spaced capitals; arterial names from z13, local from z14.5; density caps; basemap POIs off except hospitals and universities (no transit stations exist, D17).
6. No existing transit is drawn (D17): no rail or subway lines, stations, bus stops, bus lanes or ferry routes; former rail corridors read as plain ground. No MBTA colours, logo or branding anywhere.
7. Data layers flat and unlit; buildings and vehicles inside a 0.75–1.15 lighting envelope ([RN-06](docs/history/lessons-ledger.md)).
8. Light map only; night is a tint ([RN-13](docs/history/lessons-ledger.md), [RN-14](docs/history/lessons-ledger.md)); dusk lights come from the models.
9. **Lane markings at close zoom** (z≥17 only, so the overview stays clean): dashed white lane dividers offset from the centreline by OSM `lanes`, a double centre line on two-way roads, zebra crosswalks at marked crossings, stop bars at signals; flat on the ground, so they hold in 3D. Where `lanes` is missing the count is inferred from road class, and the bake report gives the tagged-versus-inferred share. Markings stop short of junctions instead of drawing messy intersection paint; turn arrows from `turn:lanes` are later. Render-only, from tags the bake already keeps, scheduled in January and first to go if January is tight.

**Starting tokens** (proposal): land `#ebe7df`, void `#d6d2c9`, buildings `#dcd6ca` outlined `#cfc8ba`, water `#b6d4e8`, parks `#d5e4c6`, white streets cased `#cfc8ba`, arterials `#f9e9c8` cased `#e3c48d`, lane paint white with centre lines in the arterial casing tone, labels `#5c574d`. One flavor object builds the style, so **on Sun Nov 8 you pick (D13) these tokens or pure V1 paper**, side by side on Boston; one ships.

**The chrome** stays flat and crisp, after V3's labelled chips (`Intralines_City@dc63602:src/ui/TopBar.tsx:73-79`); no emoji ([UX-10](docs/history/lessons-ledger.md)); a side-by-side with V1 at every milestone. **Call: the shell is measured from the first screen:** chip row and chrome script in week 1, full shell in week 4 ([UX-02](docs/history/lessons-ledger.md), [SC-04](docs/history/lessons-ledger.md)).

**Screen budget (I13).** Chrome ≤6% at rest and ≤26% with a panel at 1440×900, 1366×768 and 1152×720; the 2D/3D chip counts. Labelled chips: date, speed, Cash, Riders/day, Grade, Contracts ([K20](docs/history/salvage-matrix.md)). A dock of ≤8 slots. No inspector at rest; notices in one corner ([UX-05](docs/history/lessons-ledger.md)). At most three overlays: Residents, Jobs, Traffic ([UX-12](docs/history/lessons-ledger.md)).

**Rules drawn on the map**, each from its `sim/rules` predicate ([GD-05](docs/history/lessons-ledger.md)): the depot tint; the 650 m walk ring; a 250 m snap ring ("joins Mass Ave · transfer"); express chevrons; QUIET/LOSS as icon and word; contract rings with progress; events hatched a day ahead; ribbon width by frequency, dashes as well as colour ([RN-09](docs/history/lessons-ledger.md)); refusals in money, "$55k short" ([UX-03](docs/history/lessons-ledger.md)).

**Call: bus icons are rendered from the artist's models.** CI renders each model straight down into a mask the game paints with company and line colour, so 2D and 3D always match. The contract asks for a roof stripe, because a side-only stripe covered 0% of the icon from above (measured). Until the first blockout, a code-drawn top-down glyph stands in, never upside down westbound like V1's side-profile `BusSide`. I12 asserts each family's minimum length at three cameras, the `T` default included, because V3's test passed at 6 pixels ([RN-05](docs/history/lessons-ledger.md), [TS-07](docs/history/lessons-ledger.md)).

**Charm: one or two moments per milestone** ([GD-08](docs/history/lessons-ledger.md)), cut one by one if late. **Accessibility, proportionate** ([UX-08](docs/history/lessons-ledger.md)): shape plus colour, keyboard shortcuts, 24 px targets, chrome text ≥12 px at 1280×800 (Steam Deck needs it later), reduced motion, axe-core.

---

## 9. How the team works

**Roles** (decided D6).
- **You: owner and lead player.** You decide scope, look and title; start Claude sessions; play each milestone; review each art delivery (about 30 minutes, five times): in a stock glTF viewer until the art check runs in week 5, then in its CI summary (table and icon), and in `models.html` once it is live in week 9. You alone create versions, and later press Steam's release buttons.
- **The artist (the co-developer): the 3D models the game uses.** `metro-40`, `sparrow` and `goliath`, then a depot, to [docs/art/MODELS.md](docs/art/MODELS.md), a draft the artist amends by Sun Oct 18 (§3, §3.1, §5, §6 and §10 are the page to read); later landmarks and Steam capsule art; milestone playtests on a second machine ([TS-10](docs/history/lessons-ledger.md)). Estimate 20–35 hours from Oct 18 to Jan 10 (D6); no delivery falls on a playtest date.
- **Claude:** code, tests, docs, a one-page summary per milestone, at most five questions a week ([PR-03](docs/history/lessons-ledger.md), [PR-05](docs/history/lessons-ledger.md)).

**How art flows.** The artist exports a `.glb` with the contract's settings and opens a PR under `art/models/` with Git LFS, or drops it in a shared folder for you to commit (D6). From week 5 CI checks it and renders the icon; you review it as above. A failing file never reaches players: the game keeps the latest passing file, else a built-in box bus.

**Ownership.** The repo is public, so committed art can be downloaded. `art/LICENSE.md` (holder and terms you two choose) lands by Oct 18, before the first `.glb` on Oct 25. Before the Steam store page is submitted (Sun Mar 21 2027), you both sign a short agreement: copyright, the studio's permanent right to use and sell the models even if either of you leaves, credit, any revenue share, custody of `.blend` files, AI use (D14). Not legal advice.

**Capacity.** You give 2–4 hours a week; the artist's hours are in §10. **One Claude-week ≈ 2.5 sessions of 2–4 hours**, each ending in one or two merged PRs. Planned: 5–6 sessions a week to Dec 20, about twice the old calendar's pace (estimate), 2–3 in a half week, 3–4 in January (§10's Sessions column); starting one takes you minutes. Velocity, sessions merged against planned, is checked Oct 18, Oct 25 and Nov 1; if capacity is lower, the cut list moves.

**Claude session rules** live in `CLAUDE.md` (≤100 lines): one session owns `main`; no crew; one spec per milestone, ≤150 lines; restate feedback before building; commit every harness; until M3, at most one session in three on look, 3D or art; no presentation pivot inside a milestone ([PR-08](docs/history/lessons-ledger.md), [PR-11](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)).

**Call: only you create versions.** Every change a player would notice adds a line under Unreleased in `CHANGELOG.md` in the same commit. A version exists only when you type `/ship <version>`: it stamps the changelog and shows you the notes; after your yes it merges a `Release v<version>` commit through a PR (a merge commit) and tags that commit. CI fails any version without its own release commit (one parent, changelog and package files only), any `v*` tag elsewhere and any later edit to released notes. It cannot tell who made a commit, so the CLAUDE.md rule and your yes are the guard, and `.claude/settings.json` makes every tag ask a person. V1's "one version per session" rule made 24 versions in about 8 days, two of them both v1.18 ([PR-15](docs/history/lessons-ledger.md), [PR-08](docs/history/lessons-ledger.md)). Milestone tags such as `prototype` never start with `v`; RC1 and RC2 are builds named by SHA unless you type `/ship 1.0.0-rc.N`; every v1.0 date here is a target for your `/ship`.

**Done.** A PR is green and updates the docs it touches ([PR-06](docs/history/lessons-ledger.md)); until launch it is also live (`version.json` shows its SHA), and after launch it is a green CI build you can play (§11). A milestone also needs your play notes in `docs/playtests/`, citing the on-screen SHA ([PR-13](docs/history/lessons-ledger.md)).

**Call: playtests take a middle path.** Every milestone: your 10-minute check (and the artist's): what did you try, where did you get stuck, what was boring or ugly, does it look like Boston? **P0** this week: V1 for 30 minutes each ([GD-07](docs/history/lessons-ledger.md)). **P1** Nov 22: you and the artist each play a quarter. **P2** Dec 12–13: two or three newcomers. **Soft launch** Jan 22: about ten people on the unlisted URL. The protocol (`docs/playtests/PROTOCOL.md`): a pinned build, no help for 10 minutes; first line ≤3 min, profit ≤8 min, a 1–5 keep-playing score. **If P2 players cannot say what to do after their first line,** week 10 goes to onboarding and its chip, drag and style items move to January; **if fewer than half want to keep playing,** January's look time goes to contracts and pacing.

**Call: few docs; this plan is not a living spec.** §0 is the page you read; only §10's table is updated at milestone close; if anything drifts, `docs/SCOPE.md` and `docs/DECISIONS.md` win, and on Mar 1 this file is rewritten short. The repo keeps `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `docs/SCOPE.md`, `docs/DECISIONS.md`, `docs/specs/current.md`, `docs/art/MODELS.md`, `docs/playtests/`, bake reports and the frozen `docs/history/`.

---

## 10. Milestones and calendar

Weeks run Monday to Sunday; checks use the deployed build.

**What the decisions cost** (Claude-weeks, estimates). Added: Boston pipeline 2.5–3, map, 2D/3D and vehicle layer about 3.5, art tools 0.5 and platform seams 0.25, all in weeks 1–7; the model path about 1, in January. Removed: Riverton and its style port about 1, the generator and grid city about 1, the Boston spike 0.7, the symbol-layer bus 0.5 and itch.io 0.3, from weeks 1–7; the third city and near-zoom bus 1.5, from January. **Net about +3 (+2.75 to +3.25): +3.25 to +3.75 in weeks 1–7, −0.5 in January.** The spike was side-branch work, so on `main` weeks 1–7 carry closer to +4.

**Call: Feb 7 holds, paid for by sessions, not buffer.** The net lands before any buffer, so 5–6 sessions a week pay for it (the Sessions column, checked from Oct 18). Buffer per milestone: **none before M3** (Nov 22; its deadline is the half Thanksgiving week, with hourly congestion as the valve to 1.1); **none before M5** (Dec 20; the holidays are its deadline, Jan 3); **none from Jan 4 to Feb 7**, so cut 1 is taken now and, if M5 is signed off on Dec 20, the model path may start in weeks 11–12 (art is not a system); **three weeks from Feb 7 to Feb 28.**

| Wk | Dates | Sessions | Focus | Exit check (you, 10 min) |
|---|---|---|---|---|
| 1 | Oct 12–18 | 6 | **M0 Boston board.** Scaffold, CI, Pages, PWA, platform fence, LFS; Boston tiles measured; MapLibre, style v0, offline city file; bake skeleton; mini-Boston fixture; V1 playable. **P0.** Artist: contract review, art licence line | Boston opens flat, every arterial named; reloads with Wi-Fi off; the next deploy shows "Update ready" |
| 2 | Oct 19–25 | 6 | Ports; worker host; V1's pipeline ported; census to cells, `sim.json` and G1–G7 on the fixture; dots; raw tilt (`T`, ≤0.5 session); smoke; height-tag count. **D12 Oct 25.** Artist: **`metro-40` blockout Oct 25** | `T` tilts and returns; dots sit where Back Bay to Longwood lives and works; "people within a walk"; does it look like Boston? |
| 3 | Oct 26–Nov 1 | 5 | **M1 First dollar, on the fixture.** Demand with V1's β; fare and subsidy income; daily close; I1, I2; recompute bench; line, stop and demand layers; the Inner Boston bake runs. **Capacity check; D7, D11 Nov 1** | A debug line from Back Bay to Longwood: riders board, money comes in, the day card adds up |
| 4 | Nov 2–8 | 6 | **M2 First line.** Shell; line tool; depot tint; headway to purchase; all costs; vehicle layer with the code-drawn glyph; I12. **Full Inner Boston pack green; format freeze; D13 token swap (≤0.5) Nov 8.** Artist: `sparrow`, `goliath` blockouts | Found, depot, 4 stops, every 20 min: cash moves exactly as the inspector said |
| 5 | Nov 9–15 | 6 | Stop tiers, flags; fare band; Finance; Metro 40 and Goliath rows; undo; slots, autosave, export; place-anchored stops, the missing-pack refusal, the r1→r2 save test; sweep in CI; credits, `LICENSE-DATA.md`; **`city-boston-r1` Nov 15** (β fit, full-cell demand, `tripScale` and starting cash re-measured, heights by the week-2 rule); art check and icons, CI only (≤0.5); three.js proof behind a flag (≤1) | Undo a stop while paused: cash back to the cent; an hour later, refused with a reason |
| 6 | Nov 16–22 | 5 | **M3 Money loop.** Report card; failure floor; HEADWAY contracts; checklist; Export session. **P1** | Checklist → profitable day → contract in about 8 min; the report card; overspend → countdown → restart |
| 7 | Nov 23–29 | 2.5 | Thanksgiving, half a week: transfers; route remove and extend; hourly congestion if it fits, else 1.1 (cut 8). **M3 deadline Nov 29.** Artist: **`metro-40` final Nov 29** | Two lines share a stop at Kenmore and riders transfer |
| 8 | Nov 30–Dec 6 | 5 | **M4 Goals. System cutoff Dec 6.** RIDERSHIP contracts; events; medals; express behind I3; route insert; full sweep. Artist: **`sparrow` final Dec 6** | A Longwood contract; roadworks a day ahead; insert a stop and no bus jumps |
| 9 | Dec 7–13 | 5 | **Tuning freeze:** Boston's bands; pacing; Home; save list; nightly update test; GPU ladder; model viewer with the Boston-map preview (≤1.5). **P2 Dec 12–13** | Home to a profitable day in ≤8 minutes untold |
| 10 | Dec 14–20 | 5 | **M5 Prototype.** P2 fixes; the 2D/3D chip, drag, snap and cross-fade; style pass; slow-laptop run, flat and tilted. **Tag `prototype` Dec 20** (D16). Artist: **`goliath` final Dec 20** | Home → founding → a profitable day |
| 11–12 | Dec 21–Jan 3 | 2 | Holidays: fixes only, or the model path if M5 is signed off. **M5 deadline Jan 3** | — |
| 13 | Jan 4–10 | 4 | Model path: instancing per family, the mesh switch, the 3D I12 cameras; look and charm; close-zoom lane markings (first cut). Artist: in-map fixes, depot **Jan 10** | Three families glide in 3D at ≥30 fps; beside V1, ours or a tie |
| 14 | Jan 11–17 | 4 | **M6 Content freeze Jan 17**, the city revision included. Help; settings; accessibility; credits; polish if green. RC1 | Ten minutes in Boston, flat and tilted; nothing unfinished |
| 15 | Jan 18–24 | 3 | **Soft launch Jan 22** on the final origin; screenshots, clip, landing page | Saves survive a browser restart on two browsers |
| 16 | Jan 25–31 | 3 | **M7 Release candidate.** Fixes; RC2; checklist dry run. **D4 and D15 Jan 31** | Every checklist line ticked by a person |
| 17 | Feb 1–7 | 2 | **You ship v1.0.0, target Sun Feb 7** | The page loads on a computer that never saw it |
| 18–20 | Feb 8–28 | — | Buffer: hotfixes; Steam's no-code steps once v1.0 ships; a ≤2-hour Electron smoke (§11). **RC deadline Feb 14; hard deadline Feb 28** | — |

**Cut first if late, in order:** (1) map extras: building grow-in, narrow-FOV 2D, extra labels (**taken now**, for January slack); close-zoom lane markings are the one map extra kept for January and the first thing cut there; (2) express lines; (3) the artist's 3D models in v1.0: 3D shows icons, three.js never ships, the models still draw the 2D icons and reach 3D with Steam; (4) events down to roadworks; (5) free tilt becomes two fixed states, flat and 50°, with no drag or snap; (6) route insert; (7) the top medal (the Goliath stays buyable); (8) hourly congestion; (9) the report card to three categories. Charm items go one at a time and never block a milestone.

**Never cut:** Boston from real data, in an extent that passes the bake gates (the extent flexes; Boston stays); D8's floor: building footprints, street hierarchy, water, parks, land use and street labels; D17's no-transit city; flat 2D and a way into 3D; the offline city file, fonts and OSM attribution; the money loop, contracts, failure floor and checklist; the calm shell; save integrity, the update flow and platform seams; invariants, sweep and smoke; I12; the GPU ladder; your playtests, P2 and the soft launch.

**Triggers.** A trigger that reaches a decided item (cut 3 touches D6, cut 5 touches D2) becomes one of that week's questions to you, with a recommendation, and your answer goes in DECISIONS.
- **Velocity, Sun Oct 18 and Oct 25:** sessions merged against the Sessions column. Under two-thirds → the next week's map and look items wait for M3, and the weekly note says what moved.
- **First-dollar signal, Sun Oct 25:** a headless fixture test in which one line writes a fare row to the ledger, with no UI. Red → week 3 drops all map work.
- **No `metro-40` blockout by Sun Nov 1:** no art pipeline yet; buses keep the code-drawn glyph ([RN-07](docs/history/lessons-ledger.md)). **None by Sun Nov 22:** the art checker waits for week 13.
- **First dollar not in by Sun Nov 1:** guards move to nightly, map work stops beyond what M2 needs, and every session works on income.
- **Sun Nov 1 capacity check, more than a week behind:** the week-4/5 presentation items (the D13 swap, the art check, the three.js proof) wait for M3, and cut 2 applies.
- **Full Inner Boston pack not green by Sun Nov 8:** format 1 freezes on the fixture-proven schema, and the extent shrinks to a core box that passes G1–G10 (for example Back Bay–Downtown–Kendall–Longwood, about 25–35 km²); R2 and all of Boston become 1.1. r1 publishes Nov 15 either way.
- **3D under 30 fps on the slowest laptop (week 7):** raise the 3D zoom floor to 14.5, drop the extrusion gradient and blending, and cap pitch at 50°; still slow → meshes only at zoom ≥18, icons elsewhere.
- **M3 not signed off by Sun Nov 29:** cuts 2 and 4, and cut 5 (your call), which removes the week-10 drag and snap work. **A week-8 item not green by Dec 6:** it moves to 1.1.
- **No passing `metro-40` final by Sun Dec 13:** you decide cut 3 with the prototype on Sun Dec 20; if taken, week 13 becomes polish or buffer. **No passing `sparrow` or `goliath` final by Sun Jan 10:** that family keeps its blockout or the procedural box.
- **M5 not signed off by Sun Jan 3:** cut 3 (your call) and charm items; the target moves to Sun Feb 21, with content freeze Sun Jan 31, soft launch Fri Feb 5 and RC Sun Feb 14.
- **RC not green by Feb 7:** ship the Sunday after. **Not by Sun Feb 14:** you decide that day whether to `/ship` a version on Feb 28 or keep testing; you choose the number, which must be above any rc you shipped.
- **Two quiet weeks:** cut the next item at the next session ([SC-11](docs/history/lessons-ledger.md)).
- **Pages traffic over 50 GB in a month:** city files behind a CDN on the same domain.

---

## 11. Publishing and distribution

**Decided (D3): GitHub Pages now, Steam later; itch.io dropped.**

| Platform | Needs | Verdict |
|---|---|---|
| **GitHub Pages** | The deploy workflow and both Pages gates ([DP-02](docs/history/lessons-ledger.md)); city files as release assets. Limits: a 1 GB site, a soft 100 GB a month (about 2,500 first visits at 40 MB), no commercial software ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) | **v1.0, free.** Unlisted from week 1; public when you ship |
| **Steam** | US$100 per game, recouped after US$1,000; release ≥30 days after paying; Coming Soon ≥2 weeks; reviews of 3–5 business days; legal-name, tax and bank onboarding ([Steam Direct](https://partner.steamgames.com/steamdirect), via search excerpts) | **After v1.0** |

**The web origin (D12, by Sun Oct 25). Call: a custom subdomain.** An account's project sites share one browser origin, and V1's service worker deletes every cache on it (`Intralines@7af45b1:vite.config.ts:150-158`), so opening V1 could wipe interbus's offline copy. Moving origins later strands every browser save, so the origin must be final before the soft launch. A subdomain costs a yearly domain fee and an hour of DNS ([custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)); the alternatives are a studio organisation's `github.io` or a narrower V1 worker.

**Price.** The web build is free; the Steam price and what Steam adds is D4.

**Supported in v1.0.** Current Chrome, Edge and Firefox with WebGL2, and Safari if a Mac is available; mouse and keyboard; 1152×720 or larger. Safari may delete a site's script-written storage, service worker and caches after seven days of Safari use without a visit ([WebKit](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), via search excerpts, checked 2026-10-12; check before relying on it), so Home says "use Export to back up".

**Privacy.** No analytics, ads, accounts or third-party requests; the offline check fails CI on any outside URL ([S20](docs/history/salvage-matrix.md)).

**Licences and credits** (not legal advice; ask the OSMF Licensing Working Group before a paid release if unsure).
- **OpenStreetMap (ODbL 1.0):** "© OpenStreetMap contributors" in a map corner whenever the map shows, linked to [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright), plus credits and store page ([guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)). **Call: publish both city files under ODbL as public release assets, with the bake recipe in this repo** (D14); that meets share-alike and keeps a Steam build with DRM compliant. Code and art keep their own licences.
- Census data is public domain, credited anyway; Protomaps BSD-3 and ODbL while its build is used; fonts OFL with the licence text; a generated `THIRD_PARTY_NOTICES` for libraries; MBTA data never ships. The build carries `LICENSE-DATA.md` and a credits page generated from each pack.
- **Before selling (D14):** a repo licence and the signed art agreement (§9).

**Release checklist** (`docs/RELEASE.md`): you typed `/ship`; every save fixture since the soft launch loads and an old tab shows "Update ready" ([DP-01](docs/history/lessons-ledger.md)); offline reload with the network cut ([TS-11](docs/history/lessons-ledger.md)); a 30-minute soak, flat and tilted; played on three machines, once without hardware acceleration; attribution, credits and licence files present; a landing page with screenshots, clip and privacy line; `version.json` matches the tag; for v1.0, the repository variable `LAUNCHED=true` is set, so from then on only tags deploy.

**Updates.** On the web, V3's flow: prompt to update, never swap a running tab, none of V1's six recovery layers ([DP-01](docs/history/lessons-ledger.md)). After launch the public site deploys only versions you ship; you play `main` from CI artifacts.

**Steam: a proposal for your say (D15, with D4, by Sun Jan 31 2027).** Claude's Steam code starts on the later of Mon Mar 1 and two weeks after v1.0 ships, which leaves a hotfix window; the no-code steps start earlier. Dates are from Valve's pages via search excerpts ([Next Fest June 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027), [Steam Direct](https://partner.steamgames.com/steamdirect), checked 2026-10-12); check each before relying on it.

| When (2027) | What |
|---|---|
| Jan 31 | D4 and D15 together, so a Steam-only extra (a city is 1–2 Claude-weeks) cannot move a window already fixed; the artist's Feb–Mar hours asked (D6) |
| From the week after `/ship 1.0.0` | The account holder onboards: legal name, bank, a tax check of 2–7 business days, a possible ID check; no fee yet. At onboarding, ask Valve whether a game free on the web can join Next Fest, before any demo work |
| From Feb 8 | The artist makes capsule and library art (10–20 h; the art direction froze Jan 17); a ≤2-hour Electron smoke on a throwaway branch loads the desktop-flavour build and Boston's map |
| By Sun Mar 7 | The fee paid (the 30-day clock starts) |
| Mar 1–28 | Claude ports the Electron shell and desktop platform (file saves, inert updates, the city file from disk); Steam Cloud, achievements from medals, a beta branch; screenshots (by Mar 21) and a trailer from replays |
| By Sun Mar 21 / ~Apr 6 | Signed art agreement (D14), then store page submitted / Coming Soon live |
| By Apr 25 | Next Fest registration, if Valve said yes |
| Jun 14–21 | Next Fest |
| **Tue Jul 13** | **You press Release App**, after the Summer Sale |

Option B releases Tue May 11 without Next Fest. Effort: about 3–4 Claude-weeks and 10–15 of your hours; under cut 3, Option A only, plus 1 Claude-week for the model path. **Electron**, because it bundles the Chromium CI tests; Windows first, unsigned through Steam (community evidence; check), tested on the Windows PC named in D15; Deck through Proton; macOS needs notarization and a US$99 yearly membership ([Apple Developer Program](https://developer.apple.com/programs/), checked 2026-10-12; check before relying on it), so it waits for D15. Steam's Content Survey, AI use included, is answered truthfully. Only you press "Release App", with the CHANGELOG entry as release notes.

---

## 12. Risks and mitigations

1. **Real-city data eats the schedule** ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md), [WD-04](docs/history/lessons-ledger.md), [WD-09](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)). Pinned static files; a gated, dispatch-only bake; M1 on the fixture by default, so money never waits; the full pack due Nov 8 with the core-box trigger; format frozen Nov 8.
2. **3D ambition crowds out the game** ([RN-03](docs/history/lessons-ledger.md), [RN-05](docs/history/lessons-ledger.md), [RN-07](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)). One renderer; 3D is extrusions plus a lazy model path, proven behind a flag in week 5 and shipped in January; at most one session in three on look, 3D or art until M3; renderer code capped near 2,500 lines (V3 reached 4,400); no pivot inside a milestone; cuts 3 and 5.
3. **The money loop closes late** ([GD-01](docs/history/lessons-ledger.md)). First dollar in Boston by Nov 1 with its trigger; cheapest guards only.
4. **Boston's density breaks the balance** ([X-08](docs/history/lessons-ledger.md)). Boston is the reference city; `calib.tripScale` from its first-line band; the sweep runs on it.
5. **Momentum dies** ([SC-11](docs/history/lessons-ledger.md)). A merged PR and a note weekly; velocity checks from Oct 18; the quiet-weeks trigger; three buffer weeks after Feb 7.
6. **Not fun** ([GD-07](docs/history/lessons-ledger.md), [TS-10](docs/history/lessons-ledger.md)). P0, the protocol, P2 before the tag, the soft launch, the charm budget.
7. **You do not like the look** ([RN-02](docs/history/lessons-ledger.md)). Boston on screen in week 1; a token swap for Nov 8; side-by-sides.
8. **Exploits or balance thrash** ([GD-13](docs/history/lessons-ledger.md), [EC-12](docs/history/lessons-ledger.md), [SC-08](docs/history/lessons-ledger.md)). Invariants, the sweep in CI, the Dec 6 cutoff.
9. **Saves or offline copies break** ([DP-01](docs/history/lessons-ledger.md), [DP-04](docs/history/lessons-ledger.md)). V3's PWA, the schema hash, place-anchored stops, the origin fixed before the soft launch.
10. **It runs badly or not at all** ([AR-07](docs/history/lessons-ledger.md), [RN-04](docs/history/lessons-ledger.md)). Worker sim, instanced icons, render on change, laptop budgets, the GPU ladder.
11. **Art late, over budget or unowned** ([RN-07](docs/history/lessons-ledger.md), [X-15](docs/history/lessons-ledger.md)). Blockout first; budgets that fail with numbers; the fallback ladder; the licence line before the first file.
12. **Licences block Steam.** City files and recipe public under ODbL from week 5; attribution from the first map.
13. **Process bloat or lost work** ([PR-04](docs/history/lessons-ledger.md), [PR-07](docs/history/lessons-ledger.md)). No crew, few docs, one owner session, merge commits only, owner-only versions.

---

## 13. Decisions

Answers go in [docs/DECISIONS.md](docs/DECISIONS.md), with how to reverse each. Until answered, the plan assumes the recommendation.

**Decided 2026-10-12**

| # | Decision | Your choice | What it changed |
|---|---|---|---|
| D1 | Cities | **Real cities first; Boston is the first and test city** | Boston on `main` from week 1; procedural only as fixtures; no third city |
| D2 | Renderer | **A flat 2D mode that tilts into 3D** | MapLibre only, detailed vector tiles; the old Oct 25 renderer fallback dropped |
| D3 | Platform | **GitHub Pages now; Steam eventually** | itch.io dropped; platform seams; the Steam proposal |
| D6 | Roles | **The co-developer is the 3D modeler and artist** | The model contract and art dates; hours still open |
| D8 | Look | **"Sleek but detailed and intricate"** | Quiet base, loud data; the palette pick is D13 |
| CL | Versions | **Versions only on your say** | `/ship`, its release PR and the CI check |
| D17 | Existing transit | **None, for now: the city starts with no buses, trains or ferries; bus lanes become general lanes** | The bake strips transit and gate G10 checks it (§5); no rail drawn (§8 rule 6); player-built bus lanes are the only red lanes |

**Still open**

| # | Decision | Recommendation | By |
|---|---|---|---|
| D4 | Steam price and what Steam adds over the free web build | Decide from comparables you check | **Jan 31 2027**, with D15 |
| D5 | Title: Intralines, Interbus or new | **Intralines**, after a name check | **Jan 3** |
| D6 | The artist's hours and delivery route; playtester names | 20–35 h; PR with LFS; 3 names for P2, 10 for the soft launch | Hours **Oct 18**; names **Nov 22**; Feb–Mar hours **Jan 31** |
| D7 | Save format: start cash, headway or bus count, fare scope, V1 import | **$310k; peak and off-peak headway; per-line fares; no import** ([X-09](docs/history/lessons-ledger.md), [X-12](docs/history/lessons-ledger.md), [X-13](docs/history/lessons-ledger.md)) | **Nov 1** |
| D9 | The revised Out list (§2) | **Accept**; anything moved in names something moved out | **Oct 18** |
| D10 | Failure severity | **The §3 floor** | **Nov 15** |
| D11 | Boston's play area: Inner Boston (~800 cells), R2 (~900), later all of Boston with variable cells | **Inner Boston**; R2 only if recompute ≤100 ms | **Oct 18**; again **Nov 1** |
| D12 | Web origin: custom subdomain, studio `github.io`, or narrow V1's worker | **Custom subdomain** | **Oct 25** |
| D13 | Map palette (warm-neutral or V1 paper), light or dark, font (Noto Sans or Inter) | **Warm-neutral, light** (you asked V3 for a light map, [RN-13](docs/history/lessons-ledger.md)) | **Nov 8** |
| D14 | Licences: art holder and terms; city files under ODbL; repo licence; signed art agreement | **Art all rights reserved; publish the city files; write the rest down** | Art **Oct 18**; city files **Nov 8**; rest before the store page is submitted (**Mar 21 2027**) |
| D15 | Steam window, account holder, macOS, a Windows test PC | **Jul 13 2027 after Next Fest; Windows first; no macOS at launch** | **Jan 31 2027** |
| D16 | Is the Dec 20 prototype a version (`/ship 0.1.0`) or the tag `prototype`? | Either; the plan assumes the tag | **Dec 20** |

---

## 14. The first two weeks

**Call: in week 1 you see real Boston, deployed and updatable; in week 2 it tilts and fills with people** ([GD-07](docs/history/lessons-ledger.md), [SC-11](docs/history/lessons-ledger.md)).

**Before the first session:** commit this plan, `README.md`, `CLAUDE.md`, `.gitignore`, `.claude/settings.json`, `CHANGELOG.md` with its check and `/ship` skill, `docs/DECISIONS.md`, `docs/art/MODELS.md` and `docs/history/`; give Claude read access to `Intralines`, `Intralines_City_dep` (private) and `Intralines_City`.

**Week 1: Oct 12–18**

| # | Who | What | Done when |
|---|---|---|---|
| 1 | Claude | `docs/SCOPE.md` (one page), `docs/playtests/PROTOCOL.md` | On `main`; SCOPE reads in 5 minutes |
| 2 | You | Answer D6, D9, D11; Pages from Actions; protect `main`: PRs only, "Versions only via /ship" a required status check, squash and rebase merges off (merge commits only); a `v*` tag ruleset blocking update and deletion | In DECISIONS by Oct 18 |
| 3 | Claude | Scaffold (Vite, React, strict TS, Vitest, Playwright, lint rules, LFS, CI); the deploy workflow with both triggers and the `LAUNCHED` switch, SHA poll; PWA behind the updates adapter; `src/platform/web`; version chip | A second deploy shows "Update ready" and works offline |
| 4 | Claude | Boston map: `pmtiles extract --dry-run`, then a pinned Protomaps cut of Inner Boston plus 1.5 km as a hashed release asset; Pages Range check; MapLibre 6.11.2; style v0; glyphs; OSM attribution; `CityTileSource` | Boston opens flat with labels, offline; sizes in DECISIONS |
| 5 | Claude | Bake skeleton: `city.json`, extent, `bake:plan`; fetch, lock, mirror; the mini-Boston fixture (the §5 box) clipped from every input | The fixture committed; Boston's 675,647 exact |
| 6 | Claude | Make V1 playable for P0 | You open V1's Riverton in one step |
| 7 | You, the artist, others | **P0:** 30 minutes of V1 each | `docs/playtests/2026-10-17-p0-v1-baseline.md` |
| 8 | The artist; you | The artist reads MODELS.md §3, §3.1, §5, §6 and §10 (about a page) and answers §12 (tool, hours, route, roof stripe, any existing models); you agree the art licence line, and `art/LICENSE.md` is committed | In DECISIONS by Oct 18 |
| 9 | You | M0 check; the velocity check (§10) | Note committed |

**Week 2: Oct 19–25**

| # | Who | What | Done when |
|---|---|---|---|
| 10 | Claude | Port V3's ledger, saves (async store, bus counter, schema hash), calendar, errors; V2's RNG, graph, A*; V1's geo | Ported tests, I7 and schema hash pass, each shown failing on the old bug |
| 11 | Claude | Worker host; V1's pipeline and fixtures ported; census to cells, street graph (G2/G3 with bus access), `sim.json` and loader on the fixture; dots; catchment probe; Inner Boston height-tag count; smoke; the fare-row signal (§10) | I8; I10 on the fixture; "people within a walk" in e2e |
| 12 | Claude | Raw tilt: `T` sets pitch 50° with extrusions (≤0.5 session); board mask; style and bundle tests | `T` tilts and returns |
| 13 | Claude | `docs/specs/current.md` for M1, ≤150 lines, "first dollar on the fixture by Nov 1" on top | Committed by Oct 25 |
| 14 | You | "Does this look like Boston?" check; two or three screens that mean "sleek but detailed"; answer D12 (a custom domain: buy and verify it; Claude adds the `CNAME`); the velocity check | In DECISIONS |
| 15 | The artist | **`metro-40` blockout** (1–2 h): true length, axes, origin, slot names, roof stripe | Delivered by Sun Oct 25 |

The first player-visible change adds the first line under Unreleased; no version exists until you type `/ship`. If week 1 slips, items 3 and 4 come first.
