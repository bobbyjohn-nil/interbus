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

**Week 1 of coding.** Since 2026-10-12 the game opens on Boston's map, flat, in the light theme, with its build number on screen; the rest of week 1 is in PLAN §14. The owner decided on 2026-10-12: real cities first with Boston as the test city, a flat 2D map that tilts into 3D in light and dark themes, a GitHub Pages preview now and Steam (about US$10) as the only release, a free demo for macOS and Windows at Steam Next Fest in June 2027, copyright held by Miticept Studios (its two members jointly) with the art under an open licence and the code all rights reserved, and versions only on the owner's say ([docs/DECISIONS.md](docs/DECISIONS.md)).

| Date | Target |
|---|---|
| Sun Oct 18 2026 | Coding under way: Boston's map opens on the preview |
| Sun Nov 1 2026 | First fare dollar, on a Back Bay–Longwood clip of Boston |
| Sun Nov 8 2026 | First line the owner draws and runs |
| Sun Dec 20 2026 | Playable prototype (milestone tag `prototype`, not a version) |
| Sun Feb 7 2027 | v1.0 complete on the preview (the owner may `/ship 1.0.0`); hard deadline Feb 28 |
| Sun Mar 21 2027 | Steam Coming Soon page public (Apr 11 at the latest) |
| Mon May 24 2027 | Free Steam demo for macOS and Windows; Next Fest Jun 14–21 |
| Tue Jul 27 2027 (proposed) | Steam, the only public release, about US$10, after the Summer Sale |

**Where to play:** the web build is a preview for the owner and the artist to look at the game and test the work. Every merge to `main` deploys it to GitHub Pages, and an on-screen chip shows the commit it was built from. It has no offline mode, and when the save format changes, older saves are set aside and a new game starts. The game will be released on Steam for macOS and Windows, built from the same game and city files, after a free demo at Next Fest.

## Develop

Node 22 and Python 3 are needed (Python builds the font and clips the bake's map data).

```bash
npm ci             # install the pinned dependencies
pip install --require-hashes --no-deps -r tools/bake/requirements.txt   # pyosmium, for the bake
npm run fonts      # build Afacad Flux and the map glyphs into public/fonts/ (pinned, cached)
npm run cities     # download each city's tile file named in cities/index.json, checking its hash
npm run dev        # the game at http://localhost:5173
npm run check      # typecheck, lint, unit tests, script tests, changelog check
npm run build && npm run e2e   # production build, then the browser tests
npm run bake:plan  # what Boston's bake reads, writes and checks; no network
npm run bake:fixture           # re-cut mini-Boston from the mirrored sources (downloads ~0.5 GB once)
```

Every merge to `main` deploys the preview to GitHub Pages; the build chip in the bottom-right
corner shows which commit you are looking at. City tiles come from the dispatch-only
**City tiles (manual)** workflow, never from players' browsers. The bake's inputs (OpenStreetMap,
2020 census blocks, LODES commutes) are fetched once by the dispatch-only **Bake sources (manual)**
workflow, which records their hashes in `cities/<city>/sources.lock.json` and mirrors them to a
release; every bake reads only that mirror. `tools/bake/fixtures/mini-boston/` is every input
clipped to Back Bay–Longwood, committed so tests never wait for the full bake.

## Documents

| Document | What it is | Read it when |
|---|---|---|
| [PLAN.md](PLAN.md) | The plan the studio works from: the decisions still open (at the top), scope, stack, calendar and cut list. Its §0 is a one-page summary | First |
| [docs/SCOPE.md](docs/SCOPE.md) | What v1.0 is on one page: what is in, what is out, the milestones and what is never cut | When deciding whether something belongs in v1.0 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | The open questions with their deadlines (first), then every decision the owner has made (what, why, when, how to reverse it) | Before changing scope, look or platform |
| [CHANGELOG.md](CHANGELOG.md) | What changed for players. A numbered version exists only when the owner types `/ship <version>`; CI fails any version not added by its own `Release v<version>` commit | When something a player would notice changes |
| [docs/art/MODELS.md](docs/art/MODELS.md) | The model contract for the artist: format, axes, material slots, budgets, Blender export settings, delivery dates (the Steam store art included) and licensing | Before making or checking a 3D model |
| [docs/playtests/PROTOCOL.md](docs/playtests/PROTOCOL.md) | How every playtest runs: the build SHA, the measures and the notes template | Before a playtest |
| [CLAUDE.md](CLAUDE.md) | Working rules for Claude sessions in this repo | At the start of every Claude session |
| [docs/history/versions.md](docs/history/versions.md) | Names, repos, dates and fate of V1–V3 | When an older name or repo comes up |
| [docs/history/lessons-ledger.md](docs/history/lessons-ledger.md) | What the three versions taught, as lessons with stable IDs (GD-01, SC-05, WD-07 …) and a ranked top 15 | When a plan, spec or commit cites a lesson ID |
| [docs/history/salvage-matrix.md](docs/history/salvage-matrix.md) | Subsystem-by-subsystem comparison, what to port from each version with exact source paths, the known-bug register (K01–K58) and the stack options | Before porting code, or when a K-number is cited |

The three `docs/history/` files are a frozen record of the review done on 2026-10-12 and are not edited. New decisions go in `docs/DECISIONS.md`.

## Data and licences

Boston's map and demand are built from OpenStreetMap (© OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright)) and U.S. Census Bureau data (2020 Census; LODES 8.4). The plan publishes the baked city files under the ODbL, with the recipe that builds them in this repo. The interface font is Afacad Flux, © 2023 The Afacad Project Authors, under the SIL Open Font License 1.1 ([google/fonts](https://github.com/google/fonts/tree/main/ofl/afacadflux), whose `METADATA.pb` and `OFL.txt` were checked 2026-10-12). Copyright in the game, art included, is held by Miticept Studios, its two members jointly (decision D14). The code is all rights reserved and not open source: while the repo is public, its source is visible, and GitHub's Terms of Service let other GitHub users view and fork it on GitHub ([§D.5](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), checked 2026-10-12 through search excerpts; check before relying on it), but no other use is licensed (D20). The studio's own art (the artist's models under `art/models/`, the icons generated from them and the Steam store art under `art/store/`) goes under an open licence, recommended CC BY 4.0, named in `art/LICENSE.md` once chosen; until then it is all rights reserved too. Reference images in `art/refs/` and anything listed in `art/CREDITS.md` keep their own licences and credits (D20).
