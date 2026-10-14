// The game's layers (D25): no contract rings, and each kind of demand dot shown or hidden on its own.
// Shown failing (TS-04) on the old overlays, which added three contract layers, and with one flag
// setting both dot layers.
import { describe, expect, it } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { addOverlays, setDotKinds } from './overlays';
import { GAME_LIGHT, LIGHT } from './tokens';

function fakeMap() {
  const sources: string[] = [];
  const layers: string[] = [];
  const layout = new Map<string, unknown>();
  const map = {
    addSource: (id: string) => void sources.push(id),
    addLayer: (layer: { id: string }) => void layers.push(layer.id),
    setLayoutProperty: (id: string, name: string, value: unknown) => void layout.set(`${id}.${name}`, value),
  };
  return { map, sources, layers, layout };
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
});
