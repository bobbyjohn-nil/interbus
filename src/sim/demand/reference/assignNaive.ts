// The straightforward assignment loop as it stood before the week-3 speed-up (every cell pair, every
// sub-point pair, every stop pair, each with its own walk and distance), kept as the yardstick that
// assign.test.ts and `npm run bench compare` hold the fast loop to. Nothing in the game uses it.
// Since step 11 each sub-point pair scans every line serving it (commonLines, I5), as the fast loop
// does, where both once took the quickest line alone, and may change line once: from any stop of
// one line to any of another within 250 m, found here stop pair by stop pair, never onto a line the
// home can walk to nor off one the work can. Since item 15 each period's traffic times its rides
// (traffic/congestion.ts): a rider picks the stops the day's average traffic makes quickest, and
// each period's choice between lines and changes is made on those stops' rides at its traffic.
import { CENTS_PER_MINUTE, DWELL_SEC, BUS_KMH, MAX_WALK_M, REFERENCE_FARE_CENTS, TRANSFER_REACH_M, WALK_MIN_PER_KM } from '../../config/demand';
import { STOP_TIERS } from '../../config/stops';
import { distXY, SpatialGrid } from '../../core/geo';
import type { City, SubPoint } from '../../city/simfile';
import { PERIODS, runsIn, type Period } from '../../rules/periods';
import type { Commuters } from '../commuters';
import { periodCongestion } from '../../traffic/congestion';
import { busShare, commonLines, fareSensitivity, perceivedWaitMin, waitMin, walkMinutes, type LinePlan } from '../assign';

interface Reach {
  readonly line: number;
  readonly pos: number;
  readonly walkMin: number;
}

/**
 * Riders per line per period, in PERIODS order, as the old loop counted them, those of them who pay
 * (all but those changing onto the line), and each line's busiest leg per period, counted rider by
 * rider (assign() counts it from its groups' stops).
 */
export function assignNaive(
  city: City,
  commuters: Commuters,
  plans: readonly LinePlan[],
  tripScalePermille = city.tripScalePermille,
): { riders: number[][]; paid: number[][]; busiest: number[][]; ends: { board: Float64Array; alight: Float64Array; change: Float64Array }[] } {
  // Riders per line per period, as if the whole day's trips fell in that period; spread over the
  // period's half-hours by the commute profile at the end, since a pair's choice depends only on
  // the period's wait.
  const byPeriod = plans.map(() => ({ peak: 0, offpeak: 0, overnight: 0 }) as Record<Period, number>);
  const paidByPeriod = plans.map(() => ({ peak: 0, offpeak: 0, overnight: 0 }) as Record<Period, number>);
  // Each line's load on every leg, per period and direction, at [(period * 2 + direction) * stops + leg].
  const load = plans.map((plan) => new Float64Array(6 * plan.stops.length));
  // Who boards and alights at each stop, at [period * stops + stop].
  const stopEnds = plans.map((plan) => ({ board: new Float64Array(3 * plan.stops.length), alight: new Float64Array(3 * plan.stops.length), change: new Float64Array(3 * plan.stops.length) }));
  const stopsGrid = new SpatialGrid<{ line: number; pos: number }>(MAX_WALK_M);
  plans.forEach((plan, line) => plan.stops.forEach((p, pos) => stopsGrid.add(p, { line, pos })));
  const reach = (p: SubPoint): Reach[] =>
    stopsGrid.within([p.x, p.y], MAX_WALK_M).map((s) => ({ line: s.item.line, pos: s.item.pos, walkMin: walkMinutes(s.distM, plans[s.item.line]!.walkBonusMin?.[s.item.pos] ?? 0) }));
  // Each sub-point's stops, and the lines it can walk to.
  const reached = (p: SubPoint) => {
    const stops = reach(p);
    const lines = new Uint8Array(plans.length);
    for (const s of stops) lines[s.line] = 1;
    return { p, reach: stops, lines };
  };
  const homes = city.cells.map((c) => c.homes.map(reached).filter((h) => h.reach.length > 0));
  const work = city.cells.map((c) => c.work.map(reached).filter((w) => w.reach.length > 0));
  const totals = city.cells.map((c) => [c.residents, c.jobs] as const);

  // Each line's headway in each period (Infinity where it does not run), ride minutes and fare minutes.
  const headway = plans.map((plan) =>
    Object.fromEntries(PERIODS.map((period) => {
      const h = period === 'overnight' ? plan.headways.overnight : plan.headways[period];
      return [period, runsIn(plan.headways, period) && h !== null ? h : Infinity];
    })) as Record<Period, number>,
  );
  const fareMin = plans.map((plan) => (plan.fareCents - REFERENCE_FARE_CENTS) / CENTS_PER_MINUTE);
  // Each line's congestion in each period, in PERIODS order: the factor on its drive.
  const traffic = plans.map((plan) => {
    const factor = periodCongestion(plan.rush ?? 0);
    return PERIODS.map((p) => factor[p]);
  });
  // A ride's minutes in period k, or at the day's average traffic at k = 3.
  const rideMin = (line: number, a: number, b: number, k: number) => {
    const plan = plans[line]!;
    const metres = Math.abs(plan.stopDistM[b]! - plan.stopDistM[a]!);
    return (metres / 1000 / BUS_KMH) * 60 * (k < 3 ? traffic[line]![k]! : 1) + Math.max(0, Math.abs(b - a) - 1) * (DWELL_SEC / 60);
  };
  const rideKm = (line: number, a: number, b: number) => Math.abs(plans[line]!.stopDistM[b]! - plans[line]!.stopDistM[a]!) / 1000;
  // Each pair of lines' quickest change in each period, and at the day's average traffic (k = 3),
  // between every stop of the first and every stop of the second, both ridden, before the second
  // wait, tried over every pair of their stops within reach: [k][first][second] holds minutes at
  // [a * stops + b] and the stops changed between.
  const change = [0, 1, 2, 3].map((k) => plans.map((first, lineA) =>
    plans.map((second, lineB) => {
      const stops = second.stops.length;
      const minutes = new Float64Array(first.stops.length * stops).fill(Infinity);
      const at = new Int32Array(2 * first.stops.length * stops);
      if (lineA === lineB) return { minutes, at, stops };
      first.stops.forEach((pa, ta) =>
        second.stops.forEach((pb, tb) => {
          const metres = distXY(pa, pb);
          if (metres > TRANSFER_REACH_M) return;
          const penalty = second.transferPenaltyMin?.[tb] ?? STOP_TIERS[1].transferPenaltyMin;
          for (let a = 0; a < first.stops.length; a++) {
            if (a === ta) continue;
            for (let b = 0; b < stops; b++) {
              // Never back to within reach of the first stop: that rider would walk.
              if (b === tb || distXY(first.stops[a]!, second.stops[b]!) <= TRANSFER_REACH_M) continue;
              const fare = fareMin[lineA]! * fareSensitivity(rideKm(lineA, a, ta) + rideKm(lineB, tb, b));
              const m = Math.max(0.5, rideMin(lineA, a, ta, k) + rideMin(lineB, tb, b, k) + fare) + (metres / 1000) * WALK_MIN_PER_KM + penalty;
              if (m < minutes[a * stops + b]!) {
                minutes[a * stops + b] = m;
                at[2 * (a * stops + b)] = ta;
                at[2 * (a * stops + b) + 1] = tb;
              }
            }
          }
        }),
      );
      return { minutes, at, stops };
    }),
  ));
  /** Carries `r` riders on `line` from stop `from` to stop `to` in period `k`. */
  const ride = (line: number, k: number, from: number, to: number, r: number) => {
    byPeriod[line]![PERIODS[k]!] += r;
    // Every leg between the two stops, in the direction travelled, carries these riders.
    const stops = plans[line]!.stops.length;
    stopEnds[line]!.board[k * stops + from]! += r;
    stopEnds[line]!.alight[k * stops + to]! += r;
    const at = (from < to ? k * 2 : k * 2 + 1) * stops;
    for (let leg = Math.min(from, to); leg < Math.max(from, to); leg++) load[line]![at + leg]! += r;
  };

  const n = commuters.n;
  const scale = tripScalePermille / 1000;
  // Each line's quickest way between the pair's sub-points at the day's average traffic, before
  // waiting: minutes, stops and the walks at either end.
  const lines = plans.length;
  const lineBase = new Float64Array(lines);
  const lineFrom = new Int32Array(lines);
  const lineTo = new Int32Array(lines);
  const lineWalk = new Float64Array(lines);
  const lineHeadway = new Float64Array(lines);
  const share = new Float64Array(lines);
  const order = new Int32Array(lines);
  // And each pair of lines' quickest change, before the second wait, at [first * lines + second],
  // its stops and its walks.
  const changeBase = new Float64Array(lines * lines);
  const changeStops = new Int32Array(4 * lines * lines);
  const changeWalk = new Float64Array(lines * lines);
  /** A one-seat ride's minutes in period k (3: the day's average), its fare felt against its km. */
  const oneSeat = (line: number, a: number, b: number, k: number) => {
    // A bargain fare makes the ride feel shorter, never free (V1 demand.worker.ts:342-344).
    const rideKm = Math.abs(plans[line]!.stopDistM[b]! - plans[line]!.stopDistM[a]!) / 1000;
    return Math.max(0.5, rideMin(line, a, b, k) + fareMin[line]! * fareSensitivity(rideKm));
  };
  // In a period, each first line's quickest way: the line it changes onto, or -1 for none.
  const periodBase = new Float64Array(lines);
  const periodSecond = new Int32Array(lines);
  for (let i = 0; i < n; i++) {
    const origins = homes[i]!;
    if (origins.length === 0) continue;
    for (let j = 0; j < n; j++) {
      const flow = commuters.flow[i * n + j]!;
      const ends = work[j]!;
      if (flow <= 0 || ends.length === 0) continue;
      for (const o of origins) {
        for (const d of ends) {
          // This sub-point pair's share of the cell pair's commuters, both ways (V1 counted the round trip).
          const pairTrips = 2 * flow * (o.p.w / totals[i]![0]) * (d.p.w / totals[j]![1]) * scale;
          lineBase.fill(Infinity);
          changeBase.fill(Infinity);
          for (const a of o.reach) {
            for (const b of d.reach) {
              if (a.line !== b.line) {
                // Nobody changes onto a line they could walk to from home, or off one that reaches work.
                if (o.lines[b.line] || d.lines[a.line]) continue;
                const c = change[3]![a.line]![b.line]!;
                const at = a.pos * c.stops + b.pos;
                const base = a.walkMin + c.minutes[at]! + b.walkMin;
                const pair = a.line * lines + b.line;
                if (base < changeBase[pair]!) {
                  changeBase[pair] = base;
                  changeStops.set([a.pos, c.at[2 * at]!, c.at[2 * at + 1]!, b.pos], 4 * pair);
                  changeWalk[pair] = a.walkMin + b.walkMin;
                }
                continue;
              }
              if (a.pos === b.pos) continue;
              const base = a.walkMin + oneSeat(a.line, a.pos, b.pos, 3) + b.walkMin;
              if (base < lineBase[a.line]!) {
                lineBase[a.line] = base;
                lineFrom[a.line] = a.pos;
                lineTo[a.line] = b.pos;
                lineWalk[a.line] = a.walkMin + b.walkMin;
              }
            }
          }
          const km = distXY([o.p.x, o.p.y], [d.p.x, d.p.y]) / 1000;
          PERIODS.forEach((period, k) => {
            // Each first line's quicker of its one-seat ride and its changes, with the second line's
            // wait this period: they take the same first bus.
            for (let line = 0; line < lines; line++) {
              lineHeadway[line] = headway[line]![period];
              // The stops the day's average picked, ridden at this period's traffic.
              periodBase[line] = lineBase[line] === Infinity ? Infinity : lineWalk[line]! + oneSeat(line, lineFrom[line]!, lineTo[line]!, k);
              periodSecond[line] = -1;
              for (let second = 0; second < lines; second++) {
                // A second line that does not run this period carries nobody (waitMin would cap its wait).
                if (headway[second]![period] === Infinity) continue;
                const pair = line * lines + second;
                if (changeBase[pair] === Infinity) continue;
                const c = change[k]![line]![second]!;
                const rides = c.minutes[changeStops[4 * pair]! * c.stops + changeStops[4 * pair + 3]!]!;
                const base = changeWalk[pair]! + rides + perceivedWaitMin(waitMin(headway[second]![period]));
                if (base < periodBase[line]!) {
                  periodBase[line] = base;
                  periodSecond[line] = second;
                }
              }
            }
            const minutes = commonLines(periodBase, lineHeadway, lines, share, order);
            if (minutes === Infinity) return;
            const riders = pairTrips * busShare(minutes, km);
            for (let line = 0; line < lines; line++) {
              const r = riders * share[line]!;
              if (r === 0) continue;
              paidByPeriod[line]![period] += r;
              const second = periodSecond[line]!;
              if (second < 0) {
                ride(line, k, lineFrom[line]!, lineTo[line]!, r);
                continue;
              }
              const pair = line * lines + second;
              const [board, from, to, alight] = changeStops.subarray(4 * pair, 4 * pair + 4);
              ride(line, k, board!, from!, r);
              ride(second, k, to!, alight!, r);
              stopEnds[second]!.change[k * plans[second]!.stops.length + to!]! += r;
            }
          });
        }
      }
    }
  }
  return {
    riders: byPeriod.map((r) => PERIODS.map((p) => r[p])),
    paid: paidByPeriod.map((r) => PERIODS.map((p) => r[p])),
    busiest: load.map((d, line) =>
      PERIODS.map((_, k) => {
        const stops = plans[line]!.stops.length;
        return Math.max(...d.subarray(k * 2 * stops, (k * 2 + 2) * stops));
      }),
    ),
    ends: stopEnds,
  };
}
