# M2 · First line

**A player-built line on the fixture by Sun Nov 8 2026: found, place a depot, draw four stops, set every 20 minutes, buy the buses it needs, and watch them run while every cost lands as a ledger row.** It is money work (PLAN §0 call 1); the shell, the line and stop layers and the code-drawn bus glyph are the layers its exit check needs.

One spec per milestone, ≤150 lines, with magnitudes and a cut line ([SC-06](../history/lessons-ledger.md), [SC-07](../history/lessons-ledger.md)). Written 2026-10-13 from PLAN §3, §5, §6, §8 and §10 (week 4), DECISIONS D7, D10, D11, D12 and D17, and a survey of V1 and V3's economy, fleet and line code (cited below). When this spec and those disagree, they win; fix this file in the same PR. M1's spec is archived in [m1-first-dollar.md](m1-first-dollar.md).

## Exit check (the owner, 10 minutes, on the deployed preview)

"Found, depot, 4 stops, every 20 min, overnight off: cash moves exactly as the inspector said" (PLAN §10 week 4). Concretely, on mini-Boston:
1. Name and colour the company. Cash reads the founding capital, its one ledger row.
2. Place a depot on the green tint; the cursor card reads "Industrial ✓ · street N m ✓ · $150k".
3. Draw four stops from Copley to Longwood. The card reads "every 20 min needs 2 Sparrows · $190k"; Create buys them.
4. Press play at 05:00. Buses pull out of the depot, run the line and go back at 24:00.
5. At 24:00 the day card's rows (fares, subsidy, running, wages, depot upkeep, deadhead) are ledger rows that sum to the change in cash, and each cost equals the line inspector's forecast to the cent.

## Dates

| When | What |
|---|---|
| Sun Nov 1 | M1's checks: capacity; recompute (R2, D11; **44.6 ms p95 on Inner Boston, measured 2026-10-13**); velocity |
| Nov 2–8 | Week 4, 6.5 sessions: M2 (PLAN §10) |
| Sun Nov 8 | M2 on the preview; **the full Inner Boston pack green (G1–G10)**; **`sim.json` format 1 frozen**; the owner's light token pick (≤0.5 session). The artist: `sparrow` and `goliath` blockouts |

## Above the cut line (all of it is M2)

1. **One cycle function** (K07, I6), used by the forecast, the costs, the bus count and the vehicle layer:
   - a round trip is twice the drive along the line's route at the bus's speed (Sparrow 26 km/h), plus 20 s per intermediate stop each way, plus a 4-minute layover at each end (`Intralines@7af45b1:src/game/sim/demand.worker.ts:211-219`, without V1's refuelling term: fuel is out, PLAN §2);
   - buses needed = the most any running period needs, each ⌈cycle ÷ headway⌉;
   - a line short of buses runs every cycle ÷ buses instead, and demand reads that (`Intralines@7af45b1:src/game/sim/demand.worker.ts:224-229`).
2. **Depots.**
   - **Depot land** is baked into `sim.json` before the format freeze: OSM industrial land, 7.36 km² of Inner Boston (measured). V1's 60 m margin and census fallback (`Intralines@7af45b1:src/game/store.ts:313-401`) are not needed, so the tint is exactly the rule.
   - **Placement** needs depot land, the nearest street node within 400 m and 120 m from any other depot (`Intralines_City@dc63602:src/game/depots/siting.ts:75-92`); one `sim/rules` predicate draws the tint, writes the card and checks the command (GD-05).
   - **Price** $150k × 1.5ⁿ for the nth depot, to $5k (V1 ladder); 6 buses each; upkeep $300 a day.
   - **A depot comes first:** no line or bus before a depot (V1).
3. **The line tool.**
   - **Placing stops.** A click places a stop on the nearest street node. It joins an existing stop within 250 m, with a "joins … · transfer" ring (EC-10; V2's `STOP_SNAP_EXISTING_M`, `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/10-core.js:108`). Legs route by the existing A*.
   - **The draft card.** It shows stops, km, the 650 m walk ring with "≈N people within a walk", and the price.
   - **Create** needs 2 or more stops and the cash, and buys the stops ($4k each) and the buses the founding headway needs.
   - **Refusals** carry reason codes, read as copy of 8 words or fewer, and in money where money is short ("$55k short", UX-03); never a raw code (V3's `insufficient_funds` bug).
4. **Headways to purchase.**
   - **Three headways per line** (D7). Peak and off-peak always run, each at 60 min or less; overnight is "no service" or no more often than off-peak. One predicate per limit.
   - **Founding** sets peak and off-peak alike, overnight off.
   - **A headway that needs more buses** shows "needs 3 buses, you have 2 · $95k" (GD-09), and confirming buys them. Sparrows only: the Metro 40 and Goliath rows are week 5.
5. **All costs, as ledger rows banked hourly and closed daily:**
   - running at the model's per-km rate (Sparrow $0.90/km, V1's `costPerKm`, which already includes fuel; V3's spec counted fuel twice);
   - driver wages at $26 an hour per bus in service;
   - depot upkeep;
   - deadhead, the A* drive from the depot to the first stop and back for each bus each service day, at the same km and wage rates (`Intralines_City@dc63602:src/game/depots/deadhead.ts:138-142`, never wired in V3).

   Purchases are rows when bought. The founding recipe counts its buses with the cycle function, which closes STATUS's open K07 item.
6. **The vehicle layer.**
   - **One MapLibre custom layer** draws the code-drawn top-down glyph, instanced in one draw call, flat to the screen when tilted, never upside down.
   - **Positions** come from a pure `busPositionAt` ported from `Intralines_City@dc63602:src/game/buses/position.ts:99-157`, with three of V3's bugs fixed:
     - a bus pulls out of its depot before its first departure, instead of appearing mid-route at 06:00;
     - each period uses its own headway;
     - a bus finishes its trip and deadheads home instead of vanishing.
   - **I12:** 50 buses of each family at the three cameras are at least 20/24/32 px, and a 4 px meta-test must fail.
7. **The calm shell** replaces M1's debug panel:
   - the founding card;
   - chips for date and clock, speed, Cash and Riders/day;
   - the checklist chip ("1/5 Place a depot", "2/5 Draw a line", "3/5 Press play");
   - a dock of 8 slots or fewer;
   - the line inspector with the day's forecast;
   - notices in one corner.

   I13 measures chrome at 6% or less at rest and 26% or less with a panel, at 1440×900, 1366×768 and 1152×720.
8. **The pack, green and frozen.**
   - **Format 1 adds** depot land and the gateways: Logan and the main road entries, with inbound commuters from the LODES OD files. Demand starts using the gateways with visitors in week 5.
   - **Gates G5–G10** are written and pass on the fixture and on Inner Boston:
     - G5: no residents in water, and Logan holds the airport gateway;
     - G6: map and demand agree;
     - G7: sizes;
     - G8: two runners, already shown;
     - G9: load in 300 ms or less;
     - G10: no transit feature.
9. **Saves.** Format 3 holds depots and three headways, and format 4 each line's buses; a line's depot is worked out on load (the nearest by drive with room), so it is not saved. Older web saves are set aside (D12).

## Magnitudes (expected before measuring, [TS-12](../history/lessons-ledger.md); out of range means find out why before tuning)

| Quantity | Expected | Source |
|---|---|---|
| Debug line by street | **3,535 m measured** (Copley 0, Symphony 1,339, MFA 2,425) | `planLine` on the fixture |
| Its round trip | 25.7 min: 2 × (8.2 min drive + 0.7 min dwell) + 8 min layover | Item 1 |
| Sparrows for every 20 min | **2** (D7's $261k starter assumed 1) | ⌈25.7 ÷ 20⌉ |
| Starter recipe; founding capital at k = 1.2 | $356,000; **$427,200** (was $313,200); $71k left after the starter | D7 |
| Debug line running cost a day | 57 trips each way × 3.535 km × 2 = 403 km × $0.90 ≈ $363; **$362.52 measured** (the day plan's 57 departures out and back) | Item 5 |
| Wages a day | 2 buses × 19 h × $26 ≈ $988; **$972.11 measured** (each bus paid from its first departure to its last arrival: 37.4 bus-hours) | Item 5 |
| Depot upkeep + deadhead a day | $300 + under $20; **$300 + $15.00 measured** (1.9 km out, 2.1 km back) | Items 2, 5 |
| Income a day | **$3,060.75 measured** (795 boardings × $3.85) | M1 |
| Net on day 2 | ≈ +$1,390: a profitable first line inside "profit by 8 minutes" (PLAN §3); **+$1,411.12 measured** | Sum |
| Depot land | 3–8% of Inner Boston's land; **7.36 km² in 155 areas measured**; the fixture's three parcels, nearest 330 m from the debug line | V1's rule, Boston's industrial strips |
| Gateways; inbound commuters | Logan + 6–12 road entries; **20 + Logan and 597,181 measured** | Inner Boston bake |
| `sim.json` with depot land and gateways | ≤1 MB gzip; **818 KiB measured** | G7 |
| Vehicle layer | one draw call; 0 frames while paused (I14) | PLAN §6 |
| Recompute with stretched headways | unchanged, ≤150 ms (I14) | Bench |

## Tests that must be green (each shown failing with the old bug restored, [TS-04](../history/lessons-ledger.md))

- **I6:** each cursor card's verdict equals its command's; a bus loops in exactly the cycle it is billed for.
- **I1:** purchases and every cost are ledger rows; the day card sums to the change in cash; the forecast equals the day's cost rows.
- **I2's bus clause:** adding a bus never cuts linked trips by more than 0.1%.
- **I3, the strategies:** "daytime longest, overnight shortest" earns less than the best all-period setting, and a night-only line is refused (EC-03).
- **I12** at three cameras, with the 4 px meta-test.
- **I13** at three sizes.
- **I17:** G1–G10 on both extents.
- **I7, I8**, still green.
- **e2e (I15):**
  - found, depot, four stops, create, run a day;
  - the day card sums to the change in cash;
  - reload and compare.

## Below the cut line (cut in this order if Nov 8 is at risk)

1. The I3 strategy sweep, to week 5's CI sweep.
2. Deadhead as its own cost, to week 5; buses still leave from the depot.
3. A second depot (the ladder and the separation rule); one depot until week 5.
4. I13 at one size instead of three.
5. The light token pick, to the Nov 15 session.

**Never cut from M2:** depot land and gateways in format 1 before the Nov 8 freeze; the cycle function; purchase; costs as rows; the vehicle layer and I12; the exit check's e2e.

## Out of M2 by plan

- Stop tiers and flags, the fare band, Finance, the Metro 40 and Goliath rows, per-period crowding (K27), visitors through the gateways, undo, save slots and export (week 5).
- Hourly congestion, transfers, route remove and extend (week 7).
- Contracts, events, express and route insert (week 8).
- Meshes and three.js (week 13).

## Calls made here (Claude's, under PLAN §13; the owner can overrule them)

- **Buses belong to a line.** They are bought for it, park at its depot (the nearest by driving time with room, V3's rule), and are counted per line.
- **No office overhead or mechanics.** V1 charged $250 a day and $260 a mechanic; PLAN lists per-km, wage, upkeep and deadhead, and staff are out (PLAN §2).
- **Wages are paid per bus in service**, as V1 did: a parked bus costs its depot's upkeep only.
- **The founding headway buys its buses at Create**, so the first day runs as forecast; PLAN §3's "needs 1 Sparrow" text was illustrative and becomes 2.
