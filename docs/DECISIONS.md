# Decisions

The owner's decisions for interbus, and the questions still open. [PLAN.md](../PLAN.md) §13 lists them; this file wins if the two disagree. Lesson and bug IDs (WD-07, K15 …) are in [docs/history/](history/lessons-ledger.md).

**How this file works.** Only the owner decides; Claude records the answer, the date and the reason. A decision is never edited away: changing one adds a new dated entry that names the one it replaces. Until an open item is answered, the plan assumes its recommendation. A late answer takes effect from the next week and never reopens finished work without a cut elsewhere.

---

## Decided

### D1 · Real cities first; Boston is the first and test city

- **Decided:** 2026-10-12, by the owner: "lets do real cities first, starting with boston as the test city."
- **What it means:** Boston is on `main` from week 1, baked offline from 2020 census blocks, LODES 8.4 (2023) and one pinned OpenStreetMap extract, behind numeric bake gates (PLAN §5). The play area is "Inner Boston" unless D11 says otherwise, or the Nov 8 trigger shrinks it to a core box that passes the bake gates (the extent flexes; Boston stays). Procedural cities survive only as small test fixtures. v1.0 has one city; January's third-city slot is gone, and a second real city comes after v1.0.
- **Why:** The owner chose real cities in all three earlier versions ([WD-07](history/lessons-ledger.md)). Measured on 2026-10-12, Inner Boston fits the 1,000-cell and 16,000-node budgets with headroom ([WD-09](history/lessons-ledger.md)). Static files and a pinned, dispatch-only bake remove V1's API failures by construction ([WD-01](history/lessons-ledger.md), [WD-03](history/lessons-ledger.md)).
- **How to reverse:** Shrinking the extent (D11) is the cheap partial reversal. Going back to procedural cities before the pack format freezes (Sun Nov 8) costs about a week: a generated city in the same pack format ([WD-05](history/lessons-ledger.md)) replaces Boston, and the mini-Boston fixture stays for tests. After Nov 8 it is 1.1 work, because saves are tied to their city.

### D2 · A flat 2D mode that tilts into 3D, with a far more detailed map

- **Decided:** 2026-10-12, by the owner: "have a flat 2d mode, but also be able to pan to 3d. more detailed maps that have a sleek but detailed intricate look."
- **What it means:** MapLibre GL JS, pinned exactly (6.11.2), is the only renderer. The map opens flat and top-down; the same camera tilts into 3D (the `T` key, a two-word chip, or right-drag), at 25–60° and zoom 14 or closer. The basemap is detailed OpenStreetMap vector tiles in one PMTiles file per city: every building, street, path, water body and land use, with no transit features (D17). Close-zoom lane markings (z≥17) are drawn from OSM lane tags in January and are the first January item cut (PLAN §8 rule 9). three.js draws only the artist's bus models, inside MapLibre's own layer, loaded lazily: proven behind a flag in week 5, shipped from January. The old Oct 25 fallback to V3's three.js scene is dropped.
- **Why:** One camera does both views over vector tiles ([RN-01](history/lessons-ledger.md)). V3's scene had no tile pipeline and tripled the critical path ([RN-03](history/lessons-ledger.md), [SC-05](history/lessons-ledger.md)).
- **How to reverse:** Before Sun Nov 1, dropping the tilt is a deletion (no extrusions, no model path), not a rewrite. After Nov 1 there is no renderer change ([SC-05](history/lessons-ledger.md)). Partial reversals are on the cut list: two fixed tilt states (cut 5) and no 3D models in v1.0 (cut 3). When a trigger reaches either, it becomes the owner's question that week, with a recommendation, and the answer is a new dated entry here.

### D3 · GitHub Pages now; Steam eventually

- **Decided:** 2026-10-12, by the owner: "For now, have a github pages but eventually have a steam release."
- **What it means:** v1.0 ships free on GitHub Pages (target Sun Feb 7 2027, when the owner ships it). itch.io is dropped. From week 1 the code has the seams that make Steam a packaging job: one `src/platform/` module fenced by a lint rule, an async save store whose export file equals a desktop save, and an updates adapter that is inert on desktop. The Steam workstream is a proposal from Mon Mar 1 2027 (D15).
- **Why:** Pages needs no store accounts before February; V1's desktop build had no updater, a fake build id and no signing ([DP-09](history/lessons-ledger.md), [K15](history/salvage-matrix.md)); the seams cost about a day now and a rewrite later.
- **How to reverse:** Adding itch.io back is a zip upload plus an iframe save test, about two days. Going Steam-first would add Electron, account onboarding and the 30-day wait after paying the fee before any release ([Steam Direct](https://partner.steamgames.com/steamdirect), via search excerpts, checked 2026-10-12, as in PLAN §11; check before relying on it), and would move the first release past February.

### D6 · The co-developer is the 3D modeler and artist

- **Decided:** 2026-10-12, by the owner: the co-developer "is the 3d moddler/artist and will be making designs to be used."
- **What it means:** The artist makes the bus models the game uses (`metro-40`, `sparrow`, `goliath`, then a depot) to the contract in [docs/art/MODELS.md](art/MODELS.md), a draft the artist amends. The first box-level blockout is due Sun Oct 25; the checker, icon renderer and CI job are built around it in week 5, CI only; the 2D bus icons are rendered from the models, so 2D and 3D match. Later: landmark models and the Steam capsule art.
- **Why:** Two earlier pipelines were built before any model existed and never received one ([RN-07](history/lessons-ledger.md), [X-15](history/lessons-ledger.md)). Building around the first real file avoids that.
- **How to reverse:** Nothing in the game depends on models. Without any model the game uses a code-drawn top-down icon. Cut 3 (no 3D models in v1.0; 3D shows icons over extruded buildings) still uses the artist's models for the 2D icons, and is the owner's call when its trigger fires.
- **Still open:** the artist's hours and delivery route (D6 below).

### D8 · The look: "sleek but detailed and intricate"

- **Decided:** 2026-10-12, by the owner (same words as D2).
- **What it means:** "Quiet base, loud data" (PLAN §8): the whole real city in low-chroma tones with fine linework that appears with zoom; saturated colour only for the player's network, buses and overlays; road hierarchy by width and casing; one typeface; a light map with night as a tint. Which palette ships, light or dark, and the font are D13.
- **Why:** References the plan proposes: V3's recorded "Subway Builder: sleek and modern, but usable" target, whose author is not recorded, and Protomaps' light style. Both keep the city quiet and the network loud. The owner's own reference screens are due Sun Oct 25 (PLAN §14 item 14). One palette avoids doubling colour QA ([RN-13](history/lessons-ledger.md), [RN-14](history/lessons-ledger.md)).
- **How to reverse:** The style is generated from one token file, so a different palette is a token swap until the Jan 17 content freeze.

### D17 · No existing transit: the city starts with no buses, trains or ferries

- **Decided:** 2026-10-12, by the owner: "since this is a game that is starting from zero bus system, have existing bus lanes be replaced with regular lanes so that there is no existing system", then, offered (A) remove all public transit, (B) rail as scenery only, or (C) keep the T running: "go with a for now".
- **What it means:** The bake removes every public-transport feature from the sim graph and the map tiles (PLAN §5): bus lanes and bus-only lanes become general lanes, bus-only surface streets open to all traffic, dedicated busways and bus tunnels go, and bus stops, stations, shelters, routes, all rail (subway, light rail, commuter rail, Amtrak, freight spurs) and ferries are removed. Former rail corridors draw as plain ground. Logan Airport stays as a destination. Gate G10 fails any bake where a transit feature survives. The demand model's bus–car–walk choice runs from scratch, with no allowance for today's T riders. MBTA data stays a bake-time calibration input only.
- **Why:** The player builds Boston's bus network from nothing, so the map must not show one that already exists. A red bus lane then always means the player paid for it.
- **How to reverse:** "For now" means this can return later as a feature: the T (or rail as scenery) would be new bake rules, a drawing layer and, for a running T, a transfer and competition model in the sim, sized and decided on its own. Before the pack format freezes (Sun Nov 8) keeping rail as scenery only is about a day; after it, any change is a city rebake and 1.1 work.

### CL · Versions only on the owner's say

- **Decided:** 2026-10-12, by the owner: "create a changelog that will only make versions with my say."
- **What it means:** `CHANGELOG.md` follows Keep a Changelog 2.0.0. Every player-visible change adds a line under Unreleased. A version exists only when the owner types `/ship <version>` ([.claude/skills/ship/SKILL.md](../.claude/skills/ship/SKILL.md), which Claude cannot start); it merges a `Release v<version>` commit through a pull request and tags that commit. `node scripts/changelog.mjs check` runs in CI as the required status check "Versions only via /ship" and fails any version not added by its own `Release v<version>` commit, any `v*` tag not on that commit, and any later edit to released notes. It cannot tell who made that commit; the CLAUDE.md rule and the owner's yes inside `/ship` are the guard. Every v1.0 date in the plan is a target for the owner's `/ship`, never automatic; milestone tags such as `prototype` never start with `v`.
- **Why:** V1's "one version per session" rule produced 24 versions in about 8 days and two sessions both cut v1.18 ([PR-15](history/lessons-ledger.md), [PR-08](history/lessons-ledger.md)).
- **How to reverse:** Remove the CI workflow and the skill. Not recommended.

---

## Open

| # | Question | Options | Recommendation | Answer by | What it changes |
|---|---|---|---|---|---|
| D4 | Steam price, and what Steam adds over the free web build | Free; a low price for convenience, cloud saves and achievements; a higher price with Steam-only cities or models | Decide from comparable games you check on the store | **Sun Jan 31 2027**, with D15, since a Steam-only city (1–2 Claude-weeks) changes the window | The store page; whether web and Steam content differ |
| D5 | Title | Intralines; Interbus; new | **Intralines**, after a name check | **Sun Jan 3**, before any store page | Splash and landing page in week 13; save keys stay `interbus.*` |
| D6 | The artist's hours and delivery route; playtester names | Hours a week; a PR with Git LFS or a shared folder you commit from; names for P2 and the soft launch | About 20–35 hours from Oct 18 to Jan 10; PR with LFS; 3 names for P2, 10 for the soft launch | Hours and route **Sun Oct 18**; names **Sun Nov 22**; the artist's Feb–Mar hours (capsule art) **Sun Jan 31** | The art dates in PLAN §10; Steam's March |
| D7 | Save-format choices | Start cash $310k / $400k / $500k; headway or bus count; fare per line or company; V1 import | **$310k; peak and off-peak headway; per-line fares; no import** ([X-09](history/lessons-ledger.md), [X-12](history/lessons-ledger.md), [X-13](history/lessons-ledger.md)) | **Sun Nov 1** (the plan assumes the recommendation until then) | The save schema and first fixture |
| D9 | The revised Out list (PLAN §2) | Accept, or move items | **Accept**; anything moved in names something moved out | **Sun Oct 18** | `docs/SCOPE.md` and the cut list |
| D10 | Failure severity | The PLAN §3 floor; gentler; none | **The §3 floor** | **Sun Nov 15** | Week 6's failure floor and restart |
| D11 | Boston's play area | Inner Boston (94 km², ~800 cells); R2 (105 km², ~900 cells); later all of Boston with variable 350/700 m cells | **Inner Boston**; R2 only if recompute stays ≤100 ms p95 in week 3 | **Sun Oct 18**; re-decided **Sun Nov 1** | The extent, the tiles and the bake gates. All of Boston changes the "350 m cells" call. If the Nov 8 pack trigger fires, R2 and all of Boston become 1.1 |
| D12 | Web origin | (a) a custom subdomain; (b) a studio organisation's `github.io`; (c) stay on the account's `github.io` and redeploy V1 with a narrower service worker | **(a)**: V1 on the same origin can wipe interbus's offline copy, and moving later strands saves | **Sun Oct 25**; live before the Jan 22 soft launch | DNS and `CNAME` in week 2 |
| D13 | Map palette, light or dark, font | Warm-neutral tokens; pure V1 paper; a dark palette. Noto Sans or Inter | **Warm-neutral and light** (the owner asked V3 for a light map, [RN-13](history/lessons-ledger.md)); font is the owner's call | **Sun Nov 8**, side by side on Boston | Tokens only; one palette ships |
| D14 | Licences | Art: who holds copyright and on what terms. City files: publish under ODbL. Code: all rights reserved and source-available, or open with art and data excluded. A signed owner–artist agreement | **Art all rights reserved, holder as the two of you agree; publish the city files; write the rest down** | Art line **Sun Oct 18** (before the first `.glb`, due Oct 25); city files **Sun Nov 8**; repo licence and signed agreement before the Steam store page is submitted (**Sun Mar 21 2027**) | `art/LICENSE.md`, public release assets, `README.md` |
| D15 | Steam window, account holder, macOS, a Windows test machine | A: Next Fest June 2027, release Tue Jul 13 2027. B: release Tue May 11 2027. C: autumn 2027. Who holds the Steamworks account. macOS yes or no. Which Windows PC tests the build | **A; Windows first; no macOS at launch**; the holder is whoever can complete legal-name, tax and bank onboarding; name the Windows PC. Under cut 3, A only | **Sun Jan 31 2027**, with D4 | Onboarding from the week after v1.0 ships; the fee by Sun Mar 7 (≥30 days before release) |
| D16 | Is the Dec 20 prototype a version? | The non-`v` milestone tag `prototype`; the owner's `/ship 0.1.0` | Either; the plan assumes the tag | **Sun Dec 20** | The changelog's first version |
| — | A GitHub tag ruleset on `v*` that blocks update and deletion | On or off | **On**, in week 1 (PLAN §14 item 2). It cannot tell who pushes; it keeps a released tag from being moved or deleted, which `/ship` already forbids | **Sun Oct 18** | Released tags stay where they were made |

---

## Measurements to record (week 1–3)

Filled in as they are measured, with the date and the commit:
- Boston's map file size (`pmtiles extract --dry-run`) and whether GitHub Pages answers Range requests with `206` and no `Content-Encoding`.
- Gzip size per chunk, the menu's critical path and the first map frame under software GL.
- Whether census.gov, LEHD and Geofabrik accept downloads from GitHub's runners.
- The number of Inner Boston buildings with OSM `height` or `building:levels` (week 2). Rule: under about half, the Overture height join goes into the r1 bake in week 5 and off cut 1; otherwise it is dropped. Record the count and the result here.
- Sessions merged against sessions planned (PLAN §10), on Sun Oct 18, Oct 25 and Nov 1.
- Recompute time on Boston (decides D11's second look on Nov 1).
