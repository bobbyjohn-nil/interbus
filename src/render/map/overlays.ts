// The game's layers on the map: demand dots (where people live and work) and the lines with their
// stops. GeoJSON sources set only when their data changes, never per frame (RN-04); they draw above
// the board mask. The numbers come from the sim worker; the renderer computes none (AR-04).
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Dots, LineView } from '../../sim/types';
import type { GameTokens } from './tokens';

export const DOTS = 'dots';
export const LINES = 'lines';
export const DOT_LAYERS = ['dots-homes', 'dots-jobs'] as const;
export const LINE_LAYERS = ['lines-route', 'lines-stops'] as const;

const empty = { type: 'FeatureCollection' as const, features: [] };

export function addOverlays(map: MapLibreMap, t: GameTokens): void {
  map.addSource(DOTS, { type: 'geojson', data: empty });
  map.addSource(LINES, { type: 'geojson', data: empty });
  // A dot's area grows with its people: radius by the square root, larger as the map zooms in.
  const radius = (scale: number) => ['interpolate', ['linear'], ['zoom'], 12, ['*', scale * 0.5, ['sqrt', ['get', 'w']]], 16, ['*', scale * 2, ['sqrt', ['get', 'w']]]];
  for (const [id, kind, colour] of [
    ['dots-homes', 'home', t.homeDot],
    ['dots-jobs', 'job', t.jobDot],
  ] as const) {
    map.addLayer({
      id,
      type: 'circle',
      source: DOTS,
      filter: ['==', ['get', 'kind'], kind],
      paint: { 'circle-color': colour, 'circle-opacity': 0.55, 'circle-radius': radius(0.12) as never, 'circle-pitch-alignment': 'map' },
    });
  }
  map.addLayer({
    id: 'lines-route',
    type: 'line',
    source: LINES,
    filter: ['==', ['get', 'kind'], 'route'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'colour'], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 7] },
  });
  map.addLayer({
    id: 'lines-stops',
    type: 'circle',
    source: LINES,
    filter: ['==', ['get', 'kind'], 'stop'],
    paint: {
      'circle-color': t.stopFill,
      'circle-stroke-color': ['get', 'colour'],
      'circle-stroke-width': 3,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
    },
  });
}

export function setDots(map: MapLibreMap, dots: Dots): void {
  const point = (kind: string) => ([lon, lat, w]: readonly [number, number, number]) => ({
    type: 'Feature' as const,
    properties: { kind, w },
    geometry: { type: 'Point' as const, coordinates: [lon, lat] },
  });
  (map.getSource(DOTS) as GeoJSONSource).setData({ type: 'FeatureCollection', features: [...dots.homes.map(point('home')), ...dots.jobs.map(point('job'))] });
}

export function setLines(map: MapLibreMap, lines: readonly LineView[]): void {
  const features = lines.flatMap((line) => [
    { type: 'Feature' as const, properties: { kind: 'route', colour: line.colour, id: line.id }, geometry: { type: 'LineString' as const, coordinates: line.route.map((p) => [...p]) } },
    ...line.stops.map((p) => ({ type: 'Feature' as const, properties: { kind: 'stop', colour: line.colour, id: line.id }, geometry: { type: 'Point' as const, coordinates: [...p] } })),
  ]);
  (map.getSource(LINES) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}
