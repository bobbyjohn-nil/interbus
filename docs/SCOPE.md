# Scope

What interbus v1.0 is, on one page. [PLAN.md](../PLAN.md) explains why; [DECISIONS.md](DECISIONS.md)
records who decided what. If they disagree, DECISIONS and this page win over the plan.

## The game

A calm bus-company game on real Boston. The city starts with no buses, trains or ferries (D17). You
draw lines between where people live and work, set how often buses run and what each line charges,
and keep the company solvent while the city offers contracts and grades you every quarter.

## In v1.0

| Area | What ships |
|---|---|
| City | Inner Boston (D11): Boston, Cambridge, Somerville and Brookline core, about 800 demand cells at 350 m, from 2020 census blocks, LODES and one pinned OpenStreetMap extract (D1) |
| Map | Flat 2D that tilts into 3D on the same camera (D2); real buildings, streets, water, parks, land use and labels; light and dark (D13); Afacad Flux |
| Money | Fares and city subsidy per boarding; per-km, wage, upkeep and deadhead costs; a daily close where every figure is a ledger row; starting cash derived from what a starter line costs (D7) |
| Network | Lines on real streets; stops with tiers; depots on industrial land; peak, off-peak and overnight headways, overnight may be off (D7); transfers at shared stops; express lines only behind their test |
| Fleet | Three bus families: Sparrow, Metro 40, Goliath; the artist's models in 3D, icons rendered from them in 2D (D6) |
| Goals | Quarterly report card; HEADWAY and RIDERSHIP contracts; three event kinds; medals; a failure floor with "Restart this quarter" (D10) |
| Tools | Undo while paused; route remove, extend and insert; save slots, autosave and export; an onboarding checklist |
| Build | The web preview shows its commit SHA (D12); versions exist only when the owner types `/ship` |

## Out of v1.0 (D9)

Procedural cities and a second city · a public web release (Steam is the release, D4) · live data
fetches and third-party tiles · a second renderer · company type, lobbying, staff, fuel, schedule
assistant · per-bus wear, Mk tiers, undo across time · existing transit of any kind (D17) ·
pedestrians, dioramas, landmark models · Steamworks SDK, achievements, cloud saves (full release) ·
audio · phones.

## Milestones

| Date | What you can open on the preview |
|---|---|
| Sun Oct 18 | Boston's map, flat, with the build chip |
| Sun Nov 1 | The first fare dollar on a test line |
| Sun Nov 8 | Your first line: found, depot, draw, run, cash moves |
| Sun Nov 22 | The money loop: checklist, profitable day, contract, report card, failure and restart |
| Sun Dec 6 | No new game systems after this |
| Sun Dec 20 | Tagged `prototype` (not a version, D16) |
| Sun Feb 7 2027 | v1.0 complete on the preview (hard deadline Feb 28) |
| Jun 14–21 2027 | Free Steam demo at Next Fest (D18); full release proposed Tue Jul 27 |

## Never cut

Boston from real data · the detailed map, flat and tilted · no existing transit · the money loop,
contracts, failure floor and checklist · three headway periods · the calm screen · save integrity,
the build chip and the platform seams · the invariants and the economy sweep · your playtests.
