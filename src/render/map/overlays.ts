// The game's layers on the map: depot land and depots, demand dots (where people live and work),
// the lines with their stops, and the line being drawn. GeoJSON sources set only when their data
// changes, never per frame (RN-04); they draw above the board mask. The numbers come from the sim
// worker; the renderer computes none (AR-04), only the shapes that show them.
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { DepotView, Dots, LineDraftView, LineView, LngLatPair } from '../../sim/types';
import type { GameTokens } from './tokens';

export const DOTS = 'dots';
export const LINES = 'lines';
export const DEPOT_LAND = 'depot-land';
export const DEPOTS = 'depots';
export const DRAFT = 'draft';
export const DOT_LAYERS = ['dots-homes', 'dots-jobs'] as const;
export const LINE_LAYERS = ['lines-route', 'lines-stops'] as const;
export const TINT_LAYERS = ['depot-land-fill', 'depot-land-edge'] as const;
export const DRAFT_LAYERS = ['draft-rings', 'draft-route', 'draft-stops'] as const;

const empty = { type: 'FeatureCollection' as const, features: [] };

export function addOverlays(map: MapLibreMap, t: GameTokens): void {
  for (const id of [DEPOT_LAND, DOTS, LINES, DEPOTS, DRAFT]) map.addSource(id, { type: 'geojson', data: empty });
  // The tint shows only while a depot is being placed (setTint): exactly the land the rule allows.
  map.addLayer({ id: 'depot-land-fill', type: 'fill', source: DEPOT_LAND, layout: { visibility: 'none' }, paint: { 'fill-color': t.depotLand, 'fill-opacity': 0.28 } });
  map.addLayer({ id: 'depot-land-edge', type: 'line', source: DEPOT_LAND, layout: { visibility: 'none' }, paint: { 'line-color': t.depotLand, 'line-width': 1.5 } });
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
  map.addLayer({
    id: 'depots',
    type: 'circle',
    source: DEPOTS,
    paint: {
      'circle-color': t.depotMark,
      'circle-stroke-color': t.stopFill,
      'circle-stroke-width': 2,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 11],
    },
  });
  // The draft: each stop's walk ring in the residents' colour, the route dashed, the stops hollow.
  map.addLayer({ id: 'draft-rings', type: 'fill', source: DRAFT, filter: ['==', ['get', 'kind'], 'ring'], paint: { 'fill-color': t.homeDot, 'fill-opacity': 0.08, 'fill-outline-color': t.homeDot } });
  map.addLayer({
    id: 'draft-route',
    type: 'line',
    source: DRAFT,
    filter: ['==', ['get', 'kind'], 'route'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': t.draft, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 5], 'line-dasharray': [2, 1.5] },
  });
  map.addLayer({
    id: 'draft-stops',
    type: 'circle',
    source: DRAFT,
    filter: ['==', ['get', 'kind'], 'stop'],
    paint: {
      'circle-color': t.stopFill,
      'circle-stroke-color': t.draft,
      // A stop the draft joins draws thicker: a transfer.
      'circle-stroke-width': ['case', ['get', 'joins'], 4, 2],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
    },
  });
}

export function setDepotLand(map: MapLibreMap, rings: readonly (readonly LngLatPair[])[]): void {
  const features = rings.map((ring) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[...ring.map((p) => [...p]), [...ring[0]!]]] } }));
  (map.getSource(DEPOT_LAND) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

/** Shows or hides the depot-land tint: once per tool change, never per frame (RN-04). */
export function setTint(map: MapLibreMap, visible: boolean): void {
  for (const id of TINT_LAYERS) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export function setDepots(map: MapLibreMap, depots: readonly DepotView[]): void {
  const features = depots.map((d) => ({ type: 'Feature' as const, properties: { id: d.id }, geometry: { type: 'Point' as const, coordinates: [...d.at] } }));
  (map.getSource(DEPOTS) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

/** A walk ring of `metres` around `at`, as a 48-sided polygon (a shape for the eye; the count comes from the sim). */
function ring(at: LngLatPair, metres: number): number[][] {
  const [lon, lat] = at;
  const dLat = metres / 111_132;
  const dLon = metres / (111_320 * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: 49 }, (_, k) => {
    const a = (2 * Math.PI * (k % 48)) / 48;
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)];
  });
}

export function setDraft(map: MapLibreMap, draft: LineDraftView | null): void {
  const features = draft
    ? [
        ...draft.stops.map((s) => ({ type: 'Feature' as const, properties: { kind: 'ring' }, geometry: { type: 'Polygon' as const, coordinates: [ring(s.at, draft.walkM)] } })),
        ...(draft.route.length > 1 ? [{ type: 'Feature' as const, properties: { kind: 'route' }, geometry: { type: 'LineString' as const, coordinates: draft.route.map((p) => [...p]) } }] : []),
        ...draft.stops.map((s) => ({ type: 'Feature' as const, properties: { kind: 'stop', joins: s.joins !== null }, geometry: { type: 'Point' as const, coordinates: [...s.at] } })),
      ]
    : [];
  (map.getSource(DRAFT) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
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
