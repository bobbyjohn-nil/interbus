# Subsystem & Salvage Matrix — Intralines V1 / V2 / V3 → interbus

Prepared 2026-10-12 for planning the final version in `bobbyjohn-nil/interbus` (prototype Nov–Dec 2026, publish Jan–Feb 2027).

This matrix compares the three earlier versions of the game subsystem by subsystem (§A), lists what to port, rewrite from or drop, with exact source paths (§B), registers the known bugs K01–K58 that must not come across (§C), and sets out the stack options (§D). It pairs with [lessons-ledger.md](lessons-ledger.md), which holds the lessons (GD-01, EC-04 …), and [versions.md](versions.md), which explains the names, repos and dates.

**How it was produced.** On 2026-10-12, ten readers each reviewed one slice of one version and wrote notes (digests) with file and line citations; some also ran builds, test suites, harnesses or headless play sessions against copies of the repos. The digests, a merged commit timeline and direct re-reads of the three repos were synthesised into this matrix. A skeptic pass then re-checked the 50 most load-bearing claims across this matrix and the lessons ledger (M01–M25 here, L01–L25 there): 39 held, 11 were partly true and are corrected in place, and none was refuted. The digests, harnesses, logs and screenshots were not committed. Where this matrix names one (for example "review harness `idtest.mjs`"), the name identifies the check so that it can be rebuilt as a committed test (§B5).

## Conventions

**Repos and branches.** Every path in this document is relative to the repo root shown here unless it says otherwise. Elsewhere in this repo, cite a path in full as `repo@ref:path`, in the form shown in the "Cited as" column. In §B the source column uses the same refs, for example `Intralines_City@dc63602: src/game/economy/ledger.ts`.

| Tag | GitHub repo @ branch (tip) | Cited as | Notes |
|---|---|---|---|
| **V1** | `bobbyjohn-nil/Intralines` @ `claude/city-bus-manager-game-rmdul2` (`7af45b1`, Aug 13) | `Intralines@7af45b1:path` | `claude/bus-appearance-update-stability-rnemi4` points at the same tip. 71 commits, 70 by Claude and 1 (`f57983c`) by bobbyjohn-nil (verified) |
| **V2** | `bobbyjohn-nil/Intralines_City_dep` @ `archive/intralines-city-v1` (`5e24bcb`, Aug 12) | `Intralines_City_dep@archive/intralines-city-v1:Gaming/path` | Game code is under `Gaming/`; V2 paths in this document sometimes omit that prefix. `main` (`8c01a18`, the only commit ever deployed to Pages) is 16 commits behind and 0 ahead; it lacks the feedback backlog, the layout spec, the city texture and the service-span fix (verified). 107 commits, 102 by Claude. The crew lives on `orchestrator` |
| **V3** | `bobbyjohn-nil/Intralines_City` @ `main` (`dc63602`, Aug 20) | `Intralines_City@dc63602:path` | A single parentless squash commit (187 files, 36,576 insertions). Hashes cited in its docs (`c489047`, `360a823`, …) resolve in none of the three repos (verified). A separate branch, `claude/gamedev-orchestrator-improve-mhs8ug` (tip `3720c9b`), keeps 8 earlier crew and spec commits |

**Evidence tags.**
- **[M]** A reader measured it against a copy of the repo (a build, a test run, a harness, a headless play session).
- **[R]** A reader read it in source.
- **[R✓]** The synthesis re-read the cited lines in the repo on 2026-10-12, and they say what is claimed.
- **[C]** It is claimed in a commit message or doc and has not been independently verified.
- **(verified)** A skeptic re-checked the claim on 2026-10-12 against the repo, git history, CI logs or a re-run harness, and it held. **(corrected)** The skeptic found it partly true, and the text now uses the corrected wording. **(unverified)** It could not be checked. The verifier artifacts were not committed. The "Verification log" at the end maps each verdict to what changed.

**Verdict scale.**
- **A**: ship quality. Reuse nearly as-is.
- **B**: sound, but needs fixes.
- **C**: works, but is flawed or overbuilt.
- **D**: broken, stubbed or unwired.
- **—**: absent, or exists only as a spec. The spec's quality is noted separately where it matters.

**Carry modes.**
- **PORT**: copy the code and adapt it.
- **REWRITE-FROM**: re-implement, using the old code or spec as the reference.
- **IDEA-ONLY**: keep the principle, not the code.
- **DROP**: leave it behind.

---

## 0. The verdict on one screen

1. **No version is a base to fork.** V1 is the only complete game, but its logic sits in a 1,905-line god-store that contains three verified data bugs. V2's economics are the most debugged, but they live in plain-JS files of 5–8k lines and the UI covers 41% of the map. V3 is the best-engineered code, but it has no income and is not yet a game.
2. **The sim core should be REWRITE-FROM.** Take V1's model shape (worker, gravity plus visitor OD, logit, timed waits). Apply V2's measured corrections: the wait model, hour masks and service span, coverage-by-service, the fare taper and elasticity. Add V3's per-boarding fare term and its typed, allocation-free module style. Drop every inherited truncation cap. All three versions shipped caps that silently lose riders: V1 keeps the 4 nearest stops per block group (the measured cause of riders falling as lines are added) and 3 lines per stop; V2 keeps 3 lines by id (which zeroes lines 4 and 5 at a hub) and 2 stops per zone; V3 has fixed 200-stop and 40-line buffers.
3. **PORT almost as-is from V3:**
   - integer-cent ledger;
   - save envelope with monotonic ids;
   - clock-pure bus motion;
   - Dijkstra pathfinder;
   - calendar;
   - depot rules;
   - error bus;
   - PWA update flow;
   - tsconfig, CI and LFS.
4. **PORT selectively from V2:**
   - RNG and hash;
   - save element validation;
   - CSR A*, `connectAll` and `finalise()`;
   - the congestion field;
   - the IL-PACK codec;
   - the offline build audit;
   - the CVD palette math.
5. **PORT from V1:**
   - `pipeline.js` and its fixtures, only if real cities are in scope;
   - `geo.ts`;
   - icons and the bus mark;
   - splash and wipe;
   - the Electron shell, only if a desktop build is needed.

   Use V1's `docs/MANUAL.md` and `docs/DESIGN.md` as the product reference.
6. **Shape of the UI shell:** V1's shape (chip row, dock, floating inspector, explain-the-rule copy), as V2's unbuilt `screen-layout.md` quantified it (≤6% occlusion at rest, ≤8-word glosses). This is the clearest player-validated direction across all three repos.
7. **DROP:**
   - V1's stacked update-recovery layers (six commits before its service worker);
   - V2's 280 KB browser a11y harness;
   - V2's company type and government lobbying;
   - V3's glTF model pipeline and the 54-case rendered contrast suite, until art and a stable 3D view exist;
   - every agent-crew "checkpoint" commit habit.

---

## A. Subsystem comparison matrix

### A.1 Summary (one row per subsystem)

| # | Subsystem | V1 | V2 | V3 | Best source for interbus | Carry mode |
|---|---|---|---|---|---|---|
| 1 | City / world generation | B (real packs + seeded Riverton) | B− (3 archetypes, deterministic, coarse demand) | B− (Riverton, tested, 96 zones) | V2 `20-city.js` infra + V1-grain demand cells | REWRITE-FROM (generators) + PORT (rng, connectAll, finalise, CSR A*) |
| 2 | Real-city data pipeline | B transforms / C delivery | codec A− / converter D | — (spec) | V1 `pipeline.js` + V2 IL-PACK codec | PORT **if** real cities are in v1.0; otherwise DROP for v1.0 |
| 3 | Demand & mode choice | B− (worker, caps break it) | B (honest, but centroid demand and 3-line cap) | C (round-1 only) | V1 shape + V2 fixes + V3 per-boarding term | REWRITE-FROM |
| 4 | Economy / ledger | B− (complete, floats, untested) | B+ (most debugged rules) | A mechanism / D content (no income) | V3 ledger mechanism + V2 rules | PORT (V3 ledger) + REWRITE-FROM (rules) |
| 5 | Fares & express | B− (predicate good; split exploit) | A− (taper + elasticity) | — (spec; misses express exploit) | V2 taper/elasticity + V1 predicate + V3 per-boarding term | REWRITE-FROM |
| 6 | Depots & deadheads | B− (logic in MapView) | C (no deadhead) | B+ logic / D wiring | V3 `depots/*` + V1 zoning tint | PORT |
| 7 | Fleet / staff / wear | C (wear dead) | C+ (per-bus wear works; dull staff) | D code / B spec | V3 `fleet-and-staff.md` + V2 per-bus model + V1 numbers | REWRITE-FROM |
| 8 | Timetables & schedule assistant | B (two modes, one function) | B− (assistant 1.70–1.77 s, sync) | — (spec, conflicting shapes) | V1 `headwayAtHour` + V3 `LineTimetable` | REWRITE-FROM; assistant IDEA-ONLY |
| 9 | Transfers & hubs | C (130 m clusters, caps) | B− (tier ladder, snap; hub cap bug) | — (RAPTOR spec) | V2 ladder + snap, V3 RAPTOR | REWRITE-FROM |
| 10 | Traffic | D gameplay (AADT render-only) | B+ (shared fn, normalised field) | — (constants only) | V2 `congestionAt` + place field | REWRITE-FROM (port math) |
| 11 | Events / contracts / report cards / goals | C (report card only, reliability bug) | B (events + tenders) | — (spec) | V2 events/contracts + report card redesigned | REWRITE-FROM; DROP company type and government |
| 12 | Vehicle motion & kinematics | C+ (good math, wrong layer) | B (shape epoch) | A− (pure, tested) | V3 `buses/*` + V1 tau-time + V2 shape epoch | PORT |
| 13 | Map rendering (2D) | B look / C perf | B− tech / C look | (superseded by 3D) | V1 look + V2 cartography rules | REWRITE-FROM |
| 14 | 3D rendering | C (charming, leaky) | — | B tech / D payoff | V3 `render/three` (if 3D) | REWRITE-FROM (conditional); DROP model pipeline |
| 15 | UI shell & panels | B− shape / C code | D shape / B idioms | C (thin, untested) | V2 `screen-layout.md` (V1 shape) + V1 rule copy + V3 tokens | REWRITE-FROM |
| 16 | Onboarding / founding / menus | B | D (auto-found) | — | V1 Menu, Founding, splash | REWRITE-FROM + PORT (splash, wipe, icons) |
| 17 | Undo / redo | D (draft only) | C (good design; undo after time is broken) | B (draft-only, exact) | V2 `undo-redo.md` with fix + V3 draft | REWRITE-FROM |
| 18 | Save format & migration | C (id collision, dormant versioning) | B (validated, tiny) | A− (envelope, nextIds) | V3 `save/*` + V2 element validation | PORT |
| 19 | PWA / offline / updates / deploy | C (stacked recovery layers) | B (single file, Pages) | A− (prompt update, verified offline) | V3 PWA + V1 deploy-gate notes | PORT; DROP V1 layers |
| 20 | Desktop packaging | C (Electron, stale) | — | — | V1 `electron/main.cjs` | PORT if desktop; else DROP |
| 21 | Accessibility | C | B value / D cost | B− | V2 palette math as unit tests; shape-not-hue | PORT (math) + IDEA-ONLY; DROP harnesses |
| 22 | Test harnesses | D (pipeline only) | B+ (67, determinism, contracts) | A− (316, invariants) | V3 vitest + V2 replay ideas + review harnesses (§B5) | PORT + REWRITE-FROM |
| 23 | Build tooling | C (1.76 MB chunk, warning muted) | B (zero-dep, offline audit, no types) | B+ (strict TS, CI) | V3 config + V2 offline audit | PORT |
| 24 | Docs / specs / decisions | B+ (manual, design) | B content / D volume | B+ format / D volume | V1 manual/design, V3 decision-log format | PORT (reference docs) + IDEA-ONLY (formats) |

### A.2 Row detail

Each row gives one line per version (how it was done · verdict · measured evidence), then the call.

#### 1. City / world generation
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Real cities as census block groups plus OSM `CityPack`s. A seeded procedural Riverton (`scripts/make-demo-city.mjs`) uses the same format | B | Demo pack 410 KB: 481 block groups, 1,689 nodes, 2,012 edges, pop 128,010 [M]. Deterministic, and it carried all e2e testing because real endpoints were unreachable (`4a47dc1`) [C] |
| V2 | Three archetype generators: grid, river, radial (`Gaming/src/20-city.js:584/642/756`). One `finalise()` and `connectAll`. Demand sits on 22–29 district discs | B− | 9–42 ms per city; byte-identical per seed across 9 cities; 1 component everywhere [M]. Only **about 25–26% (grid/river) and 36–37% (radial) of street nodes are within 650 m of a district centroid**, 27–29% and 37–39% counting landmark and rail pseudo-zones (verified). Naive first line nets −$947 to +$3,929/day [M] |
| V3 | `generateRiverton.ts` (seed 42): 43 grid lines at 140 m, river with 4 bridges, a 12×8 lattice giving 96 zones, 42,000 people | B− | 33 tests; ~30 ms cold / 7 ms warm [M]. Bridges proven load-bearing in `integration.test.ts:502-670` [R]. DECISIONS #65: only 32 of 9,216 OD pairs are servable without transfers (zones 490×735 m vs 650 m walk) [R] |

**Call:** V2's infrastructure is the best of the three: determinism, connectivity repair, CSR A*, archetypes with designed traps. Its 25-disc demand is the worst failure, and V3's 96 zones are also too coarse. Rewrite the generators from V2, with demand on hundreds of cells (V1's Riverton used 481), and port V2's RNG, `connectAll`, `finalise` and CSR A* verbatim into TS. Keep V3's Riverton as a fixture or tutorial city only if it is re-zoned. → **REWRITE-FROM + PORT (utilities).**

#### 2. Real-city data pipeline
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Pure `src/game/data/pipeline.js` (836 lines), shared by the browser loader and `scripts/bake-city.mjs`. Sources: TIGERweb, ACS, LODES, Overpass with 4 mirrors, AADT. CI bake is best-effort | B transforms / C delivery | `test-pipeline.mjs` passes in 0.19 s (verified). The deploy workflow did bake Worcester, Des Moines and Madison and shipped them on the site, with an in-browser download fallback (`deploy.yml:42-55`, `223f9a2`). The packs are gitignored and the local bake fails without network, so their size ("tens of MB" in `4a47dc1`, "10–40 MB" in the docs) cannot be re-checked (corrected; delivery re-graded D → C because it worked in production). The browser path cannot get LODES (no CORS, `3695f23`) [R]. `PACK_FORMAT_VERSION` went 1→9 in 8 days [R]. The city list is duplicated and drifting: zoom 12.6 vs 13.1 [R] |
| V2 | `Gaming/tools/pack.js` converts OSM XML to `.ilcity` (IL-PACK v1 varint+delta). Population is synthesised from land use | codec A− / converter D | Fixture 21,339 B regenerates byte-identical [M]. "143 kB mid-size city" was measured on *generated* graphs (verified). A synthetic 7×7 km OSM extract collapsed to **2 districts** (one holding 171,180 residents) because `buildZones` merges contiguous land use (`pack.js:556-640`) (verified). No real extract was ever converted (verified) |
| V3 | `city-packs.md` spec only: `.ipk`, 0.41–0.47 MB gzip estimate, `ZONE_CAP 512`, about 400 km² | — | No bake script, no packs; the app runs `generateRiverton` (verified). Boston/LA/OC/Houston never baked; LA and Houston lose identity in the clip (DECISIONS #29 ⚠REVIEW) [R] |

**Call:** This is the single biggest scope decision. If real US cities ship in v1.0:
- Port V1's `pipeline.js` with its fixtures, but bake only offline and in CI. Never use the browser path.
- Pack the output with V2's IL-PACK codec.
- Validate on one real city before committing to a roster. V2's routing cliff applies: A* takes 30 ms per route at 31k nodes, so V2 capped packs at 16k nodes.

If not, drop it from v1.0 and keep the code as a reference. → **PORT (conditional) / DROP.**

#### 3. Demand & mode-choice model
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Web Worker, analytic steady state. Production-constrained gravity over n×n block groups plus a visitor OD matrix. Logit with τ=9, 0.92 cap, 13% captive. 70/30 timed-arrival wait. One transfer via 130 m clusters. Debounced 250 ms with `reqId` | B− | Deterministic; recompute about 32–83 ms at n=481 on synthetic 1–30-line networks (verified) and 101–221 ms at n=1,924 [M]. Memory 44 MB at n=1,924 (O(n²)) [M]. **Caps:** 4 nearest stops per block group (`demand.worker.ts:323`) and `LINES_LIMIT = 3` (`:413`) (verified). On a synthetic Riverton network riders fall **9,443 → 8,087 → 6,537** at 5 → 15 → 30 lines; widening the stop cap to 400 gives 9,605 / 10,997 / 10,192. The 4-stop cap causes the whole drop; `LINES_LIMIT` had no effect in this bench because each synthetic stop serves one line; real-city magnitude is unmeasured (verified). Deviation-only fare per leg, with revenue per boarding, means a line-split exploit, measured at +8–28% (plain stop) and +29–62% (hub) (`:339-345`, `:503-504`) (verified) |
| V2 | Port of V1's manual. Adds a schedule-aware wait with convex pain, service-span hour masks, fare elasticity by ride length and purpose, and coverage-by-service. One-transfer skim. Synchronous on the main thread | B | 67/67 tests; byte-identical cold replays [M]. **Caps:** `MAX_LINES_SCANNED_PER_STOP 3` sorted by id (`30-sim.js:2044-2047`, `10-core.js:111`) and `SIM_MAX_STOPS_PER_ZONE 2` (`30-sim.js:211,1987`) (verified). 10 lines / 116 stops: warm about 65–100 ms, edit 137–148 ms, assistant 1.70–1.77 s, against a 25 ms stop-click budget (verified) |
| V3 | Stage A gravity on typed arrays. Stage B is round 1 only, brute force, direct trips, `ASSUMED_HEADWAY_MIN 12`, main-thread `setTimeout` | C | `DemandBuffers` 410.5 KiB at Z=96 [M]. 951 riders/day on a 5-stop line [M]. Fixed buffers of 200 stops / 40 lines go silent past capacity (`App.tsx:75-76, 482-490`) [R✓]. The spec's 2-round RAPTOR and per-boarding fare term were never built [R] |

**Call:** Re-implement as a pure TS module running in a worker:
- **From V1:** the model shape (gravity, visitors, logit with captive share, timed waits).
- **From V2:** the measured corrections (wait model `30-sim.js:296-319, 2557-2627`; hour classes `:616-698, 2786-2830`; coverage-by-service `:3853-3912`).
- **From V3:** typed buffers with growable capacity, the per-boarding fare term, the min-over-legs crowding rule and linked-trip counters (`demand-model.md` §3.1–3.2).
- **Remove** every truncation cap.
- **Make "every rider-facing quantity is per hour"** an invariant from day one; V2 found that exploit shape six times. → **REWRITE-FROM.**

#### 4. Economy / ledger
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Float cash integrated in `store.ts tick()` (889-912). Fare plus $1.60 subsidy in; per-km cost, fuel, wages, mechanics, upkeep, overhead and interest out | B− | One game day of `tick()` matches the worker's daily net exactly (+$2,810 vs +$2,810) (verified). Balance drift: a 5-stop, 5.3 km starter line is express and nets +$3,167/day, against commit claims of about +$490 for a 5-stop line and +$1,000 for the starter (verified). No balance harness [R] |
| V2 | `computeLedger` (`30-sim.js:3518`) plus `applyWindow` hourly shares. `lineEconomics` is the single source. Quadratic subsidy taper | B+ | Closed exploits: starve-and-charge ($18,045 vs $1,936/day), coverage farming, midnight span (+461% by the crew's own sweep; +149% re-measured on the review harness's single line; −$169/day after the fix) (corrected). Residual: 1 bus at $5 earns $3,312 against a best of $4,356 (76%) [M]. Balance harnesses never committed [R] |
| V3 | Integer cents with sub-cent carry and cumulative-total banking (`economy/ledger.ts`) | A mechanism / D content | 29 ledger tests; drift over 10,000 ticks is exactly 0 [M]. **Income is hard-coded to 0** (`ledger.ts:217`) and `kmDriven: 0` (`App.tsx:530`); the only inflow is the refund of an undone stop (verified). Cash only falls, about $53 per 51 game-min (verified) |

**Call:** Port V3's ledger mechanism. Feed it V2's rule set (line economics as one helper, subsidy taper) and V1's constants. Wire income on day one. → **PORT + REWRITE-FROM.**

#### 5. Fares & express
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Per-line fare against a $2.25 reference at $0.18/min. `isExpress` (≥5 km, ≥1,200 m spacing, ≥3 stops) is one shared predicate; express gets ×0.85 ride, ×0.5 fare sensitivity, ×1.5 subsidy | B− | A naive 5-stop, 5.3 km line already qualifies as express (verified). The deviation-only fare per leg, with revenue booked per boarding on each line, gives the split exploit: measured on V1's real worker at $2.25, +8% to +28% at a plain stop and +29% to +62% at a hub across four corridors (corrected; the +38% / +69% figures are V3's stylised spec arithmetic, not V1 measurements) |
| V2 | Per-line $1–5 in $0.25 steps. Elasticity by ride km and purpose. Quadratic subsidy taper. "Who rides this line" card | A− | Express profit argmax moved from exactly $5.00 to $2.75 (`f29aab5`); the taper is still at `30-sim.js:70-72` (verified). Six optima from $1.75 to $3.25 across fixtures [C]. Bus×fare sweep shows an interior optimum: 4 buses at $4.00 = $4,356 [M] |
| V3 | Spec: company-wide fare (contradicts its own per-line save schema), per-boarding fare fix, express reason copy | — (spec B) | Split fix takes the stylised table from +38% / +69% to −22% / −9%; the review harness `fare-check.mjs` reproduces the spec's arithmetic, given its delta values (verified). Under V3's own formulas, on a stylised marginal pair, **express revenue still peaks at $4.75–$5.00** (verified; the spec has no taper) |

**Call:** Use per-line fares (V1, V2 and V3's save schema all agree), V2's taper and elasticity, V3's per-boarding transfer term, and V1's predicate with V3's reason copy. Validate with a committed sweep, not hand arithmetic. → **REWRITE-FROM.**

#### 6. Depots & deadheads
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Up to 5 depots ($150k × 1.5ⁿ, capacity 6/14/30). Zoning from OSM industrial land, where the tint is the rule. Nearest-depot, capacity-aware deadheads computed inside `MapView.tsx:527-560` | B− | Zoning tint and placement check share one list (`38775a1`) [R]. Deadheads live in render code, so they are not sim truth [R] |
| V2 | Cost and capacity ladder, 400 m street access, 120 m separation (`10-core.js:70-77`) | C | No deadhead term in the sim (`grep deadhead 30-sim.js`: 0 hits) [R✓] |
| V3 | `depots/{siting,placement,economics,deadhead}.ts` with a shared `isDepotSitable` predicate. Worked deadhead economics (about $162/day saved) | B+ logic / D wiring | 21 tests pass [M]. **No marker, no tint**; `DepotPanel` and `deadhead.ts` have no non-test importer (`App.tsx:864-868`), and `src/render` has no depot code (verified). The play session charged $150k and rendered nothing (verified) |

**Call:** Port V3's depot modules. Wire deadhead km into the ledger, and draw V1's eligibility tint and marker before the tool ships. → **PORT.**

#### 7. Fleet / staff / wear
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Five models unlocked by riders served; mixed fleets per line stored as per-model counts; Mk I–III; fuel and range; driver $26/h; one mechanic per 6 buses; auto-hire | C | **Wear is dead for lines created since v1.15** (`83ce324`): `store.ts:932-936` matches `l.modelId`, which nothing in `src/` sets on a new line, giving 0.00 vs 2.20/day (verified); `MANUAL.md:456-462` still promises 2.2 points/day. Hiring the required mechanic takes the starter line from +$2,810 to +$2,606/day (verified) |
| V2 | Per-bus entities `{id, modelId, mark, wear, depotId, lineId}`; wear accrues per bus (`30-sim.js:5040-5043, 5136`) | C+ | Wear works [R✓]. The staff report category is about 100 for everyone and the Staff page is "two counters that follow the bus count" [R] |
| V3 | `BUS_MODELS` data only. Every line gets `BUSES_PER_NEW_LINE = 2` free buses (`App.tsx:60`, verified) | D code / B spec | `priceUsd` is never read outside `constants.ts` (verified). The spec `fleet-and-staff.md` covers headway↔fleet duality, refurbish payback of about 190 days (so refurbishing is a Safety decision), and linked-trip unlocks [R] |

**Call:** Re-implement from V3's spec on V2's per-bus data model, with V1's numbers. Drop the Mk tiers and fleet standardisation (the spec's own half-time cut). → **REWRITE-FROM.**

#### 8. Timetables & schedule assistant
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Two modes (Normal = buses per period, Advanced = headway per window) through one `headwayAtHour()`. Stop buffer and service hours | B | One function for sim, ledger and UI (`f9e88d8`) [R]. Stores both `periodBuses` and `periodHeadwayMin` (`types.ts:170-173`) [R]. Advanced mode is limited to 10–15 min for no recorded reason [R] |
| V2 | Timetable plus a greedy schedule assistant on cloned states, which shows its arithmetic and applies as one undo step | B− | `assistantPlan` takes about 1.70–1.77 s synchronously on 10 lines (verified). It shipped dead at first (`plan.steps` vs `moves`) [R] |
| V3 | Spec `LineTimetable {mode, busesRequested[4], buffer, serviceHours}` | — | Three conflicting stored shapes: DECISIONS #25 (target headway) vs #32 (`busesRequested`) vs `save-format.md` §4 (mode + headway) [R] |

**Call:** Keep V1's single `headwayAtHour` read path and store one canonical shape (V3 #32). Resolve the conflict before writing the save schema. The assistant is later, and only if it runs in a worker. → **REWRITE-FROM; assistant IDEA-ONLY.**

#### 9. Transfers & hubs
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Stops within 130 m are merged into one interchange; 6 min penalty (2 at a hub); one transfer | C | 3 lines per stop and one transfer point per line pair [R]. Its README admits there is "no full journey planner" [R] |
| V2 | One-transfer skim. Tier penalties 6/6/5/3.5/2 min. `STOP_SNAP_EXISTING_M 250`, so placing near an existing stop selects it | B− | Sharing a stop gives +93% boardings [C]. The Interchange tier was fixed (+$423/day) [C]. **Hub cap bug:** lines 3 and 4 at a 5-line hub board 0 (1621/1210/713/0/0) though they alight 132 and 170 there; with the cap at 10 they board 554 and 810 (verified) |
| V3 | None in code. Spec: 2-round RAPTOR, clustering at 650 m | — | 650 m (spec) vs 130 m (V1) would merge most nearby stops [R] |

**Call:** Re-implement V2's tier ladder and snap with no scan cap, plus V3's two-round search, keeping V1's 130 m cluster radius. → **REWRITE-FROM.**

#### 10. Traffic
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Hourly curve (1.45 / 1.52 peaks) × road class × AADT busyness, plus ridership relief | D (gameplay) | The worker uses only citywide `trafficFactor(h)` (`demand.worker.ts:251`). Class and AADT congestion live in `MapView.tsx:480-530` and `busLayer3d.ts:383-389` and only pace the animation, the forecast overlay and the TopBar readout; congestion never feeds ridership, although `changelog.ts:91` says it does (verified). The relief formula is copied 3 times [R] |
| V2 | One `IL.congestionAt(state, class, hour, {place, laneShare})`. Place field normalised by bisection to mean 1.0000. Routing stays free-flow | B+ | Field build 1.2 ms and 1 kB; core-to-rim ratio up to 19× [C]. The divide-by-mean version drifted to 0.937–0.975 [C]. Bus lanes: collector and local rungs never pay back [R] |
| V3 | Constants only (`ROAD_CONGESTION_WEIGHT`); demand is free-flow (`demand.ts:198`) | — | [R✓] |

**Call:** Port V2's `congestionAt` and place-field math into the sim, use V1's tau-time integration for motion, and DROP AADT unless real cities ship. → **REWRITE-FROM.**

#### 11. Events / contracts / report cards / goals
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Quarterly report card with 7 weights (grant $1,600/pt above 55, fine $8k below 35), credit score, two lenders. No events and no contracts | C | **Reliability bug:** compares to legacy `headwayMin` (`store.ts:476`) [R✓], so a line exactly on its timetable scores 39/100 [M]. The next version criticised the goal as "only profit go up" [R] |
| V2 | Events (4 kinds, 1-day warning, 18%/day), 3 tender slots ($60–240k), report card with "left on the table" and a coverage overlay. Also government lobbying and company type | B (events/tenders) | Fixed: reward inversion, deadline off-by-ones, span-blind tenders [R]. Tender income varies **$60k–$480k across seeds** [C]. Environment is "a dead 5 points"; staff is about 100 for everyone [R]. Company type never settled (3 amendments) [R] |
| V3 | `report-cards.md` spec: integrated over the quarter, projection line, Connectability formula, grade ladder 93/85/70/55/40 | — | Unmeasured: "lands around 45" vs V2's measured opening scores of about 55–58 [R] |

**Call:** Port V2's event and tender logic (`30-sim.js:4576-4972`) into TS and smooth the seed variance. Rebuild the report card around categories the player can move, using V3's projection line and V1's real formulas (`store.ts:403-520`), calibrated by a measured harness. DROP company type and government for v1.0. → **REWRITE-FROM.**

#### 12. Vehicle motion & kinematics
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | `busLayer3d.ts`: accel 1.1 / brake 1.3 m/s², tau-time congestion integral, keep-right, red lights, a pure function of the clock | C+ | Tau-time fixed the rush-hour teleports (`ce7cf6b`) [C]. **Visual cycle ≠ billed cycle:** `busLayer3d.ts:366` uses `2*outbound + 2*LAYOVER`, where outbound already includes the 20 s dwell at intermediate stops; the worker also bills the per-stop buffer, an extra terminal dwell (2 × `DWELL_SEC`) and amortised refuel time (`demand.worker.ts:209-219`) (corrected). "Served" detection depends on frame rate (`:682-690`) [R] |
| V2 | `busPositions` is pure in the clock; a route-edit "shape epoch" re-anchors buses | B | Edit teleports fell from 4.2–5.6 km to about 1 m; a reorder still moves a bus 3,117 m (`57dcdc0`) [C] |
| V3 | `buses/{kinematics,schedule,position}.ts`: pure, allocation-free, keep-right 2.5 m | A− | No-teleport test max step 9.577 m (verified); end-to-end determinism tests [R] |

**Call:** Port V3's `buses/*`. Add V1's tau-time (`busLayer3d.ts:85-100, 392-396`) and V2's shape epoch. Derive cycle time from the one sim formula. → **PORT.**

#### 13. Map rendering (2D)
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | MapLibre GL 4.7 with an OpenFreeMap restyle or an offline style built from the pack. Overlays: hashed demand scatter plus clusters, traffic tint, zoning tint, a 4-panel board mask. DOM markers for stops | B look / C perf | The look is the one the player asked V2 to copy ("make the game more like bobbyjohn-nil.github.io/Intralines/", first recorded in `screen-layout.md:3-4`, `980759d`) (corrected). Offline style has no glyphs, so it uses DOM markers rebuilt every 600 ms, and `setPaintProperty` runs every 1.5 s even while paused [R]. The demand view was redone about 8 times [R] |
| V2 | Canvas 2D ground cache keyed on zoom quantum, theme and night step. 5 cased road classes. LOD relative to fit zoom. Dash and hatch encodings | B− tech / C look | Batched footprints 65.8 → 2.2 ms [C]. Ground rebuild 34–38 ms in the 2.4–4.7× band against a 25 ms budget [C]. Boot frames 16.7 ms median [M]. It "reads as a diagram" [R] |
| V3 | Canvas 2D map replaced by three.js (Route B) | — | Canvas era: 7 verification passes and 6 causes for an invisible bus (DECISIONS #59–#62) [R] |

**Call:** The visual target is V1's paper board: palette `basemapStyle.ts:9-32`, mask `overlays.ts:55-114`, scatter `:15-24,116-171,378-424`, traffic ramp `:587-599`. Use V2's cartographic rules (casing ratio 1.34, LOD relative to fit zoom, CVD dash patterns). The engine depends on the stack (§D). → **REWRITE-FROM.**

#### 14. 3D rendering
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | three.js as a MapLibre custom layer; procedural bus meshes; station diorama in a second WebGL context; glTF slot pipeline | C | **18–33 meshes per bus, 9–14 materials (mostly created fresh per bus), no `InstancedMesh` in `src/`, no `.dispose()` in `src/map`** (verified). Repaint every frame even while paused (`:711`) [R]. Buses up to 29× life size [R]. 0 custom models delivered [R] |
| V2 | None | — | — |
| V3 | One three.js scene. Unlit data layers, lit instanced buildings, camera rig with pitch 0–60, night tint. Rendered-pixel contrast gate | B tech / D payoff | Critical path **75.2 → 220.3 KiB gzip (2.93×)**. First WebGL frame 119–135 ms on GPU; **726–926 ms plus 113–119 ms long tasks on SwiftShader** (verified against `baselines.md`; author-measured, not re-measured). At default framing the frame with buses differs from the empty one by **6 pixels**; `BUS_MAX_EXAGGERATION 8` (verified). 123 of 316 tests (39%) target render (verified). No model file in any repo's history (verified) |

**Call:** If 3D is chosen, start from V3's `render/three` scene layers and the unlit-data-layer rule, with a guaranteed bus footprint at the default camera. Keep V1's station diorama as an idea, driven by sim events. DROP the model pipeline until an artist delivers. → **REWRITE-FROM (conditional).**

#### 15. UI shell & panels
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | React 18 with a zustand god-store. Bottom dock with 7 entries, top bar, 330 px right panel, `Panels.tsx` (1,640 lines, 11 panels). "Explain the rule" copy | B− shape / C code | Chrome covers 5.3% at rest with 0 standing words (verified; V2's measurement). Top-bar chips are unlabelled, and the manual mislabels one [R]. `DraftBar.tsx:51` and `Panels.tsx:854-856` disagree on stop cost [R✓]. 0 `@media` rules [R] |
| V2 | Hand-built DOM (`50-ui.js`, 7,947 lines) with hand-maintained `sync()` signature strings. 14-button dock with standing prose | D shape / B idioms | Covers **41.2%** of the map with 271 standing words (verified). At ≤1180 px the middle column is hidden (`50-ui.js:843-848`) [R✓]. "Costs $X; you have $Y — $Z short" [R]. 0 console errors in a headless play-through [M] |
| V3 | React TopBar, Dock, DraftBar, Notice, UpdateBanner, DepotCursorChip; `tokens.css` with 40 px hit targets | C | 0 tests for `src/ui`, `src/pwa` or `App.tsx` (verified). **TopBar clock bug** after reload (verified). Clock lives in React state at 60 Hz [R] |

**Call:** Build the shell from V2's `screen-layout.md`: chip row, ≤8-slot dock, floating inspector absent at rest, cursor cards carrying the rules, ≤8-word glosses, occlusion ≤6% at rest and ≤26% with a panel open. Use V1's rule-copy patterns (`Panels.tsx:225-410, 958-967`), V2's money-reason idiom and V3's tokens. Label every HUD number. → **REWRITE-FROM.**

#### 16. Onboarding / founding / menus
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Home menu (Play, Saves, Settings, Changelog). Founding with name, 10 colours and a sandbox flag. Paused start. 5-step How-to-play. Pulsing depot button. Boot splash and a reduced-motion bus wipe | B | Screenshots `menu-home.jpg`, `founding.jpg`, `overview-help.jpg` [R]. No interactive tutorial or checklist [R] |
| V2 | No title screen; auto-founds "City Transit Co." paused. New-company dialog (archetype, company type) | D | `60-main.js:4677` [R] |
| V3 | None; the company name is the city name | — | Boot screenshot `01-boot.png` [M] |

**Call:** Re-implement V1's Menu and Founding flow. Port its splash, wipe and icon set. Add a first-goal checklist; no version has one. → **REWRITE-FROM + PORT.**

#### 17. Undo / redo
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Undo of draft stops only (`DraftBar.tsx:11`) | D | No network undo [R] |
| V2 | Each action declares the top-level keys it touches; deep-clone before and after; 50 deep; `begin`/`commit` transactions | C | **Undo after time passes rewinds cash and wear:** in an exact replay (buy a $95k bus, advance 32 game hours, undo) cash went 39,266.67 → 135,000 where 134,266.67 is correct ($733 erased); undoing a bus assignment reset wear 2.2 → 0; redo does not restore the hash (corrected; the review's earlier $760 implies about 33 h). Snapshots of sim-written keys (`60-main.js:612-662`), and `simStep` never clears history (verified). The test never ticks between edit and undo (`playtest.js:2624-2647`) (verified) |
| V3 | `undoLastStop` / `cancelDraft` with exact refunds; "add three, undo three" characterization test | B (narrow) | Money conservation across spend, undo and cancel is tested [R] |

**Call:** Re-implement from V2's `undo-redo.md`, with one fix. Snapshot only player-authored state, apply money as inverse deltas (or allow undo only while paused), and write a test that ticks between edit and undo. Port V3's draft undo. → **REWRITE-FROM.**

#### 18. Save format & migration
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | localStorage, one slot per city. `SAVE_VERSION = 1` forever, with inline `??` defaults. Newer and unreadable saves are refused or backed up. Export and import | C | **ID collision on reload:** `lineSeq/stopSeq = length + 1` (`store.ts:817-818`). Harness: lines L1, L4, L4, and the new line silently reuses unrelated old stops without paying for them, 2.8–5.0 km from the drawn path in that geometry (corrected). Derived geometry is 45% of a 3,094 B save [M]. The newer-save guard is dormant [R] |
| V2 | `IL.save` with element-level validation. The city is regenerated from its seed. Newer saves are refused | B | Save is 2,102 B; damaged saves are refused with a reason [M]. Single slot, no autosave, no unload guard (`60-main.js:197`) [R✓]. The Save button announces success regardless of the result (`50-ui.js:1647-1648`) [R✓] |
| V3 | Envelope plus an ordered load (outcomes none / ok / newer / unreadable / wrong_city), backups of newer and unreadable saves, a `MIGRATIONS` chain, persisted `nextIds`, stops anchored at (lng, lat, roadClass), autosave every 3 s with a 10 s floor and on `pagehide` | A− | 11 tests (verified); reload restores cash and lines; 1,383 B for a 3-stop line [M]. `nextIds` persisted and only increasing (`App.tsx:327, 392-400`; `save/types.ts:153`), except the bus counter, which is always written as `FIRST_BUS_ID` while buses are saved as `[]` (verified). Autosave debounce resets every frame (`App.tsx:621-623`) [R✓]. Cannot read V1 saves [R✓] |

**Call:** Port V3's `save/*`. Add V2's element validation, and V1's export/import and "refuse newer, back up unreadable once" semantics, which V3 already has. Persist intent, never derived geometry. → **PORT.**

#### 19. PWA / offline / updates / deploy
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | GitHub Pages; boot, update and recovery layers stacked in six commits, then a build-stamped SW (`9ea15e5`, which called `skipWaiting` on install) plus an unpinned `index.html` | C | Today's update and recovery files total about 1,050–1,190 lines, including 345 lines of general error UI from `96d8777`; the eight update commits added 1,273 lines, about 920 update- or boot-related. Seven commits precede the SW (six layers plus the CI fix `6c3687c`), and `81f334d` follows it (corrected). About 13 of 71 commits on deploy and caching [R]. Two parallel sessions cancelled each other's deploys (`6c3687c`) [R]. Pages two-gate traps are written up in `CLAUDE.md:20-47` [R] |
| V2 | One offline `index.html`; `pages.yml` runs test → build → deploy | B | 0 network requests; boot to state 204–279 ms [M]. One successful Pages run, from `main` (behind the archive) [M] |
| V3 | `vite-plugin-pwa` with `registerType: 'prompt'`, no `clientsClaim`, `skipWaiting` only on a `SKIP_WAITING` message, 2-reload session cap (`register.ts:10`) | A− | Offline re-verified by cutting the network: with a control fetch failing, the offline reload rendered the game (verified). Precache of 5 entries (811 KiB) [M] |

**Call:** Port V3's PWA flow. Keep V1's deploy-gate notes as docs, and DROP V1's recovery layers. → **PORT.**

#### 20. Desktop packaging
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Electron 33, `electron/main.cjs` (69 lines), `app://` privileged scheme, sandbox, contextIsolation; electron-builder targets | C | Built only locally, so `vite.config.ts:10` gives it a dev `BUILD_ID`, which disables the SW and update check (`update.ts:47,153`); the scheme privileges also omit `allowServiceWorkers`. Unsigned (`README.md:26`), not built in CI, untouched since Aug 3 (verified) |
| V2 | None (the single file also runs from `file://`) | — | — |
| V3 | None (distribution sits in the Icebox) | — | — |

**Call:** If Steam or desktop is a target, port V1's `app://` shell. Add an updater, a desktop save location and signing. Otherwise DROP. → **PORT (conditional) / DROP.**

#### 21. Accessibility
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Keyboard shortcuts Space, 1/2/3 and Esc; custom dialogs; reduced motion on the wipe. No responsive layout and no CVD work | C | 0 `@media`, unlabelled chips [R] |
| V2 | Build gate: CVD ΔE ≥ 20, contrast 4.5:1, focus ring 3:1, 24 px targets, keyboard map cursor; static plus browser halves | B value / D cost | Caught real bugs (line colours 1.5 ΔE apart) [R]. 354 KB of tooling, `a11y-browser.js` alone 279,756 B; **about 32–34 s per cache-missing build**; not run in CI (its only run logged "NOT RUN (Playwright is not installed)"); blocked the layout rework (29 focus-ring violations at 2.91:1, reverted in the working tree) (verified) |
| V3 | Rendered-pixel contrast gate (54 tests) with an id-buffer; 40 px hit targets; dark theme deliberately cut (DECISIONS #5) | B− | The gate passes on a line-zoomed viewport, not the default one [R] |

**Call:** Port V2's palette ΔE and contrast math as fast unit tests over the tokens. Keep shape-not-hue and the keyboard map cursor as rules. Run axe-core inside ordinary Playwright e2e. DROP both bespoke harnesses. → **PORT (math) + IDEA-ONLY.**

#### 22. Test harnesses
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | `scripts/test-pipeline.mjs` with 9 fixture blocks; its Playwright suites lived in a Claude session's temporary working folder and are lost | D | 0.19 s; no other test or spec file is tracked (verified). The three data bugs shipped untested [M] |
| V2 | `Gaming/tools/playtest.js`, zero-dependency `vm`: cold-context byte-identical replay, regex cross-layer contracts, save validation, undo hash | B+ | 67/67 in 6.3–7.0 s (verified). Balance harnesses uncommitted; balance tests are static invariants only [R] |
| V3 | Vitest workspace (jsdom plus browser), `integration.test.ts` invariants, characterization tests | A− | 259 node tests in 7.5 s plus 57 render tests in 14.9 s = 316 (verified). 0 UI or App tests (verified). The render suite needs an exact Chromium revision [M] |

**Call:** Port V3's Vitest setup and invariant style. Rewrite V2's cold-context replay and contract nets (with TS types instead of regex). Commit balance and performance suites seeded from the review harnesses (§B5). Add an e2e smoke test: found, draw, run a day, reload. → **PORT + REWRITE-FROM.**

#### 23. Build tooling
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | Vite 5.4 + `tsc -b`; no code splitting | C | About 11–12 s wall (vite stage 5.5–6.5 s); **1,755 kB / 493 kB gzip** main chunk plus a 10.3 kB worker chunk, with `chunkSizeWarningLimit: 2000` (`vite.config.ts:234`) (verified); 521 packages [M] |
| V2 | `Gaming/tools/build.js`: numeric-prefix concat, `vm.Script` syntax check, offline audit, write-once | B | About 0.4–0.5 s without the browser gate, about 33–38 s with it; **1,333,034 B / 388,736 B gzip** (printed as "379.6 KB", meaning KiB); a rebuild is byte-identical to the committed file (verified). No types [R]. `dist` committed in 51 of 107 commits [R] |
| V3 | Vite 5 + strict TS (`noUncheckedIndexedAccess`), four tsconfigs, LFS, CI that prints a gzip report | B+ | `tsc` 4.9 s, build 9.6 s; **811 kB / 226.5 kB gzip** app chunk plus a 5.7 kB workbox-window chunk (verified); 680 packages with 14 audit findings [M] |

**Call:** Port V3's configuration with code splitting turned on. Port V2's `offlineAudit` as a post-build check. → **PORT.**

#### 24. Docs / specs / decisions
| Ver | How | Verdict | Evidence |
|---|---|---|---|
| V1 | `docs/MANUAL.md` (724 lines, number-accurate), `docs/DESIGN.md` (pillars, tone), `CLAUDE.md` deploy gates; commit messages carry in-sim numbers | B+ | The manual became V2's and V3's spec [R]. README stale at v0.1 [R]. The manual drifted from the code (top-bar chip, refuel) [R] |
| V2 | 22 specs, 55.7k words, in the Serves pillar / Rules / Failure modes / Done means format; devlogs | B content / D volume | Spec mass (346 KB) exceeds the sim (283 KB) [M]. Many spec numbers went stale [R]. The layout spec was never built [R] |
| V3 | `studio/DECISIONS.md` (71 entries: what / why / how to reverse, ⚠REVIEW flags); 9 specs (about 190 KB) with SPEC/TUNE tags | B+ format / D volume | About 41k words written in one day, with deadline and Out list TBD [R]. The bible went stale [R] |

**Call:** Carry V1's manual and design doc as the product reference (a menu, not a build order). Read exact formulas from V1 code, not the manual. Keep V3's decision-log format. Use V2's specs as an exploit catalogue. Cap spec length. → **PORT (reference docs) + IDEA-ONLY.**

---

## B. Salvage inventory

Destination paths under `interbus/` are suggestions. "Bugs" lists the defects (see §C) that must be fixed on the way in.

### B1. PORT: copy and adapt code

| ID | Source (repo@ref: path) | → interbus | Change on the way in | Bugs to fix / watch |
|---|---|---|---|---|
| S01 | Intralines_City@dc63602: `src/game/economy/{ledger,types,format}.ts` + `ledger.test.ts` | `src/sim/economy/` | Add income lines (fare, subsidy at $1.60, express ×1.5 with V2 taper), real km driven, depot upkeep, loan interest; keep cumulative-total banking | K40 (income 0), K44 |
| S02 | Intralines_City@dc63602: `src/game/save/*` (constants, keys, load, read, write, migrations, primitives, storage, types, index) + `save.test.ts` | `src/sim/save/` | Rename keys to `interbus.save.<city>`; merge V2 element-level checks (null clock, null fleet element; V2 `Gaming/src/10-core.js:631-715`); add export/import; decide on a V1 importer (V1 key `intralines-save-`); store one timetable shape; persist the bus id counter too (V3 always writes `FIRST_BUS_ID` and saves buses as `[]`) | K01 (never mint ids from length), K12, K44, K51, K55 |
| S03 | Intralines_City@dc63602: `src/game/buses/{kinematics,schedule,position,geo}.ts` + tests | `src/sim/buses/` | Add V1 tau-time integration (V1 `src/map/busLayer3d.ts:85-100,392-396`) and V2 shape epoch; take cycle time from the sim's single formula | K07, K08 |
| S04 | Intralines_City@dc63602: `src/game/lines/{pathfind,draft,types}.ts` + `draft.test.ts`, `pathfind.test.ts`, `characterization.test.ts` | `src/sim/lines/` | Keep branded ids and top-level stops; replace `snapToRoad.ts` full scans with a spatial index (V1 `SpatialGrid`) | K52 |
| S05 | Intralines_City@dc63602: `src/game/clock/calendar.ts` + test | `src/sim/clock/` | Move the running clock out of React state into a fixed-step loop (pattern S22) | K41, K44 |
| S06 | Intralines_City@dc63602: `src/game/depots/{siting,placement,economics,deadhead,constants,types}.ts` + `depots.test.ts` | `src/sim/depots/` | Wire deadhead into the ledger; render the eligible tint and marker; one geo module; one `DepotId` | K43, K54 |
| S07 | Intralines_City@dc63602: `src/game/errors/{bus,types}.ts` + test; plus Intralines@7af45b1: `src/game/errors.ts` (friendly translations) | `src/app/errors/` | Add a UI sink (V3 `registerSink` has no caller); copy rules from V3 `studio/docs/design/errors.md` §3–§5 | K14 (V1 ErrorCenter hooks violation; do not port that component as-is) |
| S08 | Intralines_City@dc63602: `src/pwa/{register,useServiceWorkerUpdate}.ts`, `src/ui/UpdateBanner.tsx`, `vite.config.ts` VitePWA block | `src/app/pwa/` | Remove the `glb`/`ktx2` precache globs; refresh stale size comments | — |
| S09 | Intralines_City@dc63602: `tsconfig*.json`, `.github/workflows/ci.yml`, `.gitattributes`, `vitest.workspace.ts` (excludes `.claude/**`) | repo root | Pin or containerise the Playwright browser; enable chunk splitting | K53, K57 |
| S10 | Intralines_City@dc63602: `src/game/integration.test.ts` (24 cross-module invariants) | `src/sim/*.test.ts` | Re-target to the new modules; add an undo-after-tick test and a delete-reload-create id test | — |
| S11 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/10-core.js:427-460` (mulberry32, FNV-1a, purpose-salted `IL.rng`) | `src/sim/rng.ts` | Convert to TS; choose this or V3 `src/game/city/rng.ts`, not both | — |
| S12 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/20-city.js:1527` (CSR adjacency), `:1565` `connectAll`, `:1625` `finalise`, `:2001-2110` A* with generation-stamped scratch, `:1387-1490` congestion field with bisection | `src/sim/city/` | Convert to TS; replace bare literals (`:601, 684, 904, 926, 947, 1035`) with tunables; fix the stale "≈8,800" comment (`:181`) | — |
| S13 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/20-city.js:2120-2700` (IL-PACK v1 codec) + `Gaming/tools/fixtures/fixture-grid.ilcity` | `src/sim/city/pack.ts` | Only if packs ship; keep the distinct refusal messages | K26 (never trust `buildZones`) |
| S14 | Intralines@7af45b1: `src/game/data/pipeline.js` (+ `.d.ts`), `scripts/test-pipeline.mjs`, `src/game/data/aadt.sources.mjs`, `scripts/bake-city.mjs` | `tools/bake/` | Only if real US cities ship; CI or offline bake only; one city list (dedupe `bake-city.mjs:25` vs `cities.ts`) | K18, K19 |
| S15 | Intralines@7af45b1: `src/game/geo.ts` (`SpatialGrid`, `pointInRing`, `distToRingM`, `fastDistM`) | `src/sim/geo.ts` | Become the one geo module; V3 has 4 `geo.ts` files to fold in | K54 |
| S16 | Intralines@7af45b1: `src/game/routing.ts` (`insertStopNode`, `stopNameAt`, `cumulativeDist`, `pointAlong`, `costKmh` speed compression) | `src/sim/lines/` | Make A* close (node, incoming edge) states; stop mutating `pack` arrays in place (`:170-180`) | K13 |
| S17 | Intralines@7af45b1: `src/map/busLayer3d.ts:146-199` (`kinematicDist`, `accelCruise`, `subLegDist`), `:127-138` (`hash32`/`rand01`) | `src/sim/buses/` | Pure math only; leave the mesh code | K09 (do not port the mesh code) |
| S18 | Intralines@7af45b1: `src/ui/icons.tsx` (25 stroke icons and the parametric `BusSide`), `index.html:218-283` (splash and depot chatter), `src/ui/BusWipe.tsx` | `src/ui/brand/` | Tokenise colours; load the declared font or drop "Inter" | — |
| S19 | Intralines@7af45b1: `electron/main.cjs` | `desktop/` | Only if desktop; add an updater, signing and a save path; real build id | K15 |
| S20 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/tools/build.js` (`offlineAudit` `:334-360`, `escapeForInlineScript` `:157`, write-once `:566`) | `tools/check-offline.mjs` | Run as a post-Vite check over `dist/` | — |
| S21 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/tools/a11y-check.js` (CIE Lab ΔE under deutan/protan matrices, contrast pairs) | `src/ui/tokens.a11y.test.ts` | Unit test over design tokens; drop the source-regex parts | — |
| S22 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/60-main.js:158-165, 4271-4330, 4741-4757` (fixed-step loop, single `simStep` door, `advance()` hook) | `src/app/loop.ts` | Run in or next to the worker; publish snapshots to React at about 10 Hz | K44 |

### B2. REWRITE-FROM: re-implement with the old code or spec as reference

| ID | Reference source | → interbus | What to keep | What to fix or change |
|---|---|---|---|---|
| R01 | Intralines@7af45b1: `src/game/sim/demand.worker.ts` (gravity `:151-173`, visitors `:122-149`, wait `:248-265`, logit `:486-497`, satisfaction `:713-724`); `src/game/store.ts:573-662` (debounce + `reqId`) | `src/sim/demand/` (worker) | Model shape, worker plus `reqId` discard, determinism | Drop the 4-stop cap (`:323`, the measured cause of the rider drop) and the 3-line cap (`:413`, which V2 inherited); move traffic into the sim (`:251`); per-boarding fare (`:339-345`); avoid n² growth beyond the measured 44 MB at n=1,924 |
| R02 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/30-sim.js:284-331` (wait model + coverage), `:616-698, 2786-2830` (hour masks and classes), `:3853-3912` (coverage-by-service), `:88-103, 2636-2662, 3674-3705` (fare elasticity and taper), `:107-157` (hourly profiles) | `src/sim/demand/`, `src/sim/economy/` | Identity settings for each term; pool-neutral normalisation | No 3-line-by-id scan (`:2044-2047`); no 2-stops-per-zone (`:1987`); crowding and spill per hour (`:3203, :3223`); give captives a fare ceiling |
| R03 | Intralines_City@dc63602: `studio/docs/design/demand-model.md` §3–§4, §7; `src/game/demand/{stageA,demand,types,constants}.ts` | `src/sim/demand/` | Typed, allocation-free buffers; per-boarding fare term; min-over-legs crowding; linked trips vs boardings; 2-round search; named regression tests | Growable buffers instead of silent caps (`App.tsx:75-76, 482-490`); timetable-aware waits instead of `ASSUMED_HEADWAY_MIN 12`; 130 m interchange radius, not 650 m |
| R04 | Intralines_City@dc63602: `studio/docs/design/fleet-and-staff.md`, `depots-and-timetables.md` §4; Intralines@7af45b1: `src/game/constants.ts:310-387` (`headwayAtHour`) | `src/sim/fleet/`, `src/sim/timetable/` | Headway↔fleet duality; one canonical `LineTimetable`; drivers with auto-hire | Settle DECISIONS #25 vs #32 vs `save-format.md` §4 first; V2-style per-bus wear |
| R05 | Intralines@7af45b1: `src/game/store.ts:403-520` (actual report-card formulas); Intralines_City@dc63602: `studio/docs/design/report-cards.md`; Intralines_City_dep@archive/intralines-city-v1: `Gaming/docs/design/report-thresholds.md` | `src/sim/report/` | Projection line, grade ladder, "left on the table", coverage-by-service overlay | Reliability against the real timetable (K03); delete environment and staff categories or make them movable; calibrate against measured opening scores (V2: about 55–58) |
| R06 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/30-sim.js:4576-4972` (events, contracts, report, credit) + `docs/design/events.md`, `contracts.md` | `src/sim/events/`, `src/sim/contracts/` | One event at a time with a 1-day warning; difficulty-keyed rewards | Smooth the $60k–$480k tender variance across seeds |
| R07 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/docs/design/screen-layout.md` (§3, §4.3, §5, §10) + `Gaming/reference/screenshots/`; Intralines@7af45b1: `src/ui/Toolbar.tsx`, `TopBar.tsx`, `Panels.tsx:225-410, 958-967`; V2 `Gaming/src/50-ui.js:1779-1799` | `src/ui/` | Chip row, ≤8-slot dock, cursor cards, ≤8-word glosses, occlusion budgets with measurement snippets; blocked-with-reason in money | Labelled HUD numbers (K20); one draft preview (K10); test at 1152×720 (K31) |
| R08 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/docs/design/undo-redo.md`; `Gaming/src/60-main.js:604-700, 3371-3448` (dispatcher `{ok, reason}`, `begin`/`touch`/`commit`/`rollback`) | `src/sim/commands/` | Declared keys, transactions, one gesture = one entry, `{ok, reason}` | K22 (never snapshot sim-written state); label the undo button; a draft is one step |
| R09 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/docs/design/route-editing.md`, `transfer-boost.md`; `Gaming/src/10-core.js:87-108` (tier ladder, `STOP_SNAP_EXISTING_M 250`) | `src/sim/lines/`, `src/sim/demand/` | Pick-a-leg insert, shape epoch, snap-to-existing as the interchange mechanism, no line-count bonus | K23, K32 |
| R10 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/docs/design/dynamic-traffic.md`; `20-city.js:1387-1490`; `10-core.js:171-200` | `src/sim/traffic/` | One `congestionAt()`, normalised to mean 1.0 | Bus lanes later and arterial-only (K36) |
| R11 | Intralines@7af45b1: `src/ui/Menu.tsx`, `src/ui/Founding.tsx`, `src/ui/StationScene.tsx` | `src/ui/menu/`, `src/ui/station/` | Drill-in home, founding (name, colour, sandbox), paused start; diorama as a later charm item | Feed the diorama from sim events, not `window.__busLayer` (K08) |
| R12 | Intralines@7af45b1: `src/map/basemapStyle.ts:9-32, 375-547`, `src/map/overlays.ts:15-24, 55-114, 116-171, 378-424, 587-599`; Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/40-render.js:205-330, 446-458, 1487-1575` | `src/render/` | Paper palette, board mask, hashed scatter plus clusters, traffic ramp, casing ladder, LOD relative to fit zoom, dash and hatch encodings | Test style expressions (K21); bundle glyphs if MapLibre; render only on change |
| R13 | Intralines_City@dc63602: `src/render/three/{scene,lineLayers,busLayer,buildingLayer,cameraRig,lighting,nightTint,maskLayer}.ts`, `src/render/timeOfDay.ts`, `paperPalette.ts` (only if 3D) | `src/render/three/` | Unlit data layers inside a 0.75–1.15 lighting envelope; instanced buildings; keyboard camera | K46 (guarantee the footprint at the default camera); keep `IdPassRegistry` out of the shipping scene (K58); route ribbon z-fighting (K56) |

### B3. Constants and data tables

| ID | Source | Keep | Notes |
|---|---|---|---|
| C01 | Intralines@7af45b1: `src/game/constants.ts` (458 lines) | Bus models (Sparrow 28/$95k … Volt-E 75/$380k), stop tiers $4k/12k/35k/90k/200k with capacity 250…8,000, depots, wages ($26/h, $260/day per 6 buses), traffic anchors, express thresholds, `FARE_VALUE_PER_MIN 0.18`, `HOURLY_PROFILE`, `TOURIST_PROFILE` | Starting cash is undecided: V1 310k (measured in play), V2 400k, V3 500k (a guess, ⚠REVIEW). Balance drift: re-measure the starter line (+$2,810/day today) |
| C02 | Intralines@7af45b1: `src/game/data/cities.ts` | Per-city calibration: workforce 0.46–0.52, β 3.2–5.0 km, car 34–40 km/h | Only with real cities |
| C03 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/10-core.js:47-396` | Transfer ladder 6/6/5/3.5/2; events; contracts; lane costs; a11y thresholds; CVD line palettes `:387-394` | Palettes need an art pass (muddy; 9.5 ΔE vs roads) |
| C04 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/src/30-sim.js:44-390` | Wait-model constants (`SCHEDULE_AWARE_*`, `WAIT_PAIN_*`), coverage (`/64`, `^0.75`), fare-sensitivity clamps, landmark and rail profiles | Tunables are spread over 5 files in V2; consolidate |
| C05 | Intralines_City@dc63602: `src/game/constants.ts`, `src/game/depots/constants.ts`, `src/game/save/constants.ts`, `src/render/three/constants.ts` | 8 OSM road classes and speeds, SPEC/TUNE tagging, depot ladder $150k/225k/340k/505k/760k, save re-anchor tiers, camera (FOV 30, pitch 35) | V3 kept only 39 of 376 constants in the "single" file; pick one policy |

### B4. Docs, specs and reference material

| ID | Source | Use |
|---|---|---|
| D01 | Intralines@7af45b1: `docs/MANUAL.md`, `docs/DESIGN.md`, `docs/MODELS.md`, `CLAUDE.md:20-47` | Product reference, pillars and tone, artist hand-off contract, Pages deploy gates |
| D02 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/reference/screenshots/*.jpg` (V1.18 shots + `ours-current-boot-1440x900.png`) | The visual target and the side-by-side method |
| D03 | Intralines_City_dep@archive/intralines-city-v1: `Gaming/docs/design/{screen-layout,service-span,fare-balance,fare-elasticity,report-thresholds,transfer-boost,undo-redo,company-type}.md`, `Gaming/docs/devlog/*.md` | Exploit catalogue to turn into balance tests; IA spec |
| D04 | Intralines_City@dc63602: `studio/DECISIONS.md` (#14, #17, #25, #31–34, #38–53, #59–70), `studio/docs/design/{save-format,errors,depots-and-timetables,fares-and-express,demand-model}.md`, `studio/docs/baselines.md` | Decision-log format, pre-solved economy maths, performance-baseline method |
| D05 | Intralines_City@dc63602: `.claude/agents/playtester.md` ("never test a moving target"); Intralines_City_dep@orchestrator: `.claude/skills/gamedev/SKILL.md` | Only if an agent crew is used again; trim to 3–4 roles, all with a shell |

### B5. Test and harness seeds (written during the review, not in any repo)

The readers and skeptics wrote these harnesses on 2026-10-12 against copies of the repos. They were not committed anywhere, so the file names below only identify each check. Each one should be re-created in interbus as a committed test that names the bug it guards.

| ID | File | Becomes |
|---|---|---|
| T01 | `idtest.mjs`, `idtest2.mjs` | Regression: delete L2 and L3, reload, create a line ⇒ unique line and stop ids, and the line references its drawn stops (K01) |
| T02 | `econ.mjs`, `rel.mjs`, `savesize.mjs`; wear check in `idtest.mjs:33-37` / `idtest2.mjs:22-28` | Economy-per-day, wear-accrues, reliability and save-size assertions (K02, K03, K12) |
| T03 | `bench.mjs`, `bench_wide*.mjs`, `warm.js` | Performance budget suite: recompute ms on a 10-line / 116-stop / 50-bus network, monotonic riders vs lines (K04, K25) |
| T04 | `hub2.js`, `sweep.js`, `measure.js` | Hub boardings > 0 for every line at a 5-line hub (K23); bus × fare interior optimum; generator determinism |
| T05 | `shoot-v2.js`, `riders-check.js`, `riders-check2.js` | Playwright e2e: undo after a tick keeps earned cash (K22); off-centre stops board riders (K24) |
| T06 | `fare-check.mjs` | Fare, split and express tables as unit tests (K05, K49) |
| T07 | V1 skeptic re-runs (`idtest*.mjs`, `econ2.mjs`, `bench_worker*.mjs`, `benchS_*.mjs`, `colo.mjs`); V2 skeptic re-runs (`hub2-cap.js`, `undo-match.js`, `undo-wear.js`, `cover.js`); V3 and cross-version skeptic re-runs (`v1bench/split.mjs`, `reload-verify.log`, `offline-verify.log`) | The skeptics' re-runs: rider monotonicity on superset networks, hub-cap causation, exact undo-after-tick replay, the V1 line-split measurement, the reload clock and the offline check |

### B6. Explicit DROP list

| What | Where | Why |
|---|---|---|
| V1 god-store | V1 `src/game/store.ts` | 1,905 lines touched by 34 of 71 commits; holds K01, K02, K03 |
| V1 bus-mesh layer and DOM-marker overlays | V1 `src/map/busLayer3d.ts` (mesh parts), `MapView.tsx:259-339, 439-571` | Leaks, 18–33 draw calls per bus, sim logic in render (K06–K09) |
| V1 recovery layers | V1 `index.html:8-214`, `vite.config.ts` `versionedBoot`, `scripts/retain-assets.mjs`, `src/game/update.ts` (most of it) | Superseded by V3's PWA; about 1,050–1,190 LOC in today's files (345 of them general error UI) |
| V1 `Panels.tsx` as code | V1 `src/ui/Panels.tsx` | 60 KB in one file; port patterns only |
| V2 UI and controller code | V2 `Gaming/src/50-ui.js`, `60-main.js` (except S22 and R08 patterns) | Hand-rolled DOM, 41.2% occlusion |
| V2 browser a11y harness | V2 `Gaming/tools/a11y-browser.js` (279,756 B) | About 32–34 s per cache-missing build; never run in CI; blocked the layout rework |
| V2 company type, government, collector and local lanes, night roads | V2 `30-sim.js:1486-1668`, `company-type.md`, `government.md` | Never settled; meta on meta |
| V3 model pipeline, viewer, basis vendoring | V3 `scripts/models/*`, `studio/viewer/*`, `scripts/vendor-basis.mjs`, `modelBudgets.ts` | 0 models ever; budget drift (K48) |
| V3 rendered contrast suite (54 cases) | V3 `src/render/three/contrast.rendered.test.ts` | Replace with one default-camera smoke test, plus the palette unit test |

---

## C. Known-bug register

Each defect below was verified by a reader; those re-checked by the skeptic pass carry (verified) or (corrected). Severity is for the final game *if the code or rule is carried over*. "Via" names the salvage item that would inherit the defect.

### V1 (`Intralines@7af45b1`, branch `claude/city-bus-manager-game-rmdul2`)

| ID | Location | Defect | Repro / evidence | Sev | Via |
|---|---|---|---|---|---|
| K01 | `src/game/store.ts:817-818` (and `:1327-1328`) | `lineSeq`/`stopSeq` set to `length + 1` on load, so deletes followed by a reload reissue live ids. `finishDraft` then treats the new stop as "existing" | Create L1–L4, delete L2 and L3, reload: the next line is a second `L4`, and its stops alias unrelated old ones, which are not charged (2,818 / 3,606 / 5,031 m from the drawn path in that geometry; they can be anywhere) (review harnesses `idtest.mjs`, `idtest2.mjs`) (corrected) | High | Any port of store/save logic; S02 must keep V3 `nextIds` |
| K02 | `src/game/store.ts:932-936` | Wear counts only lines whose legacy `modelId` matches; lines since v1.15 use `vehiclesByModel` | Wear 0.00 after one game day vs 2.20 with a legacy `modelId` (review harness `idtest.mjs:33-37` vs control `idtest2.mjs:22-28`); `MANUAL.md:456-462` still promises 2.2/day (verified) | High | R04 |
| K03 | `src/game/store.ts:476` | Report-card reliability compares the effective headway to legacy `headwayMin` (default 15), ignoring timetable modes | A line running exactly its timetable (2 of 2 buses) scores 39/100 (review harness `rel.mjs`) [M, R✓] | Med | R05 |
| K04 | `src/game/sim/demand.worker.ts:323, 413` | Catchment keeps the 4 nearest stops per block group; `LINES_LIMIT = 3` per stop | Synthetic Riverton riders 9,443 → 8,087 → 6,537 at 5/15/30 lines; widening the stop cap gives 9,605 / 10,997 / 10,192. The 4-stop cap is the whole cause; `LINES_LIMIT` had no effect in this bench; on superset networks stock V1 loses riders as lines are added and the widened cap is monotonic; real-city magnitude unmeasured (review harnesses `bench_wide*.mjs`, `benchS_*.mjs`) (verified) | Med | R01 |
| K05 | `src/game/sim/demand.worker.ts:339-345, 503-504`; `store.ts:899` | Fare perceived as deviation-only per leg, while revenue is booked per boarding on each line, so splitting a line pays | Measured on V1's real worker at $2.25: +8% to +28% (plain stop) and +29% to +62% (hub) across four corridors (review harness `v1bench/split.mjs`). The +38% / +69% figures are V3's stylised spec arithmetic (corrected) | Med | R01, R03 |
| K06 | `demand.worker.ts:251` vs `src/map/MapView.tsx:505`, `busLayer3d.ts:383-389` | AADT and class congestion only change animation speed; the AADT pipeline has no gameplay effect | Code read and grep (verified); `changelog.ts:91` claims "your running times all use the new model"; DESIGN.md:99-100 vs README.md:135 contradict each other [R] | Med | R10, S14 |
| K07 | `src/map/busLayer3d.ts:366` vs `demand.worker.ts:209-219` vs `src/ui/Panels.tsx:43-59` | Three cycle-time formulas: visual buses run a shorter cycle than the one the economy bills | Visual `cycleMin = 2*outboundMin + 2*LAYOVER_MIN` includes the 20 s intermediate-stop dwell but omits the per-stop buffer, the extra terminal dwell (2 × `DWELL_SEC`) and the amortised refuel that the worker bills (corrected) | Med | S03 |
| K08 | `busLayer3d.ts:682-690`, `549-554`; `src/ui/StationScene.tsx:439` | "Served" is detected only when a rendered frame lands a bus within 25 m; waiting counts and the diorama depend on frame rate; the diorama reads `window.__busLayer` | Code read [R] | Med | R11 |
| K09 | `busLayer3d.ts:298-424, 308, 711` | Meshes rebuilt on every lines/stats change, never disposed; 18–33 draw calls per bus; repaint every frame while paused | Node probe: minibus 18, citybus 26, double-decker 27, electric 28, artic 33 meshes, 9–14 materials each; `setNetwork` is called from an effect on `[lines, stats, stops]` (verified) | Med–High (perf) | Do not port the mesh code |
| K10 | `src/ui/DraftBar.tsx:51` vs `src/ui/Panels.tsx:854-856` | Draft cost charges reused stops in one preview but not the other | Code read [R✓] | Low | R07 |
| K11 | `src/game/constants.ts:248`, `src/game/migrate.ts:69` | `SAVE_VERSION = 1` since v0.1, so the newer-save guard can never fire | [R✓] | Low | S02 |
| K12 | `src/game/types.ts:152-189` | Derived line geometry (`path`, `cum`, `stopDist`) is persisted: 45% of a one-line save | 3,094 B save (review harness `savesize.mjs`) [M] | Low | S02 |
| K13 | `src/game/routing.ts:276-293, 170-180` | A* closes nodes while the turn penalty depends on the incoming edge, so routes can be suboptimal; `insertStopNode` mutates shared `pack` arrays | Code read; impact unmeasured [R✓] | Low | S16 |
| K14 | `src/ui/ErrorCenter.tsx:43-45` | Throws before a `useEffect`, breaking the rules of hooks | [R✓] | Low | S07 |
| K15 | `src/game/update.ts:47,153`; `electron/main.cjs` | Electron builds carry a dev `BUILD_ID`: no SW, no update check; scheme privileges omit `allowServiceWorkers`; unsigned; not in CI | Code read (verified) | Med (if desktop) | S19 |
| K16 | `src/game/constants.ts:397-412` | Express too easy; balance drifted after visitors and express | A 5-stop, 5.3 km starter is express at +$3,167/day; a 9-stop line nets +$2,810/day vs the claimed ~+$1,000 (review harness `econ.mjs`) (verified) | Low (balance) | C01 |
| K17 | `constants.ts` staff numbers | Hiring the required mechanic loses money on a 1-bus fleet ($260/day > 40% surcharge saved) | +$2,810 → +$2,606/day (verified) | Low (balance) | C01 |
| K18 | `scripts/bake-city.mjs:25-67` vs `src/game/data/cities.ts` | City list and fetch logic duplicated and already drifting (zoom 12.6 vs 13.1) | [R] | Low | S14 |
| K19 | `src/game/data/loadCity.ts:68-75` | LODES has no CORS, so the browser path always estimates jobs; real data exists only via the best-effort CI bake | `3695f23`; local bake `fetch failed` [M/R] | Med (if real cities) | S14 |
| K20 | `src/ui/TopBar.tsx:77-99` | Unlabelled top-bar chips; `MANUAL.md` §5 calls the second chip "Drivers" but it shows riders served | [R] | Low | R07 |
| K21 | `src/map/overlays.ts` (ee9c2c1) | A MapLibre `['zoom']` nested inside `['case']` silently fails to build the layer | Commit body `ee9c2c1` [C] | Low (trap) | R12 |

### V2 (`Intralines_City_dep@archive/intralines-city-v1`, paths under `Gaming/`)

| ID | Location | Defect | Repro / evidence | Sev | Via |
|---|---|---|---|---|---|
| K22 | `src/60-main.js:612-662`; `simStep` `:4271-4279` | Undo restores whole-key snapshots of keys the sim also writes (`cash`, `fleet`); history is not cleared on ticks | Buy a $95k bus, advance exactly 32 game hours, undo: cash 39,266.67 → **135,000** (correct 134,266.67; $733 erased); undoing a bus assignment resets wear 2.2 → 0; redo does not restore the hash (review harnesses `undo-match.js`, `undo-wear.js`) (corrected; the review's earlier $760 implies about 33 h). `tools/playtest.js:2624-2647` never ticks (verified) | High | R08 |
| K23 | `src/30-sim.js:2044-2047`; `src/10-core.js:96, 111` | Riders scan 3 lines per stop, sorted by id; the Transfer Hub tier requires 5 | 5-line hub boardings 1,621 / 1,210 / 713 / **0 / 0** (review harness `hub2.js`); a cap of 10 restores 554 and 810 boardings on lines 3 and 4 (review harness `hub2-cap.js`) (verified) | High | R02, R09 |
| K24 | `src/30-sim.js:211, 1447, 1987` | Demand at 22–29 centroids; 2 access stops per zone | About 25–26% (grid/river) and 36–37% (radial) of street nodes within 650 m of a district centroid (27–29% / 37–39% with landmark and rail pseudo-zones); stops 508–1,903 m off centres → 0 riders for 3 game days, before and after `5b57b82`; five stops on the nearest centres → 665/day (review harnesses `riders-check*.js`, `cover.js`) (verified) | High (design) | Generators (row 1), R02 |
| K25 | `src/60-main.js:3450` (sync recompute) | Sim runs on the main thread, over budget on mid-game networks | 10 lines / 116 stops / 50 buses: warm about 65–100 ms, edit 137–148 ms, assistant 1.70–1.77 s (verified); `busLaneQuote` 77–108 ms per hover [M] (review harness `warm.js`) | High | R01/R02 (must run in a worker) |
| K26 | `tools/pack.js:556-640` (`buildZones`) | Merges all contiguous same-kind land use into one district, radius clamped to 900 m | Synthetic 7×7 km OSM → 2 districts; "Northfield" holds 171,180 residents (review harnesses `mkosm.py`, `packplay.js`) (verified) | High (if packs) | S13 |
| K27 | `src/30-sim.js:3203, 3223` | `crowdFactor` is one value per line from its worst hour; stop spill compares daily boardings to capacity | BACKLOG: midday-only span "still paid about +20%" [R] | Med | R02 |
| K28 | `src/30-sim.js:2667-2688` (captive step) | Captive riders are fare-inelastic, so a starved line at max fare stays near-optimal | One grid line: 1 bus at $5 = $3,312 vs best $4,356 (76%); boardings 817 at $2.25 vs 814 at $5 (review harness `sweep.js`) [M] | Med | R02 |
| K29 | `src/50-ui.js:1647-1648` | Save button announces "Company saved." without checking the dispatch result | [R✓] | Low | R07 |
| K30 | `src/60-main.js:197` | One save slot, no autosave, no `pagehide`/`visibilitychange` guard | grep finds none in `src/` [R✓] | Med | S02 covers it |
| K31 | `src/50-ui.js:843-848` | At ≤1180 px `.il-mid` is hidden (cursor cards and event banner gone); the dock covers the map | Screenshot `09-laptop-1152x720.png` [M, R✓] | Med | R07 |
| K32 | `src/30-sim.js` `busPositions` `:4497` | Reordering stops still moves a bus 3,117 m (shape epoch anchors by stop identity) | `57dcdc0` body [C] | Low | R09 |
| K33 | `src/60-main.js:3837, 4613`; `src/50-ui.js:1631` | Undo button never names its action; a line draft is 5 + 1 undo entries | Run log [M] | Low | R08 |
| K34 | `src/10-core.js` `num()` helper | `num(x, NaN)` returns 0, so `isFinite(num(x, NaN))` is always true | `57dcdc0` body [C] | Low (trap) | Any guarded-arithmetic port |
| K35 | `src/50-ui.js:191-215, 254-322`; `src/60-main.js:228-246` | Tunables duplicated as UI `tune()` fallbacks and `defineDefaults`; `INSPECTOR_W_PX` bare literal | [R] | Low | C03/C04 |
| K36 | `src/10-core.js:208-211`; report weights `:256-263` | Collector and local bus lanes never repay; environment is a dead 5 points; staff ≈100 for all | `bus-lanes.md`, `report-thresholds.md` [R] | Low (design) | R05, R10 |
| K37 | `src/40-render.js` ground cache | Ground rebuild takes 34–38 ms in the 2.4–4.7× zoom band against a 25 ms budget | BACKLOG / `cb71cbe` [C] | Low | R12 |
| K38 | `.github/workflows/pages.yml` vs `tools/build.js:32-35` | CI never runs the browser gate the docs require | The only CI run logged "a11y browser: NOT RUN (Playwright is not installed)" (verified) | Low (process) | — |
| K39 | `src/10-core.js:387-394` | Metric-picked line palettes are muddy; dark lines are 9.5 ΔE from roads (bar 20) | BACKLOG [R] | Low | C03 |

### V3 (`Intralines_City@dc63602`, branch `main`)

| ID | Location | Defect | Repro / evidence | Sev | Via |
|---|---|---|---|---|---|
| K40 | `src/game/economy/ledger.ts:217`; `src/App.tsx:530` | Income hard-coded `{ fareCents: 0, citySubsidyCents: 0 }`; `kmDriven: 0` | Play at speed 10: cash 479,943 → 479,890 → 479,837 per 5 s; the only inflow is the stop-undo refund (verified) | High | S01 |
| K41 | `src/ui/TopBar.tsx:127` vs `src/App.tsx:358-359` | TopBar formats raw `clock.totalMinutes`; everything else adds the saved offset | Reload at 07:16 shows 06:00 while the save holds 76.5 min; `App.tsx:844` passes the raw clock (review screenshot `06-after-reload.png` and log `reload-verify.log`) (verified) | Med | S05 |
| K42 | `src/App.tsx:60` | `BUSES_PER_NEW_LINE = 2` free buses; `priceUsd` never charged; contradicts DECISIONS #25 | (verified) | Med | R04 |
| K43 | `src/App.tsx:864-868`; `src/ui/DepotPanel.tsx`; `src/game/depots/deadhead.ts` | Depots cost $150k but render nothing; no eligibility tint; panel and deadhead have no importer | Sweep found one valid screen point; placed depot invisible (review screenshots `04-depot.png`, `05-depot-placed.png`) (verified) | Med | S06 |
| K44 | `src/game/clock/useGameClock.ts`; `src/App.tsx:621-623` | `setClock` every rAF re-renders the 901-line `App`; the autosave debounce resets every frame, so only the 10 s floor fires | [R✓] | Med | S05, S22 |
| K45 | `src/App.tsx:75-76, 482-490` | Demand buffers fixed at 200 stops / 40 lines; past that, demand silently stops updating (console only) | [R✓] | Med | R03 |
| K46 | `src/render/three/constants.ts:85-90`; `contrast.rendered.test.ts:129-139`; `mapCanvasWiring.rendered.test.ts:282` | Buses are nearly invisible at the default whole-city framing; the gate passes only on a line-zoomed viewport and a `diff > 0` assertion | Re-measured: the live frame with buses differs from the empty frame by 6 pixels; the gate uses `fixtureLineViewport` (`contrast.rendered.test.ts:129-141`, used at `:277`) (verified) | Med | R13 |
| K47 | `src/App.tsx:493` | Riders/day shows boardings, while the spec says linked trips (identical only because transfers are absent) | [R✓] | Low | R03 |
| K48 | `src/render/three/modelBudgets.ts:58-64` | Vehicle budget 4,000 tris / 45 KB vs the spec's 6,000 / 80 KB | [R✓] | Low | Dropped |
| K49 | `studio/docs/design/fares-and-express.md` §6 | Under the spec's own formulas, express revenue rises to the $5 cap | $2.465 at $2.25 vs $2.737 at $5.00 ($3.177 with ×0.85) (review harness `fare-check.mjs`) (verified; stylised marginal pair, revenue only) | Med (if spec ported) | R03 |
| K50 | `report-cards.md` §2, `demand-model.md` §4 | Interchange cluster at 650 m (V1 code: 130 m) | [R] | Med (if spec ported) | R03, R09 |
| K51 | DECISIONS #25 vs #32 vs `save-format.md` §4 | Three different stored timetable shapes | [R] | Med (design) | R04, S02 |
| K52 | `src/game/lines/snapToRoad.ts:37-62` | Rebuilds the node map and scans every edge on every click | [R] | Low | S04 |
| K53 | `vitest.workspace.ts`, `vite.config.render.ts` | Render tests require Playwright's exact Chromium revision (1234 vs 1194 available) | First run failed; needed an `executablePath` override [M] | Low | S09 |
| K54 | `src/game/depots/types.ts:16`, `src/game/save/types.ts:28`; four `geo.ts` | `DepotId` defined twice; 4 geo modules; only 39 of 376 constants in `constants.ts` | [R] | Low | S06, S15 |
| K55 | `src/game/save/constants.ts:16` vs V1 `src/game/constants.ts:249` | Cannot read V1 saves (`intralines.save.` vs `intralines-save-`), against its own house rule | [R✓] | Low (decision) | S02 |
| K56 | `src/render/three/constants.ts:59-61` | Speckle on the route ribbon at zoom (suspected z-fighting, Y_ROAD 0.06 vs Y_ROUTE 0.1) | Review screenshot `09-zoom-moderate.png`; cause unverified [M] | Low | R13 |
| K57 | `package-lock.json` | 14 npm audit findings (3 moderate, 8 high, 3 critical) | `npm ci` log [M] | Low | S09 |
| K58 | `src/render/three/scene.ts:175` | Test scaffolding (`IdPassRegistry`) built into the shipping scene | [R] | Low | R13 |

### Cross-version patterns (each of these hit two or three versions)

- **Truncation caps that silently zero riders.**
  - V1: 4 nearest stops per block group (the measured cause) and 3 lines per stop.
  - V2: 3 lines by id (zeroing lines 4 and 5 at a hub) and 2 stops per zone.
  - V3: 200 stops and 40 lines.

  Rule for interbus: no fixed cap without a measured perf reason, an in-game warning and a test.
- **Two copies of one rule drift apart.**
  - V1 wear and reliability.
  - V1's three cycle-time formulas.
  - V2's 25% panel disagreement.
  - V3's two `DepotId` definitions and constant near-miss #63.

  Rule: one function per rule, shared by sim, ledger and UI.
- **A whole-day quantity graded against an hourly reality.** This is V2's six exploits plus K27. Rule: per-hour everywhere.
- **The tested path differs from the shipped path.**
  - V2's undo test never ticks.
  - V3's gate frames the line, not the default camera.
  - V3 has 0 App/UI tests.
  - V1's screenshot test swallowed a failure.

  Rule: an e2e smoke test of the default boot.

---

## D. Tech stack options for interbus

The readers measured these facts. They do not decide between the options; they constrain them.

### D0. Measured baselines across V1–V3

| Metric | V1 (React + MapLibre + three + Electron) | V2 (plain JS + Canvas 2D, single file) | V3 (React + three.js + PWA) |
|---|---|---|---|
| Runtime deps | maplibre-gl ^4.7.1, react 18, three ^0.169, zustand 4 | none | react 18 (three ^0.185 bundled as a dev dep) |
| Install | `npm ci` 521 packages, ~15 s | none | `npm ci` 680 packages; 14 audit findings |
| Build | `tsc -b && vite build` about 11–12 s wall (verified) | `build.js` about 0.4–0.5 s without the browser gate; about 33–38 s with it (verified) | `tsc -b` 4.9 s + build 9.6 s |
| Shipped JS | **1,755 kB / 493 kB gzip** (1 chunk, warning muted) + worker 10.3 kB + CSS 91.8 kB | **1,333,034 B / 388,736 B (379.6 KiB) gzip** (whole game in one HTML) | **811 kB / 226.5 kB gzip** (1 chunk); Canvas-era critical path was 75.2 KiB |
| Boot / first frame | not measured (no browser in the review environment) | 204–279 ms to game state, 0 network requests | First WebGL frame 119–135 ms (M1 Pro GPU); **726–926 ms plus 113–119 ms long tasks on SwiftShader** (author-measured) |
| Tests | 9 pipeline fixture blocks, 0.19 s | 67 tests, 6–7 s | 259 node (7.5 s) + 57 render (14.9 s) = 316 |
| Source volume | ~15.9k src lines; god files of 1,905 / 1,640 / 1,108 lines | 27,212 lines in 6 files (largest 7,947) + 11,743 tool lines | 12,068 non-test + 5,487 test lines |
| Sim placement | Web Worker, 32–83 ms recompute at n=481 | Main thread, 65–100 ms warm on 10 lines | Main thread `setTimeout`, round 1 only |
| Playable scope at end | Full loop (24 versions) | Full loop + events/tenders, UI too dense | No income; not a game |

### D1. Common foundation (every option)

These carry over regardless of renderer, and each is backed by evidence above.

- **Language and checks.** TypeScript strict with `noUncheckedIndexedAccess` (V3). V2's plain-JS files reached 283–407 KB each and needed regex "contract" tests.
- **Sim in a Web Worker.** Pure, allocation-aware modules in the V3 style, behind V1's debounce plus `reqId` discard. V2's synchronous recompute ran about 2.6–6× over its 25 ms budget (65–148 ms), and V1's worker kept the UI responsive.
- **A fixed-step loop outside React state** (V2 `simStep` plus `advance()`), publishing snapshots at about 10 Hz. V3 re-rendered the whole App every frame.
- **Ported modules:** V3's integer-cent ledger, save envelope, clock-pure bus positions, PWA prompt-update and Vitest/CI. Add a Playwright e2e smoke test against a pinned browser.
- **Committed harnesses.** Balance, performance and exploit regression harnesses in the repo from week one. All three versions lost or never committed them.

### D2. Option A: "Typed sim + 2D board" (TS · Vite · React chrome · Canvas 2D or a 2D WebGL batcher · PWA, optional Electron)

- **What it is.** V3's module discipline plus V2's canvas cartography (ground cache, LOD relative to fit, batched paths), drawn in V1's paper palette with the board mask. The camera is top-down or slightly pitched (2.5D via projection). Procedural cities come first; real cities optionally via IL-PACK.
- **Evidence for:**
  - Lightest and fastest boot of the three. V3's Canvas build had a 75.2 KiB gzip critical path and a 67–141 ms first frame; V2 booted in 204–279 ms with 0 requests.
  - No GPU or software-GL risk. The 726–926 ms long task is a WebGL-only failure mode.
  - V2 proved Canvas-path batching (65.8 → 2.2 ms) and a cached ground layer.
- **Evidence against:**
  - The player rejected V2's flat look: "make the game more like bobbyjohn-nil.github.io/Intralines/" (first recorded in `screen-layout.md:3-4`, `980759d`; corrected), and the feedback commit `c1d73de` lists "The map does not read as a city" (Claude's wording, attributed to the player).
  - V2's ground rebuild ran 34–38 ms in mid zoom against a 25 ms budget.
  - V3's Canvas era spent 7 verification passes and 6 causes on an invisible bus, so the bus footprint must be guaranteed structurally from day one.
  - V2's map suggested demand everywhere while riders came only from disc centres.
- **Main risk:** the look. Mitigate it by targeting V1's screenshots side by side (D02) from the first week.

### D3. Option B: "V1's look, rebuilt clean" (TS · Vite · React · MapLibre GL + three.js custom layer · worker sim · offline-baked city packs · PWA + Electron)

- **What it is.** The V1 architecture with its defects removed:
  - instanced buses that are disposed on rebuild;
  - render only on change or while unpaused;
  - bundled glyph PBFs so stop labels are symbol layers, not DOM markers;
  - sim truth (traffic, deadheads, "served") moved into the worker;
  - code splitting.

  Real US cities via V1 `pipeline.js`, baked offline.
- **Evidence for:**
  - It is the look and shape the player asked to return to: 5.3% chrome at rest, tilted streets and 3D buildings.
  - V1's pipeline is fixture-tested.
  - V1's worker sim was the right architecture: 32–83 ms at n=481, deterministic.
  - Real streets, tilt and buildings come from the map library.
- **Evidence against:**
  - The heaviest bundle measured: 1,755 kB / 493 kB gzip as shipped (verified).
  - Real-data delivery was V1's largest time sink:
    - about 13 of 71 commits went to deploy and caching;
    - LODES has no CORS;
    - Census and Overpass rate-limit;
    - `PACK_FORMAT_VERSION` went 1→9 in 8 days;
    - the CI bake did ship three real cities, but their size ("tens of MB" per `4a47dc1`) cannot be re-checked, because the packs are gitignored and the local bake fails without network (corrected).
  - A shared GL context needs `resetState()` every frame.
  - MapLibre expressions fail silently (K21).
  - V2's converter and V3's city-packs spec show the zone-resolution problem (`ZONE_CAP 512` ≈ 400 km²) and the routing cliff above 16k nodes.
- **Main risk:** the data pipeline and the hosting of baked packs eat the schedule. Mitigate by shipping one validated real city plus procedural cities, with packs in CI artifacts measured before launch.

### D4. Option C: "V3 Route B — one three.js scene" (TS · Vite · React · three.js scene with unlit data layers · worker sim · procedural cities (+ optional IL-PACK) · PWA, optional Electron)

- **What it is.** V3's `render/three` layers (instanced buildings, camera rig with pitch 0–60, night tint) with V1's palette and board mask. No tile or glyph dependency. Buses are instanced placeholders with a guaranteed screen footprint and LOD. No model pipeline until an artist delivers.
- **Evidence for:**
  - V3's renderer builds and is tested (57 render tests pass; verified).
  - The readers judged it the nicest-looking map of the three.
  - Unlit data layers make contrast provable (DECISIONS #66).
  - It gives the V1-like tilted look without V1's real-data dependency.
  - The bundle is half of V1's: 226.5 kB vs 493 kB gzip.
- **Evidence against:**
  - The critical path is 2.93× the Canvas build (75.2 → 220.3 KiB; verified against `baselines.md`, author-measured).
  - 726–926 ms long tasks on software GL.
  - At default framing the frame with buses differs from the empty one by 6 pixels, even after two eras of fixes (verified).
  - 123 of 316 tests and about 5.4k LOC went to presentation infrastructure while income stayed at 0. This is the clearest evidence that 3D pulled V3 off the core loop.
  - Zero models ever arrived, for either V1's or V3's pipeline (verified: no model file in any repo's history).
- **Main risk:** renderer work crowds out the economy again. Mitigate with a hard rule: the money loop, goals and failure state are closed and playtested before any renderer work beyond a basic scene.

### D5. Trade-offs side by side

| Criterion | A: Typed + 2D board | B: MapLibre + three (V1 look) | C: three.js scene (V3) |
|---|---|---|---|
| Matches the look the player asked for | Weakest (V2's flat canvas rejected), depends on art direction | Strongest (it *is* V1's look) | Strong (tilted, buildings) |
| Bundle evidence | ~75 KiB gzip critical path (V3 Canvas era) | 493 kB gzip as shipped by V1 | 226.5 kB gzip (V3) |
| Perf risk | Mid-zoom ground rebuild (34–38 ms in V2) | Per-bus draw calls, DOM markers, GL context sharing (all fixable, all seen) | Software-GL long task 726–926 ms; tiny bus at default framing |
| Reuse from V1–V3 | V3 sim + V2 render rules | V1 style, overlays, pipeline + V3 sim | V3 render + V3 sim |
| Real cities | Optional via IL-PACK | Native (and the biggest schedule risk) | Optional via IL-PACK |
| History of crowding out gameplay | Low | High (V1 deploy saga, ~13/71 commits) | High (V3 renderer, 39% of tests) |
| Desktop (Electron `app://`) | Easy | Easy (V1 already did it) | Easy |

**Not recommended:** V2's plain-JS single-file approach as the main stack. It had no types, 5–8k-line files, and source-regex contract tests that "an apostrophe" broke. Keep only its offline audit (S20) and its one-file distribution idea, which a Vite single-file plugin can reproduce.

### D6. Owner decisions that pick between the options

1. **Real US cities in v1.0, or procedural first?** This decides B versus A/C, and whether S14 and C02 are in scope.
2. **Web (Pages, itch) or desktop (Steam) as the first publish target?** This decides PWA-only versus PWA plus Electron (S19, K15).
3. **Is the tilted 3D look a must for the Jan–Feb 2027 publish?** This decides C or B over A.
4. **Design questions that are not stack questions but block the schema:**
   - starting cash: 310k, 400k or 500k;
   - per-line fares (all three save schemas say yes);
   - the timetable stored shape (K51);
   - whether V1 saves must import (K55).

---

## Appendix: load-bearing claims behind the verdicts

Each claim is stated as it stands after the 2026-10-12 skeptic pass. Partly-true claims use the corrected wording.

| ID | Claim (as verified) | Evidence | Status |
|---|---|---|---|
| M01 | V1 `store.ts:817-818` sets `lineSeq = sv.lines.length + 1` and `stopSeq = sv.stops.length + 1` on load, while depots use the max existing id (`:819-822`). Deleting lines and then reloading reissues a live id (lines L1, L4, L4). `finishDraft` (`:1327-1328`) then treats reissued stop ids as existing stops, so the new line silently reuses unrelated old stops without paying for them; in the harness they were 2,818 m, 3,606 m and 5,031 m from the drawn path, and they can be anywhere | Re-read source at `7af45b1`; `idtest.mjs`, `idtest2.mjs` re-run on a fresh bundle | (corrected) |
| M02 | V1 `store.ts:932-936` counts in-service buses only where `l.active && l.modelId === f.modelId`. Lines created since v1.15 (`83ce324`) carry only `vehiclesByModel`, and nothing in `src/` sets a line's `modelId`, so their buses never wear: 0.00 after a game day vs 2.20 with a legacy `modelId` | Source read and grep; `idtest.mjs` / `idtest2.mjs` re-run | (verified) |
| M03 | V1's worker keeps the 4 nearest stops per block group (`demand.worker.ts:323`) and `LINES_LIMIT = 3` (`:413`). On synthetic Riverton riders fell 9,443 → 8,087 → 6,537 from 5 to 15 to 30 lines (12/15/20 stops per line), vs 9,605 / 10,997 / 10,192 with the stop cap widened to 400. The 4-stop cap causes the whole drop; `LINES_LIMIT` has no effect in this bench. Superset networks: stock 9,093 / 8,087 / 7,362 / 8,311, widened 9,276 / 10,997 / 11,239 / 12,938. The network is artificial, so real-city magnitude is unmeasured | Fresh worker bundle plus sed variants; `bench.mjs`, `benchS_*.mjs`, `colo.mjs` | (verified) |
| M04 | V2 sorts lines at a stop by id and keeps `MAX_LINES_SCANNED_PER_STOP = 3` (`30-sim.js:2044-2047`, `10-core.js:111`), while the Transfer Hub tier requires `minLines: 5` (`10-core.js:96`). A 5-line hub boarded 1,621 / 1,210 / 713 / 0 / 0; lines 3 and 4 still alighted 132 and 170 there; a cap of 10 restores 554 and 810 | Review harness `hub2.js` re-run exactly; `hub2-cap.js` | (verified) |
| M05 | V2 undo restores whole-key deep-clone snapshots (`60-main.js:612-662`) of keys the sim also writes, and `simStep` never clears history. Undoing a $95k bus purchase after exactly 32 game hours set cash to $135,000 instead of $134,266.67 ($733 erased); the review's earlier $134,240 / $760 implies about 33 h. Redo did not restore the state hash | `undo-match.js`, `undo-check.js`, `undo-wear.js` (Playwright on archive `dist`) | (corrected) |
| M06 | V3 `accrue` always returns `income: { fareCents: 0, citySubsidyCents: 0 }` (`ledger.ts:217`), and `App.tsx:527-532` calls it with `kmDriven: 0` (line 530). In play, cash only fell: 479,943 → 479,890 → 479,837 at 5 s samples on speed 10 | Source read at `dc63602`; review play log (`play.log:11-13`) | (verified) |
| M07 | V3 `TopBar.tsx:127` formats raw `clock.totalMinutes`, and `App.tsx:844` passes the raw clock, while `App.tsx:358-359` adds the saved offset for every other consumer, autosave included. After a reload the top bar read 06:00 while the save held 76.5 min (07:16) | Reload harness re-run against `vite preview` | (verified) |
| M08 | V3: 259 node tests in 22 files (wall 7.5 s) plus 57 rendered tests in 2 files (wall 14.9 s) = 316; `tsc -b` 4.9 s; `npm run build` 9.6 s → one 811.36 kB / 226.47 kB gzip app chunk plus a 5.71 kB workbox-window chunk | Review logs `vitest-node.log`, `vitest-render.log`, `tsc.log`, `build.log` | (verified) |
| M09 | V1 builds with `tsc -b && vite build` in about 11–12 s wall (vite stage 5.5–6.5 s) to one 1,755.01 kB / 493.01 kB gzip main chunk plus a 10.32 kB worker chunk, with `chunkSizeWarningLimit: 2000` (`vite.config.ts:234`). Its only automated test is `npm test` → `scripts/test-pipeline.mjs` (0.19 s); no other test or spec file is tracked | Rebuilt a `git archive` export of HEAD; `git ls-files` | (verified) |
| M10 | V2: `playtest.js` 67/67 in 6.3–7.0 s; `build.js` emits 1,333,034 B, 388,736 B at gzip level 9 (printed as "379.6 KB", i.e. KiB), byte-identical on rebuild; a cache-missing build with the browser a11y gate takes about 33–35 s (gate 32.1 s), without it about 0.5 s; CI's build took 442 ms | Review rebuilds; CI job 93999889404 | (verified) |
| M11 | V3's `baselines.md` (author-measured on an M1 Pro, at the now-missing commits `f06ce54` and `0e4740e`) records: gzipped critical path (HTML + JS + CSS + workbox-window) 75.2 → 220.3 KiB (2.93×); first WebGL frame 119.0–135.4 ms on GPU; on SwiftShader two long tasks per boot, 726–926 ms and 113–119 ms, none on GPU. Not re-measured | `baselines.md` lines 31, 138-141, 158-169, 189-212, 238-247 | (verified as documented) |
| M12 | V2's `screen-layout.md` reports V2's chrome at 41.2% of the map at rest with 271 standing words (352 with below the fold) against v1.18's 5.3% and 0. `c1d73de` records "break things up, make different pages for things, simplify, lighten it up, and clean up" verbatim; the "make the game more like bobbyjohn-nil.github.io/Intralines/" quote is in the `screen-layout.md` header (lines 3–4, added in `980759d`) | `screen-layout.md` lines 1-8, 28-47, 187-207; `git show c1d73de`, `980759d`; `git log -S` | (verified) |
| M13 | V2 places demand at 22–29 district centroids, plus 7–9 landmark and rail pseudo-zones, with `SIM_MAX_STOPS_PER_ZONE: 2` (`30-sim.js:211`, applied at `:1987`). About 25–26% (grid/river) and 36–37% (radial) of street nodes lie within 650 m of a district centroid (27–29% / 37–39% with pseudo-zones). A line 508–1,903 m off centres drew 0 riders for 3 game days, before and after `5b57b82`; five stops on the centres drew 665/day | `cover.js` over 9 seeds, `measure.js`; `riders-check*.js` on archive and `5b57b82^` | (verified) |
| M14 | On a 10-line / 116-stop / 50-bus network V2's synchronous main-thread recompute (`60-main.js:3450`) takes about 65–100 ms warm, 137–148 ms after an edit and 1.70–1.77 s for `assistantPlan`, against its own 25 ms stop-click target. V1's worker code takes about 32–83 ms at n=481 on synthetic 1–30-line networks, off the main thread. Different networks, so not like-for-like; timings vary by machine by about 5–10% | `warm.js`, `sweep.js`, V1 `bench.mjs` re-run | (verified) |
| M15 | V3 persists its id counters in the save (`SaveData.nextIds`, `save/types.ts:153`; written at `App.tsx:327`, restored at `:392-393, 400`); stop, line and depot counters only increase, but the bus counter is always written as `FIRST_BUS_ID` and buses are saved as `[]`. `save/load.ts` returns none / ok / newer / unreadable / wrong_city, and copies unreadable and newer saves to `intralines.backup.<cityId>.unreadable` / `.newer`. 11 save tests pass | Source read; `vitest-node.log` | (verified) |
| M16 | V3 bus position is a pure function of the clock (`busPositionAt`, `position.ts:99`; no-teleport max step 9.577 m over a full round trip at 1 s sampling). V1's visual cycle (`busLayer3d.ts:366`, `2*outboundMin + 2*LAYOVER_MIN`) includes the 20 s dwell at intermediate stops but omits what the worker bills (`demand.worker.ts:209-219`): the per-stop buffer, the extra terminal dwell (2 × `DWELL_SEC`) and amortised refuel. Visual and billed cycle times disagree | Source read; `vitest-node.log:17` | (corrected) |
| M17 | V1's corridor congestion (road class, density and AADT, sampled about every 250 m in `MapView.tsx:480-530`) and ridership relief go only to presentation: bus animation speed (`busLayer3d.ts:383-389`), the traffic-forecast overlay and the TopBar readout. The worker sees only citywide `trafficFactor(h)` (`demand.worker.ts:251`), and its network message carries no corridor gain. Congestion never feeds ridership; `changelog.ts:91` says otherwise | Grep plus source read; worker `postMessage` payload at `store.ts:597-612` | (verified) |
| M18 | V2's quadratic subsidy taper moved the express profit argmax from exactly $5.00 to $2.75 (`f29aab5`). Under V3's own formulas, on a stylised marginal O-D pair, express revenue still peaks at $4.75–$5.00 ($2.465 at $2.25; $2.737 at $5.00; $3.177 at $5.00 with the ×0.85 bonus). V3's spec has no taper | `fare-check.mjs` re-run; `f29aab5` message; V2 `fare-balance.md:75-90` | (verified) |
| M19 | V3's per-boarding fare term turns its stylised line-split result from +38% (plain) / +69% (hub) into −22% / −9% (`demand-model.md` §3.1; DECISIONS #38, #49); `fare-check.mjs` reproduces 2041/2825/3441/1586/1867 per 1k trips given the spec's delta values. V1 charges only the deviation per leg (`demand.worker.ts:339-345`) and books revenue per boarding, so V1 had the exploit: measured on V1's real worker at $2.25, +8–28% (plain) and +29–62% (hub) | Review harnesses `fare-check.mjs` and `v1bench/split.mjs` | (verified) |
| M20 | V1's `makeBusMesh` builds 18–33 meshes per bus (minibus 18, citybus 26, double-decker 27, electric 28, artic 33) with 9–14 unique materials and 14–23 unique geometries, mostly fresh per bus. Nothing in `src/` uses `InstancedMesh`; `src/map` has no `.dispose()` (the only one in `src` is `StationScene.tsx:468`). `setNetwork` (`busLayer3d.ts:298`) removes and rebuilds every bus mesh, called from an effect on `[lines, stats, stops]` and a full-sync path | Re-built the review's node probe against HEAD; grep; source read | (verified) |
| M21 | No real-city pack can be verified from these repos or the review environment. V3 never baked a city (spec only; the app runs `generateRiverton`). V2's 143 kB was measured on generated graphs, and its converter turned a synthetic 7×7 km OSM into 2 districts; no real extract was converted. V1 did bake real-city packs: its deploy workflow (`deploy.yml:42-55`, `223f9a2`) built Worcester, Des Moines and Madison ("tens of MB", `4a47dc1`) and shipped them with an in-browser download fallback, but they are gitignored and the local bake fails without network | V1 `git ls-files`, `.gitignore`, `deploy.yml`, commit messages; V2 `city-packs.md:100-122`; `packplay.js` | (corrected) |
| M22 | V1 grew about 1,050–1,100 LOC of boot, update and recovery code (update.ts 197, about 200 in `index.html`, about 200 in `vite.config.ts`, retain-assets 73, UpdateBanner 49, plus 345 of general error UI) across about 7 layers. Of the 9 commits listed, 7 precede the SW `9ea15e5` (`3afd5f0`, `341a5e3`, `b0fc3f4`, `fe14a93`, `1624f3b`, `d66e6dc`, and the CI fix `6c3687c`); `9ea15e5` is the SW itself (with `skipWaiting` on install), and `81f334d` follows it. V3 uses `vite-plugin-pwa` with `registerType: 'prompt'`, no `clientsClaim`, `skipWaiting` only on a `SKIP_WAITING` message and a 2-reload session cap (`register.ts:10`); offline play re-verified by cutting the network | `git show` of all 9 hashes; `wc -l`; V3 `register.ts`, `vite.config.ts`; Playwright offline run | (corrected) |
| M23 | V3 gives every new line `BUSES_PER_NEW_LINE = 2` free buses (`App.tsx:60`, used at `:517`, `:544`); `priceUsd` is never read outside `constants.ts`; the only `spend()` in App is stop placement. Depots are charged ($150k first) but nothing renders them (`App.tsx:864-868`; no depot code in `src/render`). `DepotPanel.tsx` and `deadhead.ts` have no non-test importer | Grep and source read | (verified) |
| M24 | V2's `tools/a11y-browser.js` is 279,756 B. The browser gate adds about 32–34 s to every cache-missing build, against about 0.5 s without it. CI never ran it: `pages.yml` calls plain `build.js` without Playwright, and the single CI run logged "a11y browser: NOT RUN (Playwright is not installed)". The chip-row layout step was abandoned and reverted in the working tree (no revert commit) over 29 focus-ring violations at 2.91:1 against 3:1 | `ls -la`; `build.js:14-50`; `pages.yml`; CI job 93999889404; `git show 5e24bcb` | (verified) |
| M25 | V1's Electron shell (`electron/main.cjs`, 69 lines) serves `dist/` over a privileged `app://` scheme. It is built only locally, so `vite.config.ts:10` gives it a dev `BUILD_ID`, and `watchForUpdate` (`update.ts:47`) and `registerServiceWorker` (`:153`) return early; the scheme privileges omit `allowServiceWorkers`. Unsigned (`README.md:26`); CI builds only Pages with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`; `electron/` last touched Aug 3 | `wc -l`; `git log -- electron/`; source read | (verified) |

---

## Appendix: Verification log (2026-10-12)

Skeptics checked every load-bearing claim against primary sources. Of the 25 M-claims, 20 were confirmed and 5 were partly true (M01, M05, M16, M21, M22); none was refuted or left unverifiable. L-verdicts from the lessons ledger that touch this matrix are listed at the end.

| ID | Verdict | Where in this file | What changed |
|---|---|---|---|
| M01 | partly true | Row 18, K01, appendix | "3.6–5.0 km" / "3,606–5,031 m" became 2.8–5.0 km (2,818 / 3,606 / 5,031 m, geometry-dependent); added "not charged". |
| M02 | confirmed | Row 7, K02 | Tagged; added the v1.15 commit and the manual's stale promise. |
| M03 | confirmed | §0 item 2, row 3, K04, R01, cross-version patterns | Tagged. Attributed the whole drop to the 4-stop cap (`LINES_LIMIT` had no effect in the bench); added the superset figures and the artificial-network caveat. |
| M04 | confirmed | Row 9, K23 | Tagged; added the alightings and the cap-10 causation result. |
| M05 | partly true | Row 17, K22, appendix | $760 → $733 in an exact 32 h replay (39,266.67 → 135,000; correct 134,266.67); added the wear reset; line refs → `60-main.js:612-662`. |
| M06 | confirmed | Row 4, K40 | Tagged; `App.tsx:529-531` → `:530`; the stop refund is the only inflow. |
| M07 | confirmed | Row 15, K41 | Tagged; added `App.tsx:844` and the saved 76.5 min. |
| M08 | confirmed | Rows 22–23 | Tagged; added the 5.7 kB workbox-window chunk. |
| M09 | confirmed | Rows 2, 22, 23, D0 | "6.3–11.8 s" became "about 11–12 s wall (vite 5.5–6.5 s)"; test time 0.18 → 0.19 s; worker chunk noted. |
| M10 | confirmed | Rows 22–23, D0 | Build "0.43 s / 33.9–38 s" → "about 0.4–0.5 s / 33–38 s"; gzip is 388,736 B (379.6 KiB); rebuild byte-identical. |
| M11 | confirmed | Row 14, D0, D4 | Tagged as documented (author-measured, not re-measured); added the second SwiftShader long task (113–119 ms). |
| M12 | confirmed | Rows 13, 15, D2 | Tagged. The "more like" quote now cites `980759d`, not `c1d73de` (from L09). |
| M13 | confirmed | Row 1, K24 | Tagged; "intersections" → "street nodes"; added pseudo-zone coverage and that hour gating is ruled out. |
| M14 | confirmed | Rows 3, 8, K25, D0, D1 | V2 warm 65–90 → 65–100 ms; edit 148 → 137–148 ms; assistant → 1.70–1.77 s; "3–6× over budget" → "about 2.6–6×". |
| M15 | confirmed | Row 18, S02 | "8-step load (NONE / UNREADABLE / NEWER / WRONG_CITY)" → the real outcome list; noted the unpersisted bus counter and added it to S02's changes. |
| M16 | partly true | Row 12, K07, appendix | The visual cycle includes intermediate dwell; it omits the buffer, the extra terminal dwell and refuel. |
| M17 | confirmed | Row 10, K06 | Tagged; `MapView.tsx:505` → `:480-530`; added the `changelog.ts:91` drift. |
| M18 | confirmed | Row 5, K49 | Tagged; the V2 taper is no longer [C]; noted the stylised-pair, revenue-only caveat. |
| M19 | confirmed | Row 5, K05 | Tagged. V1's split exploit now uses V1's measured +8–28% / +29–62%; +38% / +69% is labelled as V3 spec arithmetic (from L16). |
| M20 | confirmed | Row 14, K09 | Tagged; added the per-model counts and the `setNetwork` call sites. |
| M21 | partly true | Row 2 (V1 re-graded "D delivery" → "C delivery"), A.1 row 2, D3, appendix | "No version measured a real-city pack / packs never verified" became: V1's CI baked and shipped Worcester, Des Moines and Madison, but they are gitignored and cannot be re-measured here. |
| M22 | partly true | §0 item 7, A.1 row 19, row 19, B6, appendix | "Seven layers … 9 stale-page commits … about 1,100 LOC" became: six layer commits plus the CI fix before the SW, `9ea15e5` is the SW, `81f334d` after; about 1,050–1,190 LOC including 345 of error UI. V3's exact PWA settings added; offline re-verified. |
| M23 | confirmed | Rows 6–7, K42, K43 | Tagged. |
| M24 | confirmed | Row 21, K38, B6 | "33.9 s" → "about 32–34 s"; added the CI "NOT RUN" log line and the working-tree revert. |
| M25 | confirmed | Row 20, K15 | Tagged; added the `BUILD_ID` mechanism and the missing `allowServiceWorkers`. |
| L01 | confirmed | Conventions (V1 row) | Added 71 commits, 70 by Claude. |
| L07 | confirmed | Conventions (V2 row) | "16–17 commits behind" → 16 behind, 0 ahead; `8c01a18` is the only Pages deploy; listed what it lacks. |
| L09 | partly true | Rows 13, D2 | Quote attribution moved to `980759d`; "map does not read as a city" marked as Claude's wording. |
| L13 | confirmed | Row 4 | +461% labelled as the crew's figure; +149% re-measured on the review harness's single line. |
| L16 | partly true | Rows 3, 5, K05 | As M19. |
| L18 | confirmed | Conventions (V3 row) | Added the 8-commit side branch and the squash size. |
