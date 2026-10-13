// PLAN §6's budget of at most 7 vehicle draw calls a frame (the slow-laptop run, the M5 spec, item 9):
// the layer draws every bus in one instanced call however many there are, counted on a stand-in for
// WebGL2 that records each draw. Shown failing (TS-04) with a draw call for each bus.
import type { CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { BUS_FLOATS, type BusSource } from './fleet';
import { createVehicleLayer } from './vehicles';

/** PLAN §6: vehicle draw calls a frame. */
const DRAW_CALL_BUDGET = 7;
const DRAWS = new Set(['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']);

/** A WebGL2 context that compiles and links everything, does nothing else, and counts draws. */
function countingGl(): { gl: WebGL2RenderingContext; draws: () => number } {
  let draws = 0;
  const gl = new Proxy(
    {},
    {
      get(_, name) {
        if (typeof name !== 'string') return undefined;
        if (DRAWS.has(name)) return () => void draws++;
        if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
        if (name === 'drawingBufferWidth') return 1366;
        if (name === 'drawingBufferHeight') return 768;
        if (/^[A-Z0-9_]+$/.test(name)) return 0;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, draws: () => draws };
}

/** `count` buses round Copley Square, paused. */
function fleetOf(count: number): BusSource {
  const data = new Float64Array(count * BUS_FLOATS);
  for (let i = 0; i < count; i++) data.set([-71.077 + (i % 20) * 1e-3, 42.35 + Math.floor(i / 20) * 1e-3, (i * 37) % 360, 0.2, 0.4, 0.6, 20, 8], i * BUS_FLOATS);
  return { frame: () => ({ count, data }), running: false };
}

const map = { getContainer: () => ({ dataset: {} }), getCenter: () => ({ lng: -71.077, lat: 42.35 }), getPixelRatio: () => 1, triggerRepaint: () => {} } as unknown as MapLibreMap;
const frame = { defaultProjectionData: { mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } } as unknown as CustomRenderMethodInput;

describe('the vehicle layer’s draw calls (PLAN §6, at most 7 a frame)', () => {
  it.each([1, 200, 1_000])('draws %i buses in one call', (count) => {
    const { gl, draws } = countingGl();
    const layer = createVehicleLayer(fleetOf(count));
    layer.onAdd!(map, gl);
    layer.render(gl, frame);
    expect(layer.drawn()).toBe(count);
    expect(draws()).toBe(1);
    expect(draws()).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('draws nothing when no bus is out', () => {
    const { gl, draws } = countingGl();
    const layer = createVehicleLayer(fleetOf(0));
    layer.onAdd!(map, gl);
    layer.render(gl, frame);
    expect(draws()).toBe(0);
  });
});
