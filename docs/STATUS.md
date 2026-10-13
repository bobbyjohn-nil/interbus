# Status

The running handoff between Claude sessions. Every session reads it right after `CLAUDE.md`, and every pull request that merges updates it, so a new session or a fresh context window starts from here and loses nothing ([PR-06](history/lessons-ledger.md)). The plan is [PLAN.md](../PLAN.md); decisions are in [DECISIONS.md](DECISIONS.md).

**Updated:** 2026-10-13, at `main` 7a20198 (V2's waits), with M3 step 2c, crowding, in review.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` 7a20198. Deploy preview run 38377940934's live check found that SHA on the build chip and in `version.json`, with the map ready and filling the window and the sim panel up. What it shows:
  - Boston with no transit on the map, flat or tilted with `T`;
  - the dots of homes and jobs on mini-Boston;
  - "people within a walk" at the pointer;
  - the founding card, and the checklist chip naming the next step;
  - the calm shell: a chip row, a dock with **Place a depot**, **Draw a line** and **Lines**, the line inspector with its headways and a day's forecast, and notices in one corner;
  - a bus model per line, Sparrow or Metro 40, picked on the new-line card and swapped on the line card, each drawn at its own length;
  - V2's waits: riders leave a line that comes once an hour;
  - buses pulling out, running the line's day plan and driving home, drawn by the vehicle layer;
  - a day card at midnight listing fares, subsidy, running, wages, deadhead and upkeep;
  - the game saved in the browser as it plays, so a reload carries on where it was.
- **Retention:** every redeploy keeps the previous two builds' files on the real site.
- **Repo settings:** `main` is the default branch, and Pages builds from GitHub Actions. The `github-pages` environment allows one Branch rule, `main`.
- **How code reaches `main` (D23):** Claude opens a pull request from `claude/kind-ride-1zb3tn` and merges it with a merge commit once its checks are green. After a merge the branch fast-forwards to `main`, and the next change is a new pull request.
- **Data:**
  - release `city-boston-sim-mini-boston-da5ebb4b` holds mini-Boston's `sim.json` with depot land, the (empty) gateway list and three landmarks (135,551 B), published by **City sim file (manual)** run 38374308243, which matched the golden on GitHub's runner. The older `69866a1e`, `20b38b02`, `7efc98ec` and `ba4110d6` stay for pages of older builds;
  - release `city-boston-tiles-20261012-a35f1831` holds Boston's map file with every transit feature stripped (15,347,095 B), published by **City tiles (manual)** run 38359580324 from the extract `57ac68da` (D17, G10). The older `57ac68da` stays for pages of older builds;
  - release `city-boston-sources-20261012` holds the bake's eight pinned inputs; Inner Boston bakes from them to the golden `ef552579` (with six landmarks) in `cities/boston/sim-inner-boston.lock.json`, not yet published;
  - mini-Boston is committed under `tools/bake/fixtures/mini-boston/`, and G4 is exact (Boston 675,647).

## Waiting on the owner

- [ ] Protect `main` (PLAN §14 item 2):
  - pull requests only;
  - "Versions only via /ship" required;
  - merge commits only;
  - a `v*` tag ruleset blocking update and deletion.
- [ ] Say whether V1's site still loads. If it doesn't, Claude hosts V1 on the preview for P0 (week 1 item 6).
- [ ] **P0, by Fri Oct 17:** the owner and the artist play V1 for 30 minutes each. Notes go in `docs/playtests/2026-10-17-p0-v1-baseline.md`.
- [ ] **The artist, by Sun Oct 18:** read `docs/art/MODELS.md` §3, §3.1, §5, §6 and §10 and answer §12; commit `art/LICENSE.md`.
- [ ] **D20, by Sun Oct 25:** the art's open licence (recommended CC BY 4.0).
- [ ] **Week 2 check:** "Does this look like Boston?" (PLAN §14 item 14).
- [ ] **I2 and a stop's dwell, by Sun Oct 25** (DECISIONS, Open): hold I2's 0.1% for a stop with the dwell at zero and bound the dwell at 1% of trips (recommended), or make buses skip unused stops.
- [ ] **M2's exit check, on the preview** ([`docs/specs/m2-first-line.md`](specs/m2-first-line.md)): found, a depot, four stops from Copley to Longwood, every 20 minutes, overnight off, and cash moves as the inspector said. Compare the costs on **day 2's** card: day 1 opens at 05:00, after the first bus left the depot, so its wages and deadhead fall a little short of a whole day's forecast.

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

## Next: M3, the money loop, by Sun Nov 29 (weeks 5–7)

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
3. [ ] **The fare band** (item 4): per-line fares, perceived once per trip, the subsidy taper, the printed band; I3's fare optimum and I4.
4. [ ] **Stop tiers, QUIET and LOSS** (item 5), and **Finance** (item 6).
5. [ ] **Undo while paused** (item 7, I9).
6. [ ] **Saves for r1** (item 8): stops by place and the r1→r2 save test, the missing-pack refusal, slots, export and import.
7. [ ] **`city-boston-r1`** by Sun Nov 15: β fit, `tripScale` re-measured, starting cash derived, Overture heights; the preview plays Inner Boston.
8. [ ] **The report card** (item 9), its bands from a measured spread over 10 seeds.
9. [ ] **The failure floor** (item 10): the credit line, the countdown, Restart this quarter.
10. [ ] **HEADWAY contracts** (item 11, I11), checklist step 5 and **Export session** (item 12).
11. [ ] **Transfers** (item 13, I5) and **route remove and extend** (item 14).
12. [ ] Week 5's scheduled presentation items, at most one session in three: the art check and icons in CI (≤0.5), the three.js proof behind a flag (≤1).

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
  - Fetch source data only in the dispatch-only workflows (`tiles.yml`, `bake-sources.yml`). Never route around a block.
- **Long downloads and bakes:** the fixture cut takes about 4 minutes. `Bake fixture check (manual)` re-cuts it on a runner and fails on any byte of difference.
- **Changing the save schema:** bump `SAVE_FORMAT` in `src/sim/save/save.ts` and add the new hash to `src/sim/save/schema.lock.json`. The failing test prints the hash. Never edit an existing line in the lock.
- **Pitfall:** `pkill -f <pattern>` run inside a command line that contains the same pattern kills its own shell. Find the process id first.
