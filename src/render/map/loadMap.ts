// The lazy map chunk: MapLibre, PMTiles and the style generator load only when the board opens,
// so the menu stays small (PLAN §6, I14).
import { addProtocol, Map as MapLibreMap, setWorkerUrl, type ErrorEvent } from 'maplibre-gl';
// MapLibre 6 finds its worker beside its own module, which bundling moves; Vite builds the worker
// as its own file and gives us its URL instead (it is a module worker, hence worker.format 'es').
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FileSource, PMTiles, Protocol } from 'pmtiles';
import { assetBase, assetGone, openCityFile, reportReplaced } from '../../platform';
import { CityFetchSource } from './cityTiles';
import { paddedBounds, type City } from '../../cities';
import type { DepotView, Dots, EventView, LineDraftView, LineView, LngLatPair, StopView } from '../../sim/types';
import { Fleet } from './fleet';
import { darkStep, DAYLIGHT_FADE_MS, daylightPaints, dimmed, NIGHT_STEP, paintsAcross } from './daylight';
import { addOverlays, DOT_LAYER, DOT_LAYERS, FLAG_LAYERS, LINE_LAYERS, overlayLayers, RESTING_LAYERS, restingLines, restingStops, setDepotLand, setDepots, setDotKinds, setDots, setDraft, setEvent, setLines, setResting, setTint, type DotKinds, type PaintName } from './overlays';
import { dotRadiusPx, pickDot, PICK_SLOP_PX, type DotKind } from './pick';
import { buildStyle } from './style';
import {
  BUILDINGS_2D,
  BUILDINGS_3D,
  buildingOpacity,
  buildingVisibility,
  cameraFor,
  CROSS_FADE_MS,
  draggedBearing,
  draggedPitch,
  holdOutcome,
  HOLD_TOGGLE_MS,
  MAX_PITCH,
  MIN_ZOOM,
  normalBearing,
  resettle,
  settled,
  toggled,
  type ViewMode,
} from './tilt';
import { GAME_LIGHT, LIGHT, type MapTokens } from './tokens';
import { LOW_GRAPHICS_FPS, type GraphicsRung } from './gpu';
import { MAP_LOADED_MARK } from './status';
import { createVehicleLayer } from './vehicles';

let protocol: Protocol | null = null;

function pmtilesProtocol(): Protocol {
  if (!protocol) {
    setWorkerUrl(mapWorkerUrl);
    protocol = new Protocol();
    addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

export interface MountedMap {
  readonly map: MapLibreMap;
  readonly tileReads: 'range' | 'whole';
  /** Tilts or flattens the board (tilt.ts), to `pitch` or the mode's own; before the style has loaded the buildings follow once it has. Low graphics stays flat. */
  setMode(mode: ViewMode, pitch?: number): void;
  /** The mode a drag, a held double-click or a two-finger pitch settled on, when it changed (tilt.ts settled). */
  onModeChange(listener: (mode: ViewMode) => void): void;
  /** Whether a double-click held on the map tilts it: only while no tool is out, since a tool's first click is a real one. */
  setTiltGesture(on: boolean): void;
  /** Turns the board back to north. */
  faceNorth(): void;
  /** Turns the board `degrees` (3D only; 2D always faces north). */
  turn(degrees: number): void;
  /** The game's layers (overlays.ts); safe to call before the style loads. */
  setDots(dots: Dots): void;
  /** Which kinds of dot show; the pointer finds only those shown. */
  setDotKinds(shown: DotKinds): void;
  setLines(lines: readonly LineView[], stops: readonly StopView[]): void;
  setDepotLand(rings: readonly (readonly LngLatPair[])[]): void;
  setDepots(depots: readonly DepotView[]): void;
  /** Shows the depot-land tint while a depot is being placed. */
  setTint(visible: boolean): void;
  setDraft(draft: LineDraftView | null): void;
  /** The city event's street, pending or on, or none. */
  setEvent(event: EventView | null): void;
  /** The sim's clock at a snapshot, for the vehicle layer: seconds of the day, game seconds per real second, and the game day. */
  setClock(second: number, rate: number, day: number): void;
  /** How many distinct dots the last settled frame drew. */
  dotsDrawn(): number;
  /** Where the pointer is over the map (null when it leaves), and the dot it is on, if any: at most every 100 ms and always its last position. */
  onPointer(listener: (at: LngLatPair | null, screen: [number, number] | null, dot: HoveredDot | null) => void): void;
  /** Where a click lands on the map (not a drag), and the line and the stop drawn under it, if any. */
  onClick(listener: (at: LngLatPair, hit: MapHit) => void): void;
  dispose(): void;
}

/** A demand dot under the pointer: its kind, its place in its kind's list, where it is and its people. */
export interface HoveredDot {
  readonly kind: DotKind;
  readonly i: number;
  readonly at: LngLatPair;
  readonly w: number;
}

/** What a click lands on: a line and, at one of its stops, that stop; and whether it is a double-click's second click. */
export interface MapHit {
  readonly lineId: number | null;
  /** Every line under the click, the topmost first as the map draws them: lines on the same streets draw over one another. */
  readonly lineIds: readonly number[];
  readonly stopId: number | null;
  readonly double: boolean;
}

/** The pointer is reported at most this often. */
const POINTER_EVERY_MS = 100;

/** Q and E turn the board over this long. */
const TURN_MS = 200;

/** Marks the tilt's own camera moves, so their end can be told from a drag's. */
const TILT_MOVE = 'interbusTilt';
/** How often full graphics reads the screen's density, so the map follows a window moved to a screen of another (mountMap). */
const DENSITY_EVERY_MS = 1_000;

/** `rung` is the GPU ladder's (gpu.ts): Low graphics draws at one pixel a pixel and the buses at most 30 times a second. */
export async function mountMap(container: HTMLElement, city: City, rung: Exclude<GraphicsRung, 'none'> = 'full'): Promise<MountedMap> {
  if (!city.tiles) throw new Error(`${city.name} has no tile file in this build`);
  // MapLibre only logs a worker that fails to load and then waits forever; check it exists first.
  if (await assetGone(mapWorkerUrl)) {
    reportReplaced('worker');
    throw new Error('map worker gone');
  }
  const file = await openCityFile(`cities/${city.tiles.file}`);
  const tiles =
    file.kind === 'range'
      ? new PMTiles(new CityFetchSource(file.url))
      : new PMTiles(new FileSource(new File([file.blob], city.tiles.file)));
  pmtilesProtocol().add(tiles);

  const [w, s, e, n] = paddedBounds(city.extent);
  // The board's style from a token set: the light tokens by day, and dimmed for each step of the light (daylight.ts).
  const styleOf = (tokens: MapTokens) => buildStyle({ tilesUrl: `pmtiles://${tiles.source.getKey()}`, assetBase: assetBase(), tokens, extent: city.extent });
  const map = new MapLibreMap({
    container,
    style: styleOf(LIGHT),
    center: [city.view.center[0], city.view.center[1]],
    zoom: city.view.zoom,
    minZoom: MIN_ZOOM['2d'],
    maxZoom: 18,
    maxBounds: [w, s, e, n],
    pitch: 0,
    maxPitch: MAX_PITCH,
    // The drags below pitch and turn the board themselves (tilt.ts), so MapLibre's own stay off.
    dragRotate: false,
    pitchWithRotate: false,
    // Two fingers pitch the board, and in 3D turn it too (setMode). Low graphics stays flat.
    touchPitch: rung !== 'low',
    attributionControl: false,
    ...(rung === 'low' ? { pixelRatio: 1 } : {}),
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  // MapLibre resizes its canvas only when the container's box changes, so a window moved to a screen of another density kept the
  // old screen's canvas, blurry on a sharper one (the systems audit's seventh round). The density is read each second, and a
  // change resizes the map: a resolution media query's change event, the usual watch, never came in CI's browser, though
  // devicePixelRatio had changed. Low graphics draws at 1 on every screen.
  if (rung !== 'low') {
    let density = window.devicePixelRatio;
    const timer = window.setInterval(() => {
      if (window.devicePixelRatio === density) return;
      density = window.devicePixelRatio;
      map.resize();
    }, DENSITY_EVERY_MS);
    map.once('remove', () => window.clearInterval(timer));
  }

  map.on('error', (event: ErrorEvent) => {
    // Tile 404s are reported by CityFetchSource, and a whole-file read reports its own; a 404 that
    // reaches here is another of this build's files. (MapLibre 6 never raises glyph 404s: it draws
    // those labels with a local font.) Listening stops MapLibre logging its errors, so everything
    // else is logged here for the console and the e2e tests to see.
    const status = (event.error as { status?: number } | undefined)?.status;
    if (status === 404 || status === 410) reportReplaced('city-file');
    else console.error(event.error);
  });

  let mode: ViewMode = '2d';
  // The pitch the last change of mode went to: a 3D one cut short finishes there (resettle, below).
  let aimPitch = 0;
  map.on('moveend', (event) => {
    // 3D raises the zoom floor only once its own ease has ended (or a drag cut it short): raising it
    // sooner would jump the camera and stop the ease short of 50°. MapLibre copies easeTo's event
    // data onto the move's events.
    const tilt = (event as { [TILT_MOVE]?: ViewMode })[TILT_MOVE];
    if (tilt === '3d' && mode === '3d') map.setMinZoom(MIN_ZOOM['3d']);
  });
  // The buildings cross-fade once per mode change, never per frame (RN-04): both layers draw while
  // MapLibre runs the opacity transitions, then the faded one stops. Reduced motion swaps at once.
  let fadeTimer: number | undefined;
  const fadeBuildings = (next: ViewMode) => {
    // Before the style has loaded, or while the graphics are lost, there is no style to fade: the
    // buildings follow the mode once it has loaded (below).
    if (!loaded) return;
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : CROSS_FADE_MS;
    const opacity = buildingOpacity(next);
    window.clearTimeout(fadeTimer);
    map.setLayoutProperty(BUILDINGS_2D, 'visibility', 'visible');
    map.setLayoutProperty(BUILDINGS_3D, 'visibility', 'visible');
    map.setPaintProperty(BUILDINGS_2D, 'fill-opacity-transition', { duration, delay: 0 });
    map.setPaintProperty(BUILDINGS_3D, 'fill-extrusion-opacity-transition', { duration, delay: 0 });
    map.setPaintProperty(BUILDINGS_2D, 'fill-opacity', opacity[BUILDINGS_2D]);
    map.setPaintProperty(BUILDINGS_3D, 'fill-extrusion-opacity', opacity[BUILDINGS_3D]);
    fadeTimer = window.setTimeout(() => {
      if (loaded) for (const [id, visibility] of Object.entries(buildingVisibility(next))) map.setLayoutProperty(id, 'visibility', visibility);
    }, duration);
  };
  // The buildings as `next` shows them, at once, for a style that comes back after a loss: a cross-fade
  // there would make the extrusions visible for its length and build them in every tile for nothing.
  const setBuildings = (next: ViewMode) => {
    window.clearTimeout(fadeTimer);
    const opacity = buildingOpacity(next);
    map.setPaintProperty(BUILDINGS_2D, 'fill-opacity', opacity[BUILDINGS_2D]);
    map.setPaintProperty(BUILDINGS_3D, 'fill-extrusion-opacity', opacity[BUILDINGS_3D]);
    for (const [id, visibility] of Object.entries(buildingVisibility(next))) map.setLayoutProperty(id, 'visibility', visibility);
  };
  // Two fingers turn the board in 3D only: 2D always faces north (D25).
  const touchTurns = (on: boolean) => (on ? map.touchZoomRotate.enableRotation() : map.touchZoomRotate.disableRotation());
  const setMode = (next: ViewMode, pitch?: number, bearing?: number) => {
    if (rung === 'low' && next === '3d') return;
    if (next === mode) {
      if (pitch !== undefined || bearing !== undefined) map.easeTo({ ...(pitch === undefined ? {} : { pitch }), ...(bearing === undefined ? {} : { bearing }), duration: 300 });
      if (pitch !== undefined) aimPitch = pitch;
      return;
    }
    mode = next;
    fadeBuildings(next);
    touchTurns(next === '3d');
    map.setMinZoom(MIN_ZOOM['2d']);
    const to = { ...cameraFor(next, map.getZoom(), bearing ?? map.getBearing()), ...(pitch === undefined ? {} : { pitch }) };
    aimPitch = to.pitch;
    // MapLibre jumps instead of easing when the system asks for reduced motion.
    map.easeTo({ ...to, duration: 600 }, { [TILT_MOVE]: next });
  };

  // Released, a drag or a two-finger pitch settles: flat and facing north below 12°, else 3D at
  // 25–60° (tilt.ts). A change of mode is reported so the compass follows.
  let modeListener: ((mode: ViewMode) => void) | null = null;
  const settle = (pitch: number, bearing: number) => {
    const to = settled(pitch, bearing);
    const changed = to.mode !== mode;
    setMode(to.mode, to.pitch, to.bearing);
    if (changed) modeListener?.(to.mode);
  };
  const flip = () => {
    const next = toggled(mode);
    setMode(next);
    modeListener?.(next);
  };

  // The drags (D25): a right-drag, a Ctrl-drag (a Mac's right-drag) or a double-click whose second
  // press is held and dragged. Up tilts, down flattens; in 3D sideways turns. A double-click held still
  // for half a second flips 2D and 3D; a quick one still zooms, as MapLibre always did. Claiming the
  // press (preventDefault on MapLibre's mousedown) keeps MapLibre's own pan off it; a held or dragged
  // double-click then swallows the click that would open a card, and turns MapLibre's double-click
  // zoom off until its dblclick has passed. (Preventing that dblclick instead would stop the flip's
  // ease halfway: MapLibre stops the camera whenever a handler takes an event.) A second press is a
  // double-click's only when the map heard the click before it, as for its click (heardLast, below):
  // after a double-click's first click on a button that took itself away (Home's Continue), it is a
  // press of its own, and neither tilts nor flips.
  type Press = { readonly button: number; readonly double: boolean; readonly x: number; readonly y: number; readonly pitch: number; readonly bearing: number; readonly turns: boolean; dragging: boolean; timer?: number };
  let press: Press | null = null;
  let swallow = false;
  const swallowing = (on: boolean) => {
    swallow = on;
    if (on) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  };
  let tiltGesture = true;
  const box = map.getCanvasContainer();
  const onContextMenu = (e: MouseEvent) => e.preventDefault();
  box.addEventListener('contextmenu', onContextMenu);
  map.on('mousedown', (e) => {
    const o = e.originalEvent;
    if (o.detail !== 2 && swallow) swallowing(false);
    if (rung === 'low') return;
    const double = o.button === 0 && o.detail === 2 && heardLast && !o.ctrlKey && tiltGesture;
    if (!(o.button === 2 || (o.button === 0 && o.ctrlKey) || double)) return;
    e.preventDefault();
    press = { button: o.button, double, x: o.clientX, y: o.clientY, pitch: map.getPitch(), bearing: map.getBearing(), turns: mode === '3d', dragging: false };
    if (double) {
      const held = press;
      held.timer = window.setTimeout(() => {
        if (press !== held || held.dragging) return;
        press = null;
        swallowing(true);
        flip();
      }, HOLD_TOGGLE_MS);
    }
  });
  const onDragMove = (e: MouseEvent) => {
    if (!press) return;
    if (!press.dragging && holdOutcome(Math.hypot(e.clientX - press.x, e.clientY - press.y), 0) !== 'drag') return;
    if (!press.dragging) {
      press.dragging = true;
      window.clearTimeout(press.timer);
      if (press.double) swallowing(true);
    }
    map.jumpTo({ pitch: draggedPitch(press.pitch, press.y, e.clientY), ...(press.turns ? { bearing: draggedBearing(press.bearing, press.x, e.clientX) } : {}) });
  };
  const onDragEnd = (e: MouseEvent) => {
    if (!press || e.button !== press.button) return;
    const ended = press;
    press = null;
    window.clearTimeout(ended.timer);
    if (ended.dragging) settle(map.getPitch(), map.getBearing());
  };
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
  // The zoom comes back once this dblclick has passed every handler (the zoom's runs after this one).
  map.on('dblclick', () => {
    if (swallow) window.setTimeout(() => swallowing(false), 0);
  });
  map.on('pitchend', (e) => {
    if (e.originalEvent && 'touches' in e.originalEvent) settle(map.getPitch(), map.getBearing());
  });
  // A move that cuts a mode change's ease short (Q, E, N, a pan, a zoom) leaves the camera between the
  // modes: 3D flat, or 2D tilted and turned. Once the camera rests, the change finishes (resettle).
  // MapLibre ends the cut-short move just before the new one starts, so the check waits for the next
  // frame, by which the new move is under way; started in the frame that ends the last move, the
  // finishing ease keeps that frame from reporting the map idle.
  let resting = false;
  map.on('moveend', () => {
    if (resting) return;
    resting = true;
    map.once('render', () => {
      resting = false;
      const fix = press?.dragging || map.isMoving() ? null : resettle(mode, map.getPitch(), map.getBearing(), aimPitch);
      if (fix) map.easeTo({ ...fix, duration: 300 }, { [TILT_MOVE]: mode });
    });
  });

  // The game's layers go on once the style has loaded; data set before then waits, and so does data set
  // while the graphics are lost (below).
  let loaded = false;
  let pending: {
    dots?: Dots;
    lines?: { lines: readonly LineView[]; stops: readonly StopView[] };
    depotLand?: readonly (readonly LngLatPair[])[];
    depots?: readonly DepotView[];
    tint?: boolean;
    draft?: LineDraftView | null;
    dotKinds?: DotKinds;
    event?: EventView | null;
  } = {};
  let shownKinds: DotKinds = { home: true, job: true };
  // The day and night tint (daylight.ts): every paint the light's steps change, the board's and the game's names and translucent
  // marks alike, worked out once. The style loads by day; a step is set when the sim's clock reaches it (setClock), with MapLibre's
  // transition for its fade, or at once with less motion asked for, as the style loads, or as it comes back after a loss.
  const lightPaints = [
    ...daylightPaints(styleOf, LIGHT),
    ...paintsAcross(Array.from({ length: NIGHT_STEP + 1 }, (_, step) => overlayLayers(GAME_LIGHT, dimmed(LIGHT, step), step))),
  ];
  let light = 0;
  let lightWanted = 0;
  let lightSets = 0;
  map.getContainer().dataset.daylight = String(light);
  const showLight = (step: number, fade: boolean) => {
    const duration = fade && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? DAYLIGHT_FADE_MS : 0;
    for (const { layer, property, values } of lightPaints) {
      if (!map.getLayer(layer)) continue;
      map.setPaintProperty(layer, `${property}-transition` as PaintName, { duration, delay: 0 });
      map.setPaintProperty(layer, property as PaintName, values[step] as never);
    }
    light = step;
    // For the e2e tests: the step shown, how many times the light has been set, never once a frame (RN-04), and its fade.
    const box = map.getContainer().dataset;
    box.daylight = String(step);
    box.daylightSets = String(++lightSets);
    box.daylightFade = String(duration);
  };
  // Every bus, drawn by one custom layer from the lines' day plans (vehicles.ts).
  const fleet = new Fleet();
  // The lines resting now (restingLines: overnight off, from their last bus's return after 00:00 until 05:00), faded with the flags
  // of the stops only they call at; set only when they change.
  let clockSecond: number | null = null;
  let linesNow: readonly LineView[] = [];
  let stopsNow: readonly StopView[] = [];
  let restingShown = '|';
  const rest = () => {
    if (!loaded || clockSecond === null) return;
    const ids = restingLines(linesNow, clockSecond, (id) => fleet.inService(id));
    const stops = restingStops(stopsNow, ids);
    const key = `${ids.join(' ')}|${stops.join(' ')}`;
    if (key === restingShown) return;
    setResting(map, ids, stops);
    restingShown = key;
    map.getContainer().dataset.resting = ids.join(' ');
  };
  const addVehicles = () => map.addLayer(createVehicleLayer(fleet, rung === 'low' ? LOW_GRAPHICS_FPS : undefined));
  const flush = () => {
    loaded = true;
    const waiting = pending;
    pending = {};
    if (waiting.dots) setDots(map, waiting.dots);
    if (waiting.lines) setLines(map, waiting.lines.lines, waiting.lines.stops);
    if (waiting.depotLand) setDepotLand(map, waiting.depotLand);
    if (waiting.depots) setDepots(map, waiting.depots);
    if (waiting.tint !== undefined) setTint(map, waiting.tint);
    if (waiting.draft !== undefined) setDraft(map, waiting.draft);
    if (waiting.dotKinds) setDotKinds(map, waiting.dotKinds);
    if (waiting.event !== undefined) setEvent(map, waiting.event);
    if (lightWanted !== light) showLight(lightWanted, false);
    rest();
  };
  let overlaid = false;
  map.once('load', () => {
    performance.mark(MAP_LOADED_MARK);
    addOverlays(map, GAME_LIGHT, LIGHT);
    addVehicles();
    overlaid = true;
    flush();
    // A drag or a two-finger pitch may have settled in 3D while the style loaded: its buildings stand up now.
    if (mode === '3d') fadeBuildings(mode);
  });
  // A lost context takes MapLibre's style with it, and until one is back the game's data waits as
  // before the first load, so nothing pressed meanwhile reaches a style that is not there. MapLibre
  // 6.11.2 (src/ui/map.ts _contextRestored) calls setStyle with the style it kept at the loss before
  // it fires 'webglcontextrestored', and that style loads a frame later: it holds the game's layers as
  // they were, but no custom layer, so once it loads the buses' layer goes back on and the buildings
  // follow the mode. A style lost again before it had loaded is not kept, so the map comes back with
  // none: the board stays blank, and MapView keeps the card with Reload.
  const restore = () => {
    addVehicles();
    flush();
    setBuildings(mode);
  };
  // A restore whose style was lost again before it loaded never fires: its listener goes with the loss.
  map.on('webglcontextlost', () => {
    loaded = false;
    map.off('style.load', restore);
  });
  map.on('webglcontextrestored', () => {
    if (overlaid && map.style) map.once('style.load', restore);
  });

  // Where Q and E are turning the board to, until the turn ends.
  let aim = { bearing: 0, until: -Infinity };

  // The demand dot under a point on screen, of the kinds shown (pick.ts).
  const dotAt = ([x, y]: [number, number]): HoveredDot | null => {
    const layers = (['home', 'job'] as const).filter((k) => shownKinds[k]).map((k) => DOT_LAYER[k]);
    if (!loaded || !layers.length) return null;
    const zoom = map.getZoom();
    const near = map.queryRenderedFeatures([[x - PICK_SLOP_PX, y - PICK_SLOP_PX], [x + PICK_SLOP_PX, y + PICK_SLOP_PX]], { layers });
    const candidates = near.flatMap((f) => {
      const { kind, i, w } = f.properties as { kind?: DotKind; i?: number; w?: number };
      if ((kind !== 'home' && kind !== 'job') || typeof i !== 'number' || typeof w !== 'number' || f.geometry.type !== 'Point') return [];
      const at = f.geometry.coordinates as [number, number];
      const p = map.project(at);
      return [{ kind, i, w, at, x: p.x, y: p.y, radiusPx: dotRadiusPx(w, zoom) }];
    });
    const hit = pickDot(candidates, [x, y]);
    return hit && { kind: hit.kind, i: hit.i, at: hit.at, w: hit.w };
  };

  // At most one pointer report every 100 ms, and always the last one: a move inside the interval is
  // sent when it ends, so a card beside a resting pointer describes where it rests.
  let pointer: ((at: LngLatPair | null, screen: [number, number] | null, dot: HoveredDot | null) => void) | null = null;
  let lastPointerMs = -Infinity;
  let trailing: number | undefined;
  let latestMove: { at: LngLatPair; screen: [number, number] } | null = null;
  const report = () => {
    trailing = undefined;
    lastPointerMs = performance.now();
    if (latestMove) pointer?.(latestMove.at, latestMove.screen, dotAt(latestMove.screen));
  };
  const soon = () => {
    const wait = POINTER_EVERY_MS - (performance.now() - lastPointerMs);
    if (wait <= 0) report();
    else trailing ??= window.setTimeout(report, wait);
  };
  map.on('mousemove', (e) => {
    if (!pointer) return;
    latestMove = { at: [e.lngLat.lng, e.lngLat.lat], screen: [e.point.x, e.point.y] };
    soon();
  });
  // The camera moving under a resting pointer (the keys, Q and E, an ease) puts another place under
  // it: reported as a move, so a dot's card goes once its dot has moved away (D25: only on a dot).
  map.on('move', () => {
    if (!pointer || !latestMove) return;
    const at = map.unproject(latestMove.screen);
    latestMove = { at: [at.lng, at.lat], screen: latestMove.screen };
    soon();
  });
  map.getCanvas().addEventListener('mouseleave', () => {
    window.clearTimeout(trailing);
    trailing = undefined;
    latestMove = null;
    pointer?.(null, null, null);
  });
  let click: ((at: LngLatPair, hit: MapHit) => void) | null = null;
  // MapLibre fires 'click' only when the pointer did not drag between press and release. A stop
  // under the pointer wins over the line it sits on. A double-click held to flip the view clicks nothing.
  // A double-click's second click counts as one only when the map heard the click just before it:
  // after a press that only closed a menu, or a click a held double-click swallowed, the next click is
  // a click of its own. Every click on the page passes the window first, the dropped ones included.
  let heardLast = false;
  let heardBefore = false;
  const onAnyClick = () => {
    heardBefore = heardLast;
    heardLast = false;
  };
  window.addEventListener('click', onAnyClick, true);
  map.on('click', (e) => {
    if (swallow) return;
    const double = e.originalEvent.detail > 1 && heardBefore;
    heardLast = true;
    const hits = loaded ? map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: [...FLAG_LAYERS, ...LINE_LAYERS, 'lines-name', ...RESTING_LAYERS] }) : [];
    const numberOf = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : null);
    const stop = hits.find((h) => numberOf(h.properties?.stop) !== null);
    const lineIds = [...new Set(hits.map((h) => numberOf(h.properties?.id)).filter((id): id is number => id !== null))];
    click?.([e.lngLat.lng, e.lngLat.lat], { lineId: lineIds[0] ?? null, lineIds, stopId: numberOf(stop?.properties?.stop), double });
  });

  return {
    map,
    tileReads: file.kind,
    setMode,
    onModeChange: (listener) => void (modeListener = listener),
    setTiltGesture: (on) => void (tiltGesture = on),
    faceNorth: () => void map.easeTo({ bearing: 0, duration: 300 }),
    turn: (degrees) => {
      if (mode !== '3d') return;
      // A key pressed again mid-turn turns on from where the last turn is going, not from where it is.
      const from = performance.now() < aim.until ? aim.bearing : map.getBearing();
      aim = { bearing: normalBearing(from + degrees), until: performance.now() + TURN_MS };
      map.easeTo({ bearing: aim.bearing, duration: TURN_MS });
    },
    setDots: (dots) => (loaded ? setDots(map, dots) : void (pending.dots = dots)),
    setDotKinds: (shown) => {
      shownKinds = shown;
      if (loaded) setDotKinds(map, shown);
      else pending.dotKinds = shown;
    },
    setLines: (lines, stops) => {
      fleet.setLines(lines);
      map.triggerRepaint();
      linesNow = lines;
      stopsNow = stops;
      if (loaded) setLines(map, lines, stops);
      else pending.lines = { lines, stops };
      rest();
    },
    setClock: (second, rate, day) => {
      fleet.setClock(second, rate, performance.now(), day);
      map.triggerRepaint();
      clockSecond = second;
      lightWanted = darkStep(second);
      if (loaded && lightWanted !== light) showLight(lightWanted, true);
      rest();
    },
    setDepotLand: (rings) => (loaded ? setDepotLand(map, rings) : void (pending.depotLand = rings)),
    setDepots: (depots) => (loaded ? setDepots(map, depots) : void (pending.depots = depots)),
    setTint: (visible) => (loaded ? setTint(map, visible) : void (pending.tint = visible)),
    setDraft: (draft) => (loaded ? setDraft(map, draft) : void (pending.draft = draft)),
    setEvent: (event) => (loaded ? setEvent(map, event) : void (pending.event = event)),
    // Asked of both layers whatever is shown: MapLibre leaves a hidden layer out, so this counts what draws.
    // Distinct dots: a dot near a tile's edge is drawn in each tile it reaches, and counted once.
    dotsDrawn: () => (loaded ? new Set(map.queryRenderedFeatures({ layers: [...DOT_LAYERS] }).map((f) => `${f.properties.kind}:${f.properties.i}`)).size : 0),
    onPointer: (listener) => void (pointer = listener),
    onClick: (listener) => void (click = listener),
    dispose: () => {
      window.clearTimeout(trailing);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(press?.timer);
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('click', onAnyClick, true);
      map.remove();
    },
  };
}
