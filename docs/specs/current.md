# M5 · Prototype

**Boston end to end, balanced, saved and onboarded, flat and tilted, by Sun Dec 20 2026 (PLAN §4, §10 weeks 9–10).**
- **Week 9** freezes the tuning against a scripted pacing run, and adds Home, the save list and the GPU ladder.
- **Week 10** lands P2's fixes, the 2D/3D chip with drag, snap and cross-fade, the light style pass and a slow-laptop run.

No new system after Sun Dec 6 ([SC-08](../history/lessons-ledger.md)): everything here is a tunable, UI, copy or rendering. The chip and the style pass are look work, the items PLAN §10 schedules, at most one session in three until M3 is signed off.

One spec per milestone, ≤150 lines, with magnitudes and a cut line ([SC-06](../history/lessons-ledger.md), [SC-07](../history/lessons-ledger.md)).
- **Written** 2026-10-13 from:
  - PLAN §3, §4, §6, §8 and §10 (weeks 9–10);
  - DECISIONS D2, D7, D8, D13, D16 and D19, and the medals' measured entry;
  - a survey of V1's, V2's and V3's home menus, save lists, GPU handling, pacing and tilt (cited below; V2 at its archive branch).
- **Conflicts:** when this spec and those disagree, they win; fix this file in the same PR.
- **M4's spec** is archived in [m4-goals.md](m4-goals.md).

## Exit check (the owner, 10 minutes, on the deployed preview)

The plan's two checks: "Home → founding → a profitable day" (week 10), and "the scripted pacing run meets §3's targets; Home to a profitable day in ≤8 minutes; your Mac's fps recorded" (week 9). Concretely, on Inner Boston:
1. **Home to a profitable day.** The preview opens on Home. New game leads to founding, then to a day closed in profit by following the checklist, all in 8 minutes or less.
2. **The save list.** Saves lists the autosave and the slots, each with its company, game day, cash and lines, and when it was saved. Continue on Home opens the newest.
3. **Tilt and back.** The compass (the 2D/3D chip until D25), `T`, a right-drag and a held double-click all tilt the map, and a drag below 12° snaps it flat. The buildings cross-fade, and nothing in the game changes.
4. **Your Mac's fps.** The fps readout gives your Mac's 2D and 3D frame rates in stable Chrome. They go in P2's notes.
5. **The pacing report.** DECISIONS records the scripted run's minutes against §3's targets.

## Dates

| By | What |
|---|---|
| Sun Nov 22 | The owner answers the medal ladder (DECISIONS, Open; carried from M4) |
| Dec 7–13 | Week 9, 5 sessions: the tuning freeze; pacing; Home; the save list; the GPU ladder; the model viewer (≤1.5). **P2 Dec 12–13** (the owner and the artist) |
| Dec 14–20 | Week 10, 5 sessions: P2's fixes first; the 2D/3D chip, drag, snap and cross-fade; the light style pass; the slow-laptop run. **The `prototype` tag Sun Dec 20** (D16: not a version), on the commit the owner signs off; **D19 revisited** the same day |

Work starts now, ahead of the calendar. The pacing harness and the shell come first; the tuning starts ahead of P1 under D25's clearance, takes P1's notes (Nov 16–22) in, and freezes on Dec 13.

## Above the cut line

1. **The scripted pacing run** (PLAN §3's targets; [GD-10](../history/lessons-ledger.md), [EC-11](../history/lessons-ledger.md)). No earlier version had one: V1 took about 15 game days to a second bus, and nobody had checked (GD-10). `bench/pacing.ts` is a committed scripted player on Inner Boston.
   - **What the player does:**
     - founds with the founding recipe and plays its first day at 600×, then 2,700× (1,800× until the tuning freeze);
     - draws a second line along a sweep corridor once its cash covers that line and its buses;
     - takes the contracts its lines can meet, and nothing else.
   - **What it reports, in real minutes on the speed ladder** (`SPEED_RATES`, `src/sim/rules/speed.ts`: 1×, 60×, 600×, 2,700× and 5,400×, where 2,700× was 1,800× from D25 until the tuning freeze; the pacing run plays at 600× and 2,700×): first profitable day, second line, the report card, then bronze, silver and gold.
   - **The targets:** profit by 8 minutes, the second line after 15–25, the report card by 20, the top medal in 2–4 hours.
   - **The first line's 3–5 minutes** is the player's own time at the tools. The e2e founding run times its clicks, and P2 times people.
   - **Built so** (`src/sim/pacing.ts`; DECISIONS, Measured): it also adds lines past the second (with depots of their own), the fixture version holds its own bands in the PR checks, and the nightly runs it on Inner Boston on seeds 1–3 and fails when PLAN §3's minutes are missed. Since the tuning freeze (item 2): profit at 5.4 minutes, the report card at 9.1 and the second line at 20.8–23.4 meet their targets; gold does not. A player that builds toward the card, on wider candidates (`PACING_CARD_CENTS`, `PACING_CANDIDATES=wide`), gets gold at 103 minutes on seeds 1 and 3, and on seed 2 misses at the 30-bus ceiling at Coverage 58.6 (DECISIONS, Measured, 2026-10-21); the answer is the medal ladder's.
2. **The tuning freeze** (PLAN §3, D7; I10, [GD-11](../history/lessons-ledger.md)). What can be tuned from the pacing run's numbers:
   - k, within 1.0–1.8; now 1.333, giving $474,548 against the 3.5 km founding recipe, I10's cap (it was 1.2, $427,200; DECISIONS, Measured);
   - the speed ladder;
   - the medal bars, on the owner's answer or else the recommendation;
   - fare band share, crowding and contract asks.

   Each change goes in DECISIONS with its measured reason. Starting cash is written at founding, so a retune never moves a save. After Sun Dec 13 a tunable changes only for a P2 finding.
   - **Boston's balance bands** ([EC-12](../history/lessons-ledger.md)): the founding recipe's day-2 net, the best first line's net, the days to the second line and the quarter's grade under the scripted player. Each is committed as a band, so a later change that moves one fails.
   - **Built so** (2026-10-14; DECISIONS, Measured): k 1.333 ($474,548, I10's cap) and the ladder's 4 at 2,700×; the bands held nightly on Inner Boston by `bench/pacing.ts` (day-2 net $800–$1,400, the second line on days 18–35, the first card 60–70) and `bench/firstline.ts` (the best first line's day-2 net $1,500–$3,500), with I10 on both cities. The medal bars wait for the owner's answer (Sun Nov 22).
3. **Home** ([UX-07](../history/lessons-ledger.md); V1's menu, `Intralines@7af45b1:src/ui/Menu.tsx:104-253`, re-implemented per salvage R11). V2 and V3 had none.
   - **What it holds:** the first screen over the paused, flat map ([UX-10](../history/lessons-ledger.md)), with:
     - **Continue**, naming the newest save's company, day and cash;
     - **New game**, which asks first when it would replace the autosave (V1 confirmed too);
     - **Saves**;
     - the build chip.
   - **What waits:** settings, help and credits wait for week 14.
   - **Getting back:** "Back to Home" in Saves, which saves first (in a tab another tab's saves have left behind, it asks first instead, if the game has run on since: the systems audit's sixth round), and on the founding card, so New game can be left for a slot or a file (the systems audit's fifth round).
   - **Cost:** Home is gone once a game plays, so it costs nothing in I13 at rest. Its code counts toward the menu's 200 KiB.
   - **Built so** (DECISIONS, Measured): the chip row and the dock wait for the game; New game replaces the autosave with an unnamed company at once; a slot loaded from Home's Saves goes straight into that game. Home takes 8.0% of 1152×720 and adds 0.5 KiB to the menu's 95.9 KiB.
4. **The save list** (V1's rows, `Intralines@7af45b1:src/ui/Menu.tsx:278-347`; V3's backup key, [DP-06](../history/lessons-ledger.md)). Saves today shows the autosave and Slots 1–3 with day, time, company, cash and lines (`src/ui/shell/Saves.tsx`). It gains:
   - buses;
   - when each was saved, stamped into the save's envelope by the worker's clock, never the sim's (built so: an optional field outside the schema, so no new format, and an older build ignores it);
   - Delete, after a question.

   A save set aside by a format change shows as a row "A save from an older build, set aside", with Export and Delete, so it is never lost silently. Built so (DECISIONS, Measured): the panel at its tallest takes 22.3% of 1152×720, and 24.3% since the autosave has a row of its own (D26).
5. **The GPU ladder** (PLAN §6 "No GPU"; never cut). Since Chrome 139 a machine without a usable GPU gets no WebGL at all (PLAN §6's source). No earlier version had a ladder; V1 had only a lost-context card (`Intralines@7af45b1:src/map/MapView.tsx:124-131`).
   - **The rungs:**
     - **Hardware:** as now.
     - **Low graphics:** 2D only, capped at 30 fps. The compass says why it is off.
     - **No WebGL, or a context lost and not restored:** a calm card, "Turn on hardware acceleration to see the map", with Saves and Export intact.
   - **The fps readout:** behind `?fps`, read through `src/platform/`. It records frame times for exit check 4 and the slow-laptop run.
   - **CI:** CI's Chromium renders in software (SwiftShader). Built so (DECISIONS, Measured): software is known by WebGL's caveat or by its renderer's name, since this Chromium grants SwiftShader without the caveat; so the e2e tests run in Low graphics, which tests the probe, and the tilt tests ask `?gpu=full`. `?gpu=none` forces the card. Low graphics' `T` says "the map stays flat" for a moment until week 10's chip says why.
6. **The 2D/3D chip, drag, snap and cross-fade** (D2; PLAN §6 "2D and 3D"; week 10, look work).
   - **What it adds:** a labelled chip beside `T`, plus right-drag and two-finger pitch at 25–60°. Releasing below 12° snaps flat.
   - **The cross-fade:** building extrusions cross-fade once per mode change, never per frame ([RN-04](../history/lessons-ledger.md)). It replaces today's 600 ms ease (`src/render/map/loadMap.ts`).
   - **Prior art:** V1 started tilted with MapLibre's pitch control (`Intralines@7af45b1:src/map/MapView.tsx:83-111`). V3 used drag at 0.25°/px and a 400 ms ease that is instant under reduced motion (`Intralines_City@dc63602:src/render/three/constants.ts:14-49`). Reduced motion makes both the cross-fade and the snap instant.
   - **I13:** the shell at rest late in a game takes 5.96% of the 6% at 1152×720 (DECISIONS, medals). The chip must find its room in the row, measured in its PR. If nothing fits, that becomes the week's question to the owner, with a recommendation.
   - **Built so** (DECISIONS, Measured): the chip sits above the OSM corner, 56×28 px (0.19%); the dock gave 5 px of height for it (icons 18 px, buttons still 39 px tall), so the shell at rest late in a game takes 5.98%. MapLibre runs the buildings' opacity transitions; the faded layer stops drawing after 400 ms. Two fingers pitch through MapLibre's own touch pitch, and settle the same way.
   - **Since D25** (2026-10-14): the chip is a 26×26 compass that tilts, flattens and faces north, and the demand menu's 26×26 chip takes the other half of its room. A double-click held still flips 2D and 3D, held and dragged tilts; in 3D drags, Q and E turn the board.
7. **P2's fixes** (Dec 12–13). The notes go in `docs/playtests/`, and their fixes come first in week 10.
8. **The light style pass** (D8; PLAN §8 rules 1–5). It applies the owner's Nov 8 token pick, keeps the palette and contrast tests green, and puts a side-by-side with V1 in the milestone's notes.
9. **The slow-laptop run** (PLAN §6 budgets): 2D must hold ≥30 fps on the slowest machine with 200 buses, and 3D at zoom 17, pitch 60 must hold ≥30. Under that, PLAN §10's trigger applies in this order: a 3D zoom floor of 14.5, no extrusion gradient, pitch capped at 50°.
   - **Built so** (DECISIONS, Measured): no company can own 200 buses (five depots of six park 30), so `npm run bench scene` builds a save past that one rule, 209 buses on 29 Inner Boston lines at 08:00, to import through Saves. CI draws every bus in it on both builds, and the layer draws them in one call (≤7). Its heaps grew 1.0% over 30 minutes at 1,800× (≤10%), checked nightly, at 2,700× since the tuning freeze.

10. **The owner's initial playtest** (2026-10-14; DECISIONS D25, which wins over this spec where they differ; [notes](../playtests/2026-10-14-owner-first-look.md)). In order, each a small PR:
    - routes without loops;
    - the time system (8-day quarters, 1× real time);
    - the map's demand menu and copy;
    - Finance with charts;
    - the Build tab and route editor;
    - movable panels, Saves at the top and custom dropdowns;
    - 3D by double-click and hold, with rotation.

    Done first, before items 2 and 7–9. Then the clearance moves the tuning freeze ahead of P1. Progress is in STATUS.

## Below the cut line (cut in this order if Dec 20 is at risk)

1. **The model viewer** with the Boston-map preview (≤1.5; `docs/art/MODELS.md:80-88`). It is built only once the artist's `metro-40` blockout has landed ([RN-07](../history/lessons-ledger.md)); otherwise it waits for week 13. V3's `.glb` viewer had no map (`Intralines_City@dc63602:studio/viewer/main.ts:1-8`).
2. **Week 5's carried items:** the three.js proof behind a flag (≤1) and the art check. Both also wait on the first file.
3. **Drag and snap** (PLAN cut 5): two fixed states, flat and 50°, set by the chip and `T` alone.
4. **The style pass beyond the token pick.**

**Never cut from M5:** the pacing run and the tuning freeze; Home; the save list; the GPU ladder; a way from flat into 3D (the chip at least); P2 and its fixes.

## Magnitudes (expected before measuring, [TS-12](../history/lessons-ledger.md); out of range means find out why before tuning)

| Quantity | Expected | Source |
|---|---|---|
| New game to a profitable day, scripted e2e with no thinking time | ≤5 of the 8 minutes: founding, a depot, four stops and day 1 at 600× (2.4 minutes a game day) | Item 1, §3 |
| A game day at 600×, 2,700× and 5,400× | 144, 32 and 16 s (a day at 1× is a real day; D25) | `SPEED_RATES` |
| The report card under the scripted player | about 8–10 minutes: day 1 at 600×, days 2–8 at 2,700× (measured on the fixture and Inner Boston: 9.1; 11.0 at 1,800×) | Item 1, §3 |
| Days to a second line | 6–10 game days (V1: about 15, unchecked); measured 28–33 on Inner Boston at k 1.333: the founding line nets about $1,100 a day and no contract it can meet comes before day 27, so the speed ladder, not the economy, brings it into PLAN's minutes (DECISIONS, Measured, 2026-10-14) | Item 1, GD-10 |
| Bronze and silver | bronze in the first quarter; silver about day 23–41 (the fixture: two lines, one line) | M4's medals bench |
| Gold on Inner Boston | 5,000 trips a day needs about eight lines like the debug line (610 a day on the fixture); within 2–4 hours if the ladder holds | Item 2, §3 |
| k after tuning | 1.0–1.8 (now 1.333, I10's cap: a four-bus line of the starter's shape costs 1.1506× the starting cash) | I10 |
| Home and the save list in the menu chunk | within 200 KiB gzip | PLAN §6 |
| Low graphics | 30 fps cap, 2D only | PLAN §6 |
| I13 with the compass and the demand chip | ≤6% at rest at 1152×720 late in a game; 0.04% is left today | Item 6 |

## Tests that must be green (each shown failing with the old bug restored, [TS-04](../history/lessons-ledger.md))

- **The pacing run's bands:** a fixture version in the PR checks, and the full Inner Boston run nightly ([EC-11](../history/lessons-ledger.md), [EC-12](../history/lessons-ledger.md)).
- **I10 after the k tune:**
  - the best profitable first line fits the starting cash;
  - the best four-bus line costs ≥1.15× it;
  - k stays in 1.0–1.8.
- **I13** at rest and with a panel, at all three sizes, with Home, the save list, the compass and the demand menu.
- **D2:** the same commands give the same fingerprint, whether flat, tilted or in Low graphics. Built so: `e2e/modes.spec.ts` tilts and flattens a session in full graphics while time runs and replays it in Node to the same fingerprint; `e2e/session.spec.ts` does the same in Low graphics.
- **I7** for any envelope change the save list needs.
- **e2e (I15):**
  - the exit check's items 1–3 on the fixture;
  - the GPU ladder's card with WebGL off;
  - Low graphics forced.

## Out of M5 by plan

- The dark theme and the artist's models in 3D (week 13).
- Help, settings with the theme toggle, the credits screen and close-zoom lane markings (week 14).
- Steam and desktop work (after v1.0, D18).
- The demo's scope (D19: revisited Dec 20, decided by Feb 28).
