# Status

The running handoff between Claude sessions. Every session reads it right after `CLAUDE.md`, and every pull request that merges updates it, so a new session or a fresh context window starts from here and loses nothing ([PR-06](history/lessons-ledger.md)). The plan is [PLAN.md](../PLAN.md); decisions are in [DECISIONS.md](DECISIONS.md).

**Updated:** 2026-10-13, at `main` 3c1abf5, with depot land and gateways in review.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` ee8d74f. Deploy preview run 38354291134's live check found that SHA on the build chip and in `version.json`, with the map ready and filling the window and the sim panel up. What it shows:
  - Boston, flat or tilted with `T`;
  - the dots of homes and jobs on mini-Boston;
  - "people within a walk" at the pointer;
  - **Run the debug line** with its day card.
- **Retention:** every redeploy keeps the previous two builds' files on the real site.
- **Repo settings:** `main` is the default branch, and Pages builds from GitHub Actions. The `github-pages` environment allows one Branch rule, `main`.
- **How code reaches `main` (D23):** Claude opens a pull request from `claude/kind-ride-1zb3tn` and merges it with a merge commit once its checks are green. After a merge the branch fast-forwards to `main`, and the next change is a new pull request.
- **Data:**
  - release `city-boston-sim-mini-boston-20b38b02` holds mini-Boston's `sim.json` at `tripScale` 111‰ with bus access by OSM's hierarchy (134,361 B), published by **City sim file (manual)** run 38352676465, which matched the golden on GitHub's runner. The older `7efc98ec` and `ba4110d6` stay for pages of older builds;
  - release `city-boston-tiles-20261012-57ac68da` holds Boston's map file (15.6 MB);
  - release `city-boston-sources-20261012` holds the bake's eight pinned inputs; Inner Boston bakes from them to the golden in `cities/boston/sim-inner-boston.lock.json` (**City sim file** run 38353671557 matched it on GitHub's runner), not yet published;
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

## Next: M2, the first line, by Sun Nov 8 (week 4)

The spec is [`docs/specs/current.md`](specs/current.md). In this order, each a small pull request:
1. [x] **The cycle function** (2026-10-13, `src/sim/rules/cycle.ts`): a round trip, the buses each running period needs, the headway a short line runs, and the founding recipe counted with it (two Sparrows; $427,200 at k = 1.2; D7's clarification). The Sparrow is a config row in `src/sim/config/fleet.ts`.
2. [ ] **Depots in the sim:** the placement predicate, the place command, the price ladder, upkeep, and save format 3.
3. [ ] **Costs as ledger rows** (running, wages, depot upkeep, deadhead) and the line inspector's forecast, equal to the cent (I1, I6).
4. [ ] **Depot land and gateways in `sim.json` format 1**, then G5–G10 on both extents, before the Nov 8 freeze. Depot land, gateways and G5–G7 are done (2026-10-13; DECISIONS, Measured); G9 (load ≤300 ms) and G10 (no transit feature, including in the map file) remain.
5. [ ] **The line tool and headways to purchase:** stops, the 250 m join, the draft card, Create, the "needs N buses" card.
6. [ ] **The vehicle layer:** `busPositionAt`, the code-drawn glyph, I12.
7. [ ] **The calm shell** replacing the debug panel, and I13.
8. [ ] **The exit check as e2e:** found, depot, four stops, a day, the card sums to the change in cash.

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
