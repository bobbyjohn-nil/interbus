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
- **Since replaced in part:** D4 and D12 (both 2026-10-12, below) replace "v1.0 ships free on GitHub Pages" and the updates adapter: the Pages build is a preview, and Steam is the only release.

### D4 · Steam will be the only version, at about US$10

- **Decided:** 2026-10-12, by the owner: "Steam version will eventually be the only version, it will have a relatively low price around 10 dollars, but it is un important for now."
- **What it means:** Steam is the only public release, priced around US$10; the exact price, regional prices and discounts wait for the store page. There is no public web release: Feb 7 becomes "v1.0 complete on the preview", a game-complete build the owner may choose to `/ship 1.0.0`, and the public site, landing page, public credits page, the Jan 22 soft launch for about ten people and the `LAUNCHED` switch are gone, while the web release checklist becomes a v1.0 completion checklist (PLAN §4, §10, §11). The Steam workstream (Claude's code from Mon Mar 1 2027 at the earliest, release Tue Jul 13 2027) stays a proposal under D15, and no Steam work is added now. Replaces D3's "v1.0 ships free on GitHub Pages" and the open question of what Steam adds over a free web build.
- **Why:** The owner's call. Dropping the public web release frees about 0.75 Claude-weeks in weeks 15–17, more than dark mode's 0.6 (D13); D12 counts the rest of the saving.
- **How to reverse:** A public web release later needs an offline app, an update prompt, web save migrations and a final origin before any outside player saves (about 1–1.5 Claude-weeks), plus a decision on how a free web build relates to the paid Steam one.

### D5 · The title is interbus

- **Decided:** 2026-10-12, by the owner: "D5 go with interbus."
- **What it means:** The game's title is interbus, matching the repo, the package and the `interbus.*` save keys; "Intralines" stays the name of V1–V3. Check the name before the Steam store page: INTERBUS is also the name of an industrial fieldbus that Phoenix Contact has offered since 1987, standardised in EN 50254 and IEC 61158 and hosted by PROFIBUS & PROFINET International since 2011 ([Wikipedia](https://en.wikipedia.org/wiki/INTERBUS), via a search excerpt, checked 2026-10-12; also [Phoenix Contact's blog](https://blog.phoenixcontact.com/marketing-gb/tag/interbus/), via search excerpts). A web search on the same date found no Steam game called Interbus; Steam's own search ([store.steampowered.com/search/?term=interbus](https://store.steampowered.com/search/?term=interbus)) could not be opened from the session, so run it before the store page. Neither is a trademark search; check before relying on it.
- **Why:** The owner's call; one name everywhere.
- **How to reverse:** Before the store page, a new title changes the splash, the window title and the docs; save keys and the repo can keep `interbus`. After it, the store page and capsule art change too.

### D6 · The co-developer is the 3D modeler and artist

- **Decided:** 2026-10-12, by the owner: the co-developer "is the 3d moddler/artist and will be making designs to be used."
- **What it means:** The artist makes the bus models the game uses (`metro-40`, `sparrow`, `goliath`, then a depot) to the contract in [docs/art/MODELS.md](art/MODELS.md), a draft the artist amends. The first box-level blockout is due Sun Oct 25; the checker, icon renderer and CI job are built around it in week 5, CI only; the 2D bus icons are rendered from the models, so 2D and 3D match. Later: landmark models and the Steam capsule art.
- **Why:** Two earlier pipelines were built before any model existed and never received one ([RN-07](history/lessons-ledger.md), [X-15](history/lessons-ledger.md)). Building around the first real file avoids that.
- **How to reverse:** Nothing in the game depends on models. Without any model the game uses a code-drawn top-down icon. Cut 3 (no 3D models in v1.0; 3D shows icons over extruded buildings) still uses the artist's models for the 2D icons, and is the owner's call when its trigger fires.
- **Still open:** the artist's hours and delivery route (D6 below).
- **Since answered:** 2026-10-12, in the next entry.

### D6 (second part) · Hours untracked; PRs with Git LFS; the owner and the artist are the playtesters

- **Decided:** 2026-10-12, by the owner: "D6: hours unimportant, agree with recommendation with everything else, with me and [the artist] as the playtesters, more to be added later."
- **What it means:** The artist's hours are not tracked; the hour estimates in [docs/art/MODELS.md](art/MODELS.md) §10 only size the work. Deliveries come as a pull request under `art/models/` with Git LFS (the recommendation), not a shared folder. The playtesters are the owner and the artist, with more added later; no tester is invented. P2 (Dec 12–13) and P3 (Jan 22, which replaces the soft launch) are sessions the two of them run: each starts a fresh save and writes notes before talking. The owner watches every build and is never untold, so the artist is the fresher tester and skips the M4 milestone check (Dec 6) to come to P2 fresher. With two insiders the untold targets and P2's onboarding trigger are weak signals; the week-9 scripted pacing run ([GD-10](history/lessons-ledger.md)) is the objective check (PLAN §12 risk 6). No merge reaches `main` from 18:00 the day before a playtest until its notes are committed, and each session records the build chip's SHA at its start and end ([PR-13](history/lessons-ledger.md)). Once outside players are named, they take P2 and P3 first (PLAN §9); in the week of Dec 21 Claude asks the owner to name one or two for P3 or confirm that P3 stays the two of them (recommendation: name them). Under the Steam proposal, outside players reach the beta branch before the store page.
- **Why:** The owner's call. The PR route puts every file through the art check and LFS from the first delivery ([DP-11](history/lessons-ledger.md)).
- **How to reverse:** Naming players upgrades P2 and P3 in any week. A shared-folder route costs the owner a few minutes per delivery to commit the file.

### D7 · Derived starting cash; peak, off-peak and overnight headways; no import

- **Decided:** 2026-10-12, by the owner: "D7: Starting cash should scale with the amount of money it takes for you to start a bus line or two, doesn't have to be decided on now, otherwise peak, off peak and overnight head way periods, no imports."
- **What it means:**
  - **Starting cash is derived, not a fixed number:** k × the cost of a typical starter line (a depot, four stops and the buses its peak and off-peak headways need), computed from the config rows so it follows prices, and written once at founding as the ledger's first row ("Founding capital"), so a later retune never changes an existing save (I1: cash = Σ ledger rows). k is tuned in week 9, not now. At V1's prices one Sparrow line costs about $261k ($150k depot, a $95k Sparrow, $16k of stops), so k ≈ 1.2 reproduces V1's $310k ([X-09](history/lessons-ledger.md)); "two lines" means one shared depot plus two lines' stops and buses, k ≈ 1.43. The cheapest four-bus line costs about $546k, and it must cost at least 1.15× the starting cash so [GD-11](history/lessons-ledger.md)'s middle game survives, which caps k near 1.8; k's config-test band is 1.0–1.8. Invariant I10 asserts three things: the sweep's best profitable first line, found independently of the reference line, fits the starting cash and turns a daily profit within a quarter (shown failing with a fare that makes every first line lose money); the best four-bus line the sweep finds costs ≥1.15× the starting cash; and k stays in its band.
  - **Three headway periods per line: peak, off-peak and overnight**, replacing the plan's "one city service day (05:00–24:00)". Period times are tunables shared by every line (proposed: peak 06:30–09:30 and 16:00–19:00, off-peak the rest of 05:00–24:00, overnight 00:00–05:00). A new game starts at 05:00 on day 1; founding sets peak and off-peak to one headway and overnight to off, so the checklist still asks for one number. Format 1 holds all three headways from the Nov 8 freeze even if the overnight control lands a week later.
  - **Recommendation applied with it** (the owner can overrule it): peak and off-peak always run, at most 60 minutes apart (a tunable); overnight runs no more often than off-peak, or is set to "no service", so neither a night-only nor a night-mostly line can exist; each limit is one `sim/rules` predicate with a cursor-card refusal. Riders board only in periods a line runs. Contracts, the report card and the "needs N buses" count read peak and off-peak (05:00–24:00), the count being the most any running period needs; overnight counts at most toward Coverage. This keeps V2's midnight-only exploit closed ([EC-03](history/lessons-ledger.md): +461% in the crew's sweep, +149% on the review's re-run) along with its family: I3 checks per-period conservation (riders boarding a line in a period ≤ trips generated in that period's hours); I11 fails if a HEADWAY contract can be met by one period alone; the sweep runs "daytime at the longest headway, overnight at the shortest" and "overnight toggled alone", each of which must earn less than the best all-period setting, a check shown failing with V2's whole-day ridership restored; stop capacity and spill are checked per period.
  - **Recompute with three periods:** paths are searched once and shared, and only the per-period logit and assignment repeat. The week-3 bench measures that form, and the per-period figure is recorded below.
  - **No V1 save import.**
  - **Fare scope** was not in the answer, so per-line fares, the recommendation, stand; the owner can change this before the format freeze on Sun Nov 8.
- **Why:** A derived amount stays right as prices are tuned. Three periods give the player a night choice without reopening EC-03.
- **How to reverse:** A fixed starting cash is one config row. Before Sun Nov 8, dropping or reshaping the periods is a config and schema change of about a session; after it, a save-format bump (web saves are set aside on a bump anyway, D12).

### D8 · The look: "sleek but detailed and intricate"

- **Decided:** 2026-10-12, by the owner (same words as D2).
- **What it means:** "Quiet base, loud data" (PLAN §8): the whole real city in low-chroma tones with fine linework that appears with zoom; saturated colour only for the player's network, buses and overlays; road hierarchy by width and casing; one typeface; a light map with night as a tint. Which palette ships, light or dark, and the font are D13.
- **Why:** References the plan proposes: V3's recorded "Subway Builder: sleek and modern, but usable" target, whose author is not recorded, and Protomaps' light style. Both keep the city quiet and the network loud. The owner's own reference screens are due Sun Oct 25 (PLAN §14 item 14). One palette avoids doubling colour QA ([RN-13](history/lessons-ledger.md), [RN-14](history/lessons-ledger.md)).
- **How to reverse:** The style is generated from one token file, so a different palette is a token swap until the Jan 17 content freeze.
- **Since amended:** D13 (2026-10-12, below) adds a dark theme and picks the font, replacing "a light map" and the one-palette reasoning above.

### D9 · The revised Out list is accepted

- **Decided:** 2026-10-12, by the owner: "D9: accept recommendation."
- **What it means:** The Out list in PLAN §2 stands; anything moved in names something moved out. With D4 and D12 it also lists the public web release (itch.io, a custom domain, offline play, the update prompt, web save migrations, the landing page) as dropped. `docs/SCOPE.md` copies it in week 1.
- **Why:** One city and one loop done well ([GD-03](history/lessons-ledger.md), [GD-12](history/lessons-ledger.md), [SC-05](history/lessons-ledger.md)).
- **How to reverse:** A new dated entry that moves an item in and names the one moved out.

### D10 · Failure: the PLAN §3 floor

- **Decided:** 2026-10-12, by the owner: "D10: Accept recommendation."
- **What it means:** Cash may go negative to a credit limit with one lender; five days below it ends the run, with a countdown chip and **Restart this quarter** from an automatic save. Sandbox turns failure off. Built in week 6 (M3).
- **Why:** A real floor gives money weight, and a way back keeps the game calm ([GD-06](history/lessons-ledger.md)).
- **How to reverse:** A gentler floor (a longer countdown, or no end) is a tunable until the Dec 6 system cutoff; no failure at all is Sandbox as the default.

### D11 · Boston's play area: Inner Boston

- **Decided:** 2026-10-12, by the owner: "D11: accept recommendation."
- **What it means:** The extent is Inner Boston (94 km², about 800 cells at 350 m). R2 (105 km², about 900 cells) is used only if recompute stays ≤100 ms p95 in week 3; that is a measurement on Sun Nov 1, not a new question. If the Nov 8 pack trigger fires, a core box that passes the bake gates ships and R2 and all of Boston become 1.1.
- **Why:** Measured on 2026-10-12, Inner Boston leaves 20% headroom under the 1,000-cell cap and 42% under the 16,000-node cap ([WD-09](history/lessons-ledger.md), [AR-15](history/lessons-ledger.md)).
- **How to reverse:** R2 or all of Boston (with variable 350/700 m cells) after v1.0; before Nov 8 a different extent is a rebake.
- **Since clarified:** 2026-10-12, with D7's three headway periods, the 100 ms check times the three-period recompute (PLAN §5).

### D12 · The web build is a preview; saves don't matter yet

- **Decided:** 2026-10-12, by the owner: "D12: saves don't matter for the moment, the purpose of the web version is for me to b able to look at the game and test your work."
- **What it means:** The Pages build is a preview for the owner, and the artist, to look at the game and test Claude's work (PLAN §6, §11).
  - It stays on `bobbyjohn-nil.github.io/interbus`: no custom domain, DNS or `CNAME`.
  - No service worker, PWA, offline mode or update prompt. Assets are content-hashed, and an on-screen **build chip** (12 px, in the OSM-attribution corner) shows the commit SHA, so every test report names its build.
  - **`index.html` cannot be served uncached on Pages**, which departs from the first reading of this answer. Pages sets its own cache headers, reportedly `Cache-Control: max-age=600` on every file, and a site cannot change them ([Stack Overflow question 14798589](https://stackoverflow.com/questions/14798589/github-pages-http-headers), via a search excerpt, not an official page, checked 2026-10-12; the week-1 check records the real headers). Only a reload is sure to fetch the newest build.
  - **Old builds keep their files.** This is the preview's answer to "bugs out every time it updates" ([DP-01](history/lessons-ledger.md)). Pages replaces the whole site on each deploy, so a tab opened before a merge, or an `index.html` still in a cache, would ask for the previous build's hashed chunks (MapLibre, the model chunk, the sim worker) and city file, get 404s and fail mid-session; V1 hit exactly this (`1624f3b`, `d66e6dc`), and the PWA that later replaced V1's fix is dropped here. The deploy therefore copies the last two deploys' hashed `assets/` and city files into the new artifact, porting V1's `Intralines@7af45b1:scripts/retain-assets.mjs` (`d66e6dc`); an old tab runs its own build intact, and the chip shows which. If a file is gone anyway, `src/platform/web` turns the failed dynamic import, worker load or tile read (`vite:preloadError`, a 404) into one card, "This build was replaced · Reload". That is error recovery, not an update prompt: there is no service worker and nothing swaps. A committed e2e test opens build A, deploys build B to a local server, then loads every lazy chunk and a tile read in the A tab with no error, and fails without the retention step (PLAN I15, [TS-04](history/lessons-ledger.md)). About 0.25 session in week 1.
  - Every merge to `main` deploys, always; the deploy's last step loads the live URL with a cache-busting query and checks that the build chip and `version.json` show the SHA. The `LAUNCHED` switch is dropped, and tags publish nothing. No merge lands from 18:00 the day before a playtest until its notes are committed (D6).
  - On a schema change, older web saves are set aside under a backup key, as V3 does ([DP-06](history/lessons-ledger.md)), with a one-line notice and a fresh start; no web migrations are written. The save envelope and the Export session file record the build SHA, so Claude replays a bug report at that commit, and Export session can attach a set-aside save. Save migrations and update robustness move to the Steam build and start with its beta.
  - City tiles load by HTTP Range with ordinary browser caching and no Cache Storage copy. The week-1 Pages Range check stays, with a whole-file download as its fallback.
  - `src/platform/` stays: the desktop build still needs it.
  - With no service worker and no Cache Storage, V1's same-origin service worker can no longer wipe anything that matters, so the old reason for a custom origin is gone.
  - Replaces the open origin question and, with D4, D3's updates adapter.
- **Why:** The owner's stated purpose. Together with D4, removing the web release saves about 1.25 Claude-weeks (PLAN §10): about 0.5 in weeks 1–9 (PWA, tile cache, domain, nightly update test) and 0.75 in weeks 15–17 (soft launch, landing page, public release checklist). Keeping old deploys' files costs back about 0.1.
- **How to reverse:** Making the web build public again needs an offline app, an update prompt, migrations and a final origin before any outside player saves, about 1–1.5 Claude-weeks (V3's PWA, [S08](history/salvage-matrix.md)).

### D13 · Light and dark modes; the font is Afacad Flux

- **Decided:** 2026-10-12, by the owner: "D13: have light and dark modes, font Afacad Flux."
- **What it means:**
  - Light and dark themes from **one style generator and two token sets**. The theme follows the system setting, with a toggle in settings (week 14), and changes no sim number, save byte or rule verdict (I16). Replaces D8's "a light map with night as a tint" and its one-palette reasoning.
  - Palette and contrast tests ([S21](history/salvage-matrix.md)) run on each theme that exists: light from week 1, dark from week 13, when its token set lands; until then the generator only has to accept a token set, and no dark work starts early (it would be look work before M3). They run in three states, light at day, light at the darkest tint step, and dark, because two palettes double colour QA ([RN-13](history/lessons-ledger.md), [RN-14](history/lessons-ledger.md)). Bus icon ink and halo and the player's line colours are theme tokens the tests cover; I12's geometry runs once, on light, with bus-versus-base contrast checked per theme; I13 runs on each theme. If the dark runs push PR checks past 8 minutes, they go nightly. On Sun Nov 8 the network hues are checked against the light set and a placeholder dark land and void (two hex values), so January adds only the dark base tokens.
  - No separate night palette (the recommendation): the day/night tint applies in light mode and is off or much reduced in dark mode. In both themes the clock chip names the period (Peak, Off-peak, Overnight) and a line with overnight off fades while it is stopped, from one `sim/rules` predicate, so the time-of-day read never depends on the tint (RN-13's warning, made sharper by D7's overnight period).
  - The light token set is picked on Sun Nov 8 (warm-neutral or V1 paper, side by side on Boston) and ships with the prototype; the dark set lands in the January look week (week 13). Dark mode makes the close-zoom lane markings the likely January cut. If dark is not green by the content freeze (Jan 17, or Jan 31 under the M5 trigger), it becomes the owner's question that week, with the recommendation that dark waits for Steam, in which case P3, the v1.0 checklist and the theme tests run light only; a decided item is never cut automatically.
  - **Afacad Flux** is a variable font (weight 100–1000, slant −14 to 14) under the SIL Open Font License 1.1, designed by Kristian Möller (Dicotype), © 2023 The Afacad Project Authors, with the subsets latin, latin-ext and vietnamese, per its folder in the Google Fonts repository ([google/fonts ofl/afacadflux](https://github.com/google/fonts/tree/main/ofl/afacadflux); [`METADATA.pb`](https://raw.githubusercontent.com/google/fonts/main/ofl/afacadflux/METADATA.pb) and `OFL.txt`, checked 2026-10-12; the fonts.google.com page could not be opened from the session). The folder ships only the variable `AfacadFlux[slnt,wght].ttf` (437,512 bytes on 2026-10-12), so the static instances are generated. The game self-hosts it because it loads only its own files. The build pins a google/fonts commit and the file's SHA-256 like a city source, cuts static 400 and 600 instances with a pinned fontTools `varLib.instancer`, and subsets them into two Latin woff2 files for the UI. In a trial subset with fontTools 4.66.1 on 2026-10-12 (not committed; the week-1 script re-measures it), the two came to about 23–29 KB together depending on the range, against 85–98 KB for the whole variable font and 35–42 KB with only slant pinned; the fonts count toward the 200 KiB menu budget. The same instances feed MapLibre's SDF glyph PBFs: all 256 ranges, empty where the font has no glyphs, so no glyph request 404s, with the glyph tool chosen in week 1. Every style `text-font` is one of the two Afacad stacks, and `glyphs` and `sprite` are relative (a style test). The licence text ships with the credits.
- **Why:** The owner's call. One generator, a fixed three-state test matrix and theme-blind geometry tests keep the second palette from doubling the manual work.
- **How to reverse:** Dropping dark deletes a token set and its test runs; a different font is a token and a glyph build, until the Jan 17 content freeze.

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
| D14 | Licences | Art: who holds copyright and on what terms. City files: publish under ODbL. Code: all rights reserved and source-available, or open with art and data excluded. A signed owner–artist agreement | **Art all rights reserved, holder as the two of you agree; publish the city files; write the rest down** | Art line **Sun Oct 18** (before the first `.glb`, due Oct 25); city files **Sun Nov 8**; repo licence and signed agreement before the Steam store page is submitted (**Sun Mar 21 2027**) | `art/LICENSE.md`, public release assets, `README.md` |
| D15 | Steam window, account holder, macOS, a Windows test machine; the preview and the repo's visibility before the store page | A: Next Fest June 2027, release Tue Jul 13 2027. B: release Tue May 11 2027. C: autumn 2027. Who holds the Steamworks account. macOS yes or no. Which Windows PC tests the build. The preview and the repo's visibility: a free demo, a trimmed build, taken down, or a private repo on a paid plan (on GitHub Free a private repo gets no Pages, PLAN §12 risk 14; the repo's code, city files and art are public already). If the preview stays up: ask Valve at onboarding whether a freely playable web build affects Next Fest | **A; Windows first; no macOS at launch**; the holder is whoever can complete legal-name, tax and bank onboarding; name the Windows PC. Under cut 3, A only. The preview and repo: decide with the store page | **Before Steam work starts; by Sun Feb 7 to keep the Jul 13 proposal** (onboarding, capsule art and the Electron smoke start Feb 8). Low priority since D4 | Onboarding after v1.0 is complete; the fee ≥30 days before release; the preview and repo (PLAN §12 risk 14) |
| D16 | Is the Dec 20 prototype a version? | The non-`v` milestone tag `prototype`; the owner's `/ship 0.1.0` | Either; the plan assumes the tag | **Sun Dec 20** | The changelog's first version |
| — | A GitHub tag ruleset on `v*` that blocks update and deletion | On or off | **On**, in week 1 (PLAN §14 item 2). It cannot tell who pushes; it keeps a released tag from being moved or deleted, which `/ship` already forbids | **Sun Oct 18** | Released tags stay where they were made |

---

## Measurements to record (week 1–3)

Filled in as they are measured, with the date and the commit, each by a committed script ([TS-08](history/lessons-ledger.md)):
- Boston's map file size (`pmtiles extract --dry-run`); whether GitHub Pages answers Range requests with `206` and no `Content-Encoding`; and the `Cache-Control` it sends for `index.html`, hashed assets and `version.json` (D12).
- Gzip size per chunk, the menu's critical path including its font bytes (D13), and the first map frame under software GL.
- Whether census.gov, LEHD and Geofabrik accept downloads from GitHub's runners.
- The number of Inner Boston buildings with OSM `height` or `building:levels` (week 2). Rule: under about half, the Overture height join goes into the r1 bake in week 5 and off cut 1; otherwise it is dropped. Record the count and the result here.
- Sessions merged against sessions planned (PLAN §10), on Sun Oct 18, Oct 25 and Nov 1.
- Recompute time on Boston in the three-period form, total and per period (on Nov 1; R2 only if ≤100 ms p95 with three periods, D11).
