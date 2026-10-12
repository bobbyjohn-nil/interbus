# Lessons ledger: Intralines V1 → V2 → V3, for the final version (interbus)

This ledger is the evidence base for planning the final version of the bus-company tycoon in `bobbyjohn-nil/interbus`. Three earlier versions of the same game were built in August 2026, mostly by Claude at the owner's direction. The ledger records what they taught as lessons with stable IDs (GD-01, SC-05, EC-12 …) that plans, specs, commit messages and reviews in this repo can cite. Section 12 ranks the fifteen lessons that matter most.

Companion documents: [versions.md](versions.md) explains the names, repos and dates of the three versions; [salvage-matrix.md](salvage-matrix.md) compares them subsystem by subsystem, lists what to port and holds the known-bug register (K01–K58).

## How this ledger was produced

On 2026-10-12, in three steps:

1. **Ten readers.** Ten separate reviews each read one slice of one version (for example V1's simulation code, or V2's design specs) and wrote notes, called digests, with file and line citations. Entries cite a digest by its slice name, such as `v1-code-sim §failed-11` or `v3-code §6`. When a reader ran something (a build, a test suite, a small harness, a headless play session), it ran against a copy of the repo, never the repo itself.
2. **Synthesis.** The digests, a merged commit timeline of the three repos and spot checks against the repos (`git log`, `git show`, source reads) were combined into this ledger and the salvage matrix. Where the digests contradicted each other, §11 reconciles them.
3. **Adversarial verification.** A skeptic pass re-checked the 50 most load-bearing claims of the two documents (L01–L25 from this ledger, M01–M25 from the salvage matrix) against the repos, git history, GitHub Actions logs and fresh re-runs of the harnesses. 39 held as stated, 11 were partly true and are corrected in place, and none was refuted. The appendix lists each verdict and what it changed.

The digests, harnesses, logs and screenshots from the review were not committed. Where an entry names one (for example "review harness `econ.mjs`"), the name identifies the check so that it can be rebuilt as a committed test.

## How to read it

**Versions and refs.** Paths are relative to the repo root at the ref below unless an entry says otherwise. Elsewhere in this repo, cite them in full as `repo@ref:path`.
- **V1** "Intralines Bus Simulator" v0.1→v1.18: `Intralines@7af45b1` (branch `claude/city-bus-manager-game-rmdul2`), for example `Intralines@7af45b1:src/game/store.ts`. React/TS/Vite/MapLibre/Three/Electron, real US census cities.
- **V2** "Intralines City": `Intralines_City_dep@archive/intralines-city-v1` (tip `5e24bcb`). Plain JS + Canvas 2D, one offline HTML file, procedural cities, 11-agent crew. Paths are under `Gaming/` unless noted, so `30-sim.js:70-72` means `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js`, lines 70–72.
- **V3** "Intralines_City" build-from-spec rewrite: `Intralines_City@dc63602` (`main`), for example `Intralines_City@dc63602:src/game/economy/ledger.ts`. TS/React/three.js, 15-agent crew, `studio/DECISIONS.md` (cited as `#n`).
- A short commit hash such as `c1d73de` belongs to the repo of the version the entry is discussing.

**Evidence tags.**
- **review-measured**: a review harness measured it on 2026-10-12 against a copy of the repo. The repo itself did not produce that number, and the harness is not committed.
- **(verified)**: a skeptic re-checked the claim against the repo, git history, CI logs or a re-run harness, and it held.
- **(corrected)**: the skeptic found it partly true, and the text now uses the corrected wording.
- **(unverified)**: it could not be checked.
- Untagged claims were not in the verification set. The appendix maps each verdict ID (L01–L25, plus the salvage matrix's M-IDs where the same claim appears here) to the entries it changed.

**Polarity:** **KEEP** = do it again. **AVOID** = do not repeat. **CAUTION** = it can go either way, or depends on a condition that is stated.

**Format of every entry:** ID · polarity · versions — the lesson. *Evidence.* **→ Final:** what follows for interbus.

> **Timestamp correction, used throughout.** The review's merged commit timeline printed the owner's commits (author `bobbyjohn-nil`) in the owner's local time (−0400) and Claude's commits in UTC, so its rows mix timezones. Times in this ledger are UTC unless marked. Verified with `git log --format=%ci`: `f57983c` (Jekyll, the only human-authored commit among V1's 71; the other 70 are Claude's) is 13:04 −0400, which is 17:04 UTC (verified). `79cb89d` (V3 crew) is 20:37 UTC. `e1352f6` (V2 template) is 21:05 UTC. `841b176` (V3 reframe) is 05:37 UTC on Aug 12. `dc63602` is 04:54 UTC on Aug 20. Several digest statements depend on this; they are reconciled in §11.

---

## 1. Game design & fun

**GD-01 · CAUTION · V1 V2 V3 — The real core loop was small, and only V1 and V2 ever closed it.** The loop was: read where demand is → draw a street-snapped line between demand concentrations → put buses on it → set frequency and fare → watch daily money and a quarterly grade. Credit scores, Mk tiers, fuel, lobbying and company type all hung off this loop without changing it. V3 never closed the loop: income is hard-coded to zero, `kmDriven` is passed as 0, and the only cash inflow is the refund of a stop when it is undone or a draft is cancelled (verified; `ledger.ts:217`, `App.tsx:530`).
*V1 `docs/DESIGN.md` §3, `docs/MANUAL.md` §4; V2 `GAME.md` core loop ("pruning the stops that never earn"); V3 `src/game/economy/ledger.ts:217`.*
**→ Final:** the first milestone is this loop, end to end, with income, a goal and a failure state. Nothing else ships before it.

**GD-02 · KEEP · V2 — The decisions that actually mattered were about network shape.** V2 measured each of these:
- Share a stop where lines cross: +93% boardings and +$13,085/day over parallel lines.
- Upgrade before you duplicate: a $78k upgrade paid back in 15 days, against about $1.56M for a parallel line.
- Prune dead stops ("prune beats buy"): +1.6 standing *and* +$19k cash, against +1.8 standing for $95k.
- Aim one line at a HEADWAY tender: won 15 of 15 at 20 and 15 minutes.
- Put arterial lanes downtown, not at the rim: $623/day against $43/day.
- Cross the river: a crossing line earns $13k against $235/day for a one-bank line.

*`docs/design/transfer-boost.md`, `report-thresholds.md`, `contracts.md` "Which rung", `bus-lanes.md`; commit `84e95fb`.*
**→ Final:** build the loop around these five or six verbs, and make sure the map shows the payoff of each one.

**GD-03 · AVOID · V1 V2 — Dead-weight mechanics that the player cannot move.**
- The environment category is "a dead 5 points": an opener has 0.22% mode share against a 12% target, and the Volt-E only unlocks at 60k riders.
- `staff` scores about 100 for everyone, and the Staff page is "two counters that follow the bus count".
- Collector and local bus lanes never repay (1,411 days, or never).
- The agency's fare slider is mostly pinned at its cap, and tolerant lines have a flat-top fare curve (under $60/day across $2.75–$3.75).
- The marginal bus is "close to a straight loser": the optimum is 17–30 buses on a plan drawn for 52.
- V1 refurbishment never pays back through running costs (about 190 days; V3 #26).
- V1's required mechanic loses money on a one-bus fleet: a $260/day wage against the 40% maintenance surcharge it saves. Hiring one takes the starter line from +$2,810 to +$2,606/day (verified).

*V2 `report-thresholds.md` Failure modes, `company-type.md` §2 and §5, `screen-layout.md` §5.3, `bus-lanes.md`; V1 harness `econ.mjs` (v1-code-sim §failed-11).*
**→ Final:** every graded category, rung and slider needs a measured, non-degenerate optimum. Cut or fold anything without one: fold Staff into Fleet, auto-hire drivers, drop Environment.

**GD-04 · KEEP · V2 (gap found in V1) — A goal layer beyond "profit go up".** V2 named V1's gaps: the world is "static once generated", and the game "offers only 'profit go up'". V2 added two things:
- **Events:** at most one at a time, an 18%/day spawn chance and a 1-day warning.
- **Contracts:** 3 slots paying $60k–$240k. These became "the early game's real cash channel".

But tender income varied **$60k–$480k between seeds for comparable play**, which made it the most volatile money in the game.
*V2 `GAME.md` "What 'better than v1.18' means" §2–3; `contracts.md`; `company-type.md` Interactions.*
**→ Final:** keep events and contracts as the goal layer. Bound the variance between seeds with a test.

**GD-05 · KEEP · V1 V2 V3 — "Rules you can see": one predicate drives the sim, the money and the map.** Examples:
- V1 `isExpress` is shared by the sim, the ledger and the panel.
- V1's depot zoning tint *is* the rule. That fix came after "clicks well inside the green were refused and clicks outside it accepted".
- V2's filter "if a rule exists, the map draws it" was used to **cut** rules that could not be drawn: `SIM_TRANSFER_WALK_M` and the bus-purchase subsidy.
- V3 `isDepotSitable` and `MIN_STOPS_TO_CREATE_LINE` each drive both the check and the copy.

*V1 `src/game/constants.ts:427`, `38775a1`, `docs/DESIGN.md` §8; V2 `transfer-boost.md` §2, `government.md` Failure modes; V3 `DraftBar.tsx:26-28`.*
**→ Final:** house rule: no rule without a drawing, and no drawing without the shared predicate behind it.

**GD-06 · KEEP · V2 — Cut a mechanic that needs a second mechanic to explain it, and fix the model rather than add a rule.** The service-span fix removed an exploit, a proposed rule, a constant and a panel with one predicate. The option the brief favoured, declared span contraction, measured as the worst of the three (+302%). Also cut on this test: the coverage obligation, the mandate board, the `maxLines` bay cap and the Ctrl+S binding.
*V2 `service-span.md:1-14`, `company-type.md` "Rules considered and cut", `5b57b82`.*
**→ Final:** every proposed mechanic passes the "second mechanic" test in review before it is specced.

**GD-07 · CAUTION · V1 V2 V3 — What the owner asked for and reacted to.**
- **Requests (V2), from the BACKLOG (verified).** Round 2 (`776f41d`) is headed "Round 2 — everything outstanding, including both decisions previously left as deliberate trade-offs. Requested explicitly, scope change accepted." It was a blanket request to do everything outstanding. Its five items included reversing two earlier trade-offs, a widened fare band "so fare becomes a real per-line decision" and "Real cities. An opt-in pack format plus an OSM converter, procedural staying the default"; the other three were accessibility fixes. Round 3 (`5cb5856`, "requested directly") asked for nine depth features: bus lanes, dynamic traffic, night roads, regional rail, tourist destinations, transfer boost, government tab (lobbying), route editing and a bigger map. `10b6a91` queued a private-company-or-government-agency choice at founding, also "Requested directly".
- **Reactions, a few hours later (corrected).** `c1d73de` (03:39 UTC Aug 12; message "Two items in the player's own words") adds two BACKLOG items, but only one is a verbatim quote: *"break things up, make different pages for things, simplify, lighten it up, and clean up"*. The second item, "The map does not read as a city", is a heading and explanation in Claude's words ("Uniform grey lines on beige…"); the commit message attributes it to the player, but it is not quoted. The line *"make the game more like bobbyjohn-nil.github.io/Intralines/"* is not in `c1d73de`. It first appears 23 minutes later in the header of `screen-layout.md` (lines 3–4, `980759d`, 04:02 UTC), which also quotes the first line with "in general," in front.
- **V3 owner calls (verified).** A light map (#5, "Owner asked for a light map"); Boston, LA, Orange County and Houston as featured cities (#10, "Owner's choice, replacing the manual's Worcester / Des Moines / Madison", with an instruction to bake Boston first); the "Subway Builder: sleek and modern, but usable" feel target; and five supplied 3D bus models (`renderer-3d.md:275-288`), none of which is committed in any repo.
- **V1:** *"bugs out every time it updates"* (`scripts/retain-assets.mjs:5`, verified), and a complaint about the *number of demand types* (`d3cfdf4`).

The V2 commits name the speaker only as "the player"; this ledger assumes it is the owner. The pattern: the owner wants systemic depth and real-world texture, delivered on a calm, map-first, good-looking screen. The owner's reactions are about look, legibility and reliability, never about balance numbers. No version records the owner's notes on what was *fun*.
**→ Final:** deliver depth through the map, not through panels. Run scheduled playtests by the owner with a fixed question list ("what did you try to do, where did you get stuck, what was boring"). Treat look and feel reactions as top-priority signals.

**GD-08 · KEEP · V1 — The watchable miniature is part of the fun, and it is cheap.** Examples: kinematic buses with accel 1.1 and brake 1.3 m/s², pedestrians who board, headlights at dusk, the station diorama whose door slides open, the "engine start → tow the screen away" wipe, depot chatter on the splash. The V1 digests call these "the moments that make it a game rather than a spreadsheet", and the owner asked V2 to look like V1.
*V1 `src/ui/StationScene.tsx`, `src/ui/BusWipe.tsx`, `src/map/busLayer3d.ts:146-199`, `docs/img/station-view.jpg`.*
**→ Final:** budget one or two charm moments per milestone, each driven by sim events and never by render-loop state (see AR-04).

**GD-09 · AVOID · V1 V2 — Tedium in fleet and timetable allocation.** V2's bible named V1's "hand-tuning every timetable window". V2's fix was a schedule assistant, which costs 1.70–1.77 s per run on a 10-line network (verified) and which its own spec says is "better designed away". V3 #25 proposed "a line stores a target headway, not a bus count", but it was never implemented.
*V2 `GAME.md` departure 4, `schedule-assistant.md`; v2-code-sim §6; V3 #25 vs `src/App.tsx:60`.*
**→ Final:** the player sets a target headway per line. The game derives and shows the buses needed, and buying or hiring to cover it can be automatic.

**GD-10 · CAUTION · V1 V2 V3 — Pacing was never playtested.**
- All three versions run at 0.25 / 2 / 10 game-minutes per real second with 10-day quarters (4 a year). The clocks are linear in real time, with no overnight skip. One game day takes 96 real minutes at speed 1 and 2.4 minutes at top speed (10 game-min/s), and a quarter takes 24 real minutes at top speed (verified).
- Starting cash thrashed: V1 went 900k → 700k → 310k within about 15 minutes on Aug 4 (`1e39918` 14:12 UTC, `4296026` 14:27 UTC). V2 used 400k (`10-core.js:56`). V3 guessed 500k (`constants.ts:197`, TUNE); #9 flags it REVIEW because the manual gives no figure, and V3's copy of the manual indeed has none (verified).
- Inference from V1: after the setup about $53k is left (`docs/img/line-editor.jpg`), and the measured +$2,810/day (verified on HEAD) means roughly 15 game days, about 36 real minutes at top speed, before the second Sparrow. Nobody checked whether that felt right.

**→ Final:** write pacing targets (time to first profit, second line, first report card) and check them in a scripted run. Re-derive the speed ladder from those targets.

**GD-11 · KEEP · V2 — Cities designed with traps and measured first-line economics.**
- River cities funnel 84% of trips over two bridges.
- Radial cities push 98% of viable lines through the core.
- Every archetype has a viable first line within `START_CASH`, and its best 4-bus line costs more than `START_CASH`: "that gap is the middle game".

*V2 `84e95fb`; `src/20-city.js:112-142`.*
**→ Final:** for every shipped city, test "a viable first line exists within start cash" and "the best 4-bus line costs more than start cash" as invariants.

**GD-12 · AVOID · V2 — Asymmetric meta-modes and meta-meta layers.**
- `company-type.md` grew to 69.5 KB with three amendments. Both of its constants moved; at one point the agency was an "easy mode" at +11%; `AGENCY_SUBSIDY_MULT` never settled.
- Government lobbying stacks four layers: retainer → frozen standing → vote → lapse.
- Their one real value was as probes: they surfaced four pre-existing exploits.

*V2 `165ed12`, `83daa14`, `49ce659`, `d8e3d44`, `BACKLOG.md` Up next.*
**→ Final:** out of scope for v1.0. Revisit after launch.

**GD-13 · AVOID · V1 V2 V3 — The recurring exploit shape: a quantity paid or graded over a different window or object than the one the rider experiences.** Instances:

| Mismatch | Instances |
|---|---|
| Per trip vs per boarding | Line splitting (V1, V3) |
| Per day vs per hour | Service span, crowding, stop spill, headway contracts (V2) |
| Per stop vs per service | Coverage poles (V2) |
| Best hour vs worst hour | Headway reporting (V2) |
| Flat subsidy against a fare slider | Express max-fare (V1, V2, V3) |
| Fare-inelastic captives | Starve + max fare (V2) |
| First-N truncation (by line id in V2; nearest 4 stops in V1) | Hub lines boarding zero (V2); riders falling as lines are added (V1) |

Detailed mechanics are in EC-02…EC-07.
**→ Final:** three model invariants from day one:
1. Every rider-facing quantity is computed per hour the rider travels, and per linked trip.
2. Grading and payment read the city's service day.
3. No control has a dominant end-stop.

Enforce all three with a committed adversarial sweep (EC-12).

---

## 2. Scope & pacing

**SC-01 · CAUTION · V1 V2 V3 — Producing code was never the bottleneck; converging was.**
- **V1:** 24 changelog versions on 5 calendar days (UTC: Aug 3, 4, 5, 10 and 13; 6 days in the owner's −0400 time), with 70 of its 71 commits authored by Claude (verified). v1.5–v1.13 (nine versions) were all cut on Aug 5, and v1.18 alone is 24 bullets, 14 commits and 2 sessions.
- **V2:** 27,212 lines of game plus 11.7k lines of tools in about 32 hours (32.2 h from `e1352f6` to `5e24bcb`; 107 commits, 102 by Claude and 5 by bobbyjohn-nil; verified). `30-sim.js` grew from 2,458 to 5,706 lines between `346bb72` and `5b57b82`.
- **V3:** 36,576 lines in one squashed commit (187 files; verified).

*V1 `src/ui/changelog.ts`; V2 `wc -l`; V3 `git show --stat dc63602`.*
**→ Final:** the constraint is how often the owner can play and judge. Gate every milestone on a playable build that the owner has played.

**SC-02 · AVOID · V1 V2 V3 — Three rewrites in ten days, each started before the previous one settled.**
- V3's crew was set up Aug 10 at 20:37 UTC, 10 minutes before V1's manual (`840a661`, 20:47 UTC).
- V2's template followed at 21:05 UTC, and V1 kept committing until Aug 13.
- V3 was reframed as build-from-spec at 05:10–05:37 UTC Aug 12, in the same half hour as V2's "clean pause" (`5e24bcb`, 05:16 UTC).
- No document records why V1's source was dropped instead of refactored.

*`git log --format=%ci` on all three repos; v3-bible-decisions §key-decisions.*
**→ Final:** interbus is the last rewrite. Port proven code from V1, V2 and V3 instead of re-deriving it. Run no parallel rewrite tracks.

**SC-03 · CAUTION · V1 — What stopped V1.** No document records an explicit stop. The record shows:
- the deploy and update saga took about 14 of 71 commits;
- the demand display was redone about 8 times;
- the god-store grew;
- the rewrites were spun up in the middle of v1.18.

V2's "better than v1.18" list names the gameplay gaps: a static world, profit as the only goal, tedium, no per-stop feedback, no undo, no accessibility, and a 10–40 MB wait for real cities.
*v1-docs-history §6 "Why the rewrites began"; V2 `GAME.md:92-103`.*
**→ Final:** V1's *gameplay* was not the failure. Its infrastructure churn and its gaps were.

**SC-04 · CAUTION · V2 — What stopped V2.**
- The screen became illegible: 41.2% chrome and 271 standing words (verified).
- The accessibility gate blocked the layout fix the owner asked for: step 2 of the redesign (the chip row) was started and then reverted in the working tree over 29 focus-ring violations at 2.91:1 against a 3:1 bar (verified; there is no revert commit).
- The look diverged from V1.
- The economy never stabilised, because each new system exposed older defects.
- The crew was split off because "the crew is reusable and the game is not" (`f833589`), and V2 was paused.

**→ Final:** a screen-legibility budget and look parity with the reference are part of done (UX-01).

**SC-05 · CAUTION · V3 — What stopped V3.**
- There was no income after about 36k lines (verified).
- The Route B 3D pivot came in the middle of Milestone 2 ("Stopped mid-verification, deliberately", `studio/BACKLOG.md:24-27`).
- Bus visibility ate two sessions: seven passes and six causes in Canvas, then a whole session in 3D proving that a bus exists, which at the default framing changes 6 pixels of the frame (verified).
- Scope, deadline and the "Explicitly out" list were all TBD (`studio/GAME.md:388-389`).
- No commit lands in any of the three repos after `dc63602` (Aug 20) (verified).

**→ Final:** set the deadline and the Out list now. Ban presentation pivots inside a milestone.

**SC-06 · AVOID · V2 V3 — Specs outran the build by an order of magnitude.**
- **V2:** 22 specs, 346,122 bytes and 55,761 words, against 27,212 lines of JS. `screen-layout.md` alone is 9,907 words and was never built; its header says "Status: spec. Nothing here is built." (verified).
- **V3:** about 41k words of design in one day; 6 of 10 specs are spec-only or partial. The game-designer agent's own rule says "under 150 lines", and the specs run 179–579 lines.

*`git ls-tree -l` / `wc -w` on V2 `docs/design/`; V3 `.claude/agents/game-designer.md`.*
**→ Final:** write specs only for the next milestone and cap them at about 150 lines. Give the owner a one-screen summary of each.

**SC-07 · KEEP · V3 — Cut lines and build orders inside every spec.** Each V3 spec says what to drop at half the time and what must never be cut. They were never applied, because the deadline was TBD.
*v3-design-specs §"What worked".*
**→ Final:** apply each spec's cut line against the Jan–Feb 2027 publish date from day one.

**SC-08 · AVOID · V2 — Feature rounds that outpace tuning.** Round 3 shipped nine features in about 6 hours. A whole round then went to the exploits they exposed, with eight checkpoint commits along the way. Company type exposed starve-and-charge and pole coverage, which exposed the service span, which exposed crowding and spill.
*V2 `5cb5856`; `916a5bd` → `5b57b82` → `4447883`.*
**→ Final:** schedule tuning freezes in which no new system lands while balance bands are being set.

**SC-09 · AVOID · V3 — Modules that look finished but are never wired in, and a presentation pivot while the loop is open.** `ui/DepotPanel.tsx` and `game/depots/deadhead.ts` (with tests) have no importer outside tests (verified). The error bus has no UI sink. The model pipeline has processed zero models (verified). The depot tool charges $150k and draws nothing (verified).
*v3-code §6; `App.tsx:864-868`.*
**→ Final:** a module counts as done only when the shipped app uses it and an end-to-end test exercises it.

**SC-10 · CAUTION · V1 — Schema and calendar thrash.**
- The calendar went from weeks to 16-day quarters (`c9586e9`, 19:08) to 10-day quarters (`f9477eb`, 20:53) on the same day, and comments still say 16 (`store.ts:969`, `types.ts:284`).
- The loan model changed from $16k/week to $2.3k/day.
- `PACK_FORMAT_VERSION` went 1 → 9.

**→ Final:** decide the calendar, the save schema and the pack format in the first week, behind a balance harness.

**SC-11 · CAUTION · all — The calendar ahead is short but sufficient.** From today (Oct 12) to the end of the prototype window (Dec 31) is about 11.5 weeks, and to the publish window (Jan–Feb 2027) about 12–20 weeks (arithmetic corrected). V1 built a fuller feature set than V3 on 5 calendar days. No repo has seen a commit in the 53 days (about 7.6 weeks) since Aug 20 (verified).
**→ Final:** the risk is convergence and polish, not velocity. Plan cut lines, playtests and freezes, not more features.

---

## 3. Process: working with Claude and multi-agent crews

**PR-01 · KEEP · V2 V3 — Verify by running, not by reading.** V2's devlog: "Reading found nothing. Running found everything." Exploit fixes were closed with measured before/after numbers. Tests were proven to bite by reintroducing the bug. A missing check was printed as NOT RUN, never as a fake pass.
*V2 `docs/devlog/0.1.0-first-build.md:11`, `0d9f55b`, `7137df8`, `a942adb`, `build.js:20-46`.*
**→ Final:** every claimed fix carries a measured before/after and a test that fails without it.

**PR-02 · KEEP · V3 — Before/after arithmetic for every economy change, then a sweep to confirm it.** Arithmetic caught real problems:
- an inert fare fix that would have made the line-split exploit +117% (#49);
- the missing return trip, caught by estimating 42,000 × 0.49 × 2 ≈ 41k trips/day (#64).

Arithmetic alone also misled, which is why a sweep must confirm it:
- V2's hand-derived fare peaks ($4.61 and $3.83) were off by about $2;
- V3 missed that its own formulas make express max out the fare (EC-05).

*V3 `studio/DECISIONS.md` #49, #64; V2 `60f8a22`; review harness `fare-check.mjs`.*
**→ Final:** use arithmetic to find problems, and a committed sweep to confirm them.

**PR-03 · KEEP (with a fix) · V3 — A numbered decision log, with owner answers.** V3's format records what was decided, why, and how to reverse it, with ⚠︎ REVIEW flags. It is the only record of V3's reasoning that survived the squash. But 7 REVIEW items (#8, #9, #16, #29, #45, #53, #65) never got an owner answer.
**→ Final:** keep the log. Batch the REVIEW items into a short question list for the owner every week.

**PR-04 · AVOID · V2 V3 — Big, generic crews.**
- V3 ran 15 agents from a generic "The True Gamer" template that talks about hitstop, screenshake, waves and audio buses. About 3 of them had no job in a transit tycoon.
- V2 ran 11 agents, and 5 of them (modeler, ui-designer, animator, game-designer, devlog-writer) had no Bash. They "could not run what they wrote", which is why the fare numbers were derived algebraically and came out wrong.

*V3 `79cb89d`, `.claude/agents/animator.md`; V2 `e3452e8`.*
**→ Final:** a small crew (designer, coder, playtester, writer, others on demand), every agent with a shell, and roles written for this genre.

**PR-05 · AVOID · V2 V3 — Prose bloat the owner cannot read.**
- V2's commit messages average about 1.35 KB each (22k words in total).
- V3's crew markdown totals about 366 KB, roughly one byte of prose for every byte of shipping TypeScript.
- Comment density: V3 `src/` 32%, V2 `40-render.js` 44%.

The owner's feedback was about simplicity, not correctness, and the owner very likely did not read this prose.
*v2-bible-history-process §9; v3-bible-decisions §Inventory; v3-code §2; v2-code-ui §2.*
**→ Final:** keep comments short and put rationale in the decision log. Every milestone ends with a one-page summary written for the owner.

**PR-06 · AVOID · V1 V2 V3 — Living docs that go stale.**
- **V1:** the README still describes the v0.1 emoji UI and "Buses ignore … traffic". MANUAL §5 calls a top-bar chip "Drivers" when it shows riders served, and §15 claims refuel trips that `src/map` does not draw.
- **V2:** `CHANGELOG.md` and `GAME.md` went untouched for the last 9.5 hours, and five finished pieces of work owe changelog entries.
- **V3:** `GAME.md:393` still says "Nothing is built yet". Finished BACKLOG items are still open. #25 is logged as done while `App.tsx:60` contradicts it. The skill file itself says "a stale backlog is worse than none" (`SKILL.md:139`).

**→ Final:** update a doc in the same commit as the code it describes, generate it, or delete it.

**PR-07 · AVOID · V1 V2 V3 — Work lost to uncommitted session files and squashes.**
- **V1:** the Playwright suites (play-flow, save-compat, stale-page, update, worker) lived in a Claude session's temporary working folder and are gone (`CLAUDE.md:15-18`).
- **V2:** the chip-row work-in-progress diff (`BACKLOG.md:41`; verified) and the balance harnesses (`fare-sweep2.js`, `derive.js`, `packs/measure.js`) were never committed.
- **V3:** `main` is a parentless squash (`dc63602`, 187 files, 36,576 insertions). The six hashes cited in its docs (`c489047`, `360a823`, `f06ce54`, `0e4740e`, `6c6d1c7`, `ef96f74`) resolve in none of the three repos, and #71 mentions about 24 local commits (verified). What was lost is the code-building history, not every commit: a separate branch, `origin/claude/gamedev-orchestrator-improve-mhs8ug`, keeps 8 earlier crew and spec commits from Aug 10–12 (corrected).

**→ Final:** push small commits to the remote often, keep nothing that matters in uncommitted session files, never squash history the docs cite, and keep work in progress on a branch.

**PR-08 · AVOID · V1 — Parallel sessions on one branch.** Two Claude sessions (Fable 5 and Opus 5) both cut "v1.18" (`fe14a93`, `d66e6dc`). One commit message describes code that is not in its diff, the changelog had to be deduplicated (`71f4a2c`), and a doomed run cancelled the real deploy: "71f4a2c and d66e6dc both went out and neither shipped" (`6c3687c`).
**→ Final:** one session owns `main` and deploys at any time. Parallel work goes on separate branches and is merged serially.

**PR-09 · AVOID · V2 — Checkpoint commits made in the middle of other agents' edits.** V2 has 10 "Checkpoint… in flight" commits plus 3 "work in progress" commits (verified by `git log` grep). From `1ae9058`: "several agents' finished work is buried inside commits describing something else, because a clean-tree hook fires between their edits and their reports."
**→ Final:** commit finished, reported units only. Do not use a clean-tree hook that forces checkpoints.

**PR-10 · AVOID · V3 — Per-agent file ownership against shared contracts.**
- Only 39 of 376 UPPER_CASE constants live in `game/constants.ts`.
- There are four `geo.ts` files, and `DepotId` is defined twice.
- A 400 m constant was nearly reused where the rule says 120 m (#63).
- The constants file caused a merge conflict (#58).
- Agent worktrees doubled the test suite, so "every 'the full suite passes' report during that window was partly fiction" (#56).

*v3-code §5.2.*
**→ Final:** one owner for each shared contract (types, constants, save schema), and agent worktrees excluded from test discovery.

**PR-11 · AVOID · V1 V3 — Misreading the request.**
- **V1:** "pockets" were built and then reverted 26 minutes later: "answered a question that had not been asked — the complaint was the number of demand *types*, not the number of dots" (`c141281` → `d3cfdf4`).
- **V3 #59:** "I mistook the root cause for a cosmetic complaint, three times."

**→ Final:** before building, restate the complaint and the question the change answers, in one sentence, and confirm it with the owner.

**PR-12 · KEEP · V2 — Serve the intent of a request, and say so.** The owner asked for a "transfer boost". Measurement showed connecting already pays (+93%), so no bonus was added. The crew built a per-tier transfer-penalty ladder and a 250 m stop snap instead, and explained why.
*V2 `transfer-boost.md`, `2c1598e`, `3d05ff6`.*
**→ Final:** measure first, then propose the change that serves the intent, with the number that justifies it.

**PR-13 · KEEP · V3 — "Never test a moving target."** Pin a playtest to a commit or worktree. The protocol came from two corrupted playtests.
*V3 `.claude/agents/playtester.md` ("Never test a moving target"); #56 (exclude agent worktrees from test discovery).*
**→ Final:** playtests and benchmarks always record the commit they ran on.

**PR-14 · KEEP · V1 — Commit messages that explain why, with numbers from the sim.** Examples: `38775a1`, `9ea15e5`, `439fb6c`, `4296026`. They are V1's best design record. V2 took this to an excess of about 1.35 KB per message.
**→ Final:** V1's style, at V1's length.

**PR-15 · CAUTION · V1 — Versioning conventions that are not enforced drift.** The rule was "one changelog version per session", but v1.5–v1.14 are all dated Aug 5 even though v1.14's commit `505720d` is from Aug 10. v1.15 says the Skyline "unlocks at 40,000 daily riders", while the code counts cumulative riders served.
**→ Final:** generate the version and date from git at build time.

---

## 4. Architecture & code

**AR-01 · AVOID · V1 — A god-store and a god-panel file.**
- `store.ts` is 1,905 lines and was touched by 34 of 71 commits. It mixes UI flags, rules, player-facing copy, persistence and sim dispatch.
- "A stop costs $4k" is written inline in three separate paths.
- `Panels.tsx` is 1,640 lines (60 KB) and holds 11 panels.
- Both the wear bug and the reliability bug are "a refactor in one place, a stale copy of the rule in the store".

*v1-code-sim §failed-6; `store.ts:1145,1172,1329`.*
**→ Final:** a sim core with no UI strings, separate rules and economy modules, editor commands, persistence, and UI state.

**AR-02 · AVOID · V2 — Huge plain-JS files on a global namespace.**
- `30-sim.js` is 5,706 lines (283 KB), `50-ui.js` 7,947 lines (407 KB) and `60-main.js` 4,777 lines.
- Cross-layer contracts are checked by regex over the source text: "an apostrophe inside one swallowed four rows" (`57dcdc0`).
- Panel reactivity depends on signature strings maintained by hand (`50-ui.js:1359-1374`).

**→ Final:** typed modules and a reactive store. Types replace the regex contracts.

**AR-03 · KEEP · V3 — Pure, typed, allocation-aware sim modules.**
- Strict TypeScript with `noUncheckedIndexedAccess`, and branded ids.
- An integer-cent ledger with sub-cent carry: drift after 10,000 ticks is exactly zero (29 tests).
- Pathfinding over typed arrays with a reusable context.
- Bus position as a pure function of the clock.

*V3 `src/game/economy/ledger.ts`, `buses/position.ts`, `lines/pathfind.ts`; 259 node tests pass (verified).*
**→ Final:** port these modules nearly verbatim.

**AR-04 · AVOID · V1 — Sim truth living in the renderer.**
- AADT, class-based congestion and "ridership relieves traffic" exist only in the presentation layer: `MapView.tsx:480-530` (sampled about every 250 m), `busLayer3d.ts:383-389`, the traffic-forecast overlay and the TopBar readout. They pace the animated buses, while the worker sees only the citywide hourly `trafficFactor(h)` (`demand.worker.ts:251`), and the network message sent to it carries no corridor gain. Ridership feeds congestion, but congestion never feeds ridership. **The whole AADT pipeline has no gameplay effect** (verified), although `changelog.ts:91` tells players "your running times all use the new model".
- "Served" is detected when a rendered frame finds a bus within 25 m of a stop (`busLayer3d.ts:682-690`), and that drives the waiting counts and the diorama.
- The cycle-time formula exists three times and the copies disagree (`busLayer3d.ts:366`, `demand.worker.ts:209-219`, `Panels.tsx:43-59`). The visual cycle does include the 20 s dwell at intermediate stops, but it omits what the worker bills: the per-stop buffer, the extra terminal dwell (2 × `DWELL_SEC`) and amortised refuel time. So the buses you watch run a shorter cycle than the one the economy charges for (corrected).
- The relief formula is copied three times.
- The station view reads the debug global `window.__busLayer`.

**→ Final:** the sim publishes vehicle and stop state, and the renderer only interpolates it. Every game-visible quantity has one formula, and it lives in the sim.

**AR-05 · KEEP · V3 — The renderer is never load-bearing for the sim.** A model that fails to load changes what you can see and nothing else: no number, no save, no report card.
*V3 `studio/GAME.md` "Imported 3D models".*
**→ Final:** test it by running the sim headless with the renderer stubbed out.

**AR-06 · KEEP · V1 V2 V3 — Determinism as a tested invariant.**
- V1's worker produced identical JSON for identical input (review harness, 2026-10-12).
- V2's sim is pure in (state, seed), with no `Math.random` or `Date`. Running 4,320 game-minutes "in one call and in 72 chunks produces an identical state hash" (`6cf8bf8`).
- V2 compares the **full serialized save**, not a hash, because the hash excluded totals (`acb4744`).
- V3 has determinism integration tests (`integration.test.ts:95-170`).

**→ Final:** seeded RNG only, plus a cold-context replay test that compares full saves byte for byte.

**AR-07 · KEEP V1 / AVOID V2 V3 — Run the sim off the main thread.**
- **V1:** a Web Worker (`store.ts:171`), debounced 250 ms, with request ids so stale replies are dropped. Recompute takes about 32–83 ms at n = 481 on synthetic 1–30-line networks, off the main thread (verified).
- **V2:** synchronous on the main thread: `recompute()` (`60-main.js:3450`) is called inline from `dispatch`, with no worker or idle deferral. On a 10-line, 116-stop, 50-bus network a warm recompute takes about 65–100 ms, an edit 137–148 ms and the assistant 1.70–1.77 s (verified), and a lane-quote hover 77–108 ms (review-measured), against V2's own 25 ms stop-click budget (`bigger-map.md:110`). Its "1.5–4.5 ms" claim came from toy networks. The V1 and V2 benchmarks use different networks, so they are not a like-for-like comparison.
- **V3:** main thread via `setTimeout`, even though its stack table claims a Worker.

*V1 `store.ts:573-662`; V2 `60-main.js:3450`, review harness `warm.js`; V3 `studio/BACKLOG.md` "The sim is not in a worker".*
**→ Final:** a worker from day one, benchmarked on a realistic mid-game network.

**AR-08 · AVOID · V3 — A game loop that runs through React state.** `useGameClock` calls `setClock` on every animation frame, so the 901-line `App` re-renders every frame. The 3 s autosave debounce therefore resets every frame, and only the 10 s floor ever fires.
*V3 `src/game/clock/useGameClock.ts`; `App.tsx:621-623`.*
**→ Final:** a fixed-step sim that publishes snapshots to the UI at a lower rate.

**AR-09 · KEEP · V2 — A fixed-step loop with one `simStep` entry point and an `advance()` test hook.** Constants: `TICK_STEP_MIN 0.5`, `MAX_STEPS_PER_FRAME 40`, `MAX_ACCUM_MIN 20`, `UI_REFRESH_MS 120`, plus a guard against tab backgrounding.
*V2 `src/60-main.js:158-165, 4271-4305, 4741-4757`.*
**→ Final:** adopt this loop shape.

**AR-10 · CAUTION · V1 V2 V3 — Constants discipline failed three different ways.**
- **V1:** one `constants.ts` (458 lines, each value with a rationale comment) mostly held, but rules leaked inline into the store.
- **V2:** `IL.C` was merged from five files (257 top-level keys and 1,143 leaf values). UI `tune()` fallbacks duplicate sim values, `defineDefaults` says "the earlier author must win", and the generator has bare literals.
- **V3:** only 39 of 376 constants live in `constants.ts`.

Reconciled in X-10.
**→ Final:** one config registry made of per-domain modules, SPEC/TUNE tags on every value, a lint that bans bare numeric literals in sim code, and a single owner.

**AR-11 · KEEP · V3 — Share a constant only when the rule is shared, not just the name.** `DEPOT_MIN_SEPARATION_M` (400 m) spaces zones apart; `DEPOT_PLACEMENT_MIN_SEPARATION_M` (120 m) is the placement rule (#63).
**→ Final:** a code-review checklist item.

**AR-12 · KEEP · V2 — One number, one source.** `lineEconomics` is shared by the Lines panel, the assistant and stop analytics; before that, the panels disagreed by up to 25% (`346bb72`). Line totals must equal the sum of the stop rows. V1's DraftBar and DraftPanel disagree on stop cost (`DraftBar.tsx:51` vs `Panels.tsx:854-856`).
**→ Final:** every displayed number comes from one helper, with a reconciliation test.

**AR-13 · KEEP · V2 — Every action returns `{ok, reason}` inside a transaction that rolls back on refusal.**
*V2 `60-main.js:353-354, 3371-3448`.*
**→ Final:** an editor command layer of this shape, which is also the hook for undo (UX-09).

**AR-14 · KEEP · V2 — Identity settings and mean normalisation for every new model term.**
- With a new term switched off, the sim must stay bit-identical: "2,320 comparisons … zero differences" (`916a5bd`).
- New spatial terms are normalised so the citywide mean stays exactly 1.0. Normalising by bisection was needed, because the naive divide-by-mean landed at 0.937–0.975 after clamping, "a silent 5% citywide speed-up" (`38ef2f6`).

**→ Final:** no model term merges without its identity test.

**AR-15 · CAUTION · V1 V2 V3 — Scaling cliffs nobody planned for.**
- **V1:** the worker holds three n×n Float32 matrices: 2.8 MB at n = 481 and 44 MB at n = 1,924, which would be about 190 MB at 4,000.
- **V2:** A* costs 30 ms per route at 31k nodes, hence the 16,000-node pack cap.
- **V3:** demand is brute force, O(Z·L·P²), with fixed buffers of 200 stops and 40 lines that silently stop updating when exceeded (`App.tsx:75-76, 482-490`).

**→ Final:** benchmark worst-case cities in CI, and make every capacity limit loud.

**AR-16 · KEEP · V2 — Measured performance engineering.**
- Cache route geometry per line: one edit went from 18.2 to 6.8 ms and from 180 to 9 route calls (`57dcdc0`).
- Hour classes run the option search once per distinct line set instead of 24 times.
- A* runs over CSR adjacency with generation-stamped scratch arrays.
- Building paths are batched in groups of 64: 65.8 ms → 2.2 ms (`cb71cbe`).

**→ Final:** reuse these techniques.

**AR-17 · CAUTION · V2 — "Guarded" numeric helpers create bugs of their own.** `num(x, NaN)` returns 0, "so isFinite(num(x, NaN)) is always true" (`57dcdc0`).
**→ Final:** rely on types and explicit validation at boundaries, not silent coercion.

**AR-18 · AVOID · V1 V3 — Single huge bundles with the size warning silenced.** V1 ships one 1,755 kB main chunk (493 kB gzip) plus a 10.3 kB worker chunk, with `chunkSizeWarningLimit` raised to 2000 (`vite.config.ts:234`). V3 ships one 811 kB app chunk (226 kB gzip) plus a 5.7 kB workbox-window chunk. V2's single file is 1,333,034 B (388,736 B gzip, which `build.js` prints as "379.6 KB", meaning KiB). All three verified by rebuilding.
**→ Final:** code-split the renderer and the cities, and set a bundle budget in CI.

---

## 5. Simulation & economy model

**EC-01 · KEEP · V1 V2 V3 — The demand model's shape was right and stable across all three versions.**
- Production-constrained gravity: population × workforce rate (0.46–0.52) distributed to jobs by e^(−d/β), with β 3.2–5 km.
- A binary logit against the car: share = 0.92 / (1 + e^((bus − car)/9)), with 13% captive riders, and car time = d/speed × 60 × 1.3 + 10.
- Crowding shed: (1/load)^0.65.
- An analytic steady-state daily equilibrium. Riders on the map are presentation only.

The constants are identical in V1, V2 and V3. The weak points were the caps and the time resolution, not the shape.
*V1 `demand.worker.ts:151-173, 486-499, 590`; V2 `10-core.js:129-144`; V3 `src/game/demand/constants.ts`.*
**→ Final:** keep the shape and port the constants. Fix EC-02…EC-07.

**EC-02 · AVOID · V1 V2 — Catchment and line caps that make ridership fall when you add service.**
- **V1** keeps only the 4 nearest stops per block group (`demand.worker.ts:323`) and considers at most `LINES_LIMIT = 3` lines per stop (`:413`). On Riverton with a synthetic network, riders went 9,443 → 8,087 → 6,537 as the bench went from 5 to 15 to 30 lines (12, 15 and 20 stops per line), against 9,605 → 10,997 → 10,192 with the stop cap widened to 400 (corrected). **The 4-stop cap causes the entire decline.** Raising `LINES_LIMIT` alone changed nothing, because every synthetic stop serves exactly one line, so this bench says nothing about the line cap. The 15 → 30 dip with the wide cap is a bench artefact, because lines also lengthen from 15 to 20 stops. On pure superset networks (15 stops per line; 5/15/30/45 lines) stock V1 gives 9,093 / 8,087 / 7,362 / 8,311 riders, so adding lines loses riders, while the widened cap gives 9,276 / 10,997 / 11,239 / 12,938, which is monotonic (verified). Caveat: the bench network is artificial (at 30 lines, 600 stops share 379 points), so the drop is exaggerated relative to real play, and the effect at real-city densities is unmeasured.
- **V2** inherited V1's 3-line cap, sorted by line **ID** (`MAX_LINES_SCANNED_PER_STOP: 3`, `10-core.js:111`; `30-sim.js:2044-2047`), plus 2 stops per zone. Yet the Transfer Hub tier requires 5 lines (`10-core.js:96`). Hub boardings by line were 1,621 / 1,210 / 713 / **0 / 0**, while lines 3 and 4 still had 132 and 170 alightings there. Raising the cap to 10 gives lines 3 and 4 554 and 810 boardings, so the cap is the cause (verified). No test or doc mentions the cap.
- Assignment is all-or-nothing to a single best path, with at most one transfer.

**→ Final:** invariant test: adding service never loses riders. No truncation by ID; if a cap is needed, rank by relevance and measure its effect on a realistic network as well as a synthetic one, because the synthetic bench's co-located stops exaggerate the effect.

**EC-03 · AVOID · V2 — Quantities computed over a whole day but graded or paid per hour.**
- Ridership ignored service hours: a 20:00–22:00 line carried 11,061 riders against 8,332 for 06:00–22:00, on an eighth of the wages. The crew's adversarial sweep found a one-hour 00:00–01:00 span at **+461%** net; that figure is the crew's own, from `5b57b82`'s message. Re-running a single-line review harness on the pre-fix source shows the same exploit at a smaller size on that line: the 00–01 span earns $10,220/day on 2,712 boardings against $4,100/day on 1,851 for 06–22, which is +149% (verified).
- Span-blind tenders let two-hour lines win $540–690k against $270k.
- Headway was reported from the line's best hour, while headway contracts read the whole day.
- `crowdFactor` takes one line's worst hour and applies it all day (still open).
- Stop spill compares daily boardings to kerb capacity; a midday-only span still paid about +20% (still open).

*V2 `service-span.md`, `5b57b82`, `4447883`, `BACKLOG.md` Up next. After the fix (riders board only in hours the line runs), a 00–01 span loses $169/day on 13 boardings (verified; review harness `sweep.js`).*
**→ Final:** hour-resolved assignment, crowding and spill from day one. Contracts and the report card read the city's service day.

**EC-04 · AVOID · V1 V3 — Fare perceived once per trip but charged per boarding.**
- V1 adds only the deviation from the reference fare per leg ((fare − 2.25)/0.18 min; `demand.worker.ts:339-345`), credits a transfer rider as a boarding on both lines (`:503-504`), and books revenue as boardings × (fare + subsidy) (`store.ts:899`). So V1 had the line-split exploit. Measured directly on V1's real worker at $2.25, splitting a 12-stop corridor raised revenue by **+8% to +28% at a plain stop and +29% to +62% at a hub** across four corridors (corrected).
- The often-quoted **+38% / +69%** is V3's stylised marginal-pair arithmetic for V3's pre-amendment spec (fare perceived once per trip), not a V1 measurement. V3's fix charges the full fare on later boardings, which turns that stylised table to −22% / −9% (#38, #49). The review harness `fare-check.mjs` reproduces 2041/2825/3441/1586/1867 per 1k trips, but it plugs in the spec's own delta values and logit, so it checks the arithmetic, not an independent model (verified).
- The first proposed fix was "arithmetically inert" and would have made the exploit +117% (#49).
- Related: take crowding as the minimum over legs, applied once (#50); count unlocks by linked trips (#51).
- A residual low-fare split exploit remains: +29% at $1.25 and +41% at $1.00 (#53, REVIEW).

*V3 `studio/docs/design/demand-model.md` §3.1; review harness `fare-check.mjs`; the V1 split measurement, verifier harness `v1bench/split.mjs`.*
**→ Final:** a per-boarding fare term and transfers in the first playable build. Keep linked trips and boardings as separate counters that cannot be confused.

**EC-05 · AVOID · V1 V2 V3 — A flat subsidy plus a fare-tolerance bonus makes express lines max the fare.**
- **V2 measured it:** express profit was "monotonic to the cap, argmax exactly $5.00". The fix tapers the subsidy quadratically from $2.25 down to zero at $5.00, which moved the express argmax to $2.75 (`f29aab5`, Aug 10). The taper is still in the archive head (`30-sim.js:70-72`, `FARE_SUBSIDY_TAPER_EXPONENT 2`) (verified).
- **V3's own formulas** peak at $4.75–$5.00 on a stylised marginal O-D pair: $2.465 of revenue per rider at $2.25 against $2.737 at $5.00 (peak $2.739 at $4.75), and $3.177 at $5.00 with the ×0.85 on-board bonus modelled (verified; one pair and revenue only, not profit). V3's spec has no taper; it defers to a possible per-linked-trip subsidy.
- **V1** uses the same constants (×1.5 subsidy, 0.5 fare tolerance). This is unmeasured in V1 but almost certainly present.
- V1's express thresholds are also easy to hit (≥5 km, ≥1,200 m spacing, ≥3 stops; `constants.ts:398-412`): a naive 5-stop, 5.3 km starter line already qualifies, at +$3,167/day on 957 riders (verified).

**→ Final:** principle: no slider has a dominant end-stop, verified by a sweep. Pick V2's taper or a subsidy per linked trip, and tune the express thresholds against the first-line target.

**EC-06 · AVOID · V2 — Starve-and-charge, and riders who ignore the fare.**
- Two wait-model clamps hid each other: a starved network earned **$18,045/day against $1,936** for a served one.
- The fix was a schedule-aware wait share that decays with headway, plus convex wait pain (`916a5bd`).
- A residual remains: captive riders ignore the fare, so 1 bus at $5 still earns $3,312/day, 76% of the optimum ($4,356 with 4 buses at $4). Boardings barely move: 817 at $2.25 against 814 at $5.

*Review harness `sweep.js`; V2 `30-sim.js:2667-2688`.*
**→ Final:** captive riders get a fare ceiling. The adversarial sweep (EC-12) covers starved lines at max fare.

**EC-07 · AVOID · V2 — Coverage that counted poles, not service.** Eight orphan $4k poles "turn a one-off $32,000 into $7,847 every quarter forever while LOWERING ridership". Before the fix, "closing three of eight lines moves it 83.0 to 83.0". The fix: coverage = the best-served access stop × (calls/day ÷ 64)^0.75, drawn as a hatched overlay.
*V2 `916a5bd`, `30-sim.js:3853-3912`, `e96d7bc`.*
**→ Final:** grade coverage by service from the start, and draw it.

**EC-08 · KEEP · V1 V2 — A wait model that makes frequency and reliability pay.**
- **V1:** 70% "timed" riders wait only for lateness (2 min + delay); 30% wait headway/2; capped at 15 min.
- **V2:** the schedule-aware share decays with headway (reference 12 min), and wait pain is convex above 10 min (exponent 1.5).

*V1 `demand.worker.ts:248-265`; V2 `30-sim.js:296-319`.*
**→ Final:** port V2's version with its identity settings.

**EC-09 · KEEP · V2 — Fare as a per-line decision.** Sensitivity scales with ride length, (3 km / ride)^1.5 clamped to [0.15, 1.6], and with trip purpose (visitors ×2.0). This gives six distinct optima from $1.75 to $3.25. A "Who rides this line" card prints a fare band, not a single argmax. The owner asked for exactly this in round 2 ("fare becomes a real per-line decision").
*V2 `30-sim.js:94-104`, `c90223b`, `776f41d`.*
**→ Final:** per-line fares, not company-wide (X-12).

**EC-10 · KEEP · V2 — Transfers that reward network building without a star-hub exploit.**
- Transfer penalty per stop tier: 6 / 6 / 5 / 3.5 / 2 minutes.
- `STOP_SNAP_EXISTING_M` 250: placing a stop near an existing one selects that stop.
- No bonus that scales with the number of lines. Measured: 4 + 2 interchanges beat 6 lines through one hub.
- The fix also made the $90k Interchange tier, which used to do nothing, worth about $423/day.

*V2 `10-core.js:91-108`, `30-sim.js:3016-3027`, `2c1598e`.*
**→ Final:** adopt the ladder and the snap.

**EC-11 · AVOID · V1 V2 — Balance that drifts silently.**
- V1 `4296026` claimed the starter setup nets about +$1,000/day, and a 5-stop version about +$490/day. On today's code a 9-stop, 5.4 km line with one Sparrow, one driver and a level-1 depot carries 1,058 riders/day and nets **+$2,810/day** ($4,075 revenue against $715 line cost and $550 fixed costs), and one game day of `tick()` gives the same cash delta (verified; review harness `econ.mjs`). That line also reports a peak load factor of 1.93 on its one bus. Visitors and the express subsidy were added later and never rebalanced.
- V2's balance figures come from uncommitted scripts, and the playtest's "balance invariants" section only checks static `IL.C` values.

**→ Final:** commit a scenario harness with regression bands (first-line net/day, payback days, opening report-card score) and run it in CI.

**EC-12 · KEEP · V2 — A standing adversarial optimiser.** Coordinate ascent over the player's whole strategy set (fleet, fare, off-peak buses, span). Assert that the objective it returns equals a fresh recompute: the optimiser had its own bug.
*V2 `company-type.md` "The balance table" and its last Done items.*
**→ Final:** a CI job that fails if any strategy beats its band.

**EC-13 · KEEP · V3 — Dead-heading costs money, time and wear.** Moving five buses from a 7 km yard to a 1 km yard saves about $162/day, with break-even around 3 km saved. This is what makes depot siting a real decision. V1 computed deadheads only in render code.
*V3 #31, `depots-and-timetables.md` §3, `src/game/depots/deadhead.ts`; V1 `MapView.tsx:527-560`.*
**→ Final:** deadhead cost lives in the sim ledger as its own Finance row.

**EC-14 · AVOID · V1 V3 — Report-card formulas that drift or are guessed.**
- **V1:** reliability compares effective headway to the legacy 15-minute `headwayMin`, so a fully staffed line running its timetable scores 39/100 (`store.ts:476`, review harness `rel.mjs`).
- **V3:** re-derived the card from the manual's prose and asserted, without measuring, that a new agency "lands around 45".
- **V2 measured** the opening card across seeds: minimum 45.8, median 56.4, maximum 65.6. It also showed that lowering the grant bar by 5 is a pure transfer of +$8,000 a quarter to established companies.

**→ Final:** port V1's formulas from code, fix reliability, remove the dead categories (GD-03), and set thresholds from a measured distribution.

**EC-15 · CAUTION · V1 V2 V3 — Demand resolution must be finer than the walk radius.**
- **V1 Riverton:** 481 block groups for 128k people. A real-city block group is about 1–2k people.
- **V2:** 22–29 district centroids, plus 7–9 landmark and rail pseudo-zones. Only about 25–26% (grid and river) or 36–37% (radial) of street nodes are within the 650 m walk radius of a district centroid, and 27–29% / 37–39% counting the pseudo-zones. A five-stop line whose stops sat 508–1,903 m from the nearest centre drew **0 riders for 3 game days**, on both the pre- and post-`5b57b82` builds, so this is a catchment effect and not hour gating. Five stops placed on the five nearest centres drew 665/day (verified).
- **V3:** 96 zones of 490 × 735 m, so only 32 of 9,216 O–D pairs are servable without a transfer (#65).

*Review harnesses `measure.js`, `riders-check*.js`.*
**→ Final:** demand cells well under the 650 m walk radius (block groups or finer). Draw demand exactly where it lives (WD-06).

**EC-16 · KEEP · V3 — Transfers and linked trips from the start.** V3's spec designs a 2-round RAPTOR search and says "do not tune until transfers exist" (#65). Its built slice has no transfers.
**→ Final:** transfers are part of the first economy milestone, not a later one.

**EC-17 · KEEP · V1 — Anchor each new mechanic at a neutral reference so the defaults change nothing.** The fare penalty counts only the gap from $2.25 (`ba5a164`), and `headwayAtHour` reads old timetables unchanged (`f9e88d8`). This is V1's version of V2's identity settings.
**→ Final:** pair it with AR-14.

**EC-18 · CAUTION · V1 V2 V3 — The three versions disagree on interchange radius and starting cash.** Interchange clusters: V1 code uses 130 m, the V3 specs use 650 m, and V2 snaps a new stop to an existing one within 250 m. Starting cash: 310k / 400k / 500k (verified). Reconciled in X-08 and X-09.
**→ Final:** take V1's code numbers as the baseline and change them only with a measurement.

---

## 6. World, map & data

**WD-01 · CAUTION · V1 — Real census data was the differentiator and also the most fragile subsystem.**
- The Census API returns HTML when over quota, "reliably so from shared CI IPs" (`7795400`).
- Overpass returns 406 and 429 (`ceb036e`).
- LEHD has no CORS headers, so the in-browser path always estimates jobs (`3695f23`).
- TIGERweb reports errors with HTTP 200 (`424b0d4`).
- The CI bake is best-effort (it warns and continues). It did run: V1's deploy workflow baked Worcester, Des Moines and Madison packs at deploy time and shipped them on the site, with an in-browser download fallback (`.github/workflows/deploy.yml:42-55`, `223f9a2`). The packs are gitignored (`public/cities/*.json.gz`) and the local bake fails without network, so their content and size cannot be re-checked from the repos (corrected). AADT and land use "cannot be reached from the dev sandbox" (`4a47dc1`).

**→ Final:** real data only through an offline, deterministic bake with pinned sources (V3 `city-packs.md` `sources.lock.json`). The browser never fetches census data.

**WD-02 · KEEP · V1 — A pure, fixture-tested data pipeline shared by Node and the browser.**
- Multi-source fallbacks: ACS 2023/2022/2021 → LODES RAC; three TIGERweb formats; four Overpass mirrors with a User-Agent and 429 backoff.
- `healJunctions` closes gaps of 8 m or less, and only the largest component is kept.
- The fixtures encode real bugs: Worcester Union Station tagging, 5.5 m vs 30 m stubs, mph parsing.
- `npm test` passes in 0.19 s (verified).

*V1 `src/game/data/pipeline.js`, `scripts/test-pipeline.mjs`, `scripts/bake-city.mjs:70-81`.*
**→ Final:** port it nearly verbatim if real cities ship.

**WD-03 · CAUTION · V1 V2 V3 — No real-city pack can be measured from the repos (corrected).** V1 did bake real-city packs (Worcester, Des Moines, Madison) in its deploy workflow and shipped them in production, but they are gitignored. `4a47dc1` calls them "tens of MB" and the docs say "10–40 MB"; neither can be re-checked, because the local bake fails without network. V2's 143 kB was measured on *generated* graphs scaled to real node counts, with no census data, and its converter was never run on a real extract. V3 never baked a city; its 0.41–0.47 MB gzip is an estimate. See X-05.
**→ Final:** in week one, re-run V1's bake (it worked in V1's CI) for one real city with census demand, and measure its pack size, zone count, recompute time and A* cost before committing to a city roster.

**WD-04 · AVOID · V1 — Pack format churn.** `PACK_FORMAT_VERSION` went 1 → 9 in 8 days, and each bump makes every player re-fetch. Stale packs sat "squatting in IndexedDB until storage fills up and saves start failing" (`fe14a93`).
**→ Final:** freeze the pack format before any player has a pack, and evict old packs on read (V1 `idb.ts:121-126`).

**WD-05 · KEEP · V1 V2 V3 — A procedural city in the same format as real cities.**
- V1's Riverton (`public/cities/demo.json`, 410 KB, 481 block groups) carried all the end-to-end testing.
- V2 builds both generated cities and packs through one `finalise()`, after two independent implementations diverged "inside an hour".
- V3's Riverton (seed 42) has bridges and a diagonal avenue that tests prove load-bearing.

**→ Final:** ship a seeded demo or tutorial city in the real-city format, used for tests and instant play.

**WD-06 · AVOID · V2 — A map that reads as a diagram, with demand only at district centres.** The feedback commit `c1d73de` lists "The map does not read as a city" as one of two items "in the player's own words", but the item's text ("Uniform grey lines on beige…") is Claude's explanation, not a quote (corrected). After `cb71cbe`, which never reached the deployed `main`, the texture draws streets and buildings everywhere while demand lives only at 22–29 district centroids plus a few landmark and rail pseudo-zones, so the map invites lines that board no one: stops off the centres drew 0 riders for 3 game days (verified).
*A review screenshot of V2 (`04-running-line-selected.png`, not committed) shows Riders/day 0 on a drawn line.*
**→ Final:** the map's visual density must match where demand actually is.

**WD-07 · CAUTION · V1 V2 V3 — The owner keeps choosing real cities.**
- V1 was built on real cities and shipped three baked ones (Worcester, Des Moines, Madison) on its live site (verified).
- V2 left them out of scope as a deliberate trade-off until round 2 (`776f41d`), a blanket request to do everything outstanding that explicitly included reversing that trade-off (verified).
- V3 #10 records Boston, LA, Orange County and Houston as the "Owner's choice, replacing the manual's Worcester / Des Moines / Madison", and says to bake Boston first (verified). These are 10–20× the populations V1 was tuned for.
- Under a cap of 512 zones each city clips to about 400 km²: LA loses LAX, the Valley and Santa Monica; Houston is reduced to the 610 loop; Boston fits in 225 km².

*V3 `studio/DECISIONS.md:65-71, 184`.*
**→ Final:** real cities are a product requirement, not an option. Bake Boston first (V3's own instruction), and choose cities for how they play at the zone and node budget.

**WD-08 · AVOID · V2 — OSM-only packs without census demand.**
- `tools/pack.js` synthesises population from land-use density (`pack.js:60-68`), so there is no census or LODES data.
- The zone builder merges all contiguous same-kind land use into one blob with its radius clamped to 900 m. A synthetic 7 × 7 km OSM extract built for the review became **2 districts**, one holding 171,180 residents (verified).
- The converter was never run on a real extract (verified).

**→ Final:** if real cities ship, they ship with V1-grade demand data. Reuse only V2's codec and its road-class and zone tag tables.

**WD-09 · CAUTION · V2 V3 — Two hard budgets limit any real city.** V3 caps zones at 512, which leaves about 400 km² of developed land per city. V2 caps the graph at 16,000 nodes, because A* takes 2.7 ms per route at 10k nodes and 30 ms at 31k.
**→ Final:** both budgets go into the bake as hard checks, with a readable refusal.

**WD-10 · KEEP · V3 — Saved stops are anchored to place, not graph ids.** Stops are stored as (lng, lat, roadClass) and re-anchored in tiers: exact within 2 m, near within 40 m, otherwise orphaned and flagged but never deleted. A rebake never invalidates a built depot (#41–#43).
**→ Final:** needed only if packs are rebaked after launch, which is likely with real data, so plan for it.

**WD-11 · AVOID · V1 — The city list and fetch logic are duplicated between the bake script and the loader.** They are already drifting: Worcester's zoom is 13.1 in one and 12.6 in the other (`bake-city.mjs:25` "Keep in sync").
**→ Final:** one source for the city list.

**WD-12 · KEEP · V2 V3 — Generator guarantees, checked by playing.** Cities are deterministic and connected, and every zone can be served by a stop. V3 fails the build if Riverton has fewer than 3 industrial districts. V2 found phantom bridges in 9 of 10 river seeds only by having an agent play them.
**→ Final:** generator invariants in CI, plus scripted "play each city" smoke runs.

---

## 7. Rendering & art

**RN-01 · KEEP (look) / CAUTION (cost) · V1 — MapLibre plus Three.js produced the look the owner asked to return to.** It gave real streets, tilt, 3D buildings, live buses and the tilted "board" over a grey void (`docs/img/line-editor.jpg`). The costs:
- The bus layer shares MapLibre's GL context, so it calls `resetState()` every frame.
- The station diorama needs a second WebGL context.
- The offline basemap ships no glyphs, so labels are DOM markers rebuilt on a 600 ms timer.
- Online tiles depend on OpenFreeMap.

*V1 `busLayer3d.ts:201-273, 709`; `c141281` body.*
**→ Final:** V1's visual target is the reference. Whichever engine is chosen must match its screenshots (UX-01).

**RN-02 · AVOID · V2 — A Canvas 2D schematic.** It was fast where measured: the static map draws in 0.23 ms per warm frame and footprint batching cut 65.8 ms to 2.2 ms. But it read as a diagram, and the owner asked for V1's look. Ground rebuilds still take 34–38 ms in the 2.4–4.7× zoom band.
**→ Final:** a flat schematic is not the shipping look.

**RN-03 · CAUTION · V3 — three.js "Route B".** The V3 digests call it the nicest-looking map of the three. The costs:
- The gzipped critical path (HTML + JS + CSS + workbox-window) went from 75.2 to 220.3 KiB (2.93×); the app JS alone went from 72,190 B to 220,790 B. These are author-measured figures from `baselines.md` (M1 Pro, at commits that no longer exist); the doc was re-read but the numbers were not re-measured (verified).
- On SwiftShader software GL it adds two long tasks per boot, 726–926 ms and 113–119 ms, and none on a GPU (verified, same source).
- It added about 4.4k lines of renderer, a 748-line pipeline and a 302-line viewer.
- It brought perspective bugs such as bus foreshortening.
- No gameplay progress followed it.

*V3 `studio/docs/baselines.md:160-177, 240-252`.*
**→ Final:** 3D is presentation. Choose the engine once, after the loop is playable, and measure it on low-end hardware.

**RN-04 · AVOID · V1 — Rendering performance debt.**
- Each bus is 18–33 meshes (minibus 18, citybus 26, double-decker 27, electric 28, artic 33) with 9–14 unique materials and 14–23 unique geometries. A few parts are shared through small module caches, but most are created fresh per bus, and nothing in `src/` uses `InstancedMesh` (verified).
- `setNetwork` (`busLayer3d.ts:298`) removes and rebuilds every bus mesh, and `MapView` calls it from an effect on `[lines, stats, stops]` as well as from a full-sync path. Nothing is disposed: `src/map` has no `.dispose()`, and the only one in `src` is `renderer.dispose()` in `StationScene.tsx:468` (verified).
- `triggerRepaint` runs every frame, even while paused.
- Every frame allocates new arrays and matrices.
- A 1.5 s timer calls `setPaintProperty` on about 15 layers, even while paused.
- No commit in 71 mentions frame rate.

*Review node probe; `busLayer3d.ts:308, 449-451, 703-711`.*
**→ Final:** instanced vehicles with shared materials, dispose on rebuild, render only on change or while running, and FPS and draw-call budgets measured in CI.

**RN-05 · AVOID (V3) / CAUTION (V1) — The bus-visibility saga.**
- **V1** draws buses at near-constant screen size (about 25 px), `clamp(25·mPerPx/11, 1.15, 29)`, so a bus can be up to 29× life size (verified, `busLayer3d.ts:590-591`). The keep-right lane offset then had to scale too. It was legible.
- **V3 Canvas:** seven verification passes and six causes. The last was a "contain" fit that put the city in a third of the window (484k of 668k pixels void, #61).
- **V3 3D:** `BUS_TARGET_FOOTPRINT_PX = 30`, but `BUS_MAX_EXAGGERATION = 8`, so at the default whole-city framing the live frame with buses differs from the empty frame by **6 pixels** (verified by re-measurement). The wiring test asserts only `diff > 0`. The contrast gate passes because it frames the camera on the fixture line (`fixtureLineViewport`), and its own comment admits the default framing is "genuinely too far out for a 12 m bus" (verified).

**→ Final:** a player-facing rule: a bus is at least N px at the default camera, asserted by a test at that camera. Use LOD: an icon or impostor when zoomed out, a true-scale mesh up close.

**RN-06 · KEEP · V3 — Unlit data layers, and legibility asserted structurally.** Ground, water, roads and routes render flat, so pixel colour equals the intended colour. Lit objects stay inside a luminance envelope of 0.75–1.15 (#66). Legibility is defended with a minimum bus footprint and colour axes no road can reach (#24, #54).
**→ Final:** keep this rule if any 3D ships, with a small rendered smoke test rather than a 54-case suite.

**RN-07 · CAUTION · V1 V3 — Model pipelines built with no models in the repo.**
- **V1:** a glTF drop-in contract (`Brand` and `Stripe` materials, a `DoorCurb` node, autofit, a CI linter, ≤ 2.5 MB per file). Zero models were ever committed, and there is no `public/models/`.
- **V3:** a 703-line meshopt/KTX2 pipeline; `npm run models` finds no files and writes an empty manifest. Its docs discuss "the five supplied models at ~31,000 tris and 2.5–3.1 MB" (`renderer-3d.md:275-288`), about 5.2× the 6,000-tri budget if that is per model, say the owner authors LOD0 (`:215`), and say the first batch's "real problem was an 859 KB metallic-roughness texture" (`studio/assets/draft/README.md:18-20`). No `.glb`, `.gltf`, `.blend`, `.fbx` or `.obj` file exists anywhere in the history of the three repos (verified).
- The code budget (4,000 tris / 45 KB) disagrees with the spec (6,000 / 80 KB).

*V3 `studio/docs/design/renderer-3d.md:275-288`, `studio/assets/draft/README.md:18-19`, `src/render/three/modelBudgets.ts:58-64`.*
**→ Final:** get the existing model files from the owner or the co-developer (likely the co-developer; unverified), run one through a minimal pipeline, and build the pipeline only as far as those files need.

**RN-08 · KEEP · V1 V2 V3 — The visual identity that held across all three versions.**
- Warm paper (`#f6f1e1` / `#f3edda`), ink `#2c2a24`, blue `#1d3f7a`, amber `#ffe9a8`, red `#c94f35`.
- One hand-drawn `BusSide` mark used everywhere, no emoji, and in-world copy ("Talon & Grasp… the only bank that returns your calls").
- V2's palette is literally V1's manual CSS.

Defects to fix: V1 has 33 hex and 97 `rgba(` literals with zero CSS custom properties, and its first font, 'Inter', is never loaded. V3's owner-set "Subway Builder: sleek and modern, but usable" feel target conflicts with the paper identity, and the reference screenshots it requires never arrived.
**→ Final:** design tokens from day one. Ask the owner for the Subway Builder references and resolve the paper-vs-sleek question before any UI art pass.

**RN-09 · KEEP · V2 — Never encode meaning by hue alone.** V2 uses 10 grayscale-distinct dash patterns, glyphs and hatch density. In its own words, "Shape is the belt; ΔE is the braces."
*V2 `40-render.js:446-458`, `e96d7bc`.*
**→ Final:** a line-style system built on dash patterns from the start.

**RN-10 · CAUTION · V2 — Palettes picked only to pass metrics look muddy.** The light line palette is very dark (`#630d18`, `#4d6494`, `#4d5e4e`…). Dark lines clear only 9.5 ΔE against roads, against a bar of 20. The district wash "reads as a quilt". The gate also forced opaque chips over the map: "the reason is the gate, not taste."
**→ Final:** an art-direction review sits next to the ΔE check.

**RN-11 · KEEP · V1 V2 — No teleporting vehicles.**
- V1's tau clock integrates 1/congestion, which fixed rush-hour teleports (max step 199 m per quarter game-minute, `ce7cf6b`).
- V2's route-edit "shape epoch" cut teleports from 4.2–5.6 km to about 1 m. Reordering stops still moves a bus 3,117 m.
- V3's no-teleport test measures a maximum step of 9.577 m, sampling one bus every 1 s over a full round trip on the test fixture (verified).

**→ Final:** port the tau clock and the epoch, and add a test for reordering.

**RN-12 · CAUTION · V1 — Demand overlays that look busy but carry little information.** The far-zoom residents clusters are evenly sized purple circles, and the travel-modes view is almost uniform grey. A `['zoom']` interpolation nested inside `['case']` "silently fails to build — no dots at all" (`ee9c2c1`).
*V1 `docs/img/demand-far.jpg`, `docs/img/travel-modes.jpg`.*
**→ Final:** decide with the owner which question each overlay answers (UX-12), and validate style expressions in tests.

**RN-13 · KEEP · V3 — Light map only.** The owner asked for a light map (#5, verified), and V3 removed `prefers-color-scheme`: a night-tinted map inside dark chrome "loses the day/night read completely" (#5). V2 shipped a dark theme anyway.
**→ Final:** light theme, with the day/night tint on the map only.

**RN-14 · CAUTION · V2 — Night palettes double the colour QA surface.** Every palette must also clear ΔE 20 at the darkest of 16 night steps, and the spec's predicted contrast figures were never reproduced.
**→ Final:** keep night as a cheap tint, not a second palette.

---

## 8. UX & UI

**UX-01 · KEEP V1 / AVOID V2 — A chrome budget, measured.**
- V1.18 covers **5.3%** at rest with 0 standing words (verified; V2's own measurement).
- V2 covers **41.2%** with 271 standing words, 352 counting below the fold (verified), and 585 DOM words at boot (review-measured): top bar 12%, dock 18.3%, inspector 22%. The spec says "41.2% of the map is covered"; the commit and BACKLOG say "of the screen". The spec's own targets are 6 standing words and ≤6.0% occlusion.
- At 1152 × 720, V2's `≤1180px` rule hides the cursor cards and stretches the dock, so almost no map remains.

*V2 `screen-layout.md` §4.1, `980759d`; review screenshots of V2 with logged chrome rectangles, including `09-laptop-1152x720.png` (not committed).*
**→ Final:** ≤6% chrome at rest, ≤26% with a panel open, measured by script at 1440 × 900, 1366 × 768 and 1152 × 720.

**UX-02 · KEEP · V2 spec (never built), V1 shape — Build the shell first.** The shape:
- one row of icon chips;
- a bottom dock of at most 8 slots with Build / Map / Company menus;
- a floating inspector that is *absent* when nothing is selected;
- rules on the **cursor card** at the moment of aiming ("street 380 m ✓ · nearest depot 90 m ✗");
- a help page for prose;
- at most 8 words beside any control, a cap derived in `980759d` from the reference's nine glosses, which average 5.8 words with a maximum of 8 (verified).

V2's retrofit of this shape never landed: the spec (9,907 words) is headed "Nothing here is built", and step 2 was reverted in the working tree (verified).
*V2 `screen-layout.md` §3–§5, §10 (includes measurement snippets).*
**→ Final:** this is interbus's shell in milestone 1.

**UX-03 · KEEP · V1 V2 — Explain-the-rule idioms.**
- Every blocked action states its one actionable reason (`37cae87`).
- Costs are stated in money: "Costs $95k; you have $40k — $55k short."
- The express note shows the thresholds as MET or needed (stops 5 vs 3, length 8.4 km vs 5, spacing 2,090 m vs 1,200).
- The timetable shows its arithmetic live, both ways ("needs N buses, you have M").
- The fare card prints a band, not an argmax.
- The report card has a "Left on the table" column.
- The coverage overlay is hatch density.

*V1 `Panels.tsx:225-373, 380-410, 958-967`; V2 `50-ui.js:1779-1799`, `9134ee9`, `c90223b`.*
**→ Final:** a shared component library for these idioms. The copy goes on the cursor card or in the inspector, never as standing prose.

**UX-04 · AVOID · V1 — Unlabelled HUD numbers.** The five top-bar chips are an icon plus a number, explained only by a tooltip. The manual itself labels the second chip "Drivers"; the code shows riders served (`TopBar.tsx:79-99`, `MANUAL.md` §5).
**→ Final:** every HUD number carries a short label or unit.

**UX-05 · AVOID · V1 — Panel sprawl.**
- The line editor scrolls through about 15 controls.
- Native `<select>`s are unstyled.
- The panel overlaps the zoom control, and notices stack in the middle of the map.
- DraftBar and DraftPanel disagree on cost.
- A stale hint still points at the removed heatmap (`Panels.tsx:867`).
- The CSS has zero `@media` rules, and Electron enforces a 960 × 600 minimum.

**→ Final:** a panel architecture with routing, shared field components and styled inputs, and responsive at least to 1152 px.

**UX-06 · AVOID · V3 — A placement tool that doesn't show where placement is legal.** The depot chip says "Not industrial land — build on the green", but nothing on the map is green. A review sweep found one valid screen point, and clicking it charged $150k and drew nothing (verified: `src/render` has no depot code). V1 had already learned that the tint must be the rule (`38775a1`).
*Review screenshots of V3 (`04-depot.png`, `05-depot-placed.png`, not committed); `App.tsx:864-868`.*
**→ Final:** a placement tool ships together with its legality tint.

**UX-07 · CAUTION · V1 V2 V3 — Onboarding was minimal everywhere.**
- **V1:** starts paused, with a 5-step "How to play" text panel, a pulsing "Place depot" button and a sandbox flag. There is no interactive checklist.
- **V2:** no main menu; it auto-founds "City Transit Co." in grid seed `intralines-1`.
- **V3:** no menu; the company is named after the city.
- V2's spec adds a conditional, pulsing depot slot with a static fallback, because reduced motion kills every animation.

**→ Final:** a first-session checklist driven by sim events (depot → line → buses → first profit), plus V1's home menu and founding screen.

**UX-08 · CAUTION · V2 — The accessibility gate: real value, unbudgeted cost.**
- **Value:** it found 11 violations on its first run, including two line colours 1.5 ΔE apart under protanopia, roadworks and fuel tints 2.6 ΔE apart, and the Space key swallowed by the global pause handler.
- **Cost:** 6.9k lines of tooling (`a11y-browser.js` alone is 279,756 B, verified) and 23 commits. Build time went 0.2 s → 29 s → 9.6 s. Today a cache-missing build with the browser gate takes about 33–35 s (32.9–34.6 s on two machines), against about 0.5 s without it (verified).
- **Gaps:** CI never runs the browser half. `pages.yml` calls plain `build.js` and never installs Playwright, although `build.js`'s header says "CI pins the strong form with --browser", and the single CI run logged "a11y browser: NOT RUN (Playwright is not installed)" (verified).
- **Side effects:** it blocked the layout simplification (29 violations, all focus rings on the new chips over the map canvas, at 2.91:1 against 3:1; verified), forced opaque chips, and made "content promises sit exactly on their floor" so that adding a row fails the build.

**→ Final:** palette ΔE and contrast as millisecond unit tests, plus keyboard reach, 24 px targets, and axe-core inside the ordinary end-to-end scenes, with a build-time budget. No bespoke browser gate.

**UX-09 · KEEP (with fix) · V2 — Undo and redo.**
- **Design:** snapshot the top-level keys each action declares, one transaction per gesture, 50 entries deep.
- **Defect:** the snapshots (`60-main.js:612-662`) include `cash` and `fleet`, which the sim also writes, and `simStep` never clears history (only a load does), so undoing after time has passed rewinds money and wear. In an exact replay (cash $135,000, buy a $95k bus, advance exactly 32 game hours, undo), cash returned to $135,000 instead of $134,267, erasing $733 of operating costs. Undoing a bus assignment after 32 h reset its wear from 2.2 to 0. In both cases redo did not restore the state hash (corrected). The review's earlier $760 figure implies about 33 h elapsed and is not in the preserved log. This is exploitable in both directions.
- **Gaps:** the undo button never names the action it reverts, and a line draft takes 5 + 1 undo steps.

**→ Final:** undo covers only player-authored network state, or only works in a paused planning mode, and it is tested after time advances.

**UX-10 · KEEP · V1 — In-world dialogs, no browser popups, no emoji, a paused start, and keyboard shortcuts** (Space, 1/2/3, layered Esc).
*V1 `f310018`, `96d8777`, `App.tsx:39-60`.*
**→ Final:** keep them all.

**UX-11 · KEEP · V2 — A keyboard map cursor.** Enter places it, arrows move it 40 m (×5 with Shift), Enter acts, Esc unwinds one level. It is cheap accessibility for map placement.
*V2 `60-main.js:4531-4624`.*
**→ Final:** keep.

**UX-12 · AVOID · V1 — The core "read the city" view was redone about 8 times.** It went census polygons → soft heatmap → tighter heatmap with 7 layers → crisp dots → travel-mode blend → 12 "pockets" (reverted after 26 minutes) → hashed scatter with clustering. The layer count went 2 → 4 → 5 → 7 → 3. The one recorded complaint from the owner was about the *number of demand types*.
**→ Final:** prototype the demand view first and agree with the owner on the question it answers ("where do trips start and end, and where am I not serving them?"). Keep the layers to three or fewer.

**UX-13 · KEEP · V2 — Per-stop analytics.** Boardings, alightings and profit per stop, flagged QUIET below 5 boardings/day or LOSS below −$20/day with an icon and a word. The line total sits on top, so a stop isn't blamed for a line-wide problem.
*V2 `stop-analytics.md`; `30-sim.js:63-68`.*
**→ Final:** pruning dead stops is a core verb (GD-02), so this ships in the first economy milestone.

---

## 9. Saves, deploy, updates & distribution

**DP-01 · AVOID (the saga) / KEEP (the end state) · V1 V3 — Solve updates on day one.**
- **V1** stacked boot and update recovery layers in six commits between Aug 5 15:04 and Aug 10 18:01 UTC, before its service worker arrived: `3afd5f0` (auto-recover from stale cached pages), `341a5e3` (boot watchdog), `b0fc3f4` (splash, faster watchdog, `status.html` hosting check), `fe14a93` (v1.18 build-ID polling, UpdateBanner, update-safe saves), `1624f3b` (stop `index.html` pinning bundle hashes, a Vite build change) and `d66e6dc` (retain previous deploys' hashed assets, a deploy step). Then came the service worker itself, `9ea15e5`, whose message says "Every layer here so far was recovery … Each one narrows the window; none closes it". `81f334d` came after it and handles Pages serving the repo source (corrected). Those eight commits add 1,273 lines, about 920 of them update- or boot-related. Today the update and recovery files total about 1,190 lines, 345 of which (`errors.ts`, `ErrorCenter.tsx`, from `96d8777`) are general error UI.
- Two configuration root causes surfaced: Vite baking hashed bundle names into a cacheable `index.html` (`1624f3b`), and Pages serving the repo source instead of the build (`81f334d`). The player's words are in `scripts/retain-assets.mjs:5`: *"bugs out every time it updates"* (verified).
- **V3's PWA** shows the end state done properly: `vite-plugin-pwa` with `registerType: 'prompt'`, no `clientsClaim`, `skipWaiting()` only inside a `SKIP_WAITING` message listener (V1's worker called it on install), no swap of a running tab, and at most 2 automatic reloads per session (`register.ts:10`). Offline play was re-verified by cutting the network: with a control fetch failing, the offline reload rendered the game (verified).

**→ Final:** V3's PWA setup plus an unpinned `index.html` from the first deploy. None of V1's recovery layers.

**DP-02 · CAUTION · V1 — GitHub Pages traps.**
- Pages has two gates: the workflow's branch list and the environment's allowed branches. Missing the second fails in 2 s with no logs (`CLAUDE.md:25-35`).
- `cancel-in-progress` across two branches cancelled the real deploy twice (`6c3687c`).
- The owner's one commit in V1 (the other 70 are Claude's), a 51-line Jekyll workflow (`f57983c`, 17:04 UTC), published the raw repo source to Pages after the game build and left a white screen. `b26804d` removed the same 51 lines 8 minutes later (17:12 UTC) (verified).
- Pages served the repo root instead of the Actions artifact (`81f334d`).

**→ Final:** deploy from one branch, copy V1's `CLAUDE.md:20-47` deploy rules, and verify every deploy run.

**DP-03 · AVOID · V2 — CI that doesn't run the gates the docs claim, and a deployed build behind the real one.**
- `build.js` says `--browser` "is the CI setting", but `pages.yml` neither passes it nor installs Playwright (verified).
- The deployed `main` is **16 commits behind** the archive. The repo's only Pages run deployed `8c01a18` at 03:22 UTC on Aug 12 (a 1,275,563 B `index.html`), so the deployed game lacks the feedback backlog (`c1d73de`), the screen-layout spec (`980759d`), the city texture (`cb71cbe`) and the span fix (`5b57b82`) (verified). The feedback commit landed 17 minutes after that deploy, so the player was most likely reacting to the deployed build, while the crew went on to describe later ones.
- `dist/index.html` was committed in 51 of 107 commits.

**→ Final:** CI runs exactly the local gates, the build artifact is never committed, and the build the owner plays is the build under discussion.

**DP-04 · AVOID · V1 — Entity ids derived from array length.** `openCity` sets `lineSeq = sv.lines.length + 1` and `stopSeq = sv.stops.length + 1` (`store.ts:817-818`), unlike the depots, which take the max existing id (`:819-822`). A collision needs deleted lines or orphaned stops followed by a reload: delete L2 and L3, reload, draw a line, and the lines read L1, L4, L4. `finishDraft` (`:1327-1328`) then treats each reissued stop id as an existing stop, so the new line silently reuses unrelated old stops and is not charged for them. In the harness those stops sat 2,818 m, 3,606 m and 5,031 m from the drawn path; the distances come from the harness geometry, and the point is that the aliased stop can be anywhere (corrected). That is silent save corruption.
**→ Final:** monotonic ids that are never reused (V3), plus a save round-trip test that deletes and reloads.

**DP-05 · AVOID · V1 — A save version that never moves, and derived data in saves.** `SAVE_VERSION` has been 1 since v0.1, so the newer-save guard can never fire. Route geometry makes up 45% of a one-line save (review harness `savesize.mjs`). For comparison, V2's save is about 2.1 KB because the city is regenerated from its seed, and V3 saves a 3-stop line in 1,383 B.
**→ Final:** persist intent (decisions, accumulators, seeds), recompute everything derived, and bump the format version with real migrations.

**DP-06 · KEEP · V2 V3 — Save robustness.**
- **V3:** an envelope with an ordered load whose outcomes are none / ok / newer / unreadable / wrong_city; newer and unreadable saves are copied to `intralines.backup.<cityId>.newer` / `.unreadable` rather than written over; id counters persist in the save (`nextIds`, `save/types.ts:153`) and only increase; 11 save tests pass (verified). One gap: the bus counter is not persisted (it is always written as `FIRST_BUS_ID`, and buses are saved as `[]`). It also has defaults-on-read plus a never-edited `MIGRATIONS` chain; autosave with a 3 s debounce, a 10 s floor, and writes on `pagehide` and `visibilitychange`.
- **V2:** element-level validation (a null `clock` or a null fleet entry is refused with a reason), and a save whose city pack is missing is refused rather than silently given another city.

*V3 `src/game/save/*`, `save-format.md`; V2 `10-core.js:631-715`, `9925f25`.*
**→ Final:** port V3's save module and add V2's element validation.

**DP-07 · AVOID · V2 — One manual save slot, no autosave, no unload guard,** and a Save button that announces "Company saved." without checking the result (`50-ui.js:1647-1648`).
**→ Final:** autosave plus a list of save slots.

**DP-08 · CAUTION · V1 V3 — An "old saves must load" rule with no importer is false.** V3's `CLAUDE.md` says v1.18 is "live … with real companies in the wild", while #17 says "no live saves today". V3's key is `intralines.save.<city>` and V1's is `intralines-save-`, and no importer exists. Whether anyone besides the owner played V1 is unverified.
**→ Final:** decide explicitly: build a V1 importer, or drop the promise. Default: drop it unless V1 has real players.

**DP-09 · CAUTION · V1 — Electron.** The `app://` shell keeps a stable origin, sandboxing and contextIsolation. But it is built only locally, and `vite.config.ts:10` falls back to a `dev-<timestamp>` BUILD_ID when `GITHUB_SHA` is absent, so the desktop app has **no service worker and no update check** (`update.ts:47, 153` return early); its scheme privileges also omit `allowServiceWorkers`. Its saves live apart from the web build's, CI (`deploy.yml`, with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`) doesn't build it, it is unsigned (`README.md:26`), and `electron/` has not been touched since Aug 3 (verified).
*V1 `electron/main.cjs`, `update.ts:47,153`.*
**→ Final:** pick the distribution target (web, desktop/Steam, or both) now. A desktop build needs its own updater, signing and save location.

**DP-10 · KEEP · V2 — Offline build checks.** V2's builder syntax-checks every file, fails on any network reference, escapes `</script`, and writes `dist` exactly once after every gate passes.
*V2 `tools/build.js:129-161, 334-360, 566-568`.*
**→ Final:** port it as a post-bundle check.

**DP-11 · KEEP · V3 — Binary hygiene.** Git LFS was turned on before the first binary landed, after an earlier mistake: a 516 KB wasm file committed as a plain blob (#71). Meshopt is used instead of Draco, which fetches a wasm decoder at runtime (#70). The KTX2 transcoder is runtime-cached rather than precached.
**→ Final:** `.gitattributes` with LFS from the first commit.

**DP-12 · CAUTION · V3 — Fragile test toolchain.** The rendered tests need the exact Chromium revision Playwright 1.62.1 expects (1234; the review machine had 1194). `npm audit` reports 14 vulnerabilities (3 critical).
**→ Final:** pin or containerise the test browser, and audit dependencies in CI.

---

## 10. Testing & verification

**TS-01 · AVOID · V1 — No committed tests of game logic.** `npm test` runs only the pipeline fixtures (`scripts/test-pipeline.mjs`, 0.19 s), and no other test or spec file is tracked in git (verified). Three logic bugs shipped, and each reproduces with a small harness: the id collision (DP-04, re-run and verified); dead wear (`store.ts:933-935` counts only lines with a matching legacy `modelId`, which no line created since v1.15 has, so their buses show 0.00 wear after a game day against 2.20 with a legacy `modelId`, while `MANUAL.md:456-462` still promises 2.2 points/day; verified); and reliability scored against a legacy headway (EC-14).
**→ Final:** unit tests for rules, economy and saves, committed from the first commit.

**TS-02 · KEEP · V2 — Cross-layer contract tests.** Four features shipped dead from name mismatches between layers (`plan.steps`/`moves`, `driverWages`/`wages`, `fuelShock`/`fuel_shock`, object vs array timetable windows) while 29 of 29 unit tests passed. A contract test caught the same class again in seconds (`ae279ba`, `5ec42fd`).
**→ Final:** in TypeScript, shared types cover most of this. Keep explicit tests that the keys the UI reads exist in the sim's output.

**TS-03 · KEEP · V2 V3 — Determinism and replay tests.** These are already covered in AR-06: cold-context replays, full-save comparison, and replays with edits across 12 days (`57dcdc0`).
**→ Final:** this is a day-one CI test.

**TS-04 · KEEP · V2 — Prove each test bites.** Re-introduce the bug in a scratch copy and watch the test fail (`0d9f55b`, `7137df8`). Gate checks were verified by injecting faults (`a942adb`).
**→ Final:** required for every regression test.

**TS-05 · AVOID · V2 — Tests that skip the hard path.** The only undo round-trip test edits and undoes with no ticks in between (`playtest.js:2624-2647`, verified). The gate's fixture was itself exploiting the coverage bug it should have caught: warnings went from 2 to 14 "and the build still reported zero violations" (`7137df8`).
**→ Final:** every test of state history runs the clock between steps.

**TS-06 · AVOID · V3 — Untested shipped wiring.** No test file exists in `src/ui` or `src/pwa`, and none imports `App.tsx`; `mapCanvasWiring` mounts `MapCanvas` with "App.tsx-shaped" props, not App itself (verified). The review found a live bug, re-run and verified: after a reload the top bar shows 06:00 although the save holds 07:16 (76.5 game-minutes), because `TopBar.tsx:127` formats the raw clock that `App.tsx:844` passes, while `App.tsx:358-359` adds the saved offset for every other consumer, autosave included. The depot dead end would also have been caught.
**→ Final:** an end-to-end smoke test on every PR: found a company, draw a line, run a day, check the cash change against the ledger, reload, compare state.

**TS-07 · CAUTION · V1 V3 — Verify the verifier.**
- **V3 false negative:** a framebuffer read on a racing rAF returns all zeros, because three.js assigns `render` as an instance property. So the pinned playtest "saw no bus across 34 game-minutes".
- **V3 false positive:** the rendered gate passes on a fixture framing, and the wiring test only asserts `diff > 0` (`mapCanvasWiring.rendered.test.ts:282`), and the real diff at the default framing is 6 pixels (verified).
- **V1:** "My own screenshot test was clicking a zoom control that the how-to-play panel covers, with the failure swallowed by a .catch()" (`ee9c2c1`).

**→ Final:** visual tests run at the default camera and viewport, never swallow errors, and are proven to fail on a known-bad build.

**TS-08 · AVOID · V2 — Balance and performance numbers that can't be reproduced.** Commits and comments cite scripts in a session working folder (`fare-sweep2.js`, `derive.js`, `cand2.js` and `packs/measure.js`), none of them committed. Toy-network benchmarks claimed 1.5–4.5 ms where a realistic network takes about 65–100 ms (verified).
**→ Final:** commit `bench/` and `balance/` with assertion bands, run on a reference mid-game save.

**TS-09 · KEEP · V3 — Cross-module invariant tests.** Examples: money is conserved across spend, undo and cancel; the ledger and bus positions agree on service hours; bridges are true chokepoints; the diagonal avenue is actually faster. That is 24 tests in 513 ms. Characterization tests pin known-bad behaviour and are flipped on purpose ("FLIPPED by refactor 2").
*V3 `src/game/integration.test.ts`, `lines/characterization.test.ts:310`.*
**→ Final:** adopt the pattern.

**TS-10 · AVOID · V1 V2 V3 — No human playtests recorded anywhere.** Every "verified" in V2 and V3 came from an agent. V2's own CHANGELOG: "Every number quoted for them comes from the agent that built it, not from a play-through of the finished build." Its round 3 was marked SHIP by the playtester agent (`daf1a23`), while CHANGELOG still says the playtest "has not reported". V1's only player signals are two complaints.
**→ Final:** a scheduled human playtest by the owner, and the co-developer if available, at the end of every milestone, with notes committed to the repo.

**TS-11 · KEEP · V3 — Prove offline by actually cutting the network**, with a control fetch (#34, BACKLOG:81). A verifier repeated it on 2026-10-12 against `vite preview`: with the network cut and the control fetch failing, the offline reload rendered the game (verified).
**→ Final:** part of release QA.

**TS-12 · KEEP · V3 — Sanity-check magnitudes from first principles.** For example, about 41,000 trips/day for Riverton (#64).
**→ Final:** every sim milestone states its expected magnitudes before measuring.

---

## 11. Reconciliations: where the digests contradict each other

**X-01 · How long V2 took: "about 32 hours" (v2-bible, v2-design-specs) vs "about 36 hours" (v2-code-ui), and "first commit 21:05" (v2-code-sim) vs "17:05" (the merged timeline).** **Right: about 32 hours** (32.2 h, 115,891 s from `e1352f6` to `5e24bcb`; verified). The template commit `e1352f6` is 17:05 **−0400**, which is 21:05 UTC (`git log --format=%ci`). The first Claude commit `26ab377` is 21:21 UTC and the last, `5e24bcb`, is 05:16 UTC on Aug 12. v2-code-ui read the local time as UTC.

**X-02 · Did V3 run in parallel with V2?** v2-bible says V3 was reframed (`493f224`, `841b176`) "at 01:21–01:37, while V2 was still committing". **Corrected:** those times are −0400. In UTC the reframe ran 05:10–05:37 on Aug 12, and V2's clean-pause commit is 05:16 UTC. The switch happened **in the same half hour**, about 1.5 hours after the player-feedback commit `c1d73de` (03:39 UTC) and about 1 hour after the "make the game more like" V1 quote was first recorded (`980759d`, 04:02 UTC) (corrected). Likewise, V3's crew setup (`79cb89d`) was at 20:37 UTC, not 16:37 as v1-docs-history says, which puts it 10 minutes *before* V1's manual (`840a661`, 20:47 UTC). And the owner's Jekyll commit `f57983c` (17:04 UTC) came *after* the game's deploy workflow (`502fd30`, 16:47 UTC). That fits "it overwrote the deployment" and its removal at 17:12 UTC (verified). The merged timeline's raw times should not be used to order the owner's commits.

**X-03 · How many checkpoint commits V2 had: "8" (v2-design-specs) vs "10" (v2-code-sim) vs "13" (v2-bible, v2-code-ui).** **All consistent once counted:** 10 subjects start with "Checkpoint" and 3 say "work in progress", 13 in total (`git log … | grep -ci`). v2-design-specs listed 8 and missed `1eec6df` and `675ac06`.

**X-04 · V2's spec mass: "~338 KB" vs "346 KB" vs "~390 KB".** **Right: 346,122 bytes (≈338 KiB) in 22 files, 55,761 words** (`git ls-tree -l` sum; `wc -w`). The ~390 KB figure in v2-code-ui overstates it.

**X-05 · Real-city pack size: "10–40 MB" (V1 docs, repeated in V3 GAME.md) vs "143 kB" (V2) vs "0.41–0.47 MB gzip" (V3).** **None of these can be measured from the repos (corrected).** V1 did bake and ship real-city packs: its deploy workflow built Worcester, Des Moines and Madison at deploy time (`deploy.yml:42-55`, `223f9a2`), and `4a47dc1` calls them "tens of MB". But the packs are gitignored and the local bake fails without network, so V1's size figure cannot be re-checked from the repos. V2's 143 kB is the street graph of a generated city scaled to real node counts (`city-packs.md:108-118`), with no census or LODES data. V3's is an estimate from assumed node densities. V2's conclusion that "the download was never the graph" is plausible but also unmeasured. **Treat pack size as unknown until the week-1 bake (WD-03).**

**X-06 · V1's deploy layers: "7" (v1-code-render-ui) vs "8" (v1-docs-history) vs "9 commits" (v1-code-sim).** **All three are counting different things (corrected after verification).** Six commits stacked recovery layers before the service worker (`3afd5f0`, `341a5e3`, `b0fc3f4`, `fe14a93`, `1624f3b`, `d66e6dc`); a seventh pre-SW commit, `6c3687c`, is a CI fix. `9ea15e5` *is* the service worker, the first preventive layer, and `81f334d` came after it to handle Pages serving the repo source. Not every layer is client-side: `retain-assets.mjs` is a deploy step and `1624f3b` a Vite build change, and `fe14a93` and `d66e6dc` also carried unrelated bus-icon and bus-mesh work. The "7 layers" count also includes `errors.ts` and `ErrorCenter.tsx`, which came from `96d8777` and are general error UI. Counting all hosting, deploy and bake work, about 14 of 71 commits.

**X-07 · Did V3's rendered tests run? v3-bible says "not run; 316 unverified", v3-code says "57 pass, 316 total".** **v3-code is right** (verified: 259 node tests in 22 files plus 57 rendered tests in 2 files). It ran them in headless Chromium with an `executablePath` override, because Playwright 1.62.1 expects Chromium revision 1234 and the review machine had 1194.

**X-08 · V1's starter economy: "+$450 to +$1,000/day" (v1-docs-history, from commit messages; `4296026` itself says about +$490 for a 5-stop line and +$1,000 for the starter) vs "+$2,810/day" (v1-code-sim, measured).** **The measured +$2,810/day is right for current code (verified).** The commit figures predate visitors and the ×1.5 express subsidy. v1-docs-history's pacing inference used the stale numbers, so early growth was faster than it assumed, though still never playtested.

**X-09 · Starting cash: $310k / $400k / $500k (verified).** Only V1's $310k was set by play-testing in the sim ("nets about +$1,000/day" at the time). V2 raised it to $400k without a recorded reason. V3's $500k is invented: the manual omits it (#9, ⚠︎ REVIEW). **Baseline $310k**, re-tuned with the scenario harness (EC-11).

**X-10 · Constants: "keep everything in one file" (V1, and V3's house rule) vs "prefer per-module constants files" (v3-bible) vs "one constants policy, enforced" (v3-code).** **Both are right about different failures.** V1's single file held because one agent owned it. V3's single file failed because the file-ownership rule pushed agents to local copies. V2's failure was duplicated fallbacks. The common cause is unowned duplication and bare literals, not the number of files. **Resolution:** per-domain modules behind one registry, SPEC/TUNE tags, a lint against bare literals, one owner.

**X-11 · Snapshot undo: "the cleanest reusable idea in V2" (v2-bible) vs "has a real defect" (v2-code-ui).** **Both.** The design is right for edits made while time is stopped. It is wrong when it snapshots state the sim also accumulates. The fix is in UX-09.

**X-12 · Fare scope: V3's spec says company-wide; V1's code, V2, V3's own save schema and the manual's §9 say per-line.** **Per-line is right.** It is backed by measurement (V2's six optima) and by round 2 (`776f41d`), in which the player explicitly asked for everything outstanding, including reversing the deliberate trade-off that had kept the fare band narrow. The BACKLOG item reads "Fare band widened… so fare becomes a real per-line decision"; the wording is the crew's (verified). V3's company-wide fare was an agent `[choice]` that was never built.

**X-13 · What a line stores for service: V3 #25 (target headway) vs #32 (`busesRequested` canonical) vs `save-format.md` §4 ("mode + headway"), all dated the same day. V1 stored both.** None was implemented, so the conflict never surfaced. **Recommendation:** store the player's intent, a target headway per period, and derive buses. That serves the anti-tedium goal (GD-09), matches how HEADWAY contracts grade, and #25 already chose it. Either way, store exactly one shape.

**X-14 · Bus visibility: V1's constant screen size "is a legibility hack on a hack" (v1-code-render-ui) vs V3's principled ×8 cap.** **From the player's side, V1 solved the problem and V3 did not:** at the default framing, V3's frame with buses differs from the empty one by 6 pixels (verified). The right answer is neither: use LOD (an icon or impostor when zoomed out, a true-scale mesh up close) with a footprint assertion at the default camera (RN-05).

**X-15 · "Zero models": the V1 and V3 digests say no models exist.** **True of every repo, but not of the project.** V3's docs describe five supplied bus models (about 31k tris, 2.5–3.1 MB) and a reviewed "first vehicle batch" with an 859 KB texture, and no model file exists anywhere in the three repos' history (verified). The art exists somewhere outside git, and it is about 5× over budget.

**X-16 · Interchange radius: V1 code 130 m (`demand.worker.ts:350`) vs V3 specs 650 m.** **V1's 130 m is the real number.** V3's 650 m is an artefact of re-deriving from a lossy manual, and it would merge most nearby stops into one interchange. V2's snap-on-placement at 250 m is the more legible mechanism (EC-10).

**X-17 · V2 load time: "0.2 s / 204 ms" (v2-bible) vs "238–279 ms" (v2-code-ui).** These are different metrics: `loadEventEnd` vs boot to game state. **Both are right.** Either way it loads well under a second, with zero network requests.

**X-18 · V2's deployed build "never received the last 17 commits" (v2-bible) vs "16 commits ahead" (v2-code-ui).** **Right: 16, and 0 behind** (verified; `git rev-list --count origin/main..origin/archive/intralines-city-v1`).

**X-19 · V2's accessibility build time: "9.6 s" (`a942adb`) vs 33–38 s (review rebuilds).** Both are true at their dates. The scene count grew from 28 to 52 (`a13bf7d`) and then 66, which tripled the time. This is a direct instance of TS-08: a number that outlived its measurement.

**X-20 · Express "earned by construction" is a strength (v1-docs-history, v1-render-ui) but also an exploit (v1-code-sim, v3-design-specs, V2).** **Both.** The *predicate* (a shared rule, shown with its distance to goal) is right. The *thresholds* are too easy (a starter line qualifies) and the *reward* (flat ×1.5 subsidy plus half fare sensitivity) makes the fare slider max out. Keep the predicate; re-tune the thresholds; taper the reward (EC-05).

---

## 12. Top 15 lessons that must shape the final version (ranked)

1. **Close the money loop first, before any presentation work.** The first playable build has fare and subsidy income, per-km and wage costs, bus purchases, depot upkeep, a quarterly grade, a goal (contracts) and a failure floor. V3 wrote about 36k lines and never earned a dollar (`ledger.ts:217`, verified). V1 had the loop in its first session. *(GD-01, SC-05, SC-09)*
2. **A calm, map-first screen from day one, measured.** Chip row, a dock of 8 slots or fewer, a floating inspector absent at rest, rules on cursor cards, 8 words or fewer beside a control, ≤6% chrome at rest, tested at laptop sizes. V2's 41.2% chrome against V1's 5.3% (verified) drew the player's clearest verbatim feedback: "simplify, lighten it up". *(UX-01, UX-02, GD-07)*
3. **The map must read as a city, and demand must live where the map says it does.** Demand cells finer than the walk radius, drawn where riders actually come from. No disc cities where only about 25% of street nodes are within walking reach of demand (verified for V2). *(WD-06, EC-15, RN-02)*
4. **Kill the recurring exploit family with model invariants and a committed adversarial sweep.**
   - per-hour assignment and grading against the city's day;
   - per-boarding fares with linked trips;
   - coverage by service;
   - no truncation by id, and adding service never loses riders;
   - no slider with a dominant end-stop (express taper, a fare ceiling for captives).

   *(GD-13, EC-02…EC-07, EC-12)*
5. **Sim truth lives only in a deterministic, fixed-step sim running in a worker; the renderer interpolates.** No sim logic in map components, no frame-rate-dependent game state, no game loop in React state, and benchmarks on realistic networks. *(AR-04, AR-06, AR-07, AR-08)*
6. **Settle the world question in week one with a measurement.** The owner keeps choosing real cities (V1, which shipped three baked ones; V2 round 2; V3 #10; all verified). Bake one city (Boston, per V3's own instruction) with census demand through an offline pinned pipeline. Measure pack size, zone count, recompute and A* cost. Keep a seeded demo city in the same format for tests and instant play. *(WD-01, WD-03, WD-05, WD-07)*
7. **Updates and deploys solved on the first deploy.** Service worker with prompt-to-update, unpinned `index.html`, one deploy branch, CI that runs the same gates as local builds. Pick web vs desktop now; desktop needs its own updater. *(DP-01, DP-02, DP-03, DP-09)*
8. **Commit every test and harness, and test the shipped wiring.** An end-to-end smoke test on every PR (found → draw → run a day → check cash → reload). Visual tests at the default camera, proven to fail on a known-bad build. Nothing that matters lives only in uncommitted session files. *(TS-01, TS-06, TS-07, TS-08, PR-07)*
9. **One session owns `main`.** Small commits pushed often, never squashed, no parallel sessions on one branch, no checkpoint commits. *(PR-07, PR-08, PR-09, SC-02)*
10. **The owner plays every milestone, and the owner's questions come first.** Restate a complaint before building on it; serve the intent and say why. The only "verified" in V2 and V3 came from agents. The player's feedback was the most decision-relevant signal in the whole record: "simplify, lighten it up" (verbatim, `c1d73de`); "make the game more like" V1 (first recorded in `980759d`); the map should read as a city (a crew paraphrase attributed to the player); and updates must not break (`retain-assets.mjs:5`). *(TS-10, PR-11, PR-12, GD-07)*
11. **A small crew with shells, short specs, docs in lockstep.** Specs only for the next milestone, about 150 lines. A decision log with owner answers every week. Living docs updated in the same commit as the code, or deleted. *(PR-03…PR-06, SC-06)*
12. **Port proven code and exact formulas; do not re-derive from the manual.**
    - From V3: the ledger, save module, clock-pure bus motion and pathfinding.
    - From V1: the data pipeline, the demand worker shape and the deploy rules.
    - From V2: the wait model, coverage-by-service, the transfer ladder and snap, the undo design (with its fix), and the offline build checks.

    V3 lost V1's starting cash, connectability formula and cluster radius by reading the manual instead of the code. *(SC-02, X-09, X-16, EC-14)*
13. **Rules you can see.** One predicate per rule drives the sim, the money and the map. Placement tools draw their legal area. Refusals state the shortfall in money. Cut any mechanic that needs a second mechanic to explain it. *(GD-05, GD-06, UX-03, UX-06)*
14. **Buses visible and charming at the default camera; 3D only as presentation, after the loop.** Icon or impostor when zoomed out, a true-scale mesh up close, a footprint assertion, paper-identity design tokens, unlit data layers. Build the model pipeline only as far as the co-developer's or the owner's real files need. *(RN-03, RN-05, RN-06, RN-07, RN-08, GD-08)*
15. **Freeze scope now, with an explicit Out list.** Out for v1.0: company type, government lobbying, night palettes, collector and local bus lanes, the schedule assistant (designed away by target headways), Mk tiers, crowds and the station view. Delete dead categories (environment, staff). Hold tuning freezes in which no new system lands. *(GD-03, GD-09, GD-12, SC-06, SC-08, SC-11)*

---

## Appendix: Verification log (2026-10-12)

A skeptic pass checked the load-bearing claims against primary sources: the three repos, git history, GitHub Actions logs and fresh re-runs of the review harnesses (the verifier artifacts were not committed). No claim was refuted. 19 L-claims were confirmed and 6 were partly true (L02, L04, L05, L09, L14, L16); the partly-true ones now use the corrected wording.

| ID | Verdict | Entries | What changed |
|---|---|---|---|
| L01 | confirmed | Timestamp box, SC-01, SC-11, DP-02 | Tagged. Added "70 of 71 commits by Claude; `f57983c` is the only human one". "5 working days" became "5 calendar days (UTC), 6 in local time". |
| L02 | partly true | DP-04, TS-01 | Alias distance "3,606–5,031 m" became "2,818 / 3,606 / 5,031 m (2.8–5.0 km), geometry-dependent". Added that a collision needs deletes plus a reload, and that aliased stops are not charged. |
| L03 | confirmed | TS-01 | Tagged. Added the v1.15 origin and the manual's stale "2.2 points/day". |
| L04 | partly true | EC-02, GD-13 table | The whole V1 decline is attributed to the 4-stop cap; `LINES_LIMIT` had no effect in the bench. Added the bench-artefact note, the superset-network figures and the artificial-network caveat. The → Final now asks for a realistic-network measurement. |
| L05 | partly true | DP-01, X-06 | "8 client-side mechanisms in 8 commits before the SW" became six pre-SW layer commits, the SW (`9ea15e5`) itself, and `81f334d` after it. Noted that not all layers are client-side, gave the LOC breakdown (1,273 added, ~920 update-related, ~1,190 today including 345 of error UI), and named the second root cause. |
| L06 | confirmed | GD-03, GD-10, EC-05, EC-11, X-08 | Tagged. Added riders, revenue and cost split, the tick-integration check, the mechanic figure, the +$490 commit claim and the 1.93 peak load. |
| L07 | confirmed | SC-01, DP-03, X-01, X-18 | Tagged. Added commit authorship, the single Pages run at `8c01a18`, what that build lacked, and that the feedback came 17 minutes after it. |
| L08 | confirmed | SC-04, SC-06, UX-01, UX-02, UX-08 | Tagged. Added "of the map" vs "of the screen", 352 words below the fold, the spec's targets, the 8-word-cap derivation, and the revert in the working tree (no revert commit). |
| L09 | partly true | GD-07, WD-06, X-02, Top 15 #2 and #10 | Only "simplify, lighten it up…" is verbatim in `c1d73de`. "The map does not read as a city" is Claude's text attributed to the player. The "more like" quote now cites `980759d` (04:02 UTC), not `c1d73de`. |
| L10 | confirmed | GD-07, WD-07, X-12 | Tagged. Round 2 is described as a blanket "everything outstanding" request that reversed two trade-offs; the per-line-fare wording is the crew's. |
| L11 | confirmed | EC-02 | Tagged. Added the hub alightings, the cap-10 causation test, the V1 inheritance, and that no test or doc mentions the cap. |
| L12 | confirmed | EC-15, WD-06, Top 15 #3 | Tagged. "Intersections" became "street nodes" (25–26% / 36–37%; 27–29% / 37–39% with pseudo-zones). Hour gating ruled out. "The same line on the centres" became "five stops on the nearest centres". |
| L13 | confirmed | EC-03 | +461% is labelled as the crew's figure; the re-run gives +149% on the review harness's single line, and 13 boardings after the fix. |
| L14 | partly true | UX-09, TS-05 | "$760 vanished" became "$733 in an exact 32 h replay". Added the wear reset (2.2 → 0), redo not restoring the hash, and that the $760 run is not in the preserved log. |
| L15 | confirmed | AR-07, GD-09, TS-08 | V2 warm 65–90 became 65–100 ms; edit 148 became 137–148 ms; assistant 1.77 s became 1.70–1.77 s. Added a "not like-for-like" note. |
| L16 | partly true | EC-04 | +38% / +69% is re-labelled as V3's stylised spec arithmetic. V1 measured directly: +8–28% (plain stop), +29–62% (hub). `fare-check.mjs` checks the arithmetic, not an independent model. |
| L17 | confirmed | EC-05 | Tagged. Added the stylised-pair, revenue-only caveat and that the taper is still in the V2 archive head. |
| L18 | confirmed | SC-05, SC-11, PR-07 | Tagged. Added the side branch with 8 crew and spec commits (the lost history is the code commits). 7.5 weeks became 53 days (7.6 weeks). |
| L19 | confirmed | GD-01, SC-05, Top 15 #1 | Tagged. Added `kmDriven: 0` and that the stop refund is the only cash inflow. |
| L20 | confirmed | AR-03, TS-06, X-07 | Tagged. Added that `src/pwa` also has no tests, that no test imports `App`, and the `App.tsx:844` wiring. |
| L21 | confirmed | RN-05, TS-07, X-14 | "6 px bus" became "the frames differ by 6 pixels". Added `BUS_TARGET_FOOTPRINT_PX 30` and the test comment. |
| L22 | confirmed | RN-03, RN-07 | Tagged. Added the critical-path composition, app JS bytes, the second long task (113–119 ms), and that the figures are author-measured at commits that no longer exist. |
| L23 | confirmed | GD-07, WD-07, RN-07, RN-13, X-15 | Tagged. Added the full #10 wording and "bake Boston first". The 31k-tris figure is quoted without "each". |
| L24 | confirmed | GD-10 | Tagged. "Speed 3" became "top speed"; noted that there is no overnight skip. |
| L25 | confirmed | GD-10, EC-18, X-09 | Tagged. Added commit times and file and line references. |

**Salvage-matrix verdicts that also changed this ledger**

| ID | Verdict | Entries | What changed |
|---|---|---|---|
| M08, M09, M10 | confirmed | AR-18, TS-01 | Bundle figures tagged; worker and workbox chunks added; V2's "380 KB" is KiB (388,736 B); V1 `npm test` is 0.19 s. |
| M14 | confirmed | AR-07 | As L15. |
| M15 | confirmed | DP-06 | The "8-step load" wording became the actual outcome list. Both newer and unreadable saves are backed up. Added the gap that the bus counter is not persisted. |
| M16 | partly true | AR-04 | The visual cycle includes intermediate dwell; it omits the per-stop buffer, the extra terminal dwell and refuel. |
| M17 | confirmed | AR-04 | Tagged. Added "congestion never feeds ridership" and the `changelog.ts:91` docs drift. |
| M20 | confirmed | RN-04 | Tagged. Added per-model mesh counts, geometry counts, shared caches, and the `setNetwork` call sites. |
| M21 | partly true | WD-01, WD-03, WD-07, X-05, Top 15 #6 | "No version ever measured / its success never verified" became: V1's CI baked and shipped Worcester, Des Moines and Madison, but the packs are gitignored and cannot be re-measured from the repos. The WD-03 → Final now starts from V1's working bake. |
| M22 | partly true | DP-01, X-06, TS-11 | As L05. Added V3's exact PWA settings and the re-run offline check. |
| M23 | confirmed | SC-09, UX-06 | Tagged. |
| M24 | confirmed | UX-08, DP-03 | Tagged. Build times now about 33–35 s with the gate and 0.5 s without; added the CI "NOT RUN" log line. |
| M25 | confirmed | DP-09 | Tagged. Added the `BUILD_ID` mechanism, the missing `allowServiceWorkers`, and the CI details. |
| editor | n/a | SC-11 | Week arithmetic fixed (publish window is 12–20 weeks out, not 16–20). Not from a verdict. |
