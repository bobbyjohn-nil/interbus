// The report card's bars from a measured spread (the M3 spec, item 9): ten opening companies on the
// fixture, each with the founding cash, a depot on its depot land and one line of four stops a seeded
// RNG lays out (each stop 600–1,300 m from the last, on a street node), at the founding headways,
// run untouched for a quarter and graded at day 10's close. Prints each card, the spread of the
// overall (min, median and max), and the checklist's debug line for reference. `npm run bench report`.
import { SECONDS_PER_DAY } from '../src/sim/config/time';
import { createLine } from '../src/sim/commands/createLine';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { createRng } from '../src/sim/core/rng';
import { distXY, toLngLat, type XY } from '../src/sim/core/geo';
import { advance } from '../src/sim/step';
import { gameWithDepot } from '../src/sim/testing';

const rows: { seed: number; overall: number; line: string }[] = [];
for (let seed = 1; seed <= 10; seed++) {
  const rng = createRng(seed * 7_919);
  const world = gameWithDepot(seed);
  const { graph, frame } = world.city;
  const node = (): XY => {
    const n = rng.int(0, graph.nodeCount - 1);
    return [graph.x[n]!, graph.y[n]!];
  };
  let made = false;
  for (let attempt = 0; attempt < 200 && !made; attempt++) {
    const stops: XY[] = [node()];
    for (let tries = 0; stops.length < 4 && tries < 400; tries++) {
      const next = node();
      const d = distXY(stops.at(-1)!, next);
      if (d >= 600 && d <= 1_300 && stops.every((s) => distXY(s, next) >= 500)) stops.push(next);
    }
    if (stops.length < 4) continue;
    made = createLine(world, stops.map((p) => toLngLat(frame, p))).ok;
  }
  if (!made) throw new Error(`seed ${seed}: no line`);
  const events = advance(world, 10 * SECONDS_PER_DAY);
  const card = events.find((e) => e.card)?.card;
  if (!card) throw new Error(`seed ${seed}: no card on day 10`);
  const riders = [...world.assignment.lines.values()][0]!.perDay;
  const f = (v: number) => v.toFixed(1).padStart(5);
  const line = `seed ${String(seed).padStart(2)}: ${riders.toFixed(0).padStart(4)} riders a day; coverage ${f(card.coverage)}, reliability ${f(card.reliability)}, comfort ${f(card.comfort)}, money ${f(card.money)}; overall ${f(card.overall)}, payout $${(card.payoutCents / 100).toFixed(0)}`;
  rows.push({ seed, overall: card.overall, line });
  console.log(line);
}
const sorted = rows.map((r) => r.overall).sort((a, b) => a - b);
// For reference, the checklist's own line: the debug line, Copley to Longwood.
{
  const world = gameWithDepot(1);
  addDebugLine(world);
  const card = advance(world, 10 * SECONDS_PER_DAY).find((e) => e.card)!.card!;
  const f = (v: number) => v.toFixed(1).padStart(5);
  const running = world.state.ledger.rows.filter((r) => !['founding', 'purchase', 'refund', 'sale', 'card'].includes(r.kind)).reduce((sum, r) => sum + r.amountCents, 0);
  console.log(
    `the debug line: coverage ${f(card.coverage)}, reliability ${f(card.reliability)}, comfort ${f(card.comfort)}, money ${f(card.money)}; overall ${f(card.overall)}, payout $${(card.payoutCents / 100).toFixed(0)} against a quarter's running net of $${(running / 100).toFixed(0)}`,
  );
}
console.log(`overall over 10 opening companies: min ${sorted[0]!.toFixed(1)}, median ${((sorted[4]! + sorted[5]!) / 2).toFixed(1)}, max ${sorted[9]!.toFixed(1)}`);
