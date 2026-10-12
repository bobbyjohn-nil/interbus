# interbus: the plan

*Written Monday 2026-10-12 for Miticept Studios and revised after two rounds of your decisions (§13, [docs/DECISIONS.md](docs/DECISIONS.md)). "You" means the studio owner; "the artist" means the co-developer. **Call:** marks a settled question and its reason.*

**Citations.** Lesson IDs ([GD-01](docs/history/lessons-ledger.md) …) link to the [lessons ledger](docs/history/lessons-ledger.md); bug and salvage IDs ([K01](docs/history/salvage-matrix.md), [S01](docs/history/salvage-matrix.md), [R01](docs/history/salvage-matrix.md) …) to the [salvage matrix](docs/history/salvage-matrix.md). Prior code is `repo@ref:path`: V1 `Intralines@7af45b1`, V2 `Intralines_City_dep@archive/intralines-city-v1` (game under `Gaming/`), V3 `Intralines_City@dc63602`. Web facts carry their URL and were checked 2026-10-12, some only through search excerpts; fees and policies change, so check before relying on them. "Measured" means measured on 2026-10-12; "estimate" means not.

---

## 0. One-page summary

**What we build.** A calm bus-company game on real Boston: real streets and buildings, no buses, trains or ferries until you start them (D17), and people where the 2020 census and real commute records put them. You draw lines, set how often buses run and what each line charges, and watch riders and money flow, on a crisp flat map, light or dark, that tilts into 3D where the artist's buses glide between real buildings. The city offers contracts and grades you every quarter. It is V1's loop on V3's engineering with V2's measured economy fixes, cut to what a two-person part-time studio can finish.

**For whom.** You first: if you do not want to keep playing it, it has failed. Then people who like Mini Metro's calm but want a company with real money in a real city, in 20–60 minute sessions, on Steam at about US$10.

**By when.** First fare dollar, on a Back Bay–Longwood clip of Boston, **Sun Nov 1**. Prototype tagged **Sun Dec 20**. **v1.0 complete on the preview, target Sun Feb 7 2027**, hard deadline Sun Feb 28: game-complete, and yours to `/ship 1.0.0` if you choose. Steam, the only public release, is a proposal for later: code from Mon Mar 1 at the earliest, release Tue Jul 13 2027 (§11).

**The calls that shape everything**
1. **Money before presentation.** Income in week 3, costs in week 4, the full money loop by Nov 22, on a committed mini-Boston fixture that never waits for the bake or for 3D. Until M3, at most one session in three is look, 3D or art work ([GD-01](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)).
2. **Boston first, baked offline from pinned static files** (D1) behind ten numeric gates, the last proving no transit survives (D17); browsers never fetch source data ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md)).
3. **One renderer, two views** (D2): MapLibre draws one detailed map, flat or tilted; three.js only draws the artist's buses inside it, lazily: proven behind a flag in week 5, shipped in January ([RN-03](docs/history/lessons-ledger.md)).
4. **A preview now, Steam the only release** (D3, D4, D12): Pages shows you every merge, its SHA on screen, with no offline mode, update prompt or web migrations; a platform module and async saves keep Steam a packaging job ([DP-09](docs/history/lessons-ledger.md)).
5. **Art built around real files** (D6): the first box-level bus is due Sun Oct 25, and its CI check follows in week 5 ([RN-07](docs/history/lessons-ledger.md)).
6. **Fewer controls, fewer exploits.** Three headway periods with no night-only line, no per-bus wear, undo only while paused, express behind a test ([GD-06](docs/history/lessons-ledger.md), [K22](docs/history/salvage-matrix.md)).
7. **No new system after Sun Dec 6.** January is models, content and look ([SC-08](docs/history/lessons-ledger.md)).
8. **Versions only on your say:** only `/ship <version>`, typed by you, creates one; CI fails any other, and your yes inside `/ship` is the guard ([PR-15](docs/history/lessons-ledger.md)).
9. **Triggers cut scope first; only the M5 and RC triggers move the target, and never past Feb 28.** The decisions add about 2.7–3.2 Claude-weeks net, nearly all in weeks 1–7, paid by more sessions a week and checked from Oct 18 (§9, §10).

**How.** One Claude session owns `main`; no agent crew; ≤150-line specs; PR checks within 8 minutes ([PR-04](docs/history/lessons-ledger.md), [PR-08](docs/history/lessons-ledger.md)).

**This week:** give Claude read access to the three earlier repos; protect `main` (§14 item 2); agree the art licence line (D14) by Sun Oct 18; the artist reviews [docs/art/MODELS.md](docs/art/MODELS.md) §3, §3.1, §5, §6 and §10 (about a page); run the V1 baseline (§14).

---

## 1. Vision and pitch

**Pitch.** *Run the buses of Boston. Its real streets, buildings, river and harbour are drawn quiet and fine, no bus, train or ferry runs until you start one, and the only colour is your network. Find where people live and work, draw lines down streets you know, and decide how often buses run and what each line charges. Read it flat like a transit map, or tilt it to watch your buses glide past Back Bay. Every rule is drawn on the map, and the money comes in until the city hands you its next contract or the bank stops calling back.*

**How it differs** (check before store copy). Unlike Mini Metro it has money, a grade, contracts and a real city; unlike City Bus Manager it has no chores ([GD-03](docs/history/lessons-ledger.md), [GD-09](docs/history/lessons-ledger.md)). Subway Builder ([Steam](https://store.steampowered.com/app/4039140/Subway_Builder/)) is the plan's reference for "sleek but detailed" until your own screens arrive (§14 item 14); interbus is buses on streets, in shorter sessions, and plays offline on Steam.

**Against V1–V3.** V1's only goal was "profit go up" ([SC-03](docs/history/lessons-ledger.md)), V2 covered 41.2% of the map with chrome ([UX-01](docs/history/lessons-ledger.md)), V3 never earned a dollar ([K40](docs/history/salvage-matrix.md)); this plan answers all three.

**Title (D5): interbus**, also the repo, package and storage-key name. Check it before the Steam store page: INTERBUS is also Phoenix Contact's industrial fieldbus ([Wikipedia](https://en.wikipedia.org/wiki/INTERBUS), via search excerpts, checked 2026-10-12; D5).

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
| Live APIs, browser data fetches, third-party tiles | [WD-01](docs/history/lessons-ledger.md) | Never |
| Terrain, sky, a second renderer, a Canvas fallback | [RN-02](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md) | Never |
| Company type, lobbying; staff, mechanics, Environment; fuel; schedule assistant | [GD-03](docs/history/lessons-ledger.md), [GD-09](docs/history/lessons-ledger.md), [GD-12](docs/history/lessons-ledger.md) | Never |
| Mk tiers, per-bus wear; per-line hours beyond D7's overnight on/off; undo across time | No lever ([K02](docs/history/salvage-matrix.md)); exploits ([EC-03](docs/history/lessons-ledger.md), [K22](docs/history/salvage-matrix.md)) | Later |
| Local lanes, a separate night palette, a third palette | [K36](docs/history/salvage-matrix.md), [RN-14](docs/history/lessons-ledger.md) | Light and dark ship (D13) |
| Pedestrians, diorama, landmark models | [SC-05](docs/history/lessons-ledger.md) | Landmarks 1.1+ |
| Desktop build, Steamworks, achievements, signing | Steam workstream, Mar 2027 ([DP-09](docs/history/lessons-ledger.md)) | Steam release |
| Accessibility browser gate; V1 save import | [UX-08](docs/history/lessons-ledger.md), [DP-08](docs/history/lessons-ledger.md) | Never |
| Audio; phones; regional rail, >3 overlays | [SC-08](docs/history/lessons-ledger.md) | Later |

**Call (D7): three headway periods per line.** Peak (06:30–09:30, 16:00–19:00) and off-peak (the rest of 05:00–24:00) always run, at most 60 minutes apart; overnight (00:00–05:00) runs no more often than off-peak, or not at all, so no night-only or night-mostly line exists (a midnight-only V2 line paid +149% to +461%, [EC-03](docs/history/lessons-ledger.md)); each limit is a `sim/rules` predicate with a cursor-card refusal. Riders board only while a line runs. Contracts, the report card and "needs N buses" (the most any running period needs) read peak and off-peak; overnight counts at most toward Coverage. Times and the cap are tunables. **Call: no per-bus wear;** it has no lever ([GD-03](docs/history/lessons-ledger.md)). **Call: express lines are in behind I3** ([EC-05](docs/history/lessons-ledger.md), [X-20](docs/history/lessons-ledger.md)), second on the cut list; not green by Dec 6 means 1.1.

---

## 3. Core loop

**Second to second.** Buses glide, riders gather, cash ticks; the game starts paused ([UX-10](docs/history/lessons-ledger.md)).

**Minute to minute: six verbs**, each paying off within a game day ([GD-02](docs/history/lessons-ledger.md)): **draw or extend a line**; **share a stop** (within 250 m it joins, [EC-10](docs/history/lessons-ledger.md)); **set a headway** for peak, off-peak and overnight, and the game shows "needs 3 buses, you have 2" with the price ([GD-09](docs/history/lessons-ledger.md)); **set a fare** inside a printed band ([EC-09](docs/history/lessons-ledger.md)); **prune or upgrade a stop** flagged QUIET or LOSS ([UX-13](docs/history/lessons-ledger.md)); **place a depot** on the green tint, knowing dead-heading costs ([EC-13](docs/history/lessons-ledger.md), [UX-06](docs/history/lessons-ledger.md)).

**Session.** A quarter (10 game days) ends with a report card and a **Next quarter** preview ([UX-03](docs/history/lessons-ledger.md)).

**The first ten minutes in Boston** (playtest targets; V1 prices, [X-09](docs/history/lessons-ledger.md); head counts and cash illustrative until the bake)

| Time | What happens |
|---|---|
| 0:00 | Name, colour. The board opens paused and flat over Back Bay at zoom 14, every arterial named (local names from z14.5); chip "1/5 Place a depot" ([UX-07](docs/history/lessons-ledger.md)) |
| 1:00 | Legal land tints green, mostly industrial strips; card "Industrial ✓ · street 40 m ✓ · $150k" |
| 2:00 | "2/5 Draw a line" along Massachusetts Avenue: a 650 m walk ring, "≈9,000 people within a walk" |
| 3:00 | Four stops to the Longwood Medical Area. "Every 20 min needs 1 Sparrow · $95k": founding sets peak and off-peak alike, overnight off; about $49k left at k ≈ 1.2 |
| 3:30 | "3/5 Press play" at 05:00 on day 1. The bus pulls out; the 06:30 peak fills it |
| 4:30 | The 2D/3D chip (or `T`) tilts the map: Back Bay rises around the bus; again to flatten. Nothing in the game changes |
| 5:30 | First daily close, every figure a ledger row ([AR-12](docs/history/lessons-ledger.md)); "QUIET · 3 boardings" |
| 7:00 | "4/5 Make a profitable day": prune the stop or nudge the fare |
| 8:00 | "5/5 Take a contract": "Every 15 min at Longwood, 10 days, $120k" |

No tutorial text: a profitable first line fits the starting cash and the best four-bus line does not ([GD-11](docs/history/lessons-ledger.md)). Inner Boston is roughly 7–10× as dense as V1's Riverton (estimate), where V1's starter economics were measured ([X-08](docs/history/lessons-ledger.md)), so prices stay V1's and `calib.tripScale` scales demand, set on the fixture's first-line band in week 3 and re-measured on `city-boston-r1` in week 5.

**Goals.**
- **Contracts, three slots:** HEADWAY near a landmark such as Longwood or Kendall, and RIDERSHIP (150, 400 or 800 boardings a day), held 10 days within 20 ([GD-04](docs/history/lessons-ledger.md)).
- **Events**, one at a time, hatched a day ahead: roadworks, festival, snow.
- **Report card:** Coverage by service ([EC-07](docs/history/lessons-ledger.md)), Reliability against the line's timetable ([K03](docs/history/salvage-matrix.md)), Comfort, Money ([EC-14](docs/history/lessons-ledger.md)).
- **Medals**, three for Boston; silver unlocks the Goliath. "Bronze unlocks the next city" returns with a second city.

**Call (D10): one failure floor with a way back.** Cash may go negative to a credit limit with one lender (V1's Talon & Grasp); five days below it ends the run, with a countdown chip and **Restart this quarter** from an automatic save. Sandbox turns failure off ([GD-06](docs/history/lessons-ledger.md)).

**Call: undo only while paused**, restoring cash exactly; refused with a reason once time has passed ([K22](docs/history/salvage-matrix.md), [UX-09](docs/history/lessons-ledger.md), [X-11](docs/history/lessons-ledger.md)).

**Pacing targets** ([GD-10](docs/history/lessons-ledger.md)), scripted in week 9: first line in 3–5 minutes; profit by 8; second line after 15–25; report card by 20; Boston's top medal in 2–4 hours.

**Call (D7): starting cash is derived:** k × a starter line's cost (a depot, four stops, the buses its daytime headways need) from the config rows, written once at founding as the first ledger row, so a retune never moves a save. One Sparrow line costs about $261k at V1's prices, so k ≈ 1.2 gives V1's $310k ([X-09](docs/history/lessons-ledger.md)); week 9 tunes k within 1.0–1.8 (why in D7), held by I10 ([GD-11](docs/history/lessons-ledger.md)).

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

**Call: every bus type, event kind and route edit lands before the cutoff** ([SC-08](docs/history/lessons-ledger.md)): Sparrow (28 seats, $95k), Metro 40 (70, $260k), Goliath (115, $440k) are config rows ([C01](docs/history/salvage-matrix.md)), all in the sim in week 5, so no cut can strand finished art. Their art follows the artist's dates; art is not a system.

### v1.0 complete on the preview: Jan 4 to Feb 7 2027

Models, content and look only: the artist's three families as 3D models at close zoom (lazy three.js, proven in week 5; cut 3); the dark theme (§8); splash, bus wipe, day/night tint, dusk lights, report-card stamp ([S18](docs/history/salvage-matrix.md)); help, settings, accessibility; a credits screen; close-zoom lane markings (§8 rule 9), January's first cut. Complete means game-complete on the preview; you may `/ship 1.0.0`, which publishes nothing new.

### Steam release: proposal, from Mar 1 2027

The only public release, about US$10 (D4): V1's Electron shell ([S19](docs/history/salvage-matrix.md)), a Windows build with Steam Cloud and achievements, save migrations and update tests (D12), the artist's capsule art; release Tue Jul 13 2027 if you take the proposal (§11, D15).

### After v1.0 (ordered)

A second real city; all of Boston with variable 350/700 m cells; the artist's landmarks; per-line hours beyond D7's overnight on/off ([EC-03](docs/history/lessons-ledger.md)); undo across time; player-built bus lanes, painted red (the city's only ones, D17); real commute flows instead of gravity; a keyboard map cursor ([UX-11](docs/history/lessons-ledger.md)). Steam takes March, then alternates with the second city.

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

Inner Boston keeps the river and harbour crossings, Longwood, Kendall, Logan and downtown, with 20% headroom under the 1,000-cell cap and 42% under the 16,000-node cap ([WD-09](docs/history/lessons-ledger.md), [AR-15](docs/history/lessons-ledger.md)); it leaves out south Dorchester, Mattapan, Hyde Park, Chelsea and Everett, while Boston's city limits break the cell cap and leave Cambridge a grey void. R2 needs recompute ≤100 ms p95 with three periods in week 3 (D11). **The extent flexes; Boston stays** (the Nov 8 core-box trigger, §10). Beyond the extent the board fades to grey, as in V1.

**Sources: static files only, no API, no key**, so V1's quota pages, rate limits and missing CORS cannot recur.

| Layer | Pinned source | Use |
|---|---|---|
| Residents | 2020 block counts (`POP20`) in TIGER/Line `tabblock20` ([files](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.2020.html)) | Residents and dot sub-points |
| Workers, jobs, commutes | LODES 8.4, year 2023, on the same 2020 blocks ([LODES8](https://lehd.ces.census.gov/data/lodes/LODES8/)) | Jobs by sector, inbound commuters, the gravity β fit |
| Streets, depot land, lane tags | One dated Geofabrik Massachusetts `.osm.pbf`, ~292–296 MB ([page](https://download.geofabrik.de/north-america/us/massachusetts.html)), via osmium | The sim graph, and from week 3 the tiles |
| Map | Week 1 a cut of a pinned Protomaps build; from week 3 Planetiler on the same extract ([docs](https://docs.protomaps.com/basemaps/build)) | The 2D/3D map |
| Heights | OSM height, else levels × 3.2 m + 1 m, else a type default; Overture's lidar heights (93–95% coverage, measured) join the r1 bake if under about half of Inner Boston's buildings carry `height` or `building:levels` (week-2 count, in DECISIONS) | Extrusions |
| MBTA GTFS, ridership | Bake-time calibration report only, comparing modelled demand with real ridership; never drawn, simulated or shipped (D17; revocable licence) | Sanity check |

**Call: 350 m square cells, about 800, built from 2020 blocks**, a count, not a sample, on the ids LODES joins. Each cell holds residents, workers, jobs by sector, inbound commuters and up to 8 weighted sub-points, so dots sit where people live and catchments sum sub-points, not a centroid ([EC-15](docs/history/lessons-ledger.md), [WD-06](docs/history/lessons-ledger.md)). Logan and the main road entries are gateways. With no transit (D17) the bus–car–walk choice starts from scratch; r1 checks the no-car share against ACS vehicles-available. V1's gravity and visitor matrices stay ([R01](docs/history/salvage-matrix.md)); M1 uses V1's β, r1 fits β to LODES. Paths are searched once and shared, and only the logit and assignment repeat per period: one period at ~800 cells interpolates to 50–130 ms ([AR-07](docs/history/lessons-ledger.md)), and the week-3 bench measures all three. The bake checks that map and demand agree.

**The bake** (`tools/bake/`, a port of V1's pipeline).
- **Fetch**, the only step that touches the source servers, hashes inputs into `sources.lock.json` and mirrors them to a GitHub Release. If the servers refuse GitHub's runners, you run `npm run bake:fetch` once (about 30 minutes).
- **The full bake** is a manually dispatched Actions job reading only the mirror, on two runners whose hashes must match. It publishes `sim.json`, the `.pmtiles` map and a report as release `city-boston-r<N>`.
- **PR CI** bakes only the committed mini-Boston fixture in under 30 s: every input clipped to lon −71.11…−71.07, lat 42.335…42.36 (3.3 × 2.8 km, Back Bay to Longwood, with Kenmore and Storrow Drive). Economy and e2e tests run on it, and **M1 runs on it by default**.
- **The deploy** downloads the files named in `cities/index.json`, checks SHA-256 and **fails** if one is missing; it never bakes. Bake and game read that one list ([K18](docs/history/salvage-matrix.md)).

**Pack: two files per city.** `sim.json` (JSON format 1; degree-2 collapse; no service roads in the routable graph) holds streets, cells, gateways, depot land and `calib`, ≤1 MB gzip (the street graph measured 208 kB). The `.pmtiles` map: hard gate ≤40 MB, target ≤15 MB, largest tile ≤200 kB; buildings, streets, paths, rail and water measured 4.0 MB gzip at z12–14 with a test encoder (the shipped tiles drop rail, D17); a z15 Protomaps cut is larger, unmeasured. Both have content-hashed URLs and no IndexedDB cache ([WD-04](docs/history/lessons-ledger.md)). **Format 1 freezes Sun Nov 8.** Saves record city, revision and hash and anchor stops by place ([WD-10](docs/history/lessons-ledger.md)); a missing pack is a readable refusal, never a substitute city (week 5, with an r1→r2 rebake save test). A rebake reaches the preview on merge, needs your OK after the Jan 17 freeze, and reaches Steam only in a version you ship.

**Bus access.** The routable graph honours `access`, `bus`/`psv`, `hgv=no` and `maxheight` under 3.5 m, so parkways closed to buses, such as Storrow and Memorial Drives, drop out; a name list in `adjust.json` covers any OSM leaves untagged. The bake report lists every excluded named road, and a fixture test keeps lines off Storrow Drive.

**No existing transit (D17).** The bake strips every public-transport feature from the sim graph and the tiles. Bus lanes (`busway=*`, `lanes:bus`/`lanes:psv`, `bus:lanes`/`psv:lanes`) become general lanes (`lanes=3` with one bus lane bakes as 3), their capacity back in the congestion model; bus- or PSV-only surface streets (`access=no` + `bus`/`psv=yes|designated`) open to all traffic; `highway=busway`, transitways and bus tunnels go. So do `highway=bus_stop`, `public_transport=*`, `amenity=bus_station`, shelters, every `route=bus|trolleybus|subway|light_rail|tram|train|ferry` relation, every `railway=*` line, platform and station, and ferry routes and terminals. Former corridors draw as plain ground, bus garages as plain buildings; Logan stays, a destination. Lane, `oneway`, `turn:lanes`, crossing and signal tags stay for §8 rule 9. **G10** fails the bake if any transit feature survives; the report lists every rewrite and removal, and a fixture test bakes a Back Bay bus lane as general lanes.

**Bake gates** (the bake refuses to write and names the number): G1 400–1,000 cells; G2 ≤16,000 nodes, one component with ≥98% of drivable km; G3 ≥99% of residents within 300 m of a street; G4 Σ `POP20` over Boston = 675,647 exactly, catching V1's 12-digit join bug; G5 geography sanity (no residents in water, Logan holds the airport gateway); G6 map and demand agree; G7 sizes; G8 two-runner determinism; G9 load ≤300 ms; G10 no transit feature in either file (D17).

**If a dataset fails:** servers refuse CI → your one local fetch; a source rolls over → the lock mismatches, and re-pinning is a deliberate PR; the Protomaps build disappears → Planetiler, or at worst V1's offline style from the sim pack (`Intralines@7af45b1:src/map/basemapStyle.ts:375-547`); few height tags → the r1 height join; over a cap or 150 ms → stay at Inner Boston; full pack not green by Nov 8 → the core box (§10); tiles over budget → a slim Planetiler profile; demand wrong where players know the city → per-cell overrides in `adjust.json`, listed in the report.

**Balance.** Inner Boston holds roughly 0.6–0.7 million residents (estimate), about five times Riverton's 128,010. **Boston is the reference city for every balance band.**

**City invariants (I10):** the same inputs give the same bytes; one connected network; ≥90% of built-up street nodes within 650 m of a populated cell; a stop with residents within 300 m draws riders within a game day ([K24](docs/history/salvage-matrix.md)); the sweep's best profitable first line, found without the reference line, costs ≤ the starting cash and turns a daily profit within a quarter (shown failing with a fare that makes every first line lose money); its best four-bus line costs ≥1.15× the starting cash; k stays in 1.0–1.8 ([GD-11](docs/history/lessons-ledger.md)).

**A second city** takes one or two Claude-weeks; non-US cities lack LODES.

---

## 6. Architecture and tech stack

**Call: one renderer, MapLibre GL JS pinned exactly at 6.11.2** (WebGL2; [CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)): one camera, flat 2D and tilted 3D. V3's three.js scene ([R13](docs/history/salvage-matrix.md)) had no tile pipeline and cost a 2.93× critical path ([RN-03](docs/history/lessons-ledger.md)), so there is no renderer fallback. **No renderer change after Sun Nov 1, including the custom-layer interface (every bus, icon or mesh, draws in one MapLibre custom layer); never two renderers.** three.js 0.186.1 draws only the artist's models in that layer, lazily, and the game runs without it. A week-5 proof behind a flag draws the `metro-40` blockout as one instanced mesh and measures chunk size and frame rate, so January only swaps assets.

**Stack.** Strict TypeScript, Vite, React 18 for chrome only, MapLibre in a lazy chunk (about 430 KiB gzip with its worker, measured), `pmtiles` 4.5.0, a style built from `@protomaps/basemaps` 5.7.2, Vitest, pinned Playwright ([K53](docs/history/salvage-matrix.md)), self-hosted Afacad Flux (§8), GitHub Actions; no PWA plugin. Pins are the newest releases at least two weeks old ([npm registry](https://registry.npmjs.org/), publish dates checked 2026-10-12): maplibre-gl 6.11.2 (2026-09-24), pmtiles 4.5.0 (2026-08-10), @protomaps/basemaps 5.7.2 (2026-03-10), three 0.186.1 (2026-09-24).

**The map.**
- **City files.** `CityTileSource` reads tiles by HTTP Range from the content-hashed file, with ordinary browser caching and no Cache Storage copy; if Pages refuses Range (week-1 check), it downloads the whole file with a progress bar; on desktop it reads from disk.
- **2D and 3D.** In 2D buildings are flat footprints with a hairline outline; in 3D, extrusions, cross-faded once per mode change, never per frame ([RN-04](docs/history/lessons-ledger.md)). From week 2 `T` sets pitch 50° with extrusions (a raw tilt); the chip, the eased cross-fade, right-drag and the snap flat below 12° land in week 10. 3D allows 25–60° at zoom ≥14. Bounds are the extent plus 1.5 km behind V1's board mask (`Intralines@7af45b1:src/map/overlays.ts:55-114`).
- **Buses.** One custom vehicle layer from week 4, the code-drawn glyph first: top-down icons as instanced quads in one draw call, flat to the screen when tilted, at least 20 px long (Sparrow), 24 (Metro 40) and 32 (Goliath) ([RN-05](docs/history/lessons-ledger.md)). **Meshes replace icons only in 3D at zoom ≥17**, where a Sparrow is 19 px at true scale (0.44 m a pixel at Boston's latitude, 512 px tiles); at zoom 15 it would be 5 px, V3's failure again. A mesh draws at the larger of true scale and its icon length, at most 2.5×, one draw call per family. Positions come from V3's pure `busPositionAt` ([S03](docs/history/salvage-matrix.md)); no symbol-layer stage, since a per-frame GeoJSON source lags the clock.
- **No GPU.** Since Chrome 139, machines without a usable GPU get no WebGL at all ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM/m/oLrB5up_BwAJ)). The ladder: hardware; then **Low graphics** (2D only, no extrusions, 30 fps); then a calm "turn on hardware acceleration" card, saves and Export intact.

**Platform seams for Steam** (D3). Only `src/platform/` touches browser storage, fullscreen, external links, reloads or `version.json` (a lint rule); a build alias picks `web/` now, `desktop/` from March 2027. It holds an **async `SaveStore`** whose export file equals a desktop save, the city file source, allowlisted links, quit hooks (never bind Shift+Tab), the theme setting and the **build chip**'s SHA. The web flavour has no service worker or Cache Storage (D12); a failed lazy chunk, worker or tile read (`vite:preloadError`, a 404) shows "This build was replaced · Reload": error recovery, not an update prompt, since nothing swaps. Relative URLs throughout. Cost: under a day.

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

**Save format.** V3's versioned envelope ([K11](docs/history/salvage-matrix.md)), intent only ([DP-05](docs/history/lessons-ledger.md)): city, revision and hash; `nextIds` for every kind ([K01](docs/history/salvage-matrix.md)); clock and RNG; stops by place; lines with three headways, depots, cash in cents, contracts, medals. No demand, geometry ([K12](docs/history/salvage-matrix.md)), camera or theme. **A schema-hash test fails CI on an unversioned schema change** ([SC-10](docs/history/lessons-ledger.md)). On the preview a bump sets older saves aside under a backup key ([DP-06](docs/history/lessons-ledger.md)) with a one-line notice and a fresh start; the envelope and Export session file record the build SHA, so a bug report replays at its commit. Migrations start with the Steam beta.

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
| I12 | 1366×768, light theme (bus contrast per theme is §8 rule 8), 50 buses of every family, heading away from the camera, at three cameras: 2D zoom 14; the `T` default (zoom 14, pitch 50°); the mesh switch (zoom 17, pitch 60°). Each bus is at least its family's minimum (20, 24, 32 px) and the layer changes ≥200 px; a 4 px meta-test must fail | [RN-05](docs/history/lessons-ledger.md), [K46](docs/history/salvage-matrix.md), [TS-07](docs/history/lessons-ledger.md) |
| I13 | Chrome ≤6% at rest, ≤26% with a panel, at three laptop sizes, in each theme (dark from week 13); reason-code copy ≤8 words | [UX-01](docs/history/lessons-ledger.md), [K31](docs/history/salvage-matrix.md) |
| I14 | Recompute ≤150 ms p95 on Boston, three periods; gzip menu ≤200 KiB with fonts, board ≤520 KiB, model chunk ≤200 KiB (three.js and loaders measured about 160 KiB), loaded when a tilted camera first reaches the mesh switch; `chunkSizeWarningLimit` at its default, the bundle test the gate; first frame ≤2.5 s on software GL; each style validates (dark from week 13); no frames while paused | [AR-07](docs/history/lessons-ledger.md), [AR-18](docs/history/lessons-ledger.md), [K21](docs/history/salvage-matrix.md), [RN-04](docs/history/lessons-ledger.md) |
| I15 | E2E on every PR: found, depot, draw, run a day, check cash, reload, compare; a tab of build A, after build B deploys, loads every lazy chunk and a tile read without error | [TS-06](docs/history/lessons-ledger.md), [DP-01](docs/history/lessons-ledger.md) |
| I16 | 2D/3D and theme parity: switching mode or theme changes no number, save byte or verdict; every layer and bus draws in all four | [GD-05](docs/history/lessons-ledger.md), [AR-04](docs/history/lessons-ledger.md) |
| I17 | Bake gates G1–G10; the fixture bakes twice to its golden hash | [WD-03](docs/history/lessons-ledger.md), [WD-09](docs/history/lessons-ledger.md) |
| I18 | Each model passes `check.mjs`; all v1.0 models ≤600 KB; bad fixtures fail | [RN-07](docs/history/lessons-ledger.md) |
| I19 | Host APIs only in `src/platform/`; no build, web or nightly desktop flavour, has a service worker or outside URL | [DP-09](docs/history/lessons-ledger.md), [K15](docs/history/salvage-matrix.md) |

**Budgets on real laptops** (weeks 4, 7, 10): 2D ≥55 fps on yours and ≥30 on the slowest with 200 buses; 3D at zoom 17, pitch 60, ≥30 fps; ≤7 vehicle draw calls; ≤10% heap growth over 30 minutes.

**CI and deploy.** The adversarial sweep runs on Boston and the fixture ([EC-12](docs/history/lessons-ledger.md)); two strategies, daytime at the longest headway with overnight at the shortest, and overnight toggled alone, must earn less than the best all-period setting, a check shown failing with V2's whole-day ridership restored ([EC-03](docs/history/lessons-ledger.md)); stop capacity and spill are per period. Economy PRs quote before and after ([PR-02](docs/history/lessons-ledger.md)).
- **PR checks, 8 minutes:** typecheck, lint, tests, schema hash, bundle budget, outside-URL check ([S20](docs/history/salvage-matrix.md)), `bake:fixture`, style, palette and contrast tests on each theme that exists (light from week 1, dark from week 13; [S21](docs/history/salvage-matrix.md)), I12, changelog check, smoke with axe-core, art check, a 60-second sweep. Slower checks go nightly and never block ([UX-08](docs/history/lessons-ledger.md)).
- **Nightly:** full sweep, bench, `npm audit`, the MBTA realism report; from week 9 the desktop-flavour build.
- **Deploy:** every merge to `main` deploys the preview, always; tags publish nothing. Pages replaces the whole site, so the deploy copies the last two deploys' hashed `assets/` and city files into the new artifact (V1's `retain-assets.mjs`, §7; why in §11). The Pages environment admits `main`, no cancelling ([DP-02](docs/history/lessons-ledger.md)); a last step loads the live URL in Playwright with a cache-busting query and passes when the build chip, `version.json?run=<run_id>` and `GITHUB_SHA` agree. **`main` is protected** (§14 item 2): merge commits only, so a release commit keeps its SHA. LFS before the first binary ([PR-07](docs/history/lessons-ledger.md), [DP-11](docs/history/lessons-ledger.md)).

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
| Art pipeline | REWRITE-FROM, when a file lands | `Intralines@7af45b1:{docs/MODELS.md, scripts/check-models.mjs, scripts/make-sample-model.mjs}`; `Intralines_City@dc63602:{scripts/models/build.ts, src/render/three/modelBudgets.ts, studio/viewer/}` | glTF axes; instancing, not per-bus clones ([K09](docs/history/salvage-matrix.md)); no KTX2 or auto-decimation |
| Demand model | REWRITE-FROM [R01](docs/history/salvage-matrix.md)–[R03](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/sim/demand.worker.ts`; V2 `Gaming/src/30-sim.js` | No caps ([K04](docs/history/salvage-matrix.md), [K23](docs/history/salvage-matrix.md)); per-boarding fare ([K05](docs/history/salvage-matrix.md)); hourly crowding ([K27](docs/history/salvage-matrix.md)); captive ceiling ([K28](docs/history/salvage-matrix.md)); linked trips ([K47](docs/history/salvage-matrix.md)); 130 m radius ([K50](docs/history/salvage-matrix.md)) |
| Fares, express | REWRITE-FROM | V2 `Gaming/src/30-sim.js:70-103, 2636-2662`; `Intralines@7af45b1:src/game/constants.ts:397-412` | Taper ([K49](docs/history/salvage-matrix.md)); starters are not express ([K16](docs/history/salvage-matrix.md)) |
| Headway, fleet, report card | REWRITE-FROM [R04](docs/history/salvage-matrix.md), [R05](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/constants.ts:310-387`, `src/game/store.ts:403-520` | Buses cost money ([K42](docs/history/salvage-matrix.md)); real reliability ([K03](docs/history/salvage-matrix.md)) |
| Traffic | REWRITE-FROM [R10](docs/history/salvage-matrix.md) | V2 `Gaming/src/20-city.js:1387-1490` | One `congestionAt()` for timing and ridership ([K06](docs/history/salvage-matrix.md)) |
| Contracts, events, undo, route edits, transfers | REWRITE-FROM [R06](docs/history/salvage-matrix.md), [R08](docs/history/salvage-matrix.md), [R09](docs/history/salvage-matrix.md) | V2 `Gaming/src/30-sim.js:4576-4972`, `Gaming/docs/design/` | Bounded variance ([GD-04](docs/history/lessons-ledger.md)); no sim snapshots ([K22](docs/history/salvage-matrix.md)); buses anchored ([K32](docs/history/salvage-matrix.md)) |
| Shell, menu, founding | REWRITE-FROM [R07](docs/history/salvage-matrix.md), [R11](docs/history/salvage-matrix.md) | V2 `Gaming/docs/design/screen-layout.md`; `Intralines@7af45b1:src/ui/` | Labelled chips ([K20](docs/history/salvage-matrix.md)); one draft preview ([K10](docs/history/salvage-matrix.md)) |
| Deploy asset retention | PORT, week 1 | `Intralines@7af45b1:scripts/retain-assets.mjs` (`d66e6dc`, 73 lines) | Also keeps the previous city files; the matrix dropped it for V3's PWA, which D12 drops |
| Electron shell | PORT [S19](docs/history/salvage-matrix.md), Steam workstream | `Intralines@7af45b1:electron/main.cjs` | Sandbox kept; a real build id; no service worker ([K15](docs/history/salvage-matrix.md)) |
| Harness seeds | Rebuild as tests ([T01](docs/history/salvage-matrix.md)–[T07](docs/history/salvage-matrix.md)) | Salvage matrix §B5, if handed over | Named tests as systems land ([TS-08](docs/history/lessons-ledger.md)) |
| DROP | — | V1 store, panels, mesh layer, recovery layers but asset retention, IndexedDB pack cache, online tiles, city generator; V2 UI and company type; V3's PWA and update prompt ([S08](docs/history/salvage-matrix.md), D12), three.js scene and model pipeline | [K09](docs/history/salvage-matrix.md), [DP-01](docs/history/lessons-ledger.md), [WD-04](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md) |

---

## 8. Look, feel and UX

**Decided (D8): "sleek but detailed and intricate." Call: quiet base, loud data.** The whole real city is drawn in low-chroma tones with fine linework; saturated colour is reserved for what the player builds. Subway Builder does this ([review](https://punishedbacklog.com/subway-builder-review/)), and Protomaps' light flavor builds road hierarchy from width, not hue ([flavors.ts](https://github.com/protomaps/basemaps/blob/main/styles/src/flavors.ts)). V1's identity ([RN-08](docs/history/lessons-ledger.md)) carries over as a hue family and the board.

**Style rules** (palette and contrast tests enforce them on each token set, [S21](docs/history/salvage-matrix.md)):
1. Base colours at OKLCH chroma ≤0.04 (water ≤0.07); game colours ≥0.12; contrast holds in both themes.
2. Road hierarchy by width and casing in five classes (in light, white streets and pale amber arterials), casings from z14.
3. Intricacy from hairlines that arrive with zoom: the street grid at overview, then building outlines, shorelines and cased bridges from z15, footpaths from z16, lane markings from z17 (rule 9). Detail never piles up at overview.
4. Buildings: in 2D a fill a notch off the land tone with an outline; in 3D a warm-to-cool height ramp with a vertical gradient. Land use tints the ground (parks, water, campuses, industrial land), never the buildings.
5. One typeface, **Afacad Flux** (D13), variable (weight 100–1000, slant −14…14), OFL 1.1 ([google/fonts](https://github.com/google/fonts/tree/main/ofl/afacadflux), checked 2026-10-12), self-hosted: static 400 and 600 instances cut at build time (pinned fontTools `varLib.instancer`) become two Latin woff2 files, about 23–29 KB together (measured 2026-10-12), counted in the menu budget, and feed MapLibre's SDF glyphs (§14 item 4). 10–14 px; neighbourhoods letter-spaced capitals; arterial names from z13, local from z14.5; density caps; basemap POIs off except hospitals and universities (no transit stations exist, D17).
6. No existing transit is drawn (D17): no rail or subway lines, stations, bus stops, bus lanes or ferry routes; former rail corridors read as plain ground. No MBTA colours, logo or branding anywhere.
7. Data layers flat and unlit; buildings and vehicles inside a 0.75–1.15 lighting envelope ([RN-06](docs/history/lessons-ledger.md)).
8. **Light and dark (D13): one generator, two token sets**; the system setting picks, a settings toggle overrides. No night palette: the day/night tint runs in light, off or faint in dark ([RN-13](docs/history/lessons-ledger.md), [RN-14](docs/history/lessons-ledger.md)), so in both the clock chip names the period (Peak, Off-peak, Overnight) and a line with overnight off fades while stopped (dashes already tell lines apart, [RN-09](docs/history/lessons-ledger.md)), from one `sim/rules` predicate. Bus ink and halo and line colours are theme tokens, tested in three states: light at day, light at the darkest tint step, dark. Dark joins every theme test in week 13 (until then the generator need only accept a token set), going nightly if PR checks would pass 8 minutes. Dusk lights come from the models.
9. **Lane markings at close zoom** (z≥17), render-only from tags the bake keeps: dashed white dividers by OSM `lanes` (else inferred from road class; the bake report gives the share), double centre lines, zebra crossings and stop bars, flat on the ground and short of junctions; turn arrows later. January's first cut.

**Starting light tokens** (proposal): land `#ebe7df`, void `#d6d2c9`, buildings `#dcd6ca` outlined `#cfc8ba`, water `#b6d4e8`, parks `#d5e4c6`, white streets cased `#cfc8ba`, arterials `#f9e9c8` cased `#e3c48d`, labels `#5c574d`. **On Sun Nov 8 you pick the light set, these or pure V1 paper**, side by side on Boston; the network hues are checked against it and a placeholder dark land and void (two hex values), so January adds only the dark base tokens.

**The chrome** stays flat and crisp, after V3's labelled chips (`Intralines_City@dc63602:src/ui/TopBar.tsx:73-79`); no emoji ([UX-10](docs/history/lessons-ledger.md)); a side-by-side with V1 at every milestone. **Call: the shell is measured from the first screen:** chip row and chrome script in week 1, full shell in week 4 ([UX-02](docs/history/lessons-ledger.md), [SC-04](docs/history/lessons-ledger.md)).

**Screen budget (I13).** Chrome ≤6% at rest and ≤26% with a panel at 1440×900, 1366×768 and 1152×720; the 2D/3D chip and the 12 px build chip (in the OSM-attribution corner) count. Labelled chips: date, speed, Cash, Riders/day, Grade, Contracts ([K20](docs/history/salvage-matrix.md)). A dock of ≤8 slots. No inspector at rest; notices in one corner ([UX-05](docs/history/lessons-ledger.md)). At most three overlays: Residents, Jobs, Traffic ([UX-12](docs/history/lessons-ledger.md)).

**Rules drawn on the map**, each from its `sim/rules` predicate ([GD-05](docs/history/lessons-ledger.md)): the depot tint; the 650 m walk ring; a 250 m snap ring ("joins Mass Ave · transfer"); express chevrons; QUIET/LOSS as icon and word; contract rings with progress; events hatched a day ahead; ribbon width by frequency, dashes as well as colour ([RN-09](docs/history/lessons-ledger.md)); refusals in money, "$55k short" ([UX-03](docs/history/lessons-ledger.md)).

**Call: bus icons are rendered from the artist's models:** CI renders each model straight down into a mask the game paints with company and line colour, so 2D and 3D match; hence the roof stripe ([docs/art/MODELS.md](docs/art/MODELS.md) §5). Until the first blockout, a code-drawn top-down glyph stands in, never upside down westbound like V1's `BusSide`; I12 holds the minimum lengths, since V3's test passed at 6 pixels ([RN-05](docs/history/lessons-ledger.md), [TS-07](docs/history/lessons-ledger.md)).

**Charm: one or two moments per milestone** ([GD-08](docs/history/lessons-ledger.md)), cut one by one if late. **Accessibility, proportionate** ([UX-08](docs/history/lessons-ledger.md)): shape plus colour, keyboard shortcuts, 24 px targets, chrome text ≥12 px at 1280×800 (Steam Deck needs it later), reduced motion, axe-core.

---

## 9. How the team works

**Roles** (decided D6).
- **You: owner and lead player.** You decide scope, look and title; start Claude sessions; play each milestone; review each art delivery (about 30 minutes, five times; [docs/art/MODELS.md](docs/art/MODELS.md) §9). You alone create versions, and later press Steam's release buttons.
- **The artist (the co-developer): the 3D models the game uses.** `metro-40`, `sparrow` and `goliath`, then a depot, to [docs/art/MODELS.md](docs/art/MODELS.md), a draft the artist amends by Sun Oct 18; later landmarks and Steam capsule art; milestone playtests on a second machine, except M4, so P2 finds the artist fresher ([TS-10](docs/history/lessons-ledger.md)). No delivery falls on a playtest date.
- **Claude:** code, tests, docs, a one-page summary per milestone, at most five questions a week ([PR-03](docs/history/lessons-ledger.md), [PR-05](docs/history/lessons-ledger.md)).

**How art flows.** The artist exports a `.glb` with the contract's settings and opens a PR under `art/models/` with Git LFS (D6). From week 5 CI checks it and renders the icon; you review it as above. A failing file never reaches players: the game keeps the latest passing file, else a built-in box bus.

**Ownership** (D14, [docs/art/MODELS.md](docs/art/MODELS.md) §11). The repo is public, so committed art can be downloaded: `art/LICENSE.md` lands by Oct 18, before the first `.glb`; you both sign a short agreement before the store page (Sun Mar 21 2027). Not legal advice.

**Capacity.** You give 2–4 hours a week; the artist's are not tracked. **One Claude-week ≈ 2.5 sessions of 2–4 hours**, each ending in one or two merged PRs: 5–6.5 a week to Dec 20, about twice the old pace (estimate), 2–5 in January and half weeks (§10). Velocity is checked Oct 18, Oct 25 and Nov 1; if lower, the cut list moves.

**Claude session rules** live in `CLAUDE.md` ([PR-08](docs/history/lessons-ledger.md), [PR-11](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)).

**Call: only you create versions** (CL, [PR-15](docs/history/lessons-ledger.md)): only `/ship <version>`, typed by you; a player-visible change adds a line under Unreleased in the same commit; milestone tags such as `prototype` never start with `v`; RC1 and RC2 are builds named by SHA unless you type `/ship 1.0.0-rc.N`; a version publishes nothing new: its PR's merge redeploys the preview like any merge.

**Done.** A PR is green, updates the docs it touches ([PR-06](docs/history/lessons-ledger.md)) and is live: the deploy's last step found its SHA in the preview's build chip and `version.json`. A milestone also needs your play notes in `docs/playtests/`, citing the chip's SHA ([PR-13](docs/history/lessons-ledger.md)).

**Call: playtests take a middle path; you and the artist test** (D6). Every milestone each of you checks for 10 minutes: what did you try, where were you stuck, what was dull or ugly, is it Boston? **P0** this week: V1, 30 minutes each ([GD-07](docs/history/lessons-ledger.md)). **P1** Nov 22: a quarter each. **P2** Dec 12–13 and **P3** Jan 22 (both themes): a fresh save each, notes before talk. You are never untold, so the artist is the fresher tester; outside players, once named, go first: in the week of Dec 21 Claude asks you to name one or two for P3 or keep it to you two (recommendation: name them). **No merge to `main` from 18:00 the day before a playtest until its notes are committed** ([PR-13](docs/history/lessons-ledger.md)); sessions keep working on branches. `docs/playtests/PROTOCOL.md`: the chip's SHA at each session's start and end, matching; no help for 10 minutes; first line ≤3 min, profit ≤8 min, a 1–5 keep-playing score. **If P2 shows the step after the first line is unclear,** week 10 goes to onboarding and its chip, drag and style items move to January; **if either of you scores below 3,** January's look time goes to contracts and pacing.

**Call: few docs; this plan is not a living spec.** §0 is the page you read; only §10's table changes at milestone close; if anything drifts, `docs/SCOPE.md` and `docs/DECISIONS.md` win, and on Mar 1 this file is rewritten short. Beyond the files named here, the repo keeps `docs/specs/current.md`, `docs/playtests/`, bake reports and the frozen `docs/history/`.

---

## 10. Milestones and calendar

Weeks run Monday to Sunday; checks use the deployed build.

**What the decisions cost** (Claude-weeks, estimates). **First round, net about +3 (+2.75 to +3.25):** +3.25 to +3.75 in weeks 1–7 (Boston, the map, 2D/3D and art tools, less Riverton, the generator, the spike and itch.io) and −0.5 in January. **Second round (D4–D13), about −0.1:** −1.25 as the web release leaves (0.5 by week 9, 0.75 in weeks 15–17; D12); +0.6 dark mode (0.5 in week 13, 0.1 in week 14), +0.25 the overnight period (weeks 3–5), +0.2 the font toolchain and +0.1 keeping old deploys' files (week 1). **Total about +2.7 to +3.2**; Steam's March gains about 0.5 for migrations and update tests. The trade: dark mode makes the lane markings, cut 1's kept item, the likely January cut.

**Call: Feb 7 holds, paid for by sessions, not buffer:** 5–6.5 a week (the Sessions column). Buffer: **none before M3** (Nov 22; deadline in the half Thanksgiving week, hourly congestion the valve to 1.1) or **M5** (Dec 20; deadline Jan 3); **about half a session from Jan 4 to Feb 7**, in week 14 before the freeze, so cut 1 is taken now (the model path may start in weeks 11–12 if M5 is signed off Dec 20; art is not a system); **three weeks from Feb 7 to Feb 28.**

| Wk | Dates | Sessions | Focus | Exit check (you, 10 min) |
|---|---|---|---|---|
| 1 | Oct 12–18 | 5.5 | **M0 Boston board.** Scaffold, CI, the Pages preview with old deploys' files kept, build chip, platform fence, LFS; Boston tiles and Pages headers measured; MapLibre, light style v0, Afacad Flux glyphs; bake skeleton; mini-Boston fixture; V1 playable. **P0.** Artist: contract review, art licence line | Boston opens flat, every arterial named in Afacad Flux; after the next merge a reload shows its SHA on the chip, and a tab left open still works |
| 2 | Oct 19–25 | 6 | Ports; worker host; V1's pipeline ported; census to cells, `sim.json` and G1–G7 on the fixture; dots; raw tilt (`T`, ≤0.5 session); smoke; height-tag count. Artist: **`metro-40` blockout Oct 25** | `T` tilts and returns; dots sit where Back Bay to Longwood lives and works; "people within a walk"; does it look like Boston? |
| 3 | Oct 26–Nov 1 | 5 | **M1 First dollar, on the fixture.** Demand with V1's β; fare and subsidy income; daily close; I1, I2; recompute bench, three periods; line, stop and demand layers; the Inner Boston bake runs. **Capacity check; R2 recompute check (D11, three periods) Nov 1** | A debug line from Back Bay to Longwood: riders board, money comes in, the day card adds up |
| 4 | Nov 2–8 | 6.5 | **M2 First line.** Shell; line tool; depot tint; three-period headway to purchase (format 1 holds all three; the overnight control may land in week 5), overnight sweep strategies; all costs; vehicle layer with the code-drawn glyph; I12. **Full Inner Boston pack green; format freeze; light token pick (≤0.5) Nov 8.** Artist: `sparrow`, `goliath` blockouts | Found, depot, 4 stops, every 20 min, overnight off: cash moves exactly as the inspector said |
| 5 | Nov 9–15 | 6 | Stop tiers, flags; fare band; Finance; Metro 40 and Goliath rows; undo; slots, autosave, export; place-anchored stops, the missing-pack refusal, the r1→r2 save test; sweep in CI; credits, `LICENSE-DATA.md`; **`city-boston-r1` Nov 15** (β fit, full-cell demand, `tripScale` re-measured, starting cash derived, heights by the week-2 rule); art check and icons, CI only (≤0.5); three.js proof behind a flag (≤1) | Undo a stop while paused: cash back to the cent; an hour later, refused with a reason |
| 6 | Nov 16–22 | 5 | **M3 Money loop.** Report card; failure floor; HEADWAY contracts; checklist; Export session. **P1** | Checklist → profitable day → contract in about 8 min; the report card; overspend → countdown → restart |
| 7 | Nov 23–29 | 2.5 | Thanksgiving, half a week: transfers; route remove and extend; hourly congestion if it fits, else 1.1 (cut 8). **M3 deadline Nov 29.** Artist: **`metro-40` final Nov 29** | Two lines share a stop at Kenmore and riders transfer |
| 8 | Nov 30–Dec 6 | 5 | **M4 Goals. System cutoff Dec 6.** RIDERSHIP contracts; events; medals; express behind I3; route insert; full sweep. Artist: **`sparrow` final Dec 6** | A Longwood contract; roadworks a day ahead; insert a stop and no bus jumps |
| 9 | Dec 7–13 | 5 | **Tuning freeze:** Boston's bands and starting cash's k; pacing; Home; save list; GPU ladder; model viewer with the Boston-map preview (≤1.5). **P2 Dec 12–13** | The scripted pacing run meets §3's targets; Home to a profitable day in ≤8 minutes |
| 10 | Dec 14–20 | 5 | **M5 Prototype.** P2 fixes; the 2D/3D chip, drag, snap and cross-fade; light style pass; slow-laptop run, flat and tilted. **Tag `prototype` Dec 20** (D16). Artist: **`goliath` final Dec 20** | Home → founding → a profitable day |
| 11–12 | Dec 21–Jan 3 | 2 | Holidays: fixes only, or the model path if M5 is signed off. **M5 deadline Jan 3** | — |
| 13 | Jan 4–10 | 5 | Model path: instancing per family, the mesh switch, the 3D I12 cameras; **dark theme**: token set, palette, contrast and I13 runs; look and charm. Artist: in-map fixes, depot **Jan 10** | Three families glide in 3D at ≥30 fps; light and dark side by side; beside V1, ours or a tie |
| 14 | Jan 11–17 | 4.5 | **M6 Content freeze Jan 17**, the city revision included. Help; settings with the theme toggle; accessibility; credits screen; close-zoom lane markings (first cut); polish if green. RC1 | Ten minutes in Boston, flat and tilted, light and dark; nothing unfinished |
| 15 | Jan 18–24 | 2 | RC1 fixes; **P3 Jan 22** | P3 notes in, both themes, each citing one SHA |
| 16 | Jan 25–31 | 2.5 | **M7 Release candidate.** P3 fixes; RC2; checklist run | Every checklist line ticked by a person |
| 17 | Feb 1–7 | 2 | **v1.0 complete on the preview, target Sun Feb 7**; `/ship 1.0.0` if you choose | The preview loads on a computer that never saw it |
| 18–20 | Feb 8–28 | — | Buffer: fixes; if you take the Steam proposal (D15), a ≤2-hour Electron smoke (§11). **RC deadline Feb 14; hard deadline Feb 28** | — |

**Cut first if late, in order:** (1) map extras: building grow-in, narrow-FOV 2D, extra labels (**taken now**, for January slack), keeping only the close-zoom lane markings, January's first cut; (2) express lines; (3) the artist's 3D models in v1.0: 3D shows icons, three.js never ships, the models still draw the 2D icons and reach 3D with Steam; (4) events down to roadworks; (5) free tilt becomes two fixed states, flat and 50°, with no drag or snap; (6) route insert; (7) the top medal (the Goliath stays buyable); (8) hourly congestion; (9) the report card to three categories.

**Never cut:** Boston from real data, in an extent that passes the bake gates (the extent flexes; Boston stays); D8's floor: building footprints, street hierarchy, water, parks, land use and street labels; D17's no-transit city; flat 2D and a way into 3D; the self-hosted city file, Afacad Flux and OSM attribution; the money loop, contracts, failure floor and checklist; three headway periods in format 1 (D7); the calm shell; save integrity, the build chip and platform seams; invariants, sweep and smoke; I12; the GPU ladder; your playtests, P2 and P3.

**Triggers.** A trigger that reaches a decided item (cut 3 touches D6, cut 5 touches D2, a late dark theme touches D13) becomes that week's question to you, with a recommendation; the answer goes in DECISIONS.
- **Velocity, Sun Oct 18 and Oct 25:** under two-thirds of the Sessions column → the next week's map and look items wait for M3.
- **First-dollar signal, Sun Oct 25:** a headless fixture test where one line writes a fare row to the ledger. Red → week 3 drops all map work.
- **No `metro-40` blockout by Sun Nov 1:** no art pipeline yet; buses keep the code-drawn glyph ([RN-07](docs/history/lessons-ledger.md)). **None by Sun Nov 22:** the art checker waits for week 13.
- **First dollar not in by Sun Nov 1:** guards move to nightly, map work stops beyond what M2 needs, and every session works on income.
- **Sun Nov 1 capacity check, more than a week behind:** the week-4/5 presentation items (the light token pick, the art check, the three.js proof) wait for M3, and cut 2 applies.
- **Full Inner Boston pack not green by Sun Nov 8:** format 1 freezes on the fixture-proven schema, and the extent shrinks to a core box that passes G1–G10 (for example Back Bay–Downtown–Kendall–Longwood, about 25–35 km²); R2 and all of Boston become 1.1. r1 publishes Nov 15 either way.
- **3D under 30 fps on the slowest laptop (week 7):** raise the 3D zoom floor to 14.5, drop the extrusion gradient and blending, and cap pitch at 50°; still slow → meshes only at zoom ≥18, icons elsewhere.
- **M3 not signed off by Sun Nov 29:** cuts 2 and 4, and cut 5 (your call), which removes the week-10 drag and snap work. **A week-8 item not green by Dec 6:** it moves to 1.1.
- **No passing `metro-40` final by Sun Dec 13:** you decide cut 3 with the prototype on Sun Dec 20; if taken, week 13 becomes polish or buffer. **No passing `sparrow` or `goliath` final by Sun Jan 10:** that family keeps its blockout or the procedural box.
- **M5 not signed off by Sun Jan 3:** cut 3 (your call) and charm items; the target moves to Sun Feb 21, with content freeze Sun Jan 31, P3 Fri Feb 5 and RC Sun Feb 14.
- **Dark theme not green by the content freeze (Jan 17, or Jan 31 under the M5 trigger):** your question that week (recommendation: dark waits for Steam; then P3, the checklist and the theme tests run light only).
- **RC not green by Feb 7:** v1.0 completes the Sunday after. **Not by Sun Feb 14:** you decide that day whether v1.0 is complete on Feb 28 or testing goes on; any `/ship` number is yours, above any rc you shipped.
- **Two quiet weeks:** cut the next item at the next session ([SC-11](docs/history/lessons-ledger.md)).

---

## 11. Preview now, Steam is the release

**Decided (D3, D4, D12): Pages is your preview; Steam, at about US$10, will be the only version.** The price waits for the store page.

| Platform | Needs | Verdict |
|---|---|---|
| **GitHub Pages**, `bobbyjohn-nil.github.io/interbus` | The deploy workflow and both Pages gates ([DP-02](docs/history/lessons-ledger.md)); city files as release assets. Limits: a 1 GB site, a soft 100 GB a month, no commercial software ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) | **The preview**, from week 1; every merge to `main` |
| **Steam** | US$100 per game, recouped after US$1,000; release ≥30 days after paying; Coming Soon ≥2 weeks; reviews of 3–5 business days; legal-name, tax and bank onboarding ([Steam Direct](https://partner.steamgames.com/steamdirect), via search excerpts) | **The release**, after v1.0 |

**The preview (D12).** No custom domain, service worker, offline mode or update prompt. Pages sets its own cache headers, reportedly `max-age=600` on every file ([Stack Overflow](https://stackoverflow.com/questions/14798589/github-pages-http-headers), a search excerpt, not an official page, checked 2026-10-12; the week-1 check records the real value), so `index.html` cannot be served uncached and only a reload is sure to fetch the newest build. Each deploy keeps the last two deploys' files (§6), so a tab opened before a merge, or a visit just after one, runs the previous build intact, its SHA on the chip; a file gone anyway brings the replaced-build card ([DP-01](docs/history/lessons-ledger.md)). Older saves are set aside on a schema change (§6); Export session stays for bug reports. Supported: current Chrome, Edge and Firefox with WebGL2, Safari if a Mac is available; mouse and keyboard; 1152×720 or larger.

**Privacy.** No analytics, ads, accounts or third-party requests; CI fails on any outside URL ([S20](docs/history/salvage-matrix.md)).

**Licences and credits** (not legal advice; ask the OSMF Licensing Working Group before a paid release if unsure).
- **OpenStreetMap (ODbL 1.0):** "© OpenStreetMap contributors" in a map corner whenever the map shows, linked to [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright), plus credits and store page ([guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)). **Call: publish both city files under ODbL as public release assets, with the bake recipe in this repo** (D14); that meets share-alike and keeps a Steam build with DRM compliant. Code and art keep their own licences.
- Census data is public domain, credited anyway; Protomaps BSD-3 and ODbL while its build is used; Afacad Flux under OFL 1.1 with its licence text; a generated `THIRD_PARTY_NOTICES` for libraries; MBTA data never ships. The build carries `LICENSE-DATA.md` and a credits screen generated from each pack.
- **Before selling (D14):** a repo licence and the signed art agreement (§9).

**v1.0 checklist** (`docs/RELEASE.md`): a 30-minute soak, flat and tilted, light and dark; played on three machines, once without hardware acceleration; P3 notes in; attribution, credits and licence files present; the chip matches `main`. The Steam checklist later adds save migrations, update and offline tests, and store assets.

**Steam: a proposal for your say (D15: by Feb 7 to keep Jul 13; low priority).** No Steam work starts before you say, and Claude's Steam code no earlier than Mon Mar 1. Dates are from Valve's pages via search excerpts ([Next Fest June 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027), [Steam Direct](https://partner.steamgames.com/steamdirect), checked 2026-10-12); check each before relying on it.

| When (2027) | What |
|---|---|
| After v1.0 is complete | The account holder onboards (legal name, bank, a 2–7 business-day tax check, a possible ID check) and asks Valve whether a free web build affects Next Fest |
| From Feb 8 | The artist's capsule and library art; a ≤2-hour Electron smoke on a throwaway branch |
| Mar 1–28 | The fee paid by Mar 7 (the 30-day clock); Claude ports the Electron shell and desktop platform, save migrations and update tests, Steam Cloud, achievements from medals, a beta branch, screenshots and a trailer from replays |
| By Sun Mar 21 / ~Apr 6 | Outside players on the beta; signed art agreement (D14); store page submitted / Coming Soon live |
| Apr 25 / Jun 14–21 | Next Fest registration / Next Fest |
| **Tue Jul 13** | **You press Release App**, after the Summer Sale, with the CHANGELOG entry as notes |

Effort: about 3.5–4.5 Claude-weeks and 10–15 of your hours; under cut 3, 1 more Claude-week for the model path and only the Jul 13 window (D15 option A). **Electron**, as it bundles the Chromium CI tests; Windows first, unsigned through Steam (community evidence; check), on the Windows PC named in D15; Deck through Proton; macOS needs notarization and a US$99 yearly membership ([Apple Developer Program](https://developer.apple.com/programs/), checked 2026-10-12; check before relying on it), so it waits for D15. The Content Survey, AI use included, is answered truthfully.

---

## 12. Risks and mitigations

1. **Real-city data eats the schedule** ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md), [WD-04](docs/history/lessons-ledger.md), [WD-09](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)). Pinned static files; a gated, dispatch-only bake; M1 on the fixture, so money never waits; the Nov 8 pack, core-box trigger and format freeze.
2. **3D ambition crowds out the game** ([RN-03](docs/history/lessons-ledger.md), [RN-05](docs/history/lessons-ledger.md), [RN-07](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)). One renderer; 3D is extrusions plus a lazy model path proven in week 5; at most one session in three on look, 3D or art until M3; renderer code capped near 2,500 lines (V3 reached 4,400); no pivot inside a milestone; cuts 3 and 5.
3. **The money loop closes late** ([GD-01](docs/history/lessons-ledger.md)). First dollar in Boston by Nov 1 with its trigger; cheapest guards only.
4. **Boston's density breaks the balance** ([X-08](docs/history/lessons-ledger.md)). Boston is the reference city; `calib.tripScale` from its first-line band; the sweep runs on it.
5. **Momentum dies** ([SC-11](docs/history/lessons-ledger.md)). A merged PR and a note weekly; velocity checks from Oct 18; the quiet-weeks trigger; three buffer weeks after Feb 7.
6. **Not fun** ([GD-07](docs/history/lessons-ledger.md), [TS-10](docs/history/lessons-ledger.md)). P0, the protocol, P2 before the tag, P3, the charm budget. With two insiders the untold targets and P2's onboarding trigger are weak signals: the week-9 scripted pacing run ([GD-10](docs/history/lessons-ledger.md)) is the objective check, and outside players, on the Steam beta at the latest, come before the store page.
7. **You do not like the look, or two themes double colour QA** ([RN-02](docs/history/lessons-ledger.md), [RN-13](docs/history/lessons-ledger.md), [RN-14](docs/history/lessons-ledger.md)). Boston on screen in week 1; a token pick for Nov 8; side-by-sides; one generator and a three-state colour test (§8 rule 8).
8. **Exploits or balance thrash** ([GD-13](docs/history/lessons-ledger.md), [EC-12](docs/history/lessons-ledger.md), [SC-08](docs/history/lessons-ledger.md)). Invariants, the sweep in CI, the Dec 6 cutoff.
9. **Saves or deploys break** ([DP-01](docs/history/lessons-ledger.md), [DP-04](docs/history/lessons-ledger.md)). The schema hash, I7, I8, place-anchored stops, set-aside saves; old deploys' files kept and the I15 swap test; migrations and update tests with the Steam beta.
10. **It runs badly or not at all** ([AR-07](docs/history/lessons-ledger.md), [RN-04](docs/history/lessons-ledger.md)). Worker sim, instanced icons, render on change, laptop budgets, the GPU ladder.
11. **Art late, over budget or unowned** ([RN-07](docs/history/lessons-ledger.md), [X-15](docs/history/lessons-ledger.md)). Blockout first; budgets that fail with numbers; the fallback ladder; the licence line before the first file.
12. **Licences block Steam.** City files and recipe public under ODbL from week 5; attribution from the first map.
13. **Process bloat or lost work** ([PR-04](docs/history/lessons-ledger.md), [PR-07](docs/history/lessons-ledger.md)). No crew, few docs, one owner session, merge commits only, owner-only versions.
14. **The preview gives the Steam game away.** The repo is already public, so code, city files and LFS art are downloadable regardless. Pages sites are public even from private repositories short of Enterprise Cloud ([visibility](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)), and on GitHub Free a private repository gets no Pages unless the account pays for Pro ([plans](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site); both via search excerpts, checked 2026-10-12; check before relying on them). D15 decides both before the store page.

---

## 13. Decisions

Answers go in [docs/DECISIONS.md](docs/DECISIONS.md), with how to reverse each. Until answered, the plan assumes the recommendation.

**Decided 2026-10-12**

| # | Decision | Your choice | What it changed |
|---|---|---|---|
| D1 | Cities | **Real cities first; Boston is the first and test city** | §5; procedural only as fixtures; no third city |
| D2 | Renderer | **A flat 2D mode that tilts into 3D** | §6; no renderer fallback |
| D3 | Platform | **GitHub Pages now; Steam eventually** | Platform seams (§6) |
| D4 | Release | **Steam will be the only version, about US$10; timing later** | No public web release; Feb 7 is v1.0 complete on the preview (§4, §11) |
| D5 | Title | **interbus** | A name check before the store page (§1) |
| D6 | Roles | **The co-developer is the 3D artist; hours untracked; PRs with Git LFS; you two playtest, more later** | §9 |
| D7 | Save format | **Starting cash scales with a line or two; peak, off-peak and overnight headways; no import** | §2, §3; I1, I3, I10, I11, the sweep; per-line fares stand |
| D8 | Look | **"Sleek but detailed and intricate"** | Quiet base, loud data (§8) |
| D9 | Out list | **Accepted** | §2's table; `docs/SCOPE.md` |
| D10 | Failure | **The §3 floor** | Week 6 |
| D11 | Play area | **Inner Boston; R2 only if recompute ≤100 ms** | §5; the Nov 1 check, three periods |
| D12 | Web build | **A preview for you to look and test; saves don't matter yet** | §6, §11 |
| D13 | Look | **Light and dark modes; Afacad Flux** | §8; dark in January |
| CL | Versions | **Versions only on your say** | `/ship` and its CI check |
| D17 | Existing transit | **None, for now; bus lanes become general lanes** | §5 and G10; §8 |

**Still open**

| # | Decision | Recommendation | By |
|---|---|---|---|
| D14 | Licences: art holder and terms; city files under ODbL; repo licence; signed art agreement | **Art all rights reserved; publish the city files; write the rest down** | Art **Oct 18**; city files **Nov 8**; rest before the store page is submitted (**Mar 21 2027**) |
| D15 | Steam window, account holder, macOS, a Windows test PC; the preview and the repo's visibility (§12 risk 14) | **Jul 13 2027 after Next Fest; Windows first; no macOS at launch** | Before Steam work starts; by **Sun Feb 7** to keep Jul 13 |
| D16 | Is the Dec 20 prototype a version (`/ship 0.1.0`) or the tag `prototype`? | Either; the plan assumes the tag | **Dec 20** |

---

## 14. The first two weeks

**Call: in week 1 you see real Boston, deployed and named by its SHA; in week 2 it tilts and fills with people** ([GD-07](docs/history/lessons-ledger.md), [SC-11](docs/history/lessons-ledger.md)).

**Before the first session:** merge the planning files (this plan, `README.md`, `CLAUDE.md`, the changelog with its check and `/ship`, `docs/`) to `main`; give Claude read access to `Intralines`, `Intralines_City_dep` (private) and `Intralines_City`.

**Week 1: Oct 12–18**

| # | Who | What | Done when |
|---|---|---|---|
| 1 | Claude | `docs/SCOPE.md` (one page), `docs/playtests/PROTOCOL.md` | On `main`; SCOPE reads in 5 minutes |
| 2 | You | Pages from Actions; protect `main`: PRs only, "Versions only via /ship" a required status check, squash and rebase merges off (merge commits only); a `v*` tag ruleset blocking update and deletion | Set by Oct 18 |
| 3 | Claude | Scaffold (Vite, React, strict TS, Vitest, Playwright, lint rules, LFS, CI); the deploy workflow (every merge to `main`; keeping the last two deploys' files, ≈0.25 session) and live SHA check; `src/platform/web` with the replaced-build card; the build chip; the I15 swap test, failing without retention | After a second merge, a reload shows its SHA and a tab left open on the first still loads |
| 4 | Claude | Boston map: `pmtiles extract --dry-run`, then a pinned Protomaps cut of Inner Boston plus 1.5 km as a hashed release asset; Pages header check (Range `206`, cache lifetime); MapLibre 6.11.2; light style v0 with a self-hosted sprite; Afacad Flux pinned like a city source (google/fonts commit and SHA-256), built by `tools/fonts/build` (pinned fontTools) into woff2 and all 256 glyph ranges, empty where it has none, a glyph tool picked in week 1 (node-fontnik or `build_pbf_glyphs`; check before relying on it), outputs in LFS under a hash test; a style test keeps every `text-font` an Afacad stack and `glyphs` and `sprite` relative; OSM attribution; `CityTileSource` | Boston opens flat, labelled in Afacad Flux; sizes, headers and font bytes in DECISIONS |
| 5 | Claude | Bake skeleton: `city.json`, extent, `bake:plan`; fetch, lock, mirror; the mini-Boston fixture (the §5 box) clipped from every input | The fixture committed; Boston's 675,647 exact |
| 6 | Claude | Make V1 playable for P0 | You open V1's Riverton in one step |
| 7 | You and the artist | **P0:** 30 minutes of V1 each | `docs/playtests/2026-10-17-p0-v1-baseline.md` |
| 8 | The artist; you | The artist reads MODELS.md §3, §3.1, §5, §6 and §10 (about a page) and answers §12 (tool, roof stripe, any existing models); you agree the art licence line, and `art/LICENSE.md` is committed | In DECISIONS by Oct 18 |
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

The first player-visible change adds the first line under Unreleased; no version exists until you type `/ship`. If week 1 slips, items 3 and 4 come first.
