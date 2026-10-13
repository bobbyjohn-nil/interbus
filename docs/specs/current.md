# M1 · First dollar, on the fixture

**The first fare dollar on the mini-Boston fixture by Sun Nov 1 2026.** Money before presentation (PLAN §0 call 1): nothing here waits for the Inner Boston bake, 3D or art.

One spec per milestone, ≤150 lines, with magnitudes and a cut line ([SC-06](../history/lessons-ledger.md), [SC-07](../history/lessons-ledger.md)). Written 2026-10-13 from PLAN §3–§7, §10, §14 and DECISIONS D7, D10, D11, D17. When this spec and those disagree, they win; fix this file in the same PR.

## Exit check (the owner, 10 minutes, on the deployed preview)

A debug line from Back Bay to Longwood: riders board, money comes in, the day card adds up (PLAN §10 week 3). Concretely:
1. Open the preview and turn on the debug line (a menu entry, no URL flags).
2. Press play at 05:00 on day 1. The chips show Cash and Riders/day moving.
3. At 24:00 the day card opens. Every figure on it is a ledger row, and the rows sum to the change in cash.

## Dates

| When | What |
|---|---|
| Sun Oct 25 | This spec merged; **the fare-row signal**: a headless fixture test where one line writes a fare row. Red → week 3 drops all map work (PLAN §10) |
| Oct 26–Nov 1 | Week 3, 5 sessions: M1 |
| Sun Nov 1 | First dollar on the preview; capacity check; recompute measured (R2 check, D11); the velocity check |

## Week 2 work M1 stands on (PLAN §14 items 10–11)

- **Ports**:
  - V3's ledger, saves (async store, bus counter, schema hash), calendar and errors;
  - V2's seeded RNG, graph and A* on (node, edge);
  - V1's geo.

  Each is shown failing on its old bug; I7 and the schema hash are green.
- **The worker host:**
  - a fixed step of 0.5 game-min;
  - `simStep()` is the only door that advances time;
  - commands apply at the next step;
  - snapshots go out at about 10 Hz;
  - I8 holds (N days in one call = N days in 72 chunks).
- **`sim.json` format 1 for the fixture**, from `tools/bake`:
  - cells: 350 m squares from 2020 blocks, each with residents, workers, jobs by sector and up to 8 weighted sub-points;
  - the street graph: degree-2 collapsed, bus access applied, no service roads;
  - the gateways;
  - `calib`.

  Its loader is in the sim. The demand dots and the "people within a walk" probe are in the preview.

## Above the cut line (all of it is M1)

1. **Clock and periods.**
   - A game starts paused at 05:00 on day 1.
   - Periods: peak 06:30–09:30 and 16:00–19:00; off-peak the rest of 05:00–24:00; overnight 00:00–05:00.
   - Each period boundary is one `sim/rules` predicate (D7).
   - The day closes at 24:00, so overnight belongs to the next day.
2. **Ledger in cents.**
   - The first row is "Founding capital", k × the starter line's cost, written once at founding.
   - k = 1.2 (a config row). The starter recipe is 1 depot + 4 sign stops + 1 Sparrow = $261,000, so founding capital is $313,200 (V1 had $310,000).
   - Cash is never stored apart from the rows (I1).
3. **The debug line**, created by one `{ok, reason}` command (`addDebugLine`):
   - 4 stops: Copley, Symphony, the Museum of Fine Arts, Longwood;
   - each stop snapped to the street graph, joined by V2's A*;
   - every 20 min at peak and off-peak, overnight off;
   - a fare of $2.25.

   The line tool is M2; this command is its seed and is cut when the tool lands.
4. **Demand, commuters only**, rewritten from V1's worker (`Intralines@7af45b1:src/game/sim/demand.worker.ts`):
   - workers = residents × V1's workforce rate;
   - destinations follow a gravity model over jobs (WAC) with β = 4.0 km (V1's worker default; r1 fits β to LODES);
   - the mode is a bus–car–walk logit with 13% captive riders, and every boarding pays the full fare ([K05](../history/salvage-matrix.md));
   - catchments sum sub-points within 650 m, with no caps ([K04](../history/salvage-matrix.md), [K23](../history/salvage-matrix.md));
   - paths are searched once and shared; only the logit and assignment repeat per period;
   - riders board only in periods the line runs.
5. **Calibration.**
   - `calib.tripScale` is set on the fixture so the debug line carries 600–1,000 boardings a day. V1's starter line (9 stops, 5.4 km, one Sparrow) carried 1,058 a day ([EC-11](../history/lessons-ledger.md)).
   - The value is set by a committed script and recorded with its run.
6. **Income.**
   - Each boarding pays the fare plus V1's $1.60 city subsidy.
   - Rows post at each game-hour boundary, per line: "Fares" and "City subsidy". Fractional boardings carry to the next hour, so cents stay exact.
   - Cash ticks each game hour.
7. **Daily close and day card.**
   - At 24:00 the sim emits the day's rows.
   - The UI shows them as a debug day card: rows, their sum, and the cash before and after.
   - React renders it at the close, never per frame ([AR-08](../history/lessons-ledger.md)).
8. **Layers** for the exit check, each a GeoJSON source updated only on change:
   - the line, as a ribbon in the line colour;
   - the stops;
   - demand dots, one per sub-point, sized by residents.

## Magnitudes (expected before measuring, [TS-12](../history/lessons-ledger.md); out of range means find out why before tuning)

| Quantity | Expected | Source of the expectation |
|---|---|---|
| Fixture residents | 105,620 exactly | `fixture.json`, G4's sum |
| Fixture cells (350 m, holding people or jobs) | 55–80 expected; **84 measured** 2026-10-13, because the fixture shares Boston's grid and the box touches 11 × 9 = 99 of its cells | Box size |
| Collapsed street nodes on the fixture | 600–2,000; **681 measured** (675 while `hgv=no` closed streets) | 16,054 OPL nodes; collapse removes most |
| `sim.json` for the fixture | 30–200 kB gzip; **56.6 kB measured** (133 kB raw) | 208 kB for all of Boston's streets (PLAN §5) |
| Jobs in the box / workers living in it | 186,144 / 41,148 (WAC / RAC sums) | Fixture CSVs |
| Commuters with both ends in the box | 9,287 (Σ S000) | Fixture OD |
| Residents within 650 m of the debug line's stops | about 50,000 | Straight-line estimate from block points |
| Debug line length by street | 3–4 km (2.76 km straight) | Stop positions |
| Boardings per day after `tripScale` | 600–1,000; **795.3 measured at 111‰** after the recompute speed-up (799.3 before; 7,164.6 at 1,000‰), 2026-10-13 | Calibration target above; PLAN §3 expects Inner Boston 7–10× Riverton |
| Income per day | $2,300–$3,900 (boardings × $3.85); **$3,060.75 measured** on a full day (`npm run bench day`) | Fare plus subsidy |
| Recompute, fixture, three periods | ≤20 ms; **3.3 ms p50 measured** with three lines (`npm run bench`; 37 ms with one line before the speed-up) | About 70 cells |
| Recompute, synthetic 800 cells, three periods | ≤150 ms p95 (I14); R2 needs ≤100 ms; **52 ms p50, 65–78 ms p95 measured** on 812 cells with T03; **44.6 ms p95 on Inner Boston** (735 cells, ten corridor lines) | PLAN §5: 50–130 ms for one period, interpolated |

## Tests that must be green (each shown failing with the old bug restored, [TS-04](../history/lessons-ledger.md))

- **Fare-row signal (Oct 25):** fixture → `sim.json` → the debug line → one day; the ledger holds a Fares row > 0.
- **I1:** cash = Σ rows, the first being Founding capital. The day card's rows are ledger rows. Retuning k between save and load leaves cash unchanged.
- **I2:** adding a line, stop or bus never cuts linked trips by more than 0.1%.
- **I3, the per-period part:**
  - riders boarding a line in a period ≤ trips generated in that period's hours;
  - none board overnight while overnight is off.
- **I7, I8**, still green.
- **I10's fixture clauses:**
  - the same inputs give the same bytes;
  - one connected network;
  - ≥90% of built-up street nodes within 650 m of a populated cell;
  - a stop with residents within 300 m draws riders within a game day.
- **e2e on the preview:** found, run the debug line one day, and check that the day card's sum equals the change in cash. Then reload and compare.

## Below the cut line (cut in this order if Nov 1 is at risk)

1. Recompute measured on Inner Boston itself. Keep the fixture and the synthetic 800-cell bench, and stay at Inner Boston (R2 needs a Boston number). **Done 2026-10-13: 44.6 ms p95.**
2. The Inner Boston bake run. The Nov 8 pack trigger covers it. **Done 2026-10-13: 735 cells, G1–G4 pass.**
3. Per-period crowding ([K27](../history/salvage-matrix.md)). It moves to week 4 with buses and costs; I3's conservation bound stays.
4. The visitor matrix (weeks 4–5).
5. Day-card polish beyond rows and their sum.

## Out of M1 by plan

- Costs, purchases and the line tool (M2, week 4).
- The fare band and QUIET/LOSS (week 5).
- Transfers (week 7) and express (week 8).
- The vehicle layer and its glyph (week 4).

## Calls made here (Claude's, under PLAN §13; the owner can overrule them)

- **Gates per extent.** The fixture touches at most 99 of Boston's cells, has no airport, and clipping it strands the Mass Pike (no ramps inside) and one-way grids whose way back lies outside the box. So the gates read a profile per extent in `cities/boston/city.json`:
  - the fixture checks 40–99 cells, 70% of drivable km kept and 97% of residents within 300 m of a street;
  - Inner Boston keeps 400–1,000 cells, 98% kept, 99% near a street, and the Logan gateway.
- **The play extent's bake** (2026-10-13). The play area is the four municipalities inside the extent box (D11), so blocks in Chelsea or Winthrop are left out, while streets are every drivable way that touches the box. G2 counts only streets whose middle lies inside the box the inputs were clipped to: the clip keeps whole ways, and their far ends are stranded by design. Gateways wait for visitors.
- **Bus access follows OSM's hierarchy** (2026-10-13). `hgv=no` restricts trucks, not buses, so it no longer closes a street. The parkways it was meant to close are DCR's River Roads, which `adjust.json` closes by name. G2 measures connectivity off motorways, because clipping and the River Roads' closure strand motorway pieces that no bus could use (DECISIONS, Measured).
- **Gravity inside the box.** On the fixture, gravity runs only between cells inside the box, so jobs inside it are over-weighted. That is accepted: `tripScale` is re-measured on `city-boston-r1` in week 5.
- **Errors stay outside the sim.** The sim returns reason codes. V3's error bus (it calls `Date.now()`) lives in the worker host or the UI, with an injected clock.
- **The bench.** It is committed against the fixture plus a synthetic 800-cell grid in week 3, and re-run on Boston when the bake lands.
