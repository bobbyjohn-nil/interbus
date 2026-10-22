# Status

The handoff between Claude sessions: what is live, what waits on the owner, what is in progress and what is next. Every pull request that merges updates it ([PR-06](history/lessons-ledger.md)). It holds nothing else: finished work lives in git, [CHANGELOG.md](../CHANGELOG.md), [DECISIONS.md](DECISIONS.md) and the merged pull requests, and this file's long form up to 2026-10-16 is `git show a5c0ccd:docs/STATUS.md` (D27). The plan is [PLAN.md](../PLAN.md).

**Updated:** 2026-10-22, at `main` 06e4037 ([#155](https://github.com/bobbyjohn-nil/interbus/pull/155): lines, demand dots and contract figures told apart by more than colour), with the accessibility pass's fifth step, the focus cases its reviews left open, on this pull request.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` 06e4037 (#155). Deploy preview run 39840153493's live check found that SHA on the build chip and in `version.json`, with the map ready and the sim worker running on the city's sim file. What it plays is [CHANGELOG.md](../CHANGELOG.md)'s Unreleased.
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
- [ ] **The late game at the bus ceiling, by Sun Nov 1** (DECISIONS, Open; measured 2026-10-22). At 30 buses a company earns $47,000–50,000 a day and can buy little but Shelters (about $900,000, back in about 130 days): a bigger bus pays back in 566 days at best, and only a bigger bus run less often freed a bus place (926 days at best), since no command closed a line or sold a spare bus. Close line and Sell spare buses now do, each selling at half price as a model change does: the recommendation, in since [#149](https://github.com/bobbyjohn-nil/interbus/pull/149) as it stands until you answer. Left to choose: V1's way instead, a closed line's buses free to another line (about two sessions, and a save-format change); either with a sixth depot ($1,140,000, 36 buses); or none before P1, which takes the two out again. The prices stay.
- [ ] **When the values pass starts, by Sun Oct 25** (DECISIONS, Open): the audit confirmed 40 bugs in round 1, 18 in round 7's six lanes (one blocker, six major), 5 minors in round 8's two and 3 in round 9's two, on the least-touched systems, whose fixes are in. The values pass has started by default (In progress, recommended); or audit until a round finds nothing.
- [ ] **Many lines on the map, by Sun Nov 8** (DECISIONS, Open): a late game's 30 lines share 8 colours and nothing recolours one, and lines on the same streets hide each other. A click there now lists every line under it, each to open: the recommendation, in since [#148](https://github.com/bobbyjohn-nil/interbus/pull/148) as it stands until you answer. Since [#155](https://github.com/bobbyjohn-nil/interbus/pull/155) each line's name also runs along its route where it has room; where lines share a street one name shows, so the late game's opening view names 7 of its 18 lines. Left to choose: the palette and side-by-side drawing with the light style pass (recommended), or now as unscheduled look work.
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
- [x] **The late game's cash** ([#145](https://github.com/bobbyjohn-nil/interbus/pull/145); DECISIONS, Measured, 2026-10-22). `npm run bench lategame` plays a run and, on its first day with no event on, tries each stop's next tier, each bigger bus (at its headways, and less often) and each line a step more often for a day, then each kind's best together; `LATEGAME_SAVE` keeps the company it played for later runs.
  - The profit-only company (seed 1, day 202, 15 buses): $1.2 million and $4,182 a day more. Its buses never fill; what pays is Shelters, $408,000 back in 222 days, and two headway steps on spare buses, $355 a day.
  - The card-building company at the 30-bus ceiling (seeds 1 and 2, days 146 and 153): $47,000–50,000 a day more. Shelters pay, about $900,000 back in about 130 days; no bigger bus pays back in under 566 days; 10–11 of its 13–14 lines have no room to run more often; and freeing a bus place, by a bigger bus run less often, pays back in 926 days at best.

  The prices stay. The late game at the bus ceiling goes to the owner (Waiting on the owner).
- [x] **The contracts, the fare band and crowding** ([#146](https://github.com/bobbyjohn-nil/interbus/pull/146); DECISIONS, Measured, 2026-10-22; M5 spec, item 2's tunables). `PACING_CONTRACTS=off` plays the scripted player without contracts.
  - It never builds for a contract: on seed 1's profit-only run it took 69, 50 lapsed, 3 were still held, and the 16 its lines met paid $1,950,000, as much as all its fares and subsidy.
  - Without them both players meet the early targets on the same days (their first contracts pay on days 54 and 69). After that the profit-only player ends day 200 with 4 lines and $202,086 instead of 7 and $1.2 million, and the card-building player has no gold by day 200 (129.5 minutes) instead of gold on day 144 (103.2).
  - The fare band's 5% (one or two fares on the lines that earn) and crowding stay; full buses turn riders away only on Washington Street at a long headway, and at the 30-bus ceiling.

  **Next week's first question** (this week's five are asked; for the batch of Mon Oct 26, into DECISIONS' Open and Waiting on the owner): what a contract asks. (a) Keep the deck: an offer pays for service at its landmark, whether it was built for or ran already. (b) Deal only what a landmark lacks, so every contract asks for a change, at the same rewards. About a session or more: the deck's rule (what becomes of a card passed over, so that every six offers still hold each ask once, and of a landmark that meets every card left); I11 on a company that builds for its asks (its own takes only offers it meets, and would earn nothing); the fixture's second-line band, which rests on day 9's contract for service already running; and the gold and late-game measurements again. (c) Halve the rewards. Recommended: (b). GD-04 wants contracts as goals, and here every one that paid was for service already running; a player who builds for them still earns them. It would also move the card-building player's gold later than its 103 minutes, toward PLAN §3's 2–4 hours, so it bears on the medal ladder.
- [x] **The running costs and the city's money** ([#147](https://github.com/bobbyjohn-nil/interbus/pull/147); DECISIONS, Measured, 2026-10-22). `npm run bench lategame` now sums a company's ledger from founding.
  - Fares and the city's subsidy cover the running costs 1.5 times on the profit-only player's corridor lines (its fares alone 0.83 times), and 3 times on the card-building player's network, which reaches the dense neighbourhoods (fares alone 1.65–1.75).
  - Wages are 61–64% of the running costs, the cost a kilometre 26–30%.
  - Rewards, mostly contracts, are 37–54% of all a company takes in.

  The rates stay: the running costs', but for stop upkeep (D25), the fare, the subsidy and the card's payout are V1's. The contracts' rewards are V2's and go with the contracts' question.
- [ ] **Next: the values pass waits** on the owner's answers (the medal ladder, the late game at the bus ceiling, and next week's contracts question once asked) and on P1's notes. Until each comes, its recommendation stands (the autonomy protocol), so work goes on under Next.

Open from the audit:
- [ ] **Held for a save format:** the checklist coming back as "5/5 Take a contract" when a taken contract lapses needs a saved flag, so it waits to share one format change with any other finding that needs one.
- [ ] **Left open by #134 and #136:** across a chain of changes a parked bus may be home when a later change's departure needs it (47 departures in 2,500 chains), and the first change on a new day merges a line's kept versions again once, 104–176 ms.
- [ ] **For P0:** a save made before #134 while a line was settling shows Finance's Day forecast off on the day it loads (the next day agrees), so a playtest starts from a fresh game or a settled one.
- [ ] **Left open by #138 and #139:**
  - The floor count stays as it is. A file claiming five closes below the floor ends only its own run, and checking it means replaying the ledger's closes.
  - A Save here, Load or Delete within Saves' 2 s listing of another tab's write to that slot acts on the new save.
- [ ] **Low graphics' fps cap, read over once:** `e2e/gpu.spec.ts:51`'s readout read 47 fps against its cap of 31 on #150's push run, and passed on its re-run and in the other run. The cap holds the vehicle layer's frame requests (`gpu.ts` `frameDelayMs`); the likeliest other frames, not measured, are MapLibre's own: its 300 ms label fade (no `fadeDuration` is set) or a source updated as the sim posts. If it comes back, count which renders run in Low graphics; a `fadeDuration` of 0 there is the first fix to try.
- [ ] **The arrows after a press on a panel's text, read over locally:** `e2e/panels.spec.ts:280` failed in 3 of 7 local runs of four specs on two workers (this pull request's checks), and a copy of it in 1 of 3 runs on `main`'s source: the focus on the page, the pressed text still in place, the game paused and Contracts alone open, yet four ArrowDowns scrolled nothing. Alone it passed every run, with Low graphics forced too, and it has not failed on CI. If CI shows it, find which scroller Chrome's arrows reached before changing the test.

## Next

The spec is [`docs/specs/current.md`](specs/current.md) (M5, Prototype, by Sun Dec 20). No new sim system after Sun Dec 6. Look work stays at most one session in three until M3 is signed off.

- [ ] **The accessibility pass, ahead of week 14 under D25's clearance** (PLAN §8: proportionate; UX-08's final form, the checks inside the ordinary e2e scenes), in five steps:
  - [#150](https://github.com/bobbyjohn-nil/interbus/pull/150): the copy walk's 19 screens, Home to a day's close at 1280×800, hold every control at 24 px or more each way and the text at 12 px or more, and axe-core finds nothing on 14 of them (`e2e/a11y.ts`); `src/ui/textSize.test.ts` holds every font size in the style sheet at 12 px or more. axe-core costs about 2 s a screen on CI, so each step's scenes are chosen with the first quarter's room in mind.
  - [#152](https://github.com/bobbyjohn-nil/interbus/pull/152) and [#154](https://github.com/bobbyjohn-nil/interbus/pull/154): the focus handed on as a card's buttons go with it, each hand-off letting go at the player's next key or press; each line's card lists its stops, which open their cards, so the keyboard reaches a stop; the day card's rows a Tab stop while they scroll; reduced motion.
  - [#155](https://github.com/bobbyjohn-nil/interbus/pull/155), shape beside colour: each line's name along its route, jobs ringed where homes are filled, and a contract's figure for today saying "met now" or "not met now". `src/sim/config/lines.test.ts` is UX-08's palette ΔE as a unit test: 5.5 apart for normal vision, and no closer than today under each simulation of colour blindness, where the eight line colours fall as close as 2.0 apart in OKLab ×100. It holds today's palette until the light style pass redoes it; Okabe and Ito's eight stay 7.6 apart under all three simulations.
  - this pull request, the focus cases the reviews left open: a panel the keyboard opened hands the focus back to what opened it as its Close or Escape closes it, as a dialog does, after any card's own hand-off; one the mouse opened leaves it on the page, where Space plays. A stop's step up to the top its lines allow is refused with `aria-disabled`, so the focus stays on it beside the refusal in words. An undo that brings back a line Close it took, the line Lines still names, puts the focus on its tab, where its card replaced the one the focus was in.

  What is left is its keyboard shortcuts, which wait for week 14's Help.
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
- **The PR checks' 8 minutes:** CI runs six jobs side by side: "Typecheck, lint, tests", "Build and smoke", and the fixture e2e in quarters, "Fixture e2e, first quarter" to "last quarter". How it got there: it was all one job, which took 7.0 minutes, and once 8 min 5 s on a slower runner, whose fixture e2e took 5.5 minutes, so the 8-minute limit cancelled it after every step had passed (2026-10-14). Three Playwright workers instead of two saved only 8% here (3.4 against 3.7 minutes), since SwiftShader is bound by the CPU. The fixture e2e then took 5.6 to 7.5 minutes of its job's 8 (#105's two runs, one cancelled by the limit), so since the Build-menu fixes it runs in two halves on two runners, Playwright's shards 1/2 and 2/2: "Build, smoke and e2e" keeps its name and runs the first beside the builds and the smoke tests, and "Fixture e2e, second half" runs the rest, about 3 minutes of tests each. Since the second audit round (#118's first half took 6.7 minutes) it ran in thirds on three runners. Since Close line's tests (the first third took 8.0 and 8.3 minutes on #149, and the limit cancelled the second) it runs in quarters on four runners, shards 1/4 to 4/4. On #149 they ran 4.1, 2.7, 1.9 and 3.5 minutes of tests. The first ran beside the builds and the smoke tests, and with the accessibility floor's axe-core runs it took 4.4 minutes in a job of 7.3 (#150), 2.0 of them installing Chromium: apt fetched its fonts at 263 kB/s for 1 min 39 s (16 to 44 s in the other quarters' jobs). So since [#151](https://github.com/bobbyjohn-nil/interbus/pull/151) the builds and smoke tests have a runner of their own. On #152's runs apt took 3 to 8 min 44 s to fetch Chromium's 25.9 MB of fonts and libraries, once at 52 kB/s, and the limit cancelled three quarters before their tests began. So since [#153](https://github.com/bobbyjohn-nil/interbus/pull/153) the five browser jobs install Chromium through `.github/actions/chromium`, which keeps the packages apt downloads in the Actions cache. Each runner image keeps its own set, since its installed packages decide what apt fetches. An image with none yet starts from the newest set of another, then keeps its own; on #153's re-run, a set restored that way held only the fonts, and apt fetched the other 4.9 MB. A run reads only its own branch's caches and `main`'s, so the first runs after the merge fill them. A new e2e test that adds more than about a minute to the first quarter still needs a trim elsewhere, a fifth shard, or the nightly. If an install with the cache restored is still slower than 2.5 minutes, the next thing to try is installing without `--with-deps`: on #152's runs the only new packages apt installed were fonts and their tools; every library it named was on the runner already, eight of them upgraded.
- **Port 4173:** `vite preview` holds it for any Playwright run, so a second run at once fails. A long run (the heap test) blocks the others for its length.
