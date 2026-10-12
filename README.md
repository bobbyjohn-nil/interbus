# interbus

interbus is the final version of the Intralines bus game by Miticept Studios (the owner and a co-developer, who is the studio's 3D artist). It is a calm bus-company tycoon on real Boston: the city's streets, buildings, river and harbour are drawn from real data with no existing buses, trains or ferries (you build the network from zero), and people live and work where the 2020 census and real commute records put them. You draw lines between them, set how often buses run and what each line charges, and keep the company solvent while the city offers contracts and grades you every quarter. The map reads flat and crisp in 2D, in light or dark, and tilts into 3D on the same camera, where the artist's buses glide between real buildings.

The game has been built three times before, all in August 2026 and mostly by Claude at the owner's direction:

| Version | Repo | What it taught |
|---|---|---|
| V1 "Intralines Bus Simulator" | `bobbyjohn-nil/Intralines` | The look and the core loop that the owner keeps pointing back to, and real census cities |
| V2 "Intralines City" | `bobbyjohn-nil/Intralines_City_dep` (branch `archive/intralines-city-v1`) | A debugged economy with goals, on a screen that was too busy |
| V3 "Intralines_City" | `bobbyjohn-nil/Intralines_City` | Solid engineering, but the game never produced income |

This repo starts fresh and reuses what worked. "interbus" is the game's title (decision D5) as well as the repo, package and save-key name; "Intralines" remains the name of the three earlier versions.

## Status

**Planning.** As of 2026-10-12 there is no game code yet. The owner decided on 2026-10-12: real cities first with Boston as the test city, a flat 2D map that tilts into 3D in light and dark themes, a GitHub Pages preview now and Steam (about US$10) as the only release, and versions only on the owner's say ([docs/DECISIONS.md](docs/DECISIONS.md)).

| Date | Target |
|---|---|
| Sun Nov 1 2026 | First fare dollar, on a Back Bay–Longwood clip of Boston |
| Sun Dec 20 2026 | Playable prototype (milestone tag `prototype`) |
| Sun Feb 7 2027 | v1.0 complete on the preview (the owner may `/ship 1.0.0`); hard deadline Feb 28 |
| From Mon Mar 1 2027 at the earliest | Steam, the only public release, about US$10 (a proposal: release Tue Jul 13 2027; timing is decided before Steam work starts) |

**Where to play:** the web build is a preview for the owner and the artist to look at the game and test the work. Every merge to `main` deploys it to GitHub Pages, and an on-screen chip shows the commit it was built from. It has no offline mode, and when the save format changes, older saves are set aside and a new game starts. The game will be released on Steam, built from the same game and city files.

## Documents

| Document | What it is | Read it when |
|---|---|---|
| [PLAN.md](PLAN.md) | The plan the studio works from: scope, stack, calendar, cut list and the decisions still open. Its §0 is a one-page summary | First |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every decision the owner has made (what, why, when, how to reverse it) and the open questions with their deadlines | Before changing scope, look or platform |
| [CHANGELOG.md](CHANGELOG.md) | What changed for players. A numbered version exists only when the owner types `/ship <version>`; CI fails any version not added by its own `Release v<version>` commit | When something a player would notice changes |
| [docs/art/MODELS.md](docs/art/MODELS.md) | The model contract for the artist: format, axes, material slots, budgets, Blender export settings, delivery dates and licensing | Before making or checking a 3D model |
| [CLAUDE.md](CLAUDE.md) | Working rules for Claude sessions in this repo | At the start of every Claude session |
| [docs/history/versions.md](docs/history/versions.md) | Names, repos, dates and fate of V1–V3 | When an older name or repo comes up |
| [docs/history/lessons-ledger.md](docs/history/lessons-ledger.md) | What the three versions taught, as lessons with stable IDs (GD-01, SC-05, WD-07 …) and a ranked top 15 | When a plan, spec or commit cites a lesson ID |
| [docs/history/salvage-matrix.md](docs/history/salvage-matrix.md) | Subsystem-by-subsystem comparison, what to port from each version with exact source paths, the known-bug register (K01–K58) and the stack options | Before porting code, or when a K-number is cited |

The three `docs/history/` files are a frozen record of the review done on 2026-10-12 and are not edited. New decisions go in `docs/DECISIONS.md`.

## Data and licences

Boston's map and demand are built from OpenStreetMap (© OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright)) and U.S. Census Bureau data (2020 Census; LODES 8.4). The plan publishes the baked city files under the ODbL, with the recipe that builds them in this repo. The interface font is Afacad Flux, © 2023 The Afacad Project Authors, under the SIL Open Font License 1.1 ([google/fonts](https://github.com/google/fonts/tree/main/ofl/afacadflux), whose `METADATA.pb` and `OFL.txt` were checked 2026-10-12). The code and the art get their own licences (both are decision D14); until then, all rights are reserved.
