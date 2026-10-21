# Status

The handoff between Claude sessions: what is live, what waits on the owner, what is in progress and what is next. Every pull request that merges updates it ([PR-06](history/lessons-ledger.md)). It holds nothing else: finished work lives in git, [CHANGELOG.md](../CHANGELOG.md), [DECISIONS.md](DECISIONS.md) and the merged pull requests, and this file's long form up to 2026-10-16 is `git show a5c0ccd:docs/STATUS.md` (D27). The plan is [PLAN.md](../PLAN.md).

**Updated:** 2026-10-21, at `main` 582579a ([#140](https://github.com/bobbyjohn-nil/interbus/pull/140): the seventh audit round's last two finder lanes' fixes), with the eighth round's fixes on this pull request.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` 582579a (#140). Deploy preview run 39619329571's live check found that SHA on the build chip and in `version.json`, with the map ready and Home up. What it plays is [CHANGELOG.md](../CHANGELOG.md)'s Unreleased.
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
- [ ] **Many lines on the map, by Sun Nov 8** (DECISIONS, Open): a late game's 30 lines share 8 colours and nothing recolours one, and lines on the same streets hide each other, a click there opening the line on top. List the lines under such a click now, and leave the palette and side-by-side drawing for the light style pass (recommended); or leave both for the pass; or do both now as unscheduled look work.
- [ ] **I2 and a stop's dwell, by Sun Oct 25** (DECISIONS, Open): hold I2's 0.1% for a stop with the dwell at zero and bound the dwell at 1% of trips (recommended), or make buses skip unused stops.
- [ ] **M2's exit check, on the preview** ([`docs/specs/m2-first-line.md`](specs/m2-first-line.md)): found, a depot, four stops from Copley to Longwood, every 20 minutes, overnight off, and cash moves as the inspector said. Compare **day 2's** card with Finance's Day forecast on day 2, a whole day on both. On day 1 the forecast counts the line from its buses' first drive out, as day 1's card does, but the depot's and stops' upkeep for a whole day where the card has 19 hours of 24 (day 1 opens at 05:00).
- [ ] **M3's exit check, on the preview** ([`m3-money-loop.md`](specs/m3-money-loop.md)): the checklist to a profitable day and a contract in about 8 minutes; the report card; overspending to the countdown and Restart this quarter.
- [ ] **M4's exit check, on the preview** ([`m4-goals.md`](specs/m4-goals.md)): a contract near Copley met with a second line; roadworks hatched a day ahead; a stop inserted with no bus jumping; bronze as a dot on the Contracts chip.
- [ ] **Sun Nov 8, the light token pick** (PLAN §8): the starting light tokens or pure V1 paper, side by side on Boston. The light style pass (M5, item 8) waits for it.
- [ ] **P1, Nov 16–22:** the owner and the artist play the preview; notes in `docs/playtests/`. The tuning freeze (M5, item 2) starts ahead of them under the owner's clearance (D25) and takes their notes in.
- [ ] **The medal ladder, by Sun Nov 22** (DECISIONS, Open): a value, so it waits for D26's values pass; the recommendation (keep bronze and silver, let the tuning set gold's floor) stays the default meanwhile. On Inner Boston the scripted company gets bronze on day 8 and silver on day 28–29 but no gold in 200 days, its corridors reaching Coverage 31.6 with seven lines against gold's 60.
- [ ] **M5's exit check 4, your Mac's fps:** open the preview with `?fps` in stable Chrome, play at 2,700× (the old 2×, 1,800× until the tuning freeze) flat and tilted, and note the readout in P2's notes. The steps are in [`playtests/PROTOCOL.md`](playtests/PROTOCOL.md), Frame rates; the readout now names its zoom and tilt.

## In progress: systems that work (D26)

Systems that work first, the real values later (D26): an audit finds what does not work by running the game, and each fix is a small pull request with its test shown failing first (TS-04).

- [x] **Rounds 1–6** (2026-10-14 to 2026-10-16; #105–#136): 40, 29, 18, 14 and 12 bugs confirmed in rounds 1–5, and the sixth round fixed the fifth's open items. 16 of the 157 findings were refuted, all as the recorded design or already known. Each round's lanes, fixes and measurements are in its pull requests and DECISIONS' Measured entries.
- [ ] **Held for a save format:** the checklist coming back as "5/5 Take a contract" when a taken contract lapses needs a saved flag, so it waits to share one format change with any other finding that needs one.
- [ ] **Left open by #134 and #136:** across a chain of changes a parked bus may be home when a later change's departure needs it (47 departures in 2,500 chains); the first change on a new day merges a line's kept versions again once, 104–176 ms.
- [ ] **For P0:** a save made before #134 while a line was settling shows Finance's Day forecast off on the day it loads (the next day agrees), so a playtest starts from a fresh game or a settled one.
- [x] **The seventh round** (2026-10-19 to 2026-10-21, on `main` 3e22fd6; #138–#140; its open items below): six lanes (hostile and malformed save files, determinism and Export session's replay, a 200-day game, the screens with many lines, the edges of the fifth and sixth rounds' fixes, and window sizes, zoom and resizes), each told the 157 known findings. The weekly usage limit stopped it after the save-files lane, whose six findings follow; the owner reset the limit on Oct 19:
  - major: a save whose settling line keeps a version with a zero headway and a zero round trip stops the game when imported (`dayDepartures` never moves on; the reader checks a line's plan but not its kept versions', `src/sim/save/save.ts`), and held as the autosave it makes every load fail with "Boston couldn’t be loaded";
  - major: a save whose settling line owns a billion buses runs the tab out of memory when imported;
  - major: a slot or autosave stamped with a saved time past the Date range blanks the page when Saves opens, after every reload;
  - minor: a file whose counters sit near the safe-integer limit is accepted, and the game then writes an autosave its own reader refuses;
  - minor: the reader accepts lines the line rule never allows (no stops, one stop, a stop twice, a stop off every street);
  - minor: a file with five closes below the credit floor but cash well above it loads as an ended run.

  Five are fixed in #138, each with its failing-first test, and a stop off every street in #139; the floor count is left as it is (below). The reader now holds:
  - kept versions to the headway rule;
  - a line and its kept versions to 86,400 buses (no timetable runs more);
  - a saved time to what a date holds;
  - a line to two stops or more, with none twice;
  - the counters to half the largest whole number in the game's own saves and an eighth in an imported file (the independent review's change, with kept versions' distances).

  Three more lanes ran as finders on Oct 19:
  - determinism and Export session's replay: nothing;
  - the 200-day game: one minor, I14 on a hub of lines (Waiting on the owner). `npm run bench recompute` now times hubs of spokes out of Copley, holds those of up to 8 to I14, and takes p95 from 100 runs: from 30, the nightly's I14 step was red on Oct 17 and 18 (Inner Boston's assignment p95 170.8 ms against a p50 of 77.3);
  - the edges of the fifth and sixth rounds' fixes: three, fixed in #138 with failing-first tests:
    - (blocker) with two tabs, Saves listed its slots again only at the autosave's changes, so a row read Empty over a game the other tab had kept there, and Save here wrote over it unasked;
    - (major) the map's start-failure card and the replaced build's card offered Reload alone while the game wasn't saving itself;
    - (minor) the day card and the lender's card hid the start-failure card.

  In [#139](https://github.com/bobbyjohn-nil/interbus/pull/139): no bus runs more often than once a minute (`MIN_HEADWAY_SECONDS`). A save running its line every second with 2,000 buses took 3.3–3.8 s a recompute; every minute with 86,400 buses, 5–34 ms (`npm run bench headways`). And a save of this map with a stop off every street reads as unreadable: it loaded, the stop drawn off the streets while its line routed to the nearest one.

  The independent review of those two found one blocker and two minors, all fixed there with failing-first tests: such a save as the autosave went unsaid at the start and the founding save wrote over it (now set aside as unreadable, with its notice); a slot holding one listed as readable and Load then refused it (now it lists as unreadable); and the reader took any longitude, so a stop at 1e308 hung the worker in the street grid's search at every load (now a place off the globe is refused).

  The independent review of the edges fixes found three minors and three nits, all fixed: the stacked replaced card drops below a day card as the map's cards do, the bench's hubs are real spokes (the finder's lines ran Copley and then four stops 1.5–6 km away), DECISIONS states Saves' 2 s window, an emptied slot under Load's question gets Save here back, the replaced card's name carries its warning, and a unit test claims only what it checks. Left open:
  - the floor count, left as it is: a file claiming five closes below the floor ends only its own run, and checking it means replaying the ledger's closes;
  - a Save here, Load or Delete within Saves' 2 s listing of another tab's write to that slot acts on the new save.

  The last two lanes ran as finders on Oct 21:
  - window sizes, zoom and resizes: two, fixed in #140 with failing-first tests:
    - (major) in full graphics, buses kept the old screen's sizing after the window moved to a screen of another density (Sparrows 11–12 px from 2x to 1x, against I12's 20, and 42–43 px back, the map blurry), and drew at 26–28 px on a 5K window, whose canvas MapLibre caps at 4,096 px: the vehicle layer now sizes by the ratio the canvas is drawn at, and the map resizes at each change of density;
    - (minor) an open dropdown stayed where it opened when the window changed size, off the window and holding the keyboard: it now closes, the keyboard back on its button;
  - the screens with many lines, on a late game of up to 30 lines (`src/sim/scene.ts` lateScene): six, three fixed in #140 with failing-first tests:
    - (major) Finance's Lines held the game up while it worked out the open line's fare band, up to 1.1–1.3 s with 30 lines, at each line opened there and each change of the network: fixed in #140, the band worked out a step at a time between the worker's ticks, each slice under 25 ms and one step (a step 37–163 ms, `npm run bench fares`), and dropped once Finance forgets it;
    - (minor) I14 on a late game with no hub, over from 20 lines: added to the I14 question (Waiting on the owner), and `npm run bench recompute` times it;
    - (minor) the line card's "Fare and money in Finance" opened a low line's money below the panel's foot, out of view: Finance's body now scrolls to it once, and once more when its first fare band comes, its heading, Close and views staying in view;
    - (minor) with 30 lines, Lines' tabs took no arrow keys, and a low line's Run it was cut off at the panel's foot: the arrows, Home and End move along the tabs, one Tab goes on to the card, and a change's card scrolls into view (`e2e/many.spec.ts`, on the fixture's late game of 18 lines);
    - (minor) 30 lines share 8 colours, and nothing changes a line's colour;
    - (minor) lines on the same streets hide each other on the map, and a click there opens the line on top.

  The colours and the shared streets wait for the owner's call (Waiting on the owner).
- [ ] **The eighth round** (on `main` 582579a, from 2026-10-21): two lanes (D27), each told the 187 known findings: the edges of the seventh round's fixes, and goals and events over several quarters of play (contracts, medals, events, the report and day cards, the checklist, and the failure floor with Restart this quarter), the systems with the fewest findings so far.

## Next

The spec is [`docs/specs/current.md`](specs/current.md) (M5, Prototype, by Sun Dec 20). No new sim system after Sun Dec 6. Look work stays at most one session in three until M3 is signed off.

- [ ] **M3 item 12, week 5's scheduled presentation items:** the art check and icons in CI (≤0.5), the three.js proof behind a flag (≤1).
- [ ] **The tuning freeze** (item 2): k, the speed ladder, the medal bars and Boston's balance bands, from the pacing run and P1, by Dec 13. **k and the speed ladder done** ([#103](https://github.com/bobbyjohn-nil/interbus/pull/103)): k 1.333 and 2,700×, with the bands held nightly. The rest waits for D26's values pass, the medal bars for the owner. The 200-day run at k 1.2 ended with its 3 depots full, 18 buses, a fourth depot ($505,000; the third was $340,000) beyond its cash; no company can own more than 30 buses (five depots of six; DECISIONS, Measured).
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
