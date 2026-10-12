# interbus

interbus is the final version of the Intralines bus game by Miticept Studios (the owner and a co-developer). It is a calm browser bus-company tycoon on a tilted paper-map city: you draw lines between where people live and work, set how often buses run and what each line charges, and keep the company solvent while the city offers contracts and grades you every quarter.

The game has been built three times before, all in August 2026 and mostly by Claude at the owner's direction:

| Version | Repo | What it taught |
|---|---|---|
| V1 "Intralines Bus Simulator" | `bobbyjohn-nil/Intralines` | The look and the core loop that the owner keeps pointing back to |
| V2 "Intralines City" | `bobbyjohn-nil/Intralines_City_dep` (branch `archive/intralines-city-v1`) | A debugged economy with goals, on a screen that was too busy |
| V3 "Intralines_City" | `bobbyjohn-nil/Intralines_City` | Solid engineering, but the game never produced income |

This repo starts fresh and reuses what worked. "interbus" is the repo, package and save-key name; the game's title is still open, and the plan recommends keeping "Intralines" (decision D5 in [PLAN.md](PLAN.md)).

## Status

**Planning.** As of 2026-10-12 there is no game code yet. The targets are a playable prototype on Dec 20 2026 and a public release on itch.io and GitHub Pages on Feb 7 2027, with Feb 28 as the hard deadline. A play link will appear here after the first deploy.

## Documents

| Document | What it is | Read it when |
|---|---|---|
| [PLAN.md](PLAN.md) | The plan the studio works from: scope, stack, calendar, cut list and the decisions still open. Its §0 is a one-page summary | First |
| [docs/history/versions.md](docs/history/versions.md) | Names, repos, dates and fate of V1–V3 | When an older name or repo comes up |
| [docs/history/lessons-ledger.md](docs/history/lessons-ledger.md) | What the three versions taught, as lessons with stable IDs (GD-01, SC-05, EC-12 …) and a ranked top 15 | When a plan, spec or commit cites a lesson ID |
| [docs/history/salvage-matrix.md](docs/history/salvage-matrix.md) | Subsystem-by-subsystem comparison, what to port from each version with exact source paths, the known-bug register (K01–K58) and the stack options | Before porting code, or when a K-number is cited |

The three `docs/history/` files are a frozen record of the review done on 2026-10-12. They are not edited; new decisions go in `docs/DECISIONS.md` once it exists.
