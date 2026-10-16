// I6 across route edits mid-run (the M4 spec, item 4): the debug line every 10 minutes, paused at
// 08:00 on day 2 with its buses out, then changed by each command the line card and the line tool
// send, alone or after another change whose old buses are still finishing their trips, and roadworks
// starting at a midnight with the last trips still out. Every bus is drawn by the fleet the vehicle
// layer draws, from the host's own snapshots: none moves more than 5 m at the change; for three game
// hours after, second by second, every bus is within a step of where one was a second before, and one
// drawn for its first second out of its depot or its last before it is home within a step of a depot
// end; and buses out never exceed buses owned. Service that starts with no bus out, a new line or
// overnight turned on at night, starts from the depot.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { Fleet } from '../render/map/fleet';
import { addDebugLine, DEBUG_STOPS } from '../sim/commands/debugLine';
import { createRng, type Rng } from '../sim/core/rng';
import { pickRoadworks } from '../sim/events/roll';
import { gameWithDepot } from '../sim/testing';
import type { Headways } from '../sim/rules/periods';
import { planInEffect, versionAt } from '../sim/rules/transition';
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
  return { host, last, now, out };
}

/** A founded game with a depot, at 05:00 on day 1. */
function founded() {
  const s = started();
  s.host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
  const ring = [...s.last('ready').depotLand].sort((a, b) => b.length - a.length)[0]!;
  const mid = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  s.host.handle({ type: 'place-depot', at: [(ring[0]![0] + mid[0]!) / 2, (ring[0]![1] + mid[1]!) / 2] });
  return s;
}

/** The debug line, from the line tool. */
const debugLine = (headways: Headways): ToWorker => ({ type: 'create-line', clicks: DEBUG_STOPS.map((s) => [...s.at] as [number, number]), headways });

/** A founded game with a depot, the debug line every 10 minutes and cash to spare, at `elapsed`, as a save. */
function save(elapsed: number, edit: (d: Record<string, unknown>) => void = () => undefined): string {
  const { host, last } = founded();
  host.handle(debugLine({ peak: 600, offpeak: 600, overnight: null }));
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

/** A bus drawn: where, and whether this is its first second drawn, out of the depot, or its last, home before the next. */
interface Drawn {
  readonly at: LngLatPair;
  readonly first: boolean;
  readonly last: boolean;
}

/**
 * Every bus the vehicle layer draws from a snapshot, second by second, each marked by the plan the fleet
 * places it from (positionsInEffect writes its buses in the order of their stints), so the check below
 * knows the bus that has just left its depot and the one about to reach it.
 */
function watch(snapshot: Snapshot): (second: number, day: number) => Drawn[] {
  const fleet = fleetOf(snapshot);
  const lines = snapshot.lines
    .filter((l) => l.stopAt.length >= 2 && l.plan.timing.buses > 0)
    .map((l) => ({ effect: planInEffect(l.plan, (l.settling?.earlier ?? []).map((e) => ({ inputs: e.plan, until: e.until, sameModel: e.sameModel, sameStart: e.sameStart }))), frameDay: l.settling?.frameDay ?? null }));
  return (second, day) => {
    const at = drawn(fleet, second, day);
    const absolute = day * 86_400 + second;
    const marks = lines.flatMap(({ effect, frameDay }) => {
      const x = frameDay === null ? absolute % 86_400 : absolute - frameDay * 86_400;
      const m = effect.merged;
      const [stints, t] = m && x < m.handover ? [m.stints, x] : [effect.periodic.stints, ((x % 86_400) + 86_400) % 86_400];
      return stints.filter((st) => t >= st.leaveDepot && t < st.arriveDepot).map((st) => ({ first: st.leaveDepot > t - 1, last: st.arriveDepot <= t + 1 }));
    });
    if (marks.length !== at.length) throw new Error(`${at.length} buses drawn at ${second}, ${marks.length} in the plan`);
    return at.map((p, i) => ({ at: p, ...marks[i]! }));
  };
}

/**
 * The largest step any bus takes from one second to the next: from each bus to the nearest drawn the
 * other second. A bus drawn for its first second has just pulled out, a fraction of a second's drive
 * along, and one drawn for its last is about to reach its depot, so each is measured from the nearest
 * depot end instead; every other bus, one near a depot included, must have driven on from where one was.
 */
function largestStep(was: readonly Drawn[], is: readonly Drawn[], depots: readonly LngLatPair[]): number {
  const nearest = (p: LngLatPair, to: readonly LngLatPair[]) => Math.min(Infinity, ...to.map((q) => metres(p, q)));
  const [from, to] = [was.map((b) => b.at), is.map((b) => b.at)];
  let worst = 0;
  for (const b of is) worst = Math.max(worst, nearest(b.at, b.first ? depots : from));
  for (const b of was) worst = Math.max(worst, nearest(b.at, b.last ? depots : to));
  return worst;
}

/** Where buses leave and reach their depots: every version's drive ends. */
const depotEnds = (s: Snapshot): LngLatPair[] =>
  s.lines.flatMap((l) => [l, ...(l.settling?.earlier ?? [])].flatMap((g) => [g.pullOut[0], g.pullIn[g.pullIn.length - 1]].filter((p): p is LngLatPair => p !== undefined)));

/** At most one second's drive at the fastest model, with room for the turn at a stop. */
const STEP_M = 25;

type Game = ReturnType<typeof started>;

/** `change` made at `at`, after `first`, changes made before it whose buses may still be finishing their trips. */
function checkChange(name: string, at: number, change: (host: Game) => Snapshot, modelSwap = false, first: (host: Game) => void = () => undefined) {
  it(`${name}: no bus moves at the change, every bus drives on from where it was, never more buses out than owned`, { timeout: 30_000 }, () => {
    const s = started();
    s.host.handle({ type: 'import', text: save(at) });
    first(s);
    const before = s.now();
    const owned = before.lines[0]!.buses;
    const after = change(s);
    const start = after.secondOfDay;
    const ends = [...depotEnds(before), ...depotEnds(after)];
    // The instant.
    const fleet = watch(after);
    const was = drawn(fleetOf(before), before.secondOfDay, before.day);
    let prev = fleet(start, after.day);
    expect(largestMove(was, prev.map((b) => b.at), ends), 'at the change').toBeLessThanOrEqual(5);
    expect(largestMove(prev.map((b) => b.at), was, ends), 'at the change').toBeLessThanOrEqual(5);
    // Three game hours on, second by second.
    const carried = was.length;
    for (let t = start + 1; t <= start + 3 * 3_600; t++) {
      const next = fleet(t, after.day);
      expect(largestStep(prev, next, ends), `${t - start} s after`).toBeLessThanOrEqual(STEP_M);
      // A swap sells the old buses at the click; those still out finish their trips beside the new ones.
      expect(next.length, `${t - start} s after`).toBeLessThanOrEqual(Math.max(owned, after.lines[0]!.buses) + (modelSwap ? carried : 0));
      prev = next;
    }
  });
}

const EIGHT = 86_400 + 3 * 3_600; // 08:00 on day 2
const send = (message: ToWorker) => (s: Game) => {
  s.host.handle(message);
  return s.now();
};
/** Changes made one after another; `wait` runs game time between them. */
const steps = (...changes: ((s: Game) => void)[]) => (s: Game) => {
  for (const c of changes) c(s);
};
const wait = (minutes: number) => (s: Game) => s.host.advanceTo(s.now().elapsed + minutes * 60);
const EVERY_15: ToWorker = { type: 'set-headways', lineId: 1, headways: { peak: 900, offpeak: 900, overnight: null } };
const EVERY_12: ToWorker = { type: 'set-headways', lineId: 1, headways: { peak: 720, offpeak: 720, overnight: null } };
/** Save route with the stops reversed: Longwood first. */
const reversed = (s: Game) => s.host.handle({ type: 'set-route', lineId: 1, points: [...s.now().lines[0]!.stops].reverse() });
const run = (message: ToWorker) => (s: Game) => s.host.handle(message);

describe('I6 across route edits mid-run (the M4 spec, item 4)', () => {
  checkChange('Symphony taken off', EIGHT, send({ type: 'remove-stop', lineId: 1, stopId: 2 }));
  checkChange('extended beyond Longwood', EIGHT, send({ type: 'extend-line', lineId: 1, end: 'end', clicks: [[-71.1085, 42.3395]] }));
  checkChange('a stop inserted between Symphony and the MFA', EIGHT, send({ type: 'insert-stop', lineId: 1, at: [-71.0903, 42.33995] }));
  checkChange('every 15 minutes', EIGHT, send({ type: 'set-headways', lineId: 1, headways: { peak: 900, offpeak: 900, overnight: null } }));
  checkChange('every 5 minutes', EIGHT, send({ type: 'set-headways', lineId: 1, headways: { peak: 300, offpeak: 300, overnight: null } }));
  checkChange('swapped to Metro 40s', EIGHT, send({ type: 'set-model', lineId: 1, model: 'metro40' }), true);
  // A second change within a round trip of one that moved the first stop: the buses the first sent home
  // still go home after their trips, rather than taking the new departures from the other end. Shown
  // failing (TS-04) on 5f4bce3, in order: a bus jumped 2,763 m 900 s after, 2,047 m at 1,500 s, 1,025 m
  // at 900 s, 2,763 m at 1,320 s and 2,763 m at 720 s; and sold Sparrows ran 63 Metro 40 departures
  // from 08:15.
  checkChange('Longwood made the first stop, then every 15 minutes at once', EIGHT, send(EVERY_15), false, reversed);
  checkChange('Longwood made the first stop, then every 15 minutes five minutes later', EIGHT, send(EVERY_15), false, steps(reversed, wait(5)));
  checkChange('Copley taken off, then every 15 minutes at once', EIGHT, send(EVERY_15), false, run({ type: 'remove-stop', lineId: 1, stopId: 1 }));
  checkChange('Longwood made the first stop, every 15 minutes two minutes later, then every 12 minutes', EIGHT, send(EVERY_12), false, steps(reversed, wait(2), run(EVERY_15)));
  checkChange('Longwood made the first stop, every 15 minutes, that undone, then every 12 minutes', EIGHT, send(EVERY_12), false, steps(reversed, run(EVERY_15), run({ type: 'undo' })));
  it('a swap to Metro 40s, then every 15 minutes at once: the sold Sparrows go home after their trips, and never more Metro 40s out than owned', () => {
    const s = started();
    s.host.handle({ type: 'import', text: save(EIGHT) });
    s.host.handle({ type: 'set-model', lineId: 1, model: 'metro40' });
    s.host.handle(EVERY_15);
    const after = s.now();
    expect(s.out.filter((m) => m.type === 'refused')).toEqual([]);
    // The plan the vehicle layer draws and the costs bill, each bus's trips by the version each ran on: 0 the Sparrows', 1 and 2 the Metro 40s'.
    const l = after.lines[0]!;
    const merged = planInEffect(l.plan, (l.settling?.earlier ?? []).map((e) => ({ inputs: e.plan, until: e.until, sameModel: e.sameModel, sameStart: e.sameStart }))).merged!;
    const sparrows = merged.stints.filter((st) => versionAt(merged, st.leaveDepot) === 0);
    expect(sparrows.length).toBeGreaterThan(0);
    expect(sparrows.flatMap((st) => st.trips.filter((t) => versionAt(merged, t) > 0))).toEqual([]);
    const start = after.secondOfDay + (after.day - l.settling!.frameDay) * 86_400;
    for (let t = start; t < start + 3 * 3_600; t += 20) {
      expect(merged.stints.filter((st) => versionAt(merged, st.leaveDepot) > 0 && t >= st.leaveDepot && t < st.arriveDepot).length, `${t - start} s after`).toBeLessThanOrEqual(l.buses);
    }
  });
  // Roadworks on a stretch the line drives, as the roll would pick it, starting at day 3's midnight.
  const world = gameWithDepot();
  addDebugLine(world);
  const stretch = pickRoadworks(world, createRng(1))!;
  it('roadworks starting at a midnight with the last trips out: no bus moves, and every one drives on', () => {
    const s = started();
    s.host.handle({ type: 'import', text: save(2 * 86_400 + 18 * 3_600 + 50 * 60, (d) => void (d.event = { kind: 'roadworks', startDay: 4, endDay: 6, ...stretch, at: null })) });
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
  // The close lets go of a change settled that day, and must not time the line by the new day's roadworks
  // before comparing. Shown failing (TS-04) on 5f4bce3: a bus out at midnight moved 383 m at the close.
  it('Symphony taken off at 14:00, settled by the evening, then roadworks starting that midnight: no bus moves', () => {
    const s = started();
    s.host.handle({ type: 'import', text: save(2 * 86_400 + 9 * 3_600, (d) => void (d.event = { kind: 'roadworks', startDay: 4, endDay: 6, ...stretch, at: null })) }); // 14:00 on day 3
    s.host.handle({ type: 'remove-stop', lineId: 1, stopId: 2 });
    s.host.advanceTo(2 * 86_400 + 18 * 3_600 + 50 * 60);
    const before = s.now();
    s.host.advanceTo(2 * 86_400 + 19 * 3_600); // day 3's close
    const after = s.now();
    const ends = [...depotEnds(before), ...depotEnds(after)];
    const was = drawn(fleetOf(before), 86_400, before.day);
    const is = drawn(fleetOf(after), 0, after.day);
    expect(was.length).toBeGreaterThan(0);
    expect(largestMove(was, is, ends)).toBeLessThanOrEqual(5);
    expect(largestMove(is, was, ends)).toBeLessThanOrEqual(5);
    expect(after.lines[0]!.settling).not.toBeNull();
  });
});

/** A change the line card or the route editor might send for the line as it stands, or an undo. */
function anyChange(rng: Rng, line: Snapshot['lines'][number]): ToWorker {
  const every = () => rng.pick([300, 600, 900, 1_200, 1_800]);
  switch (rng.int(0, 5)) {
    case 0:
      return { type: 'set-headways', lineId: 1, headways: { peak: every(), offpeak: every(), overnight: null } };
    case 1:
      return { type: 'set-model', lineId: 1, model: line.model === 'sparrow' ? 'metro40' : 'sparrow' };
    case 2:
      return { type: 'set-route', lineId: 1, points: [...line.stops].reverse() };
    case 3:
      return { type: 'remove-stop', lineId: 1, stopId: rng.pick(line.stopIds) };
    case 4:
      return { type: 'extend-line', lineId: 1, end: 'end', clicks: [[-71.1085, 42.3395]] };
    default:
      return { type: 'undo' };
  }
}

// Changes made one after another, at once or up to 40 game minutes apart, so a bus is often still on a
// trip begun two or three versions back. Seeded; after each, the same checks as above, second by second
// for 45 minutes, longer than the wait for the next change. Shown failing (TS-04) on 5f4bce3 with seeds
// 2 and 3, by jumps of 2,524 m and 2,137 m; seed 1 passed there.
describe('I6 across changes made in a row (seeded)', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: no bus moves at a change, and every bus drives on from where it was`, { timeout: 60_000 }, () => {
      const rng = createRng(seed);
      const s = started();
      s.host.handle({ type: 'import', text: save(EIGHT) });
      const done: string[] = [];
      for (let step = 0; step < 8; step++) {
        // Time runs between changes, as in the game, so an undo takes back only what was done since.
        s.host.handle({ type: 'speed', speed: 1 });
        s.host.advanceTo(s.now().elapsed + rng.pick([0, 0, 2, 5, 10, 20, 40]) * 60);
        const before = s.now();
        for (let k = rng.int(1, 3); k > 0; k--) {
          const change = anyChange(rng, s.now().lines[0]!);
          s.host.handle(change);
          done.push(`${before.day} ${Math.floor(before.secondOfDay / 60)} min: ${JSON.stringify(change)}`);
        }
        const after = s.now();
        const label = done.join('; ');
        const ends = [...depotEnds(before), ...depotEnds(after)];
        const fleet = watch(after);
        const was = drawn(fleetOf(before), before.secondOfDay, before.day);
        let prev = fleet(after.secondOfDay, after.day);
        expect(largestMove(was, prev.map((b) => b.at), ends), `${label}: at the change`).toBeLessThanOrEqual(5);
        expect(largestMove(prev.map((b) => b.at), was, ends), `${label}: at the change`).toBeLessThanOrEqual(5);
        for (let t = after.secondOfDay + 1; t <= after.secondOfDay + 45 * 60; t++) {
          const next = fleet(t, after.day);
          expect(largestStep(prev, next, ends), `${label}: ${t - after.secondOfDay} s after`).toBeLessThanOrEqual(STEP_M);
          prev = next;
        }
      }
    });
  }
});

/**
 * Service that starts with none of a line's buses out: each bus pulls out of the depot to make its first
 * departure, as each morning's do, rather than appearing on the line. Shown failing (TS-04) on 5f4bce3:
 * both drew buses on the line, away from the depot, the instant after the change, with none before.
 */
function checkStart(name: string, setUp: (s: Game) => void, change: ToWorker) {
  it(`${name}: every bus pulls out of the depot, and drives on from where it was`, { timeout: 30_000 }, () => {
    const s = founded();
    setUp(s);
    const before = s.now();
    s.host.handle(change);
    const after = s.now();
    expect(s.out.filter((m) => m.type === 'refused')).toEqual([]);
    const ends = [...depotEnds(before), ...depotEnds(after)];
    const fleet = watch(after);
    const start = after.secondOfDay;
    expect(drawn(fleetOf(before), before.secondOfDay, before.day)).toEqual([]);
    // Nothing on the line at the change: any bus drawn is at its depot.
    let prev = fleet(start, after.day);
    expect(largestMove(prev.map((b) => b.at), [], ends), 'at the change').toBeLessThanOrEqual(5);
    let most = prev.length;
    for (let t = start + 1; t <= start + 3 * 3_600; t++) {
      const next = fleet(t, after.day);
      expect(largestStep(prev, next, ends), `${t - start} s after`).toBeLessThanOrEqual(STEP_M);
      expect(next.length, `${t - start} s after`).toBeLessThanOrEqual(after.lines[0]!.buses);
      most = Math.max(most, next.length);
      prev = next;
    }
    expect(most).toBeGreaterThan(0);
  });
}

/**
 * A line that also runs overnight (the systems audit's fifth round): its buses never wait an hour at the
 * first stop, so on 050dbdd a bus a change left spare stayed out until the plan ran out of departures,
 * near the end of the next day, and the plan handed over there to its day plan as both wound down; the
 * vehicle layer, reading the day plan's middle day from then, put that bus back at its first stop. Drawn
 * at 05:00 on day 1 and changed by `changes` (game seconds, in order); then, second by second, every bus
 * drives on from where it was for three game hours after the last change and for ten minutes either side
 * of the handover, as the page's snapshot holds it then, never more out than owned.
 */
function checkOvernight(name: string, headways: Headways, rich: boolean, changes: readonly (readonly [number, ToWorker])[]) {
  it(`${name}: every bus drives on from where it was after the change and through the handover`, { timeout: 60_000 }, () => {
    const s = founded();
    if (rich) {
      s.host.handle({ type: 'export' });
      const text = JSON.parse(s.last('export').text) as { data: { ledger: unknown[] } };
      text.data.ledger.push({ day: 1, kind: 'contract', amountCents: 500_000_000, lineId: null });
      s.host.handle({ type: 'import', text: JSON.stringify(text) });
    }
    s.host.handle(debugLine(headways));
    for (const [at, change] of changes) {
      s.host.advanceTo(at);
      s.host.handle(change);
    }
    expect(s.out.filter((m) => m.type === 'refused')).toEqual([]);
    const sod = (e: number) => (e + 5 * 3_600) % 86_400;
    const dayOf = (e: number) => Math.floor((e + 5 * 3_600) / 86_400) + 1;
    /** Every bus drawn from the snapshot now, from game second `from` to `to`, within a step of one drawn the second before. */
    const drivesOn = (from: number, to: number, label: string) => {
      const snapshot = s.now();
      const fleet = watch(snapshot);
      const ends = depotEnds(snapshot);
      let prev = fleet(sod(from), dayOf(from));
      for (let e = from + 1; e <= to; e++) {
        const next = fleet(sod(e), dayOf(e));
        expect(largestStep(prev, next, ends), `${label}, ${e - from} s on`).toBeLessThanOrEqual(STEP_M);
        expect(next.length, `${label}, ${e - from} s on`).toBeLessThanOrEqual(snapshot.lines[0]!.buses);
        prev = next;
      }
    };
    /** The game second the line's plan hands over to its day plan, as the snapshot now holds it, or null once it has settled. */
    const handover = (): number | null => {
      const l = s.now().lines[0]!;
      const m = l.settling && planInEffect(l.plan, l.settling.earlier.map((e) => ({ inputs: e.plan, until: e.until, sameModel: e.sameModel, sameStart: e.sameStart }))).merged;
      return m ? (l.settling!.frameDay - 1) * 86_400 + m.handover - 5 * 3_600 : null;
    };
    const last = changes[changes.length - 1]![0];
    drivesOn(last, last + 3 * 3_600, 'after the last change');
    // A close may let go of versions, so the handover is read again from the snapshot ten minutes before it.
    let at = handover();
    for (let k = 0; at !== null && k < 3; k++) {
      if (at - 600 > s.now().elapsed) s.host.advanceTo(at - 600);
      const again = handover();
      if (again === at) break;
      at = again;
    }
    if (at !== null && at + 600 > s.now().elapsed) drivesOn(Math.max(s.now().elapsed, at - 600), at + 600, `around the handover at day ${dayOf(at)}, ${sod(at)} s`);
  });
}

describe('I6 on a line running overnight', () => {
  // Shown failing (TS-04) on 050dbdd: a fresh company's line, every 15 minutes from 10:58 on day 1, handed
  // over at 23:30 on day 2, where a bus on its drive home moved 456 m back to Copley.
  checkOvernight('a fresh company’s line every 10, 12 and 15 minutes, every 15, 20 and 20 from 10:58 on day 1', { peak: 600, offpeak: 720, overnight: 900 }, false, [
    [5 * 3_600 + 3_484, { type: 'set-headways', lineId: 1, headways: { peak: 900, offpeak: 1_200, overnight: 1_200 } }],
  ]);
  // Shown failing (TS-04) on 050dbdd: still settling past day 3's close, it handed over at 23:44 on day 4,
  // where a bus driving home to the depot moved 1,360 m back to Copley.
  checkOvernight('Metro 40s from 21:39 on day 1, then new headways at 06:42 and 15:35 on day 3', { peak: 720, offpeak: 900, overnight: 1_800 }, true, [
    [59_953, { type: 'set-model', lineId: 1, model: 'metro40' }],
    [178_921, { type: 'set-headways', lineId: 1, headways: { peak: 360, offpeak: 720, overnight: 1_800 } }],
    [210_904, { type: 'set-headways', lineId: 1, headways: { peak: 600, offpeak: 720, overnight: 1_200 } }],
  ]);
});

describe('service starting with no bus out (I6)', () => {
  checkStart('the debug line drawn at 10:00', (s) => s.host.advanceTo(5 * 3_600), debugLine({ peak: 600, offpeak: 600, overnight: null }));
  checkStart(
    'overnight service every 30 minutes turned on at 01:18, its buses all home',
    (s) => {
      s.host.handle(debugLine({ peak: 600, offpeak: 1_200, overnight: null }));
      s.host.advanceTo(20 * 3_600 + 18 * 60); // 01:18 on day 2
    },
    { type: 'set-headways', lineId: 1, headways: { peak: 600, offpeak: 1_200, overnight: 1_800 } },
  );
});
