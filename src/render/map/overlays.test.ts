// The game's layers (D25): no contract rings, and each kind of demand dot shown or hidden on its own; and, for shape beside
// colour (PLAN §8), each line named along its route and jobs ringed where homes are filled. Shown failing (TS-04) on the old
// overlays: three contract layers, one flag setting both dot layers, and lines and dots told apart by colour alone.
import { describe, expect, it } from 'vitest';
import { createExpression, latest } from '@maplibre/maplibre-gl-style-spec';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { addOverlays, setDotKinds, setDraft, setEvent, setLines, shortOfEnds } from './overlays';
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
    expect(names.layout).toMatchObject({ 'symbol-placement': 'line', 'text-field': ['get', 'name'] });
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
    // Short of the run's ends by 5 m, so MapLibre never joins it to the next run's name (shortOfEnds).
    expect(name.geometry.coordinates).toEqual(shortOfEnds(line.route));
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

  // #201's review: MapLibre joins the lines of line labels that share an end and their words before it places them (symbol_bucket's
  // mergeLines), keeping the first one's properties, so a line's names, run by run end to end, stood at whichever run came first in
  // a tile: 62% of the names' cells off their own run's place on the second company at zoom 14. Each name stops 5 m short of its
  // run's ends now, a quarter of its end segment at most, so no two share an end. Shown failing (TS-04) with the runs' own ends.
  it('stop each run’s name short of its ends, so no two of a line’s names share an end for MapLibre to join', () => {
    const { map, data } = fakeMap();
    addOverlays(map as unknown as MapLibreMap, GAME_LIGHT, LIGHT);
    const P = (x: number): LngLatPair => [-71.08 + 0.002 * x, 42.35];
    // Line 1 alone on the first block, beside Line 2 on the next two: three runs of its route, by its place there.
    const lines = [
      { id: 1, name: 'Line 1', colour: '#2471a3', route: [P(0), P(1), P(2), P(3)], stops: [], stopIds: [] },
      { id: 2, name: 'Line 2', colour: '#1e8449', route: [P(1), P(2)], stops: [], stopIds: [] },
    ] as unknown as LineView[];
    setLines(map as unknown as MapLibreMap, lines, [] as StopView[]);
    const names = (data[0] as { features: { properties: Record<string, unknown>; geometry: { coordinates: LngLatPair[] } }[] }).features.filter((f) => f.properties.kind === 'name' && f.properties.id === 1);
    expect(names.map((f) => Math.abs(f.properties.side as number))).toEqual([0, 0.5, 0]);
    const metres = (a: LngLatPair, b: LngLatPair) => Math.hypot((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180), a[1] - b[1]) * 111_195;
    for (let k = 1; k < names.length; k++) {
      const [end, start] = [names[k - 1]!.geometry.coordinates.at(-1)!, names[k]!.geometry.coordinates[0]!];
      expect(metres(end, start)).toBeCloseTo(10, 6);
    }
    // A run's end segment shorter than 20 m gives up a quarter of itself instead.
    expect(metres(shortOfEnds([P(0), [P(0)[0] + 0.0001, 42.35]])[0]!, P(0))).toBeCloseTo(metres(P(0), [P(0)[0] + 0.0001, 42.35]) / 4, 6);
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
