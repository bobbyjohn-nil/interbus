// What a line's headways cost the whole recompute when a save forces them under the line card's 5 minutes
// (`npm run bench headways`; the systems audit's seventh round). The debug line on mini-Boston has its headways and buses set in
// the state directly, past the headway rule, as a hostile file would; each case reports its first and second recompute. Every
// second with 2,000 buses took 3.3–3.8 s a recompute; every minute, the rule's floor since (MIN_HEADWAY_SECONDS), took 5–34 ms
// even with 86,400 buses, the most a save's line may own.
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity } from '../src/sim/city/simfile';
import { newGame } from '../src/sim/state';
import { createWorld, recompute } from '../src/sim/world';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const cases: readonly (readonly [headwaySeconds: number, buses: number])[] = [
  [1_200, 2],
  [300, 6],
  [60, 2_000],
  [60, 86_400],
  [1, 26],
  [1, 2_000],
];
for (const [h, buses] of cases) {
  const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  addDebugLine(world);
  Object.assign(world.state.lines[0]!, { headways: { peak: h, offpeak: h, overnight: null }, buses });
  const t0 = performance.now();
  recompute(world);
  const t1 = performance.now();
  recompute(world);
  console.log(`bench: every ${h} s with ${buses} buses: recompute ${(t1 - t0).toFixed(0)} ms, then ${(performance.now() - t1).toFixed(0)} ms`);
}
