import { describe, expect, it } from 'vitest';
import type { LngLatPair } from '../../sim/types';
import { linesHere, placesAlong, placesOf, ribbonPx, runsOf, segmentOf, sidesAlong } from './sides';

// A street grid near Copley: x east, y north, a block 0.002° apart.
const P = (x: number, y: number): LngLatPair => [-71.08 + 0.002 * x, 42.35 + 0.002 * y];
const sides = (lines: { id: number; route: LngLatPair[] }[]) => {
  const places = placesOf(lines);
  return Object.fromEntries(lines.map((l) => [l.id, [...sidesAlong(places, l.id, l.route)]]));
};

describe('lines on a shared street, side by side', () => {
  it('keeps a line alone on its street to the middle', () => {
    expect(sides([{ id: 1, route: [P(0, 0), P(1, 0), P(2, 0), P(2, 1)] }])).toEqual({ 1: [0, 0, 0] });
  });

  it('stands two lines that drive a street the same way either side of its middle, and only there', () => {
    const one = { id: 1, route: [P(0, 0), P(1, 0), P(2, 0), P(3, 0)] };
    const two = { id: 2, route: [P(1, -1), P(1, 0), P(2, 0), P(2, 1)] };
    const s = sides([one, two]);
    expect(s[1]).toEqual([0, s[1]![1], 0]);
    expect(Math.abs(s[1]![1]!)).toBe(0.5);
    expect(s[2]).toEqual([0, -s[1]![1]!, 0]);
  });

  it('keeps each of two lines that drive a street opposite ways to its own right, so they stand apart', () => {
    const east = { id: 1, route: [P(0, 0), P(1, 0), P(2, 0)] };
    const west = { id: 2, route: [P(2, 0), P(1, 0), P(0, 0)] };
    // Each to the right of the way it runs: on the street, opposite sides of its middle.
    expect(sides([east, west])).toEqual({ 1: [0.5, 0.5], 2: [0.5, 0.5] });
  });

  it('keeps two lines in one order all along the streets they share, whichever way each segment’s ends are taken', () => {
    // Up and over: the first segment's lesser end is its start, the second's its end, for both lines.
    const route = [P(0, 0), P(0, 1), P(1, 1), P(2, 1)];
    expect(segmentOf(route[0]!, route[1]!)!.along).not.toBe(segmentOf(route[1]!, route[2]!)!.along);
    const s = sides([
      { id: 4, route },
      { id: 9, route: [...route] },
    ]);
    expect(new Set(s[4])).toEqual(new Set([s[4]![0]]));
    expect(s[9]).toEqual(s[4]!.map((x) => -x));
    // And driving the other way, the second line keeps the first on the same side of the street.
    const back = sides([
      { id: 4, route },
      { id: 9, route: [...route].reverse() },
    ]);
    expect(new Set(back[4])).toEqual(new Set([back[4]![0]]));
    expect(new Set(back[9])).toEqual(new Set([back[9]![0]]));
  });

  it('moves the lines half a ribbon over where a third joins, keeping the order of the two', () => {
    const one = { id: 1, route: [P(0, 0), P(1, 0), P(2, 0), P(3, 0)] };
    const two = { id: 2, route: [P(0, 0), P(1, 0), P(2, 0), P(3, 0)] };
    const three = { id: 3, route: [P(1, -1), P(1, 0), P(2, 0), P(3, 0)] };
    const s = sides([one, two, three]);
    // Before it joins, the two stand ±0.5; after, the three stand -1, 0 and 1, in the order of their ids.
    expect([s[1]![0], s[2]![0]]).toEqual([-0.5, 0.5]);
    expect([s[1]![1], s[2]![1], s[3]![1]]).toEqual([-1, 0, 1]);
    expect(Math.sign(s[2]![1]! - s[1]![1]!)).toBe(Math.sign(s[2]![0]! - s[1]![0]!));
  });

  it('gives a line that drives a segment out and back a place each way, and stands a segment of no length in the middle', () => {
    const route = [P(0, 0), P(1, 0), P(1, 0), P(0, 0)];
    const s = sides([{ id: 1, route }, { id: 2, route: [P(0, 0), P(1, 0)] }]);
    // Three places on the block, Line 1's two and Line 2's, each to the right of its own way; across the street from south to
    // north (the right of east): Line 2's, Line 1's way out and Line 1's way back.
    const east = (side: number, eastward: boolean) => (eastward ? side : -side);
    expect(s[1]![1]).toBe(0);
    expect([east(s[2]![0]!, true), east(s[1]![0]!, true), east(s[1]![2]!, false)]).toEqual([1, 0, -1]);
  });

  // A line that turns back kept one place on the segments it drives both ways, the first way's, so on its way back it swapped
  // sides with a line beside it where it turned (the change's review, at 18 places on a late game of 30 lines). Shown failing
  // (TS-04) with a line's one place a segment.
  it('keeps a line on its way back in one order with a line beside it, past the point where it turned back', () => {
    // Line 2 runs east from X1 to X3 and back west to X0, so it drives X1–X2 both ways; Line 1 runs east from X0 to X2.
    const back = { id: 2, route: [P(1, 0), P(2, 0), P(3, 0), P(2, 0), P(1, 0), P(0, 0)] };
    const on = { id: 1, route: [P(0, 0), P(1, 0), P(2, 0)] };
    const s = sides([on, back]);
    // Each one's side of the street to the right of east, on its segments X0–X1 and X1–X2.
    const backX1X2 = -s[2]![3]!;
    const backX0X1 = -s[2]![4]!;
    expect(Math.sign(backX0X1 - s[1]![0]!)).toBe(Math.sign(backX1X2 - s[1]![1]!));
  });

  it('stands an earlier route’s segments the line no longer drives in the middle', () => {
    const places = placesOf([{ id: 1, route: [P(0, 0), P(1, 0)] }, { id: 2, route: [P(0, 0), P(1, 0)] }]);
    expect([...sidesAlong(places, 1, [P(0, 0), P(1, 0), P(1, 1)])]).toEqual([-0.5, 0]);
  });

  it('cuts a route where its side changes, each run sharing its ends with the next', () => {
    const route = [P(0, 0), P(1, 0), P(2, 0), P(3, 0), P(4, 0)];
    const runs = runsOf(route, new Float32Array([0, 0.5, 0.5, 0]));
    expect(runs).toEqual([
      { points: [P(0, 0), P(1, 0)], side: 0, first: 0, last: 0 },
      { points: [P(1, 0), P(2, 0), P(3, 0)], side: 0.5, first: 1, last: 2 },
      { points: [P(3, 0), P(4, 0)], side: 0, first: 3, last: 3 },
    ]);
    expect(runsOf([P(0, 0)], new Float32Array(0))).toEqual([]);
  });
});

describe('a click on lines side by side', () => {
  // On screen, x east and y south, a block 200 px, and a ribbon 7 px, as at zoom 16.
  const project = (p: LngLatPair): [number, number] => [((p[0] + 71.08) / 0.002) * 200, ((42.35 - p[1]) / 0.002) * 200];
  const RIBBON = ribbonPx(16);

  // Each line by how far its own ribbon lies from the click: listed as MapLibre found them, a click in the middle of Line 2's
  // ribbon put Line 5 first (the systems audit's twenty-first round). Shown failing (TS-04) with the lines in their places'
  // order, as the click took them in before.
  it('takes in every line on the segment clicked, those beyond the click too, the line whose ribbon is nearest first', () => {
    const lines = [1, 2, 3, 4].map((id) => ({ id, route: [P(0, 0), P(1, 0), P(2, 0)] }));
    const places = placesOf(lines);
    // East along the block, Line 1 stands furthest north and Line 4 furthest south, a ribbon apart.
    expect(lines.map((l) => sidesAlong(places, l.id, l.route)[0])).toEqual([-1.5, -0.5, 0.5, 1.5]);
    // A click a pixel north of Line 2's ribbon, halfway along the first block: then Line 1, Line 3 and Line 4 by their ribbons.
    expect(linesHere(places, lines, [{ id: 2 }], [100, -0.5 * RIBBON - 1], project, RIBBON)).toEqual([2, 1, 3, 4]);
    // And on Line 4's: 4 px off the street's middle reaches none but its neighbour.
    expect(linesHere(places, lines, [{ id: 4 }], [100, 1.5 * RIBBON], project, RIBBON)).toEqual([4, 3, 2, 1]);
  });

  it('takes the segment of the hit line nearest the click, so at a corner only the lines on the street clicked', () => {
    const turn = { id: 1, route: [P(0, 0), P(1, 0), P(1, 1)] };
    const straight = { id: 2, route: [P(0, 0), P(1, 0), P(2, 0)] };
    const north = { id: 3, route: [P(1, -1), P(1, 0), P(1, 1)] };
    const lines = [turn, straight, north];
    const places = placesOf(lines);
    // Near the corner, a little way up the block north of it, and a little way along the block west of it.
    expect(linesHere(places, lines, [{ id: 1 }], project(P(1, 0.1)), project, RIBBON).sort()).toEqual([1, 3]);
    expect(linesHere(places, lines, [{ id: 1 }], project(P(0.9, 0)), project, RIBBON).sort()).toEqual([1, 2]);
  });

  // A click at a corner on a line alone, where it turns into a street other lines share, touched both its runs, and the lines of
  // the street round the corner were listed too, though none had a ribbon within 8 px (the systems audit's twenty-first round).
  // Only the run whose ribbon lies nearest counts. Shown failing (TS-04) with every hit run's nearest segment taken in.
  it('takes the lines of the run whose ribbon lies nearest the click, of all the runs it hit', () => {
    const four = { id: 4, route: [P(0, 0), P(1, 0), P(1, 1)] };
    const six = { id: 6, route: [P(1, -1), P(1, 0), P(1, 1)] };
    const nine = { id: 9, route: [P(1, -1), P(1, 0), P(1, 1)] };
    const lines = [four, six, nine];
    const places = placesOf(lines);
    const runs = runsOf(four.route, sidesAlong(places, 4, four.route));
    expect(runs.map((r) => r.side)).toEqual([0, expect.any(Number)]);
    // On Line 4's ribbon, alone on its block, 20 px before the corner: both its runs hit.
    const at: [number, number] = [200 - 20, 1];
    const hits = runs.map((r) => ({ id: 4, first: r.first, last: r.last }));
    expect(linesHere(places, lines, hits, at, project, RIBBON)).toEqual([4]);
  });

  // The nearest segment of the whole route, by the street's middle: on the ribbon of a line that turns toward its side, a few
  // pixels before the corner, the street it turns into was nearer, and the click listed it alone (the change's review). Only the
  // run the map hit counts now. Shown failing (TS-04) with the hit run's segments taken as the whole route's.
  it('takes the segment of the run the map hit, on a ribbon by a corner where its line turns toward its side', () => {
    // Lines 1 to 3 east along the block, and Line 4, south of them, turning south at its end onto a street of its own.
    const lines = [...[1, 2, 3].map((id) => ({ id, route: [P(0, 0), P(1, 0), P(2, 0)] })), { id: 4, route: [P(0, 0), P(1, 0), P(1, -1)] }];
    const places = placesOf(lines);
    expect([...sidesAlong(places, 4, lines[3]!.route)]).toEqual([1.5, 0]);
    // At zoom 16 Line 4's ribbon stands 10.5 px south of the block's middle: a click on it 6 px before the corner is nearer the
    // middle of the street it turns into than the block's, and the map hits the block's run alone.
    const at: [number, number] = [194, 1.5 * ribbonPx(16) + 1.5];
    const [run] = runsOf(lines[3]!.route, sidesAlong(places, 4, lines[3]!.route));
    expect(linesHere(places, lines, [{ id: 4, first: run!.first, last: run!.last }], at, project, RIBBON)).toEqual([4, 3, 2, 1]);
  });

  it('takes a line alone on its street alone, and nothing for a line no longer there', () => {
    const lines = [{ id: 1, route: [P(0, 0), P(1, 0)] }];
    expect(linesHere(placesOf(lines), lines, [{ id: 1 }], project(P(0.5, 0)), project, RIBBON)).toEqual([1]);
    expect(linesHere(placesOf(lines), lines, [{ id: 7 }], project(P(0.5, 0)), project, RIBBON)).toEqual([]);
  });
});

describe('the places on a street', () => {
  it('counts each segment’s places, a line that drives it both ways twice, and none where no line drives', () => {
    const lines = [
      { id: 1, route: [P(0, 0), P(1, 0), P(2, 0)] },
      { id: 2, route: [P(1, 0), P(2, 0), P(1, 0)] },
    ];
    expect([...placesAlong(placesOf(lines), [P(0, 0), P(1, 0), P(2, 0), P(3, 0)])]).toEqual([1, 3, 0]);
  });
});
