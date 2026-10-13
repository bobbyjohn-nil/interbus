// I12's harness (PLAN §6, the M2 spec item 6): the game's own vehicle layer on a bare map, 50 buses
// heading away from the camera, at whatever camera the test asks for. Served by Vite's dev server
// from e2e/i12.spec.ts; never part of the game's build. `?length=4&width=2` draws the meta-test's
// glyph, which the check must fail.
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BusSource } from '../../src/render/map/fleet';
import { createVehicleLayer, SPARROW_GLYPH } from '../../src/render/map/vehicles';

const CENTRE: [number, number] = [-71.085, 42.35];
const BUSES = 50;
// The buses in a colour the land never has, so every changed pixel is theirs.
const MAGENTA = [1, 0, 1] as const;

setWorkerUrl(mapWorkerUrl);
const params = new URLSearchParams(location.search);
const glyph = { lengthPx: Number(params.get('length') ?? SPARROW_GLYPH.lengthPx), widthPx: Number(params.get('width') ?? SPARROW_GLYPH.widthPx) };
const map = new MapLibreMap({
  container: 'map',
  style: { version: 8, sources: {}, layers: [{ id: 'land', type: 'background', paint: { 'background-color': '#ebe7df' } }] },
  center: CENTRE,
  zoom: 14,
  maxPitch: 85,
  attributionControl: false,
  fadeDuration: 0,
});
const data = new Float64Array(6 * BUSES);
let count = 0;
const source: BusSource = { frame: () => ({ count, data }), running: false };

declare global {
  interface Window {
    i12Ready?: boolean;
    /** Moves the camera, lays 50 buses heading north (away from it) across the screen, and resolves once drawn. */
    i12Camera?: (zoom: number, pitch: number) => Promise<void>;
  }
}

map.on('load', () => {
  map.addLayer(createVehicleLayer(source, glyph));
  window.i12Ready = true;
});

window.i12Camera = async (zoom, pitch) => {
  map.jumpTo({ center: CENTRE, zoom, pitch, bearing: 0 });
  const { width, height } = map.getContainer().getBoundingClientRect();
  count = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const at = map.unproject([width * (0.1 + 0.088 * col), height * (0.3 + 0.1 * row)]);
      data.set([at.lng, at.lat, 0, ...MAGENTA], 6 * count++);
    }
  }
  const drawn = new Promise((resolve) => map.once('idle', resolve));
  map.triggerRepaint();
  await drawn;
};
