# Status

The running handoff between Claude sessions. Every session reads it right after `CLAUDE.md`, and every pull request that merges updates it, so a new session or a fresh context window starts from here and loses nothing ([PR-06](history/lessons-ledger.md)). The plan is [PLAN.md](../PLAN.md); decisions are in [DECISIONS.md](DECISIONS.md).

**Updated:** 2026-10-13, at `main` c89f6cb, with axe-core in the smoke test in review.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` 605d370. Deploy preview run 38346915657's live check found that SHA on the build chip and in `version.json`, with the map ready and filling the window. What it shows:
  - Boston, flat or tilted with `T`;
  - the dots of homes and jobs on mini-Boston;
  - "people within a walk" at the pointer;
  - **Run the debug line** with its day card.
- **Retention:** every redeploy keeps the previous two builds' files on the real site.
- **Repo settings:** `main` is the default branch, and Pages builds from GitHub Actions. The `github-pages` environment allows one Branch rule, `main`.
- **How code reaches `main` (D23):** Claude opens a pull request from `claude/kind-ride-1zb3tn` and merges it with a merge commit once its checks are green. After a merge the branch fast-forwards to `main`, and the next change is a new pull request.
- **Data:**
  - release `city-boston-sim-mini-boston-ba4110d6` holds mini-Boston's `sim.json` (132,908 B), published by **City sim file (manual)** run 38346461662;
  - release `city-boston-tiles-20261012-57ac68da` holds Boston's map file (15.6 MB);
  - release `city-boston-sources-20261012` holds the bake's eight pinned inputs;
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
- **Item 13:** [`docs/specs/current.md`](specs/current.md), the M1 spec.

## Next: M1, the first dollar on the fixture, by Sun Nov 1 (week 3)

The spec is [`docs/specs/current.md`](specs/current.md). Much of its top half is in already:
- demand;
- income rows;
- the daily close;
- the debug line;
- the layers.

What is left, in order:
1. [x] **`tripScale`** is 111‰ (2026-10-13), in `city.json` calib. The debug line carries 799.3 boardings a day and `calibration.test.ts` holds the 600–1,000 band. The fixture's `sim.json` was rebaked, re-locked and republished.
2. [x] **I2** and **I3 per period** (2026-10-13, `src/sim/demand/invariants.test.ts`). The bus clause of I2 waits for week 4's buses.
3. [ ] **The recompute bench,** outside `src/sim`: the fixture plus a synthetic 800-cell grid, three periods, p95. It is 37 ms on the fixture today against a ≤20 ms guess, and the R2 decision (D11) on Nov 1 rests on it.
4. **Below the cut line:** the Inner Boston bake job, then per-period crowding, then visitors.

Open from the research critique, for week 4:
- **The starter recipe's bus count.** V1's cycle formula says a 3–4 km line every 20 min needs 2 Sparrows, not the 1 in D7's $261k starter. Make the recipe count its buses with the one cycle function (K07).
- **The debug line runs with no bus or cost (K42)** until week 4's buses.

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
