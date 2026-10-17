# Status

The handoff between Claude sessions: what is live, what waits on the owner, what is in progress and what is next. Every pull request that merges updates it ([PR-06](history/lessons-ledger.md)). It holds nothing else: finished work lives in git, [CHANGELOG.md](../CHANGELOG.md), [DECISIONS.md](DECISIONS.md) and the merged pull requests, and this file's long form up to 2026-10-16 is `git show a5c0ccd:docs/STATUS.md` (D27). The plan is [PLAN.md](../PLAN.md).

**Updated:** 2026-10-17, at `main` a5c0ccd, in P0's playtest freeze, with the seventh audit round stopped by the weekly usage limit and the sessions' token use cut (D27).

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` a5c0ccd (#137, this file only; the game as #136 left it). Deploy preview run 38954681077's live check found that SHA on the build chip and in `version.json`, with the map ready and Home up. What it plays is [CHANGELOG.md](../CHANGELOG.md)'s Unreleased.
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

- [ ] **P0, by Sat Oct 17:** the owner and the artist play V1 for 30 minutes each. Notes go in `docs/playtests/2026-10-17-p0-v1-baseline.md`.
- [ ] **The artist, by Sun Oct 18:** read `docs/art/MODELS.md` §1 and §2 and answer §1's questions, including which Windows version the artist's PC runs (D21 (b)); commit `art/LICENSE.md` naming Miticept Studios and CC BY 4.0 with the credit "Miticept Studios" (D20), which records the artist's agreement.
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
- [ ] **The seventh round** (on `main` 3e22fd6): six lanes (hostile and malformed save files, determinism and Export session's replay, a 200-day game, the screens with many lines, the edges of the fifth and sixth rounds' fixes, and window sizes, zoom and resizes), each told the 157 known findings. The weekly usage limit (until Thu Oct 22, 06:00 UTC) stopped it after the save-files lane, whose six findings are not yet reproduced a second time:
  - major: a save whose settling line keeps a version with a zero headway and a zero round trip stops the game when imported (`dayDepartures` never moves on; the reader checks a line's plan but not its kept versions', `src/sim/save/save.ts`), and held as the autosave it makes every load fail with "Boston couldn’t be loaded";
  - major: a save whose settling line owns a billion buses runs the tab out of memory when imported;
  - major: a slot or autosave stamped with a saved time past the Date range blanks the page when Saves opens, after every reload;
  - minor: a file whose counters sit near the safe-integer limit is accepted, and the game then writes an autosave its own reader refuses;
  - minor: the reader accepts lines the line rule never allows (no stops, one stop, a stop twice, a stop off every street);
  - minor: a file with five closes below the credit floor but cash well above it loads as an ended run.

  The first is fixed on a local branch (the reader now holds each kept version to the headway rule), waiting for this pull request to merge before its own.

  Next: the session fixes the other five on branches, each one's failing test its reproduction (D27); once the limit resets, three of the other five lanes run as finders (the edges of the fifth and sixth rounds' fixes, determinism and Export session's replay, the 200-day game); every fix merging, each a small pull request, after P0's notes are committed.

## Next

The spec is [`docs/specs/current.md`](specs/current.md) (M5, Prototype, by Sun Dec 20). No new sim system after Sun Dec 6. Look work stays at most one session in three until M3 is signed off.

- [ ] **M3 item 12, week 5's scheduled presentation items:** the art check and icons in CI (≤0.5), the three.js proof behind a flag (≤1).
- [ ] **The tuning freeze** (item 2): k, the speed ladder, the medal bars and Boston's balance bands, from the pacing run and P1, by Dec 13. **k and the speed ladder done** ([#103](https://github.com/bobbyjohn-nil/interbus/pull/103)): k 1.333 and 2,700×, with the bands held nightly. The rest waits for D26's values pass, the medal bars for the owner. The 200-day run at k 1.2 ended with its 3 depots full, 18 buses, a fourth depot ($505,000; the third was $340,000) beyond its cash; no company can own more than 30 buses (five depots of six; DECISIONS, Measured).
- [ ] **P2's fixes, the light style pass and the slow-laptop run** (items 7–9; week 10). The run's busy scene is ready (2026-10-13): `npm run bench scene` writes a save of 209 buses on 29 Inner Boston lines at 08:00, past the 30-bus ceiling, to import through Saves on the preview with `?fps`. CI draws every bus in it, in one draw call (PLAN §6: ≤7). A session sends you the file for the run. I14's first frame on software GL is measured and tested too: 1.2–1.5 s on Inner Boston against 2.5 s. So is PLAN §6's heap budget, nightly: the busy scene's heaps grew 1.0% over 30 minutes at 1,800×, against 10%, and the nightly now checks them at 2,700× (DECISIONS, Measured).

## Autonomy protocol (the owner's request, 2026-10-13; D27)

- **The check-in.** A Routine named "interbus check-in" fires every two hours (hourly until D27) into the session that owns `main`. Each firing:
  1. fetches and lists open pull requests; if `main` has not moved since the last check-in, no pull request of the session's needs anything (red, conflicted, newly reviewed, or green and free to merge) and the next item is blocked (a playtest freeze, a usage limit or the owner), it answers in one line and reads nothing else, and firings queued together get one answer;
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
