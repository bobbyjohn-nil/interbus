# M3 · Money loop

**A quarter on Boston that can be won or lost by Sun Nov 29 2026: fares, stop tiers and three bus models give the network its levers; a report card, HEADWAY contracts and a failure floor give the money its weight; transfers join the lines.** It is money work (PLAN §0 call 1). The only presentation items are the two PLAN §10 schedules for week 5 (the art check and the three.js proof, 1.5 sessions of 16).

One spec per milestone, ≤150 lines, with magnitudes and a cut line ([SC-06](../history/lessons-ledger.md), [SC-07](../history/lessons-ledger.md)). Written 2026-10-13 from PLAN §3, §4, §6 and §10 (weeks 5–7), DECISIONS D7, D10 and D12, and a survey of V1, V2 and V3's contract, report-card, credit, fare, stop, undo, save, fleet and route code (cited below; V2 at its archive branch). When this spec and those disagree, they win; fix this file in the same PR. M2's spec is archived in [m2-first-line.md](m2-first-line.md).

## Exit check (the owner, 10 minutes, on the deployed preview)

"Checklist → profitable day → contract in about 8 min; the report card; overspend → countdown → restart" (PLAN §10 week 6). Concretely, on Inner Boston r1:
1. Found, place a depot, draw a line and close a day in profit, following the checklist, in about 8 minutes.
2. "5/5 Take a contract": a HEADWAY contract near Longwood ("every 15 min at Longwood, 10 days") shows today's headway against the ask; meeting it for 10 days pays it, as one ledger row.
3. Day 10 closes the quarter: the report card grades Coverage, Reliability, Comfort and Money, and pays or fines as a ledger row.
4. Overspend into the credit line: a countdown chip reads "5 days to get above −$150k"; let it run out and **Restart this quarter** reopens the quarter-start save.
5. Two lines sharing a stop at Kenmore carry riders who transfer (week 7).

## Dates

| When | What |
|---|---|
| Sun Nov 1 | M1's checks: capacity; recompute (R2, D11); velocity |
| Sun Nov 8 | M2 on the preview (the owner's exit check, from day 2's card); **`sim.json` format 1 frozen**, with the landmarks (item 1) in it; the light token pick (≤0.5) |
| Nov 9–15 | Week 5, 6 sessions: items 1–8, and the art check (≤0.5) and three.js proof (≤1) |
| Sun Nov 15 | **`city-boston-r1`**: β fit, `tripScale` re-measured, starting cash derived, Overture heights; the preview plays Inner Boston |
| Nov 16–22 | Week 6, 5 sessions: items 9–12; **P1** (the owner and the artist) |
| Nov 23–29 | Week 7, 2.5 sessions (Thanksgiving): items 13–14. **M3 deadline Sun Nov 29** |

## Above the cut line (all of it is M3)

1. **Landmarks in `sim.json`, before the Nov 8 freeze:** a named point for each contract target, from a committed list in `cities/boston/city.json`; a contract's reach (a 650 m walk) is a game rule, not baked. Done 2026-10-13: Copley Square, Longwood, Kenmore, Kendall Square, Harvard Square and Downtown Crossing, each the label the map file draws; the fixture holds the first three, and G6 fails a bake on any outside the extent.
2. **Three bus models** (V1's rows, the same in V1, V2 and V3: `Intralines@7af45b1:src/game/constants.ts:161-233`):
   - Sparrow 28 seats, $95k, $0.90/km, 26 km/h; Metro 40: 70 seats, $260k, $1.50/km, 25 km/h; Goliath: 115 seats, $440k, $2.20/km, 23 km/h (unlocked by silver in M4; a config flag until then);
   - **one model per line**, so its cycle, speed and cost are one row's, never V1's averaged mixed fleet (`Intralines@7af45b1:src/game/store.ts:603-636`). Changing model swaps the buses at half their price back (V1's resale without wear: wear is out, PLAN §3).
3. **V2's waits (EC-08, done 2026-10-13) and crowding per period (K27)**: riders time the stop only at a headway they can plan around, and a long wait counts convexly, so a starved line no longer pays (DECISIONS, Measured). Then crowding (done 2026-10-13): each half-hour, a line offers seats each way (departures × seats); riders beyond its busiest leg's seats are shed in that half-hour only, never the whole day (V1 shed the day from its peak hour, `Intralines@7af45b1:src/game/sim/demand.worker.ts:575-590`) and never a whole period, which would shed riders at 06:30 who fit (PLAN's "hourly crowding"). The line inspector shows "Full at 17:00" and the riders turned away a day when it sheds.
4. **The fare band** (EC-09, X-12; done 2026-10-13): a per-line fare from $1.00 to $5.00 in $0.25 steps.
   - The perceived cost is V2's: (fare − $2.25) ÷ $0.18 a minute × (3 km ÷ ride)^1.5, clamped to [0.15, 1.6] (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:88-104`), charged once per trip, not per boarding (EC-04, K05).
   - The subsidy tapers to $0 at $5 (V2's fix for "drag to $5", `…:Gaming/src/30-sim.js:3687-3700`).
   - The inspector prints the band in which net is within 5% of its best, not one argmax.
5. **Stop tiers and flags** (UX-13; V1's ladder, `Intralines@7af45b1:src/game/constants.ts:49-75`): Sign $4k, Shelter $12k, Station $35k, Interchange $90k (3 lines), Transfer Hub $200k (5 lines); walk bonus 0 / 0.8 / 1.8 / 2.6 / 3.4 min and transfer penalty 6 / 6 / 5 / 3.5 / 2 min (EC-10). Each stop's boardings, alightings and net a day; flagged QUIET under 5 boardings a day or LOSS under −$20 a day, with an icon and a word (done 2026-10-13: a ring and the word on the map, and a stop card). Downgrading or removing refunds half the tier's price (tiers done 2026-10-13, on the stop card; removal waits for item 14).
6. **Finance**: the ledger's rows by kind, for today, yesterday and this quarter, actuals beside the forecast; contract, card, credit and capital rows included (V1 and V2 left fixed costs and capital out, so "profit" overstated).
7. **Undo while paused (I9; UX-09, X-11):** every command taken since the last unpause, newest first, each named ("Undo: Create Line 2"), restoring state and cash to the cent; refused with a reason once time has run. Never V2's undo, which rewound days of income (`…:Gaming/src/60-main.js:602-695`).
8. **Saves for r1 (D12, WD-10):**
   - stops anchored by place, so a save from r1 loads on r2 with its stops re-snapped by the stop rule, and a stop that no longer snaps is refused in words (the r1→r2 save test; M2 sets another revision's save aside, and this replaces it);
   - a missing city file is a readable refusal, never a substitute city;
   - three slots and the autosave, and export and import of a save file through `src/platform`; an import that does not decode is refused and the live save kept (V1 overwrote it, `Intralines@7af45b1:src/game/store.ts:1883-1901`).
9. **The report card (EC-14, EC-07, K03)**, every quarter (10 days):
   - Coverage: residents within a walk of a stop, weighted by its service, (calls a day ÷ 64)^0.75 (V2's fix, `…:Gaming/src/30-sim.js:3884-3918`);
   - Reliability: each line's running headway against its own timetable, so a line short of buses scores below 100 and one that runs nothing scores nothing (V1 read a stale 15 minutes; V2 scored 100 when nothing ran);
   - Comfort: the share of riders not shed by crowding, and stop tiers;
   - Money: the quarter's operating net against its revenue.

   Bands and the payout (V1's: (overall − 55) × $1,600, a fine of $8,000 under 35) are set from a measured spread of opening companies over 10 seeds, recorded in DECISIONS before they ship (V2 measured 45.8 / 56.4 / 65.6; V3 guessed).
10. **The failure floor (D10):** cash may go to −$150k, a credit line with one lender, at 0.06% a day on what is owed, as an Interest row. A purchase that would pass the limit is refused. Five day closes in a row below it end the run: a countdown chip from the first, and **Restart this quarter** from the quarter-start save, written automatically. Sandbox turns failure off. No version built this (the survey); V1's lenders are the source of the numbers (`Intralines@7af45b1:src/game/store.ts:1765-1831`).
11. **HEADWAY contracts (GD-04, I11):** three slots, rolled at a day's start by the seeded RNG near landmarks not already held, at 10, 15 or 20 minutes for $240k, $150k or $60k (V2, `…:Gaming/src/30-sim.js:4747-4805`).
    - Met on a day when every **running period's** headway at a stop within the landmark's reach is at or under the ask, so no contract is met by one period alone (I11; V2 averaged 16 hours across lines).
    - It is held 10 days in a row within 20 days, and paid once as a ledger row; a miss resets the count. Accepting is a click, so the player chooses.
    - The card shows today's figure against the ask.
12. **Checklist step 5 and Export session:** "5/5 Take a contract" ends the checklist. Export session writes the quarter-start save plus every command since, with the build SHA, through `src/platform`; a test replays it to the same state hash (AR-06, PLAN §6).
13. **Transfers (EC-10, K23):** one transfer, at a shared stop or two stops within 250 m (a 1.5-minute walk), with the tier's penalty; riders scan every line at a stop, so every line at a 6-line hub boards riders (I5). Fare is perceived once per trip, so splitting a line raises revenue plus subsidy by at most 1% (I4; V3 measured +69% on V1's model, `Intralines_City@dc63602:studio/DECISIONS.md:252-262`).
14. **Route edits:** remove a stop (a line keeps ≥2; an orphaned stop refunds half its price, never V2's orphans) and extend from either end. Insert waits for M4.

## Magnitudes (expected before measuring, [TS-12](../history/lessons-ledger.md); out of range means find out why before tuning)

| Quantity | Expected | Source |
|---|---|---|
| Starved line (hourly, 1 bus) against the best | ≤60%: **−$72.10 against $1,905.82 measured** with V2's waits (EC-08), 98.5% with V1's | I3, K28 |
| Fare optimum on the debug line | $1.75–$3.25, not $5: **$1.75 on the starter's headways, $2.00 on the best, measured** | EC-09, V2's six optima |
| Metro 40 every 10 min on a 3.5 km line | 3 buses, $780k: beyond the starting cash | Item 2 |
| Riders turned away on Inner Boston's ten corridor lines | **13.3% on Sparrows every 10 min, 0.8% on Metro 40s, measured**, all on Washington Street | Item 3, K27 |
| Opening company's first card | 45–65, median about 56 | V2's measured spread |
| HEADWAY payout over 10 seeds | within ±30% of the median (V2 varied $60k–$480k) | I11, GD-04 |
| Days to recover from −$150k at +$1,400 a day | about 107 | Item 10 |
| Recompute with crowding and transfers on Inner Boston | ≤150 ms p95 (44.6 ms without, measured) | I14 |
| Export session for a quarter | the save (≈10 KB) plus a few KB of commands | Item 12 |

## Tests that must be green (each shown failing with the old bug restored, [TS-04](../history/lessons-ledger.md))

- **I3** on the sweep: fare and headway interior optima, starving ≤60%, none boarding in a period a line does not run; **the sweep runs in CI** (nightly if it passes 8 minutes).
- **I4** split a line: revenue plus subsidy rises ≤1%. **I5**: every line at a 6-line hub boards riders.
- **I9**: undo refused after time runs; undo while paused restores cash exactly.
- **I11**: contract income over 10 seeds within ±30% of the median; no HEADWAY contract met by one period alone.
- **I1** with the new rows (Interest, Contract, Report card, Refund); **I7, I8** with contracts and undo; the r1→r2 save test.
- **e2e (I15)**: the exit check, items 1–4, on the fixture, and Export session replayed.

## Below the cut line (cut in this order if Nov 29 is at risk)

1. Hourly congestion (PLAN cut 8), to 1.1.
2. Route extend, to M4 with insert.
3. Save slots: the autosave and export only.
4. Stop tiers above Shelter; QUIET and LOSS stay.
5. The three.js proof, to week 13 (cut 3's evidence then comes from the art check alone).

**Never cut from M3:** crowding per period; the fare band; the report card; the failure floor; HEADWAY contracts; undo while paused; `city-boston-r1` on Nov 15; transfers.

## Out of M3 by plan

- RIDERSHIP contracts, events, medals and the Goliath's unlock, express behind I3, route insert (M4, week 8, system cutoff Dec 6).
- Tuning k, Boston's bands and pacing (week 9); Home and the save list (week 9).
