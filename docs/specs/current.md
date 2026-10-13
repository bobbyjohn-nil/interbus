# M4 · Goals

**Boston gives a company something to aim at beyond a profitable day: RIDERSHIP contracts beside HEADWAY ones, an event hatched a day ahead to plan around, medals for a good company, the Goliath behind silver, and a stop inserted into a running line with no bus jumping. By Sun Dec 6 2026, the system cutoff (PLAN §10, week 8).** It is money work (PLAN §0 call 1); its only drawing is what its exit check needs (an event's hatched marker, a contract ring, a medal chip).

One spec per milestone, ≤150 lines, with magnitudes and a cut line ([SC-06](../history/lessons-ledger.md), [SC-07](../history/lessons-ledger.md)). Written 2026-10-13 from PLAN §3, §4 and §10 (week 8), DECISIONS D7 and D10 and the contracts' measured entry, and a survey of V1, V2 and V3's contracts, events, unlocks, express and route editing (cited below; V2 at its archive branch). When this spec and those disagree, they win; fix this file in the same PR. M3's spec is archived in [m3-money-loop.md](m3-money-loop.md).

## Exit check (the owner, 10 minutes, on the deployed preview)

"A Longwood contract; roadworks a day ahead; insert a stop and no bus jumps" (PLAN §10 week 8). Concretely, on Inner Boston:
1. Take a RIDERSHIP contract ("400 boardings a day near Copley Square, 10 days") and meet it by adding a second line there; it pays as one ledger row.
2. A "Roadworks tomorrow" marker appears hatched on a street a line drives; the next day the line's card shows its slower round trip, and the marker clears when the works end.
3. Insert a stop between two of a running line's stops at speed: no bus on the map moves more than a few metres at the click, and one undo takes it back.
4. A quarter graded 55 or better gives the bronze medal; the silver chip names what is left to unlock the Goliath.

## Dates

| By | What |
|---|---|
| Sun Nov 22 | The owner answers the medal ladder (DECISIONS, Open); P1 notes in (the owner and the artist, PLAN §10 week 6) |
| Nov 30–Dec 6 | Week 8, 5 sessions: whatever of items 1–6 is not in yet. **System cutoff Sun Dec 6**: no new sim system after it ([SC-08](../history/lessons-ledger.md)) |

Work starts now, ahead of the calendar, money first; P1 may reorder it.

## Above the cut line

1. **RIDERSHIP contracts** (PLAN §3, GD-04; V2's rules, `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:4747-4862`, without its bugs):
   - Asks of 150, 400 or 800 boardings a day near a landmark, paying $60k, $150k or $240k: harder asks pay more (V2 first paid 150 the most, fixed in its `b9b8637`).
   - Counted as the day's paid boardings (a change onto a line boards free and is not counted, EC-04) at every stop within the 650 m reach, all lines together, from the modelled day (V2 read the same, `:3255-3269`); graded at the close like HEADWAY, 10 days met in a row within 20, paid once.
   - Dealt from one shuffled deck of the six asks, HEADWAY's three and RIDERSHIP's three, so every six offers hold each once and I11's bound holds across kinds (V2 drew kind and ask independently).
   - The card shows today's boardings against the ask; the map's contract ring names the kind.
   - An offer nobody takes for 10 days is withdrawn and its slot dealt again, so an ask a company cannot reach never holds a slot for good (added in building it; DECISIONS, Measured).
2. **Events, one at a time, hatched a day ahead** (PLAN §3; V2's rates, `…:Gaming/src/10-core.js:276-285`, `30-sim.js:4576-4709`; fuel shock is out with fuel):
   - Rolled at a day's start from their own saved RNG stream, never the contracts' (DECISIONS, Measured: the contracts' draws): a 0.18 chance a day, none while one is pending or running or for 2 days after, starting the next day.
   - **Roadworks** (3–6 days): one stretch of street a running line drives, up to 400 m of one named street, at 0.65 of its speed; every line over it takes the longer round trip in every period (rules/cycle.ts).
   - **Festival** (1–2 days): demand ×2.6 for trips starting or ending within 900 m of a stop, weighted to busier stops (V2 `30-sim.js:4617-4660`); it can carry a RIDERSHIP day, as V2 intended.
   - **Snow** (1–2 days): every drive at ÷0.72 on top of the hour's congestion (V2 `10-core.js:766-785`).
   - Shown as a hatched marker ("Roadworks tomorrow", "Snow tomorrow") while pending and solid while on, with a notice; a short line runs stretched headways rather than buying buses on its own.
3. **Medals** (PLAN §3: three for Boston, silver unlocks the Goliath; no earlier version had them, so the ladder is new and the owner's call, DECISIONS Open). Recommended:
   - **Bronze:** a quarter's report card at 55 or more (the grant's bar).
   - **Silver:** 25,000 trips carried since founding, counted as trips, not boardings (V3's fix, `Intralines_City@dc63602:studio/docs/design/fleet-and-staff.md:22-40`; V1 and V2's 25,000 boardings let a split line buy the Goliath at half the riders), and unlocks the Goliath.
   - **Gold:** a quarter graded 75 or more with no category under 60, carrying 5,000 trips a day.
   - Each is awarded once, at a day's close, as a chip and a notice, and kept in the save; Steam achievements later read them (PLAN §4).
4. **Route insert, and no bus jumps on any route edit** (PLAN §3; V2's design, `…:Gaming/docs/design/route-editing.md:1-92`):
   - Point at a leg of a line and click: one command places the stop (or joins one within reach) and inserts it there, one undo entry; a detour over 15% of the leg warns, never blocks (V2's `LINE_DETOUR_WARN_SHARE`).
   - **No bus jumps:** a trip under way when a line's route or round trip changes (insert, remove, extend, a model swap, an event starting) finishes on the route and times it began with; the next departures take the new ones. V2's epoch measured 4,165 m → 1.6 m on insert (`57dcdc0`) but kept two timelines in step and still jumped 3,117 m on a reorder (K32, RN-11); here the day plan keeps the old plan's trips until they end, one timeline.
5. **The full sweep** (PLAN §10 week 8; I3): every allowed fare, headway, model and stop tier on the debug line and two Inner Boston corridors, with events off and on; nightly if it passes the 8-minute PR budget.

## Below the cut line (cut in this order if Dec 6 is at risk)

1. **Express behind I3** (PLAN cut 2; X-20): a line earns express from its streets (≥5 km, average spacing ≥1,200 m on the routed path, V1's `Intralines@7af45b1:src/game/constants.ts:390-431`), riders weigh its ride ×0.85 and its fare ×0.5, and it ships only if I3 holds: its best fare under $5 (V2 peaked at $5.00 before the subsidy taper and $2.75 after, EC-05) and the starter recipe not express (K16: a 5.3 km starter earned +$3,167 a day).
2. Festival and snow (PLAN cut 4: events down to roadworks).
3. Route insert (PLAN cut 6); no bus jumps on remove, extend and model swaps stays.
4. Gold (PLAN cut 7); the Goliath stays behind silver.

**Never cut from M4:** RIDERSHIP contracts; roadworks a day ahead; bronze and silver with the Goliath behind it; no bus jumps; the full sweep.

## Magnitudes (expected before measuring, [TS-12](../history/lessons-ledger.md); out of range means find out why before tuning)

| Quantity | Expected | Source |
|---|---|---|
| Copley's boardings a day with the debug line alone | about 195 (the fixture's first stop): meets RIDERSHIP 150, not 400 | Item 1 |
| A 3-bus company winning RIDERSHIP | some of 400 at a hub with a second line; 800 needs an interchange (V2: 0 of 15 at 3 buses) | Item 1, V2 `contracts.md:54-74` |
| Contract income over 100 seeds, both kinds | within ±30% of the median, as I11 | Item 1 |
| Events a quarter | about one (0.18 a day, the gaps and durations) | Item 2 |
| Roadworks on the debug line | +30 to +60 s a round trip; still 2 buses at 20 min | Item 2 |
| Snow on the debug line | peak round trip 1,641 s → about 2,060 s: 2 buses at 20 min, a fourth needed at 10 min | Item 2 |
| Festival at Copley | the day's boardings near it up 1.5–2.5× | Item 2 |
| Bronze, silver, gold | about the first or second quarter; 40 days with one line or about 12 with three; within PLAN's 2–4 hours to the top medal (speed 1: 2.4 min a day) | Item 3 |
| A bus's move at an edit's instant | ≤5 m (V2's epoch: 1.6 m) | Item 4 |
| Recompute with events on | ≤150 ms p95 on GitHub's runner | I14 |

## Tests that must be green (each shown failing with the old bug restored, [TS-04](../history/lessons-ledger.md))

- **I11** over both kinds: contract income over 100 seeds within ±30% of the median; no RIDERSHIP day met by changes counted twice.
- **I8** with events: the same seed and commands give the same events and fingerprint; adding the event stream leaves the contract deck as it was.
- **I6** across route edits mid-run: no bus moves more than 5 m at an edit's instant, and buses out never exceed buses owned.
- **I3** in the full sweep (and with express, if it ships): interior optima, starving ≤60%, best fare under $5.
- **I7** for the save format with events, medals and the new contract kind, and the r1→r2 save test.
- **e2e (I15)**: the exit check, items 1–4, on the fixture.

## Out of M4 by plan

- Tuning k, Boston's bands and pacing (week 9); Home and the save list (week 9).
- The dark theme (week 13); the artist's models in 3D (week 13, cut 3); help, settings and the credits screen (week 14).
- "Bronze unlocks the next city" (a second city, after v1.0).
