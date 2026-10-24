// The assignment's memo (AssignMemo; I14): the last assignment's rides carried again, in their order, for the cell pairs whose
// trips are as they were and no changed line has a route in. A game recomputes through it, while a game loaded from its file
// assigns from nothing, so the two must find the same riders number for number, or a reload would leave the game otherwise than
// it was (I8).
import { describe, expect, it } from 'vitest';
import { toCalendarTime } from '../core/calendar';
import { toLngLat, type XY } from '../core/geo';
import type { LineId } from '../core/ids';
import { grownCompany } from '../testing';
import { commutersToday, runningPlans, type World } from '../world';
import { STOP_TIERS } from '../config/stops';
import { assign, type AssignMemo, type LinePlan } from './assign';

/** Where two values differ, number for number (Object.is), as paths; none when they are the same. */
function differences(a: unknown, b: unknown, path = '', out: string[] = []): string[] {
  if (out.length >= 5) return out;
  if (typeof a === 'number' || typeof b === 'number') {
    if (!Object.is(a, b)) out.push(`${path}: ${String(a)} against ${String(b)}`);
  } else if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) out.push(`${path}: ${a.size} entries against ${b.size}`);
    for (const [k, v] of a) differences(v, b.get(k), `${path}.${String(k)}`, out);
  } else if (ArrayBuffer.isView(a) || Array.isArray(a)) {
    const x = a as ArrayLike<unknown>;
    const y = b as ArrayLike<unknown> | undefined;
    if (!y || x.length !== y.length) out.push(`${path}: ${x.length} long against ${y?.length}`);
    else for (let k = 0; k < x.length; k++) differences(x[k], y[k], `${path}[${k}]`, out);
  } else if (a !== null && typeof a === 'object') {
    for (const k of Object.keys(a)) differences((a as Record<string, unknown>)[k], (b as Record<string, unknown> | undefined)?.[k], `${path}.${k}`, out);
  } else if (a !== b) out.push(`${path}: ${String(a)} against ${String(b)}`);
  return out;
}

/** The commuters of a festival today round `xy`, as its first day's close makes them. */
function festivalAt(world: World, xy: XY) {
  const [lon, lat] = toLngLat(world.city.frame, xy);
  const day = toCalendarTime(world.state.elapsed).day;
  const event = { kind: 'festival' as const, startDay: day, endDay: day, street: '', edges: [], at: { lon, lat } };
  return commutersToday({ city: world.city, commuters: world.commuters, state: { ...world.state, event } });
}

describe('the assignment’s memo', () => {
  // Shown failing (TS-04) with a line's headways left out of what tells a changed line (lineSignature), off from the first headway
  // change, and likewise its distances and its change penalties, off from each changed alone; with only this assignment's
  // catchments marked, not the last one's, off from the stop moved; without sameOrder, off from the two lines in the other order;
  // with the fare left out of what a line's tables are made from (tableSignature), off from the fare changed; with the walk
  // bonus left out of what its catchments are made from (reachSignature), off from the Shelter; with the changed trips left
  // unmarked, off from the festival; with other distances let through, off from those distances; with the pairs near a Shelter
  // marked by their home end alone, or their work end alone, off from the Shelter; with a cell's first group alone, or a group's
  // first stop alone, off from the five-stop line's Shelters; with a change's penalty taken for a walk bonus (NOT_WALKED), off from
  // the penalty changed, and off from the Station without that step; and with the plans read as they stand rather than copied
  // (walkedOf), off from the walk bonus edited in place. The second test's last count goes off with no line taken for walk-only.
  it('finds the same riders as an assignment from nothing, number for number, through a run of changes', () => {
    const world = grownCompany(5, 500_000_000);
    const base = runningPlans(world);
    expect(base.length).toBe(5);
    const memo: AssignMemo = { last: null };
    const check = (plans: readonly LinePlan[], commuters = world.commuters) =>
      expect(differences(assign(world.city, commuters, plans, { memo }), assign(world.city, commuters, plans))).toEqual([]);
    const at = (k: number, change: Partial<LinePlan>) => base.map((p, m) => (m === k ? { ...p, ...change } : p));
    check(base);
    check(at(0, { headways: { ...base[0]!.headways, peak: 1_800, offpeak: 2_400 } }));
    check(base);
    check(at(1, { fareCents: base[1]!.fareCents + 50 }));
    check(at(2, { kmh: 31 }));
    check(at(3, { stops: base[3]!.stops.map(([x, y], q) => (q === 1 ? ([x + 120, y - 80] as const) : ([x, y] as const))) }));
    check(at(1, { walkBonusMin: base[1]!.stops.map((_, q) => (q === 0 ? 2 : 0)), transferPenaltyMin: base[1]!.stops.map(() => 3) }));
    // Two of a plan's fields each changed alone, which nothing in the game does: the distances along a line (a detour), and the penalty
    // of a change onto the third line at its first stop, where riders off two others make one, 2 minutes for a Sign's 6, which
    // moves riders (some 26 boardings a day among the lines).
    check(at(3, { stopDistM: base[3]!.stopDistM.map((m, q) => (q === 0 ? m : m * 1.1)) }));
    const penalty = at(2, { transferPenaltyMin: base[2]!.stops.map((_, q) => (q === 0 ? 2 : (base[2]!.transferPenaltyMin?.[q] ?? 6))) });
    const ridersOf = (plans: readonly LinePlan[]) => assign(world.city, world.commuters, plans).lines.get(base[2]!.id)!.perDay;
    expect(ridersOf(penalty)).not.toBe(ridersOf(base));
    check(penalty);
    // A Sign made a Shelter: the walk to it shorter, a change there as long as before, so only the catchments tell, from the
    // plans as they were (after the penalty, its line's catchments would be worked out afresh anyway).
    check(base);
    check(at(2, { walkBonusMin: base[2]!.stops.map((_, q) => (q === 1 ? STOP_TIERS[2].walkBonusMin : (base[2]!.walkBonusMin?.[q] ?? 0))) }));
    // Only the pairs with an end that walks to a Shelter are worked out afresh. A Station changes a change's penalty there as well,
    // which reaches every pair that changes lines at that stop, near it or not: at the third line's first stop, where riders change.
    check(base);
    const tierAt = (plan: LinePlan, q: number, tier: 2 | 3): LinePlan => ({
      ...plan,
      walkBonusMin: plan.stops.map((_, r) => (r === q ? STOP_TIERS[tier].walkBonusMin : (plan.walkBonusMin?.[r] ?? 0))),
      transferPenaltyMin: plan.stops.map((_, r) => (r === q ? STOP_TIERS[tier].transferPenaltyMin : (plan.transferPenaltyMin?.[r] ?? 6))),
    });
    check(base.map((p, m) => (m === 2 ? tierAt(p, 0, 3) : p)));
    check(base);
    // A line of five stops along the first line's two, its middle stops made Shelters one by one and two at once, each as the
    // fourth line's second stop is made one too: every other line here has two stops, so no Shelter of theirs tells a cell's or a
    // group's other stops from its first.
    const [a, b] = base[0]!.stops as readonly [XY, XY];
    const along = [0, 0.25, 0.5, 0.75, 1];
    const five: LinePlan = {
      ...base[0]!,
      id: 97 as LineId,
      stops: along.map((f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] as const),
      stopDistM: along.map((f) => f * base[0]!.stopDistM[1]!),
      walkBonusMin: along.map(() => 0),
      transferPenaltyMin: along.map(() => 6),
    };
    const withFive = [...base, five];
    check(withFive);
    for (const stops of [[1], [2], [3], [2, 3]]) {
      check(withFive.map((p, m) => (p === five ? stops.reduce((plan, q) => tierAt(plan, q, 2), p) : m === 3 ? tierAt(p, 1, 2) : p)));
      check(withFive);
    }
    check(base);
    // A plan edited in place between assignments, as nothing in the game does: the memo compares copies of what it kept, not the
    // plans themselves, so a walk bonus or a headway changed in place is told as one changed in a new plan.
    const edited = base.map((p) => ({ ...p, headways: { ...p.headways }, walkBonusMin: p.stops.map((_, q) => p.walkBonusMin?.[q] ?? 0) }));
    check(edited);
    edited[2]!.walkBonusMin[1] = STOP_TIERS[2].walkBonusMin;
    check(edited);
    edited[2]!.headways.peak = 1_800;
    check(edited);
    check(base);
    check(at(4, { rush: 0.5 }));
    // A line gone and back, and one more drawn beside the first.
    check(base.filter((_, m) => m !== 2));
    check(base);
    check([...base, { ...base[0]!, id: 99 as LineId, stops: base[0]!.stops.map(([x, y]) => [x + 200, y + 150] as const) }]);
    // A twin of the first line, the same plan under another id: it uses the first line's ride tables, and a change onto it or off
    // it the same tables as one onto or off the first line.
    check([...base, { ...base[0]!, id: 98 as LineId }]);
    check(base);
    // Two lines in the other order, as nothing in the game does yet: the memo starts again rather than add in another order.
    check([base[1]!, base[0]!, ...base.slice(2)]);
    check(base);
    // A festival round the second line's middle stop, and back: the trips of the pairs near it change, and only those pairs are
    // worked out afresh; then one that starts as a line changes, both at once.
    const festival = festivalAt(world, base[1]!.stops[Math.floor(base[1]!.stops.length / 2)]!);
    expect(festival.flow).not.toEqual(world.commuters.flow);
    check(base, festival);
    check(base);
    check(at(0, { headways: { ...base[0]!.headways, peak: 1_800, offpeak: 2_400 } }), festival);
    check(base);
    // Every pair's trips half again, and back; and other distances between the cells, with which the memo starts again.
    check(base, { ...world.commuters, flow: world.commuters.flow.map((v) => v * 1.5) });
    check(base);
    check(base, { ...world.commuters, km: world.commuters.km.map((v) => v * 1.1) });
    check(base);
    check(base);
  });

  it('carries again the home cells no changed line has a route from, and works out the rest afresh', () => {
    const world = grownCompany(5, 500_000_000);
    const plans = runningPlans(world);
    const n = world.commuters.n;
    const memo: AssignMemo = { last: null };
    assign(world.city, world.commuters, plans, { memo });
    expect(memo.last!.freshCells).toBe(n);
    const whole = memo.last!.freshPairs;
    const slower = plans.map((p, m) => (m === 4 ? { ...p, headways: { ...p.headways, peak: 1_800 } } : p));
    assign(world.city, world.commuters, slower, { memo });
    expect(memo.last!.freshCells).toBeGreaterThan(0);
    expect(memo.last!.freshCells).toBeLessThan(n);
    // Nothing changed: every cell is carried again. The two arenas take turns, so nothing more is allocated, a whole assignment
    // after the memo is let go too.
    const [first, second] = memo.arenas!;
    expect(memo.arenas!.length).toBe(2);
    const was = memo.last!.arena;
    assign(world.city, world.commuters, slower, { memo });
    expect(memo.last!.freshCells).toBe(0);
    expect(memo.last!.arena).toBe(was === first ? second : first);
    memo.last = null;
    assign(world.city, world.commuters, plans, { memo });
    expect(memo.last!.freshCells).toBe(n);
    expect(memo.last!.freshPairs).toBe(whole);
    expect(memo.arenas).toEqual([first, second]);
    // A festival's start and end change the trips of the pairs near it alone: those are worked out afresh, the rest carried.
    const festival = festivalAt(world, plans[1]!.stops[Math.floor(plans[1]!.stops.length / 2)]!);
    assign(world.city, festival, plans, { memo });
    const near = memo.last!.freshPairs;
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(whole);
    assign(world.city, world.commuters, plans, { memo });
    expect(memo.last!.freshPairs).toBe(near);
    // A Sign made a Shelter works out afresh only the pairs with an end that walks to it: fewer than its line's headways do.
    const shelter = plans.map((p, m) => (m === 2 ? { ...p, walkBonusMin: p.stops.map((_, q) => (q === 1 ? STOP_TIERS[2].walkBonusMin : (p.walkBonusMin?.[q] ?? 0))) } : p));
    assign(world.city, world.commuters, shelter, { memo });
    const nearStop = memo.last!.freshPairs;
    assign(world.city, world.commuters, plans, { memo });
    expect(memo.last!.freshPairs).toBe(nearStop);
    assign(world.city, world.commuters, plans.map((p, m) => (m === 2 ? { ...p, headways: { ...p.headways, peak: 1_800 } } : p)), { memo });
    expect(nearStop).toBeGreaterThan(0);
    expect(nearStop).toBeLessThan(memo.last!.freshPairs);
  });
});
