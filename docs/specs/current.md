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
3. **Tilt and back.** The 2D/3D chip, `T` and a right-drag all tilt the map, and a drag below 12° snaps it flat. The buildings cross-fade, and nothing in the game changes.
4. **Your Mac's fps.** The fps readout gives your Mac's 2D and 3D frame rates in stable Chrome. They go in P2's notes.
5. **The pacing report.** DECISIONS records the scripted run's minutes against §3's targets.

## Dates

| By | What |
|---|---|
| Sun Nov 22 | The owner answers the medal ladder (DECISIONS, Open; carried from M4) |
| Dec 7–13 | Week 9, 5 sessions: the tuning freeze; pacing; Home; the save list; the GPU ladder; the model viewer (≤1.5). **P2 Dec 12–13** (the owner and the artist) |
| Dec 14–20 | Week 10, 5 sessions: P2's fixes first; the 2D/3D chip, drag, snap and cross-fade; the light style pass; the slow-laptop run. **The `prototype` tag Sun Dec 20** (D16: not a version), on the commit the owner signs off; **D19 revisited** the same day |

Work starts now, ahead of the calendar. The pacing harness and the shell come first; the tuning waits for P1's notes (Nov 16–22) and freezes on Dec 13.

## Above the cut line

1. **The scripted pacing run** (PLAN §3's targets; [GD-10](../history/lessons-ledger.md), [EC-11](../history/lessons-ledger.md)). No earlier version had one: V1 took about 15 game days to a second bus, and nobody had checked (GD-10). `bench/pacing.ts` is a committed scripted player on Inner Boston.
   - **What the player does:**
     - founds with the founding recipe and plays its first day at speed 1, then speed 2;
     - draws a second line along a sweep corridor once its cash covers that line and its buses;
     - takes the contracts its lines can meet, and nothing else.
   - **What it reports, in real minutes on the speed ladder** (`SPEEDS`: 600, 1,800 and 5,400 game seconds a second; `src/worker/host.ts`): first profitable day, second line, the report card, then bronze, silver and gold.
   - **The targets:** profit by 8 minutes, the second line after 15–25, the report card by 20, the top medal in 2–4 hours.
   - **The first line's 3–5 minutes** is the player's own time at the tools. The e2e founding run times its clicks, and P2 times people.
   - **Built so** (`src/sim/pacing.ts`; DECISIONS, Measured): it also adds lines past the second (with depots of their own), the fixture version holds bands in the PR checks, and the nightly runs it on Inner Boston. Profit at 5.4 and the report card at 12.6 minutes meet their targets; the second line at 46.1 (day 51) and gold (none in 200 days, coverage the lowest grade) do not, which is the tuning's work.
2. **The tuning freeze** (PLAN §3, D7; I10, [GD-11](../history/lessons-ledger.md)). What can be tuned from the pacing run's numbers:
   - k, within 1.0–1.8; now 1.2, giving $427,200 against the 3.5 km founding recipe;
   - the speed ladder;
   - the medal bars, on the owner's answer or else the recommendation;
   - fare band share, crowding and contract asks.

   Each change goes in DECISIONS with its measured reason. Starting cash is written at founding, so a retune never moves a save. After Sun Dec 13 a tunable changes only for a P2 finding.
   - **Boston's balance bands** ([EC-12](../history/lessons-ledger.md)): the founding recipe's day-2 net, the best first line's net, the days to the second line and the quarter's grade under the scripted player. Each is committed as a band, so a later change that moves one fails.
3. **Home** ([UX-07](../history/lessons-ledger.md); V1's menu, `Intralines@7af45b1:src/ui/Menu.tsx:104-253`, re-implemented per salvage R11). V2 and V3 had none.
   - **What it holds:** the first screen over the paused, flat map ([UX-10](../history/lessons-ledger.md)), with:
     - **Continue**, naming the newest save's company, day and cash;
     - **New game**, which asks first when it would replace the autosave (V1 confirmed too);
     - **Saves**;
     - the build chip.
   - **What waits:** settings, help and credits wait for week 14.
   - **Getting back:** "Back to Home" in Saves, which saves first.
   - **Cost:** Home is gone once a game plays, so it costs nothing in I13 at rest. Its code counts toward the menu's 200 KiB.
   - **Built so** (DECISIONS, Measured): the chip row and the dock wait for the game; New game replaces the autosave with an unnamed company at once; a slot loaded from Home's Saves goes straight into that game. Home takes 8.0% of 1152×720 and adds 0.5 KiB to the menu's 95.9 KiB.
4. **The save list** (V1's rows, `Intralines@7af45b1:src/ui/Menu.tsx:278-347`; V3's backup key, [DP-06](../history/lessons-ledger.md)). Saves today shows the autosave and Slots 1–3 with day, time, company, cash and lines (`src/ui/shell/Saves.tsx`). It gains:
   - buses;
   - when each was saved, stamped into the save's envelope by the worker's clock, never the sim's (built so: an optional field outside the schema, so no new format, and an older build ignores it);
   - Delete, after a question.

   A save set aside by a format change shows as a row "A save from an older build, set aside", with Export and Delete, so it is never lost silently. Built so (DECISIONS, Measured): the panel at its tallest takes 22.3% of 1152×720.
5. **The GPU ladder** (PLAN §6 "No GPU"; never cut). Since Chrome 139 a machine without a usable GPU gets no WebGL at all (PLAN §6's source). No earlier version had a ladder; V1 had only a lost-context card (`Intralines@7af45b1:src/map/MapView.tsx:124-131`).
   - **The rungs:**
     - **Hardware:** as now.
     - **Low graphics:** 2D only, capped at 30 fps. The 2D/3D chip says why it is off.
     - **No WebGL, or a context lost and not restored:** a calm card, "Turn on hardware acceleration to see the map", with Saves and Export intact.
   - **The fps readout:** behind `?fps`, read through `src/platform/`. It records frame times for exit check 4 and the slow-laptop run.
   - **CI:** CI's Chromium renders in software (SwiftShader). Built so (DECISIONS, Measured): software is known by WebGL's caveat or by its renderer's name, since this Chromium grants SwiftShader without the caveat; so the e2e tests run in Low graphics, which tests the probe, and the tilt tests ask `?gpu=full`. `?gpu=none` forces the card. Low graphics' `T` says "the map stays flat" for a moment until week 10's chip says why.
6. **The 2D/3D chip, drag, snap and cross-fade** (D2; PLAN §6 "2D and 3D"; week 10, look work).
   - **What it adds:** a labelled chip beside `T`, plus right-drag and two-finger pitch at 25–60°. Releasing below 12° snaps flat.
   - **The cross-fade:** building extrusions cross-fade once per mode change, never per frame ([RN-04](../history/lessons-ledger.md)). It replaces today's 600 ms ease (`src/render/map/loadMap.ts`).
   - **Prior art:** V1 started tilted with MapLibre's pitch control (`Intralines@7af45b1:src/map/MapView.tsx:83-111`). V3 used drag at 0.25°/px and a 400 ms ease that is instant under reduced motion (`Intralines_City@dc63602:src/render/three/constants.ts:14-49`). Reduced motion makes both the cross-fade and the snap instant.
   - **I13:** the shell at rest late in a game takes 5.96% of the 6% at 1152×720 (DECISIONS, medals). The chip must find its room in the row, measured in its PR. If nothing fits, that becomes the week's question to the owner, with a recommendation.
   - **Built so** (DECISIONS, Measured): the chip sits above the OSM corner, 56×28 px (0.19%); the dock gave 5 px of height for it (icons 18 px, buttons still 39 px tall), so the shell at rest late in a game takes 5.98%. MapLibre runs the buildings' opacity transitions; the faded layer stops drawing after 400 ms. Two fingers pitch through MapLibre's own touch pitch, and settle the same way.
7. **P2's fixes** (Dec 12–13). The notes go in `docs/playtests/`, and their fixes come first in week 10.
8. **The light style pass** (D8; PLAN §8 rules 1–5). It applies the owner's Nov 8 token pick, keeps the palette and contrast tests green, and puts a side-by-side with V1 in the milestone's notes.
9. **The slow-laptop run** (PLAN §6 budgets): 2D must hold ≥30 fps on the slowest machine with 200 buses, and 3D at zoom 17, pitch 60 must hold ≥30. Under that, PLAN §10's trigger applies in this order: a 3D zoom floor of 14.5, no extrusion gradient, pitch capped at 50°.
   - **Built so** (DECISIONS, Measured): no company can own 200 buses (five depots of six park 30), so `npm run bench scene` builds a save past that one rule, 209 buses on 29 Inner Boston lines at 08:00, to import through Saves. CI draws every bus in it on both builds, and the layer draws them in one call (≤7).

## Below the cut line (cut in this order if Dec 20 is at risk)

1. **The model viewer** with the Boston-map preview (≤1.5; `docs/art/MODELS.md:167-173`). It is built only once the artist's `metro-40` blockout has landed ([RN-07](../history/lessons-ledger.md)); otherwise it waits for week 13. V3's `.glb` viewer had no map (`Intralines_City@dc63602:studio/viewer/main.ts:1-8`).
2. **Week 5's carried items:** the three.js proof behind a flag (≤1) and the art check. Both also wait on the first file.
3. **Drag and snap** (PLAN cut 5): two fixed states, flat and 50°, set by the chip and `T` alone.
4. **The style pass beyond the token pick.**

**Never cut from M5:** the pacing run and the tuning freeze; Home; the save list; the GPU ladder; a way from flat into 3D (the chip at least); P2 and its fixes.

## Magnitudes (expected before measuring, [TS-12](../history/lessons-ledger.md); out of range means find out why before tuning)

| Quantity | Expected | Source |
|---|---|---|
| New game to a profitable day, scripted e2e with no thinking time | ≤5 of the 8 minutes: founding, a depot, four stops and day 1 at speed 1 (2.4 minutes a game day) | Item 1, §3 |
| A game day at speeds 1, 2 and 3 | 144, 48 and 16 s | `SPEEDS` |
| The report card under the scripted player | about 10–12 minutes: day 1 at speed 1, days 2–10 at speed 2 | Item 1, §3 |
| Days to a second line | 6–10 game days (V1: about 15, unchecked) | Item 1, GD-10 |
| Bronze and silver | bronze in the first quarter; silver about day 23–41 (the fixture: two lines, one line) | M4's medals bench |
| Gold on Inner Boston | 5,000 trips a day needs about eight lines like the debug line (610 a day on the fixture); within 2–4 hours if the ladder holds | Item 2, §3 |
| k after tuning | 1.0–1.8 (now 1.2) | I10 |
| Home and the save list in the menu chunk | within 200 KiB gzip | PLAN §6 |
| Low graphics | 30 fps cap, 2D only | PLAN §6 |
| I13 with the 2D/3D chip | ≤6% at rest at 1152×720 late in a game; 0.04% is left today | Item 6 |

## Tests that must be green (each shown failing with the old bug restored, [TS-04](../history/lessons-ledger.md))

- **The pacing run's bands:** a fixture version in the PR checks, and the full Inner Boston run nightly ([EC-11](../history/lessons-ledger.md), [EC-12](../history/lessons-ledger.md)).
- **I10 after the k tune:**
  - the best profitable first line fits the starting cash;
  - the best four-bus line costs ≥1.15× it;
  - k stays in 1.0–1.8.
- **I13** at rest and with a panel, at all three sizes, with Home, the save list and the 2D/3D chip.
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
