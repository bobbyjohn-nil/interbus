# Status

The handoff between Claude sessions: what is live, what waits on the owner, what is in progress and what is next. Every pull request that merges updates it ([PR-06](history/lessons-ledger.md)). It holds nothing else: finished work lives in git, [CHANGELOG.md](../CHANGELOG.md), [DECISIONS.md](DECISIONS.md) and the merged pull requests, and this file's long form up to 2026-10-16 is `git show a5c0ccd:docs/STATUS.md` (D27). The plan is [PLAN.md](../PLAN.md).

**Updated:** 2026-10-22, at `main` da186a6 ([#144](https://github.com/bobbyjohn-nil/interbus/pull/144): the values pass starts, with what gold takes on Inner Boston), with the late game's measurement on this pull request.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` da186a6 (#144). Deploy preview run 39694275545's live check found that SHA on the build chip and in `version.json`, with the map ready and Home up. What it plays is [CHANGELOG.md](../CHANGELOG.md)'s Unreleased.
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

- [ ] **P0, by Sat Oct 17:** the owner and the artist play V1 for 30 minutes each. Notes go in `docs/playtests/2026-10-17-p0-v1-baseline.md`. Merges no longer wait for them: the owner lifted P0's freeze on Oct 21 (D28).
- [ ] **The artist, by Sun Oct 18:** read `docs/art/MODELS.md` §1 and §2 and answer §1's questions, including which Windows version the artist's PC runs (D21 (b)); commit `art/LICENSE.md` naming Miticept Studios and CC BY 4.0 with the credit "Miticept Studios" (D20), which records the artist's agreement.
- [ ] **I14 on a hub of lines, and on many lines, by Sun Nov 1** (DECISIONS, Open): a hub of 10 to 15 lines out of one stop takes 0.11–0.24 s a command at p50 (0.15–0.30 s at p95), and a late game of 20 to 30 lines with no hub 0.14–0.21 s (0.20–0.28 s), against I14's 150 ms at p95. Hold I14 on the reference network, on hubs of up to 8 spokes and on networks of up to 15 lines, and make the assignment faster once a playtest or the pacing run builds a larger one (recommended); or make it faster now (2–3 sessions); or limit a stop to 8 lines (which leaves the late game over).
- [ ] **The late game at the bus ceiling, by Sun Nov 1** (DECISIONS, Open; measured 2026-10-22). At 30 buses a company earns $47,000–50,000 a day and can buy little but Shelters (about $900,000, back in 120 days): a bigger bus pays back in 566 days at best, and only a bigger bus run less often frees a bus place (907 days at best), since no command closes a line or sells a spare bus (V1 had both). Port V1's Close line and Sell spare buses, about a session, before P1 (recommended); or add a sixth depot too ($1,140,000, 36 buses); or neither before P1. The prices stay in all three.
- [ ] **When the values pass starts, by Sun Oct 25** (DECISIONS, Open): the audit confirmed 40 bugs in round 1, 18 in round 7's six lanes (one blocker, six major), 5 minors in round 8's two and 3 in round 9's two, on the least-touched systems, whose fixes are in. The values pass has started by default (In progress, recommended); or audit until a round finds nothing.
- [ ] **Many lines on the map, by Sun Nov 8** (DECISIONS, Open): a late game's 30 lines share 8 colours and nothing recolours one, and lines on the same streets hide each other, a click there opening the line on top. List the lines under such a click now, and leave the palette and side-by-side drawing for the light style pass (recommended); or leave both for the pass; or do both now as unscheduled look work.
- [ ] **I2 and a stop's dwell, by Sun Oct 25** (DECISIONS, Open): hold I2's 0.1% for a stop with the dwell at zero and bound the dwell at 1% of trips (recommended), or make buses skip unused stops.
- [ ] **M2's exit check, on the preview** ([`docs/specs/m2-first-line.md`](specs/m2-first-line.md)): found, a depot, four stops from Copley to Longwood, every 20 minutes, overnight off, and cash moves as the inspector said. Compare **day 2's** card with Finance's Day forecast on day 2, a whole day on both. On day 1 the forecast counts the line from its buses' first drive out, as day 1's card does, but the depot's and stops' upkeep for a whole day where the card has 19 hours of 24 (day 1 opens at 05:00).
- [ ] **M3's exit check, on the preview** ([`m3-money-loop.md`](specs/m3-money-loop.md)): the checklist to a profitable day and a contract in about 8 minutes; the report card; overspending to the countdown and Restart this quarter.
- [ ] **M4's exit check, on the preview** ([`m4-goals.md`](specs/m4-goals.md)): a contract near Copley met with a second line; roadworks hatched a day ahead; a stop inserted with no bus jumping; bronze as a dot on the Contracts chip.
- [ ] **Sun Nov 8, the light token pick** (PLAN §8): the starting light tokens or pure V1 paper, side by side on Boston. The light style pass (M5, item 8) waits for it.
- [ ] **P1, Nov 16–22:** the owner and the artist play the preview; notes in `docs/playtests/`. The tuning freeze (M5, item 2) starts ahead of them under the owner's clearance (D25) and takes their notes in.
- [ ] **The medal ladder, by Sun Nov 22** (DECISIONS, Open; measured 2026-10-21). Bronze comes on day 8 and silver on day 28–29.
  - A player building toward the card gets gold on day 144, at 103 minutes, on seeds 1 and 3, about 17 minutes before PLAN's 2–4 hours; on seed 2 it fills the 30 buses a company can own at Coverage 58.6 and gets none.
  - A network planned for coverage meets every gold bar on 28 buses, graded 80.4.
  - The profit-only player reaches 31.

  The choices: keep the ladder (recommended: a person weighs far fewer lines than the scripted player, so lands later, inside 2–4 hours); or gold's grade floor at 55 (gold on all three seeds at 96–103 minutes); or keep 60 and let a company own more buses.
- [ ] **M5's exit check 4, your Mac's fps:** open the preview with `?fps` in stable Chrome, play at 2,700× (the old 2×, 1,800× until the tuning freeze) flat and tilted, and note the readout in P2's notes. The steps are in [`playtests/PROTOCOL.md`](playtests/PROTOCOL.md), Frame rates; the readout now names its zoom and tilt.

## In progress: the values pass (D26)

Systems that work first, the real values later (D26). The audit found what did not work by running the game, and closed with its ninth round. Rounds 1–9 ran from 2026-10-14 to 2026-10-21 (#105–#143), and each finding was fixed in a small pull request with its test shown failing first (TS-04). Confirmed bugs by round:
- rounds 1–5: 40, 29, 18, 14 and 12;
- round 7's six lanes: 18, one a blocker and six major;
- round 8's two lanes: 5 minors;
- round 9's two lanes: 3 minors.

Each round's lanes, fixes and measurements are in its pull requests and DECISIONS' Measured entries. The values pass now tunes prices, rates, the pacing minutes and the medal bars, against the pacing run and the late-game benches, toward the tuning freeze on Dec 13 (M5, item 2). It is the default until the owner answers (Waiting on the owner: when the values pass starts).

- [x] **The gold measurement** ([#144](https://github.com/bobbyjohn-nil/interbus/pull/144); DECISIONS, Measured, 2026-10-21). It brings back D26's parked harness:
  - `npm run bench coverage`;
  - the pacing player's card scoring (`PACING_CARD_CENTS`) and wider candidates (`PACING_CANDIDATES=wide`);
  - its depot fallbacks, and a retry cadence (`PACING_RETRY_DAYS`), which makes another player.

  What it measured:
  - a network planned for coverage meets every gold bar on 28 of the 30 buses a company can own (card 80.4, Coverage 78.5);
  - a player building toward the card gets gold on day 144, at 103 minutes, on seeds 1 and 3; on seed 2 it fills the 30 buses at Coverage 58.6 and gets none;
  - the profit-only player reaches 31.

  The medal ladder goes to the owner with these numbers (Waiting on the owner).
- [x] **The late game's cash** (this pull request; DECISIONS, Measured, 2026-10-22). `npm run bench lategame` plays a run, then tries each stop's next tier, each bigger bus (at its headways, and less often) and each line a step more often for a day; `LATEGAME_SAVE` keeps the company it played for later runs.
  - The profit-only company (seed 1, day 201, 15 buses): $1.2 million and $10,639 a day more. Its buses never fill, and Shelters and four headway steps are what pays, about $610,000 back in 143–192 days.
  - The card-building company at the 30-bus ceiling (seeds 1 and 2, days 145 and 153): $47,000–50,000 a day more. Shelters pay, about $900,000 back in 120 days; no bigger bus pays back in under 566 days; 11 of its 13–14 lines have no room to run more often; and freeing a bus place, by a bigger bus run less often, pays back in 907 days at best.

  The prices stay. The late game at the bus ceiling goes to the owner (Waiting on the owner).
- [ ] **Next: the contracts' asks, the fare band and crowding** (M5 spec, item 2's tunables), against the pacing run and the companies `LATEGAME_SAVE` keeps.

Open from the audit:
- [ ] **Held for a save format:** the checklist coming back as "5/5 Take a contract" when a taken contract lapses needs a saved flag, so it waits to share one format change with any other finding that needs one.
- [ ] **Left open by #134 and #136:** across a chain of changes a parked bus may be home when a later change's departure needs it (47 departures in 2,500 chains), and the first change on a new day merges a line's kept versions again once, 104–176 ms.
- [ ] **For P0:** a save made before #134 while a line was settling shows Finance's Day forecast off on the day it loads (the next day agrees), so a playtest starts from a fresh game or a settled one.
- [ ] **Left open by #138 and #139:**
  - The floor count stays as it is. A file claiming five closes below the floor ends only its own run, and checking it means replaying the ledger's closes.
  - A Save here, Load or Delete within Saves' 2 s listing of another tab's write to that slot acts on the new save.
- [ ] **For the accessibility pass:** no key opens a stop's card (its riders, upgrade and Take it down), only a click on the map (the ninth round).

## Next

The spec is [`docs/specs/current.md`](specs/current.md) (M5, Prototype, by Sun Dec 20). No new sim system after Sun Dec 6. Look work stays at most one session in three until M3 is signed off.

- [ ] **M3 item 12, week 5's scheduled presentation items:** the art check and icons in CI (≤0.5), the three.js proof behind a flag (≤1).
- [ ] **The tuning freeze** (item 2): k, the speed ladder, the medal bars and Boston's balance bands, from the pacing run and P1, by Dec 13. **k and the speed ladder done** ([#103](https://github.com/bobbyjohn-nil/interbus/pull/103)): k 1.333 and 2,700×, with the bands held nightly. The rest is D26's values pass (In progress); the medal bars wait for the owner. The 200-day run at k 1.2 ended with its 3 depots full, 18 buses, a fourth depot ($505,000; the third was $340,000) beyond its cash; no company can own more than 30 buses (five depots of six; DECISIONS, Measured).
- [ ] **P2's fixes, the light style pass and the slow-laptop run** (items 7–9; week 10). The run's busy scene is ready (2026-10-13): `npm run bench scene` writes a save of 209 buses on 29 Inner Boston lines at 08:00, past the 30-bus ceiling, to import through Saves on the preview with `?fps`. CI draws every bus in it, in one draw call (PLAN §6: ≤7). A session sends you the file for the run. I14's first frame on software GL is measured and tested too: 1.2–1.5 s on Inner Boston against 2.5 s. So is PLAN §6's heap budget, nightly: the busy scene's heaps grew 1.0% over 30 minutes at 1,800×, against 10%, and the nightly now checks them at 2,700× (DECISIONS, Measured).

## Autonomy protocol (the owner's request, 2026-10-13; D27)

- **The check-in.** A Routine named "interbus check-in" fires every six hours (hourly until D27, every two hours from 2026-10-17, every three from 2026-10-19, and every six from the owner's ask on 2026-10-20) into the session that owns `main`. Each firing:
  1. fetches, lists open pull requests and reads the latest Nightly run's result; if `main` has not moved since the last check-in, no pull request of the session's needs anything (red, conflicted, newly reviewed, or green and free to merge), the latest Nightly is green or its failure is already in this file (its I14 step went red on Oct 17 and 18 unseen), and the next item is blocked (a playtest freeze, a usage limit or the owner), it answers in one line and reads nothing else, and firings queued together get one answer;
  2. otherwise reads this file and checks `main`'s CI and deploy;
  3. fixes a red or reviewed pull request first;
  4. otherwise continues the first unblocked item under In progress or Next, in small committed and pushed steps.
- **Usage limits.** If the owner's usage limit runs out, the current turn stops and nothing is lost, because work is pushed in small commits and this file says what is next. The first firing after the limit resets carries on, with no owner action.
- **A new session taking over.** Read `CLAUDE.md`, then this file. List the account's Routines, disable the "interbus check-in" bound to the old session, and create the same Routine bound to the new one. Only one session owns `main`, so never let two check-ins run.
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
  - prints this file at a session’s start or clear, not on a resume (the conversation holds it) or a compaction (its summary carries what is in flight; D27).
- **The proxy** blocks `github.io`, `api.github.com`, Census, Geofabrik and Protomaps. It allows GitHub release downloads, npm and PyPI.
  - Use the GitHub tools for the API.
  - Fetch source data only in the dispatch-only workflows (`tiles.yml`, `heights.yml`, `bake-sources.yml`). Never route around a block.
- **Long downloads and bakes:** the fixture cut takes about 4 minutes. `Bake fixture check (manual)` re-cuts it on a runner and fails on any byte of difference.
- **Changing the save schema:** bump `SAVE_FORMAT` in `src/sim/save/save.ts` and add the new hash to `src/sim/save/schema.lock.json`. The failing test prints the hash. Never edit an existing line in the lock.
- **Pitfall:** `pkill -f <pattern>` run inside a command line that contains the same pattern kills its own shell. Find the process id first.
- **Nightly:** the `Nightly` workflow (`.github/workflows/nightly.yml`) runs I3's full sweep at 07:23 UTC, about 37 minutes here before festival and snow joined its slices and twice that since, likely longer on a runner, and a failing verdict fails that run. It never blocks a merge, so a check-in reads its latest run and fixes a red one.
- **Pitfall:** two `npm run bench` commands at once share `.cache/bench/dist`, and the second empties it under the first. Run them one at a time.
- **The PR checks' 8 minutes:** CI runs two jobs side by side, "Typecheck, lint, tests" and "Build, smoke and e2e". As one job it took 7.0 minutes, and once 8 min 5 s on a slower runner, whose fixture e2e took 5.5 minutes, so the 8-minute limit cancelled it after every step had passed (2026-10-14). Three Playwright workers instead of two saved only 8% here (3.4 against 3.7 minutes), since SwiftShader is bound by the CPU. The fixture e2e then took 5.6 to 7.5 minutes of its job's 8 (#105's two runs, one cancelled by the limit), so since the Build-menu fixes it runs in two halves on two runners, Playwright's shards 1/2 and 2/2: "Build, smoke and e2e" keeps its name and runs the first beside the builds and the smoke tests, and "Fixture e2e, second half" runs the rest, about 3 minutes of tests each. Since the second audit round (#118's first half took 6.7 minutes) it runs in thirds on three runners, shards 1/3 to 3/3: "Build, smoke and e2e" keeps its name and the first third, beside "Fixture e2e, second third" and "Fixture e2e, last third". A new e2e test that adds more than about half a minute to a third still needs a trim elsewhere, a fourth shard, or the nightly.
- **Port 4173:** `vite preview` holds it for any Playwright run, so a second run at once fails. A long run (the heap test) blocks the others for its length.
