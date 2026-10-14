# Status

The running handoff between Claude sessions. Every session reads it right after `CLAUDE.md`, and every pull request that merges updates it, so a new session or a fresh context window starts from here and loses nothing ([PR-06](history/lessons-ledger.md)). The plan is [PLAN.md](../PLAN.md); decisions are in [DECISIONS.md](DECISIONS.md).

**Updated:** 2026-10-14, at `main` 655b914, with `main` now protected (D24), V1's site confirmed for P0, the owner's answers to D20 (rest), D21 and D22 recorded, and the model contract rewritten to lead with what to make, when and how: in M5 everything that needs no one else is in: the spec, the save list, Home, the GPU ladder, the pacing run, I14 with events, the 2D/3D chip, D2's guard, the slow-laptop run's busy scene, I14's first frame, the heap budget and the frame-rate steps in the playtest protocol. What remains waits on the owner (the Nov 8 token pick, P1's notes Nov 16–22, the medal ladder by Nov 22, P2 Dec 12–13) or the artist's first file; see Waiting on the owner.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` 655b914 (832b67d's `?fps` readout, which names its camera, and CI in two jobs; then D24, `main` protected, V1's site confirmed and the D20–D22 answers, all docs). Deploy preview run 38511536759's live check found that SHA on the build chip and in `version.json`, with the map ready and filling the window and Home up. What it shows:
  - Boston with no transit on the map, flat or tilted with `T`, the 2D/3D chip or a right-drag (snapping flat below 12°, the buildings cross-fading), four buildings in five at their measured height; Low graphics (flat, 30 frames a second) where the map draws in software, a card asking for hardware acceleration where there is none, and `?fps` for the frame rate;
  - all of Inner Boston to play on (Boston, Cambridge, Somerville and Brookline), with the dots of its homes and jobs;
  - "people within a walk" at the pointer;
  - Home, the first screen: Continue, New game and Saves over the paused map, and Back to Home in Saves;
  - the founding card, and the checklist chip naming the next step;
  - the calm shell: a chip row, a dock with **Place a depot**, **Draw a line** and **Lines**, the line inspector with its headways and a day's forecast, and notices in one corner;
  - a bus model per line, Sparrow or Metro 40, picked on the new-line card and swapped on the line card, each drawn at its own length;
  - V2's waits: riders leave a line that comes once an hour;
  - full buses turning riders away half-hour by half-hour, and "Full at 17:00" on the line card when they do;
  - riders at a stop taking the first bus of the lines worth waiting for, so every line through a hub carries its share;
  - riders changing line once, at a shared stop or within 250 m, paying one fare a trip to the first line, and each stop's card saying how many change there;
  - a fare per line from $1.00 to $5.00 on the line card, with the band of fares that net the most;
  - each stop's day on a click (boardings, alightings, net), and QUIET or LOSS stops ringed on the map;
  - stop tiers from a Sign to a Transfer Hub on the stop card, and each line's button there to take the stop off it;
  - a line extended from either end, or a stop inserted into it where the player clicks, from Lines, priced on the draft card;
  - express lines: a line of 5 km or more with its stops 1,200 m apart on average, its riders minding its ride and its fare less, marked Express on the line and draft cards;
  - Finance in the dock: every row by kind for today, yesterday and the quarter, beside a day's forecast;
  - undo while paused, on a chip and Ctrl+Z;
  - a save from another bake of the map carried onto it;
  - Saves in the dock: three slots beside the autosave, each naming its buses and when it was saved and deleted after a question, a save set aside by a new build listed until exported or deleted, and a game exported and imported as a file;
  - a report card on each quarter's last day card, paying a grant or a fine;
  - medals: bronze for a quarter of 55, silver at 25,000 trips carried, which puts the Goliath on sale, and gold, named on the day card, as dots on the Contracts chip and listed in the Contracts panel with the trips left to silver;
  - a credit line to -$150k with daily interest, a countdown chip below it, and Restart this quarter when the lender calls in the loan;
  - a line changed with its buses out finishing every trip under way as it began, no bus jumping;
  - roadworks, snow and festivals rolled a day ahead, hatched on the map and named on the day card the evening before, solid while on, and the line card's round trip with what roadworks or snow add;
  - I3's full sweep over every fare, headway, model and tier, run nightly;
  - HEADWAY and RIDERSHIP contracts at landmarks, dealt from one deck of six, taken from the checklist's last step or the Contracts chip, with rings on the map, paid as a Contracts row, an untaken offer withdrawn after 10 days;
  - Export session in Saves, a file that replays to the same game for a bug report;
  - buses pulling out, running the line's day plan and driving home, drawn by the vehicle layer;
  - a day card at midnight listing fares, subsidy, running, wages, deadhead and upkeep;
  - the game saved in the browser as it plays, so a reload carries on where it was.
- **Retention:** every redeploy keeps the previous two builds' files on the real site.
- **Repo settings:** `main` is the default branch, and Pages builds from GitHub Actions. The `github-pages` environment allows one Branch rule, `main`.
- **How code reaches `main` (D23):** Claude opens a pull request from `claude/kind-ride-1zb3tn` and merges it with a merge commit once its checks are green. After a merge the branch fast-forwards to `main`, and the next change is a new pull request.
- **Data:**
  - release `city-boston-sim-mini-boston-72e7f8b9` holds mini-Boston's `sim.json` with depot land, the (empty) gateway list, three landmarks and Boston's fitted β (135,571 B), published by **City sim file (manual)** run 38396152811, which matched the golden on GitHub's runner. The older `da5ebb4b`, `69866a1e`, `20b38b02`, `7efc98ec` and `ba4110d6` stay for pages of older builds;
  - release `city-boston-tiles-20261012-a35f1831` holds Boston's map file with every transit feature stripped (15,347,095 B), published by **City tiles (manual)** run 38359580324 from the extract `57ac68da` (D17, G10). The older `57ac68da` stays for pages of older builds;
  - release `city-boston-sources-20261012` holds the bake's eight pinned inputs; Inner Boston bakes from them to the golden `52de265c` (six landmarks, its fitted β and 279‰) in `cities/boston/sim-inner-boston.lock.json`;
  - release `city-boston-sim-inner-boston-52de265c` holds Inner Boston's `sim.json` (2,033,685 B), published by **City sim file (manual)** run 38398135368, which matched the golden on GitHub's runner; `cities/index.json` names it as the city's `sim` and mini-Boston as its `fixture`;
  - mini-Boston is committed under `tools/bake/fixtures/mini-boston/`, and G4 is exact (Boston 675,647).

## Waiting on the owner

- [x] Protect `main` (PLAN §14 item 2; done 2026-10-14, DECISIONS D24):
  - pull requests only;
  - "Versions only via /ship" required;
  - merge commits only;
  - a `v*` tag ruleset blocking update and deletion.
- [x] Say whether V1's site still loads. It does (the owner, 2026-10-14), so P0 plays V1 there and nothing needs hosting on the preview (PLAN §14 item 6).
- [ ] **P0, by Fri Oct 17:** the owner and the artist play V1 for 30 minutes each. Notes go in `docs/playtests/2026-10-17-p0-v1-baseline.md`.
- [ ] **The artist, by Sun Oct 18:** read `docs/art/MODELS.md` §1 and §2 and answer §1's questions, including which Windows version the artist's PC runs (D21 (b)); commit `art/LICENSE.md` naming Miticept Studios and CC BY 4.0 with the credit "Miticept Studios" (D20), which records the artist's agreement.
- [x] **D20 (rest), D21 and D22** (the owner, 2026-10-14; DECISIONS): the art under CC BY 4.0, credit "Miticept Studios"; the repo private on Sun Mar 14 2027, a week before the store page is public; the Steamworks and Apple accounts yours as an individual trading as Miticept Studios, with no company, and the Mac version sold only on Steam; the artist's PC for the Windows builds; the full release Tue Jun 29 2027. Still open: D20 (preview) and the GitHub plan, by Sun Feb 21 2027.
- [x] **Week 2 check:** "Does this look like Boston?" (PLAN §14 item 14). Yes: "it definitely looks like Boston" (the owner, 2026-10-14; [notes](playtests/2026-10-14-owner-first-look.md)).
- [ ] **I2 and a stop's dwell, by Sun Oct 25** (DECISIONS, Open): hold I2's 0.1% for a stop with the dwell at zero and bound the dwell at 1% of trips (recommended), or make buses skip unused stops.
- [ ] **M2's exit check, on the preview** ([`docs/specs/m2-first-line.md`](specs/m2-first-line.md)): found, a depot, four stops from Copley to Longwood, every 20 minutes, overnight off, and cash moves as the inspector said. Compare the costs on **day 2's** card: day 1 opens at 05:00, after the first bus left the depot, so its wages and deadhead fall a little short of a whole day's forecast.
- [ ] **M3's exit check, on the preview** ([`m3-money-loop.md`](specs/m3-money-loop.md)): the checklist to a profitable day and a contract in about 8 minutes; the report card; overspending to the countdown and Restart this quarter.
- [ ] **M4's exit check, on the preview** ([`m4-goals.md`](specs/m4-goals.md)): a contract near Copley met with a second line; roadworks hatched a day ahead; a stop inserted with no bus jumping; bronze as a dot on the Contracts chip.
- [ ] **Sun Nov 8, the light token pick** (PLAN §8): the starting light tokens or pure V1 paper, side by side on Boston. The light style pass (M5, item 8) waits for it.
- [ ] **P1, Nov 16–22:** the owner and the artist play the preview; notes in `docs/playtests/`. The tuning freeze (M5, item 2) waits for them.
- [ ] **The medal ladder, by Sun Nov 22** (DECISIONS, Open), now with the pacing run's numbers: on Inner Boston the scripted company gets bronze on day 10 and silver on day 29 but no gold in 200 days, coverage reaching 43.5 with seven lines against gold's 60. Recommended: keep bronze and silver as they are, and let week 9's tuning set gold's floor.
- [ ] **M5's exit check 4, your Mac's fps:** open the preview with `?fps` in stable Chrome, play at 2× flat and tilted, and note the readout in P2's notes. The steps are in [`playtests/PROTOCOL.md`](playtests/PROTOCOL.md), Frame rates; the readout now names its zoom and tilt.

## In progress: the owner's initial playtest (D25, 2026-10-14)

The owner played the preview and asked for 18 changes ([notes](playtests/2026-10-14-owner-first-look.md), DECISIONS D25), then cleared work to move on in the schedule. Each is a small pull request, in this order:
1. [ ] **Pathing** (this PR): stops and depots never stand on a motorway or a ramp, and buses drive one-way streets both ways. In Back Bay, click pairs 250–600 m apart driven over twice the straight line fell from 30.1% to 1.4% (worst 41.3× to 2.4×); downtown from 28.8% to 1.6% (worst 20.4× to 2.2×). `npm run bench routes`; DECISIONS, Measured.
2. [ ] **Time:** minutes and days; 8-day quarters, 4 a year; 1× real time, then 60×, 600×, 1,800× and 5,400×; a 1-second step; saves set aside once.
3. [ ] **Map:** the demand dots toggled by kind from a custom menu; the population count only over a dot; the contract rings gone; sentence case and grammar everywhere.
4. [ ] **Finance:** charts, where the money goes, each line's money moved here, "Day 0".
5. [ ] **Building:** a Build tab (Place stop, Draw line, Place depot); an info-only line panel; Edit route to reorder, add and remove stops.
6. [ ] **Panels and controls:** movable panels, several open at once; Saves at the top; custom dropdowns.
7. [ ] **3D:** double-click and hold to switch and tilt; rotation, with a compass back to north; the 2D | 3D chip retired.
8. [ ] **Then the schedule** (the clearance): the tuning freeze from the pacing run, ahead of P1.

## Done: week 2 (PLAN §14 items 10–13), finished 2026-10-13

The exit check: `T` tilts and returns; dots sit where Back Bay to Longwood lives and works; "people within a walk"; does it look like Boston (the owner's check, above)?

- **Item 10, ports.** Each was shown failing on its old bug:
  - the sim core in `src/sim/{config,core,rules,economy}`:
    - ids;
    - `{ok, reason}`;
    - V2's RNG;
    - V3's calendar from 05:00;
    - D7's periods;
    - the cent ledger as rows (I1);
  - saves in `src/sim/save`: one schema for type, reader and hash; every counter saved; I7 and I8;
  - V2's graph and half-edge A* (K13), and V1's geo frame;
  - V3's error bus in `src/ui/errors`.
- **Item 11, the city on the fixture:**
  - `tools/bake/{streets,cells,sim}.mjs` bake mini-Boston's `sim.json`: bus access, Boston's grid, G1–G3 per extent, a golden hash;
  - **City sim file (manual)** publishes it;
  - `src/sim/city/simfile.ts` loads it;
  - `src/worker` runs it;
  - on the page: the dots, the probe, the debug line, the day card (`e2e/sim.spec.ts`);
  - the height-tag count: 14.1%, so Overture's heights join r1 in week 5;
  - the smoke test runs axe-core.
- **The fare-row signal** (due Oct 25) went green on Oct 13, in `src/sim/fare-row.test.ts`.
- **Item 12:** raw tilt and the board mask.
- **Item 13:** the M1 spec, now archived in [`docs/specs/m1-first-dollar.md`](specs/m1-first-dollar.md).

## Done: M1, the first dollar on the fixture, finished 2026-10-13

The spec is archived in [`docs/specs/m1-first-dollar.md`](specs/m1-first-dollar.md). Demand, income rows, the daily close, the debug line and its layers landed in week 2's work; then, in order:
1. [x] **`tripScale`** is 111‰ (2026-10-13), in `city.json` calib. The debug line carries 799.3 boardings a day and `calibration.test.ts` holds the 600–1,000 band. The fixture's `sim.json` was rebaked, re-locked and republished.
2. [x] **I2** and **I3 per period** (2026-10-13, `src/sim/demand/invariants.test.ts`). The bus clause of I2 waits for week 4's buses.
3. [x] **The recompute bench** (2026-10-13, `bench/`, `npm run bench`): 52 ms p50 and 65–78 ms p95 for three periods on a synthetic 812-cell grid with T03, under I14's 150 ms and R2's 100 ms. It was 13 s before trips were timed per group of sub-points reaching the same stops. `npm run bench compare` holds the result within 1.5% of the old loop per line and period, except where lines overlap (DECISIONS, Measured). Boston's own number comes from the Inner Boston bake, on Nov 1.
4. [x] **Bus access** (2026-10-13): `hgv=no` restricts trucks, not buses, and no longer closes a street; DCR's River Roads close by name in `adjust.json`; G2 measures connectivity off motorways. A trial bake of Inner Boston found the old rule closed 353 ways, Summer Street and Columbia Road among them (DECISIONS, Measured).
5. [x] **The Inner Boston bake** (2026-10-13; `node tools/bake/sim.mjs boston inner-boston`, the **City sim file** workflow with extent `inner-boston`): 735 cells, 11,687 nodes, G1–G4 pass, golden `8b87dfc2`. Its recompute is **44.6 ms p95** with ten lines along real corridors, under R2's 100 ms (D11) for the Nov 1 check. The game still plays on the fixture; gateways and Inner Boston's `calib` come later (DECISIONS, Measured).

Per-period crowding (K27) and visitors, the last two items below M1's cut line, move to week 5: crowding with the Metro 40 and Goliath rows, visitors with M2's gateways. M1's dated checks (capacity, R2, velocity) still fall on Sun Nov 1.

## Done: M2, the first line, finished 2026-10-13

The spec is archived in [`docs/specs/m2-first-line.md`](specs/m2-first-line.md). Its Sun Nov 8 dates (the format freeze, the light token pick) carry over to M3's spec. In order, each a small pull request:
1. [x] **The cycle function** (2026-10-13, `src/sim/rules/cycle.ts`): a round trip, the buses each running period needs, the headway a short line runs, and the founding recipe counted with it (two Sparrows; $427,200 at k = 1.2; D7's clarification). The Sparrow is a config row in `src/sim/config/fleet.ts`.
2. [x] **Depots in the sim** (2026-10-13): the siting rule (`src/sim/rules/depot.ts`: depot land, a street node within 400 m, 120 m from other depots, five at most), the place command, V1's price ladder ($150k to $760k), save format 3, and the worker's `depot-site` and `place-depot` messages with depot land for the tint. Upkeep is a config row charged with the costs (step 3); the card and tint draw with the line tool (step 5).
3. [x] **Costs as ledger rows** (2026-10-13): the timetable (`src/sim/rules/timetable.ts`), running, wages and deadhead per line and upkeep per depot, banked hourly from `src/sim/economy/costs.ts`, and the forecast the line inspector will show, equal to the day's rows to the cent on a part day and a whole one. On day 2 the debug line nets +$1,388.93 (DECISIONS, Measured). A closed day's rows merge into one per kind and line, so a save grows about 354 B a day instead of about 5 KB. The panel's Costs/day chip reads the forecast until the calm shell's inspector (step 7). Save format 4 holds each line's buses.
4. [x] **Depot land and gateways in `sim.json` format 1**, then G5–G10 on both extents, before the Nov 8 freeze. Depot land, gateways and G5–G7 are done (2026-10-13; DECISIONS, Measured).
   - **G9** (2026-10-13, `bench/load.ts`): Inner Boston first-loads in 130 ms on GitHub's runner. The City sim file workflow runs it before publishing.
   - **G10** is written for both files:
     - `sim.json`: neither clip lets a transit element through (789 and 6,286 in the clips);
     - the map file: `tools/bake/tiles.mjs` strips 9,785 transit features and opens 116 busway pieces, and the City tiles workflow runs it before publishing.
   - **The stripped map file ships** (2026-10-13): `boston-20261012-a35f1831.pmtiles`, which a script test checks on every PR. G1–G10 now pass on both extents.
5. [x] **The line tool and headways to purchase:** stops, the 250 m join, the draft card, Create, the "needs N buses" card.
   - [x] **In the sim** (2026-10-13):
     - the stop rule (`src/sim/rules/stop.ts`: the nearest street node within 150 m, or a stop within 250 m joined);
     - the draft and headway rules (`src/sim/rules/line.ts`: a depot first, two stops, each once, joined by streets, D7's headways, depot room, cash);
     - `createLine` and `setHeadways`, each paying one Purchases row;
     - the worker's `line-draft`, `create-line` and `set-headways` messages.

     On the fixture, Copley to Longwood drafts as four new stops and two Sparrows: $206,000, leaving $71,200 after the depot. A third Sparrow every 10 minutes at peak is refused as $23,800 short.
   - [x] **On screen** (2026-10-13):
     - **Place a depot** tints depot land green, and the card beside the pointer reads the rule ("Industrial ✓ · street 65 m ✓ · $150k").
     - **Draw a line** places stops on click (Backspace undoes, Esc cancels) and draws the draft dashed, with each stop's walk ring. Its card reads "4 stops · 3.7 km · ≈52,000 people within a walk · every 20 min needs 2 Sparrows · $190k · 4 new stops · $16k · Total $206k", then Create.
     - **Each line's card** has its headways. A shorter one reads "needs 3 buses, you have 2", or "$23,800 short" with the starter's cash.
     - **Refusals** read as words (`src/ui/copy.ts`).
     - **The debug line's button and worker message are cut.** Its sim function stays as the tests' fixture line.
     - **`e2e/line.spec.ts`** plays steps 2–5 of the exit check in the browser: depot, Copley to Longwood, Create, and a day whose cost rows meet the forecast.
   - **Snapped stops.** Copley to Longwood drawn with the tool snaps its stops to street nodes, so it reads 3.7 km and ≈750 riders a day, against the debug line's 3,535 m and 795.
6. [x] **The vehicle layer:** `busPositionAt`, the code-drawn glyph, I12.
   - [x] **One day plan per line** (2026-10-13, `src/sim/rules/schedule.ts`):
     - departures every running headway, each period's own, on one clock through the day;
     - each departure's round trip of exactly one cycle;
     - each bus's stint from the depot and home again: a bus waits at the first stop unless its next departure is over an hour off.

     The costs bill the plan's movements hour by hour, and `busPositionsAt` (`src/sim/rules/position.ts`) places every bus from it, so a bus is billed for what it does (I6).
   - [x] **The debug line's whole day** under the plan: running $362.52 (57 departures out and back), wages $972.11, deadhead $15.00, upkeep $300, net +$1,411.12 (DECISIONS, Measured).
   - [x] **The vehicle layer** (2026-10-13, `src/render/map/vehicles.ts`, `fleet.ts`):
     - one MapLibre custom layer draws every bus in one instanced call;
     - the glyph is code-drawn: a rounded body in the line's colour inside a dark outline, with a pale windscreen at the front, 20 × 9 px, laid out in screen pixels along its heading, so tilting never shrinks it;
     - positions come from `busPositionsAt` on the plan the costs bill, with the clock run on between snapshots;
     - the layer asks for frames only while time runs. `e2e/line.spec.ts` checks buses are drawn at 1× and that no frame is drawn in a paused second.
   - [x] **I12** (2026-10-13, `e2e/i12.spec.ts`, `e2e/i12/`):
     - the game's own layer on a bare map, served by Vite's dev server inside the test, with 50 Sparrows heading away from the camera at 1366×768;
     - each bus is measured from the pixels drawn, along its own long axis;
     - shortest 21 px at 2D zoom 14, 21.5 px at the `T` default and 21.6 px at zoom 17 / 60°, against 20;
     - a 4 px glyph fails the same check.

     The harness also caught the first glyph at 18 px: its white outline barely differed from the light land, so only the body read (DECISIONS, Measured).
7. [x] **The calm shell** replacing the debug panel, and I13.
   - [x] **Founding and the checklist** (2026-10-13):
     - a new game opens unnamed, and the founding card names and colours the company (`src/sim/rules/company.ts`, one rule for the card and the `found` command);
     - the speed and tools stay hidden until then;
     - the checklist chip reads "1/5 Place a depot", "2/5 Draw a line", "3/5 Press play", "4/5 Close a day in profit" (a closed day whose running rows come out ahead, `profitableDays`), then "5/5 Take a contract" for M3.
     - `e2e/line.spec.ts` walks all five.
   - [x] **The shell** (2026-10-13, `src/ui/shell/`), replacing M1's debug panel:
     - the chip row top-left: day and clock, speed, Cash, Riders/day, Costs/day and the checklist;
     - the dock bottom-centre, three slots of eight: Place a depot, Draw a line, Lines;
     - the line inspector on the right, opened by Lines, by clicking a line on the map, or by creating one: the line's card and headways, tabs when there are several, and a whole day's forecast (fares and subsidy "≈", running, wages and deadhead to the cent, and the line's net);
     - notices bottom-left: a refusal in words for six seconds, which replaces the draft and line cards' own refusal text.
   - [x] **I13** (2026-10-13, `e2e/i13.spec.ts`): at 1440×900, 1366×768 and 1152×720 the shell covers 2.5–3.9% of the screen at rest and 6.7–14.0% with its largest panel, against 6% and 26%; a 400 × 200 panel more breaks the at-rest budget (DECISIONS, Measured).
8. [x] **The exit check as e2e, with saves** (2026-10-13):
   - **Saves on the web.** The worker asks the page for its save by key before it starts (`read-save`), and the page reads it from `src/platform`'s store. A readable save carries on; any other is set aside under a backup key first, a new game starts, and a one-line notice says so (D12): "Save from an older build set aside". A save from another bake of the city is set aside too, since the game would otherwise overwrite it.
   - **When it saves.** The worker hands the page a fresh save after every command, at every change of speed and every game hour. The page writes them one at a time, in order. A change of speed drops the part-step of game time, as a save does, so a reloaded game runs on in step: `host.test.ts` failed by one 30 s step without it.
   - **A reload** opens on the saved game: no founding card, and the inspector stays shut, because only lines created after the game starts count as new.
   - **`e2e/line.spec.ts`** plays the whole exit check: found, depot, Copley to Longwood, Create, buses at 1×, a day whose rows add up to the change in cash, then pause, reload and compare the clock, cash, checklist and line. With saves switched off it fails at the reload, with elapsed 0 against 72,240. `e2e/save.spec.ts` sets an older save aside in the browser.
9. [x] **The last of M2's tests** (2026-10-13; DECISIONS, Measured):
   - **I2's bus clause:** adding a bus never cuts linked trips by more than 0.1%, alone or beside a line on the same streets (`invariants.test.ts`).
   - **I3's strategies:** all 245 allowed headway settings for the debug line (`npm run bench strategies`). "Daytime longest, overnight shortest" earns less than the best (15, 60, off: $2,354.45 a day), a night-only line cannot be set, and a line off overnight carries nobody then (`strategies.test.ts`).
   - **Not yet held: PLAN's starving clause** (60% of the optimum or less). Hourly all day on one bus earns 98.5% of the best, so for week 5: per-period crowding (K27) and the fare band should make starving cost, then the sweep re-runs.

## M3, the money loop, by Sun Nov 29 (weeks 5–7): done but week 5's presentation items

The spec is [`docs/specs/current.md`](specs/current.md). The calendar puts M3 in Nov 9–29; work starts now, money first. In this order, each a small pull request (items are the spec's):
1. [x] **Landmarks in `sim.json`** (item 1; 2026-10-13): six in `cities/boston/city.json`, each the label the map file draws. They are Copley Square, Longwood, Kenmore, Kendall Square, Harvard Square and Downtown Crossing. The fixture holds the first three; G6 fails a bake on any outside the extent; the loader reads them strictly.
2. [x] **Three bus models, one per line** (item 2), and **crowding per period** (item 3), with the sweep re-run: a starved line should earn 60% of the best or less.
   - [x] **The models** (2026-10-13):
     - the Metro 40 and Goliath rows, with the Goliath locked until a medal (M4);
     - a model on each line (save format 5), so its cycle, speed, costs and demand are that row's;
     - the new-line card picks the model;
     - the line card swaps it, selling the old buses at half price as a Sales row (`checkModelChange`, `setModel`);
     - each family drawn at its own length, I12 passing for all three (DECISIONS, Measured).

     The starter cannot afford Metro 40s: the debug line's two cost $520k against $71,200 left after the starter.
   - [x] **V2's waits** (EC-08's verdict; 2026-10-13): riders time the stop only at a headway they can plan around, and a long wait counts convexly. A starved line (hourly, one bus) now loses $72.10 a day against the best's +$1,905.82 (it earned 98.5% of the best), and both daytime optima are inside the range. The debug line carries 636.3 riders and nets +$798.97 on day 2 (DECISIONS, Measured). I2's stop clause is now held with the dwell at zero, and the owner's call is under DECISIONS, Open.
   - [x] **Crowding** (K27; 2026-10-13): each half-hour, riders past the seats on a line's busiest leg are turned away in that half-hour only, and the line card reads "Full at 17:00 · ≈2,400 riders a day turned away". On Inner Boston's ten corridor lines only Washington Street fills: on Sparrows every 10 minutes it turns away 2,377.8 of 7,508 riders a day, on Metro 40s 131.4. The fixture's debug line never fills, so its sweep is unchanged (DECISIONS, Measured).
3. [x] **The fare band** (item 4; 2026-10-13): a fare per line from $1.00 to $5.00, felt against the ride's length, the subsidy tapering to nothing at $5.00, and the line card's band of fares within 5% of the best net. The debug line does best at $1.75 on the starter's headways (band $1.75–$2.00), inside the spec's $1.75–$3.25, which `strategies.test.ts` holds as I3's fare clause. Riders turned out very fare-sensitive, which week 9's tuning should look at (DECISIONS, Measured). I4 waits for transfers (item 13).
4. [x] **Stop tiers, QUIET and LOSS** (item 5), and **Finance** (item 6).
   - [x] **Each stop's day** (2026-10-13): boardings, alightings and net, V2's apportionment, flagged QUIET under 5 boardings or LOSS under −$20 with a ring and a word on the map; a click on a stop opens its card. A starved debug line flags Longwood QUIET and Symphony LOSS (DECISIONS, Measured).
   - [x] **Stop tiers** (2026-10-13): Sign to Transfer Hub on the stop card, V1's prices and walk bonus, Interchange and Hub only where 3 or 5 lines call, half back as a Sales row on the way down; saves are format 6. A Shelter at Symphony adds 32.4 riders a day on the debug line (DECISIONS, Measured).
   - [x] **Finance** (2026-10-13): a dock button opens every ledger row by kind for today, yesterday and this quarter, beside a day's forecast, capital included, so each column adds up to the change in cash (DECISIONS, Measured).
5. [x] **Undo while paused** (item 7, I9; 2026-10-13): every command since the last unpause, newest first and named on a chip and Ctrl+Z, back to the cent; refused with a reason once time has run (DECISIONS, Measured).
6. [x] **Saves for r1** (item 8): stops by place and the r1→r2 save test, the missing-pack refusal, slots, export and import.
   - [x] **Another bake of the map** (2026-10-13): a save from another bake carries on with its stops on the new streets, or is set aside in words when a stop finds none; a missing city file is already the replaced-build card (DECISIONS, Measured).
   - [x] **Slots, export and import** (2026-10-13): a Saves panel in the dock with the autosave and three slots, export and import of a save file through `src/platform`; a file the game cannot read is refused and the game and its autosave kept. The shell at rest is now up to 5.5% of I13's 6%, so no sixth dock button (DECISIONS, Measured).
7. [x] **`city-boston-r1`** by Sun Nov 15: β fit, `tripScale` re-measured, starting cash derived, Overture heights; the preview plays Inner Boston.
   - [x] **β fitted to LODES** (2026-10-13): 3,260 m on Inner Boston (V1's 4 km), the fixture taking the same; `sim.json` carries `calib.gravityBetaM`. The debug line carries 614.4 riders a day, inside the band, so the fixture keeps 111‰ (DECISIONS, Measured).
   - [x] **Inner Boston's `tripScale` and the starting cash** (2026-10-13): 279‰, so the debug line carries 613.9 there as on the fixture; 16 of 19 starters along T03's corridors fit the founding capital and four pay on day 2, the best Washington Street at +$2,267; at calibrated demand almost no one is turned away (DECISIONS, Measured).
   - [x] **The preview plays Inner Boston** (2026-10-13): `cities/index.json` names Inner Boston's `sim.json` and the fixture beside it; `npm run build` and the deploy play Inner Boston, and CI smoke-tests that build before running every e2e test on `npm run build:fixture` (DECISIONS, Measured).
   - [x] **Overture heights in the map file** (look work, PLAN §10's week 5; 2026-10-13): `tools/bake/overture.py` and `tiles.mjs heights`, run by the dispatch-only City heights workflow, give each footprint OSM leaves without a height the tallest Overture height inside it, at every zoom. 82.1% of footprints now stand at a measured height, from 9.3%; tilted at zoom 15 over Back Bay, 5,637 of 5,825 buildings in view, from 2,536 of 5,819, and the tilt e2e holds it at 90% or more. `cities/index.json` names `boston-20261012-d7e64e4c`, and the corner credits Overture Maps (DECISIONS, Measured).
8. [x] **The report card** (item 9, done before step 7 because r1's bake work is not needed for it; 2026-10-13): Coverage, Reliability, Comfort and Money on the quarter's last day card, paid or fined as a Report card row. Ten seeded opening companies grade 53.7–63.8 (median 57.9), so V1's bars stay at 55 and 35; the card pays the debug line 3.9 times its quarter's net, for week 9 (DECISIONS, Measured).
9. [x] **The failure floor** (item 10, also before step 7; 2026-10-13): cash may go to −$150k on a credit line, at 0.06% a day as an Interest row; a countdown chip from the first close below it, and on the fifth the run ends with **Restart this quarter**, from a save the game writes by itself at each quarter's start (save format 8; DECISIONS, Measured).
10. [x] **HEADWAY contracts** (item 11, I11), checklist step 5 and **Export session** (item 12).
    - [x] **Contracts and the checklist's last step** (2026-10-13): three offers at landmarks, a bus every 10, 15 or 20 minutes for $240k, $150k or $60k, met at the best stop within a walk at the slower of peak and off-peak, paid after 10 days in a row within 20 as a Contracts row (save format 9). Asks come from a shuffled deck, so 100 seeds earn $1.11M–$1.29M over 40 days (I11). "5/5 Take a contract" opens them and gives way to a Contracts chip; rings on the map (DECISIONS, Measured).
    - [x] **Export session** (2026-10-13): in Saves, the session's save, its speed and every command since; the same host replays it to the same game fingerprint, a Chromium session in Node included, and `npm run bench replay <file>` replays a player's (DECISIONS, Measured).
11. [x] **Transfers** (item 13, I5) and **route remove and extend** (item 14).
    - [x] **Riders scan every line at a stop** (I5; 2026-10-13): of the lines serving a trip, they take the first bus among those worth waiting for, split by frequency, at the combined headway's wait; six lines along the same stops carry a sixth each, where the first took them all (DECISIONS, Measured).
    - [x] **One change of line, paid once a trip** (I4; 2026-10-13): at a shared stop or within 250 m, for the walk, the boarding stop's tier's penalty and the second wait, never onto a line the home can walk to nor off one that reaches work; fare and subsidy felt and paid once, on the first line. Splitting a line now loses 4.8% to 40.6% where charging each boarding gained up to +22.7%; Copley–Kenmore and Kenmore–Longwood carry 52.6 changes a day at Kenmore, on its stop card (exit check 5); Inner Boston's recompute is 81–96 ms p50 (DECISIONS, Measured).
    - [x] **Remove a stop** (item 14; 2026-10-13): the stop card takes it off each line, a line keeping two; a stop no other line calls at comes down for half of what it and its fittings cost, as a Refunds row, and the undo chip puts it back. Symphony off the debug line leaves 311.8 trips a day of 614.4 (DECISIONS, Measured).
    - [x] **Extend a line from either end** (item 14; 2026-10-13): Extend from its first or last stop in Lines, clicks beyond it, the draft card pricing the new stops and the buses the longer round trip needs beyond the line's own, on the line rule over the whole line; Extend buys them, and undo takes it back. A stop beyond Longwood costs $4,000 and no bus, and the debug line goes from 614.4 to 638.4 trips a day (DECISIONS, Measured).
12. [ ] Week 5's scheduled presentation items, at most one session in three: the art check and icons in CI (≤0.5), the three.js proof behind a flag (≤1).
13. [x] **Hourly congestion** (the spec's item 15, PLAN cut 8; taken early, 2026-10-13): one `congestionAt` in `src/sim/traffic/`, V2's curve and class weights, per period.
    - [x] **Timing** (2026-10-13): each line's round trip per period from its route's streets, its buses on the longest round trip over the shortest headway, each trip and each bus on the map at its own period's pace. The debug line runs 1,641 s at peak and 1,442 s midday against 1,540 s, still 2 buses at 20 minutes; Inner Boston's ten corridors need 68 buses at 10/15 minutes against 65 (DECISIONS, Measured).
    - [x] **Ridership** (2026-10-13, live at 4121d6c): a rider picks the stops the day's average traffic makes quickest and rides them at each period's, in both the fast loop and the reference. Inner Boston's riders a day move −0.27%, 7.0% fewer at peak and 7.5% more off-peak; the debug line carries 610.5 a day (614.4 before); recompute p50 rises about 4 ms (DECISIONS, Measured).

14. [x] **Credits and `LICENSE-DATA.md`** (PLAN §10's week 5; 2026-10-13): every city source (OpenStreetMap, the Protomaps build, Overture's heights, the 2020 TIGER/Line blocks and county subdivisions, LODES 8.4), the font and the software, each with its licence and credit, and `public/THIRD_PARTY_NOTICES.txt` for the 33 packages the game is built with, generated from the lockfile and checked in CI. Three packages ship no licence text; their upstream texts join the notices before a Steam build. The credits screen stays in week 14.

## Done: M4, Goals, finished 2026-10-13 (the calendar's week 8)

The spec is archived as [`m4-goals.md`](specs/m4-goals.md). Every item is in, the four below its cut included; the owner's exit check on the preview and the medal ladder (DECISIONS, Open, Sun Nov 22) remain.
1. [x] **RIDERSHIP contracts** (item 1; 2026-10-13): 150, 400 or 800 paid boardings a day near a landmark for $60k, $150k or $240k, a change onto a line not counted, dealt with HEADWAY's asks from one deck of six; an offer untaken for 10 days is withdrawn (save format 10). I11's company, now two lines reaching every fixture landmark, earns $900k–$1.02M over 40 days on 100 seeds. On Inner Boston the debug line gives Copley 136.1, and a second line from Copley to Downtown Crossing at 20 minutes lifts it to 400.5, so exit check 1 holds with little to spare (DECISIONS, Measured).
2. [x] **Events** (item 2), from the events' own saved stream.
   - [x] **Roadworks a day ahead** (2026-10-13): rolled at a day's start (0.18, one at a time, 2 days' gap) for 3–6 days on up to 400 m of one named street a running line drives; every line over them drives it at 0.65 of its speed, hatched on the map and named on the day card the evening before, solid while on, and the line card reads its round trip and what the works add (save format 11). 0.8 events a quarter; the debug line +9 to +64 s at peak, median 52; I11 unchanged (DECISIONS, Measured).
   - [x] **Festival and snow** (2026-10-13): each roll picks roadworks, a festival or snow evenly; snow (1–2 days) drives every bus at 0.72 of its speed, the debug line's peak round trip 1,641 s → 2,061 s, riders' rides unslowed; a festival (1–2 days) at a stop picked by its riders draws ×2.6 trips to and from cells within 900 m, the debug line's riders ×1.78–2.2. Markers, day-card notices and the line card's "snow adds" (save format 14). I11's company sizes its buses for snow and takes no RIDERSHIP ask on a festival's riders, and holds over 100 seeds (DECISIONS, Measured). The sweep gains snow and festival slices.
3. [x] **No bus jumps on a change** (item 4; 2026-10-13): a line changed with its buses out keeps the version it ran on, and its merged plan finishes every trip under way on its own route and times, the new departures taking buses as they come free, until it hands over to its day plan with nothing moving (save format 12). Removing a stop, extending, a new headway or model and roadworks starting moved buses 94–2,774 m at the change and now 0.0 m; the handover comes 20–30 minutes on, or hours after a longer headway on the same buses, by the next morning at the latest (DECISIONS, Measured).
4. [x] **Route insert** (item 4; 2026-10-13): Insert a stop on the line card, then a click within 300 m of the line goes into its nearest leg, priced on the card with a warning over a 15% detour; one command, one undo, and no bus moves at the click (exit check 3 as e2e; DECISIONS, Measured).
5. [x] **Medals** (item 3; 2026-10-13): bronze for a quarter of 55, silver at 25,000 trips carried (paid boardings, so a change is not counted twice) with the Goliath behind it, gold for a quarter of 75 with no grade under 60 on a day of 5,000 trips, each awarded once at a close and kept in the save (format 13), on the recommended ladder until the owner answers. On the fixture the debug line alone gets bronze on day 10 and silver on day 41, and two lines every 10 minutes silver on day 23. The medals held are dots on the Contracts chip and the Contracts panel lists the ladder with the trips left to silver, because a chip of their own broke I13 at 1152×720 (6.4% of 6%); the shell at rest late in a game now takes 5.96%, so the chip row is full (DECISIONS, Measured).
6. [x] **The full sweep** (item 5; 2026-10-13): I3 over every headway the line card offers (650 settings), every fare, each model and each tier a lone line's stops may take, with and without roadworks on its own streets, on the debug line and two Inner Boston corridors whose stops are laid every 400 m along the street: it holds in all 54 slices, the best always every 12–15 minutes at peak with overnight off at $1.75–$2.00, a starved line at 2.7% of the best or less. It takes about 37 minutes, so it runs nightly, and the PR checks run it in small (DECISIONS, Measured). Festival and snow join its slices with their PR, doubling the nightly run.
7. [x] **Express behind I3** (below the cut's first; 2026-10-13): a line of 5 km or more with its stops 1,200 m apart on average (and three or more) is express, riders feeling its ride at 0.85 and its fare at half; Express on the line and draft cards. On Massachusetts Avenue the express line (6 stops) draws 727 riders a day where a local one of 7 stops draws 573, but one of 8 stops 733 and the 19-stop corridor more: no exploit. I3 holds on it, in small in the PR checks and in the nightly sweep; the founding recipe and the debug line are not express (DECISIONS, Measured).

## Next: M5, Prototype, by Sun Dec 20 (weeks 9–10; started early, 2026-10-13)

The spec is [`docs/specs/current.md`](specs/current.md). No new system after Sun Dec 6: everything here is a tunable, UI, copy or rendering. The tuning waits for P1's notes (Nov 16–22) and freezes on Dec 13; P2 is Dec 12–13. The 2D/3D chip and the light style pass are look work, at most one session in three until M3 is signed off, with M3's item 12 above. In this order, each a small pull request (items are the spec's):
1. [x] **I14 with events on** (M4's last magnitude; 2026-10-13): a festival's first recompute on Inner Boston, p95 113.6–133.9 ms on this container, under 150 ms; the plain recompute's p95 swung 140–178 ms here, so the nightly now times both on GitHub's runner (DECISIONS, Measured). The full sweep with events held I3 in all 108 slices.
2. [x] **The scripted pacing run** (item 1; 2026-10-13): `src/sim/pacing.ts`, a scripted player, on Inner Boston (`npm run bench pacing`, nightly) and on the fixture in the PR checks, with bands. On Inner Boston: profit at 5.4 minutes and the report card at 12.6 (on target), the second line on day 51 at 46.1 minutes (target 15–25), no gold in 200 days (coverage 43.5 at seven lines, under 60). Speed 3 after day 1 brings the second line to 20.0 minutes; k 1.33 to day 31. For the tuning freeze (item 6) and the medal ladder (DECISIONS, Measured).
3. [x] **The save list** (item 4; 2026-10-13): each slot names its buses and when it was saved, by the page's clock in the save's envelope (no new format); Delete asks first; a save set aside by a new build is listed with Export and Delete until one is used. At its tallest, every slot full and a set-aside save listed, the panel takes 22.3% of 1152×720 (DECISIONS, Measured).
4. [x] **Home** (item 3; 2026-10-13): the first screen over the paused map, with Continue (the game's company, day and cash), New game (asking before it replaces that game; the slots stay) and Saves, the chip row and dock waiting for the game; Back to Home in Saves pauses and returns. 8.0% of 1152×720; the menu's critical path 95.9 KiB (DECISIONS, Measured).
5. [x] **The GPU ladder** (item 5; 2026-10-13): software rendering, by WebGL's caveat or its renderer's name, is Low graphics (flat, the buses' frames capped at 30 a second, one pixel a pixel); no WebGL2 is a calm card with Home, Saves and Export intact; a context lost mid-game is a card with Reload; `?gpu=` forces a rung and `?fps` shows the frame rate. The e2e tests' SwiftShader runs in Low graphics; the menu's critical path 96.9 KiB (DECISIONS, Measured).
6. [ ] **The tuning freeze** (item 2): k, the speed ladder, the medal bars and Boston's balance bands, from the pacing run and P1, by Dec 13. The pacing run ends its 200 days with its 3 depots full, 18 buses, a fourth depot ($340,000) beyond its cash; no company can own more than 30 buses (five depots of six; DECISIONS, Measured).
7. [x] **The 2D/3D chip, drag, snap and cross-fade** (item 6; look work; 2026-10-13): a 2D | 3D chip above the OSM corner, disabled with its reason in Low graphics; a right-drag (or two fingers) pitches 0.25° a pixel and settles in 3D at 25–60°, or flat below 12°; the buildings cross-fade over 400 ms, at once under reduced motion. The dock gave 5 px for it: the shell at rest late in a game takes 5.98% of I13's 6% at 1152×720 (DECISIONS, Measured).
8. [ ] **P2's fixes, the light style pass and the slow-laptop run** (items 7–9; week 10). The run's busy scene is ready (2026-10-13): `npm run bench scene` writes a save of 209 buses on 29 Inner Boston lines at 08:00, past the 30-bus ceiling, to import through Saves on the preview with `?fps`. CI draws every bus in it, in one draw call (PLAN §6: ≤7). A session sends you the file for the run. I14's first frame on software GL is measured and tested too: 1.2–1.5 s on Inner Boston against 2.5 s. So is PLAN §6's heap budget, nightly: the busy scene's heaps grew 1.0% over 30 minutes at 2×, against 10% (DECISIONS, Measured).

## Autonomy protocol (the owner's request, 2026-10-13)

- **Hourly check-in.** A Routine named "interbus hourly check-in" fires every hour into the session that owns `main`. Each firing:
  1. reads this file, fetches, and checks open pull requests and `main`'s CI;
  2. fixes a red or reviewed pull request first;
  3. otherwise continues the first unblocked item under Next or In progress, in small committed and pushed steps;
  4. ends with one line if everything waits on the owner.
- **Usage limits.** If the owner's usage limit runs out, the current turn stops and nothing is lost, because work is pushed in small commits and this file says what is next. The next hourly firing after the limit resets carries on, with no owner action.
- **A new session taking over.** Read `CLAUDE.md`, then this file. List the account's Routines, disable the "interbus hourly check-in" bound to the old session, and create the same Routine bound to the new one. Only one session owns `main`, so never let two check-ins run.
- **Stopping.** The owner says "stop the check-ins", or turns the Routine off under Routines on claude.ai.
- **What a check-in never does:**
  - create a version (only the owner's `/ship`);
  - merge during a playtest freeze;
  - start Steam or desktop work before v1.0 (CLAUDE.md);
  - change repository settings;
  - spend more than one line when nothing changed.
- **Questions** follow CLAUDE.md: at most five a week, batched, each with a recommendation. Until answered, the plan's recommendation stands (PLAN §13), so work does not stop for an open question.

## Session notes (cloud sessions)

- **The session-start hook** (`.claude/hooks/session-start.sh`):
  - installs npm packages, the pinned pyosmium, the fonts and the city files;
  - sets `BAKE_PYTHON`, `PW_CHROMIUM` and `NODE_USE_ENV_PROXY`;
  - prints this file into the session.
- **The proxy** blocks `github.io`, `api.github.com`, Census, Geofabrik and Protomaps. It allows GitHub release downloads, npm and PyPI.
  - Use the GitHub tools for the API.
  - Fetch source data only in the dispatch-only workflows (`tiles.yml`, `heights.yml`, `bake-sources.yml`). Never route around a block.
- **Long downloads and bakes:** the fixture cut takes about 4 minutes. `Bake fixture check (manual)` re-cuts it on a runner and fails on any byte of difference.
- **Changing the save schema:** bump `SAVE_FORMAT` in `src/sim/save/save.ts` and add the new hash to `src/sim/save/schema.lock.json`. The failing test prints the hash. Never edit an existing line in the lock.
- **Pitfall:** `pkill -f <pattern>` run inside a command line that contains the same pattern kills its own shell. Find the process id first.
- **Nightly:** the `Nightly` workflow (`.github/workflows/nightly.yml`) runs I3's full sweep at 07:23 UTC, about 37 minutes here before festival and snow joined its slices and twice that since, likely longer on a runner, and a failing verdict fails that run. It never blocks a merge, so a check-in reads its latest run and fixes a red one.
- **Pitfall:** two `npm run bench` commands at once share `.cache/bench/dist`, and the second empties it under the first. Run them one at a time.
- **The PR checks' 8 minutes:** CI runs two jobs side by side, "Typecheck, lint, tests" and "Build, smoke and e2e". As one job it took 7.0 minutes, and once 8 min 5 s on a slower runner, whose fixture e2e took 5.5 minutes, so the 8-minute limit cancelled it after every step had passed (2026-10-14). Three Playwright workers instead of two saved only 8% here (3.4 against 3.7 minutes), since SwiftShader is bound by the CPU. A new e2e test that adds more than about half a minute needs a trim elsewhere, a shard, or the nightly.
- **Port 4173:** `vite preview` holds it for any Playwright run, so a second run at once fails. A long run (the heap test) blocks the others for its length.
