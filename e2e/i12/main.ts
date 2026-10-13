// I12's harness (PLAN §6, the M2 spec item 6): the game's own vehicle layer on a bare map, 50 buses
// of one family heading away from the camera, at whatever camera the test asks for. Served by Vite's
// dev server from e2e/i12.spec.ts; never part of the game's build. `?length=4&width=2` draws the
// meta-test's glyph, which the check must fail.
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BUS_FLOATS, type BusSource } from '../../src/render/map/fleet';
import { createVehicleLayer, MODEL_GLYPHS } from '../../src/render/map/vehicles';
import type { BusModelId } from '../../src/sim/types';

const CENTRE: [number, number] = [-71.085, 42.35];
const BUSES = 50;
// The buses in a colour the land never has, so every changed pixel is theirs.
const MAGENTA = [1, 0, 1] as const;

setWorkerUrl(mapWorkerUrl);
const params = new URLSearchParams(location.search);
const map = new MapLibreMap({
  container: 'map',
  style: { version: 8, sources: {}, layers: [{ id: 'land', type: 'background', paint: { 'background-color': '#ebe7df' } }] },
  center: CENTRE,
  zoom: 14,
  maxPitch: 85,
  attributionControl: false,
  fadeDuration: 0,
});
const data = new Float64Array(BUS_FLOATS * BUSES);
let count = 0;
const source: BusSource = { frame: () => ({ count, data }), running: false };

declare global {
  interface Window {
    i12Ready?: boolean;
    /** Moves the camera, lays 50 buses of a family heading north (away from it) across the screen, and resolves once drawn. */
    i12Camera?: (zoom: number, pitch: number, family?: BusModelId) => Promise<void>;
  }
}

map.on('load', () => {
  map.addLayer(createVehicleLayer(source));
  window.i12Ready = true;
});

window.i12Camera = async (zoom, pitch, family = 'sparrow') => {
  const glyph = { lengthPx: Number(params.get('length') ?? MODEL_GLYPHS[family].lengthPx), widthPx: Number(params.get('width') ?? MODEL_GLYPHS[family].widthPx) };
  map.jumpTo({ center: CENTRE, zoom, pitch, bearing: 0 });
  const { width, height } = map.getContainer().getBoundingClientRect();
  count = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const at = map.unproject([width * (0.1 + 0.088 * col), height * (0.3 + 0.1 * row)]);
      data.set([at.lng, at.lat, 0, ...MAGENTA, glyph.lengthPx, glyph.widthPx], BUS_FLOATS * count++);
    }
  }
  const drawn = new Promise((resolve) => map.once('idle', resolve));
  map.triggerRepaint();
  await drawn;
};
