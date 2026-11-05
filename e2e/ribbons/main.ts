// A route's ribbon and a bus on it, side by side as the game draws them (render/map/sides.ts): the ribbon with lines-route's own
// width and line-offset (overlays.ts), the bus by the game's own vehicle layer with the same side, and the line's name with the
// game's own layout (NAME_LAYOUT), at any camera. Served by Vite's dev server from e2e/ribbons.spec.ts, as e2e/i12 is, with the
// game's own fonts.
import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource, type LngLatLike } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BUS_FLOATS, type BusSource } from '../../src/render/map/fleet';
import { NAME_HALO_PX, NAME_LAYOUT, nameFeatures } from '../../src/render/map/overlays';
import { groundAt, RIBBON_PX } from '../../src/render/map/sides';
import { createVehicleLayer } from '../../src/render/map/vehicles';

const CENTRE: [number, number] = [-71.085, 42.35];
setWorkerUrl(mapWorkerUrl);
const map = new MapLibreMap({
  container: 'map',
  style: {
    version: 8,
    glyphs: `${location.origin}/fonts/{fontstack}/{range}.pbf`,
    sources: { lines: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }, names: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': '#ebe7df' } },
      {
        id: 'route',
        type: 'line',
        source: 'lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#2471a3',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, RIBBON_PX[0], 16, RIBBON_PX[1]],
          'line-offset': ['interpolate', ['linear'], ['zoom'], 12, ['*', ['get', 'side'], RIBBON_PX[0]], 16, ['*', ['get', 'side'], RIBBON_PX[1]]],
        },
      },
      { id: 'name', type: 'symbol', source: 'names', layout: NAME_LAYOUT, paint: { 'text-color': '#2b2622', 'text-halo-color': '#ffffff', 'text-halo-width': NAME_HALO_PX } },
    ],
  },
  center: CENTRE,
  zoom: 16,
  maxPitch: 85,
  attributionControl: false,
  fadeDuration: 0,
});
const data = new Float64Array(BUS_FLOATS);
let count = 0;
const source: BusSource = { frame: () => ({ count, data }), running: false };

export interface RibbonCase {
  readonly zoom: number;
  readonly pitch: number;
  readonly heading: number;
  readonly side: number;
  /** Where on the map the street crosses, in fractions of its width and height. */
  readonly at: readonly [number, number];
  /**
   * The ribbon, the bus, the line's name along the street, or its names along two runs of it: end to end, 30 m on the other side,
   * then the rest (`joined`); 30 m back to the street's start on the other side, then the whole street on (`turned`); or back along
   * the street from its end to 100 m short of its start, at 1.5 less than `side` along its own way, then the whole street on: at
   * `side` 3, the two places stand 4.5 ribbons apart, so both runs' names have room (`both`).
   */
  readonly show: 'ribbon' | 'bus' | 'name' | 'joined' | 'turned' | 'both';
}

declare global {
  interface Window {
    ribbonsReady?: boolean;
    ribbonCase?: (c: RibbonCase) => Promise<{ anchor: [number, number]; dir: [number, number] }>;
    groundOf?: (points: readonly (readonly [number, number])[]) => { across: number; k: number }[];
  }
}

map.on('load', () => {
  map.addLayer(createVehicleLayer(source));
  window.ribbonsReady = true;
});

let street: readonly [[number, number], [number, number]] = [CENTRE, CENTRE];

/**
 * Where each point on the screen lies on the ground, in the world's pixels at the map's zoom to the right of the last case's street
 * (`across`), and how many of those pixels a screen pixel across spans there (`k`), as loadMap.ts's click measures it.
 */
window.groundOf = (points) => {
  const ground = groundAt(map.getZoom());
  const on = (x: number, y: number) => {
    const p = map.unproject([x, y]);
    return ground([p.lng, p.lat]);
  };
  const [a, b] = [ground(street[0]), ground(street[1])];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [ux, uy] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  return points.map(([x, y]) => {
    const [p, l, r] = [on(x, y), on(x - 0.5, y), on(x + 0.5, y)];
    return { across: (p[0] - a[0]) * -uy + (p[1] - a[1]) * ux, k: Math.hypot(r[0] - l[0], r[1] - l[1]) };
  });
};

/** Draws the ribbon, the bus or the name alone at the camera asked, on a straight street through `at`, and says where the street crosses on screen. */
window.ribbonCase = async ({ zoom, pitch, heading, side, at, show }) => {
  map.jumpTo({ center: CENTRE, zoom, pitch, bearing: 0 });
  const { width, height } = map.getContainer().getBoundingClientRect();
  const p = map.unproject([width * at[0], height * at[1]]);
  // A straight street through p at `heading` (degrees clockwise from north, as position.ts's placeAt has it), 300 m each way.
  const k = Math.cos((p.lat * Math.PI) / 180);
  const m = 300 / 111_320;
  const [dx, dy] = [(Math.sin((heading * Math.PI) / 180) * m) / k, Math.cos((heading * Math.PI) / 180) * m];
  const a: [number, number] = [p.lng - dx, p.lat - dy];
  const b: [number, number] = [p.lng + dx, p.lat + dy];
  street = [a, b];
  (map.getSource('lines') as GeoJSONSource).setData({
    type: 'FeatureCollection',
    features: show === 'ribbon' ? [{ type: 'Feature', properties: { side }, geometry: { type: 'LineString', coordinates: [a, b] } }] : [],
  });
  // The names as the game makes them (overlays.ts nameFeatures): along one run, or along two that meet, the first 30 m long, or
  // along two on the street both ways.
  const along = (m: number): [number, number] => [a[0] + ((b[0] - a[0]) * m) / 600, a[1] + ((b[1] - a[1]) * m) / 600];
  const runs =
    show === 'name'
      ? [{ points: [a, b], side, first: 0, last: 0 }]
      : show === 'joined'
        ? [
            { points: [a, along(30)], side: -side, first: 0, last: 0 },
            { points: [along(30), b], side, first: 1, last: 1 },
          ]
        : show === 'turned'
          ? [
              { points: [along(30), a], side: -side, first: 0, last: 0 },
              { points: [a, b], side, first: 1, last: 1 },
            ]
          : show === 'both'
            ? [
                { points: [b, along(100)], side: side - 1.5, first: 0, last: 0 },
                { points: [a, b], side, first: 1, last: 1 },
              ]
            : [];
  (map.getSource('names') as GeoJSONSource).setData({ type: 'FeatureCollection', features: nameFeatures({ id: 12, name: 'Line 12' }, runs) });
  count = show === 'bus' ? 1 : 0;
  // A Sparrow-sized glyph in red, so no part of it is the land's colour.
  data.set([p.lng, p.lat, heading, 1, 0, 0, 20, 8, side], 0);
  // Twice: the bus layer draws with the camera as set once the map has settled on it.
  for (let i = 0; i < 2; i++) {
    await new Promise((resolve) => {
      map.once('idle', resolve);
      map.triggerRepaint();
    });
  }
  const [pa, pb, pp] = [map.project(a as LngLatLike), map.project(b as LngLatLike), map.project(p)];
  return { anchor: [pp.x, pp.y], dir: [pb.x - pa.x, pb.y - pa.y] };
};
