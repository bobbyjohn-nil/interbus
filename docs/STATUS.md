# Status

The running handoff between Claude sessions. Every session reads it right after `CLAUDE.md`, and every pull request that merges updates it, so a new session or a fresh context window starts from here and loses nothing ([PR-06](history/lessons-ledger.md)). The plan is [PLAN.md](../PLAN.md); decisions are in [DECISIONS.md](DECISIONS.md).

**Updated:** 2026-10-13, at `main` 605d370, with the height-tag count in review.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` 47fdf77, where `T` tilts Boston into 3D. Deploy preview run 38342415689's live check found that SHA on the build chip and in `version.json`, with the map ready and filling the window.
- **The first redeploy kept the previous build's files** on the real site ("kept 1 earlier build(s), fetched 2 file(s)").
- **Repo settings:** `main` is the default branch, and Pages builds from GitHub Actions. The `github-pages` environment allows one Branch rule, `main`.
- **How code reaches `main` (D23):** Claude opens a pull request from `claude/kind-ride-1zb3tn` and merges it with a merge commit once its checks are green. After a merge the branch fast-forwards to `main`, and the next change is a new pull request.
- **Data:**
  - release `city-boston-sim-mini-boston-ba4110d6` holds mini-Boston's `sim.json` (132,908 B), published by **City sim file (manual)** run 38346461662;
  - release `city-boston-tiles-20261012-57ac68da` holds Boston's map file (15.6 MB). Release `city-boston-sources-20261012` holds the bake's eight pinned inputs. Mini-Boston is committed under `tools/bake/fixtures/mini-boston/`, and G4 is exact (Boston 675,647).

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

## In progress: week 2 (Oct 19–25, started Oct 13)

PLAN §14 items 10–13. The exit check: `T` tilts and returns; dots sit where Back Bay to Longwood lives and works; "people within a walk"; does it look like Boston?

- [x] **Item 10, ports** (all landed 2026-10-13). Each port's tests pass, I7 and the schema hash pass, and each is shown failing on the old bug. A port counts as done once the worker host uses it (SC-09).
  - [x] The sim core (2026-10-13), in `src/sim/{config,core,rules,economy}`:
    - branded ids minted from saved counters;
    - one `{ok, reason}` result type;
    - V2's RNG with a savable state;
    - V3's calendar on whole seconds from 05:00;
    - D7's periods and headway limits;
    - V3's cent ledger, rebuilt as rows with Founding capital first (I1).
  - [x] V3's saves (2026-10-13), in `src/sim/save` and `src/sim/state.ts`, plus the async `SaveStore` in `src/platform`:
    - one schema descriptor gives the type, the strict reader and the hash;
    - every id counter is saved;
    - an older format is set aside, never migrated (D12);
    - I7 and I8's save-load-save hold.
  - [x] V2's graph and A*, V1's geo (2026-10-13), in `src/sim/city` and `src/sim/core/geo.ts`:
    - CSR on typed arrays, in whole decimetres and centiseconds;
    - A* over directed half-edges, so a turn cost never closes a node on the wrong arrival (K13);
    - one geo frame per city, held to the WGS 84 ellipsoid to within 1 m per degree.
  - [x] V3's error bus, in `src/ui/errors`, outside the sim with an injected clock, catching the page's uncaught errors from boot.
- [ ] **Item 11, the city on the fixture:**
  - [x] the street graph with bus access, census to cells, and `sim.json` format 1 for mini-Boston (2026-10-13, `tools/bake/{streets,cells,sim}.mjs`):
    - 675 nodes and 1,028 edges;
    - 84 cells;
    - G1–G3 per extent;
    - a golden hash in `sim.lock.json` (I17).
  - [x] the fixture's `sim.json` published (2026-10-13), and named in `cities/index.json` in the sim-worker PR, so the deploy ships it. To republish after a bake change, run **City sim file (manual)** with publish on, then update the entry.
  - [x] the `sim.json` loader (2026-10-13, `src/sim/city/simfile.ts`):
    - strict, with refusals named;
    - one-way streets honoured by the router;
    - I10's network clauses hold on the fixture;
    - Copley to Longwood is 3,480 m by street.
  - [x] the worker host (2026-10-13, `src/worker`):
    - the fixed step at speeds of 10, 30 and 90 game-minutes a second;
    - snapshots about 10 times a second, none while paused;
    - message types in `src/sim/types`.
  - [x] on the preview, from the sim worker:
    - the dots of homes and jobs;
    - "≈N people within a walk" at the pointer, equal to the rule's number in e2e;
    - the debug line, with labelled chips and the day card (`e2e/sim.spec.ts`).
  - [x] the Inner Boston height-tag count (2026-10-13, `tools/bake/heights.mjs`): 14.1% carry a height or level count, so Overture's heights join r1 in week 5;
  - [ ] still to do: `axe-core` in the smoke test;
  - demand dots and the catchment probe;
  - Inner Boston's height-tag count;
  - smoke;
  - [x] **the fare-row signal, green 2026-10-13** (due Sun Oct 25), in `src/sim/fare-row.test.ts`:
    - the debug line on the fixture writes fare and subsidy rows on day 1, and the day card adds up;
    - I8 holds over three days in 72 chunks, and across a mid-day save and load;
    - the demand rewrite is in `src/sim/demand`, the fixed step in `src/sim/step.ts`.
    - Uncalibrated (`tripScale` 1): 7,200.7 boardings a day and $27,720 of income, about 7× V1's starter (1,058), as PLAN §3's density estimate predicts. Week 3 sets `tripScale`.
    - Recompute takes 37 ms on the fixture with one line, against the spec's ≤20 ms guess: the 8 × 8 sub-point pairs per cell pair cost more than the spec assumed, and week 3's bench takes it from here.
- [x] **Item 12, raw tilt** (2026-10-13):
  - `T` eases to pitch 50° at zoom ≥14 and swaps the flat buildings for extrusions; `T` again flattens. Untagged buildings stand 10 m until the bake's heights.
  - V1's board mask greys beyond the play area behind a dashed edge.
  - Style tests (extrusions, mask, spec validation) and `e2e/tilt.spec.ts`; `measure:bundle` now fails a board over 520 KiB (433.0 KiB).
- [x] **Item 13** (2026-10-13): [`docs/specs/current.md`](specs/current.md), the M1 spec. It has the exit check, the magnitudes expected before measuring, the tests, the cut line, and Claude's calls (gates per extent, β = 4.0 km, k = 1.2, the day closing at 24:00).

## Next

1. Week 2: the city on the fixture (item 11), with the fare-row signal by **Sun Oct 25**. Items 10, 12 and 13 are done. Each port PR cites the V1–V3 lines it ports and the defects it fixes on the way in.
2. Week 3, **M1 first dollar by Sun Nov 1**. Money before presentation: from week 3 no look work starts until the first dollar.

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
