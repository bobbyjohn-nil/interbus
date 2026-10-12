# Versions and names: what was built before interbus

The bus-company tycoon in this repo has been built three times before, under several similar names, in three GitHub repos, all in August 2026. This page explains which name means what, where each version lives, what it could do and why it stopped. The evidence behind each claim is in [lessons-ledger.md](lessons-ledger.md) (lesson IDs such as GD-01) and [salvage-matrix.md](salvage-matrix.md) (bug IDs K01–K58 and the salvage inventory).

Times are UTC. Commits authored by the owner (author `bobbyjohn-nil`) record the owner's local time (−0400), so they were converted; the ledger's timestamp note explains why this matters (X-02).

"V1", "V2" and "V3" are labels used by this review. They are not version numbers the games used. V1's own changelog runs v0.1–v0.5 and v1.0–v1.18, so "v1.18" means the last release of V1, not anything to do with V2 or V3.

---

## 1. Names at a glance

| Name | What it is | Easily confused with |
|---|---|---|
| **Transit Lines** | V1's working title on its first day (`b8c47c6`, Aug 3), renamed the same evening (`418e47b`). | — |
| **Intralines Bus Simulator** | V1's game title, v0.1 → v1.18. V3's game bible (`studio/GAME.md`) also uses this title, because V3 rebuilt V1 from V1's manual. | V3, which reuses the name |
| **Intralines City** | V2's game title (`Gaming/GAME.md`). It lives in the repo `Intralines_City_dep`. | The repo `Intralines_City`, which is V3, not V2 |
| **Intralines_City** | The repo that holds V3. The game inside calls itself "Intralines Bus Simulator" (bible) and "Intralines" (page title). | V2's title "Intralines City" |
| **Intralines_City_dep** | The repo that holds V2. The record does not explain the `_dep` suffix. | — |
| **The True Gamer** | Not a game. The placeholder title of a generic game-dev crew template: a game bible with every field `TBD` and, in V3's repo, eleven agent definitions. It was committed on Aug 10 to V3's repo (`79cb89d`) and, 28 minutes later, to V2's repo (`e1352f6`, bible only). V2's `Gaming/CLAUDE.md:1` still reads "# The True Gamer". | — |
| **Miticept Studios** | The studio: the owner (GitHub `bobbyjohn-nil`) and a co-developer. Not a game and not a repo. See §6. | — |
| **interbus** | This repo, where the final version is built. "interbus" may or may not be the final title. | — |
| **Riverton** | A seeded procedural demo city used by V1 (`public/cities/demo.json`) and V3 (`generateRiverton.ts`, seed 42). Not a version. | — |

Two more traps:
- A branch named `claude/gamedev-orchestrator-improve-mhs8ug` exists in **both** V2's and V3's repos, with different contents (§8).
- V1's repo has two branches, `claude/city-bus-manager-game-rmdul2` and `claude/bus-appearance-update-stability-rnemi4`; both point at the same commit, `7af45b1`.

---

## 2. Timeline

| When (2026, UTC) | Version | What happened | Ref |
|---|---|---|---|
| Aug 3 15:26 | V1 | First commit, as "Transit Lines": a bus company on real census-data city maps. Electron shell and a GitHub Pages deploy the same afternoon | `b8c47c6`, `44e1547`, `502fd30` |
| Aug 3 17:04–17:12 | V1 | A Jekyll Pages workflow, the only human-authored commit in V1, overwrites the game deployment; it is removed 8 minutes later | `f57983c`, `b26804d` (DP-02) |
| Aug 3 21:38 | V1 | Renamed "Intralines Bus Simulator" | `418e47b` |
| Aug 4–5 | V1 | v0.3 → v1.13; nine versions on Aug 5 alone (depots, report cards, fuel, timetables, founding) | SC-01 |
| Aug 5 15:04 → Aug 10 18:32 | V1 | Six boot and update recovery commits, then a service worker | DP-01 |
| Aug 10 02:51–15:59 | V1 | v1.14 → v1.18 | `505720d` … `fe14a93` |
| Aug 10 20:37 | V3 repo | "The True Gamer" crew template committed to `Intralines_City` | `79cb89d` |
| Aug 10 20:47 | V1 | Complete game manual, `docs/MANUAL.md`, later V3's specification | `840a661` |
| Aug 10 21:05–21:21 | V2 | The same template committed to `Intralines_City_dep`; the V2 crew starts building | `e1352f6`, `26ab377` |
| Aug 11 13:58 / 15:51 | V2 | Round 2 ("everything outstanding") and round 3 (nine depth features) requested | `776f41d`, `5cb5856` (GD-07) |
| Aug 12 03:22 | V2 | The only Pages deploy, of `main` at `8c01a18` | DP-03 |
| Aug 12 03:39–04:02 | V2 | Player feedback: "simplify, lighten it up"; "make the game more like" V1's site | `c1d73de`, `980759d` (GD-07) |
| Aug 12 03:46 | V2 | The crew is split onto its own `orchestrator` branch | `f833589` |
| Aug 12 05:10–05:37 | V3 | Repo reframed as a build-from-spec rewrite, with V1's manual as the spec; crew grows to 15 agents | `676a1f1` → `841b176` (SC-02) |
| Aug 12 05:16 | V2 | Last commit, a "clean pause" | `5e24bcb` (SC-04) |
| Aug 12 22:57 | V3 | Last commit on V3's side branch (bible section on imported 3D models) | `3720c9b` |
| Aug 12 → Aug 20 | V3 | All V3 game code written locally; its history was never pushed | PR-07 |
| Aug 13 16:46–17:04 | V1 | Last commits: a design overview and drop-in slots for custom bus models | `a779d47`, `7af45b1` |
| Aug 20 04:54 | V3 | One parentless squash commit pushed to `main`: 187 files, 36,576 insertions | `dc63602` (SC-05) |
| Aug 20 → Oct 12 | all | No commit in any of the three repos for 53 days | SC-11 |
| Oct 12 | interbus | This review of V1–V3; `interbus` has no commits yet | — |

The three versions overlapped. V3's crew was set up 10 minutes before V1's manual landed, V2 started 18 minutes after that, V1 kept committing until Aug 13, and V3 was reframed in the same half hour as V2's last commit (SC-02, X-02).

---

## 3. V1: "Intralines Bus Simulator" (v0.1 → v1.18)

| | |
|---|---|
| **Dates** | Aug 3 – Aug 13, 2026. Commits on 5 calendar days (UTC): Aug 3, 4, 5, 10 and 13 (SC-01). |
| **Repo and tip** | `bobbyjohn-nil/Intralines`, branch `claude/city-bus-manager-game-rmdul2`, tip `7af45b1`. Cited as `Intralines@7af45b1:path`. |
| **Authors** | 71 commits: 70 by Claude across two sessions, 1 human (`f57983c`) (SC-01, PR-08). |
| **Stack** | React 18, TypeScript, Vite 5.4, MapLibre GL 4.7, three.js 0.169, zustand 4, an Electron 33 shell; demand model in a Web Worker; real US census cities baked into city packs. About 15.9k source lines. |
| **Where it ran** | GitHub Pages; V2's feedback cites it as `bobbyjohn-nil.github.io/Intralines/`. Whether that site is still live was not checked. The Electron build was only ever built locally, unsigned and without an updater (DP-09). |

**What was playable.** The whole game loop. You found a company, place a depot on industrial land, buy buses and hire drivers, draw street-snapped lines (each stop costs $4k), set timetables, service hours and fares, then watch daily money and a quarterly report card (GD-01). It shipped three real cities baked in CI (Worcester, Des Moines, Madison) plus the Riverton demo city (WD-01, WD-07), a home menu with saves and settings, a founding screen, a paused start, express lines and fares riders react to. A starter line nets +$2,810/day on today's code (EC-11).

**Why it stopped.** No document records a decision to stop. The record shows about 14 of 71 commits spent on hosting, deploy and bake work; the demand view redone about 8 times; a 1,905-line store that kept growing; and two rewrites started in the middle of v1.18 (SC-03, X-06). V2's list of what to do "better than v1.18" names the gameplay gaps: a static world, profit as the only goal, timetable tedium, no undo, and a 10–40 MB wait for real cities (SC-03).

**Best artifacts** (all at `Intralines@7af45b1`):
- `docs/MANUAL.md` (724 lines; every mechanic and number of v1.18) and `docs/DESIGN.md` (pillars and tone). The product reference (salvage D01).
- `docs/img/*.jpg`: 29 screenshots of the look the owner asked V2 to return to, for example `docs/img/line-editor.jpg` and `docs/img/station-view.jpg` (RN-01).
- `CLAUDE.md:20-47`: the GitHub Pages deploy gates (DP-02).
- `src/game/data/pipeline.js` with `scripts/test-pipeline.mjs`: the fixture-tested real-data pipeline (WD-02).
- `src/game/sim/demand.worker.ts`: the demand model's shape, run off the main thread (EC-01, AR-07).
- `src/ui/icons.tsx`, `src/ui/BusWipe.tsx` and the splash in `index.html`: the brand mark and charm moments (GD-08, RN-08).
- Commit messages that explain why, with numbers from the sim (PR-14).

**Lessons.**
- The core loop closed within the first days, and V1's gameplay was not why it stopped; its infrastructure churn and gaps were (GD-01, SC-03).
- One store holding rules, copy and persistence let copies of a rule drift apart: reused ids after a delete and reload (K01, DP-04), buses on new lines that never wear (K02), and a traffic model that only moves the animation (AR-01, AR-04, TS-01).
- Updates were fixed by stacking recovery layers instead of solving them on the first deploy (DP-01, DP-02).
- Real census cities were the differentiator and the most fragile subsystem; only an offline, pinned bake is safe (WD-01, WD-03, WD-07).
- Agree the question a view answers before rebuilding it: the demand view was redone about 8 times, once for a complaint that had been misread (UX-12, PR-11).

---

## 4. V2: "Intralines City"

| | |
|---|---|
| **Dates** | Aug 10 21:05 – Aug 12 05:16, about 32 hours, in one Claude Code session (X-01). |
| **Repo and tip** | `bobbyjohn-nil/Intralines_City_dep` (private), branch `archive/intralines-city-v1`, tip `5e24bcb`. Game code is under `Gaming/`. Cited as `Intralines_City_dep@archive/intralines-city-v1:Gaming/path`. |
| **Authors** | 107 commits: 102 by Claude, 5 by `bobbyjohn-nil` (the template and four pull-request merges) (SC-01). |
| **Stack** | Plain JavaScript and Canvas 2D, no dependencies, built into one offline HTML file (1.33 MB, about 0.2 s to load, no network requests). Procedural cities in three archetypes: grid, river and radial. An 11-agent Claude crew run by an orchestrator skill. 27,212 lines of game plus 11.7k lines of tools; 67 tests (SC-01, AR-18). |
| **Where it ran** | Deployed once to GitHub Pages, from `main` at `8c01a18`, which is 16 commits behind the archive and lacks the player feedback, the layout spec, the city texture and the service-span fix (DP-03). On 2026-10-12 the GitHub API reports the repo as private with Pages not enabled. |

**Starting point: "The True Gamer".** V2 began from a generic template that `bobbyjohn-nil` committed as `e1352f6` ("Orchestrator"): a game bible titled "The True Gamer — Game Bible" with every field `TBD`. Claude then added the crew and filled the bible (`26ab377`). The same template, with its agents, had gone into V3's repo 28 minutes earlier (`79cb89d`); those agents were written for action games (hitstop, screenshake, waves, audio buses), not a transit tycoon (PR-04).

**What was playable.** The full loop on procedural cities, plus more depth than V1: live events, city contracts as goals, a schedule assistant, per-stop analytics, undo and redo, per-line fares that riders react to, bus lanes, regional rail stations, tourist demand, transfers, a government lobbying board and a private-company-or-agency choice (GD-02, GD-04, EC-09, GD-12). There was no title screen; the game auto-founds a company (UX-07). The interface covered 41.2% of the map at rest with 271 words of standing text, against V1's 5.3% and none (UX-01).

**Why it stopped.** It was paused, not finished. The screen had become hard to read; the accessibility gate blocked the layout fix the owner asked for; the look had drifted from V1; each new system exposed older economic defects; and the crew was split off because "the crew is reusable and the game is not" (`f833589`) (SC-04). V3's reframe happened in the same half hour (SC-02).

**Best artifacts** (all at `Intralines_City_dep@archive/intralines-city-v1`):
- `Gaming/docs/design/*.md`: 22 specs that double as an exploit catalogue; `screen-layout.md` is the unbuilt but measured layout for a calm screen, and `undo-redo.md`, `service-span.md`, `transfer-boost.md` and `report-thresholds.md` hold measured design decisions (UX-02, GD-06, PR-12).
- `Gaming/src/30-sim.js`: the wait model, coverage by service, the fare taper and fare elasticity (EC-05, EC-07, EC-08, EC-09).
- `Gaming/src/20-city.js`: deterministic generators, connectivity repair, CSR A*, the congestion field and the IL-PACK codec (GD-11, AR-16, salvage S12–S13).
- `Gaming/tools/build.js` (offline build audit) and `Gaming/tools/playtest.js` (cold-context replay and contract tests) (DP-10, AR-06, TS-02).
- `Gaming/reference/screenshots/`: V1.18 reference shots and a same-viewport shot of V2 (`41e2020`).
- `Gaming/BACKLOG.md`: the player's feedback in the record (`c1d73de`).
- Branch `orchestrator` (`f833589`): the crew on its own, without the game.

**Lessons.**
- Measure every economic decision and hunt exploits with a standing adversarial sweep; V2 found the recurring exploit shape, paying or grading over a different window than the rider experiences (GD-02, GD-13, EC-03, EC-12, PR-01).
- A screen that covers 41.2% of the map drew the player's clearest feedback: "simplify, lighten it up" (UX-01, UX-02, GD-07).
- Running the sim on the main thread cost 65–100 ms per recompute against its own 25 ms budget (AR-07).
- Specs and feature rounds outran tuning: 55,761 words of specs, and nine features in about six hours followed by a whole round of exploit fixes (SC-06, SC-08).
- Demand placed only at district centres made the map invite lines that board no one (EC-15, WD-06).

---

## 5. V3: "Intralines_City" (build-from-spec rewrite)

| | |
|---|---|
| **Dates** | Aug 10 20:37 (crew template) – Aug 20 04:54 (squash). Reframed as a rewrite on Aug 12 05:10–05:37. |
| **Repo and tip** | `bobbyjohn-nil/Intralines_City`, branch `main`, tip `dc63602`: one parentless squash commit (187 files, 36,576 insertions). Cited as `Intralines_City@dc63602:path`. A side branch, `claude/gamedev-orchestrator-improve-mhs8ug` (tip `3720c9b`), keeps 8 earlier crew and spec commits (PR-07). |
| **Authors** | A 15-agent Claude crew built it locally. The template, the reframe and the squash are authored as `bobbyjohn-nil`; `3720c9b` is authored by Claude. |
| **Stack** | Strict TypeScript, React 18, Vite 5, three.js 0.185 (one 3D scene, "Route B"), `vite-plugin-pwa`, Vitest. 316 tests (259 node and 57 rendered). One 811 kB app chunk, 226.5 kB gzipped (AR-03, AR-18, X-07). |
| **Where it ran** | No deployment is recorded: the repo has a CI workflow but no deploy workflow. |

**Approach.** V3 rebuilt V1 from V1's manual, with "no source inherited" (`841b176`). Its bible is titled "Intralines Bus Simulator — Game Bible". The crew kept a numbered decision log, `studio/DECISIONS.md`, with ⚠︎ REVIEW flags for the owner (PR-03). It records two owner choices: a light map (#5), and Boston, LA, Orange County and Houston as featured cities, with Boston baked first (#10) (GD-07, WD-07, RN-13). The bible also sets a feel target, "Subway Builder: sleek and modern, but usable" (`studio/GAME.md:190-193`, dated Aug 12); it does not say whose words those are (RN-08).

**What was playable.** You can draw lines on the streets of a tilted 3D Riverton, watch buses move, pause and change speed, pay costs, save, reload and play offline. You cannot earn money: income is hard-coded to zero, so cash only falls (GD-01, K40). At the default camera the buses change 6 pixels of the frame (RN-05). Timetables, fares, fleet purchases, report cards, real cities and a home menu exist only as specs or backlog items. The depot tool charges $150k and draws nothing (UX-06, K43).

**Why it stopped.** No income after about 36k lines; a 3D pivot ("Route B") started in the middle of Milestone 2; two sessions went to making a bus visible; and the scope, deadline and Out list were all TBD. No commit landed in any repo after Aug 20 (SC-05).

**Best artifacts** (all at `Intralines_City@dc63602`):
- `src/game/economy/ledger.ts`: integer-cent ledger, zero drift over 10,000 ticks (AR-03).
- `src/game/save/*`: save envelope with backups, monotonic id counters and migrations (DP-06).
- `src/game/buses/*`: bus position as a pure function of the clock (AR-03, RN-11).
- `src/game/depots/*`: siting, placement and dead-heading economics (EC-13).
- `src/pwa/*` and the `VitePWA` block in `vite.config.ts`: prompt-to-update offline play, re-verified with the network cut (DP-01, TS-11).
- `src/game/integration.test.ts`: cross-module invariant tests (TS-09).
- `studio/DECISIONS.md`, `studio/docs/design/demand-model.md`, `fares-and-express.md` and `studio/docs/baselines.md`: decision-log format, pre-solved economy maths and a performance-baseline method (salvage D04).

**Lessons.**
- Close the money loop before any presentation work: 36,576 lines and not a dollar of income (GD-01, SC-05, SC-09).
- Pure, typed sim modules are worth porting nearly verbatim (AR-03, DP-06, DP-01).
- Choose the renderer once, after the loop is playable, and assert that a bus is visible at the default camera (RN-03, RN-05, TS-07).
- Push small commits often and never squash history the docs cite; six hashes in V3's docs resolve in no repo (PR-07).
- A module is done only when the shipped app uses it and an end-to-end test covers it; V3 had no tests of its UI or app shell (SC-09, TS-06).
- A generic 15-agent crew produced about 366 KB of crew prose, roughly one byte for every byte of shipping TypeScript (PR-04, PR-05).

---

## 6. Miticept Studios

Miticept Studios is the studio the owner runs with a co-developer. It is not a game and not a repo. The studio's target: prototype in Nov–Dec 2026, publish in Jan–Feb 2027; interbus is the game planned for it.

- No Miticept-named repository or code exists on GitHub. None of the three game repos mentions "Miticept" in any commit message, or in any tracked file at a branch tip.
- Claude wrote nearly all the code in the record: 70 of V1's 71 commits and 102 of V2's 107 (SC-01).
- The record does not say what the co-developer did. V3's docs describe five supplied 3D bus models that are in no repo; who made them is not known (RN-07, X-15).
- The co-developer's role, the team's weekly hours and the publishing platform are open questions, not facts.

---

## 7. interbus (this repo)

`bobbyjohn-nil/interbus` is where the final version is built, from a fresh start. The review's recommendation is to port proven code from V1–V3 rather than fork any of them, because no version is a sound base to fork (SC-02, salvage §0). The plan, the ledger's Top 15 (lessons-ledger §12) and the salvage inventory (salvage-matrix §B) say what comes across. Cite earlier code as `repo@ref:path`, for example `Intralines@7af45b1:src/game/store.ts`, `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js` or `Intralines_City@dc63602:src/game/economy/ledger.ts`.

---

## 8. Where to find things

| Repo | Branch | Tip | What lives there |
|---|---|---|---|
| `bobbyjohn-nil/Intralines` | `claude/city-bus-manager-game-rmdul2` (default) | `7af45b1` (Aug 13) | V1, all 71 commits: source, `docs/MANUAL.md`, `docs/DESIGN.md`, `docs/MODELS.md`, `docs/img/*.jpg`, `CLAUDE.md`, the Pages deploy workflow, the Electron shell |
| `bobbyjohn-nil/Intralines` | `claude/bus-appearance-update-stability-rnemi4` | `7af45b1` | Same commit as the default branch |
| `bobbyjohn-nil/Intralines_City_dep` (private) | `archive/intralines-city-v1` | `5e24bcb` (Aug 12) | V2 in its final state: `Gaming/src`, `Gaming/tools`, `Gaming/docs/design` (22 specs), `Gaming/reference/screenshots`, `Gaming/BACKLOG.md` |
| `bobbyjohn-nil/Intralines_City_dep` | `claude/gamedev-orchestrator-improve-mhs8ug` | `5e24bcb` | Same commit as the archive branch |
| `bobbyjohn-nil/Intralines_City_dep` | `main` | `8c01a18` (Aug 12) | The build deployed to Pages once; 16 commits behind the archive (DP-03) |
| `bobbyjohn-nil/Intralines_City_dep` | `orchestrator` | `f833589` (Aug 12) | The 11-agent crew alone (`.claude/agents`, the gamedev skill, a README), no game |
| `bobbyjohn-nil/Intralines_City` | `main` | `dc63602` (Aug 20) | V3 as one squash commit: `src/`, tests, `studio/` (bible, `DECISIONS.md`, backlog, design specs, baselines), the 15-agent `.claude/` crew, CI |
| `bobbyjohn-nil/Intralines_City` | `claude/gamedev-orchestrator-improve-mhs8ug` | `3720c9b` (Aug 12) | 8 crew and spec commits from Aug 10–12 (template, reframe, 3D model intake); no game code |
| `bobbyjohn-nil/interbus` | `main` | none yet | The final version, and this folder |

**What was not reviewed.** This history covers only what is pushed to the three GitHub repos above. Versions that exist only on the team's own computers were not reviewed. Some work is known to have existed outside git and may still be on a local machine; it is worth recovering if so:
- V3's local commit history from Aug 12–20; DECISIONS #71 mentions about 24 local commits (PR-07).
- V1's Playwright suites (play-flow, save-compat, stale-page, update, worker), which lived in a Claude session's working folder (PR-07).
- V2's uncommitted chip-row layout diff and its balance scripts (PR-07, TS-08).
- The five 3D bus models V3's docs describe (RN-07, X-15).
