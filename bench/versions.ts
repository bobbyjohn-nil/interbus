// A line changed through a whole day keeps every version it ran until the close (world.ts
// recomputeInService; the systems audit's fourth round), and every recompute in service builds its
// plan in effect from them (rules/transition.ts planInEffect), as the map's Fleet does again on the
// page's main thread whenever the lines change (render/map/fleet.ts). Inner Boston's longest corridor,
// Massachusetts Avenue, drawn at 05:00 on the first day every 5 minutes and every 20 overnight, then
// changed every 10 minutes until the close and on into the next night, through the host the game
// runs: its headways changed back and forth, or by turns its headways, a stop taken off, the stop put
// back where it stood and its model swapped. At each change, the command's whole handling (the
// recompute in service, the assignment and the line views), and on the line views the worker posts,
// as the page receives them: planInEffect for the line alone, and the Fleet's setLines, each in a
// thread of its own that has seen every change before it, as the page's main thread has. Then the
// close, and the next night's changes in the next day's frame. I14 holds a recompute in service to
// 150 ms at the 95th percentile. `npm run bench versions`.
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { Fleet } from '../src/render/map/fleet';
import { planInEffect } from '../src/sim/rules/transition';
import type { FromWorker, LineView, ToWorker } from '../src/sim/types';
import { createHost } from '../src/worker/host';
import { CORRIDORS, innerBostonText } from './inner';

const BUDGET_MS = 150;
const BUILD = { sha: '0'.repeat(40), version: '0.0.0' };
const MINUTE = 60;
const HOUR = 3_600;

type Role = 'effect' | 'fleet';

/** A page thread: times planInEffect for the first line alone, or the Fleet's setLines, on each set of line views it is sent. */
function serve(role: Role): void {
  const fleet = new Fleet();
  parentPort!.on('message', (lines: LineView[]) => {
    const t0 = performance.now();
    if (role === 'fleet') fleet.setLines(lines);
    else {
      const l = lines[0]!;
      planInEffect(l.plan, (l.settling?.earlier ?? []).map((e) => ({ inputs: e.plan, until: e.until, sameModel: e.sameModel, sameStart: e.sameStart })));
    }
    parentPort!.postMessage(performance.now() - t0);
  });
}

/** A thread of the page's, and how to time it on a set of line views. */
function page(role: Role): { time: (lines: readonly LineView[]) => Promise<number>; stop: () => Promise<number> } {
  const worker = new Worker(new URL(import.meta.url), { workerData: { role } });
  return {
    time: (lines) =>
      new Promise((resolve) => {
        worker.once('message', resolve);
        worker.postMessage(lines);
      }),
    stop: () => worker.terminate(),
  };
}

interface Row {
  readonly versions: number;
  readonly commandMs: number;
  readonly effectMs: number;
  readonly fleetMs: number;
}

const stats = (ms: readonly number[]) => {
  const s = [...ms].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]!;
  return `p50 ${at(0.5).toFixed(1)}, p95 ${at(0.95).toFixed(1)}, max ${s[s.length - 1]!.toFixed(1)} ms`;
};

/** The line drawn, then changed every 10 minutes from 05:10 on its first day to 01:00 on the next, `change` saying how, and each change timed. */
async function day(text: string, what: string, change: (k: number, line: LineView) => ToWorker): Promise<void> {
  const out: FromWorker[] = [];
  const host = createHost((m) => out.push(m));
  const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }>;
  host.handle({ type: 'init', simText: text, city: { id: 'boston', revision: 'inner-boston', hash: '-' }, seed: 1, build: BUILD });
  host.handle({ type: 'save-text', text: null });
  host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
  const [, from, to, count] = CORRIDORS[0]!;
  const clicks = Array.from({ length: count }, (_, k): [number, number] => [from[0] + ((to[0] - from[0]) * k) / (count - 1), from[1] + ((to[1] - from[1]) * k) / (count - 1)]);
  // Cash to spare, so every change goes through, and depots on the three pieces of depot land nearest the corridor's middle, room for 18 buses.
  host.handle({ type: 'export' });
  const save = JSON.parse(last('export').text) as { data: { ledger: unknown[] } };
  save.data.ledger.push({ day: 1, kind: 'contract', amountCents: 5_000_000_000, lineId: null });
  host.handle({ type: 'import', text: JSON.stringify(save) });
  const mid = clicks[Math.floor(count / 2)]!;
  const centre = (ring: readonly (readonly [number, number])[]) => ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  const near = [...last('ready').depotLand].map(centre).sort((a, b) => Math.hypot(a[0]! - mid[0], a[1]! - mid[1]) - Math.hypot(b[0]! - mid[0], b[1]! - mid[1]));
  for (const at of near.slice(0, 3)) host.handle({ type: 'place-depot', at: [at[0]!, at[1]!] });
  host.handle({ type: 'speed', speed: 0 });
  const start = last('snapshot').snapshot.elapsed;
  const refusals = () => out.filter((m) => m.type === 'refused').length;
  host.handle({ type: 'create-line', clicks, headways: { peak: 5 * MINUTE, offpeak: 5 * MINUTE, overnight: 20 * MINUTE } });
  if (refusals() > 0) throw new Error(`bench: ${what}: the line was refused: ${JSON.stringify(last('refused'))}`);
  const [effect, fleet] = [page('effect'), page('fleet')];
  const views = () => last('snapshot').snapshot.lines;
  await effect.time(views());
  await fleet.time(views());
  const rows: Row[] = [];
  let close = { ms: 0, kept: 0, before: 0 };
  // 05:10 to 23:50 on the first day, every 10 minutes (113 changes), then the close at midnight, then 00:10 to 01:00 on the next (6 more).
  const midnight = start + 19 * HOUR;
  for (let k = 0; k < 119; k++) {
    const at = start + (k + 1 + Number(k >= 113)) * 10 * MINUTE;
    host.handle({ type: 'speed', speed: 1 });
    if (k === 113) {
      host.advanceTo(midnight - 1);
      host.handle({ type: 'speed', speed: 0 });
      const before = views()[0]!.settling?.earlier.length ?? 0;
      host.handle({ type: 'speed', speed: 1 });
      const t0 = performance.now();
      host.advanceTo(midnight + 1);
      const ms = performance.now() - t0;
      host.handle({ type: 'speed', speed: 0 });
      close = { ms, kept: views()[0]!.settling?.earlier.length ?? 0, before };
      host.handle({ type: 'speed', speed: 1 });
    }
    host.advanceTo(at);
    host.handle({ type: 'speed', speed: 0 });
    const command = change(k, views()[0]!);
    const before = refusals();
    const t0 = performance.now();
    host.handle(command);
    const commandMs = performance.now() - t0;
    if (refusals() !== before) {
      console.error(`bench: ${what}: change ${k + 1} (${command.type}) refused: ${JSON.stringify(last('refused'))}`);
      process.exitCode = 1;
      break;
    }
    const lines = views();
    rows.push({ versions: lines[0]!.settling?.earlier.length ?? 0, commandMs, effectMs: await effect.time(lines), fleetMs: await fleet.time(lines) });
  }
  await effect.stop();
  await fleet.stop();
  const firstDay = rows.slice(0, 113);
  console.log(`Massachusetts Avenue, ${what} every 10 minutes from 05:10 (I14 ${BUDGET_MS} ms at the 95th percentile):`);
  for (const [lo, hi] of [[1, 25], [26, 50], [51, 75], [76, 100], [101, Infinity]] as const) {
    const part = firstDay.filter((r) => r.versions >= lo && r.versions <= hi);
    if (part.length === 0) continue;
    console.log(
      `  ${lo}–${hi === Infinity ? part[part.length - 1]!.versions : hi} versions kept (${part.length} changes): command ${stats(part.map((r) => r.commandMs))}; planInEffect alone ${stats(part.map((r) => r.effectMs))}; Fleet.setLines ${stats(part.map((r) => r.fleetMs))}`,
    );
  }
  console.log(`  the whole first day (${firstDay.length} changes): command ${stats(firstDay.map((r) => r.commandMs))}; planInEffect alone ${stats(firstDay.map((r) => r.effectMs))}; Fleet.setLines ${stats(firstDay.map((r) => r.fleetMs))}`);
  console.log(`  the close: ${close.ms.toFixed(1)} ms, ${close.before} versions kept before it and ${close.kept} after`);
  const night = rows.slice(113);
  if (night.length > 0) {
    const first = night[0]!;
    console.log(
      `  the next night's first change, ${first.versions} versions kept: command ${first.commandMs.toFixed(1)} ms, planInEffect alone ${first.effectMs.toFixed(1)} ms, Fleet.setLines ${first.fleetMs.toFixed(1)} ms; its ${night.length - 1} more: command ${stats(night.slice(1).map((r) => r.commandMs))}`,
    );
  }
  const all = rows.map((r) => r.commandMs).sort((a, b) => a - b);
  if (all[Math.ceil(0.95 * all.length) - 1]! > BUDGET_MS) {
    console.error(`bench: ${what}: a recompute in service is over I14's ${BUDGET_MS} ms at the 95th percentile`);
    process.exitCode = 1;
  }
}

if (!isMainThread) serve((workerData as { role: Role }).role);
else {
  const text = innerBostonText();
  if (!text) console.log(`bench: versions skipped; Inner Boston is not baked or fetched`);
  else {
    await day(text, 'its headways changed', (k) => ({ type: 'set-headways', lineId: 1, headways: { peak: k % 2 ? 5 * MINUTE : 6 * MINUTE, offpeak: 5 * MINUTE, overnight: 20 * MINUTE } }));
    // By turns: its headways, its last stop taken off, put back where it stood, and its model swapped.
    let taken: [number, number] | null = null;
    let swapped = false;
    await day(text, 'its headways, its last stop off and back, and its model changed by turns', (k, line) => {
      if (k % 4 === 1) {
        taken = line.stops[line.stops.length - 1]!;
        return { type: 'remove-stop', lineId: 1, stopId: line.stopIds[line.stopIds.length - 1]! };
      }
      if (k % 4 === 2) return { type: 'extend-line', lineId: 1, end: 'end', clicks: [taken!] };
      if (k % 4 === 3) return { type: 'set-model', lineId: 1, model: (swapped = !swapped) ? 'metro40' : 'sparrow' };
      return { type: 'set-headways', lineId: 1, headways: { peak: k % 8 ? 5 * MINUTE : 6 * MINUTE, offpeak: 5 * MINUTE, overnight: 20 * MINUTE } };
    });
  }
}
