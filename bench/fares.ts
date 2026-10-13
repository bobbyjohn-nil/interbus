// The fare band (the M3 spec, item 4) on Inner Boston's ten corridor lines (bench/inner.ts), Sparrows
// every 10 min at peak and 15 off-peak, ten buses each: each line's best fare and its band, and how
// long the band takes, since the worker works it out whenever a line's card is open. `npm run bench fares`.
import { fareBand } from '../src/sim/economy/fareBand';
import { recompute } from '../src/sim/world';
import { innerBoston } from './inner';

const inner = innerBoston();
if (inner) {
  const { world, names } = inner;
  recompute(world);
  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;
  console.log('line, km, best fare, band (within 5% of the best net), net at $2.25 and at the best, ms for the band');
  const ms: number[] = [];
  fareBand(world, world.state.lines[0]!.id); // warm the JIT
  world.state.lines.forEach((line, k) => {
    const t0 = performance.now();
    const band = fareBand(world, line.id)!;
    ms.push(performance.now() - t0);
    const km = world.services.get(line.id)!.costs.routeM / 1000;
    const at225 = band.netCents[5]!;
    console.log(`  ${names[k]!.padEnd(22)} ${km.toFixed(1).padStart(5)}  ${dollars(band.bestCents)}  ${dollars(band.fromCents)}–${dollars(band.toCents)}  ${dollars(at225).padStart(10)} ${dollars(Math.max(...band.netCents)).padStart(10)}  ${ms.at(-1)!.toFixed(0).padStart(4)}`);
  });
  ms.sort((a, b) => a - b);
  console.log(`band time: median ${ms[Math.floor(ms.length / 2)]!.toFixed(0)} ms, slowest ${ms.at(-1)!.toFixed(0)} ms`);
}
