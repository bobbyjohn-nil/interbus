# interbus: the plan

*Written Monday 2026-10-12 for Miticept Studios; "you" means the studio owner, GitHub bobbyjohn-nil. It merges three competing drafts and three reviewers' verdicts into one stack, one world decision and one calendar. Where it settles a disputed question it says **Call:** and gives the reason.*

**Citations.** Lesson IDs ([GD-01](docs/history/lessons-ledger.md) …) link to the [lessons ledger](docs/history/lessons-ledger.md); bug and salvage IDs ([K01](docs/history/salvage-matrix.md), [S01](docs/history/salvage-matrix.md), [R01](docs/history/salvage-matrix.md), [C01](docs/history/salvage-matrix.md), [T01](docs/history/salvage-matrix.md) …) to the [salvage matrix](docs/history/salvage-matrix.md). Prior code is `repo@ref:path`: V1 is `Intralines@7af45b1`, V2 is `Intralines_City_dep@archive/intralines-city-v1` (game paths under `Gaming/`), V3 is `Intralines_City@dc63602`.

---

## 0. One-page summary

**What we build.** A calm bus-company game on a tilted paper-map city. You draw lines between where people live and work, set how often buses run and what each line charges, and watch riders and money flow. The city offers contracts, grades you every quarter and sometimes gets in the way. It is V1's look and loop on V3's engineering with V2's measured economy fixes, cut to what a two-person part-time studio can finish.

**For whom.** You first: if you do not want to keep playing it, it has failed. Then people who like Mini Metro's calm but want a company with real money on streets that look like a city, in 20–60 minute browser sessions.

**By when.** First fare dollar **Sun Nov 1**. Prototype tagged **Sun Dec 20**. Restricted soft launch **Fri Jan 22**. **v1.0 public on itch.io and GitHub Pages Sun Feb 7 2027**; hard deadline Sun Feb 28.

**The calls that shape everything**
1. **Money before presentation.** Fare income lands in week 3, costs in week 4, and the grade, contracts and failure floor by Nov 22 ([GD-01](docs/history/lessons-ledger.md), [K40](docs/history/salvage-matrix.md)).
2. **One stack.** MapLibre drawing V1's offline paper style over procedural cities, buses as icons, the sim in a deterministic worker. A measured fallback is decided Oct 25; no renderer change after Nov 1 ([RN-01](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md)).
3. **Procedural cities carry the schedule; Boston gets a fair numeric test**, reported Nov 1. Go or no-go is your call ([WD-07](docs/history/lessons-ledger.md)).
4. **Fewer controls, fewer exploits.** One city service day, no per-bus wear, undo only while paused, express lines only behind a sweep test ([GD-06](docs/history/lessons-ledger.md), [EC-03](docs/history/lessons-ledger.md), [K22](docs/history/salvage-matrix.md)).
5. **No new system after Sun Dec 6.** December tunes; January is content and look only ([SC-08](docs/history/lessons-ledger.md)).
6. **Find out what is fun, cheaply.** A baseline session of V1 this week, your 10-minute check every milestone, one fresh-player session in December, a soft launch in January ([GD-07](docs/history/lessons-ledger.md), [TS-10](docs/history/lessons-ledger.md)).
7. **Dated triggers cut scope, not dates** (§10).

**How.** One Claude session owns `main`; no agent crew; a spec of 150 lines or fewer per milestone; PR checks within 8 minutes; saves and updates solved on the first deploy ([DP-01](docs/history/lessons-ledger.md), [PR-04](docs/history/lessons-ledger.md), [PR-08](docs/history/lessons-ledger.md)).

**This week:** give Claude read access to the three earlier repos, answer D1, D2, D3, D6 and D9 (§13) and run the V1 baseline (§14).

---

## 1. Vision and pitch

**Pitch.** *Run the buses of a little paper city. Find where people live and work, draw lines down real-feeling streets, and decide how often buses run and what each line charges. Every rule is drawn on the map, the screen stays quiet, and your buses roll while the money comes in, until the city hands you its next contract or the bank stops calling back.*

**For whom.** A calm management session in a browser tab with nothing to install: transit fans, Mini Metro players who want money and streets, people who bounced off spreadsheet tycoons.

**How it differs** (general characterisations; check before store copy). Unlike Mini Metro it has money, a grade and contracts; unlike City Bus Manager it has no chores ([GD-03](docs/history/lessons-ledger.md), [GD-09](docs/history/lessons-ledger.md)): you set a headway and the game works out the buses; unlike Subway Builder it is buses on streets, cheap to reshape, in shorter sessions.

**Against V1–V3.** V1 had only "profit go up" as a goal ([SC-03](docs/history/lessons-ledger.md)), V2 covered 41.2% of the map with chrome ([UX-01](docs/history/lessons-ledger.md)), V3 never earned a dollar ([K40](docs/history/salvage-matrix.md)). This plan answers all three, and the adversarial sweep (§6) checks every known exploit family ([GD-13](docs/history/lessons-ledger.md)).

**Working title.** **Intralines**, the name of all three versions; **interbus** stays the repo, package and storage-key name. "Interbus" is a common word in transport and industrial networking, so check both names (D5).

---

## 2. Pillars and non-goals

1. **A calm map where every rule is drawn.** ≤6% chrome at rest, no sentences at rest, ≤8 words beside any control ([UX-01](docs/history/lessons-ledger.md), [UX-02](docs/history/lessons-ledger.md)). One function drives each rule's check, money and drawing ([GD-05](docs/history/lessons-ledger.md)).
2. **Network shape is the game; the economy is honest.** What pays is where lines go, which stops they share, what gets pruned and how often buses run ([GD-02](docs/history/lessons-ledger.md)). No control is best at its extreme; more service never loses riders ([GD-13](docs/history/lessons-ledger.md), [EC-02](docs/history/lessons-ledger.md)).
3. **It just works.** Saves never corrupt and updates never break a game, answering *"bugs out every time it updates"* (`Intralines@7af45b1:scripts/retain-assets.mjs:5`; [DP-01](docs/history/lessons-ledger.md)).

A mechanic that needs a second mechanic to explain it is cut ([GD-06](docs/history/lessons-ledger.md)).

| Out for v1.0 | Why | Status |
|---|---|---|
| Company type, lobbying | Never settled ([GD-12](docs/history/lessons-ledger.md)) | Never for 1.x |
| Staff page, mechanics, Environment category | The mechanic loses money ([GD-03](docs/history/lessons-ledger.md), [K17](docs/history/salvage-matrix.md)) | Never |
| Mk tiers, refurbishment, per-bus wear | No lever; V1's wear skipped every line built since v1.15 ([K02](docs/history/salvage-matrix.md)) | Later |
| Fuel; schedule assistant | Hung off the loop ([GD-01](docs/history/lessons-ledger.md)); headways design it away ([GD-09](docs/history/lessons-ledger.md)) | Never |
| Per-line service hours; undo across game time | Exploit families ([EC-03](docs/history/lessons-ledger.md); [K22](docs/history/salvage-matrix.md)) | Later |
| Collector/local lanes, night palettes, dark theme | Never repay ([K36](docs/history/salvage-matrix.md)); double colour QA ([RN-14](docs/history/lessons-ledger.md)) | Never |
| Browser census fetches; real cities as a requirement | Quotas, no CORS ([WD-01](docs/history/lessons-ledger.md)); packs unmeasured ([WD-03](docs/history/lessons-ledger.md)) | Gated test (§5) |
| Model pipeline, diorama, pedestrians | No model file in any repo ([RN-07](docs/history/lessons-ledger.md)); crowded out V3 ([SC-05](docs/history/lessons-ledger.md)) | Later |
| Desktop and Steam | No updater, unsigned ([DP-09](docs/history/lessons-ledger.md), [K15](docs/history/salvage-matrix.md)) | Later |
| Bespoke accessibility browser gate | 33–35 s builds; blocked your layout ([UX-08](docs/history/lessons-ledger.md)) | Never |
| V1 save import | Whether anyone but you played V1 is unknown ([DP-08](docs/history/lessons-ledger.md)) | Never, unless you know of V1 players |
| Audio; phones and tablets | Not part of the loop; V2 also ruled both out (`Intralines_City_dep@archive/intralines-city-v1:Gaming/GAME.md:89`) | Later |
| Regional rail, tourism, >3 overlays, second lender | Features outpacing tuning ([SC-08](docs/history/lessons-ledger.md), [UX-12](docs/history/lessons-ledger.md)) | Later |

**Call: no per-line service hours; every line runs one city service day** (proposed 05:00–24:00). A midnight-only V2 line paid +461% by the crew's sweep and +149% re-measured, and crowding and spill were still open when V2 stopped ([EC-03](docs/history/lessons-ledger.md), [K27](docs/history/salvage-matrix.md)). Removing the control removes the exploit and its tuning ([GD-06](docs/history/lessons-ledger.md)), in the spirit of "simplify, lighten it up" (V2 `c1d73de`). Peak and off-peak headways still carry timing.

**Call: no per-bus wear.** Without refurbishment, mechanics or tiers it has no lever ([GD-03](docs/history/lessons-ledger.md)); dropping it removes [K02](docs/history/salvage-matrix.md)'s surface.

**Call: express lines are in, behind a test, second on the cut list.** Two reviewers kept them, one cut them. [X-20](docs/history/lessons-ledger.md) says keep the predicate and taper the reward, and you saw express in V1 (`Intralines@7af45b1:docs/img/line-express.jpg`). It merges in week 8 only with the "express profit peaks below $5" check in PR CI ([EC-05](docs/history/lessons-ledger.md), [K49](docs/history/salvage-matrix.md)); not green by Sun Dec 6 means 1.1.

---

## 3. Core loop

**Second to second.** Buses glide, riders gather, cash ticks; the game starts paused ([UX-10](docs/history/lessons-ledger.md)).

**Minute to minute: six verbs**, each paying off visibly within a game day ([GD-02](docs/history/lessons-ledger.md)): **draw or extend a line**; **share a stop** where lines cross (a stop within 250 m joins the old one, [EC-10](docs/history/lessons-ledger.md); V2 measured +93% boardings over parallel lines, [GD-02](docs/history/lessons-ledger.md)); **set a headway** per period, and the game shows "needs 3 buses, you have 2" with the price ([GD-09](docs/history/lessons-ledger.md)); **set a fare** inside a printed band ([EC-09](docs/history/lessons-ledger.md)); **prune or upgrade a stop** flagged QUIET or LOSS ([UX-13](docs/history/lessons-ledger.md)); **place a depot** on the green tint, knowing dead-heading costs money ([EC-13](docs/history/lessons-ledger.md), [UX-06](docs/history/lessons-ledger.md)).

**Session.** A quarter (10 game days) ends with a report card (grade, grant or fine, "left on the table", [UX-03](docs/history/lessons-ledger.md)) and a **Next quarter** preview of new contracts and a teased event: the hook to keep playing.

**The first ten minutes** (playtest targets; V1 prices, [X-09](docs/history/lessons-ledger.md), [C01](docs/history/salvage-matrix.md))

| Time | What happens |
|---|---|
| 0:00 | New company: name, colour. The board opens paused; checklist chip "1/5 Place a depot" ([UX-07](docs/history/lessons-ledger.md)) |
| 1:00 | Legal land tints green; cursor card "Industrial ✓ · street 40 m ✓ · $150k" |
| 2:00 | "2/5 Draw a line": a 650 m walk ring, "≈1,200 people within a walk", a running cost |
| 3:00 | Four stops in. Inspector: "Every 20 min needs 1 Sparrow · $95k"; confirm buys it; about $49k of $310k is left |
| 3:30 | "3/5 Press play". The bus pulls out; riders board at the 06:30 peak |
| 5:30 | First daily close, every figure a ledger row ([AR-12](docs/history/lessons-ledger.md)); one stop shows "QUIET · 3 boardings" |
| 7:00 | "4/5 Make a profitable day": prune the stop or nudge the fare |
| 8:00 | "5/5 Take a contract": "Every 15 min at the hospital, 10 days, $120k", ringed on the map |

No tutorial text: a first line fits the starting cash and the best four-bus line does not, so the city teaches ([GD-11](docs/history/lessons-ledger.md)).

**Goals.**
- **Contracts, three slots:** HEADWAY (a service level near a landmark; won 15 of 15 times in V2, [GD-02](docs/history/lessons-ledger.md)) and RIDERSHIP (150, 400 or 800 boardings a day), held 10 days within 20, judged on the city service day ([EC-03](docs/history/lessons-ledger.md)). A test bounds income across seeds; V2 ranged $60k–$480k ([GD-04](docs/history/lessons-ledger.md)).
- **Events**, one at a time, hatched a day ahead: roadworks, festival, snow ([GD-04](docs/history/lessons-ledger.md)).
- **Report card**: Coverage by service ([EC-07](docs/history/lessons-ledger.md)), Reliability against the line's own timetable (fixes [K03](docs/history/salvage-matrix.md)), Comfort, Money; thresholds measured ([EC-14](docs/history/lessons-ledger.md)).
- **Medals**, three per city (e.g. "2,000 riders a day"); bronze unlocks the next city, silver the Goliath bus.

**Call: one failure floor with a way back** ([GD-06](docs/history/lessons-ledger.md)). Cash may go negative to a credit limit with one lender (V1's Talon & Grasp, [RN-08](docs/history/lessons-ledger.md)); five game days in a row below it ends the run, with a countdown chip. The end screen names the three biggest losers and offers **Restart this quarter** from an automatic quarter-start save, so failing teaches instead of ending the session. Sandbox mode turns failure off.

**Call: undo works only while paused**, restores cash exactly and is refused with a reason once game time has passed. All three reviewers backed this: it removes [K22](docs/history/salvage-matrix.md) by construction and still fixes a misplaced stop ([UX-09](docs/history/lessons-ledger.md), [X-11](docs/history/lessons-ledger.md)). A line draft is one named step ([K33](docs/history/salvage-matrix.md)).

**Pacing targets** ([GD-10](docs/history/lessons-ledger.md)), scripted in week 9: first line within 3–5 real minutes; first profitable day within 8; second line affordable after 15–25; first report card within 20; a city's top medal in 2–4 hours. The speed ladder (24 minutes a quarter at top speed in all three versions) starts at 1 / 4 / 15 game-minutes per second with nights four times faster, about 14 minutes a quarter. Starting cash is V1's $310k, the only value tested in a sim run ([X-09](docs/history/lessons-ledger.md)).

---

## 4. Scope by release

### Prototype: tagged Sun Dec 20 2026

Two cities end to end, balanced, saved and onboarded. **No new system after Sun Dec 6** (a system is anything that changes the sim's rules or money; UI, copy and tunables can still land). Weeks are in §10, sources in §7.
- **Foundation:** CI, Pages, prompt-to-update offline app; worker sim on a fixed step; `{ok, reason}` commands; cent ledger; saves with every id counter and a schema hash ([DP-01](docs/history/lessons-ledger.md), [AR-07](docs/history/lessons-ledger.md), [AR-13](docs/history/lessons-ledger.md), [K01](docs/history/salvage-matrix.md), [K11](docs/history/salvage-matrix.md)).
- **World:** river and grid cities in V1's paper style; demand cells ≤350 m; buildings from cells; hourly congestion by road class, in the sim ([RN-01](docs/history/lessons-ledger.md), [EC-15](docs/history/lessons-ledger.md), [K24](docs/history/salvage-matrix.md), [R10](docs/history/salvage-matrix.md), [AR-04](docs/history/lessons-ledger.md)).
- **Economy:** demand without caps; **fare and subsidy income from week 3**; per-km, wage, upkeep and deadhead costs; headway → buses → purchase; per-line fare bands; stop tiers and QUIET/LOSS flags; transfers ([GD-01](docs/history/lessons-ledger.md), [K40](docs/history/salvage-matrix.md), [K04](docs/history/salvage-matrix.md), [K05](docs/history/salvage-matrix.md), [GD-09](docs/history/lessons-ledger.md), [EC-10](docs/history/lessons-ledger.md), [UX-13](docs/history/lessons-ledger.md)).
- **Goals and failure:** report card; HEADWAY and RIDERSHIP contracts; events; medals and unlocks; credit line, failure floor, Restart this quarter ([GD-04](docs/history/lessons-ledger.md), [EC-14](docs/history/lessons-ledger.md)).
- **Player tools:** calm shell; line tool with remove, extend and insert; depot tint; planning undo; slots, autosave, export; Export session; express behind its test ([UX-02](docs/history/lessons-ledger.md), [K22](docs/history/salvage-matrix.md), [K32](docs/history/salvage-matrix.md), [EC-05](docs/history/lessons-ledger.md)).
- **Onboarding:** Home menu, founding, first-session checklist, pacing ladder ([UX-07](docs/history/lessons-ledger.md), [GD-10](docs/history/lessons-ledger.md)).
- **Tests:** invariants, sweep, balance bands, bench and e2e smoke, each landing with its system ([EC-11](docs/history/lessons-ledger.md), [EC-12](docs/history/lessons-ledger.md), [TS-06](docs/history/lessons-ledger.md)).

**Call: every bus type, event kind and route edit lands before the system cutoff.** A reviewer's main objection to the base draft was January adding them after the balance freeze ([SC-08](docs/history/lessons-ledger.md)). Sparrow (28 seats, $95k), Metro 40 (70, $260k) and Goliath (115, $440k) all land by Dec 6 ([C01](docs/history/salvage-matrix.md)).

**Call: events are in the prototype, three kinds, no fuel event.** Regular goals keep players coming ([GD-04](docs/history/lessons-ledger.md)); fuel is Out, so a fuel event fails [GD-06](docs/history/lessons-ledger.md). If late, roadworks only.

**Call: the onboarding checklist lands in week 6**, because the fresh-player session depends on it ([UX-07](docs/history/lessons-ledger.md)).

### v1.0: Jan 4 to Feb 7 2027 (content, look and release only)

Splash, bus wipe, day/night map tint, dusk headlights, report-card stamp ([S18](docs/history/salvage-matrix.md), [GD-08](docs/history/lessons-ledger.md)); a third city, radial or Boston ([WD-07](docs/history/lessons-ledger.md)); a near-zoom instanced bus ([RN-05](docs/history/lessons-ledger.md), cut 3); a help page generated from reason codes, settings and the accessibility baseline ([UX-08](docs/history/lessons-ledger.md)); the store page (§11). None adds a sim system; a new city passes the city invariants and gets its own balance band.

### Post-launch backlog (ordered)

More real cities ([WD-09](docs/history/lessons-ledger.md)); per-line hours, hour-masked ([EC-03](docs/history/lessons-ledger.md)); undo across time ([UX-09](docs/history/lessons-ledger.md)); arterial lanes ([R10](docs/history/salvage-matrix.md)); a station diorama ([K08](docs/history/salvage-matrix.md)); a keyboard map cursor ([UX-11](docs/history/lessons-ledger.md)); desktop and Steam ([DP-09](docs/history/lessons-ledger.md)); real bus models ([RN-07](docs/history/lessons-ledger.md)).

---

## 5. World

**Recommendation: procedural cities, in the real-city pack format, carry the v1.0 schedule; Boston gets a fair, measured test now.**

**Evidence.**
- **The look you pointed back to needs no real data.** V1's screenshots show Riverton, its seeded demo city, drawn by MapLibre with V1's offline pack style under a "Demo data" badge (`Intralines@7af45b1:docs/img/line-editor.jpg`, `src/map/MapView.tsx:104`, `src/map/basemapStyle.ts:369-375`), in the real-city format ([WD-05](docs/history/lessons-ledger.md)).
- **Real data was V1's most fragile subsystem** (quota pages as HTML, no CORS, errors with HTTP 200; [WD-01](docs/history/lessons-ledger.md)), took about 14 of 71 commits with hosting and deploy ([X-06](docs/history/lessons-ledger.md)), and cannot be measured from the repos ([WD-03](docs/history/lessons-ledger.md)).
- **V2's procedural failure was demand resolution:** only 25–37% of street nodes were within a 650 m walk of demand, so an off-centre line drew 0 riders for 3 game days ([EC-15](docs/history/lessons-ledger.md), [K24](docs/history/salvage-matrix.md)). Designed cities have traps and tested first lines ([GD-11](docs/history/lessons-ledger.md)).
- **Against: you keep choosing real cities**, and the ledger concludes they are "a product requirement, not an option" ([WD-07](docs/history/lessons-ledger.md)).

**Call: Boston gets a fair test and you make the go/no-go (D1).** One reviewer wanted "default no-go"; another said that would quietly overrule your most repeated choice. Nothing waits on Boston, but if the numbers pass it can take the third-city slot. Shipping without a real city would be a recorded reversal of [WD-07](docs/history/lessons-ledger.md), not an accident.

**The Boston test.**
- A separate session on `spike/boston`, never touching `main`, capped at two sessions, ports V1's pipeline and fixtures ([S14](docs/history/salvage-matrix.md)).
- The bake runs in a GitHub Actions job with network access from pinned sources, since V1's bake fails offline ([WD-03](docs/history/lessons-ledger.md)); if the census API refuses the CI address ([WD-01](docs/history/lessons-ledger.md)), run it once on your computer.
- Gates, all required: pack ≤2 MB gzip; ≤1,000 demand cells; ≤16,000 street nodes ([WD-09](docs/history/lessons-ledger.md)); recompute ≤150 ms on the reference network; first-line economics inside the starter city's bands; drawn from the pack with the offline style and no tile server (V1's online tiles came from OpenFreeMap, [RN-01](docs/history/lessons-ledger.md)).
- `docs/spikes/boston.md` by **Sun Nov 1**. A failed or missing bake is a recorded no-go and makes Boston the first 1.1 item.
- This reports in week 3, not the ledger's "week one" ([Top 15 #6](docs/history/lessons-ledger.md)), because week 1 goes to the board you can see.

**Call: demand cells are 350 m or smaller, 400–1,000 per city.** V1's three n×n matrices take 2.8 MB at n = 481 and 44 MB at n = 1,924, about 12 MB at 1,000 ([AR-15](docs/history/lessons-ledger.md)). Recompute took 32–83 ms at n = 481 and 101–221 ms at n = 1,924 ([AR-07](docs/history/lessons-ledger.md); [salvage matrix](docs/history/salvage-matrix.md) §A.2 row 3), so 1,500 cells would break the 150 ms budget. Cells hold residents, jobs and visitors, drawn as dots inside them, and **buildings come from cell populations,** so the map cannot draw a city where nobody lives ([WD-06](docs/history/lessons-ledger.md)).

**City invariants (every city and seed):** the same seed gives the same city; one connected street network; ≥90% of built-up street nodes within 650 m of a populated cell; a stop on any street with residents within 300 m draws riders within a game day (the inverse of [K24](docs/history/salvage-matrix.md)); a first line fits the starting cash and the best four-bus line does not ([GD-11](docs/history/lessons-ledger.md)).

---

## 6. Architecture and tech stack

**Call: Option B, "V1's look, rebuilt clean", with real cities off the critical path and three.js deferred.** All three reviewers chose B over C. V1's reference screenshots *are* MapLibre over procedural Riverton (§5), and the [salvage matrix](docs/history/salvage-matrix.md) rates B "strongest (it *is* V1's look)" (§D5). C hand-writes what MapLibre provides; in V3 that took about 4.4k renderer lines and 39% of the tests while income stayed at zero, and the buses changed 6 pixels of the frame ([RN-03](docs/history/lessons-ledger.md), [RN-05](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md); [salvage matrix](docs/history/salvage-matrix.md) §A.2 row 14). A is the flat look you rejected ([RN-02](docs/history/lessons-ledger.md)). B's big risks, the data pipeline and V1's bus meshes ([K09](docs/history/salvage-matrix.md)), are sidelined and dropped.

**Stack.** Strict TypeScript, Vite, React 18 for chrome only, MapLibre GL pinned and in its own chunk, Vitest, Playwright on a pinned browser ([K53](docs/history/salvage-matrix.md)), V3's `vite-plugin-pwa` setup, GitHub Actions; three.js only for the cuttable near-zoom bus.

**Measured fallback.** MapLibre's bundle share is unknown (V1's 493 kB gzip also held three.js, [AR-18](docs/history/lessons-ledger.md)). **If the board boots in more than 2.5 s under CI's software GL, or the menu's critical path exceeds 200 KiB gzip, we decide on Sun Oct 25** whether to move to V3's scene ([R13](docs/history/salvage-matrix.md)) behind a thin `MapPort` seam; if we stay on B, no seam is built and the two limits become I14's budget. **No renderer change after Sun Nov 1** ([SC-05](docs/history/lessons-ledger.md)), and never two renderers.

**Module layout**
```
src/sim/      pure TS in the worker; no DOM, React, MapLibre, Date or Math.random
  config/     every tunable in one registry (AR-10)
  core/       id allocator, cents, rng, calendar, geo: one of each (K54)
  rules/      every predicate: canPlaceStop, canPlaceDepot, isExpress, costs (GD-05)
  commands/   (state, cmd) -> {ok, reason}; planning undo (AR-13)
  city/ demand/ traffic/ fleet/ economy/ goals/ events/ save/
  step.ts     simStep(), the only door that advances time (AR-09)
src/worker/   fixed-step host, snapshots, command log
src/render/   MapLibre style and layers; reads snapshots only
src/ui/       React shell, cursor cards, menus; reason codes -> copy
```

**Boundaries.** The worker owns state; commands apply at the next fixed step (0.5 game-minutes) and carry its index, so replays are exact. Cursor cards call the same `rules/` function the worker re-checks ([K10](docs/history/salvage-matrix.md)). The renderer places buses with V3's pure `busPositionAt` ([S03](docs/history/salvage-matrix.md)), computes no game number ([AR-04](docs/history/lessons-ledger.md), [K06](docs/history/salvage-matrix.md)–[K08](docs/history/salvage-matrix.md)), and runs buses on the cycle the ledger bills ([K07](docs/history/salvage-matrix.md)). React never re-renders per frame ([AR-08](docs/history/lessons-ledger.md), [K44](docs/history/salvage-matrix.md)). Two lint rules enforce this: `ui/` and `render/` import only `sim/rules` and sim types, and `Date` and `Math.random` are banned in `src/sim`.

**Export session.** Because the sim is deterministic (seeded RNG, [S11](docs/history/salvage-matrix.md); [AR-06](docs/history/lessons-ledger.md)), a debug button exports the quarter-start save plus every command since, and the sim replays it exactly. Every bug you hit becomes reproducible, playtest timings come from the log, and store clips come from replays.

**Save format.** V3's envelope with a moving version and migrations ([K11](docs/history/salvage-matrix.md)), holding intent only ([DP-05](docs/history/lessons-ledger.md)): city seed or pack hash; `nextIds` for every entity kind, buses included ([K01](docs/history/salvage-matrix.md)); clock and RNG; stops by place ([WD-10](docs/history/lessons-ledger.md)), lines (stops, fare, peak and off-peak headway, model), depots; cash in cents, ledger totals, contracts, medals. No demand and no derived line geometry, which was 45% of a one-line V1 save ([K12](docs/history/salvage-matrix.md)). Keys are `interbus.save.<slot>` whatever the title: autosaves, manual slots, the quarter-start save, a `pagehide` write, export and import. **A schema-hash test fails CI on any schema change without a version bump and a new fixture** ([SC-10](docs/history/lessons-ledger.md)). **Save policy:** until the soft launch, a bump may set older saves aside, backed up and named on screen (V3's "unreadable" path, [DP-06](docs/history/lessons-ledger.md)); from the soft launch on, every bump ships a migration and every released save loads in every later build.

**Invariants that become tests**, each landing with its system and shown to fail with the old bug restored ([TS-04](docs/history/lessons-ledger.md)):

| # | Invariant | Kills |
|---|---|---|
| I1 | Cash = start + Σ ledger rows; the day card is ledger rows | [K40](docs/history/salvage-matrix.md), [K22](docs/history/salvage-matrix.md), [AR-12](docs/history/lessons-ledger.md) |
| I2 | Adding a line, stop or bus never cuts linked trips by >0.1% | [EC-02](docs/history/lessons-ledger.md), [K04](docs/history/salvage-matrix.md) |
| I3 | Fare and headway have interior profit optima; express peaks below $5; starving a line at top fare earns ≤60% of the optimum | [GD-13](docs/history/lessons-ledger.md), [EC-05](docs/history/lessons-ledger.md), [EC-06](docs/history/lessons-ledger.md), [K28](docs/history/salvage-matrix.md), [K49](docs/history/salvage-matrix.md) |
| I4 | Splitting a line raises revenue plus subsidy ≤1% | [EC-04](docs/history/lessons-ledger.md), [K05](docs/history/salvage-matrix.md) |
| I5 | Every line at a 6-line hub boards riders | [K23](docs/history/salvage-matrix.md) |
| I6 | Cursor-card verdict equals command verdict; a drawn bus loops in exactly the billed cycle | [GD-05](docs/history/lessons-ledger.md), [K10](docs/history/salvage-matrix.md), [K07](docs/history/salvage-matrix.md) |
| I7 | Random create, delete, save and load never reuse an id | [K01](docs/history/salvage-matrix.md), [DP-04](docs/history/lessons-ledger.md) |
| I8 | N days in one call equal N days in 72 chunks, byte for byte; save-load-save is identical, clock included | [AR-06](docs/history/lessons-ledger.md), [K41](docs/history/salvage-matrix.md) |
| I9 | Undo refused after time passes; undo while paused restores cash exactly | [K22](docs/history/salvage-matrix.md), [TS-05](docs/history/lessons-ledger.md) |
| I10 | The §5 city invariants | [K24](docs/history/salvage-matrix.md), [GD-11](docs/history/lessons-ledger.md) |
| I11 | Scripted contract income over 10 seeds within ±30% of the median | [GD-04](docs/history/lessons-ledger.md) |
| I12 | At the default camera, 1366×768: each bus ≥20 px long **and** the bus layer changes ≥200 px of the frame | [RN-05](docs/history/lessons-ledger.md), [K46](docs/history/salvage-matrix.md), [TS-07](docs/history/lessons-ledger.md) |
| I13 | Chrome ≤6% at rest and ≤26% with a panel, no sentences at rest, at three laptop sizes; every reason code has copy of ≤8 words | [UX-01](docs/history/lessons-ledger.md), [UX-02](docs/history/lessons-ledger.md), [K31](docs/history/salvage-matrix.md) |
| I14 | Recompute ≤150 ms p95 on the reference network (10 lines, 116 stops, 50 buses); menu critical path ≤200 KiB gzip; board boot ≤2.5 s under software GL; every MapLibre layer builds | [AR-07](docs/history/lessons-ledger.md), [AR-18](docs/history/lessons-ledger.md), [K25](docs/history/salvage-matrix.md), [K21](docs/history/salvage-matrix.md) |
| I15 | E2E on every PR: found, depot, draw, run a day, check cash against the ledger, reload, compare | [TS-06](docs/history/lessons-ledger.md) |

**CI and deploy.** The adversarial sweep is coordinate ascent over fare, headway and stop tier on three fixture cities plus the named exploits, checked against a fresh recompute ([EC-12](docs/history/lessons-ledger.md)); economy PRs quote its before and after numbers ([PR-02](docs/history/lessons-ledger.md)).
- **PR checks, 8-minute budget:** typecheck, lint, unit and invariant tests, save fixtures, bundle budget, offline check ([S20](docs/history/salvage-matrix.md)), the smoke with axe-core, a 60-second sweep when `src/sim` changed. **Anything slower moves to nightly and never becomes a blocking gate** ([UX-08](docs/history/lessons-ledger.md)).
- **Nightly:** full sweep, bench, offline reload with the network cut ([TS-11](docs/history/lessons-ledger.md)), `npm audit` ([K57](docs/history/salvage-matrix.md)), and from week 9 an update test: build N−1 then N; the prompt appears, the save survives, nothing reloads by force.
- **Deploy:** every merge to `main` until launch, then `v*` tags only (§11); the Pages environment admits `main` and `v*` tags, no cancelling ([DP-02](docs/history/lessons-ledger.md)), then poll the live `version.json` until it shows the deployed SHA. From week 15 a `v*` tag also pushes the itch zip with `butler`.
- **Repo:** `main` protected, squash off ([PR-07](docs/history/lessons-ledger.md)), LFS before the first binary file ([DP-11](docs/history/lessons-ledger.md)).

---

## 7. Salvage plan

Copy from code, never from the manuals ([X-09](docs/history/lessons-ledger.md), [X-16](docs/history/lessons-ledger.md)). A port is done when the shipped app uses it and the smoke reaches it ([SC-09](docs/history/lessons-ledger.md)); its PR names the K-ids it closes, each with a test that fails without the fix ([TS-04](docs/history/lessons-ledger.md)).

| What | Mode | From | Fix on the way in |
|---|---|---|---|
| Ledger | PORT [S01](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/economy/{ledger,types,format}.ts` | Income, real km, deadhead, upkeep ([K40](docs/history/salvage-matrix.md)) |
| Saves | PORT [S02](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/save/*`; `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/10-core.js:631-715` | Bus counter ([K01](docs/history/salvage-matrix.md)); intent only ([K12](docs/history/salvage-matrix.md)); moving version ([K11](docs/history/salvage-matrix.md)); one timetable shape ([K51](docs/history/salvage-matrix.md)); honest Save ([K29](docs/history/salvage-matrix.md), [K30](docs/history/salvage-matrix.md)) |
| Bus motion | PORT [S03](docs/history/salvage-matrix.md), [S17](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/buses/*`; `Intralines@7af45b1:src/map/busLayer3d.ts:85-100, 146-199` (maths only) | One cycle formula ([K07](docs/history/salvage-matrix.md)); no mesh code ([K09](docs/history/salvage-matrix.md)) |
| Lines, pathfinding | PORT [S04](docs/history/salvage-matrix.md), [S16](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/lines/*`; `Intralines@7af45b1:src/game/routing.ts` | Spatial index ([K52](docs/history/salvage-matrix.md)); A* on (node, incoming edge) ([K13](docs/history/salvage-matrix.md)) |
| Calendar, depots, errors | PORT [S05](docs/history/salvage-matrix.md)–[S07](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/game/{clock,depots,errors}/` | Clock out of React ([K41](docs/history/salvage-matrix.md), [K44](docs/history/salvage-matrix.md)); tint and deadhead ([K43](docs/history/salvage-matrix.md)); one `DepotId` ([K54](docs/history/salvage-matrix.md)); UI sink ([K14](docs/history/salvage-matrix.md)) |
| PWA, tsconfig, CI | PORT [S08](docs/history/salvage-matrix.md), [S09](docs/history/salvage-matrix.md) | `Intralines_City@dc63602:src/pwa/*`, `src/ui/UpdateBanner.tsx`, `tsconfig*.json`, `.github/workflows/ci.yml` | Drop model globs; pin browser ([K53](docs/history/salvage-matrix.md)); audit ([K57](docs/history/salvage-matrix.md)) |
| Loop, RNG, graph, A*; offline audit, palette maths | PORT [S11](docs/history/salvage-matrix.md), [S12](docs/history/salvage-matrix.md), [S20](docs/history/salvage-matrix.md)–[S22](docs/history/salvage-matrix.md) | `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/{60-main.js,10-core.js,20-city.js}`, `Gaming/tools/{build.js,a11y-check.js}` | Loop in the worker; literals become tunables; checks run post-Vite and over tokens |
| Geo, icons, splash, wipe | PORT [S15](docs/history/salvage-matrix.md), [S18](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/geo.ts`, `src/ui/{icons.tsx,BusWipe.tsx}`, `index.html:218-283` | One geo module; tokenised colours ([RN-08](docs/history/lessons-ledger.md)) |
| City generator | REWRITE-FROM | `Intralines@7af45b1:scripts/make-demo-city.mjs`; V2 `Gaming/src/20-city.js` archetypes | Fine cells; buildings from cells ([K24](docs/history/salvage-matrix.md), [WD-12](docs/history/lessons-ledger.md)) |
| Paper style, demand scatter | REWRITE-FROM [R12](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/map/basemapStyle.ts:9-32, 375-547`, `src/map/overlays.ts` | Bundled glyphs; style tests ([K21](docs/history/salvage-matrix.md)); render only on change ([RN-04](docs/history/lessons-ledger.md)) |
| Demand model | REWRITE-FROM [R01](docs/history/salvage-matrix.md)–[R03](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/sim/demand.worker.ts`; V2 `Gaming/src/30-sim.js`; `Intralines_City@dc63602:src/game/demand/*` | No caps ([K04](docs/history/salvage-matrix.md), [K23](docs/history/salvage-matrix.md)); per-boarding fare ([K05](docs/history/salvage-matrix.md)); hourly crowding ([K27](docs/history/salvage-matrix.md)); captive ceiling ([K28](docs/history/salvage-matrix.md)); growable buffers ([K45](docs/history/salvage-matrix.md)); linked trips ([K47](docs/history/salvage-matrix.md)); 130 m radius ([K50](docs/history/salvage-matrix.md)) |
| Fares, express | REWRITE-FROM | `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:70-103, 2636-2662`; `Intralines@7af45b1:src/game/constants.ts:397-412` | Taper ([K49](docs/history/salvage-matrix.md)); a starter line is not express ([K16](docs/history/salvage-matrix.md)) |
| Headway, fleet, report card | REWRITE-FROM [R04](docs/history/salvage-matrix.md), [R05](docs/history/salvage-matrix.md) | `Intralines@7af45b1:src/game/constants.ts:310-387`, `src/game/store.ts:403-520` | Buses cost money ([K42](docs/history/salvage-matrix.md)); real-timetable reliability ([K03](docs/history/salvage-matrix.md)); no dead categories ([K36](docs/history/salvage-matrix.md)) |
| Traffic | REWRITE-FROM [R10](docs/history/salvage-matrix.md), PORT [S12](docs/history/salvage-matrix.md) field | `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/20-city.js:1387-1490`, `Gaming/docs/design/dynamic-traffic.md` | One `congestionAt()` feeding bus timing *and* ridership ([K06](docs/history/salvage-matrix.md), [AR-04](docs/history/lessons-ledger.md)); lanes later ([K36](docs/history/salvage-matrix.md)) |
| Contracts, events, undo, route edits, transfer ladder | REWRITE-FROM [R06](docs/history/salvage-matrix.md), [R08](docs/history/salvage-matrix.md), [R09](docs/history/salvage-matrix.md) | V2 `Gaming/src/30-sim.js:4576-4972`, `Gaming/src/10-core.js:87-108`, `Gaming/docs/design/{undo-redo,route-editing,transfer-boost}.md` | Bounded seed variance ([GD-04](docs/history/lessons-ledger.md)); never snapshot sim state ([K22](docs/history/salvage-matrix.md)); anchor buses by position ([K32](docs/history/salvage-matrix.md)); no hub bonus ([EC-10](docs/history/lessons-ledger.md)) |
| Shell, menu, founding | REWRITE-FROM [R07](docs/history/salvage-matrix.md), [R11](docs/history/salvage-matrix.md) | V2 `Gaming/docs/design/screen-layout.md`; `Intralines@7af45b1:src/ui/{Panels.tsx,Menu.tsx,Founding.tsx}` | Labelled chips ([K20](docs/history/salvage-matrix.md)); one draft preview ([K10](docs/history/salvage-matrix.md)); 1152 px ([K31](docs/history/salvage-matrix.md)) |
| Real-city pipeline | PORT on `spike/boston` ([S14](docs/history/salvage-matrix.md)) | `Intralines@7af45b1:src/game/data/pipeline.js`, `scripts/bake-city.mjs` | One city list ([K18](docs/history/salvage-matrix.md)); offline bake ([K19](docs/history/salvage-matrix.md)); never V2's `buildZones` ([K26](docs/history/salvage-matrix.md)) |
| Review harness seeds | Rebuild as tests ([T01](docs/history/salvage-matrix.md)–[T07](docs/history/salvage-matrix.md)) | Salvage matrix §B5 (in no repo; commit the files first only if they were handed over with this plan) | Each becomes a named test as its system lands ([PR-07](docs/history/lessons-ledger.md), [TS-08](docs/history/lessons-ledger.md)) |
| DROP | — | V1 store, panel code, mesh layer, recovery layers; V2 UI code, a11y harness, company type; V3 model pipeline, contrast suite | [K01](docs/history/salvage-matrix.md)–[K03](docs/history/salvage-matrix.md), [K09](docs/history/salvage-matrix.md), [DP-01](docs/history/lessons-ledger.md), [UX-08](docs/history/lessons-ledger.md), [GD-12](docs/history/lessons-ledger.md), [RN-07](docs/history/lessons-ledger.md), [K58](docs/history/salvage-matrix.md) |

---

## 8. Look, feel and UX

**Call: "a paper board with crisp chrome".** The world keeps V1's identity ([RN-08](docs/history/lessons-ledger.md)): paper `#f6f1e1`, ink `#2c2a24`, amber arterials, white streets, extruded buildings, a tilted board over a grey void (`Intralines@7af45b1:docs/img/demand-far.jpg`), all as tokens from the first commit. The chrome is flat and crisp with generous spacing, after V3's labelled chips (`Intralines_City@dc63602:src/ui/TopBar.tsx:73-79`). That reconciles "make the game more like" V1 (V2 `980759d`) with V3's recorded target, "Subway Builder: sleek and modern, but usable" ([RN-08](docs/history/lessons-ledger.md); not verified as your words). V1 itself began from "Subway Builder's map design" (V1 `b8c47c6`) and its style comment rejects only the "all-black" Subway Builder style (`Intralines@7af45b1:src/map/basemapStyle.ts:4-7`). You settle it by **Sun Nov 8** (D8) from V1's board, V3's running screen and any Subway Builder shots you have. Light map only, night as a tint ([RN-13](docs/history/lessons-ledger.md)); no emoji ([UX-10](docs/history/lessons-ledger.md)); a side-by-side shot against V1 at every milestone.

**Call: the shell is measured from the first screen.** The chip row and chrome script ship in week 1 and the full shell in week 4, before any panel can crowd it ([Top 15 #2](docs/history/lessons-ledger.md), [UX-02](docs/history/lessons-ledger.md)); V2's retrofit never landed ([SC-04](docs/history/lessons-ledger.md)).

**Screen budget (I13).** Chrome ≤6% at rest and ≤26% with a panel at 1440×900, 1366×768 and 1152×720; no sentences at rest; ≤8 words beside a control. Labelled chips: date, speed, Cash, Riders/day, Grade, Contracts ([UX-04](docs/history/lessons-ledger.md), [K20](docs/history/salvage-matrix.md)). A dock of ≤8 slots: Select, New line, Depot, Map ▾, Company ▾. No inspector at rest; notices queue in one corner ([UX-05](docs/history/lessons-ledger.md)). At most three overlays (Residents, Jobs, Traffic) answering "where do trips start and end, and where am I not serving them?" ([UX-12](docs/history/lessons-ledger.md)).

**Rules drawn on the map**, each from the same `sim/rules` predicate ([GD-05](docs/history/lessons-ledger.md)): the depot tint ([UX-06](docs/history/lessons-ledger.md)); the 650 m walk ring; a 250 m snap ring ("joins Main St · transfer", [EC-10](docs/history/lessons-ledger.md)); express chevrons with thresholds MET or needed; QUIET/LOSS as an icon and a word ([UX-13](docs/history/lessons-ledger.md)); contract rings with live progress; events hatched a day ahead; ribbon width by frequency, dashes as well as colour ([RN-09](docs/history/lessons-ledger.md)); refusals in money, "Costs $95k; you have $40k, $55k short" ([UX-03](docs/history/lessons-ledger.md)).

**Call: buses are icons with a footprint test from the first deploy.** A symbol layer at constant screen size, as V1 drew them at about 25 px ([RN-05](docs/history/lessons-ledger.md)), with the ≥20 px floor and ≥200 px frame check (I12), because V3's `diff > 0` test passed at a real 6 pixels ([TS-07](docs/history/lessons-ledger.md), [K46](docs/history/salvage-matrix.md)). V1's `BusSide` mark is a side profile (`Intralines@7af45b1:docs/img/bus-icons.jpg`) that would draw upside down westbound, so the map uses a top-down glyph or mirrors it. Below 30 fps with 200 buses on your laptop (week 4), buses move to a small instanced custom layer inside MapLibre, which is not a renderer change.

**Charm budget: one or two moments per milestone,** driven by sim events and cut one by one if late ([GD-08](docs/history/lessons-ledger.md)): depot pull-outs (M2), riders gathering at stops (M3), event props (M4), and in January the splash, bus wipe, dusk headlights and a report-card stamp.

**Accessibility, proportionate** ([UX-08](docs/history/lessons-ledger.md)): palette unit tests ([S21](docs/history/salvage-matrix.md)), shape plus colour for lines, keyboard shortcuts ([UX-10](docs/history/lessons-ledger.md)), 24 px targets, reduced motion, axe-core in the smoke. Nothing may block a layout change you asked for.

---

## 9. How the team works

**Roles** (confirm by Sun Oct 18, D6).
- **You: owner and lead player.** You decide scope, look and title; start Claude sessions; play each milestone; answer the weekly questions.
- **The co-developer.** The record does not say what the co-developer did in V1–V3, so this is a menu. The plan needs a second player on a second machine at milestones ([TS-10](docs/history/lessons-ledger.md)); beyond that, any mix of: (a) fresh-eyes observer; (b) art, including the five bus models V3's docs describe, if they exist (unverified, [RN-07](docs/history/lessons-ledger.md)); (c) recruiting playtesters; (d) store page, clip and itch admin.
- **Claude:** code, tests, docs, a one-page summary per milestone, at most five questions a week ([PR-03](docs/history/lessons-ledger.md), [PR-05](docs/history/lessons-ledger.md)).

**Capacity.** No reliable weekly-hours figure exists. The calendar assumes a normal week gives you 2–4 hours, mostly at weekends (a few short Claude sessions plus one block to play and answer questions), and asks the co-developer only for milestone playtests. Track hours from now on; if the real number is lower, the cut list moves, not the hours.

**Claude session rules** (`CLAUDE.md`, ≤100 lines): **one session owns `main`** and merges small PRs on green CI, pushing often; others stay read-only or on their own branch ([PR-07](docs/history/lessons-ledger.md), [PR-08](docs/history/lessons-ledger.md)). **No crew** ([PR-04](docs/history/lessons-ledger.md)). **One spec per milestone, ≤150 lines**, with magnitudes and a cut line ([SC-06](docs/history/lessons-ledger.md), [SC-07](docs/history/lessons-ledger.md), [TS-12](docs/history/lessons-ledger.md)). **Restate feedback in one sentence before building on it**, and say so with numbers if measurement suggests a better route ([PR-11](docs/history/lessons-ledger.md), [PR-12](docs/history/lessons-ledger.md)). **V1-style commit messages**, no checkpoint commits ([PR-09](docs/history/lessons-ledger.md), [PR-14](docs/history/lessons-ledger.md)). **No presentation pivot inside a milestone** ([SC-05](docs/history/lessons-ledger.md)).

**Done.** A PR is green, deployed, and updates the docs it touches ([PR-06](docs/history/lessons-ledger.md)). A milestone also needs your play notes in `docs/playtests/`, citing the on-screen SHA ([PR-13](docs/history/lessons-ledger.md)).

**Call: playtests take a middle path.** One draft needed about 25 fresh players; two relied mostly on your checks. This plan runs:
- **Every milestone:** your 10-minute check (and the co-developer's where possible) answering: What did you try? Where did you get stuck? What was boring or ugly? Does it look like V1? What next?
- **P0, this week:** you, the co-developer and, if available, one or two others each play V1's Riverton for 30 minutes, the cheapest way to learn what was fun ([GD-07](docs/history/lessons-ledger.md)).
- **P1, Sun Nov 22:** you and the co-developer each play a full quarter.
- **P2, Dec 12–13:** two or three people new to the game, 20 minutes each.
- **Soft launch, Fri Jan 22:** about ten people on the restricted itch page.
- **Thanksgiving week:** anyone new to it (family counts) plays the M3 build for 20 minutes, an early onboarding warning. Optional: an hour of your own play over the holidays.

Sessions are sized to the pool you name in D6. **Protocol** (`docs/playtests/PROTOCOL.md`): a pinned build, no help for 10 minutes, thinking aloud, the session log exported (from M3). Measures: first line ≤3 min, first profitable day ≤8 min, ≤2 stuck moments, no "what does this number mean?", a 1–5 keep-playing score, and the best moment. **If P2 players cannot say what to do after their first line,** week 10 goes to onboarding and the third city is cut. **If fewer than half want to keep playing after the report card,** January's look week goes to contract variety and pacing.

**Call: few docs, and this plan is not a living spec.** A reviewer warned that a long committed plan breaks [PR-05](docs/history/lessons-ledger.md) and [SC-06](docs/history/lessons-ledger.md). So §0 is the page you read, only §10's table is updated (at milestone close), and if anything drifts, `docs/SCOPE.md` and `docs/DECISIONS.md` win; on Mar 1 this file is rewritten short. Otherwise the repo keeps `README.md`, `CLAUDE.md` (with V1's Pages gates, `Intralines@7af45b1:CLAUDE.md:20-47`), `docs/SCOPE.md`, `docs/DECISIONS.md` (what, why, how to reverse), `docs/specs/current.md`, `docs/playtests/`, `docs/spikes/` and the frozen `docs/history/`. Changelog and version come from git ([PR-15](docs/history/lessons-ledger.md)). No bible, future specs or crew files.

---

## 10. Milestones and calendar

Weeks run Monday to Sunday; each check is 10 minutes on the deployed build, starting from a committed fixture save where the step needs game days to pass.

**Call: income lands in week 3, not week 5.** Two of the three reviewers flagged the base draft's month without money as V3's failure shape ([Top 15 #1](docs/history/lessons-ledger.md), [K40](docs/history/salvage-matrix.md)). M3 (Nov 22) is the first build with everything Top 15 #1 lists: income, costs, a grade, contracts and a failure floor.

| Wk | Dates | Focus | Exit check (you, 10 min) |
|---|---|---|---|
| 1 | Oct 12–18 | **M0 Board.** Scaffold, CI, Pages, PWA; river city in V1's style; chip row, chrome script; build measured. **P0** | A tilted paper city like V1's `demand-far.jpg` opens; the next deploy shows "Update ready"; it opens with Wi-Fi off |
| 2 | Oct 19–25 | Ports; worker host; demand cells; smoke; itch page; Boston spike starts. **Renderer decision Sun Oct 25** | Click a street: "people within a walk"; dots sit where buildings are; the itch copy keeps a save |
| 3 | Oct 26–Nov 1 | **M1 First dollar.** Demand worker; fare and subsidy income; daily close; I1, I2. **Boston report; capacity check** | A day on a debug line: riders board, money comes in, the day card adds up. Decide D1 |
| 4 | Nov 2–8 | **M2 First line.** Shell; line tool; depot tint; headway to purchase; all costs; bus icons, I12, 200-bus test | Found, depot, 4 stops, every 20 min, play: the bus pulls out and cash moves exactly as the inspector said |
| 5 | Nov 9–15 | Stop tiers, flags; fare band; Finance; Metro 40; planning undo; slots, autosave, export; sweep in CI | Undo a stop while paused: cash back to the cent. Play one game hour: undo is refused with a reason |
| 6 | Nov 16–22 | **M3 Money loop.** Report card; failure floor and restart; HEADWAY contracts; checklist; Export session. **P1** | Checklist → profitable day → contract (about 8 min). From the quarter-end fixture: the report card. Overspend: countdown, then restart |
| 7 | Nov 23–29 | Thanksgiving (Thu Nov 26), lighter: transfers; route remove and extend; grid city; hourly congestion; fresh eyes on M3. **M3 deadline Sun Nov 29** | Optional: two lines share a stop and riders transfer |
| 8 | Nov 30–Dec 6 | **M4 Goals. System cutoff Sun Dec 6.** RIDERSHIP contracts; events; medals; Goliath; express behind I3; route insert; full sweep | A contract in the grid city; roadworks hatched a day ahead; insert a stop and no bus jumps |
| 9 | Dec 7–13 | **Tuning freeze** ([SC-08](docs/history/lessons-ledger.md)): bands, pacing ladder, Home menu, save list, nightly update test. **P2, Dec 12–13** | Home to a first profitable day in ≤8 minutes without help; the pacing script shows the first report card by 20 |
| 10 | Dec 14–20 | **M5 Prototype.** P2 fixes as data, copy and layout; slow-laptop run. **Tag `prototype` Sun Dec 20** | Each city: Home → founding → a profitable day; P2 notes show players reached a profit untold |
| 11–12 | Dec 21–Jan 3 | Holidays: buffer, fixes only. **M5 deadline Sun Jan 3** | — |
| 13 | Jan 4–10 | Look and charm; store page draft | Side by side with V1, you prefer ours or call it a tie |
| 14 | Jan 11–17 | **M6 Content complete; freeze Sun Jan 17.** Third city; near-zoom bus; help; settings; accessibility. RC1 | Ten minutes in the third city; nothing feels unfinished |
| 15 | Jan 18–24 | **Soft launch Fri Jan 22**; release workflow; screenshots, clip | Saves survive a browser restart in the itch embed on two browsers |
| 16 | Jan 25–31 | **M7 Release candidate.** Fixes only; RC2; checklist dry run | Every checklist line ticked by a person |
| 17 | Feb 1–7 | **Publish v1.0 Sun Feb 7** | The public page loads on a computer that has never seen it |
| 18–20 | Feb 8–28 | Buffer, hotfixes. **RC deadline Feb 14; hard deadline Feb 28** | — |

**Call: prototype Sun Dec 20, publish Sun Feb 7, hard stop Feb 28.** Dec 20 keeps the holidays as real buffer, and Feb 7 leaves three weeks before the hard stop: about 5.5 of 20 weeks are buffer.

**Cut first if late, in order:** (1) Boston or any real city; (2) express lines; (3) the near-zoom bus; (4) events down to roadworks; (5) the third city; (6) route insert (keep remove and extend); (7) Goliath and the top medal; (8) hourly congestion (flat road-class speeds); (9) the report card to three categories. Charm items can be cut one at a time and never block a milestone.

**Never cut:** the money loop, contracts, the failure floor, the checklist, the calm shell, save integrity, the update flow, the invariants and sweep, the e2e smoke, your playtests, P2 and the soft launch.

**Triggers.**
- **First dollar not in by Sun Nov 1:** unfinished guards move to nightly or after M3, the Boston spike stops, and every session works on income.
- **Sun Nov 1 capacity check:** more than a week behind → apply cuts 1 and 2 now.
- **M3 not signed off by Sun Nov 29:** cut 1–3.
- **A week-8 item not green by Sun Dec 6:** it moves to 1.1.
- **M5 not signed off by Sun Jan 3:** cut 4–6; target Sun Feb 21.
- **RC not green by Sun Feb 7:** publish the Sunday after it goes green. **Not green by Sun Feb 14:** publish Sun Feb 28 as "0.9 early access" with whatever passes the checklist; failures are cut, not fixed.
- **Two weeks with no merged PR and no playtest note:** cut the next item at the next session ([SC-11](docs/history/lessons-ledger.md)).

---

## 11. Publishing and distribution

**Recommendation: free on itch.io as a browser game, plus the same build on GitHub Pages as an offline web app; Steam later.** Platform terms change; check them first.

| Platform | Needs | Verdict |
|---|---|---|
| **itch.io** | A creator account and page; an HTML5 zip played in an iframe on another domain; cover, screenshots, tags; `butler` uploads with an API key as a CI secret | **v1.0 storefront**; meets the studio's target: prototype in Nov–Dec 2026, publish in Jan–Feb 2027 |
| **GitHub Pages** | The deploy workflow and both Pages gates ([DP-02](docs/history/lessons-ledger.md)); a private repo needs a paid plan for Pages | **v1.0**, the canonical offline build; public but unannounced from week 1 |
| **Steam** | A per-game fee (about US$100 when last checked); identity, tax and bank setup; weeks of "coming soon"; a desktop build with an updater ([DP-09](docs/history/lessons-ledger.md), [K15](docs/history/salvage-matrix.md)) | After launch |

**Call: store admin starts in week 2.** Check itch.io's account-holder requirements (identity, age, payouts) before week 2; whoever holds the account (D3) must meet them. Uploading the M0 build to a restricted page in week 2 tests in October whether saves survive inside itch's iframe and whether the service worker should be off there. Until it passes, the itch build ships without it; if saves fail, the page links to Pages instead; save export is the safety net.

**Price (D4):** free needs no payment setup and reaches the most players. Pay-what-you-want, even at a $0 minimum, takes payments, so the account holder must first set up payouts and any tax forms the platform asks for.

**Supported in v1.0.** Desktop and laptop browsers with WebGL: current Chrome, Edge and Firefox, and Safari if a Mac is available to test on; mouse and keyboard; 1152×720 or larger. Phones and tablets get a "needs a computer" screen. **Budgets:** I14 in CI, plus 30 fps with 200 buses on the slowest laptop you have (§8).

**Privacy.** No analytics, ads, accounts or third-party requests: the game loads only its own files, and the offline check ([S20](docs/history/salvage-matrix.md), adapted to allow the build's own files) fails CI on any outside URL. Saves and exported sessions stay on the player's computer unless the player sends them; the store page says so in one line.

**Release checklist** (`docs/RELEASE.md`; CI ticks what it can):
- CI green on the tag; version and changelog from git ([PR-15](docs/history/lessons-ledger.md)).
- Every save fixture since the soft launch loads (older ones are set aside with a message, §6); the update test passes; a tab on the previous release shows "Update ready" and keeps its save ([DP-01](docs/history/lessons-ledger.md)).
- Offline reload with the network cut ([TS-11](docs/history/lessons-ledger.md)); a 30-minute top-speed soak without console errors or climbing memory.
- Played on your machine, the co-developer's, the slowest laptop available and inside the itch embed.
- Credits and licences, including OpenStreetMap and census if a real city ships.
- Store page: pitch, cover, 3–5 screenshots, a 20–30 s clip, the privacy line, "saves live in your browser; use Export to back up", and a feedback link that asks for an exported session.
- Any AI-use disclosure the store asks for, answered truthfully (Claude wrote the code).
- Tag, `butler` push, Pages `version.json` matches; previous build kept hidden for rollback.

**Updates.** V3's flow, unchanged: prompt to update, never swap a running tab, at most 2 automatic reloads, an unpinned `index.html`, none of V1's six recovery layers ([DP-01](docs/history/lessons-ledger.md)). After launch `main` deploys only to a private itch draft and only tags reach the public pages ([DP-03](docs/history/lessons-ledger.md)). Hotfixes for two weeks, then at most one update a fortnight.

---

## 12. Risks and mitigations

1. **Momentum dies,** like the 53 silent days since Aug 20 ([SC-11](docs/history/lessons-ledger.md), [SC-01](docs/history/lessons-ledger.md)). A merged PR and a note every week; the two-quiet-weeks trigger; 5.5 buffer weeks.
2. **The money loop closes late** ([GD-01](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)). First dollar by Nov 1 with its trigger; cheapest guards only; 8-minute CI.
3. **A correct game that is not fun** ([GD-07](docs/history/lessons-ledger.md), [GD-08](docs/history/lessons-ledger.md), [TS-10](docs/history/lessons-ledger.md)). P0, a fixed protocol, P2 before the tag, the soft launch, the charm budget.
4. **You do not like the look** ([GD-07](docs/history/lessons-ledger.md), [RN-02](docs/history/lessons-ledger.md)). V1's style in week 1, side-by-side shots, D8 by Nov 8.
5. **A rewrite or renderer pivot** ([SC-02](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md)). One stack, a numeric fallback on Oct 25, no change after Nov 1.
6. **Exploits return or balance thrashes** ([GD-13](docs/history/lessons-ledger.md), [EC-12](docs/history/lessons-ledger.md), [SC-08](docs/history/lessons-ledger.md)). Invariants with each system, the sweep in CI, the Dec 6 cutoff, January content only.
7. **Real-city work eats the schedule** ([WD-01](docs/history/lessons-ledger.md), [WD-03](docs/history/lessons-ledger.md)). A separate branch, a two-session cap, numeric gates.
8. **Updates or saves break, especially in itch's iframe** ([DP-01](docs/history/lessons-ledger.md), [DP-04](docs/history/lessons-ledger.md)). V3's PWA on day one, the schema hash, the October iframe test, the soft launch.
9. **It runs badly on low-end laptops** ([AR-07](docs/history/lessons-ledger.md), [RN-04](docs/history/lessons-ledger.md)). Worker sim, icon buses, a software-GL CI run, real laptops measured in weeks 1, 4 and 10.
10. **Store admin stalls the publish** ([DP-09](docs/history/lessons-ledger.md)). The itch account in week 2, its holder named in D3.
11. **Process bloat or lost work** ([PR-04](docs/history/lessons-ledger.md), [PR-05](docs/history/lessons-ledger.md), [PR-07](docs/history/lessons-ledger.md), [PR-08](docs/history/lessons-ledger.md)). No crew, few docs, one owner session, squash off, slow checks nightly.

---

## 13. Decisions you and the co-developer must make

Answers go in `docs/DECISIONS.md`; until then the plan assumes the recommendation. A late answer takes effect from the next week; it never reopens finished work without a cut elsewhere.

| # | Decision | Options | Recommendation | By | What it changes |
|---|---|---|---|---|---|
| D1 | Cities in v1.0 | (a) procedural only; (b) plus Boston if it passes; (c) real cities first | **(b).** A no-go reverses [WD-07](docs/history/lessons-ledger.md) for this release; (c) puts V1's pipeline on the critical path ahead of income | Run the spike **Oct 18**; go/no-go **Nov 1** | Go: Boston takes January's third-city slot, and credits add OpenStreetMap and census. No-go: a radial procedural city takes it; Boston is the first 1.1 item. Nothing before January changes |
| D2 | Renderer and stack | (A) flat 2D; (B) MapLibre paper board; (C) three.js scene | **(B)**, measured fallback Oct 25 | **Oct 18** | Every render task from week 1; (A) or (C) drops V1's style port, and after Nov 1 is not allowed |
| D3 | Platform and account holder | itch.io + Pages; Pages only; Steam first; who holds the account | **itch.io + Pages** | **Oct 18** | Week 2's itch save test and the `butler` key (§11). Steam first adds a desktop build, updater and signing ([DP-09](docs/history/lessons-ledger.md)) and would move publish past February |
| D4 | Price | Free; pay-what-you-want; paid ($3–5) | **Free or pay-what-you-want;** assume free | **Dec 20** | Free: nothing. Pay-what-you-want or paid: payout and tax setup by the account holder before the Jan 22 soft launch |
| D5 | Title | Intralines; Interbus; new | **Intralines**, after a name check | **Jan 3** | Splash, store page and itch URL in week 13; save keys stay `interbus.*` either way |
| D6 | Roles, hours, playtesters | §9 roles; hours per person; names for P2 and soft launch | The co-developer picks from §9; 3 names for P2, 10 for soft launch; assume 2–4 h a week from you and the co-developer at milestones | Roles **Oct 18**; names **Nov 22** | Hours decide how much of the cut list the Nov 1 capacity check applies; no names by Nov 22 means P2 uses family and the soft launch shrinks |
| D7 | Save-format choices | Start cash $310k/$400k/$500k; headway or bus count; fare per line or company; V1 import | **$310k ([X-09](docs/history/lessons-ledger.md)); peak and off-peak headway ([X-13](docs/history/lessons-ledger.md)); per-line fares ([X-12](docs/history/lessons-ledger.md)); no import ([DP-08](docs/history/lessons-ledger.md))** | **Oct 25** | The save schema and first fixture (week 2) and the line inspector (week 4); a later change costs a version bump |
| D8 | Look and art | Paper board, crisp chrome; pure V1 paper; sleek. Do V3's described bus models exist? | **Paper board, crisp chrome;** icons; models only if files arrive by Dec 1 | **Nov 8** | Design tokens and the chrome from M2 on, and January's look week; models after Dec 1 wait for 1.1 |
| D9 | The Out list | Accept §2 or move items | **Accept**, express behind its test; anything moved in names something moved out | **Oct 18** | `docs/SCOPE.md` and the cut list |
| D10 | Failure severity | The §3 floor; gentler; none | **The §3 floor** | **Nov 15** | Week 6's failure floor and restart, and the M3 overspend check |

---

## 14. The first two weeks

**Call: in week 1 you see a V1-like paper city, deployed and updatable; only the cheapest guards follow in week 2** (id allocator, save envelope with schema hash, worker clock). One draft spent two weeks on guards before gameplay; reviewers preferred showing you the look first, after 53 silent days ([GD-07](docs/history/lessons-ledger.md), [SC-11](docs/history/lessons-ledger.md)). Docs-lint is dropped; a lint against bare literals ([X-10](docs/history/lessons-ledger.md)) waits until after M3, and the nightly update test until week 9.

**Before the first session:** commit this plan, `README.md` and `docs/history/` as the first commit, and give the Claude environment read access to `Intralines`, `Intralines_City_dep` (private) and `Intralines_City`; every port in §7 reads from them.

**Week 1: Oct 12–18**

| # | Who | What | Done when |
|---|---|---|---|
| 1 | Claude | Commit `docs/SCOPE.md` (one page), `docs/DECISIONS.md` (D1–D10 with the §13 defaults), `CLAUDE.md`, `docs/playtests/PROTOCOL.md`; the review's harness files ([salvage matrix](docs/history/salvage-matrix.md) §B5) go under `tools/seeds/` only if they were handed over, since no repo holds them | On `main`; you read SCOPE in under 5 minutes |
| 2 | You (and the co-developer) | Answer D1, D2, D3, D6, D9; set repo visibility, Pages from Actions, branch protection, squash off | In DECISIONS by Sun Oct 18 |
| 3 | Claude | Scaffold (Vite, React, strict TS, Vitest, pinned Playwright, two lint rules, LFS, CI); deploy workflow with SHA poll; V3's PWA flow ([S08](docs/history/salvage-matrix.md)); version chip | CI green; a second deploy shows "Update ready", reloads once, and works with the network cut |
| 4 | Claude | Make V1 playable for P0: the live site if it still serves, else a build of `Intralines@7af45b1` | You open V1's Riverton in one step |
| 5 | You, the co-developer, others if available | **P0:** 30 minutes of V1 each under the protocol | `docs/playtests/2026-10-17-p0-v1-baseline.md` |
| 6 | Claude | Port V1's Riverton generator and offline style with bundled glyphs; chip row; chrome script; measure gzip per chunk, menu critical path and first frame under software GL | Side-by-side with V1's `demand-far.jpg` committed; style test ([K21](docs/history/salvage-matrix.md)) and chrome check (I13) pass; numbers in DECISIONS |
| 7 | You; the co-developer | M0 check (§10); the co-developer tries a second laptop and asks after V3's described bus models and any Subway Builder shots | Notes in `docs/playtests/` |

**Week 2: Oct 19–25**

| # | Who | What | Done when |
|---|---|---|---|
| 8 | Claude | Port V3's ledger, saves (bus counter, schema hash), calendar, errors; V2's RNG, graph, A*; V1's geo | Ported tests, I7 and the schema-hash test pass, each shown failing on the old bug |
| 9 | Claude | Worker host (fixed step, commands, snapshots, command log); demand cells, buildings from cells, city invariants | I8 green; I10 green on three seeds |
| 10 | Claude | Catchment probe from the `rules/` function; minimal founding; headless smoke | An e2e test reads "people within a walk"; smoke green within 8 minutes |
| 11 | The D3 account holder; Claude | Open the itch.io account and a restricted page; upload the M0 build and test saves across reload and restart | Page exists; result in DECISIONS. If D3 is open, this moves to week 3 |
| 12 | Claude, separate session on `spike/boston` | Port V1's pipeline and fixtures; a dispatch-only bake job; bake Boston from pinned sources | `docs/spikes/boston.md` by Sun Nov 1; `main` untouched |
| 13 | Claude | Evaluate the renderer trigger (§6); write `docs/specs/current.md` for M1, ≤150 lines, "first dollar by Sun Nov 1" at the top | Both committed by Sun Oct 25 |
| 14 | You | Answer D7 and up to five questions; week-2 check | In DECISIONS; note committed |

If week 1 slips, items 3 and 6 still come first: a deployed, updatable paper board shows you in the first week that this version looks like the one you asked for.
