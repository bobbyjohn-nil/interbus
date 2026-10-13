// I6 across route edits mid-run (the M4 spec, item 4): the debug line every 10 minutes, paused at
// 08:00 on day 2 with its buses out, then changed by each command the line card and the line tool
// send, and roadworks starting at a midnight with the last trips still out. Every bus is drawn by the
// fleet the vehicle layer draws, from the host's own snapshots: none moves more than 5 m at the
// change; for three game hours after, second by second, every bus is within a step of where one was
// a second before, unless it is leaving or reaching its depot; and buses out never exceed buses owned.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { Fleet } from '../render/map/fleet';
import { addDebugLine, DEBUG_STOPS } from '../sim/commands/debugLine';
import { createRng } from '../sim/core/rng';
import { pickRoadworks } from '../sim/events/roll';
import { gameWithDepot } from '../sim/testing';
import type { FromWorker, LngLatPair, Snapshot, ToWorker } from '../sim/types';
import { createHost } from './host';

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

/** A founded game with a depot, the debug line every 10 minutes and cash to spare, at `elapsed`, as a save. */
function save(elapsed: number, edit: (d: Record<string, unknown>) => void = () => undefined): string {
  const { host, last } = started();
  host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
  const ring = [...last('ready').depotLand].sort((a, b) => b.length - a.length)[0]!;
  const mid = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  host.handle({ type: 'place-depot', at: [(ring[0]![0] + mid[0]!) / 2, (ring[0]![1] + mid[1]!) / 2] });
  host.handle({ type: 'create-line', clicks: DEBUG_STOPS.map((s) => [...s.at] as [number, number]), headways: { peak: 600, offpeak: 600, overnight: null } });
  host.handle({ type: 'export' });
  const data = (JSON.parse(last('export').text) as { data: Record<string, unknown> & { clock: { elapsed: number }; ledger: unknown[] } }).data;
  data.ledger.push({ day: 1, kind: 'contract', amountCents: 500_000_000, lineId: null });
  data.clock.elapsed = elapsed;
  edit(data);
  return JSON.stringify({ ...JSON.parse(last('export').text), data });
}

const M_PER_DEG = 111_320;
const metres = (a: LngLatPair, b: LngLatPair) => Math.hypot((a[0] - b[0]) * M_PER_DEG * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * M_PER_DEG);

/** The fleet the vehicle layer would draw from a snapshot. */
function fleetOf(snapshot: Snapshot): Fleet {
  const fleet = new Fleet();
  fleet.setLines(snapshot.lines);
  return fleet;
}

/** Every bus `fleet` draws at `second` of `day`. */
function drawn(fleet: Fleet, second: number, day: number): LngLatPair[] {
  fleet.setClock(second % 86_400, 0, 0, day + Math.floor(second / 86_400));
  const { count, data } = fleet.frame(0);
  return Array.from({ length: count }, (_, i) => [data[8 * i]!, data[8 * i + 1]!]);
}

/** The largest distance from a bus of `from` to the nearest one of `to`, leaving out buses within 5 m of a depot end. */
function largestMove(from: readonly LngLatPair[], to: readonly LngLatPair[], depots: readonly LngLatPair[]): number {
  let worst = 0;
  for (const p of from) {
    if (depots.some((d) => metres(p, d) <= 5)) continue;
    worst = Math.max(worst, Math.min(Infinity, ...to.map((q) => metres(p, q))));
  }
  return worst;
}

/** Where buses leave and reach their depots: every version's drive ends. */
const depotEnds = (s: Snapshot): LngLatPair[] =>
  s.lines.flatMap((l) => [l, ...(l.settling?.earlier ?? [])].flatMap((g) => [g.pullOut[0], g.pullIn[g.pullIn.length - 1]].filter((p): p is LngLatPair => p !== undefined)));

/** At most one second's drive at the fastest model, with room for the turn at a stop. */
const STEP_M = 25;

function checkChange(name: string, at: number, change: (host: ReturnType<typeof started>) => Snapshot, modelSwap = false) {
  it(`${name}: no bus moves at the change, every bus drives on from where it was, never more buses out than owned`, { timeout: 30_000 }, () => {
    const s = started();
    s.host.handle({ type: 'import', text: save(at) });
    const before = s.now();
    const owned = before.lines[0]!.buses;
    const after = change(s);
    const start = after.secondOfDay;
    const ends = [...depotEnds(before), ...depotEnds(after)];
    // The instant.
    const fleet = fleetOf(after);
    const was = drawn(fleetOf(before), before.secondOfDay, before.day);
    const is = drawn(fleet, start, after.day);
    expect(largestMove(was, is, ends), 'at the change').toBeLessThanOrEqual(5);
    expect(largestMove(is, was, ends), 'at the change').toBeLessThanOrEqual(5);
    // Three game hours on, second by second.
    let prev = is;
    const carried = was.length;
    for (let t = start + 1; t <= start + 3 * 3_600; t++) {
      const next = drawn(fleet, t, after.day);
      expect(largestMove(next, prev, ends), `${t - start} s after`).toBeLessThanOrEqual(STEP_M);
      expect(largestMove(prev, next, ends), `${t - start} s after`).toBeLessThanOrEqual(STEP_M);
      // A swap sells the old buses at the click; those still out finish their trips beside the new ones.
      expect(next.length, `${t - start} s after`).toBeLessThanOrEqual(Math.max(owned, after.lines[0]!.buses) + (modelSwap ? carried : 0));
      prev = next;
    }
  });
}

const EIGHT = 86_400 + 3 * 3_600; // 08:00 on day 2
const send = (message: ToWorker) => (s: ReturnType<typeof started>) => {
  s.host.handle(message);
  return s.now();
};

describe('I6 across route edits mid-run (the M4 spec, item 4)', () => {
  checkChange('Symphony taken off', EIGHT, send({ type: 'remove-stop', lineId: 1, stopId: 2 }));
  checkChange('extended beyond Longwood', EIGHT, send({ type: 'extend-line', lineId: 1, end: 'end', clicks: [[-71.1085, 42.3395]] }));
  checkChange('every 15 minutes', EIGHT, send({ type: 'set-headways', lineId: 1, headways: { peak: 900, offpeak: 900, overnight: null } }));
  checkChange('every 5 minutes', EIGHT, send({ type: 'set-headways', lineId: 1, headways: { peak: 300, offpeak: 300, overnight: null } }));
  checkChange('swapped to Metro 40s', EIGHT, send({ type: 'set-model', lineId: 1, model: 'metro40' }), true);
  // Roadworks on a stretch the line drives, as the roll would pick it, starting at day 3's midnight.
  const world = gameWithDepot();
  addDebugLine(world);
  const stretch = pickRoadworks(world, createRng(1))!;
  it('roadworks starting at a midnight with the last trips out: no bus moves, and every one drives on', () => {
    const s = started();
    s.host.handle({ type: 'import', text: save(2 * 86_400 + 18 * 3_600 + 50 * 60, (d) => void (d.event = { kind: 'roadworks', startDay: 4, endDay: 6, ...stretch })) });
    const before = s.now();
    s.host.advanceTo(2 * 86_400 + 19 * 3_600); // day 3's close
    const after = s.now();
    expect(after.lines[0]!.settling).not.toBeNull();
    const ends = [...depotEnds(before), ...depotEnds(after)];
    const was = drawn(fleetOf(before), 86_400, before.day);
    const is = drawn(fleetOf(after), 0, after.day);
    expect(was.length).toBeGreaterThan(0);
    expect(largestMove(was, is, ends)).toBeLessThanOrEqual(5);
    expect(largestMove(is, was, ends)).toBeLessThanOrEqual(5);
  });
});
