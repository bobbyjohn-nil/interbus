// How much of an assignment one line's change touches (DECISIONS, Open: I14 on a hub of lines; the systems audit's fifteenth
// round), on the pacing run's card-building companies at the bus ceiling (bench/fixtures, as bench/recompute.ts times them).
// For each line, the cell pairs with riders that a route of theirs rides it on, from home on it or changing onto it, and the
// routes those pairs hold of all the pairs' routes: the work an assignment that kept the other pairs from the last one would
// still do were that line changed. The routes are those the assignment visits (assign.ts): not a change nobody in the home cell
// would make, nor one to a work cell where it reaches nothing the first line does not (counted, they took the shares a line's
// change touches from 4–51% of the routes to 11–62%: the review of the fifteenth round's fixes). `npm run bench touched`, with Inner Boston baked or fetched (bench/inner.ts); not part of
// any check.
import { readFileSync } from 'node:fs';
import { catchments, transfersOf } from '../src/sim/demand/assign';
import { fromSaveData } from '../src/sim/save/save';
import type { SaveData } from '../src/sim/save/schema';
import { createWorld, recompute, runningPlans } from '../src/sim/world';
import { innerBostonCity } from './inner';

const city = innerBostonCity();
if (!city) throw new Error('touched: no Inner Boston; bake it with node tools/bake/sim.mjs boston inner-boston, or npm run cities');
for (const seed of [1, 2]) {
  const kept = JSON.parse(readFileSync(`bench/fixtures/lategame-card-s${seed}.json`, 'utf8')) as { readonly company: SaveData };
  const world = createWorld(city, fromSaveData(kept.company));
  recompute(world);
  const plans = runningPlans(world);
  const { homeLines, workAccess, workReach } = catchments(city, plans);
  const transfers = transfersOf(plans);
  const n = homeLines.length;
  const reach = plans.map((_, line) => workAccess[line]!.map((w) => w.cell));
  // Each pair's lines, as a bitmask of line places, and its routes.
  const pairLines = new Map<number, number>();
  const pairRoutes = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    // The home cell's sub-points that reach each line, as a bitmask, as the assignment's homeReach.
    const homeReach = new Int32Array(plans.length);
    for (const { line, groups } of homeLines[i]!) for (const g of groups) homeReach[line]! |= g.mask;
    for (const { line } of homeLines[i]!) {
      for (let x = -1; x < transfers[line]!.length; x++) {
        const second = x < 0 ? line : transfers[line]![x]!.line;
        if (x >= 0 && (homeReach[line]! & ~homeReach[second]!) === 0) continue;
        for (const j of reach[second]!) {
          if (x >= 0 && (workReach[second]![j]! & ~workReach[line]![j]!) === 0) continue;
          if (world.commuters.flow[i * n + j]! <= 0) continue;
          const key = i * n + j;
          pairLines.set(key, (pairLines.get(key) ?? 0) | (1 << line) | (1 << second));
          pairRoutes.set(key, (pairRoutes.get(key) ?? 0) + 1);
        }
      }
    }
  }
  const routes = [...pairRoutes.values()].reduce((s, r) => s + r, 0);
  const shares = plans.map((plan, line) => {
    let pairs = 0;
    let held = 0;
    for (const [key, lines] of pairLines) {
      if ((lines & (1 << line)) === 0) continue;
      pairs++;
      held += pairRoutes.get(key)!;
    }
    return `Line ${plan.id} ${Math.round((100 * pairs) / pairLines.size)}% of pairs, ${Math.round((100 * held) / routes)}% of routes`;
  });
  console.log(`touched: seed ${seed}, ${plans.length} lines, ${pairLines.size} cell pairs with riders and ${routes} routes; one line's change touches ${shares.join('; ')}`);
}
