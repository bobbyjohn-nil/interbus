// The game's layers (D25): no contract rings, and each kind of demand dot shown or hidden on its own; and, for shape beside
// colour (PLAN §8), each line named along its route and jobs ringed where homes are filled. Shown failing (TS-04) on the old
// overlays: three contract layers, one flag setting both dot layers, and lines and dots told apart by colour alone.
import { describe, expect, it } from 'vitest';
import { createExpression, latest } from '@maplibre/maplibre-gl-style-spec';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { addOverlays, setDotKinds, setDraft, setEvent, setLines, wordsOf } from './overlays';
import { placesOf } from './sides';
import { ringExpressions } from './pick';
import type { EventView, LineDraftView, LineView, LngLatPair, StopView } from '../../sim/types';
import { FONT_STACKS } from './style';
import { GAME_LIGHT, LIGHT } from './tokens';

interface Layer {
  readonly id: string;
  readonly type: string;
  readonly filter?: unknown;
  readonly layout?: Record<string, unknown>;
  readonly paint?: Record<string, unknown>;
}

function fakeMap() {
  const sources: string[] = [];
  const layers: string[] = [];
  const specs = new Map<string, Layer>();
  const layout = new Map<string, unknown>();
  const data: unknown[] = [];
  const map = {
    addSource: (id: string) => void sources.push(id),
    addLayer: (layer: Layer) => {
      layers.push(layer.id);
      specs.set(layer.id, layer);
    },
    setLayoutProperty: (id: string, name: string, value: unknown) => void layout.set(`${id}.${name}`, value),
    getSource: () => ({ setData: (d: unknown) => void data.push(d) }),
  };
  return { map, sources, layers, specs, layout, data };
}

describe('the game layers', () => {
  it('draw no contract rings, and keep a festival’s street and the draft’s walk rings', () => {
    const { map, sources, layers } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    expect([...sources, ...layers].filter((id) => id.includes('contract'))).toEqual([]);
    expect(layers).toEqual(expect.arrayContaining(['event-pending', 'event-on', 'draft-rings', 'dots-homes', 'dots-jobs']));
  });

  it('show or hide homes and jobs each on its own', () => {
    const { map: fake, layout } = fakeMap();
    const map = fake as unknown as MapLibreMap;
    setDotKinds(map, { home: false, job: true });
    expect(layout.get('dots-homes.visibility')).toBe('none');
    expect(layout.get('dots-jobs.visibility')).toBe('visible');
    setDotKinds(map, { home: true, job: false });
    expect(layout.get('dots-homes.visibility')).toBe('visible');
    expect(layout.get('dots-jobs.visibility')).toBe('none');
  });

  it('name each line along its route where it has room, in the labels’ ink, under the stops and their flags', () => {
    const { map, specs, data } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const names = specs.get('lines-name')!;
    expect(names.type).toBe('symbol');
    expect(names.filter).toEqual(['all', ['==', ['get', 'kind'], 'name'], ['!', ['in', ['get', 'id'], ['literal', []]]]]);
    expect(names.layout).toMatchObject({ 'symbol-placement': 'line', 'text-field': ['get', 'label'] });
    expect(names.layout!['text-size']).toBeGreaterThanOrEqual(12);
    expect(names.paint).toMatchObject({ 'text-color': LIGHT.label, 'text-halo-color': LIGHT.labelHalo });
    // Over the routes and under the stops and their flags, which it never covers (the review of shape beside colour).
    const { layers } = (() => {
      const f = fakeMap();
      addOverlays(f.map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
      return f;
    })();
    // Every name over every route, a resting line's faded copy of each just under the running lines' (daylight.test.ts), and a
    // resting line's stops under the running routes: opaque, they covered a running line's route where it passed them (the review
    // of the twelfth round's second lane).
    expect(layers.slice(layers.indexOf('lines-route-resting'), layers.indexOf('lines-name') + 1)).toEqual(['lines-route-resting', 'lines-stops-resting', 'lines-route', 'lines-name-resting', 'lines-name']);
    for (const under of ['lines-stops', 'stops-lone', 'stops-flag-ring-resting', 'stops-flag-ring', 'stops-flag-word-resting', 'stops-flag-word']) expect(layers.indexOf('lines-name')).toBeLessThan(layers.indexOf(under));
    // The name runs along each of the route's runs, at its place, as the runs carry the line's colour and place (sides.ts).
    const line = { id: 2, name: 'Line 2', colour: '#2471a3', route: [[-71.08, 42.35], [-71.09, 42.34]], stops: [], stopIds: [] } as unknown as LineView;
    setLines(map as unknown as MapLibreMap, [line], [] as StopView[]);
    const features = (data[0] as { features: { properties: Record<string, unknown>; geometry: { coordinates: unknown } }[] }).features;
    const name = features.find((f) => f.properties.kind === 'name')!;
    expect(name.properties).toMatchObject({ name: 'Line 2', id: 2, side: 0 });
    expect((name.properties.label as string).trim()).toBe('Line 2');
    expect(name.geometry.coordinates).toEqual(line.route);
    expect(features.find((f) => f.properties.kind === 'route')!.properties).toMatchObject({ colour: '#2471a3', id: 2, side: 0 });
  });

  // The names sat in the street's middle, over another line's ribbon: on Tremont Street, Lines 2, 5 and 9 side by side, every
  // name stood over Line 5's, Line 2's 9.8 px from its own (the systems audit's twenty-first round). Each name runs along its
  // line's runs now, offset as its ribbon is. Shown failing (TS-04) on 409570e, whose names had no side and no offset.
  it('stand each line’s name on its own ribbon where lines share a street', () => {
    const { map, specs, data } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const route: LngLatPair[] = [
      [-71.08, 42.35],
      [-71.078, 42.35],
    ];
    const lines = [2, 5, 9].map((id) => ({ id, name: `Line ${id}`, colour: '#2471a3', route, stops: [], stopIds: [] }) as unknown as LineView);
    setLines(map as unknown as MapLibreMap, lines, [] as StopView[]);
    const features = (data[0] as { features: { properties: Record<string, unknown> }[] }).features;
    const sideOf = (kind: string, id: number) => features.find((f) => f.properties.kind === kind && f.properties.id === id)!.properties.side;
    for (const id of [2, 5, 9]) expect(sideOf('name', id)).toBe(sideOf('route', id));
    expect(new Set([2, 5, 9].map((id) => sideOf('name', id)))).toEqual(new Set([-1, 0, 1]));
    // Across by its side times a ribbon, in ems of the 12 px words, half a zoom ahead of the ribbon (nameOffset): MapLibre works it
    // out at each tile's whole zoom, so at zoom 12 it is the ribbon's at 12.5, and from 16 on the ribbon's own, 7 px a place.
    const made = createExpression(specs.get('lines-name')!.layout!['text-offset'], latest.layout_symbol['text-offset'] as never);
    if (made.result !== 'success') throw new Error(made.value.map((e) => e.message).join('; '));
    const offset = (zoom: number, side: number) => made.value.evaluate({ zoom }, { type: 'LineString', properties: { side } } as never) as number[];
    const ribbon = (zoom: number) => 3 + 4 * Math.min(1, Math.max(0, (zoom - 12) / 4));
    expect(offset(16, 1)[0]).toBe(0);
    expect(offset(16, 1)[1]).toBeCloseTo(7 / 12, 9);
    expect(offset(16, -1.5)[1]).toBeCloseTo((-1.5 * 7) / 12, 9);
    for (const zoom of [11, 12, 13, 14, 15]) expect(offset(zoom, 2.5)[1]).toBeCloseTo((2.5 * ribbon(zoom + 0.5)) / 12, 9);
    expect(offset(14, 0)[1]).toBeCloseTo(0, 9);
    // Out to 16 places, more than any street holds.
    expect(offset(16, 12)[1]).toBeCloseTo((12 * 7) / 12, 9);
  });

  // #201's review: MapLibre joins the lines of line labels that share their words and an end before it places them (merge_lines.ts,
  // keyed by the words and the point), keeping the first one's properties, so a line's names, run by run end to end, stood at
  // whichever run came first in a tile: 62% of the names' cells off their own run's place on the second company at zoom 14. Stopped
  // short of their ends, a run that turned back along the street it came in on still met the next at one point, and Line 2's name
  // stood 14 px off its ribbon at Haymarket; and a tile's edge across a street a line drives both ways is an end both its runs there
  // share (the systems audit's twenty-second round). Each run's name has words of its own now, the line's name and as many spaces
  // as the run's count, which MapLibre trims as it lays them out. Shown failing (TS-04) with the line's name alone, as before.
  it('give each run’s name words of its own, the line’s name as it reads, so MapLibre joins no two of a line’s names', () => {
    const { map, data } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const P = (x: number): LngLatPair => [-71.08 + 0.002 * x, 42.35];
    // Line 1 alone on the first block, beside Line 2 on the next two, then back west half a block alone: three runs of its route, by
    // its place there, the second and third meeting where it turns back.
    const lines = [
      { id: 1, name: 'Line 1', colour: '#2471a3', route: [P(0), P(1), P(2), P(3), P(2.5)], stops: [], stopIds: [] },
      { id: 2, name: 'Line 2', colour: '#1e8449', route: [P(1), P(2), P(3)], stops: [], stopIds: [] },
    ] as unknown as LineView[];
    setLines(map as unknown as MapLibreMap, lines, [] as StopView[]);
    const names = (data[0] as { features: { properties: Record<string, unknown>; geometry: { coordinates: LngLatPair[] } }[] }).features.filter((f) => f.properties.kind === 'name');
    const ofLine1 = names.filter((f) => f.properties.id === 1);
    expect(ofLine1.map((f) => f.properties.side)).toEqual([0, -0.5, 0]);
    // Each along its whole run, ends and all, and each in words of its own that read as the line's name once trimmed.
    expect(ofLine1.map((f) => f.geometry.coordinates)).toEqual([[P(0), P(1)], [P(1), P(2), P(3)], [P(3), P(2.5)]]);
    const labels = names.map((f) => f.properties.label as string);
    expect(new Set(labels).size).toBe(names.length);
    for (const f of names) expect((f.properties.label as string).trim()).toBe(f.properties.name);
  });

  // MapLibre knows a label from one layout to the next by its words, and fades in one it does not know. By the run's count along
  // the route, a run cut in two or joined to the next earlier on the line, as another line joined or left a street, a line closed
  // or a settling line let its old route go, gave each run after it new words, and their names went out and came back: 5 of 14
  // cells of names out for 2 or 3 frames as Line 10 closed on the second company (the systems audit's twenty-third round). Shown
  // failing (TS-04) with the run's count.
  it('keep each run’s words where another line cuts or joins a run of the line before it', () => {
    const { map, data } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const P = (x: number): LngLatPair => [-71.08 + 0.002 * x, 42.35];
    const line = (id: number, route: LngLatPair[]) => ({ id, name: `Line ${id}`, colour: '#2471a3', route, stops: [], stopIds: [] });
    // Line 1 alone on two blocks, then beside Line 2 on two more; then Line 3 comes onto the first block too, cutting Line 1's first run.
    const labels = (lines: ReturnType<typeof line>[]) => {
      const from = data.length;
      setLines(map as unknown as MapLibreMap, lines as unknown as LineView[], [] as StopView[]);
      const names = (data[from] as { features: { properties: Record<string, unknown> }[] }).features.filter((f) => f.properties.kind === 'name' && f.properties.id === 1);
      return new Map(names.map((f) => [f.properties.first as number, f.properties.label as string]));
    };
    const [line1, line2] = [line(1, [P(0), P(1), P(2), P(3), P(4)]), line(2, [P(2), P(3), P(4)])];
    const before = labels([line1, line2]);
    const cut = labels([line1, line2, line(3, [P(0), P(1)])]);
    expect([...before.keys()]).toEqual([0, 2]);
    expect([...cut.keys()]).toEqual([0, 1, 2]);
    expect(cut.get(2)).toBe(before.get(2));
    expect(new Set(cut.values()).size).toBe(3);
    // And back: Line 3 gone, the run beside Line 2 keeps its words.
    expect(labels([line1, line2]).get(2)).toBe(before.get(2));
  });

  // The twenty-fourth round: a run's words carried the segment of the route it starts at, and a stop taken off the line takes
  // points out of its route, so every run after it took new words though it lay where it lay, and their names went out and came
  // back: 6 runs and 6.2 km of route for Line 8's Stop 21 on the second company. A run's words stand by where it starts, its first
  // segment and how many times the route drove that way of it before. Shown failing (TS-04) with the segment the run starts at.
  it('keep the words of a line’s later runs as a stop taken off before them takes points out of its route', () => {
    const { map, data } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const P = (x: number): LngLatPair => [-71.08 + 0.002 * x, 42.35];
    const line = (id: number, route: LngLatPair[]) => ({ id, name: `Line ${id}`, colour: '#2471a3', route, stops: [], stopIds: [] });
    // Line 1 alone on three blocks, through a stop's point at P(1), then beside Line 2 on two more; then the stop taken off.
    const labels = (lines: ReturnType<typeof line>[]) => {
      const from = data.length;
      setLines(map as unknown as MapLibreMap, lines as unknown as LineView[], [] as StopView[]);
      const names = (data[from] as { features: { properties: Record<string, unknown>; geometry: { coordinates: LngLatPair[] } }[] }).features.filter((f) => f.properties.kind === 'name' && f.properties.id === 1);
      return new Map(names.map((f) => [f.geometry.coordinates[0]!.join(), { first: f.properties.first as number, label: f.properties.label as string }]));
    };
    const line2 = line(2, [P(3), P(4), P(5)]);
    const before = labels([line(1, [P(0), P(1), P(2), P(3), P(4), P(5)]), line2]);
    const after = labels([line(1, [P(0), P(2), P(3), P(4), P(5)]), line2]);
    const beside = P(3).join();
    expect([before.get(beside)!.first, after.get(beside)!.first]).toEqual([3, 2]);
    expect(after.get(beside)!.label).toBe(before.get(beside)!.label);
    // And no two of a line's runs share their words.
    expect(new Set([...after.values()].map((r) => r.label)).size).toBe(after.size);
  });

  // The twenty-third round's review: MapLibre looks for a place to break a line label's words at every space before it trims them,
  // each against all the spaces before it, so as many spaces as the run's start, up to 595 on the bench's four networks, made a
  // change to the lines 11 to 90 ms slower to show at zoom 12 to 14. A run's start is written in binary now, in white space MapLibre
  // trims. Shown failing (TS-04) with as many spaces as the run's start.
  it('keep each run’s words short, each its own, and read as the line’s name', () => {
    const all = [...Array.from({ length: 1_024 }, (_, code) => wordsOf('Line 12', code)), wordsOf('Line 12', (1 << 20) - 1)];
    expect(new Set(all).size).toBe(all.length);
    for (const words of all) {
      expect(words.length - 'Line 12'.length).toBeLessThanOrEqual(21);
      expect(words.trim()).toBe('Line 12');
      expect([...words.slice('Line 12'.length)].every((c) => c === ' ' || c === '\u00a0')).toBe(true);
    }
  });

  // Roadworks' hatching, 15 px wide at zoom 16, showed none beside three lines' 21 px of ribbons on a street they share, and half
  // a pixel a side beside two (the systems audit's twenty-first round). It is as wide as the lines there and 4 px a side more.
  // Shown failing (TS-04) on 409570e, whose street was one feature of no width of its own.
  it('draw a city event’s street wider than every line on it, side by side', () => {
    const { map, specs, data } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const P = (x: number): LngLatPair => [-71.08 + 0.002 * x, 42.35];
    const lines = [1, 2, 3].map((id) => ({ id, route: id === 3 ? [P(1), P(2)] : [P(0), P(1), P(2)] }));
    const event = { kind: 'roadworks', phase: 'pending', daysLeft: 2, at: P(1), path: [[P(0), P(1), P(2), P(3)]] } as unknown as EventView;
    setEvent(map as unknown as MapLibreMap, event, placesOf(lines));
    const streets = (data[0] as { features: { properties: Record<string, unknown>; geometry: { coordinates: unknown } }[] }).features.filter((f) => f.properties.kind === 'street');
    expect(streets.map((f) => [f.properties.places, f.geometry.coordinates])).toEqual([
      [2, [P(0), P(1)]],
      [3, [P(1), P(2)]],
      [0, [P(2), P(3)]],
    ]);
    const made = createExpression(specs.get('event-pending')!.paint!['line-width'], latest.paint_line['line-width'] as never);
    if (made.result !== 'success') throw new Error(made.value.map((e) => e.message).join('; '));
    const width = (zoom: number, places: number) => made.value.evaluate({ zoom }, { type: 'LineString', properties: { places } } as never) as number;
    expect([0, 1, 2, 3].map((n) => width(16, n))).toEqual([15, 15, 22, 29]);
    expect([0, 1, 3].map((n) => width(12, n))).toEqual([7, 7, 13]);
  });

  // The route editor's drawing lay in the street's middle, over the middle line's ribbon: Line 2's draft on Tremont Street sat
  // over Line 5's, 7 px from its own (the systems audit's twenty-first round). Shown failing (TS-04) on 409570e, whose draft had no
  // side.
  it('draw a route being edited at its line’s places on the streets it drives already, and a new line’s in the middle', () => {
    const { map, specs, data } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const P = (x: number): LngLatPair => [-71.08 + 0.002 * x, 42.35];
    const lines = [2, 5, 9].map((id) => ({ id, route: [P(0), P(1)] }));
    const places = placesOf(lines);
    const draft = { stops: [], route: [P(0), P(1), P(2)], walkM: 400 } as unknown as LineDraftView;
    setDraft(map as unknown as MapLibreMap, draft, places, 2);
    const routes = (d: unknown) => (d as { features: { properties: Record<string, unknown> }[] }).features.filter((f) => f.properties.kind === 'route').map((f) => f.properties.side);
    expect(routes(data[0])).toEqual([-1, 0]);
    setDraft(map as unknown as MapLibreMap, draft, places, null);
    expect(routes(data[1])).toEqual([0]);
    expect(specs.get('draft-route')!.paint!['line-offset']).toEqual(specs.get('lines-route')!.paint!['line-offset']);
  });

  it('draw homes filled and jobs ringed, so the two kinds differ in shape as well as colour', () => {
    const { map, specs } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    expect(specs.get('dots-homes')!.paint).toMatchObject({ 'circle-color': GAME_LIGHT.homeDot });
    expect(specs.get('dots-homes')!.paint!['circle-stroke-width']).toBeUndefined();
    expect(specs.get('dots-jobs')!.paint).toMatchObject({ 'circle-color': 'rgba(0, 0, 0, 0)', 'circle-stroke-color': GAME_LIGHT.jobDot });
    // Its stroke and radius come from the ring's expressions (pick.ts), so the ring ends at the people radius.
    expect(specs.get('dots-jobs')!.paint!['circle-stroke-width']).toEqual(ringExpressions().width);
    expect(specs.get('dots-jobs')!.paint!['circle-radius']).toEqual(ringExpressions().radius);
  });

  it('draw every word in the self-hosted Afacad Flux stacks', () => {
    const { map, specs } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const fonts = [...specs.values()].flatMap((l) => (l.layout?.['text-font'] as string[] | undefined) ?? []);
    expect(fonts.length).toBeGreaterThan(2);
    expect(fonts.filter((f) => !FONT_STACKS.includes(f))).toEqual([]);
  });
});
