# interbus: the plan

*Written Monday 2026-10-12 for Miticept Studios and revised after five rounds of your decisions (§13, [docs/DECISIONS.md](docs/DECISIONS.md)). "You" means the studio owner; "the artist" means the co-developer. **Call:** marks a settled question and its reason.*

**Citations.** Lesson IDs ([GD-01](docs/history/lessons-ledger.md) …) link to the [lessons ledger](docs/history/lessons-ledger.md); bug and salvage IDs ([K01](docs/history/salvage-matrix.md), [S01](docs/history/salvage-matrix.md), [R01](docs/history/salvage-matrix.md) …) to the [salvage matrix](docs/history/salvage-matrix.md). Prior code is `repo@ref:path`: V1 `Intralines@7af45b1`, V2 `Intralines_City_dep@archive/intralines-city-v1` (game under `Gaming/`), V3 `Intralines_City@dc63602`. Web facts carry their URL and were checked 2026-10-12, some only through search excerpts; fees and policies change, so check before relying on them. "Measured" means measured on 2026-10-12; "estimate" means not.

**Open decisions** (due date; recommendation in bold). [docs/DECISIONS.md](docs/DECISIONS.md) holds the full table and wins; until answered, the plan assumes the recommendation, except the art's licence.
- **D20 (preview)** (**Sun Feb 21**, §12 risk 14): what the preview becomes, and the GitHub plan, when you make the repo private on Sun Mar 14, a week before the store page is public (D20 (rest), decided 2026-10-14, with the art's CC BY 4.0): **taken down then, with the repo on GitHub Pro (about US$4 a month) so `main`'s rulesets (D24) and the desktop jobs' secrets keep working.**
- **D19, deferred:** the demo's scope and any trailer; revisit Sun Dec 20 with the prototype, decide by Sun Feb 28, before the store page.

---

## 0. One-page summary

**What we build.** A calm bus-company game on real Boston: real streets and buildings, no buses, trains or ferries until you start them (D17), and people where the 2020 census and real commute records put them. You draw lines, set how often buses run and what each line charges, and watch riders and money flow on a crisp flat map, light or dark, that tilts into 3D where the artist's buses glide between real buildings. The city offers contracts and grades you every quarter: V1's loop on V3's engineering with V2's economy fixes, cut to what a two-person part-time studio can finish.

**For whom.** You first: if you do not want to keep playing it, it has failed. Then people who like Mini Metro's calm but want a company with real money in a real city, in 20–60 minute sessions, on Steam at about US$10.

**By when.** Coding starts this week, once these files are on `main` (§14): Boston opens on the preview by **Sun Oct 18**, the first fare dollar comes in on a Back Bay–Longwood clip by **Sun Nov 1**, and you draw and run your own first line by **Sun Nov 8**. A playable prototype of Inner Boston is tagged `prototype` **Sun Dec 20** (D16, not a version). **v1.0 complete on the preview, target Sun Feb 7 2027**, hard deadline Sun Feb 28, yours to `/ship 1.0.0`. **Then Steam, working back from Next Fest, Mon Jun 14–Mon Jun 21 2027** (D18): Coming Soon page public by Sun Mar 21, registration by Sun Apr 18, a free demo for macOS and Windows in review Mon May 3 and public Mon May 24. The full Steam release, the only one, comes about a week after the fest: Tue Jun 29, inside the Summer Sale (§11, D22).

**The calls that shape everything**
1. **Money before presentation.** Income in week 3, costs in week 4, the full money loop by Nov 22, on a committed mini-Boston fixture that never waits for the bake or for 3D. Until M3, at most one session in three is look, 3D or art work ([GD-01](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)).
2. **Boston first, baked offline from pinned static files** (D1) behind ten numeric gates, the last proving no transit survives (D17); browsers never fetch source data ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md)).
3. **One renderer, two views** (D2): MapLibre draws one detailed map, flat or tilted; three.js only draws the artist's buses inside it, lazily: proven behind a flag in week 5, shipped in January ([RN-03](docs/history/lessons-ledger.md)).
4. **A preview now; Steam the only release, after a June Next Fest demo** (D3, D4, D12, D15, D18): Pages shows you every merge, its SHA on screen, with no offline mode, update prompt or web migrations; a platform module and async saves keep Steam a packaging job ([DP-09](docs/history/lessons-ledger.md)).
5. **Art built around real files** (D6): the first box-level bus is due Sun Oct 25, and its CI check follows in week 5 ([RN-07](docs/history/lessons-ledger.md)).
6. **Fewer controls, fewer exploits.** Three headway periods with no night-only line, no per-bus wear, undo only while paused, express behind a test ([GD-06](docs/history/lessons-ledger.md), [K22](docs/history/salvage-matrix.md)).
7. **No new system after Sun Dec 6.** January is models, content and look ([SC-08](docs/history/lessons-ledger.md)).
8. **Versions only on your say:** only `/ship <version>`, typed by you, creates one; CI fails any other, and your yes inside `/ship` is the guard ([PR-15](docs/history/lessons-ledger.md)).
9. **Triggers cut scope first; only the M5 and RC triggers move the target, and never past Feb 28** (§10).

**How.** One Claude session owns `main` and merges its own pull requests on green checks (D23); no agent crew; ≤150-line specs; PR checks within 8 minutes ([PR-04](docs/history/lessons-ledger.md), [PR-08](docs/history/lessons-ledger.md)).

**This week:** Claude gets read access to the three earlier repos; you protect `main` (§14 item 2); the artist commits `art/LICENSE.md` by Oct 18, naming Miticept Studios and the art's licence, CC BY 4.0 (D20); the artist reads [docs/art/MODELS.md](docs/art/MODELS.md) §1 and §2 and answers §1's questions; the V1 baseline (§14).

---

## 1. Vision and pitch

**Pitch.** *Run the buses of Boston. Its real streets, buildings, river and harbour are drawn quiet and fine, no bus, train or ferry runs until you start one, and the only colour is your network. Find where people live and work, draw lines down streets you know, and decide how often buses run and what each line charges. Read it flat like a transit map, or tilt it to watch your buses glide past Back Bay. Every rule is drawn on the map, and the money comes in until the city hands you its next contract or the bank stops calling back.*

**How it differs** (check before store copy). Unlike Mini Metro it has money, a grade, contracts and a real city; unlike City Bus Manager it has no chores ([GD-03](docs/history/lessons-ledger.md), [GD-09](docs/history/lessons-ledger.md)). Subway Builder ([Steam](https://store.steampowered.com/app/4039140/Subway_Builder/)) is the reference for "sleek but detailed" until your own screens arrive (§14 item 14); interbus is buses on streets, in shorter sessions, offline on Steam.

**Against V1–V3.** V1's only goal was "profit go up" ([SC-03](docs/history/lessons-ledger.md)), V2 covered 41.2% of the map with chrome ([UX-01](docs/history/lessons-ledger.md)), V3 never earned a dollar ([K40](docs/history/salvage-matrix.md)); this plan answers all three.

**Title (D5): interbus**, also the repo, package and storage-key name. Check it by Sun Feb 7, before the Steam fee names the app: INTERBUS is also Phoenix Contact's industrial fieldbus ([Wikipedia](https://en.wikipedia.org/wiki/INTERBUS), via search excerpts, checked 2026-10-12; D5).

---

## 2. Pillars and non-goals

1. **A calm, detailed map where every rule is drawn.** An intricate real city in quiet tones with only the player's network in colour; ≤6% chrome at rest, ≤8 words beside any control ([UX-01](docs/history/lessons-ledger.md), [UX-02](docs/history/lessons-ledger.md)). One function drives each rule's check, money and drawing ([GD-05](docs/history/lessons-ledger.md)).
2. **Network shape is the game; the economy is honest.** No control is best at its extreme; more service never loses riders ([GD-02](docs/history/lessons-ledger.md), [GD-13](docs/history/lessons-ledger.md), [EC-02](docs/history/lessons-ledger.md)).
3. **It just works.** A reload shows the newest build, its SHA on screen, and a deploy never breaks an open tab; saves never corrupt; on Steam, updates never break a game and it plays offline (*"bugs out every time it updates"*, `Intralines@7af45b1:scripts/retain-assets.mjs:5`; [DP-01](docs/history/lessons-ledger.md)).

A mechanic that needs a second mechanic to explain it is cut ([GD-06](docs/history/lessons-ledger.md)). **3D is a view, not a mechanic:** no rule, number or save field depends on the camera.

| Out for v1.0 (D9) | Why | Status |
|---|---|---|
| Procedural cities (except test fixtures); a second city | D1; one city done well | Second real city after v1.0 |
| A public web release: itch.io, a custom domain, offline play, an update prompt, web save migrations, a landing page | D4, D12: the web is your preview | Steam is the release |
| A Mac App Store build | D4, D21 (a): Steam is the only store, on macOS too | Not planned |
| Live APIs, browser data fetches, third-party tiles | [WD-01](docs/history/lessons-ledger.md) | Never |
| Terrain, sky, a second renderer, a Canvas fallback | [RN-02](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md) | Never |
| Company type, lobbying; staff, mechanics, Environment; fuel; schedule assistant | [GD-03](docs/history/lessons-ledger.md), [GD-09](docs/history/lessons-ledger.md), [GD-12](docs/history/lessons-ledger.md) | Never |
| Mk tiers, per-bus wear; per-line hours beyond D7's overnight on/off; undo across time | No lever ([K02](docs/history/salvage-matrix.md)); exploits ([EC-03](docs/history/lessons-ledger.md), [K22](docs/history/salvage-matrix.md)) | Later |
| Local lanes, a separate night palette, a third palette | [K36](docs/history/salvage-matrix.md), [RN-14](docs/history/lessons-ledger.md) | Light and dark ship (D13) |
| Pedestrians, diorama, landmark models | [SC-05](docs/history/lessons-ledger.md) | Landmarks 1.1+ |
| Steamworks SDK, achievements, Steam Cloud, disk saves | The demo needs none ([DP-09](docs/history/lessons-ledger.md)) | Full release (work May 10–Jun 13; D18, D22) |
| Accessibility browser gate; V1 save import | [UX-08](docs/history/lessons-ledger.md), [DP-08](docs/history/lessons-ledger.md) | Never |
| Audio; phones; regional rail, >3 overlays | [SC-08](docs/history/lessons-ledger.md) | Later |

**Call (D7): three headway periods per line.** Peak (06:30–09:30, 16:00–19:00) and off-peak (the rest of 05:00–24:00) always run, at most 60 minutes apart; overnight (00:00–05:00) runs no more often than off-peak, or not at all, so no night-only line exists (V2's midnight line paid +149% to +461%, [EC-03](docs/history/lessons-ledger.md)); each limit is a `sim/rules` predicate. Contracts, the report card and "needs N buses" read peak and off-peak. **Call: no per-bus wear;** it has no lever ([GD-03](docs/history/lessons-ledger.md)). **Call: express lines are in behind I3** ([EC-05](docs/history/lessons-ledger.md), [X-20](docs/history/lessons-ledger.md)); not green by Dec 6 means 1.1.

---

## 3. Core loop

**Second to second.** Buses glide, riders gather, cash ticks; the game starts paused ([UX-10](docs/history/lessons-ledger.md)).

**Minute to minute: six verbs**, each paying off within a game day ([GD-02](docs/history/lessons-ledger.md)): **draw or extend a line**; **share a stop** (within 250 m it joins, [EC-10](docs/history/lessons-ledger.md)); **set a headway** for peak, off-peak and overnight, and the game shows "needs 3 buses, you have 2" with the price ([GD-09](docs/history/lessons-ledger.md)); **set a fare** inside a printed band ([EC-09](docs/history/lessons-ledger.md)); **prune or upgrade a stop** flagged QUIET or LOSS ([UX-13](docs/history/lessons-ledger.md)); **place a depot** on the green tint, knowing dead-heading costs ([EC-13](docs/history/lessons-ledger.md), [UX-06](docs/history/lessons-ledger.md)).

**Session.** A quarter (8 game days, four to a year; D25) ends with a report card and a **Next quarter** preview ([UX-03](docs/history/lessons-ledger.md)).

**The first ten minutes in Boston** (playtest targets; V1 prices, [X-09](docs/history/lessons-ledger.md); head counts and cash illustrative until the bake)

| Time | What happens |
|---|---|
| 0:00 | Name, colour. The board opens paused and flat over Back Bay at zoom 14, every arterial named (local names from z14.5); chip "1/5 Place a depot" ([UX-07](docs/history/lessons-ledger.md)) |
| 1:00 | Legal land tints green, mostly industrial strips; card "Industrial ✓ · street 40 m ✓ · $150k" |
| 2:00 | "2/5 Draw a line" along Massachusetts Avenue: a 650 m walk ring, "≈9,000 people within a walk" |
| 3:00 | Four stops to the Longwood Medical Area. "Every 20 min needs 2 Sparrows · $190k" (the cycle function, 2026-10-13; the M2 spec): founding sets peak and off-peak alike, overnight off; about $71k left at k ≈ 1.2 |
| 3:30 | "3/5 Press play" at 05:00 on day 1. The bus pulls out; the 06:30 peak fills it |
| 4:30 | The compass (or `T`, or a double-click held) tilts the map: Back Bay rises around the bus; again to flatten. Nothing in the game changes |
| 5:30 | First daily close, every figure a ledger row ([AR-12](docs/history/lessons-ledger.md)); "QUIET · 3 boardings" |
| 7:00 | "4/5 Make a profitable day": prune the stop or nudge the fare |
| 8:00 | "5/5 Take a contract": "Every 15 min at Longwood, 8 days, $120k" |

No tutorial text: a profitable first line fits the starting cash and the best four-bus line does not ([GD-11](docs/history/lessons-ledger.md)). Inner Boston is roughly 7–10× as dense as V1's Riverton (estimate; [X-08](docs/history/lessons-ledger.md)), so prices stay V1's and `calib.tripScale` scales demand, set on the fixture in week 3 and re-measured on `city-boston-r1` in week 5.

**Goals.**
- **Contracts, three slots:** HEADWAY near a landmark such as Longwood or Kendall, and RIDERSHIP (150, 400 or 800 boardings a day), held a quarter (8 days) within two (16; D25) ([GD-04](docs/history/lessons-ledger.md)).
- **Events**, one at a time, hatched a day ahead: roadworks, festival, snow.
- **Report card:** Coverage by service ([EC-07](docs/history/lessons-ledger.md)), Reliability against the line's timetable ([K03](docs/history/salvage-matrix.md)), Comfort, Money ([EC-14](docs/history/lessons-ledger.md)).
- **Medals**, three for Boston; silver unlocks the Goliath. "Bronze unlocks the next city" returns with a second city.

**Call (D10): one failure floor with a way back.** Cash may go negative to a credit limit with one lender (V1's Talon & Grasp); five days below it ends the run, with a countdown chip and **Restart this quarter** from an automatic save. Sandbox turns failure off ([GD-06](docs/history/lessons-ledger.md)).

**Call: undo only while paused**, restoring cash exactly; refused with a reason once time has passed ([K22](docs/history/salvage-matrix.md), [UX-09](docs/history/lessons-ledger.md), [X-11](docs/history/lessons-ledger.md)).

**Pacing targets** ([GD-10](docs/history/lessons-ledger.md)), scripted in week 9: first line in 3–5 minutes; profit by 8; second line after 15–25; report card by 20; Boston's top medal in 2–4 hours.

**Call (D7): starting cash is derived:** k × a starter line's cost (a depot, four stops, the buses its daytime headways need), written once at founding as the first ledger row, so a retune never moves a save. k ≈ 1.2 gives V1's $310k ([X-09](docs/history/lessons-ledger.md)); week 9 tunes k within 1.0–1.8, held by I10 ([GD-11](docs/history/lessons-ledger.md)).

---

## 4. Scope by release

### Prototype: tagged Sun Dec 20 2026

Boston end to end, balanced, saved and onboarded, flat and tilted. **No new system after Sun Dec 6** (a system changes the sim's rules or money; UI, copy, art and tunables can still land).
- **Foundation:** CI, the Pages preview with its build chip; platform module; fixed-step worker sim; `{ok, reason}` commands; cent ledger; async saves with a schema hash ([AR-07](docs/history/lessons-ledger.md), [AR-13](docs/history/lessons-ledger.md), [K01](docs/history/salvage-matrix.md)).
- **World:** Inner Boston baked offline, about 800 cells at 350 m; the mini-Boston fixture; the detailed map; hourly congestion by road class in the sim ([EC-15](docs/history/lessons-ledger.md), [R10](docs/history/salvage-matrix.md), [AR-04](docs/history/lessons-ledger.md)).
- **Economy:** uncapped demand; **income from week 3**; per-km, wage, upkeep and deadhead costs; headway per period → buses → purchase; derived starting cash; fare bands; stop tiers and flags; transfers ([K04](docs/history/salvage-matrix.md), [K05](docs/history/salvage-matrix.md), [EC-10](docs/history/lessons-ledger.md)).
- **Goals and failure:** report card; HEADWAY and RIDERSHIP contracts; events; medals; credit line, floor, restart.
- **Player tools:** calm shell; line tool with remove, extend, insert; depot tint; undo; slots, autosave, export; the 2D/3D control; the light theme; express behind I3.
- **Onboarding:** Home, founding, checklist (week 6), pacing ladder ([UX-07](docs/history/lessons-ledger.md)).
- **Tests:** invariants, sweep, balance bands, bake gates, bench, e2e smoke ([EC-12](docs/history/lessons-ledger.md), [TS-06](docs/history/lessons-ledger.md)).

**Call: every bus type, event kind and route edit lands before the cutoff** ([SC-08](docs/history/lessons-ledger.md)): Sparrow (28 seats, $95k), Metro 40 (70, $260k), Goliath (115, $440k) are config rows ([C01](docs/history/salvage-matrix.md)), all in the sim in week 5, so no cut can strand finished art; art is not a system.

### v1.0 complete on the preview: Jan 4 to Feb 7 2027

Models, content and look only: the artist's three families as 3D models at close zoom (lazy three.js, proven in week 5; cut 3); the dark theme (§8); splash, bus wipe, day/night tint, dusk lights, report-card stamp ([S18](docs/history/salvage-matrix.md)); help, settings, accessibility; a credits screen; close-zoom lane markings (§8 rule 9), January's first cut. Complete means game-complete; you may `/ship 1.0.0`, which publishes nothing new.

### Next Fest demo: in review Mon May 3, public Mon May 24, fest Jun 14–21 2027 (D18)

A free Steam demo app for macOS and Windows (§6), built from `main` after v1.0 with a demo flag: the cut is a count and a card in the UI ("Wishlist interbus", opening the store page through §6's link allowlist), Export session stays in so bug reports replay at their commit, and I16 proves no sim rule changes. **What it holds, and any trailer, wait until the game is under way (D19, deferred):** revisit Dec 20, decide by Feb 28; the starting point is the first two quarters of Inner Boston, about 40 minutes. Until the repo goes private on Sun Mar 14, a week before the store page is public, what the demo holds back is playable free on the preview; after that, D20 (preview) decides.

### Full Steam release: Tue Jun 29 2027, about a week after the fest (D22)

The only public release, about US$10 (D4), on macOS and Windows (D15): Steamworks and achievements from medals; disk saves with Steam Cloud, migrations and update tests (D12); the release checklist; a trailer if D19 wants one. About 3.75–6.25 sessions from May 10, or 3.25–5.25 if the trailer comes by Apr 18 instead, nearly all before the release build goes into review on Mon Jun 14, the fest's first day (D22). It releases inside the Summer Sale, so it cannot join that sale; a launch discount of 7–14 days may run into it (§11).

### After v1.0 (ordered)

A second real city; all of Boston with variable 350/700 m cells; the artist's landmarks; per-line hours beyond D7's overnight on/off ([EC-03](docs/history/lessons-ledger.md)); undo across time; player-built bus lanes, painted red (the city's only ones, D17); real commute flows instead of gravity; a keyboard map cursor ([UX-11](docs/history/lessons-ledger.md)).

---

## 5. World: Boston first

**Decided (D1): real cities first; Boston is the first and test city.** Procedural generation survives only as test fixtures. The design answers V1's pipeline failures ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md), [WD-04](docs/history/lessons-ledger.md), [WD-11](docs/history/lessons-ledger.md)).

**Call (D11): bake "Inner Boston" first**: the land of Boston, Cambridge, Somerville and Brookline inside lon −71.16…−70.98, lat 42.315…42.405. Measured on Overture Maps release 2026-09-23.1 (OSM-derived; land areas match the census within 1%):

| Extent | Land | Buildings | Cells at 350 m | Street nodes, collapsed |
|---|---|---|---|---|
| **Inner Boston** | 94 km² | 80,145 | 790–840 | 9,330–9,953 |
| R2, a larger box | 105 km² | 89,182 | 890–935 | 10,813 |
| Boston city limits | 124.5 km² | 105,603 | 1,030–1,110 | 11,390 |
| V3's 20 × 16 km box | 229 km² | 205,096 | 1,910–2,000 | 21,144 |

Inner Boston keeps the crossings, Longwood, Kendall, Logan and downtown, with 20% headroom under the 1,000-cell cap and 42% under the 16,000-node cap ([WD-09](docs/history/lessons-ledger.md), [AR-15](docs/history/lessons-ledger.md)); Boston's city limits would break the cell cap and leave Cambridge a grey void. R2 needs recompute ≤100 ms p95 with three periods (D11). **The extent flexes; Boston stays** (§10's Nov 8 trigger); beyond it the board fades to grey, as in V1.

**Sources: static files only, no API, no key**, so V1's quota pages, rate limits and missing CORS cannot recur.

| Layer | Pinned source | Use |
|---|---|---|
| Residents | 2020 block counts (`POP20`) in TIGER/Line `tabblock20` ([files](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.2020.html)) | Residents and dot sub-points |
| Workers, jobs, commutes | LODES 8.4, year 2023, on the same 2020 blocks ([LODES8](https://lehd.ces.census.gov/data/lodes/LODES8/)) | Jobs by sector, inbound commuters, the gravity β fit |
| Municipalities | TIGER/Line 2020 county subdivisions, the boundaries the 2020 counts are tabulated on; the LODES crosswalk's municipality codes are not 2020's (DECISIONS, measured) | Each block's municipality for G4; the extent polygon |
| Streets, depot land, lane tags | One dated Geofabrik Massachusetts `.osm.pbf`, ~292–296 MB ([page](https://download.geofabrik.de/north-america/us/massachusetts.html)), via osmium | The sim graph, and from week 3 the tiles |
| Map | Week 1 a cut of a pinned Protomaps build; from week 3 Planetiler on the same extract ([docs](https://docs.protomaps.com/basemaps/build)) | The 2D/3D map |
| Heights | OSM height, else levels × 3.2 m + 1 m, else a type default; Overture's lidar heights (93–95% coverage, measured) join r1 if under about half the buildings carry tags (week-2 count) | Extrusions |
| MBTA GTFS, ridership | Bake-time calibration report only, comparing modelled demand with real ridership; never drawn, simulated or shipped (D17; revocable licence) | Sanity check |

**Call: 350 m square cells, about 800, built from 2020 blocks** on the ids LODES joins. Each cell holds residents, workers, jobs by sector, inbound commuters and up to 8 weighted sub-points, so dots sit where people live and catchments sum sub-points, not a centroid ([EC-15](docs/history/lessons-ledger.md), [WD-06](docs/history/lessons-ledger.md)). Logan and the main road entries are gateways. With no transit (D17) the bus–car–walk choice starts from scratch; r1 checks the no-car share against ACS. V1's gravity and visitor matrices stay ([R01](docs/history/salvage-matrix.md)); M1 uses V1's β, r1 fits β to LODES. Paths are searched once and shared; only the logit and assignment repeat per period: one period at ~800 cells interpolates to 50–130 ms ([AR-07](docs/history/lessons-ledger.md)), and the week-3 bench measures all three.

**The bake** (`tools/bake/`, a port of V1's pipeline).
- **Fetch**, the only step that touches the source servers, hashes inputs into `sources.lock.json` and mirrors them to a GitHub Release; if the servers refuse GitHub's runners, you run `npm run bake:fetch` once (about 30 minutes).
- **The full bake** is a manually dispatched Actions job reading only the mirror, on two runners whose hashes must match. It publishes `sim.json`, the `.pmtiles` map and a report as release `city-boston-r<N>`.
- **PR CI** bakes only the committed mini-Boston fixture in under 30 s: every input clipped to lon −71.11…−71.07, lat 42.335…42.36 (3.3 × 2.8 km, Back Bay to Longwood). Economy and e2e tests and **M1** run on it.
- **The deploy** downloads the files named in `cities/index.json`, checks SHA-256 and **fails** if one is missing; it never bakes. Bake and game read that one list ([K18](docs/history/salvage-matrix.md)).

**Pack: two files per city.** `sim.json` (JSON format 1; degree-2 collapse; no service roads in the routable graph) holds streets, cells, gateways, depot land and `calib`, ≤1 MB gzip (the street graph measured 208 kB). The `.pmtiles` map: hard gate ≤40 MB, target ≤15 MB, largest tile ≤200 kB (z12–14 measured 4.0 MB gzip with a test encoder). Both have content-hashed URLs and no IndexedDB cache ([WD-04](docs/history/lessons-ledger.md)). **Format 1 freezes Sun Nov 8.** Saves record city, revision and hash and anchor stops by place ([WD-10](docs/history/lessons-ledger.md)); a missing pack is a readable refusal, never a substitute city (week 5, with an r1→r2 save test). Rebakes follow `CLAUDE.md`.

**Bus access.** The routable graph honours `bus`, `psv`, `motor_vehicle`, `vehicle` and `access`, in that order, and `maxheight` under 3.5 m. `adjust.json` closes the parkways closed to buses by name: DCR's "cars only" River Roads, Storrow Drive, Soldiers Field Road and Memorial Drive. `hgv=no` is a truck exclusion and leaves a street open to buses (changed 2026-10-13: it closed 353 Inner Boston ways, Summer Street and Columbia Road among them; DECISIONS, Measured). The report lists every excluded road; a fixture test keeps lines off the River Roads.

**No existing transit (D17).** The bake strips every public-transport feature from the sim graph and the tiles: bus lanes (`busway=*`, `lanes:bus`, `bus:lanes`, the `psv` forms) become general lanes; bus-only streets open to all; busways, stops, stations, shelters, transit and ferry `route=*` relations and every `railway=*` feature go. Lane, `oneway`, `turn:lanes`, crossing and signal tags stay for §8 rule 9. **G10** fails the bake if any transit feature survives, and a fixture test bakes a Back Bay bus lane as general lanes.

**Bake gates** (the bake refuses to write and names the number): G1 400–1,000 cells; G2 ≤16,000 nodes, one component with ≥98% of drivable km; G3 ≥99% of residents within 300 m of a street; G4 Σ `POP20` over Boston = 675,647 exactly, catching V1's 12-digit join bug; G5 geography sanity (no residents in water, Logan holds the airport gateway); G6 map and demand agree; G7 sizes; G8 two-runner determinism; G9 load ≤300 ms; G10 no transit feature in either file (D17).

**If a dataset fails:** servers refuse CI → your one local fetch; a source rolls over → re-pinning is a deliberate PR; the Protomaps build disappears → Planetiler, or at worst V1's offline style (`Intralines@7af45b1:src/map/basemapStyle.ts:375-547`); few height tags → the r1 height join; over a cap or 150 ms → stay at Inner Boston; pack not green by Nov 8 → the core box (§10); tiles over budget → a slim Planetiler profile; demand wrong where players know the city → per-cell overrides in `adjust.json`, listed in the report.

**Balance.** Inner Boston holds roughly 0.6–0.7 million residents (estimate), about five times Riverton's 128,010. **Boston is the reference city for every balance band.**

**City invariants (I10):** the same inputs give the same bytes; one connected network; ≥90% of built-up street nodes within 650 m of a populated cell; a stop with residents within 300 m draws riders within a game day ([K24](docs/history/salvage-matrix.md)); the sweep's best profitable first line, found without the reference line, fits the starting cash and profits within a quarter (shown failing with a losing fare); its best four-bus line costs ≥1.15× the starting cash; k stays in 1.0–1.8 ([GD-11](docs/history/lessons-ledger.md)).

**A second city** takes one or two Claude-weeks; non-US cities lack LODES.

---

## 6. Architecture and tech stack

**Call: one renderer, MapLibre GL JS pinned exactly at 6.11.2** (WebGL2; [CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)): one camera, flat and tilted. V3's three.js scene ([R13](docs/history/salvage-matrix.md)) had no tile pipeline and cost a 2.93× critical path ([RN-03](docs/history/lessons-ledger.md)), so there is no renderer fallback. **No renderer change after Sun Nov 1, including the custom-layer interface (every bus, icon or mesh draws in one MapLibre custom layer); never two renderers.** three.js 0.186.1 draws only the artist's models there, lazily; the game runs without it. A week-5 proof behind a flag draws the `metro-40` blockout as one instanced mesh and measures chunk size and frame rate.

**Stack.** Strict TypeScript, Vite, React 18 for chrome only, MapLibre in a lazy chunk (about 430 KiB gzip with its worker, measured), `pmtiles` 4.5.0, a style built from `@protomaps/basemaps` 5.7.2, Vitest, pinned Playwright ([K53](docs/history/salvage-matrix.md)), self-hosted Afacad Flux (§8), GitHub Actions; no PWA plugin. Pins are the newest releases at least two weeks old ([npm registry](https://registry.npmjs.org/), publish dates checked 2026-10-12): maplibre-gl 6.11.2 (2026-09-24), pmtiles 4.5.0 (2026-08-10), @protomaps/basemaps 5.7.2 (2026-03-10), three 0.186.1 (2026-09-24).

**The map.**
- **City files.** `CityTileSource` reads tiles by HTTP Range from the content-hashed file, with ordinary caching and no Cache Storage copy; if Pages refuses Range (week-1 check), it downloads the whole file; the desktop reads it whole.
- **2D and 3D.** In 2D buildings are flat footprints with a hairline outline; in 3D, extrusions, cross-faded once per mode change ([RN-04](docs/history/lessons-ledger.md)). From week 2 `T` sets pitch 50° (a raw tilt); the chip, cross-fade, right-drag and the snap flat below 12° land in week 10. Since D25 the chip is a compass, a double-click held tilts or flips the board, and 3D turns freely (drags, Q and E; N faces north) while 2D always faces north. 3D allows 25–60° at zoom ≥14. Bounds are the extent plus 1.5 km behind V1's board mask (`Intralines@7af45b1:src/map/overlays.ts:55-114`).
- **Buses.** One custom vehicle layer from week 4, the code-drawn glyph first: top-down instanced icons in one draw call, flat to the screen when tilted, at least 20 px long (Sparrow), 24 (Metro 40) and 32 (Goliath) ([RN-05](docs/history/lessons-ledger.md)). **Meshes replace icons only in 3D at zoom ≥17**, where a Sparrow is 19 px at true scale; at zoom 15 it would be 5 px, V3's failure again. A mesh draws at the larger of true scale and its icon length, at most 2.5×, one draw call per family. Positions come from V3's pure `busPositionAt` ([S03](docs/history/salvage-matrix.md)); no per-frame GeoJSON source, which lags the clock.
- **No GPU.** Since Chrome 139, machines without a usable GPU get no WebGL at all ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM/m/oLrB5up_BwAJ)). The ladder: hardware; **Low graphics** (2D only, 30 fps); a calm "turn on hardware acceleration" card, saves and Export intact.

**Platform seams** (D3, D15). Only `src/platform/` touches browser storage, fullscreen, external links, reloads, `version.json` or Electron's preload bridge (a lint rule); a build alias picks `web/` or `desktop/`. It holds an **async `SaveStore`** whose export file equals a desktop save, the city file source, allowlisted links, quit hooks (never bind Shift+Tab), the theme setting and the **build chip**'s SHA. The web flavour has no service worker or Cache Storage (D12); a failed chunk, worker or tile read shows "This build was replaced · Reload". **`desktop/` lands after v1.0, from Feb 8, at demo size (D18):** browser storage under the fixed origin `app://game` (the demo with its own app name and userData path, apart from the full game's), the city file read whole into a Blob, allowlisted links through IPC, quit, full screen, pause when hidden. Disk saves, Steam Cloud and the Steamworks binding wait for the full release (from May 10), behind a build flag the demo build turns off, so a fest hotfix from `main` never ships them (I16).

**The desktop shell (D15).** V1's Electron `app://` shell ([S19](docs/history/salvage-matrix.md)) with six fixes: quit when the window closes on every OS; links only through the allowlist, an `app:`-only CSP, navigation blocked, permissions denied; a production menu without DevTools; one instance; `app://game` frozen forever, since saves live under it. `desktop/build.mjs` drives `@electron/packager` and `@electron/fuses`: **one universal macOS app** (≈549 MB on disk, 225–230 MB to download, measured on Electron 44.7.0; re-measured on Feb 8 with the newest stable at least two weeks old, then pinned), hardened runtime, notarized and stapled, the demo with only the `allow-jit` entitlement (the full release adds what the overlay and Steamworks need, re-proven by Jun 13, before the release build goes into review, in its 0.25–0.75-session Mac check); **an unsigned Windows x64 folder** (386 MB), which Steam reportedly runs without a warning (community reports, [Godot forum](https://forum.godotengine.org/t/i-have-a-problem-and-i-need-your-help/6462); unverified, check before relying on it). Minimums: macOS 13, Windows 10 64-bit ([Electron](https://github.com/electron/electron/blob/main/README.md)).

**Module layout**
```
src/sim/       pure TS in the worker; no DOM, React, MapLibre, Date or Math.random
  config/ core/ rules/ commands/ city/ demand/ traffic/ fleet/ economy/ goals/ events/ save/
  step.ts      simStep(), the only door that advances time (AR-09)
src/worker/    fixed-step host, snapshots, command log
src/render/    style/ tiles/ camera/ vehicles/ overlays/; reads snapshots only
src/platform/  types.ts, web/, desktop/, memory/; the only door to host APIs
src/ui/        React shell, cursor cards, menus; reason codes -> copy
desktop/       Electron main and preload, build.mjs; its own package.json (D15)
cities/        index.json; boston/ (city.json, extent, sources.lock.json, adjust.json)
tools/bake/    fetch, osm, census, tiles, pack, check; fixtures/
tools/models/  check.mjs, icon.mjs (written when the first model lands)
art/           the artist's deliveries in Git LFS; LICENSE.md, CREDITS.md
```

**Boundaries.** The worker owns state; commands apply at the next fixed step, so replays are exact. Cursor cards call the `rules/` function the worker re-checks ([K10](docs/history/salvage-matrix.md)); the renderer computes no game number ([AR-04](docs/history/lessons-ledger.md)); React never re-renders per frame ([AR-08](docs/history/lessons-ledger.md)); lint enforces the import fences. **Export session** writes the quarter-start save plus every command since, and the deterministic sim replays it ([AR-06](docs/history/lessons-ledger.md)).

**Save format.** V3's versioned envelope ([K11](docs/history/salvage-matrix.md)), intent only ([DP-05](docs/history/lessons-ledger.md)): city, revision and hash; `nextIds` for every kind ([K01](docs/history/salvage-matrix.md)); clock and RNG; stops by place; lines with three headways, depots, cash in cents, contracts, medals. No demand, geometry ([K12](docs/history/salvage-matrix.md)), camera or theme. **A schema-hash test fails CI on an unversioned schema change** ([SC-10](docs/history/lessons-ledger.md)). On a bump the preview and the demo set older saves aside under a backup key with a notice ([DP-06](docs/history/lessons-ledger.md)); the envelope and Export session record the build SHA, so a bug report replays at its commit. Migrations start with the full Steam release.

**Invariants that become tests**, each shown to fail with the old bug restored ([TS-04](docs/history/lessons-ledger.md)):

| # | Invariant | Kills |
|---|---|---|
| I1 | Cash = Σ ledger rows, the first being founding capital; the day card is ledger rows; retuning k between save and load leaves cash unchanged | [K40](docs/history/salvage-matrix.md), [AR-12](docs/history/lessons-ledger.md) |
| I2 | Adding a line, stop or bus never cuts linked trips by >0.1% | [EC-02](docs/history/lessons-ledger.md), [K04](docs/history/salvage-matrix.md) |
| I3 | Fare and headway have interior optima; express peaks below $5; starving a line earns ≤60% of the optimum; per period, riders boarding a line ≤ trips generated in that period's hours, and none board in a period it does not run | [GD-13](docs/history/lessons-ledger.md), [EC-05](docs/history/lessons-ledger.md), [EC-03](docs/history/lessons-ledger.md), [K28](docs/history/salvage-matrix.md), [K49](docs/history/salvage-matrix.md) |
| I4 | Splitting a line raises revenue plus subsidy ≤1% | [EC-04](docs/history/lessons-ledger.md), [K05](docs/history/salvage-matrix.md) |
| I5 | Every line at a 6-line hub boards riders | [K23](docs/history/salvage-matrix.md) |
| I6 | Cursor-card verdict equals command verdict; a bus loops in the billed cycle | [GD-05](docs/history/lessons-ledger.md), [K10](docs/history/salvage-matrix.md), [K07](docs/history/salvage-matrix.md) |
| I7 | Random create, delete, save and load never reuse an id | [K01](docs/history/salvage-matrix.md), [DP-04](docs/history/lessons-ledger.md) |
| I8 | N days in one call equal N days in 72 chunks; save-load-save is identical | [AR-06](docs/history/lessons-ledger.md), [K41](docs/history/salvage-matrix.md) |
| I9 | Undo refused after time passes; undo while paused restores cash exactly | [K22](docs/history/salvage-matrix.md), [TS-05](docs/history/lessons-ledger.md) |
| I10 | The §5 city invariants on Boston and the fixture | [K24](docs/history/salvage-matrix.md), [GD-11](docs/history/lessons-ledger.md) |
| I11 | Contract income over 10 seeds within ±30% of the median; no HEADWAY contract can be met by one period alone | [GD-04](docs/history/lessons-ledger.md), [EC-03](docs/history/lessons-ledger.md) |
| I12 | 1366×768, light theme, 50 buses of every family heading away from the camera, at three cameras: 2D zoom 14; the `T` default (zoom 14, pitch 50°); the mesh switch (zoom 17, pitch 60°). Each bus is at least its family's minimum (20, 24, 32 px) and the layer changes ≥200 px; a 4 px meta-test must fail | [RN-05](docs/history/lessons-ledger.md), [K46](docs/history/salvage-matrix.md), [TS-07](docs/history/lessons-ledger.md) |
| I13 | Chrome ≤6% at rest, ≤26% with a panel, at three laptop sizes, in each theme (dark from week 13); reason-code copy ≤8 words | [UX-01](docs/history/lessons-ledger.md), [K31](docs/history/salvage-matrix.md) |
| I14 | Recompute ≤150 ms p95 on Boston, three periods; gzip menu ≤200 KiB with fonts, board ≤520 KiB, model chunk ≤200 KiB (three.js and loaders measured about 160 KiB), loaded at the first tilted mesh switch; `chunkSizeWarningLimit` at its default; first frame ≤2.5 s on software GL; each style validates; no frames while paused | [AR-07](docs/history/lessons-ledger.md), [AR-18](docs/history/lessons-ledger.md), [K21](docs/history/salvage-matrix.md), [RN-04](docs/history/lessons-ledger.md) |
| I15 | E2E on every PR: found, depot, draw, run a day, check cash, reload, compare; a tab of build A, after build B deploys, loads every lazy chunk and a tile read without error | [TS-06](docs/history/lessons-ledger.md), [DP-01](docs/history/lessons-ledger.md) |
| I16 | Parity: switching 2D/3D or theme changes no number, save byte or verdict, and every layer and bus draws in all four; the demo flag on or off gives identical sim bytes, ledgers and verdicts over the demo's days (D19), failing if a flag check reaches `src/sim`; the demo's desktop build has no Steamworks module and saves only in browser storage | [GD-05](docs/history/lessons-ledger.md), [AR-04](docs/history/lessons-ledger.md) |
| I17 | Bake gates G1–G10; the fixture bakes twice to its golden hash | [WD-03](docs/history/lessons-ledger.md), [WD-09](docs/history/lessons-ledger.md) |
| I18 | Each model passes `check.mjs`; all v1.0 models ≤600 KB; bad fixtures fail | [RN-07](docs/history/lessons-ledger.md) |
| I19 | Host APIs only in `src/platform/`; no build, web or desktop, has a service worker or fetches an outside URL; allowlisted links (the store page, OSM's copyright) are exempt | [DP-09](docs/history/lessons-ledger.md), [K15](docs/history/salvage-matrix.md) |

**Budgets on real laptops** (weeks 4, 7, 10; your Mac in week 9 in stable Chrome, and in the packaged app from Feb 8): 2D ≥55 fps on yours and ≥30 on the slowest with 200 buses; 3D at zoom 17, pitch 60, ≥30 fps (on a Retina Mac, cap MapLibre's `pixelRatio` in 3D first); ≤7 vehicle draw calls; ≤10% heap growth over 30 minutes.

**CI and deploy.** The adversarial sweep runs on Boston and the fixture ([EC-12](docs/history/lessons-ledger.md)); "daytime longest, overnight shortest" and "overnight alone" must earn less than the best all-period setting, shown failing with V2's whole-day ridership restored ([EC-03](docs/history/lessons-ledger.md)); stop capacity and spill are per period. Economy PRs quote before and after ([PR-02](docs/history/lessons-ledger.md)).
- **PR checks, 8 minutes:** typecheck, lint, tests, schema hash, bundle budget, outside-URL check ([S20](docs/history/salvage-matrix.md)), `bake:fixture`, style, palette and contrast tests on each theme that exists (light from week 1, dark from week 13; [S21](docs/history/salvage-matrix.md)), I12, changelog check, smoke with axe-core, art check, a 60-second sweep. Slower checks go nightly and never block ([UX-08](docs/history/lessons-ledger.md)).
- **Nightly:** full sweep, bench, `npm audit`, the MBTA realism report; from Feb 8 the Electron shell's smoke, and from March both desktop apps packaged unsigned, the Windows one smoke-tested on `windows-latest`, uploading nothing, since anyone signed in can download a public repo's artifacts ([GitHub docs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)).
- **Desktop jobs, dispatch only, actions pinned by SHA.** `desktop-sign` (certificate and notary key; `main` and `desktop/*`; no reviewer) signs, notarizes (98% within 15 minutes, 75 a day; [Apple](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)), staples, runs `spctl` and uploads nothing. Your legal name, which the Developer ID certificate carries (D21 (a)), is a secret in both jobs, so the log masks it where `codesign` and `spctl` print the signing identity. `desktop-release` (Steam credentials and its own signing secrets; `main` only; you as required reviewer) alone runs `steamcmd`, inside the macOS job that signed, as zips and Windows hosts break Electron's framework symlinks ([steamworks.js #194](https://github.com/ceifa/steamworks.js/issues/194)). CI uploads and sets builds live only on password-protected beta branches; only you set a build live on a default branch.
- **Deploy:** every merge to `main` deploys the preview until the repo goes private on Sun Mar 14 2027 (D20); D20 (preview) says what replaces it. Tags publish nothing. The deploy keeps the last two deploys' hashed `assets/` and city files (V1's `retain-assets.mjs`, §7), admits only `main` with no cancelling ([DP-02](docs/history/lessons-ledger.md)), and passes when the live chip, `version.json?run=<run_id>` and `GITHUB_SHA` agree. **`main` is protected** (§14 item 2): merge commits only. LFS before the first binary ([PR-07](docs/history/lessons-ledger.md), [DP-11](docs/history/lessons-ledger.md)).

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
| tsconfig, CI | PORT [S09](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:.github/workflows/ci.yml` | Pinned browser ([K53](docs/history/salvage-matrix.md)) |
| Loop, RNG, graph, A*, offline audit, palette maths | PORT [S11](docs/history/salvage-matrix.md), [S12](docs/history/salvage-matrix.md), [S20](docs/history/salvage-matrix.md)–[S22](docs/history/salvage-matrix.md) | `Intralines_City_dep@archive/intralines-city-v1:Gaming/{src,tools}/` | Loop in the worker |
| Geo, icons, splash, wipe | PORT [S15](docs/history/salvage-matrix.md), [S18](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/geo.ts`, `src/ui/{icons.tsx,BusWipe.tsx}` | One geo module; tokens ([RN-08](docs/history/lessons-ledger.md)) |
| Map style, board | REWRITE-FROM [R12](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/map/basemapStyle.ts:9-32, 262-283`, `src/map/overlays.ts:55-114` | V1's hues as light tokens, the board mask, the zoom ramp; Afacad Flux glyphs; style tests on each theme ([K21](docs/history/salvage-matrix.md)) |
| Art pipeline | REWRITE-FROM, when a file lands | `Intralines@7af45b1:scripts/check-models.mjs`, `Intralines_City@dc63602:scripts/models/build.ts` and the rest in [MODELS.md](docs/art/MODELS.md) §13 | glTF axes; instancing, not per-bus clones ([K09](docs/history/salvage-matrix.md)); no KTX2 or auto-decimation |
| Demand model | REWRITE-FROM [R01](docs/history/salvage-matrix.md)–[R03](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/sim/demand.worker.ts`; V2 `Gaming/src/30-sim.js` | No caps ([K04](docs/history/salvage-matrix.md), [K23](docs/history/salvage-matrix.md)); per-boarding fare ([K05](docs/history/salvage-matrix.md)); hourly crowding ([K27](docs/history/salvage-matrix.md)); captive ceiling ([K28](docs/history/salvage-matrix.md)); linked trips ([K47](docs/history/salvage-matrix.md)); 130 m radius ([K50](docs/history/salvage-matrix.md)) |
| Fares, express | REWRITE-FROM | V2 `Gaming/src/30-sim.js:70-103, 2636-2662`; `Intralines@7af45b1:src/game/constants.ts:397-412` | Taper ([K49](docs/history/salvage-matrix.md)); starters are not express ([K16](docs/history/salvage-matrix.md)) |
| Headway, fleet, report card | REWRITE-FROM [R04](docs/history/salvage-matrix.md), [R05](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/constants.ts:310-387`, `src/game/store.ts:403-520` | Buses cost money ([K42](docs/history/salvage-matrix.md)); real reliability ([K03](docs/history/salvage-matrix.md)) |
| Traffic | REWRITE-FROM [R10](docs/history/salvage-matrix.md) | V2 `Gaming/src/20-city.js:1387-1490` | One `congestionAt()` for timing and ridership ([K06](docs/history/salvage-matrix.md)) |
| Contracts, events, undo, route edits, transfers | REWRITE-FROM [R06](docs/history/salvage-matrix.md), [R08](docs/history/salvage-matrix.md), [R09](docs/history/salvage-matrix.md) | V2 `Gaming/src/30-sim.js:4576-4972`, `Gaming/docs/design/` | Bounded variance ([GD-04](docs/history/lessons-ledger.md)); no sim snapshots ([K22](docs/history/salvage-matrix.md)); buses anchored ([K32](docs/history/salvage-matrix.md)) |
| Shell, menu, founding | REWRITE-FROM [R07](docs/history/salvage-matrix.md), [R11](docs/history/salvage-matrix.md) | V2 `Gaming/docs/design/screen-layout.md`; `Intralines@7af45b1:src/ui/` | Labelled chips ([K20](docs/history/salvage-matrix.md)); one draft preview ([K10](docs/history/salvage-matrix.md)) |
| Deploy asset retention | PORT, week 1 | `Intralines@7af45b1:scripts/retain-assets.mjs` (`d66e6dc`, 73 lines) | Also keeps the previous city files; the matrix dropped it for V3's PWA, which D12 drops |
| Electron shell | PORT [S19](docs/history/salvage-matrix.md), from Feb 8 (D15, D18) | `Intralines@7af45b1:electron/main.cjs` (69 lines) | Sandbox kept; §6's six fixes; packager, not electron-builder installers; the SHA as build id; no service worker ([K15](docs/history/salvage-matrix.md)) |
| Harness seeds | Rebuild as tests ([T01](docs/history/salvage-matrix.md)–[T07](docs/history/salvage-matrix.md)) | Salvage matrix §B5, if handed over | Named tests as systems land ([TS-08](docs/history/lessons-ledger.md)) |
| DROP | — | V1 store, panels, mesh layer, recovery layers but asset retention, pack cache, online tiles, city generator; V2 UI and company type; V3's PWA ([S08](docs/history/salvage-matrix.md), D12), three.js scene and model pipeline | [K09](docs/history/salvage-matrix.md), [DP-01](docs/history/lessons-ledger.md), [WD-04](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md) |

---

## 8. Look, feel and UX

**Decided (D8): "sleek but detailed and intricate." Call: quiet base, loud data.** The whole real city is drawn in low-chroma tones with fine linework; saturated colour is reserved for what the player builds. Subway Builder does this ([review](https://punishedbacklog.com/subway-builder-review/)), and Protomaps' light flavor builds road hierarchy from width, not hue ([flavors.ts](https://github.com/protomaps/basemaps/blob/main/styles/src/flavors.ts)). V1's identity ([RN-08](docs/history/lessons-ledger.md)) carries over as a hue family and the board.

**Style rules** (palette and contrast tests enforce them on each token set, [S21](docs/history/salvage-matrix.md)):
1. Base colours at OKLCH chroma ≤0.04 (water ≤0.07); game colours ≥0.12; contrast holds in both themes.
2. Road hierarchy by width and casing in five classes (in light, white streets and pale amber arterials), casings from z14.
3. Intricacy from hairlines that arrive with zoom: the street grid at overview, building outlines, shorelines and cased bridges from z15, footpaths from z16, lane markings from z17 (rule 9).
4. Buildings: in 2D a fill a notch off the land tone with an outline; in 3D a warm-to-cool height ramp with a vertical gradient. Land use tints the ground (parks, water, campuses, industrial land), never the buildings.
5. One typeface, **Afacad Flux** (D13), OFL 1.1 ([google/fonts](https://github.com/google/fonts/tree/main/ofl/afacadflux), checked 2026-10-12), self-hosted as two static Latin woff2 files (400 and 600, about 23–29 KB together, measured) that also feed MapLibre's glyphs (§14 item 4). 10–14 px; neighbourhoods letter-spaced capitals; arterial names from z13, local from z14.5; basemap POIs off except hospitals and universities.
6. No existing transit is drawn (D17): no rail or subway lines, stations, bus stops, bus lanes or ferry routes; former rail corridors read as plain ground. No MBTA colours, logo or branding anywhere.
7. Data layers flat and unlit; buildings and vehicles inside a 0.75–1.15 lighting envelope ([RN-06](docs/history/lessons-ledger.md)).
8. **Light and dark (D13): one generator, two token sets**; the system setting picks, a toggle overrides. No night palette ([RN-13](docs/history/lessons-ledger.md), [RN-14](docs/history/lessons-ledger.md)): the day/night tint runs in light, faint or off in dark, so the clock chip names the period and a line with overnight off fades while stopped. Bus ink, halo and line colours are theme tokens in all three tested states. Dusk lights come from the models.
9. **Lane markings at close zoom** (z≥17), render-only from tags the bake keeps: dashed dividers by OSM `lanes` (else inferred from road class), double centre lines, zebra crossings and stop bars, short of junctions. January's first cut.

**Starting light tokens** (proposal): land `#ebe7df`, void `#d6d2c9`, buildings `#dcd6ca` outlined `#cfc8ba`, water `#b6d4e8`, parks `#d5e4c6`, streets cased `#cfc8ba`, arterials `#f9e9c8` cased `#e3c48d`, labels `#5c574d`. **On Sun Nov 8 you pick these or pure V1 paper**, side by side on Boston, with the network hues checked against it and a placeholder dark land.

**The chrome** stays flat and crisp, after V3's labelled chips (`Intralines_City@dc63602:src/ui/TopBar.tsx:73-79`); no emoji ([UX-10](docs/history/lessons-ledger.md)); a side-by-side with V1 at every milestone. **Call: the shell is measured from the first screen**, its chip row in week 1, all of it in week 4 ([UX-02](docs/history/lessons-ledger.md), [SC-04](docs/history/lessons-ledger.md)).

**Screen budget (I13).** Chrome ≤6% at rest and ≤26% with a panel at 1440×900, 1366×768 and 1152×720; the compass, the demand chip and the 12 px build chip (in the OSM-attribution corner) count. Labelled chips: date, speed, Cash, Riders/day, Grade, Contracts ([K20](docs/history/salvage-matrix.md)). A dock of ≤8 slots. No inspector at rest; notices in one corner ([UX-05](docs/history/lessons-ledger.md)). At most three overlays: Residents, Jobs, Traffic ([UX-12](docs/history/lessons-ledger.md)).

**Rules drawn on the map**, each from its `sim/rules` predicate ([GD-05](docs/history/lessons-ledger.md)): the depot tint; the 650 m walk ring; a 250 m snap ring ("joins Mass Ave · transfer"); express chevrons; QUIET/LOSS as icon and word; contract rings with progress; events hatched a day ahead; ribbon width by frequency, dashes as well as colour ([RN-09](docs/history/lessons-ledger.md)); refusals in money, "$55k short" ([UX-03](docs/history/lessons-ledger.md)).

**Copy (D25).** Every heading, button, label, option, column, caption, tooltip and accessible name starts with a capital, a digit or a sign; no word shouts in capitals but 2D and 3D; apostrophes are curly; what runs on after a colon or a middot stays lower case unless it is a name (Day 4, Line 2, a bus, a landmark). Players read US spelling. `src/ui/copyRules.ts` holds the rules, and `e2e/copy.spec.ts` reads every screen from Home to a day's close against them.

**Call: bus icons are rendered from the artist's models:** CI renders each model straight down into a mask the game paints with company and line colour, so 2D and 3D match; hence the roof stripe ([docs/art/MODELS.md](docs/art/MODELS.md) §4). Until the first blockout a code-drawn top-down glyph stands in, never upside down westbound like V1's; I12 holds the minimum lengths ([RN-05](docs/history/lessons-ledger.md), [TS-07](docs/history/lessons-ledger.md)).

**Charm: one or two moments per milestone** ([GD-08](docs/history/lessons-ledger.md)), cut one by one if late. **Accessibility, proportionate** ([UX-08](docs/history/lessons-ledger.md)): shape plus colour, keyboard shortcuts, 24 px targets, chrome text ≥12 px at 1280×800 (Steam Deck needs it later), reduced motion, axe-core.

---

## 9. How the team works

**Roles** (decided D6).
- **You: owner and lead player.** You decide scope, look and title; start Claude sessions; play each milestone; review each art delivery (about 30 minutes, five times; [docs/art/MODELS.md](docs/art/MODELS.md) §5). You alone create versions and, **holding the Steamworks and Apple accounts as an individual trading as Miticept Studios (D21 (a))**, approve the store copy Claude drafts, register for the fest, play every demo build on your Mac while the artist plays it on the artist's Windows PC (D21 (b)), set Steam builds live and press Release.
- **The artist (the co-developer): the 3D models the game uses and the Steam store art.** `metro-40`, `sparrow` and `goliath`, then a depot, to [docs/art/MODELS.md](docs/art/MODELS.md), a draft the artist amends by Sun Oct 18; after v1.0, **the capsule set by Sun Feb 21 and library and demo art by Sun Apr 11** (6–12 hours), and from the Steam round trip (by Apr 11) every demo build installed from Steam and played on the artist's own Windows PC (D21 (b)); landmarks later; milestone playtests on a second machine, except M4, so P2 finds the artist fresher ([TS-10](docs/history/lessons-ledger.md)). No delivery falls on a playtest date.
- **Claude:** code, tests, docs, a one-page summary per milestone, at most five questions a week ([PR-03](docs/history/lessons-ledger.md), [PR-05](docs/history/lessons-ledger.md)).

**How art flows.** The artist opens a PR under `art/models/` with Git LFS (D6); from week 5 CI checks it and renders the icon, and you review it. A failing file never reaches players: the game keeps the latest passing file, else a built-in box bus.

**Ownership (D14; [docs/art/MODELS.md](docs/art/MODELS.md) §12).** Copyright in the game, art included, is held by Miticept Studios, the two of you jointly; `art/LICENSE.md` says so by Oct 18. **The code stays all rights reserved, its source visible while the repo is public; the art is under CC BY 4.0 with the credit "Miticept Studios" (D20)**, and the repo goes private on Sun Mar 14 2027, a week before the store page is public. You both sign D14's short agreement, the art's licence included, by Sun Feb 21, a week before the store page. Not legal advice.

**Capacity.** You give 2–4 hours a week, plus about 18–31 hours of Steam work from January to June (§11), less the Windows plays, now the artist's (D21 (b)); the artist's are not tracked. **One Claude-week ≈ 2.5 sessions of 2–4 hours**, each ending in one or two merged PRs: 5–6.5 a week to Dec 20, about twice the old pace (unproven estimate), 2–5 in January and half weeks, then about 12–15 for Steam (§10). Velocity is checked Oct 18, Oct 25 and Nov 1 (§10); if lower, the cut list moves.

**Claude session rules** live in `CLAUDE.md` ([PR-08](docs/history/lessons-ledger.md), [PR-11](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)).

**Call: only you create versions** (CL, [PR-15](docs/history/lessons-ledger.md)): `/ship <version>`, typed by you; a player-visible change adds a line under Unreleased in the same commit; milestone tags such as `prototype` never start with `v`; a version publishes nothing new, and a Steam upload never creates one (`CLAUDE.md` has the rules for Steam builds and the demo).

**Done.** A PR is green, updates the docs it touches ([PR-06](docs/history/lessons-ledger.md)) and is live, its SHA on the preview's chip and in `version.json`; a milestone also needs your play notes in `docs/playtests/`, citing the SHA ([PR-13](docs/history/lessons-ledger.md)).

**Call: playtests take a middle path; you and the artist test** (D6). Each milestone, each of you checks for 10 minutes: what did you try, where were you stuck, what was dull or ugly, is it Boston? **P0** this week: V1, 30 minutes each ([GD-07](docs/history/lessons-ledger.md)). **P1** Nov 22: a quarter each. **P2** Dec 12–13 and **P3** Jan 22 (both themes): a fresh save each, notes before talk; outside players, once named, go first (Claude asks in the week of Dec 21). **No merge to `main` from 18:00 the day before a playtest until its notes are committed** ([PR-13](docs/history/lessons-ledger.md)). `docs/playtests/PROTOCOL.md`: the chip's SHA at start and end; no help for 10 minutes; first line ≤3 min, profit ≤8 min, a 1–5 keep-playing score. **If P2 shows the step after the first line is unclear,** week 10 goes to onboarding; **if either of you scores below 3,** January's look time goes to contracts and pacing.

**Call: few docs; this plan is not a living spec.** §0 is the page you read; only §10's table changes at milestone close; if anything drifts, `docs/SCOPE.md` and `docs/DECISIONS.md` win, and on Mar 1 this file is rewritten short.

---

## 10. Milestones and calendar

Weeks run Monday to Sunday; checks use the deployed build.

**Steam under D18 and D22** (estimates): about 12–15 sessions (7.5 for the demo, 0.5–1 in fest week, 3.75–6.25 for the full release, nearly all May 10–Jun 13, before its build goes into review).

**Call: Feb 7 holds on sessions, not buffer.** Buffer: **none before M3** (deadline Nov 29) or **M5** (deadline Jan 3); **about half a session Jan 4–Feb 7**, so cut 1 is taken now; **three weeks Feb 8–28** before v1.0's hard deadline. **No Steam or desktop session starts before v1.0 is complete or Mon Mar 1, whichever comes first.** If v1.0 uses its buffer, Steam starts the Monday after, its first items slide, and the store page goes in by its Mar 29 latest, so §11's latest dates hold either way.

| Wk | Dates | Sessions | Focus | Exit check (you, 10 min) |
|---|---|---|---|---|
| 1 | Oct 12–18 | 5.5 | **M0 Boston board.** Scaffold, CI, the Pages preview with old deploys' files kept, build chip, platform fence, LFS; Boston tiles and Pages headers measured; MapLibre, light style v0, Afacad Flux glyphs; bake skeleton; mini-Boston fixture; V1 playable. **P0.** Artist: contract review, `art/LICENSE.md` | Boston opens flat, every arterial named in Afacad Flux; after the next merge a reload shows its SHA on the chip, and a tab left open still works |
| 2 | Oct 19–25 | 6 | Ports; worker host; V1's pipeline ported; census to cells, `sim.json` and G1–G7 on the fixture; dots; raw tilt (`T`, ≤0.5 session); smoke; height-tag count. Artist: **`metro-40` blockout Oct 25.** | `T` tilts and returns; dots sit where Back Bay to Longwood lives and works; "people within a walk"; does it look like Boston? |
| 3 | Oct 26–Nov 1 | 5 | **M1 First dollar, on the fixture.** Demand with V1's β; fare and subsidy income; daily close; I1, I2; recompute bench, three periods; line, stop and demand layers; the Inner Boston bake runs. **Capacity check; R2 recompute check (D11) Nov 1.** | A debug line from Back Bay to Longwood: riders board, money comes in, the day card adds up |
| 4 | Nov 2–8 | 6.5 | **M2 First line.** Shell; line tool; depot tint; three-period headway to purchase (format 1 holds all three), overnight sweep strategies; all costs; vehicle layer with the code-drawn glyph; I12. **Full Inner Boston pack green; format freeze; light token pick (≤0.5) Nov 8.** Artist: `sparrow`, `goliath` blockouts | Found, depot, 4 stops, every 20 min, overnight off: cash moves exactly as the inspector said |
| 5 | Nov 9–15 | 6 | Stop tiers, flags; fare band; Finance; Metro 40 and Goliath rows; undo; slots, autosave, export; place-anchored stops, the missing-pack refusal, the r1→r2 save test; sweep in CI; credits, `LICENSE-DATA.md`; **`city-boston-r1` Nov 15** (β fit, `tripScale` re-measured, starting cash derived, heights); art check and icons, CI only (≤0.5); three.js proof behind a flag (≤1). | Undo a stop while paused: cash back to the cent; an hour later, refused with a reason |
| 6 | Nov 16–22 | 5 | **M3 Money loop.** Report card; failure floor; HEADWAY contracts; checklist; Export session. **P1** | Checklist → profitable day → contract in about 8 min; the report card; overspend → countdown → restart |
| 7 | Nov 23–29 | 2.5 | Thanksgiving, half a week: transfers; route remove and extend; hourly congestion if it fits, else 1.1 (cut 8). **M3 deadline Nov 29.** Artist: **`metro-40` final** | Two lines share a stop at Kenmore and riders transfer |
| 8 | Nov 30–Dec 6 | 5 | **M4 Goals. System cutoff Dec 6.** RIDERSHIP contracts; events; medals; express behind I3; route insert; full sweep. Artist: **`sparrow` final** | A Longwood contract; roadworks a day ahead; insert a stop and no bus jumps |
| 9 | Dec 7–13 | 5 | **Tuning freeze:** Boston's bands and k; pacing; Home; save list; GPU ladder; model viewer with the Boston-map preview (≤1.5). **P2 Dec 12–13** | The scripted pacing run meets §3's targets; Home to a profitable day in ≤8 minutes; your Mac's fps recorded |
| 10 | Dec 14–20 | 5 | **M5 Prototype.** P2 fixes; the 2D/3D chip, drag, snap and cross-fade; light style pass; slow-laptop run. **Tag `prototype` Dec 20; D19 revisited.** Artist: **`goliath` final** | Home → founding → a profitable day |
| 11–12 | Dec 21–Jan 3 | 2 | Holidays: fixes, or the model path if M5 is signed off. **M5 deadline Jan 3** | — |
| 13 | Jan 4–10 | 5 | Model path: instancing per family, the mesh switch, the 3D I12 cameras; **dark theme**: token set, palette, contrast and I13 runs; look and charm. Artist: in-map fixes; depot **Jan 10** | Three families glide in 3D at ≥30 fps; light and dark side by side; beside V1, ours or a tie |
| 14 | Jan 11–17 | 4.5 | **M6 Content freeze Jan 17**, the city revision included. Help; settings with the theme toggle; accessibility; credits screen; close-zoom lane markings (first cut). RC1 | Ten minutes in Boston, flat and tilted, light and dark; nothing unfinished |
| 15 | Jan 18–24 | 2 | RC1 fixes; **P3 Jan 22** | P3 notes in, both themes, each citing one SHA |
| 16 | Jan 25–31 | 2.5 | **M7 Release candidate.** P3 fixes; RC2; checklist run | Every checklist line ticked by a person |
| 17 | Feb 1–7 | 2 | **v1.0 complete on the preview, target Sun Feb 7**; `/ship 1.0.0` if you choose | The preview loads on a computer that never saw it |
| 18–20 | Feb 8–28 | 2 | v1.0 buffer first: **RC deadline Feb 14; hard deadline Feb 28.** Steam gets what is left: store copy and ≥5 screenshots (≈0.5); the Electron shell, `desktop/`, smoke (≈1.5) | Store copy and screenshots approved; the shell's nightly smoke green |
| 21–24 | Mar 1–28 | 2.5 | **Store page in review Mar 1; Coming Soon by Mar 21.** `desktop/build.mjs`; signing, self-signed then real; nightly unsigned packages of both apps; uploads to a password-protected beta branch | A notarized universal build installs from the beta branch and plays a day on your Mac |
| 25–30 | Mar 29–May 9 | 3 (+0.5–1 for a D19 trailer, §4) | Steam round trip on both OSes by Apr 11; **register by Apr 18**; the demo flag (D19); the demo soaked 60 minutes on both packages by May 2. **Demo in review May 3** (May 10 at the latest) | The demo installs from Steam and ends on its card on your Mac and the artist's Windows PC |
| 31–35 | May 10–Jun 13 | 3.5–5.75 | **Demo public May 24**, hotfixes first. Full release, behind its build flag (§6): Steamworks, achievements, disk saves with Cloud, migrations, update tests; the Mac check (§6); the release checklist. **Release build in review Mon Jun 14** (Jun 21 at the latest) | The release build installs from the beta branch and plays a day on your Mac and the artist's Windows PC |
| 36–38 | Jun 14–Jul 4 | 0.75–1.5 | **Next Fest Jun 14–21**, demo hotfixes first; fest fixes as the release's first patch; **release Tue Jun 29** | Bought and played from Steam on both OSes |

**Cut first if late, in order:** (1) map extras: building grow-in, narrow-FOV 2D, extra labels (**taken now**, for January slack), keeping only the close-zoom lane markings, January's first cut; (2) express lines; (3) the artist's 3D models in v1.0: 3D shows icons, three.js never ships, the models still draw the 2D icons and reach 3D with the full release; (4) events down to roadworks; (5) free tilt becomes two fixed states, flat and 50°, with no drag or snap; (6) route insert; (7) the top medal (the Goliath stays buyable); (8) hourly congestion; (9) the report card to three categories.

**Never cut:** Boston from real data, in an extent that passes the bake gates (the extent flexes; Boston stays); D8's floor: building footprints, street hierarchy, water, parks, land use and street labels; D17's no-transit city; flat 2D and a way into 3D; the self-hosted city file, Afacad Flux and OSM attribution; the money loop, contracts, failure floor and checklist; three headway periods in format 1 (D7); the calm shell; save integrity, the build chip and platform seams; invariants, sweep and smoke; I12; the GPU ladder; your playtests, P2 and P3; macOS and Windows both, in the demo and at release (D15).

**Triggers.** A trigger that reaches a decided item (cut 3 touches D6, cut 5 touches D2, a late dark theme touches D13) becomes that week's question to you, with a recommendation; the answer goes in DECISIONS.
- **Velocity, Sun Oct 18 and Oct 25:** under two-thirds of the Sessions column → the next week's map and look items wait for M3.
- **First-dollar signal, Sun Oct 25:** a headless fixture test where one line writes a fare row. Red → week 3 drops all map work.
- **No `metro-40` blockout by Sun Nov 1:** no art pipeline yet; buses keep the code-drawn glyph ([RN-07](docs/history/lessons-ledger.md)). **None by Sun Nov 22:** the art checker waits for week 13.
- **First dollar not in by Sun Nov 1:** guards move to nightly, map work stops beyond what M2 needs, and every session works on income.
- **Sun Nov 1 capacity check, more than a week behind:** the week-4/5 presentation items (the light token pick, the art check, the three.js proof) wait for M3, and cut 2 applies.
- **Full Inner Boston pack not green by Sun Nov 8:** format 1 freezes on the fixture-proven schema, and the extent shrinks to a core box that passes G1–G10; R2 and all of Boston become 1.1. r1 publishes Nov 15 either way.
- **3D under 30 fps on the slowest laptop (week 7):** raise the 3D zoom floor to 14.5, drop the extrusion gradient and cap pitch at 50°; still slow → meshes only at zoom ≥18.
- **M3 not signed off by Sun Nov 29:** cuts 2 and 4, and cut 5 (your call), which removes the week-10 drag and snap work. **A week-8 system item not green by Dec 6:** it moves to 1.1.
- **No passing `metro-40` final by Sun Dec 13:** you decide cut 3 on Dec 20; if taken, week 13 becomes polish or buffer. **No passing `sparrow` or `goliath` final by Sun Jan 10:** that family keeps its blockout or the procedural box.
- **M5 not signed off by Sun Jan 3:** cut 3 (your call) and charm items; the target moves to Sun Feb 21, with content freeze Sun Jan 31, P3 Fri Feb 5 and RC Sun Feb 14; Steam's store material slides (the Call above).
- **Dark theme not green by the content freeze (Jan 17, or Jan 31 under the M5 trigger):** your question that week (recommendation: dark waits for the full release; the demo, P3, the checklist and the theme tests run light only).
- **RC not green by Feb 7:** v1.0 completes the Sunday after. **Not by Sun Feb 14:** you call v1.0 complete by Feb 28 with what is green; its fixes go on beside Steam work from Mar 1.
- **Steam (§11):** tax check or fee not done by Sun Feb 14 → Coming Soon 30 days after the fee, or sooner if Valve's answer to question 1 allows, by Apr 11. Apple not approved by Sun Mar 28 → ask Valve whether an ad-hoc-signed Mac demo passes review (D15 question 6), else Windows first and the Mac by May 31 (your call); still unsigned then → the demo enters on Windows and the Mac follows once signed, your question that week (D15; the release needs both). The page not public by Sun Apr 11 → register as soon as it is, by Apr 25; past that, the October fest or none (your call before registering). The demo not in review by Mon May 17 → it misses the Press Preview but can still make May 31. The release build not in review by Mon Jun 21 → Valve's 3–5 business days no longer fit before Tue Jun 29, so the date moves, through Valve since it is within 14 days; Tue Jul 27, after the Summer Sale, is the fallback (your call, D22).
- **Two quiet weeks:** cut the next item at the next session ([SC-11](docs/history/lessons-ledger.md)).

---

## 11. Preview now; a Steam demo at Next Fest in June, then the release

**Decided (D3, D4, D12, D15, D18): Pages is your preview; Steam (about US$10) is the only release, after a free demo at Next Fest in June 2027.** Valve's pages were read only through search excerpts; check each fee, date and rule before relying on it.

| Platform | Needs | Verdict |
|---|---|---|
| **GitHub Pages**, `bobbyjohn-nil.github.io/interbus` | The deploy workflow and both Pages gates ([DP-02](docs/history/lessons-ledger.md)); city files as release assets, which go private with the repo (D20). Limits: a 1 GB site, a soft 100 GB a month, no commercial software ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). From a private repo, Pages needs GitHub Pro or higher and the site stays public ([plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), GitHub's docs source, checked 2026-10-14; check before relying on it) | **The preview**, until the repo goes private on Sun Mar 14 2027 (D20) |
| **Steam** | US$100 per app, recouped after US$1,000; release ≥30 days after paying and ≥2 weeks after Coming Soon; store review 3–5 business days; legal-name, bank, tax and ID onboarding (yours, as a sole proprietor under your legal name, not a trade name; the store page's developer and publisher can still read Miticept Studios, D21 (a)); Mac apps notarized; one Next Fest per game ([Steam Direct](https://partner.steamgames.com/steamdirect), [onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding), [review](https://partner.steamgames.com/doc/store/review_process), [platforms](https://partner.steamgames.com/doc/store/application/platforms), [Next Fest](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest)) | **The demo, then the release** |
| **Apple** | US$99 a year, held by you as an individual under your legal name; an organization needs a legal entity and a D-U-N-S number, and Apple accepts no DBA or trade name ([enrol](https://developer.apple.com/programs/enroll/), checked 2026-10-14; check before relying on it). Developer ID signing and notarization only, with no Mac App Store (D21 (a)); a signing certificate's name includes the team name, so your legal name is in every signed build ([certificates](https://developer.apple.com/help/account/certificates/certificates-overview), checked 2026-10-14; check before relying on it) | **The Mac build, sold only on Steam** |

**The preview (D12)** has no custom domain, service worker, offline mode or update prompt; Pages reportedly caches every file for 600 s ([Stack Overflow](https://stackoverflow.com/questions/14798589/github-pages-http-headers), a search excerpt, checked 2026-10-12), so only a reload is sure to fetch the newest build. Current Chrome, Edge and Firefox with WebGL2, Safari on a Mac; 1152×720 or larger. **Privacy:** no analytics, ads, accounts or third-party requests; CI fails on any outside fetch, allowlisted links exempt ([S20](docs/history/salvage-matrix.md)).

**Licences and credits** (not legal advice; ask the OSMF Licensing Working Group before a paid release if unsure).
- **OpenStreetMap (ODbL 1.0):** "© OpenStreetMap contributors" in a map corner whenever the map shows, linked to [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright), plus credits and store page ([guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)). **Call: publish both city files under ODbL as public release assets** (D14): from this repo while it is public, and from a public home outside it, set up before it goes private on Sun Mar 14 (D20), since only people with access to a private repo can see its releases ([releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), checked 2026-10-14; check before relying on it). That meets share-alike and keeps a Steam build with DRM compliant; ask the OSMF Licensing Working Group whether the files alone are enough once the bake recipe is private.
- Census (public domain), Protomaps (BSD-3, ODbL), Afacad Flux (OFL 1.1) and libraries (a generated `THIRD_PARTY_NOTICES`) are credited in `LICENSE-DATA.md` and a credits screen; MBTA data never ships.
- **Code and art (D14, D20):** the code is © Miticept Studios, all rights reserved: with no licence default copyright applies, though while the repo is public GitHub users may view and fork it on GitHub ([GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository), [Terms §D.5](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), search excerpts, checked 2026-10-12; check before relying on them). The repo goes private on Sun Mar 14 2027, a week before the store page is public; forks made before then stay public ([visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility), checked 2026-10-14; check before relying on it). The studio's own art, store art included, is under CC BY 4.0, credit "Miticept Studios" (D20).

**Checklists** (`docs/RELEASE.md`). v1.0: a 30-minute soak, flat and tilted, light and dark; three machines, one without hardware acceleration; P3 notes in; licence files present; the chip matches `main`. The demo adds `spctl`, a 60-minute soak of both packaged builds, and a Steam install on your Mac and the artist's Windows PC (D21 (b)) that plays to its card. The full release adds migrations, update and offline tests.

**Next Fest, June 2027 (D18): Mon Jun 14–Mon Jun 21, 10:00 PDT.** Registration closes **Sun Apr 25, 23:59 PDT** and needs the Coming Soon page public; demo and store presence in review by **Mon May 17** for the Press Preview (an earlier search only), which opens Thu Jun 3; everything by **Mon May 31**; release only after the fest ([June 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027), [demos](https://partner.steamgames.com/doc/store/application/demos)). Valve also advises submitting a demo that goes public before the Press Preview at least five weeks before the fest, here Mon May 10 ([Next Fest](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest), search excerpt, checked 2026-10-12; check before relying on it). Working back: targets, with the latest date where later, each latest date a week or more before Valve's deadline (§10 has Claude's):

| By | Who | What |
|---|---|---|
| Sun Jan 31 | You | Apple enrolment as an individual, under your legal name (D21 (a)), any time from now (approvals reported from a day to over three weeks, [forum](https://developer.apple.com/forums/thread/813941)) |
| Sun Feb 7 | You | Steamworks sign-up as a sole proprietor under your legal name, with Miticept Studios only as the store page's developer and publisher (D21 (a)); paperwork, a bank account in the same name, tax (a 2–7 business-day check, so start by Jan 24) and any ID check; Valve asked D15's questions 1–4 and 7 and D21's question 8 (D18), with any public trader details entered only after question 7's answer (if Valve answers only a signed-up account, sign up, ask, then finish); the name check (D5). Any time from now |
| Sun Feb 14 | You | **US$100 fee**; base app and demo app (check for a second fee). The 30-day wait ends Tue Mar 16, before anything is public |
| Sun Feb 21 | You, artist | D14 agreement signed, the art's licence included; D20 (preview) answered. The artist: the four store capsules ([MODELS.md](docs/art/MODELS.md) §11; latest Sun Mar 21) |
| Sun Feb 28 | You | Apple approved; Developer ID certificate and Team API key in `desktop-sign` and `desktop-release`. Claude's store copy, tags, requirements, Content Survey (AI use truthful) and ≥5 gameplay screenshots at 1920×1080 approved (latest Sun Mar 21); D19 decided |
| Mon Mar 1 | You | Store page submitted (review 3–5 business days; latest Mon Mar 29) |
| Sun Mar 7 | You | A Steam build account limited to this app; a second Steam account and demo keys; the password-protected beta branch |
| Sun Mar 14 | You | **The repo made private** (D20), a week before Coming Soon (by Sun Apr 4 at the latest) and after v1.0 is complete: GitHub Pro and a payment method first; the city files' public home and their new addresses merged; the preview as D20 (preview) says |
| Sun Mar 21 | You | **Coming Soon public** (latest Sun Apr 11). Spring Sale reported Mar 18–25 ([fullcleared](https://fullcleared.com/news/steams-2027-spring-and-summer-sale-dates-are-locked-in/), secondary, checked 2026-10-12; check before relying on it); no Valve rule against going public during it was found; Mon Mar 29 also works |
| Sun Mar 28 | You, artist | The artist's Windows PC ready (D21 (b)): Steam signed in with a key for the app and the beta branch's password, both passed privately |
| Sun Apr 11 | You, artist | The Steam round trip passed on your Mac and the artist's Windows PC; library art and the demo app's art up |
| **Sun Apr 18** | You | **Register** (Valve: Apr 25) |
| **Mon May 3** | You | **Demo and its store presence in review**, after a 60-minute soak of both packages (latest May 10, Valve's five-week advice; Press Preview deadline May 17) |
| Mon May 24 | You | **Demo public**, three weeks before the fest; everything else in review by May 31 |
| **Mon Jun 14** | You | **The release build in review** as the fest opens (latest Mon Jun 21; review 3–5 business days, [review](https://partner.steamgames.com/doc/store/review_process)); any launch discount set up (D22). From Tue Jun 15 the date moves only through Valve ([Coming Soon](https://partner.steamgames.com/doc/store/coming_soon)) |
| **Tue Jun 29** | You | **Release App** (D22), about a week after the fest and inside the Summer Sale, Jun 24–Jul 8 ([seasonal sales](https://partner.steamgames.com/doc/marketing/discounts/seasonalsales)); in its first 30 days a game cannot join a seasonal sale, but a launch discount of 7–14 days, at most 40% and set up before release, may run into it ([discounts](https://partner.steamgames.com/doc/marketing/discounts)). Search excerpts, checked 2026-10-14; check before relying on them |

---

## 12. Risks and mitigations

1. **Real-city data eats the schedule** ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md), [WD-04](docs/history/lessons-ledger.md), [WD-09](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)). Pinned static files; a gated, dispatch-only bake; M1 on the fixture, so money never waits; the Nov 8 pack, core-box trigger and format freeze.
2. **3D ambition crowds out the game** ([RN-03](docs/history/lessons-ledger.md), [RN-05](docs/history/lessons-ledger.md), [RN-07](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)). One renderer; extrusions plus a lazy model path proven in week 5; one session in three on look until M3; renderer code capped near 2,500 lines (V3 reached 4,400); cuts 3 and 5.
3. **The money loop closes late** ([GD-01](docs/history/lessons-ledger.md)). First dollar in Boston by Nov 1 with its trigger; cheapest guards only.
4. **Boston's density breaks the balance** ([X-08](docs/history/lessons-ledger.md)). Boston is the reference city; `calib.tripScale` from its first-line band; the sweep runs on it.
5. **Momentum dies** ([SC-11](docs/history/lessons-ledger.md)). A merged PR and a note weekly; velocity checks from Oct 18; the quiet-weeks trigger; buffer after Feb 7.
6. **Not fun** ([GD-07](docs/history/lessons-ledger.md), [TS-10](docs/history/lessons-ledger.md)). P0, the protocol, P2 before the tag, P3, the charm budget. Two insiders are weak signals: the week-9 scripted pacing run ([GD-10](docs/history/lessons-ledger.md)) is the objective check, and the demo's players, from May 24, the first outside one unless you name testers for P3.
7. **You dislike the look, or two themes double colour QA** ([RN-02](docs/history/lessons-ledger.md), [RN-13](docs/history/lessons-ledger.md), [RN-14](docs/history/lessons-ledger.md)). Boston on screen in week 1; the Nov 8 token pick; side-by-sides; one generator, three tested states (§8).
8. **Exploits or balance thrash** ([GD-13](docs/history/lessons-ledger.md), [EC-12](docs/history/lessons-ledger.md), [SC-08](docs/history/lessons-ledger.md)). Invariants, the sweep in CI, the Dec 6 cutoff.
9. **Saves or deploys break** ([DP-01](docs/history/lessons-ledger.md), [DP-04](docs/history/lessons-ledger.md)). The schema hash, I7, I8, place-anchored stops, set-aside saves; kept deploy files and I15; migrations and update tests before the full release.
10. **It runs badly or not at all** ([AR-07](docs/history/lessons-ledger.md), [RN-04](docs/history/lessons-ledger.md)). Worker sim, instanced icons, render on change, laptop budgets, the GPU ladder.
11. **Art late, over budget or unowned** ([RN-07](docs/history/lessons-ledger.md), [X-15](docs/history/lessons-ledger.md)). Blockout first; budgets that fail with numbers; the fallback ladder; `art/LICENSE.md` before the first file.
12. **Licences block Steam.** City files public under ODbL from week 5, and from a public home outside this repo once it is private (D20); attribution from the first map; the code all rights reserved and the art's CC BY 4.0 (D20) written down, with D14's agreement, before the store page.
13. **Process bloat or lost work** ([PR-04](docs/history/lessons-ledger.md), [PR-07](docs/history/lessons-ledger.md)). No crew, few docs, one owner session, merge commits only, owner-only versions.
14. **The preview or the repo gives the game away, or the switch to private breaks the pipeline.** Until Sun Mar 14 2027 the repo is public, so code, city files and LFS art can be downloaded, and copies and forks made by then stay public. You make it private then, a week before the store page is public (D20). On GitHub Free that unpublishes the preview and drops `main`'s rulesets (D24) and the desktop jobs' environment secrets; GitHub Pro keeps them and Pages, though a Pages site stays public to anyone with its address. Required reviewers, which §6 puts on `desktop-release`, need a public repo or Enterprise. Actions stops being free: 3,000 included minutes a month on Pro, and with no payment method Actions, and with it the required check, stops once they are used ([visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility), [plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), GitHub's docs source, checked 2026-10-14; check before relying on them). Ask Valve about the preview (D15 question 2); you decide the preview and the plan by Sun Feb 21 (D20 (preview)).
15. **The one fest goes to a weak demo, or an outside clock slips.** Apple's enrolment and Valve's reviews are outside our control; each of your steps has a latest date a week or more before Valve's deadline (§11); the page gets about 12 weeks of wishlists before the fest, against about 7–9 under February (estimate, D15), and the demo is cut from a finished v1.0. A slip past registration means the October fest or none, your call before registering (§10).
16. **Mac builds break or secrets leak** (a revoked Developer ID certificate stops every app it signed, [Developer ID](https://developer.apple.com/support/developer-id/)). §6's two dispatch-only jobs, the Steam one reviewed; no desktop artifacts.
17. **The release lands in the Summer Sale, a week after the fest** (D22). In its first 30 days it cannot join the sale, so it competes with the sale's discounts; a launch discount may run into it ([discounts](https://partner.steamgames.com/doc/marketing/discounts), search excerpt, checked 2026-10-14; check before relying on it). Its work is due before the fest, while the demo is live: the release build in review Mon Jun 14 (Jun 21 at the latest), its features behind the build flag so demo hotfixes never ship them (I16), and Tue Jul 27 as the fallback (§10).

---

## 13. Decisions

Answers go in [docs/DECISIONS.md](docs/DECISIONS.md), with how to reverse each. Until answered, the plan assumes the recommendation, except the art's open licence, which waits for an answer (top of this file).

**Decided:** D1–D18, D20's first part, D23 and CL on 2026-10-12; D24, D20 (rest), D21 and D22 on 2026-10-14; reasons and reversals in DECISIONS. The newest: **D22** the full release Tue Jun 29 2027, about a week after the fest and inside the Summer Sale; **D21** you hold the Steamworks and Apple accounts as an individual trading as Miticept Studios, with no company, the Mac version sold only on Steam, and the artist's PC plays the Windows builds; **D20 (rest)** the art under CC BY 4.0, credit "Miticept Studios", and the repo private a week before the store page is public; **D24** `main` protected and `v*` tags locked; **D23** Claude opens and merges its own pull requests into `main`, merge commits only, on green checks; **D18** Next Fest in June 2027, not February; **D19** deferred until the game is under way.

**Still open:** listed at the top of this file.

---

## 14. The first two weeks

**Call: in week 1 you see real Boston, deployed and named by its SHA; in week 2 it tilts and fills with people** ([GD-07](docs/history/lessons-ledger.md), [SC-11](docs/history/lessons-ledger.md)).

**Before the first session:** merge the planning files (this plan, `README.md`, `CLAUDE.md`, the changelog with its check and `/ship`, `docs/`) to `main`; give Claude read access to `Intralines`, `Intralines_City_dep` (private) and `Intralines_City`.

**Week 1: Oct 12–18**

| # | Who | What | Done when |
|---|---|---|---|
| 1 | Claude | `docs/SCOPE.md` (one page), `docs/playtests/PROTOCOL.md`; a `LICENSE` keeping the code all rights reserved and pointing to the art's and city files' own licences (D20) | On `main`; SCOPE reads in 5 minutes |
| 2 | You | Pages from Actions; protect `main`: PRs only, "Versions only via /ship" a required status check, squash and rebase merges off (merge commits only); a `v*` tag ruleset blocking update and deletion | Set by Oct 18 |
| 3 | Claude | Scaffold (Vite, React, strict TS, Vitest, Playwright, lint rules, LFS, CI); the deploy workflow keeping the last two deploys' files (≈0.25 session) and the live SHA check; `src/platform/web` with the replaced-build card; the build chip; the I15 swap test | After a second merge, a reload shows its SHA and a tab left open on the first still loads |
| 4 | Claude | Boston map: `pmtiles extract --dry-run`, then a pinned Protomaps cut of Inner Boston plus 1.5 km as a hashed release asset; Pages header check (Range `206`, cache lifetime); MapLibre 6.11.2; light style v0 with a self-hosted sprite; Afacad Flux built into woff2 and all 256 glyph ranges as D13 describes, with its style test; OSM attribution; `CityTileSource` | Boston opens flat, labelled in Afacad Flux; sizes, headers and font bytes in DECISIONS |
| 5 | Claude | Bake skeleton: `city.json`, extent, `bake:plan`; fetch, lock, mirror; the mini-Boston fixture (the §5 box) clipped from every input | The fixture committed; Boston's 675,647 exact |
| 6 | Claude | Make V1 playable for P0 | You open V1's Riverton in one step |
| 7 | You and the artist | **P0:** 30 minutes of V1 each | `docs/playtests/2026-10-17-p0-v1-baseline.md` |
| 8 | The artist; you | The artist reads MODELS.md §1 and §2 (about two pages) and answers §1's questions (tool, Windows version, roof stripe, any existing models); `art/LICENSE.md` names Miticept Studios, both of you jointly (D14), and the art's licence, CC BY 4.0 with the credit "Miticept Studios" (D20); the artist's commit records the artist's agreement | Committed by Oct 18 |
| 9 | You | M0 check; the velocity check (§10) | Note committed |

**Week 2: Oct 19–25**

| # | Who | What | Done when |
|---|---|---|---|
| 10 | Claude | Port V3's ledger, saves (async store, bus counter, schema hash), calendar, errors; V2's RNG, graph, A*; V1's geo | Ported tests, I7 and schema hash pass, each shown failing on the old bug |
| 11 | Claude | Worker host; V1's pipeline and fixtures ported; census to cells, street graph (G2/G3 with bus access), `sim.json` and loader on the fixture; dots; catchment probe; Inner Boston height-tag count; smoke; the fare-row signal (§10) | I8; I10 on the fixture; "people within a walk" in e2e |
| 12 | Claude | Raw tilt: `T` sets pitch 50° with extrusions (≤0.5 session); board mask; style and bundle tests | `T` tilts and returns |
| 13 | Claude | `docs/specs/current.md` for M1, ≤150 lines, "first dollar on the fixture by Nov 1" on top | Committed by Oct 25 |
| 14 | You | "Does this look like Boston?" check; two or three screens that mean "sleek but detailed"; the velocity check | In DECISIONS |
| 15 | The artist | **`metro-40` blockout** (1–2 h): true length, axes, origin, slot names, roof stripe | Delivered by Sun Oct 25 |
| 16 | You and the artist | D20: the art's licence, CC BY 4.0 (chosen 2026-10-14), named in `art/LICENSE.md` with item 8; if the artist does not agree, the file says all rights reserved and the question comes back to you | By Sun Oct 18, before the blockout lands |

The first player-visible change adds the first line under Unreleased; no version exists until you type `/ship`. If week 1 slips, items 3 and 4 come first. Nothing for Steam is due in these weeks (§11).
