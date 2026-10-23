// The map's own wiring (loadMap.ts) against a stand-in for MapLibre that, like MapLibre, refuses a
// layer change before its style has loaded or while it has none (the context lost).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { City } from '../../cities';
import { DAYLIGHT_FADE_MS, dim, NIGHT_STEP } from './daylight';
import { BUILDINGS_2D, BUILDINGS_3D } from './tilt';
import { LIGHT } from './tokens';

const fake = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  class Evented {
    readonly listeners = new Map<string, Listener[]>();
    on(type: string, listener: Listener) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      return this;
    }
    once(type: string, listener: Listener) {
      const once = (event: unknown) => {
        this.off(type, once);
        listener(event);
      };
      return this.on(type, once);
    }
    off(type: string, listener: Listener) {
      this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== listener));
      return this;
    }
    fire(type: string, event: object = {}) {
      for (const listener of this.listeners.get(type) ?? []) listener({ type, ...event });
    }
    addEventListener(type: string, listener: Listener) {
      this.on(type, listener);
    }
    removeEventListener(type: string, listener: Listener) {
      this.off(type, listener);
    }
  }
  class FakeMap extends Evented {
    /** null while the context is lost, as MapLibre's own. */
    style: object | null = {};
    styleLoaded = false;
    readonly layout = new Map<string, unknown>();
    readonly paint = new Map<string, unknown>();
    readonly filters = new Map<string, unknown>();
    readonly layers: string[] = [];
    readonly camera = { pitch: 0, bearing: 0, zoom: 14 };
    readonly touchZoomRotate = { enableRotation: () => {}, disableRotation: () => {} };
    readonly keyboard = { disableRotation: () => {} };
    readonly doubleClickZoom = { enable: () => {}, disable: () => {} };
    private readonly box = new Evented();
    constructor() {
      super();
      maps.push(this);
    }
    private loadedStyle() {
      if (!this.style || !this.styleLoaded) throw new Error('Style is not done loading.');
    }
    setLayoutProperty(id: string, name: string, value: unknown) {
      this.loadedStyle();
      this.layout.set(`${id}.${name}`, value);
    }
    setPaintProperty(id: string, name: string, value: unknown) {
      this.loadedStyle();
      this.paint.set(`${id}.${name}`, value);
    }
    setFilter(id: string, filter: unknown) {
      this.loadedStyle();
      this.filters.set(id, filter);
    }
    addSource() {
      this.loadedStyle();
    }
    addLayer(layer: { id: string }) {
      this.loadedStyle();
      this.layers.push(layer.id);
    }
    getSource() {
      this.loadedStyle();
      return { setData: () => {} };
    }
    getLayer() {
      this.loadedStyle();
      return {};
    }
    easeTo(to: { pitch?: number; bearing?: number }) {
      Object.assign(this.camera, to);
    }
    jumpTo(to: { pitch?: number; bearing?: number }) {
      Object.assign(this.camera, to);
    }
    getPitch = () => this.camera.pitch;
    getBearing = () => this.camera.bearing;
    getZoom = () => this.camera.zoom;
    setMinZoom() {}
    isMoving = () => false;
    triggerRepaint() {}
    queryRenderedFeatures = () => [];
    getCanvasContainer = () => this.box;
    getCanvas = () => this.box;
    getContainer = () => ({ dataset: {} });
    remove() {}
  }
  const maps: FakeMap[] = [];
  return { Evented, FakeMap, maps };
});

vi.mock('maplibre-gl', () => ({ Map: fake.FakeMap, addProtocol: () => {}, setWorkerUrl: () => {} }));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: 'maplibre-gl-worker.js' }));
vi.mock('pmtiles', () => ({
  PMTiles: class {
    readonly source = { getKey: () => 'city' };
  },
  FileSource: class {},
  FetchSource: class {},
  Protocol: class {
    tile = () => {};
    add() {}
  },
}));
vi.mock('../../platform', () => ({
  assetBase: () => './',
  assetGone: async () => false,
  openCityFile: async () => ({ kind: 'range', url: 'cities/city.pmtiles' }),
  reportReplaced: () => {},
}));

const { mountMap } = await import('./loadMap');

const city = {
  id: 'boston',
  name: 'Boston',
  extent: [-71.12, 42.33, -71.04, 42.37],
  view: { center: [-71.08, 42.35], zoom: 14 },
  tiles: { file: 'city.pmtiles' },
  sim: null,
  fixture: null,
} as unknown as City;

let page: InstanceType<typeof fake.Evented>;
beforeEach(() => {
  page = new fake.Evented();
  // Reduced motion, so the buildings swap at once instead of over the cross-fade.
  vi.stubGlobal('window', { addEventListener: page.addEventListener.bind(page), removeEventListener: page.removeEventListener.bind(page), setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, devicePixelRatio: 1, matchMedia: () => ({ matches: true }) });
});
afterEach(() => void vi.unstubAllGlobals());

async function mounted() {
  const mounted = await mountMap({} as HTMLElement, city, 'full');
  return { mounted, map: fake.maps.at(-1)! };
}

/** The cross-fade's swap, which waits a turn even with reduced motion. */
const swapped = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the tilt before the map has loaded', () => {
  // The review of the audit's fixes: with the fade skipped until the style loads, a right-drag that
  // settled in 3D in the seconds before MapLibre's first 'load' left 3D's buildings lying down until T
  // was pressed twice. Shown failing (TS-04) on the old map, whose fade threw on the unloaded style.
  it('stands the buildings up once the style loads', async () => {
    const { map } = await mounted();
    map.fire('mousedown', { originalEvent: { button: 2, detail: 1, ctrlKey: false, clientX: 400, clientY: 400 }, preventDefault: () => {} });
    page.fire('mousemove', { clientX: 400, clientY: 200 });
    page.fire('mouseup', { button: 2 });
    expect(map.getPitch()).toBeGreaterThan(25);
    map.styleLoaded = true;
    map.fire('load');
    await swapped();
    expect(map.layout.get(`${BUILDINGS_3D}.visibility`)).toBe('visible');
    expect(map.layout.get(`${BUILDINGS_2D}.visibility`)).toBe('none');
  });
});

describe('the graphics taken away and given back', () => {
  // The systems audit (D26): MapLibre has no style while the context is lost, and T, a demand toggle
  // or Place a depot reached it and threw; given back, its rebuilt style had no buses' layer. Shown
  // failing (TS-04) on the old map, whose T threw here.
  it('reaches no style while it is gone, and puts the buses back and the buildings up once it is back', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    expect(map.layers.filter((id) => id === 'vehicles')).toHaveLength(1);

    map.style = null;
    map.styleLoaded = false;
    map.fire('webglcontextlost');
    board.setMode('3d');
    board.setDotKinds({ home: false, job: true });
    board.setTint(true);
    board.setDepots([{ id: 1, at: [-71.08, 42.35] }]);

    // MapLibre sets the style it kept before it says the context is back; the style loads a frame later.
    map.style = {};
    map.fire('webglcontextrestored');
    map.styleLoaded = true;
    map.fire('style.load');
    await swapped();
    expect(map.layers.filter((id) => id === 'vehicles')).toHaveLength(2);
    expect(map.layout.get(`${BUILDINGS_3D}.visibility`)).toBe('visible');
    expect(map.layout.get('dots-homes.visibility')).toBe('none');
  });
});

describe('the day and night tint', () => {
  // daylight.ts: the light waits for the style, comes at once as the style loads or comes back after a loss, and fades a step
  // at a time as the sim's clock reaches it, set only when the step changes (RN-04).
  it('waits for the style, comes at once as it loads, fades a step as the clock reaches it, and comes back with the graphics', async () => {
    const { mounted: board, map } = await mounted();
    const background = () => map.paint.get('background.background-color');
    const fade = () => map.paint.get('background.background-color-transition');
    board.setClock(22 * 3_600, 0, 2); // night, before the style has loaded: nothing reaches it
    map.styleLoaded = true;
    map.fire('load');
    expect(background()).toBe(dim(LIGHT.void, NIGHT_STEP));
    expect(fade()).toEqual({ duration: 0, delay: 0 });

    (window as unknown as { matchMedia: () => { matches: boolean } }).matchMedia = () => ({ matches: false });
    map.paint.clear();
    board.setClock(23 * 3_600, 600, 2); // the same step: nothing set
    expect(map.paint.size).toBe(0);
    board.setClock(3.5 * 3_600, 600, 3); // dawn's first step, faded by MapLibre
    expect(background()).toBe(dim(LIGHT.void, NIGHT_STEP - 1));
    expect(fade()).toEqual({ duration: DAYLIGHT_FADE_MS, delay: 0 });
    // The words the game draws in the labels' inks dim with the map.
    expect(map.paint.get('lines-name.text-halo-color')).toBe(dim(LIGHT.labelHalo, NIGHT_STEP - 1));

    // The graphics taken away as the clock reaches day: given back, day comes at once.
    map.style = null;
    map.styleLoaded = false;
    map.fire('webglcontextlost');
    board.setClock(12 * 3_600, 600, 3);
    map.style = {};
    map.fire('webglcontextrestored');
    map.styleLoaded = true;
    map.fire('style.load');
    await swapped();
    expect(background()).toBe(LIGHT.void);
    expect(fade()).toEqual({ duration: 0, delay: 0 });
  });

  it('fades the lines with overnight off from 00:00 to 05:00 with no bus in service, set as the lines resting change', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    const line = (id: number, overnight: number | null) => ({ id, name: `Line ${id}`, colour: '#c0392b', stops: [], stopIds: [], route: [], headways: { peak: 900, offpeak: 1_200, overnight }, stopAt: [], stopDistM: [] });
    const stop = { id: 7, lineIds: [1] };
    board.setLines([line(1, null), line(2, 3_600)] as never, [stop] as never);
    board.setClock(23 * 3_600, 600, 2);
    expect(map.filters.size).toBe(0);
    map.paint.clear();
    board.setClock(0, 600, 3);
    // Filters alone, no paint (overlays.ts setResting): its features and its stop's flag in the faded copies.
    expect(map.filters.get('lines-route-resting')).toEqual(['all', ['==', ['get', 'kind'], 'route'], ['in', ['get', 'id'], ['literal', [1]]]]);
    expect(map.filters.get('stops-flag-ring-resting')).toEqual(['all', ['==', ['get', 'kind'], 'flag'], ['in', ['get', 'stop'], ['literal', [7]]]]);
    expect([...map.paint.keys()]).toEqual([]);
    map.filters.clear();
    board.setClock(3 * 3_600, 600, 3);
    expect(map.filters.size).toBe(0);
    board.setClock(5 * 3_600, 600, 3);
    expect(map.filters.get('lines-route-resting')).toEqual(['all', ['==', ['get', 'kind'], 'route'], ['in', ['get', 'id'], ['literal', []]]]);
  });
});
