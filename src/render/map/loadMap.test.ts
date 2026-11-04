// The map's own wiring (loadMap.ts) against a stand-in for MapLibre that, like MapLibre, refuses a
// layer change before its style has loaded or while it has none (the context lost).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { City } from '../../cities';
import { DAYLIGHT_FADE_MS, dim, NIGHT_STEP } from './daylight';
import { BUILDINGS_2D, BUILDINGS_3D } from './tilt';
import { restingColour } from './overlays';
import { groundAt, ribbonPx } from './sides';
import { GAME_LIGHT, LIGHT, PAPER, V1_PAPER } from './tokens';

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
    /** Each layer added after the style, by id: the overlays. */
    readonly added = new Map<string, { paint?: Record<string, unknown> }>();
    readonly camera = { pitch: 0, bearing: 0, zoom: 14 };
    readonly touchZoomRotate = { enableRotation: () => {}, disableRotation: () => {} };
    readonly keyboard = { disableRotation: () => {} };
    readonly doubleClickZoom = { enable: () => {}, disable: () => {} };
    private readonly box = new Evented();
    /** The style it was made with. */
    readonly made: { layers: { id: string; paint?: Record<string, unknown> }[] };
    constructor(options: { style: { layers: { id: string; paint?: Record<string, unknown> }[] } }) {
      super();
      this.made = options.style;
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
    addLayer(layer: { id: string; paint?: Record<string, unknown> }) {
      this.loadedStyle();
      this.layers.push(layer.id);
      this.added.set(layer.id, layer);
    }
    /** The data each source was set to last. */
    readonly data = new Map<string, unknown>();
    getSource(id: string) {
      this.loadedStyle();
      return { setData: (d: unknown) => void this.data.set(id, d) };
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
    /** A place on screen: x east and y south, 100,000 px a degree, from Copley. */
    project = ([lng, lat]: readonly [number, number]) => ({ x: (lng + 71.08) * 1e5, y: (42.35 - lat) * 1e5 });
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

/** The click's place on the ground `px` world pixels at the map's zoom south of `at`, as a click a ribbon across the street lands. */
function south(at: readonly [number, number], px: number, zoom = fake.maps.at(-1)!.getZoom()): { lng: number; lat: number } {
  const [x, y] = groundAt(zoom)(at);
  const world = 512 * 2 ** zoom;
  return { lng: (x / world) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + px)) / world))) * 180) / Math.PI };
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

  // The systems audit's thirteenth round: a resting line's faded name lies over the running routes, so a click on it, where a
  // running line shares the street, listed the resting line first in Lines here (4 of 9 clicks around Line 2's name on Huntington
  // Avenue), where everywhere else on the street the running line comes first.
  it('lists the running lines first where a click finds a resting line’s name over a running route', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    // MapLibre's order, topmost first: the resting Line 2's name, Line 1's running route, Line 2's resting route.
    map.queryRenderedFeatures = (() => [
      { layer: { id: 'lines-name-resting' }, properties: { kind: 'name', id: 2 } },
      { layer: { id: 'lines-route' }, properties: { kind: 'route', id: 1 } },
      { layer: { id: 'lines-route-resting' }, properties: { kind: 'route', id: 2 } },
    ]) as never;
    let hit: { lineId: number | null; lineIds: readonly number[] } | null = null;
    board.onClick((_, h) => void (hit = h));
    map.fire('click', { point: { x: 100, y: 100 }, lngLat: { lng: -71.08, lat: 42.35 }, originalEvent: { detail: 1 } });
    expect(hit).toMatchObject({ lineId: 1, lineIds: [1, 2] });
  });

  // Lines on a street they share stand side by side (sides.ts), wider than the click's 4 px: a click on one ribbon found that
  // line alone, so Lines here no longer listed the others there, as it did when they were drawn over one another. Shown failing
  // (TS-04) with the lines the click hit alone.
  it('lists every line on the street a click is on, those side by side beyond its 4 px too, and none elsewhere', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    const line = (id: number, route: number[][]) => ({ id, name: `Line ${id}`, colour: '#c0392b', stops: [], stopIds: [], route, headways: { peak: 900, offpeak: 1_200, overnight: null }, stopAt: [], stopDistM: [] });
    const street = [
      [-71.08, 42.35],
      [-71.078, 42.35],
      [-71.076, 42.35],
    ];
    board.setLines([line(1, street), line(2, street), line(3, street), line(4, [[-71.08, 42.352], [-71.078, 42.352]])] as never, [] as never);
    // The click's 4 px reach Line 3's ribbon alone, halfway along the first block, a ribbon south of the street's middle: Line 3
    // first, then Line 2 and Line 1, each by how far its ribbon lies (sides.ts linesHere).
    map.queryRenderedFeatures = (() => [{ layer: { id: 'lines-route' }, properties: { kind: 'route', id: 3 } }]) as never;
    let hit: { lineId: number | null; lineIds: readonly number[] } | null = null;
    board.onClick((_, h) => void (hit = h));
    const middle = map.project([-71.079, 42.35]);
    map.fire('click', { point: { x: middle.x, y: middle.y + ribbonPx(map.getZoom()) }, lngLat: south([-71.079, 42.35], ribbonPx(map.getZoom())), originalEvent: { detail: 1 } });
    expect(hit!.lineIds).toEqual([3, 2, 1]);
    // A hit on a run of a route takes that run's segments alone: here Line 3's second block, which it drives alone.
    board.setLines([line(1, street.slice(0, 2)), line(2, street.slice(0, 2)), line(3, street)] as never, [] as never);
    map.queryRenderedFeatures = (() => [{ layer: { id: 'lines-route' }, properties: { kind: 'route', id: 3, first: 1, last: 1 } }]) as never;
    map.fire('click', { point: map.project([-71.0795, 42.35]), lngLat: { lng: -71.0795, lat: 42.35 }, originalEvent: { detail: 1 } });
    expect(hit!.lineIds).toEqual([3]);
  });

  // #201's review: the click was measured on the screen, where a tilted map shortens a street across its way, while line-offset
  // lays the ribbons on the ground, so a click on the middle of Line 2's ribbon on Tremont Street at pitch 60 lay nearer Line 5's,
  // 11 of 36 such clicks across the tilted cameras. Measured on the ground now, where the map put the click. Shown failing (TS-04)
  // with the click measured on the screen.
  it('measures a click on the ground, as the ribbons lie, wherever a tilted screen puts it', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    const line = (id: number) => ({ id, name: `Line ${id}`, colour: '#c0392b', stops: [], stopIds: [], route: [[-71.08, 42.35], [-71.078, 42.35]], headways: { peak: 900, offpeak: 1_200, overnight: null }, stopAt: [], stopDistM: [] });
    board.setLines([line(1), line(2), line(3)] as never, [] as never);
    map.queryRenderedFeatures = (() => [{ layer: { id: 'lines-route' }, properties: { kind: 'route', id: 2 } }]) as never;
    let hit: { lineIds: readonly number[] } | null = null;
    board.onClick((_, h) => void (hit = h));
    // On the screen, squeezed across the street, the click lies on its middle; on the ground, on Line 3's ribbon, a ribbon south.
    map.fire('click', { point: map.project([-71.079, 42.35]), lngLat: south([-71.079, 42.35], ribbonPx(map.getZoom())), originalEvent: { detail: 1 } });
    expect(hit!.lineIds).toEqual([3, 2, 1]);
  });

  // #201's review: a name's words, 12 px tall, are wider than a ribbon and drawn over the ribbons, so a click on their outer half
  // lay nearer a neighbour's ribbon, which came first, 3 of 8 clicks on placed names. The line whose name the click is on comes
  // first now. Shown failing (TS-04) with the lines by their ribbons alone.
  it('lists first the line whose name a click is on, where its words reach over a neighbour’s ribbon', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    const line = (id: number) => ({ id, name: `Line ${id}`, colour: '#c0392b', stops: [], stopIds: [], route: [[-71.08, 42.35], [-71.078, 42.35]], headways: { peak: 900, offpeak: 1_200, overnight: null }, stopAt: [], stopDistM: [] });
    board.setLines([line(1), line(2), line(3)] as never, [] as never);
    // Line 2's name, in the street's middle, reaching over Line 3's ribbon, where the click is.
    map.queryRenderedFeatures = (() => [
      { layer: { id: 'lines-name' }, properties: { kind: 'name', id: 2, first: 0, last: 0 } },
      { layer: { id: 'lines-route' }, properties: { kind: 'route', id: 3, first: 0, last: 0 } },
    ]) as never;
    let hit: { lineIds: readonly number[] } | null = null;
    board.onClick((_, h) => void (hit = h));
    map.fire('click', { point: map.project([-71.079, 42.35]), lngLat: south([-71.079, 42.35], ribbonPx(map.getZoom())), originalEvent: { detail: 1 } });
    expect(hit!.lineIds).toEqual([2, 3, 1]);
  });

  // The roadworks' street is drawn as wide as the lines on it (overlays.ts setEvent), so it is drawn again as the lines on their
  // streets change, and, with the map's graphics taken away meanwhile, once they are back: as the context was lost, the lines were
  // kept for later and the event was not, so the restored map drew it as wide as before (#201's review). Shown failing (TS-04)
  // without the event drawn again.
  it('draws a city event’s street again as the lines on it change, and once the graphics are back', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    const line = (id: number) => ({ id, name: `Line ${id}`, colour: '#c0392b', stops: [], stopIds: [], route: [[-71.08, 42.35], [-71.078, 42.35]], headways: { peak: 900, offpeak: 1_200, overnight: null }, stopAt: [], stopDistM: [] });
    const event = { kind: 'roadworks', phase: 'pending', daysLeft: 2, at: [-71.079, 42.35], path: [[[-71.08, 42.35], [-71.078, 42.35]]] };
    const places = () => ((map.data.get('events') as { features: { properties: { kind: string; places?: number } }[] }).features.find((f) => f.properties.kind === 'street')!.properties.places);
    board.setLines([line(1)] as never, [] as never);
    board.setEvent(event as never);
    expect(places()).toBe(1);
    board.setLines([line(1), line(2)] as never, [] as never);
    expect(places()).toBe(2);
    map.style = null;
    map.styleLoaded = false;
    map.fire('webglcontextlost');
    board.setLines([line(1), line(2), line(3)] as never, [] as never);
    map.style = {};
    map.fire('webglcontextrestored');
    map.styleLoaded = true;
    map.fire('style.load');
    await swapped();
    expect(places()).toBe(3);
  });

  // A line settling onto a change of route still runs buses on the route as it was until its merged plan hands over: stood without
  // that route, the street re-centred under such a bus as the change came, which stepped it 3.5 px across onto another line's
  // ribbon until the handover (the systems audit's twenty-first round). The other line keeps its place beside the old route until
  // the handover, then stands alone. Shown failing (TS-04) with the places stood from the lines' own routes alone.
  it('keeps a settling line’s earlier route among the places until it hands over', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    const at = (lat: number) => (m: number): [number, number] => [-71.1 + m / 82_220, lat];
    const [a, b] = [at(42.35), at(42.352)];
    const geometry = (on: (m: number) => [number, number]) => {
      const route = [on(0), on(1_339), on(2_425), on(3_535)];
      return { route, stops: route, stopAt: [0, 1, 2, 3], stopDistM: [0, 1_339, 2_425, 3_535], pullOut: [on(0), on(0)], pullIn: [on(0), on(0)] };
    };
    const every = (s: number, buses: number) => ({ timing: { cycle: 1_539, headways: { peak: s, offpeak: s, overnight: null }, buses }, oneWayS: 529.5, pullOutS: 0, pullInS: 0 });
    const base = { name: 'Line', colour: '#c0392b', stopIds: [1, 2, 3, 4], headways: { peak: 600, offpeak: 600, overnight: null }, model: 'sparrow' };
    // Line 1 cut from every 20 minutes on street A to every 10 on street B at 23:00 on day 2: it hands over at 23:20. Line 2 on A.
    const was = geometry(a);
    const one = { ...base, id: 1, ...geometry(b), plan: every(600, 3), settling: { frameDay: 2, earlier: [{ plan: every(1_200, 2), until: 23 * 3_600, sameModel: true, sameStart: true, ...was }] } };
    const two = { ...base, id: 2, ...geometry(a), plan: every(1_200, 2), settling: null };
    const sideOf = (id: number) => (map.data.get('lines') as { features: { properties: Record<string, unknown> }[] }).features.find((f) => f.properties.kind === 'route' && f.properties.id === id)!.properties.side;
    board.setClock(23 * 3_600 + 10 * 60, 600, 2);
    board.setLines([one, two] as never, [] as never);
    expect(Math.abs(sideOf(2) as number)).toBe(0.5);
    board.setClock(23 * 3_600 + 15 * 60, 600, 2);
    expect(Math.abs(sideOf(2) as number)).toBe(0.5);
    board.setClock(23 * 3_600 + 25 * 60, 600, 2);
    expect(sideOf(2)).toBe(0);
  });

  // While time runs the vehicle layer asks for its own frames, at most 30 a second in Low graphics. A frame asked for on top at each
  // of the sim's snapshots, 10 a second, took Low graphics over its cap where frames were cheap enough to draw them all: 34–38 a
  // second in a small window. With no bus out, each snapshot drew a frame of nothing new (the fix's review). Shown failing (TS-04)
  // with a frame asked for at every snapshot, and with one at each snapshot while no bus runs.
  it('asks for a frame of its own as the buses start or stop, or as the clock is set while time stands, and none at a snapshot while it runs', async () => {
    const { mounted: board, map } = await mounted();
    map.styleLoaded = true;
    map.fire('load');
    // No line yet: time runs, and nothing on the map moves.
    const idle = vi.spyOn(map, 'triggerRepaint');
    board.setClock(6 * 3_600, 600, 2);
    board.setClock(6 * 3_600 + 60, 600, 2);
    expect(idle).not.toHaveBeenCalled();
    idle.mockRestore();
    // A line with two buses out, so the fleet runs while time does.
    const east = (m: number) => [-71.1 + m / 82_220, 42.35];
    const route = [east(0), east(1_339), east(2_425), east(3_535)];
    const headways = { peak: 1_200, offpeak: 1_200, overnight: null };
    board.setLines(
      [
        {
          ...{ id: 1, name: 'Line 1', colour: '#c0392b', stops: route, stopIds: [1, 2, 3, 4], route, stopAt: [0, 1, 2, 3], stopDistM: [0, 1_339, 2_425, 3_535] },
          ...{ pullOut: [], pullIn: [], settling: null, headways, buses: 2, model: 'sparrow', cycle: 1_539 },
          plan: { timing: { cycle: 1_539, headways, buses: 2 }, oneWayS: 529.5, pullOutS: 0, pullInS: 0 },
        },
      ] as never,
      [] as never,
    );
    const repaint = vi.spyOn(map, 'triggerRepaint');
    board.setClock(12 * 3_600, 0, 2); // set while time stands: a frame
    board.setClock(12 * 3_600, 600, 2); // time starts: a frame
    board.setClock(12 * 3_600 + 60, 600, 2); // two snapshots while it runs: none
    board.setClock(12 * 3_600 + 120, 600, 2);
    board.setClock(12 * 3_600 + 180, 0, 2); // it stops: a frame
    expect(repaint).toHaveBeenCalledTimes(3);
    // Overnight off: at 02:00 every bus is parked, and the layer asks for no frames, so the snapshots ask for none, but for the
    // one that finds the first bus out at 05:00 (the systems audit's twenty-first round; shown failing (TS-04) with no frame asked
    // for there, which leaves the first bus unseen until something else draws a frame).
    board.setClock(2 * 3_600, 600, 3);
    board.setClock(2 * 3_600 + 60, 600, 3);
    repaint.mockClear();
    board.setClock(4 * 3_600, 600, 3);
    board.setClock(4.5 * 3_600, 600, 3);
    expect(repaint).not.toHaveBeenCalled();
    board.setClock(5 * 3_600 + 10, 600, 3);
    expect(repaint).toHaveBeenCalledTimes(1);
  });

  // Low graphics steps the tint at once, as less motion does: MapLibre draws a fade a frame at a time, as fast as the screen takes
  // them, past the buses' cap of 30 a second (the systems audit's twenty-first round). Shown failing (TS-04) with the fade kept.
  it('steps the tint at once in Low graphics', async () => {
    const mounted = await mountMap({} as HTMLElement, city, 'low');
    const map = fake.maps.at(-1)!;
    map.styleLoaded = true;
    map.fire('load');
    (window as unknown as { matchMedia: () => { matches: boolean } }).matchMedia = () => ({ matches: false });
    mounted.setClock(19 * 3_600, 600, 2); // dusk's first step
    expect(map.paint.get('background.background-color-transition')).toEqual({ duration: 0, delay: 0 });
    expect(map.paint.get('background.background-color')).toBe(dim(LIGHT.void, 1));
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
    expect([...map.paint.keys()]).toEqual([]);
    // At dawn, while it rests, its route and stops are mixed with the main roads at the step shown, as the base lightens (the
    // systems audit's twelfth round: opaque, mixed with them at night): once a step, and back to the night's as it wakes at 05:00.
    const mixed = () => [...map.paint.keys()].filter((k) => /^lines-(route|stops)-resting\./.test(k)).sort();
    board.setClock(4 * 3_600 + 40 * 60, 600, 3);
    expect(mixed()).toEqual(['lines-route-resting.line-color', 'lines-stops-resting.circle-color', 'lines-stops-resting.circle-stroke-color']);
    expect(map.paint.get('lines-stops-resting.circle-color')).toBe(restingColour(GAME_LIGHT.stopFill, dim(LIGHT.arterial, 1)));
    map.paint.clear();
    board.setClock(4 * 3_600 + 50 * 60, 600, 3);
    expect(mixed()).toEqual([]);
    board.setClock(5 * 3_600, 600, 3);
    expect(map.filters.get('lines-route-resting')).toEqual(['all', ['==', ['get', 'kind'], 'route'], ['in', ['get', 'id'], ['literal', []]]]);
    expect(map.paint.get('lines-stops-resting.circle-color')).toBe(restingColour(GAME_LIGHT.stopFill, GAME_LIGHT.restingGround));
  });
});

describe('the light theme it is given (the owner’s Nov 8 token pick, tokens.ts)', () => {
  // `?light=paper` (src/platform's lightSwitch) has MapView mount the map in V1's paper: the board's style, the light's steps and
  // the game's overlays all from its tokens, where the warm-neutral set is the default every test above runs on.
  it('draws the board, the light’s steps and the game’s words in V1’s paper when given it', async () => {
    const board = await mountMap({} as HTMLElement, city, 'full', PAPER);
    const map = fake.maps.at(-1)!;
    const made = (id: string, property: string) => map.made.layers.find((l) => l.id === id)?.paint?.[property];
    expect([made('background', 'background-color'), made('earth', 'fill-color')]).toEqual([V1_PAPER.void, V1_PAPER.land]);
    map.styleLoaded = true;
    map.fire('load');
    expect(map.added.get('stops-flag-word')?.paint?.['text-halo-color']).toBe(V1_PAPER.land);
    // The lines' names in the board's inks: with the overlays given the warm board, the paper map named its lines in the warm ink
    // on the warm halo until 19:00 (the review of the token pick).
    expect(map.added.get('lines-name')?.paint).toMatchObject({ 'text-color': V1_PAPER.label, 'text-halo-color': V1_PAPER.labelHalo });
    board.setClock(22 * 3_600, 0, 2);
    expect([map.paint.get('background.background-color'), map.paint.get('earth.fill-color')]).toEqual([dim(V1_PAPER.void, NIGHT_STEP), dim(V1_PAPER.land, NIGHT_STEP)]);
    expect(map.paint.get('lines-name.text-halo-color')).toBe(dim(V1_PAPER.labelHalo, NIGHT_STEP));
  });

  it('draws the warm-neutral set when given none', async () => {
    await mountMap({} as HTMLElement, city, 'full');
    const map = fake.maps.at(-1)!;
    expect(map.made.layers.find((l) => l.id === 'earth')?.paint?.['fill-color']).toBe(LIGHT.land);
  });
});
