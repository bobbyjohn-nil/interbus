import { describe, expect, it } from 'vitest';
import type { LineView, LngLatPair } from '../../sim/types';
import { BUS_FLOATS, Fleet } from './fleet';
import { placesOf } from './sides';

// The debug line laid straight east (sim/rules/position.test.ts), as the worker would send it.
const LAT = 42.35;
const M_LON = 111_320 * Math.cos((LAT * Math.PI) / 180);
const east = (m: number): LngLatPair => [-71.1 + m / M_LON, LAT];
function line(buses = 2): LineView {
  return {
    id: 1,
    name: 'Line 1',
    colour: '#c0392b',
    stops: [east(0), east(1_339), east(2_425), east(3_535)],
    stopIds: [1, 2, 3, 4],
    route: [east(0), east(1_339), east(2_425), east(3_535)],
    stopAt: [0, 1, 2, 3],
    stopDistM: [0, 1_339, 2_425, 3_535],
    pullOut: [[-71.1, LAT - 0.01], east(0)],
    pullIn: [east(0), [-71.1, LAT - 0.01]],
    plan: { timing: { cycle: 1_539, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses }, oneWayS: 529.5, pullOutS: 166, pullInS: 208 },
    ridersPerDay: 750,
    fareCents: 225,
    turnedAwayPerDay: 0,
    fullAtMinute: null,
    headways: { peak: 1_200, offpeak: 1_200, overnight: null },
    cycle: 1_539,
    cycles: { peak: 1_539, offpeak: 1_539, overnight: 1_539 },
    rush: 0,
    worksM: 0,
    settling: null,
    buses,
    model: 'sparrow',
  };
}

describe('the fleet the vehicle layer draws', () => {
  it('draws each line’s buses in its colour at the clock’s second', () => {
    const fleet = new Fleet();
    fleet.setLines([line()]);
    fleet.setClock(12 * 3_600, 0, 1_000);
    const { count, data } = fleet.frame(5_000);
    expect(count).toBe(2);
    expect([...data.subarray(3, 6)].map((v) => Math.round(v * 255))).toEqual([0xc0, 0x39, 0x2b]);
    for (let i = 0; i < count; i++) expect(data[BUS_FLOATS * i + 1]).toBeCloseTo(LAT, 6);
  });

  // Lines on a street they share stand side by side (sides.ts), and so do their buses: each rides its own line's ribbon, its
  // side to the right of the way it drives, where the buses of two lines drove over one another in the street's middle.
  it('stands each bus on its line’s ribbon, either side of the street’s middle where two lines share it, and in the middle alone', () => {
    const together = new Fleet();
    together.setLines([line(), { ...line(), id: 2, name: 'Line 2' }]);
    together.setClock(12 * 3_600, 0, 1_000);
    const { count, data } = together.frame(5_000);
    expect(count).toBe(4);
    // Each bus's side of the street itself, as it drives east (90°) or back west: Line 1's two buses first, then Line 2's.
    const ofStreet = Array.from({ length: count }, (_, i) => data[BUS_FLOATS * i + 8]! * (Math.abs(data[BUS_FLOATS * i + 2]! - 90) < 1 ? 1 : -1));
    expect(new Set(ofStreet.map(Math.abs))).toEqual(new Set([0.5]));
    expect([ofStreet[1], ofStreet[2], ofStreet[3]]).toEqual([ofStreet[0], -ofStreet[0]!, -ofStreet[0]!]);
    // Both ways along the route at noon, so a bus driving back stands on the same side of the street as one driving out.
    expect(new Set(Array.from({ length: count }, (_, i) => Math.round(data[BUS_FLOATS * i + 2]!))).size).toBe(2);
    const alone = new Fleet();
    alone.setLines([line()]);
    alone.setClock(12 * 3_600, 0, 1_000);
    const one = alone.frame(5_000);
    expect(Array.from({ length: one.count }, (_, i) => one.data[BUS_FLOATS * i + 8])).toEqual([0, 0]);
  });

  it('runs the clock on between snapshots at the sim’s rate, never more than a quarter-second ahead', () => {
    const fleet = new Fleet();
    fleet.setLines([line()]);
    fleet.setClock(43_200, 600, 1_000);
    expect(fleet.secondAt(1_100)).toBeCloseTo(43_260, 6);
    expect(fleet.secondAt(9_000)).toBeCloseTo(43_350, 6);
    fleet.setClock(86_390, 600, 0);
    expect(fleet.secondAt(100)).toBeCloseTo(50, 6); // past midnight, into the next day
  });

  // And only while a bus is drawn: with every bus parked, as overnight off, it asked for 25–28 frames a second of nothing new in a
  // small window (the systems audit's twenty-first round), and a snapshot that finds a bus out starts it again. Shown failing
  // (TS-04) with the frames asked for whenever a line exists.
  it('asks for frames only while the clock runs and a bus is drawn (I14)', () => {
    const fleet = new Fleet();
    fleet.setLines([line()]);
    fleet.setClock(43_200, 0, 0);
    expect(fleet.running).toBe(false); // paused
    fleet.setClock(43_200, 600, 0);
    expect(fleet.running).toBe(true);
    // 02:00 on day 3, overnight off: every bus parked, by the snapshot's clock and by a frame's.
    fleet.setClock(2 * 3_600, 600, 0, 3);
    expect(fleet.running).toBe(false);
    expect(fleet.frame(100).count).toBe(0);
    expect(fleet.running).toBe(false);
    // The day's first bus out by a snapshot's clock, then parked by a frame's: the last at noon goes home at 00:05 on day 3.
    fleet.setClock(5 * 3_600 + 10, 600, 0, 3);
    expect(fleet.running).toBe(true);
    fleet.setClock(4 * 60 + 30, 600, 0, 3);
    expect(fleet.running).toBe(true);
    expect(fleet.frame(250).count).toBe(0); // 150 game seconds on
    expect(fleet.running).toBe(false);
    fleet.setClock(43_200, 600, 0);
    fleet.setLines([line(0)]);
    expect(fleet.running).toBe(false);
    expect(fleet.frame(0).count).toBe(0);
  });
});

// The systems audit's eleventh round: a line resting at 00:00 while its buses ran its last trips (overlays.ts restingLines).
describe('a line’s buses in service', () => {
  it('are out on its trips until the last is back at its first stop, at the last snapshot’s clock', () => {
    const fleet = new Fleet();
    fleet.setLines([line()]);
    // The 23:40's run back reaches the first stop at 00:01:39.
    fleet.setClock(60, 600, 0, 3);
    expect(fleet.inService(1)).toBe(true);
    fleet.setClock(100, 600, 0, 3);
    expect(fleet.inService(1)).toBe(false);
    fleet.setClock(5 * 3_600, 600, 0, 3);
    expect(fleet.inService(1)).toBe(true);
    // A line it draws no plan for has none.
    expect(fleet.inService(2)).toBe(false);
    fleet.setLines([line(0)]);
    expect(fleet.inService(1)).toBe(false);
  });

  it('count a settling line’s seconds from its frame’s day, as its buses are drawn', () => {
    const fleet = new Fleet();
    // Every 20 minutes cut to every 10 at 23:00 on day 2: its merged plan's frame counts from day 2's midnight and hands over to
    // the new day plan at 23:20, whose 23:50 is back at its first stop at 00:11:39. Read by day 3's own seconds instead, 00:05 would
    // fall in the merged plan, on day 2 at 00:05, with no bus out.
    const was = line();
    const now = { ...was, plan: { ...was.plan, timing: { ...was.plan.timing, headways: { peak: 600, offpeak: 600, overnight: null }, buses: 3 } } };
    const { route, stopAt, stopDistM, pullOut, pullIn } = was;
    fleet.setLines([{ ...now, settling: { frameDay: 2, earlier: [{ plan: was.plan, until: 23 * 3_600, sameModel: true, sameStart: true, route, stopAt, stopDistM, pullOut, pullIn }] } }]);
    fleet.setClock(5 * 60, 600, 0, 3);
    expect(fleet.inService(1)).toBe(true);
    fleet.setClock(12 * 60, 600, 0, 3);
    expect(fleet.inService(1)).toBe(false);
  });

  // The earlier versions of a settling line's route a bus still drives (Fleet.onEarlier), whose places loadMap.ts holds (standLines;
  // the systems audit's twenty-first round), and that bus standing at its line's place on that route. Stood without it, the street
  // re-centred under the bus, which stepped across onto the other line's ribbon. #202's review: the earlier test stood a plain
  // line instead, so no bus on an earlier route was ever drawn. Shown failing (TS-04) with the earlier routes' sides left at 0.
  // #203's review: a bus back at its first stop from its last trip on the route as it was, waiting there for its next departure on
  // the route as it is, stood on the old route and held its place among the lines as long as it waited, 1,095 game seconds after a
  // change at 12:00 on this line every 20 minutes. It waits on the route of the trip it waits for now (position.ts place), as a bus
  // carries on to another version of the route only where its first stop stayed (transition.ts merge), so it stands where it did.
  // Shown failing (TS-04) with a waiting bus on its last trip's route.
  it('names the earlier routes a settling line’s buses still drive, and stands such a bus at its line’s place there', () => {
    const fleet = new Fleet();
    const was = line();
    // The first stop kept, the rest of the route on a street to the north, as the line's buses carry on only with the first stop
    // kept (world.ts sameStart).
    const north = (ps: readonly LngLatPair[]): LngLatPair[] => ps.map((p, k) => (k === 0 ? p : [p[0], p[1] + 0.002]));
    // Every 20 minutes on the old street, cut to every 10 on the new at 23:00 on day 2: the old route's last trip, the 22:40's, is
    // back at its first stop at 23:01:39, and waits there for the 23:10 on the new route; the merged plan hands over at 23:20. Line
    // 2 drives the old street.
    const now = { ...was, route: north(was.route), stops: north(was.stops), plan: { ...was.plan, timing: { ...was.plan.timing, headways: { peak: 600, offpeak: 600, overnight: null }, buses: 3 } } };
    const { route, stopAt, stopDistM, pullOut, pullIn } = was;
    const settling = { ...now, settling: { frameDay: 2, earlier: [{ plan: was.plan, until: 23 * 3_600, sameModel: true, sameStart: true, route, stopAt, stopDistM, pullOut, pullIn }] } };
    const two = { ...was, id: 2, name: 'Line 2', colour: '#2471a3' };
    fleet.setLines([settling, two], null);
    fleet.setClock(23 * 3_600 + 60, 600, 0, 2);
    expect(fleet.onEarlier).toEqual([{ id: 1, version: 0 }]);
    expect(fleet.onEarlierKey).toBe('1:0;');
    // Held: Line 1's place on the old street beside Line 2, and its bus there on its own side of the middle.
    fleet.setPlaces(placesOf([settling, two, { id: 1, route }]));
    const { count, data } = fleet.frame(0);
    const onOld = Array.from({ length: count }, (_, i) => data.subarray(BUS_FLOATS * i, BUS_FLOATS * (i + 1))).filter((b) => Math.round(b[3]! * 255) === 0xc0 && Math.abs(b[1]! - LAT) < 1e-9);
    expect(onOld.length).toBeGreaterThan(0);
    for (const b of onOld) expect(Math.abs(b[8]!)).toBe(0.5);
    // Its last trip done, no bus drives it: let go as that bus waits at the first stop, where it stands as it did, though the
    // merged plan hands over only at 23:20.
    fleet.setClock(23 * 3_600 + 5 * 60, 600, 0, 2);
    expect(fleet.onEarlier).toEqual([]);
    expect(fleet.onEarlierKey).toBe('');
    const waiting = fleet.frame(0);
    const at = Array.from({ length: waiting.count }, (_, i) => [waiting.data[BUS_FLOATS * i]!, waiting.data[BUS_FLOATS * i + 1]!]);
    expect(at.some(([lon, lat]) => Math.abs(lon! - route[0]![0]) < 1e-9 && Math.abs(lat! - route[0]![1]) < 1e-9)).toBe(true);
    fleet.setClock(23 * 3_600 + 12 * 60, 600, 0, 2);
    expect(fleet.onEarlierKey).toBe('');
  });

  // The systems audit's twenty-second round: a bus home from its last trip on the route as it was held that route's place among the
  // lines until it was home, an empty place beside the lines on its streets for 130 to 310 game seconds after changes made from 23:15
  // to 23:45, as the night's last trips drive home. On its depot drive it drives no route. Shown failing (TS-04) with a bus on its
  // depot drive counted.
  it('lets an earlier route go as its last trip ends, while that bus drives home', () => {
    const fleet = new Fleet();
    const was = line();
    const north = (p: LngLatPair): LngLatPair => [p[0], p[1] + 0.002];
    const now = { ...was, route: was.route.map(north), stops: was.stops.map(north), pullOut: was.pullOut.map(north), pullIn: was.pullIn.map(north) };
    const { route, stopAt, stopDistM, pullOut, pullIn } = was;
    // Moved to a street to the north at 23:50 on day 2, its first stop too, so its buses go home after their trips there: the old
    // route's last trip, the 23:40's, is back at its first stop at 00:01:39, and its bus home at 00:05:07.
    fleet.setLines([{ ...now, settling: { frameDay: 2, earlier: [{ plan: was.plan, until: 23 * 3_600 + 50 * 60, sameModel: true, sameStart: false, route, stopAt, stopDistM, pullOut, pullIn }] } }], null);
    fleet.setClock(23 * 3_600 + 59 * 60, 600, 0, 2);
    expect(fleet.onEarlierKey).toBe('1:0;');
    // At 00:03 it drives home: drawn, but on no route.
    fleet.setClock(3 * 60, 600, 0, 3);
    expect(fleet.frame(0).count).toBe(1);
    expect(fleet.onEarlier).toEqual([]);
    expect(fleet.onEarlierKey).toBe('');
  });
});

