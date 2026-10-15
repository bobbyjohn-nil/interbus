// How far buses jump on the map at the instant a line changes (the M4 spec, item 4; I6): the
// fixture's debug line every 10 minutes, paused at 08:00 on day 2, each edit sent to the same host
// the game runs, and every bus placed by the same fleet the vehicle layer draws, just before the edit
// and just after, at the same second. Buses are paired in stint order. Also roadworks starting at a
// midnight with buses still out. Then Inner Boston's recompute with every line settling, and the
// commands of a line drawn there and changed every 20 minutes through the day it was drawn, which keeps
// every version since the draw until that day's close (I14). `npm run bench jumps`.
import { bakeSim } from '../tools/bake/sim.mjs';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import type { FromWorker, LineView, Snapshot, ToWorker } from '../src/sim/types';
import { Fleet } from '../src/render/map/fleet';
import { createHost } from '../src/worker/host';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { createRng } from '../src/sim/core/rng';
import { pickRoadworks } from '../src/sim/events/roll';
import { gameWithDepot } from '../src/sim/testing';
import { recompute, recomputeInService } from '../src/sim/world';
import { CORRIDORS, innerBoston, innerBostonText } from './inner';

const baked = bakeSim('boston', 'mini-boston');
const CITY = { id: 'boston', revision: 'mini-boston', hash: baked.sha256 };
const BUILD = { sha: '0'.repeat(40), version: '0.0.0' };

function started() {
  const out: FromWorker[] = [];
  const host = createHost((m) => out.push(m));
  host.handle({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
  host.handle({ type: 'save-text', text: null });
  const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }>;
  const now = (): Snapshot => {
    host.handle({ type: 'speed', speed: 0 });
    return last('snapshot').snapshot;
  };
  return { host, last, now };
}

/** A founded game with the debug line every 10 minutes and cash to spare, as a save at `elapsed`, with `edit` applied. */
function baseSave(elapsed: number, edit: (d: Record<string, unknown>) => void = () => undefined): string {
  const { host, last } = started();
  host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
  const land = last('ready').depotLand;
  const ring = [...land].sort((a, b) => b.length - a.length)[0]!;
  const mid = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  host.handle({ type: 'place-depot', at: [(ring[0]![0] + mid[0]!) / 2, (ring[0]![1] + mid[1]!) / 2] });
  host.handle({ type: 'create-line', clicks: DEBUG_STOPS.map((s) => [...s.at] as [number, number]), headways: { peak: 600, offpeak: 600, overnight: null } });
  host.handle({ type: 'export' });
  const save = JSON.parse(last('export').text) as { data: Record<string, unknown> & { clock: { elapsed: number }; ledger: unknown[] } };
  save.data.ledger.push({ day: 1, kind: 'contract', amountCents: 500_000_000, lineId: null });
  save.data.clock.elapsed = elapsed;
  edit(save.data);
  return JSON.stringify(save);
}

const fleetOf = (lines: readonly LineView[]) => {
  const fleet = new Fleet();
  fleet.setLines(lines);
  return fleet;
};

/** Each bus out at `second` under `before` and `after`, paired in order: the largest move in metres, and the counts. */
function jump(before: Fleet, after: Fleet, second: number, day: number): { maxM: number; over5: number; before: number; after: number } {
  const place = (f: Fleet) => {
    f.setClock(second, 0, 0, day);
    const { count, data } = f.frame(0);
    return Array.from({ length: count }, (_, i) => [data[8 * i]!, data[8 * i + 1]!] as const);
  };
  const a = place(before);
  const b = place(after);
  const metres = (p: readonly [number, number], q: readonly [number, number]) => Math.hypot((p[0] - q[0]) * 111_320 * Math.cos((p[1] * Math.PI) / 180), (p[1] - q[1]) * 111_320);
  const moves = a.slice(0, Math.min(a.length, b.length)).map((p, i) => metres(p, b[i]!));
  return { maxM: Math.max(0, ...moves), over5: moves.filter((m) => m > 5).length, before: a.length, after: b.length };
}

const report = (name: string, r: ReturnType<typeof jump>) =>
  console.log(`${name}: largest move ${r.maxM.toFixed(1)} m; ${r.over5} of ${Math.min(r.before, r.after)} buses moved over 5 m (${r.before} out before, ${r.after} after)`);

const EIGHT = 86_400 + 3 * 3_600; // 08:00 on day 2
const EDITS: [string, ToWorker][] = [
  ['remove Symphony', { type: 'remove-stop', lineId: 1, stopId: 2 }],
  ['extend beyond Longwood', { type: 'extend-line', lineId: 1, end: 'end', clicks: [[-71.1085, 42.3395]] }],
  ['swap to Metro 40s', { type: 'set-model', lineId: 1, model: 'metro40' }],
  ['every 15 minutes', { type: 'set-headways', lineId: 1, headways: { peak: 900, offpeak: 900, overnight: null } }],
  ['every 5 minutes', { type: 'set-headways', lineId: 1, headways: { peak: 300, offpeak: 300, overnight: null } }],
];
for (const [name, edit] of EDITS) {
  const { host, now } = started();
  host.handle({ type: 'import', text: baseSave(EIGHT) });
  const before = now();
  host.handle(edit);
  const after = now();
  report(name, jump(fleetOf(before.lines), fleetOf(after.lines), before.secondOfDay, before.day));
}

// Roadworks starting at day 3's midnight on a stretch the line drives, as the roll would pick it, with the last trips still out.
{
  const world = gameWithDepot();
  addDebugLine(world);
  const stretch = pickRoadworks(world, createRng(1))!;
  const { host, now } = started();
  host.handle({ type: 'import', text: baseSave(2 * 86_400 + 18 * 3_600 + 50 * 60, (d) => void (d.event = { kind: 'roadworks', startDay: 4, endDay: 6, ...stretch, at: null })) });
  const before = now();
  host.advanceTo(2 * 86_400 + 19 * 3_600); // day 3's close
  const after = now();
  report(`roadworks start on ${stretch.street}`, jump(fleetOf(before.lines), fleetOf(after.lines), after.secondOfDay, after.day));
}

// The recompute with every line settling: Inner Boston's ten corridors, each line's headways changed
// at 08:00 with its buses out, so every service builds its merged plan (I14).
{
  const inner = innerBoston();
  if (inner) {
    const world = inner.world;
    world.state.elapsed = 3 * 3_600;
    recompute(world);
    const time = () => {
      for (let k = 0; k < 3; k++) recompute(world);
      const ms: number[] = [];
      for (let k = 0; k < 20; k++) {
        const t0 = performance.now();
        recompute(world);
        ms.push(performance.now() - t0);
      }
      ms.sort((a, b) => a - b);
      return `p50 ${ms[10]!.toFixed(1)} ms, p95 ${ms[18]!.toFixed(1)} ms`;
    };
    const settled = time();
    for (const line of world.state.lines) line.headways = { ...line.headways, peak: 900 };
    recomputeInService(world);
    const settling = world.state.lines.filter((l) => (l.earlier ?? []).length > 0).length;
    console.log(`Inner Boston's recompute, ten corridors: ${settled} settled; ${time()} with ${settling} lines settling`);
  }
}

// A line drawn on Inner Boston, then changed every 20 minutes through its day: it keeps every version
// since the draw until that day's close (world.ts recomputeInService), so each change merges and the
// worker draws one more version than the last for the vehicle layer. Each command's whole handling is
// timed (the merge, the costs, the assignment and the line views), its headways changed back and forth
// (every version on the same streets) or a stop added beyond its end and taken off again (each added
// stop a new street, so the worker's routed streets must carry over from one refresh to the next);
// I14 holds the 95th percentile to 150 ms. `change` offers places in order, and a place the rules refuse
// (no street near) is passed over untimed; a change with none taken, or versions not kept, fails the run.
function drawDay(text: string, what: string, change: (k: number, line: LineView) => readonly ToWorker[]): void {
  const out: FromWorker[] = [];
  const host = createHost((m) => out.push(m));
  const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }>;
  host.handle({ type: 'init', simText: text, city: { id: 'boston', revision: 'inner-boston', hash: '-' }, seed: 1, build: BUILD });
  host.handle({ type: 'save-text', text: null });
  host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
  const [, from, to, count] = CORRIDORS[0]!;
  const clicks = Array.from({ length: count }, (_, k): [number, number] => [from[0] + ((to[0] - from[0]) * k) / (count - 1), from[1] + ((to[1] - from[1]) * k) / (count - 1)]);
  // The depot land nearest the corridor's middle, and cash to spare, so every change goes through.
  const mid = clicks[Math.floor(count / 2)]!;
  const centre = (ring: readonly (readonly [number, number])[]) => ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  const near = [...last('ready').depotLand].map(centre).sort((a, b) => Math.hypot(a[0]! - mid[0], a[1]! - mid[1]) - Math.hypot(b[0]! - mid[0], b[1]! - mid[1]))[0]!;
  host.handle({ type: 'place-depot', at: [near[0]!, near[1]!] });
  host.handle({ type: 'export' });
  const save = JSON.parse(last('export').text) as { data: { ledger: unknown[] } };
  save.data.ledger.push({ day: 1, kind: 'contract', amountCents: 500_000_000, lineId: null });
  host.handle({ type: 'import', text: JSON.stringify(save) });
  host.handle({ type: 'speed', speed: 0 });
  const start = last('snapshot').snapshot.elapsed;
  const refusals = () => out.filter((m) => m.type === 'refused');
  host.handle({ type: 'create-line', clicks, headways: { peak: 1_200, offpeak: 1_200, overnight: null } });
  const refused = [...refusals()];
  const ms: number[] = [];
  for (let k = 0; k < 48; k++) {
    host.handle({ type: 'speed', speed: 1 });
    host.advanceTo(start + (k + 1) * 20 * 60);
    host.handle({ type: 'speed', speed: 0 });
    let taken = false;
    for (const command of change(k, last('snapshot').snapshot.lines[0]!)) {
      const before = refusals().length;
      const t0 = performance.now();
      host.handle(command);
      const took = performance.now() - t0;
      if (refusals().length === before) {
        ms.push(took);
        taken = true;
        break;
      }
    }
    if (!taken) refused.push(refusals().at(-1)!);
  }
  const kept = last('snapshot').snapshot.lines[0]?.settling?.earlier.length ?? 0;
  if (refused.length > 0 || kept !== 49) {
    console.error(`bench: the draw-day run, ${what}, measured nothing: ${refused.length} changes refused (${JSON.stringify(refused.map((r) => r.type === 'refused' && r.reason))}), ${kept} versions kept of 49`);
    process.exitCode = 1;
    return;
  }
  const at = (k: number) => ms[k]!.toFixed(1);
  const sorted = [...ms].sort((a, b) => a - b);
  console.log(`Inner Boston, Massachusetts Avenue drawn, then ${what} 48 times in its day: ${kept} versions kept at the last; the 1st change ${at(0)} ms, the 12th ${at(11)} ms, the 24th ${at(23)} ms, the 48th ${at(47)} ms, the slowest ${sorted[47]!.toFixed(1)} ms; p95 ${sorted[45]!.toFixed(1)} ms`);
  if (sorted[45]! > 150) {
    console.error(`bench: a line changed through its draw day is over I14's 150 ms at the 95th percentile`);
    process.exitCode = 1;
  }
}
{
  const text = innerBostonText();
  if (text) {
    drawDay(text, 'its headways changed', (k) => [{ type: 'set-headways', lineId: 1, headways: { peak: k % 2 ? 1_200 : 1_500, offpeak: 1_200, overnight: null } }]);
    // Before its first stop, about 280 m on along the corridor towards Porter Square, a new place each
    // time: 25 m further to one side or the other at each place offered, so no two stops added stand in
    // one place and every one stays in the city.
    const [, from, to] = CORRIDORS[0]!;
    const [dx, dy] = [from[0] - to[0], from[1] - to[1]];
    const step = 25 / 111_320 / Math.hypot(dx, dy);
    const beyond = (j: number): [number, number] => {
      const side = (j % 2 ? 1 : -1) * Math.ceil(j / 2) * step;
      return [from[0] + dx * 0.05 + dy * side, from[1] + dy * 0.05 - dx * side];
    };
    let next = 0;
    drawDay(text, 'a stop added before its first or taken off', (k, line) => {
      if (k % 2 === 1) return [{ type: 'remove-stop', lineId: 1, stopId: line.stopIds[0]! }];
      return Array.from({ length: 12 }, () => ({ type: 'extend-line', lineId: 1, end: 'start', clicks: [beyond(next++)] }) as const);
    });
  } else {
    console.log(`bench: the draw-day runs skipped; Inner Boston is not baked or fetched`);
  }
}
