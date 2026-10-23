// The game's layers (D25): no contract rings, and each kind of demand dot shown or hidden on its own; and, for shape beside
// colour (PLAN §8), each line named along its route and jobs ringed where homes are filled. Shown failing (TS-04) on the old
// overlays: three contract layers, one flag setting both dot layers, and lines and dots told apart by colour alone.
import { describe, expect, it } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { addOverlays, setDotKinds, setLines } from './overlays';
import { ringExpressions } from './pick';
import type { LineView, StopView } from '../../sim/types';
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
    expect(names.filter).toEqual(['all', ['==', ['get', 'kind'], 'route'], ['!', ['in', ['get', 'id'], ['literal', []]]]]);
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
    // The route carries the line's name.
    const line = { id: 2, name: 'Line 2', colour: '#2471a3', route: [[-71.08, 42.35], [-71.09, 42.34]], stops: [], stopIds: [] } as unknown as LineView;
    setLines(map as unknown as MapLibreMap, [line], [] as StopView[]);
    const route = (data[0] as { features: { properties: Record<string, unknown> }[] }).features.find((f) => f.properties.kind === 'route')!;
    expect(route.properties).toMatchObject({ name: 'Line 2', colour: '#2471a3' });
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
