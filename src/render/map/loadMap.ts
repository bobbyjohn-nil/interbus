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
import { addOverlays, DOT_LAYER, DOT_LAYERS, FLAG_LAYERS, LINE_LAYERS, setDepotLand, setDepots, setDotKinds, setDots, setDraft, setEvent, setLines, setTint, type DotKinds } from './overlays';
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
  settled,
  toggled,
  type ViewMode,
} from './tilt';
import { GAME_LIGHT, LIGHT } from './tokens';
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
  /** Tilts or flattens the board (tilt.ts), to `pitch` or the mode's own; call it only once the style has loaded. Low graphics stays flat. */
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
  /** How many dots the last settled frame drew. */
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

/** What a click lands on: a line and, at one of its stops, that stop. */
export interface MapHit {
  readonly lineId: number | null;
  readonly stopId: number | null;
}

/** The pointer is reported at most this often. */
const POINTER_EVERY_MS = 100;

/** Q and E turn the board over this long. */
const TURN_MS = 200;

/** Marks the tilt's own camera moves, so their end can be told from a drag's. */
const TILT_MOVE = 'interbusTilt';

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
  const map = new MapLibreMap({
    container,
    style: buildStyle({
      tilesUrl: `pmtiles://${tiles.source.getKey()}`,
      assetBase: assetBase(),
      tokens: LIGHT,
      extent: city.extent,
    }),
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
      for (const [id, visibility] of Object.entries(buildingVisibility(next))) map.setLayoutProperty(id, 'visibility', visibility);
    }, duration);
  };
  // Two fingers turn the board in 3D only: 2D always faces north (D25).
  const touchTurns = (on: boolean) => (on ? map.touchZoomRotate.enableRotation() : map.touchZoomRotate.disableRotation());
  const setMode = (next: ViewMode, pitch?: number, bearing?: number) => {
    if (rung === 'low' && next === '3d') return;
    if (next === mode) {
      if (pitch !== undefined || bearing !== undefined) map.easeTo({ ...(pitch === undefined ? {} : { pitch }), ...(bearing === undefined ? {} : { bearing }), duration: 300 });
      return;
    }
    mode = next;
    fadeBuildings(next);
    touchTurns(next === '3d');
    map.setMinZoom(MIN_ZOOM['2d']);
    // MapLibre jumps instead of easing when the system asks for reduced motion.
    map.easeTo({ ...cameraFor(next, map.getZoom(), bearing ?? map.getBearing()), ...(pitch === undefined ? {} : { pitch }), duration: 600 }, { [TILT_MOVE]: next });
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
  // ease halfway: MapLibre stops the camera whenever a handler takes an event.)
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
    const double = o.button === 0 && o.detail === 2 && !o.ctrlKey && tiltGesture;
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

  // The game's layers go on once the style has loaded; data set before then waits.
  let loaded = false;
  const pending: {
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
  // Every bus, drawn by one custom layer from the lines' day plans (vehicles.ts).
  const fleet = new Fleet();
  map.once('load', () => {
    performance.mark(MAP_LOADED_MARK);
    addOverlays(map, GAME_LIGHT, LIGHT);
    map.addLayer(createVehicleLayer(fleet, rung === 'low' ? LOW_GRAPHICS_FPS : undefined));
    loaded = true;
    if (pending.dots) setDots(map, pending.dots);
    if (pending.lines) setLines(map, pending.lines.lines, pending.lines.stops);
    if (pending.depotLand) setDepotLand(map, pending.depotLand);
    if (pending.depots) setDepots(map, pending.depots);
    if (pending.tint !== undefined) setTint(map, pending.tint);
    if (pending.draft !== undefined) setDraft(map, pending.draft);
    if (pending.dotKinds) setDotKinds(map, pending.dotKinds);
    if (pending.event !== undefined) setEvent(map, pending.event);
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
  map.on('mousemove', (e) => {
    if (!pointer) return;
    latestMove = { at: [e.lngLat.lng, e.lngLat.lat], screen: [e.point.x, e.point.y] };
    const wait = POINTER_EVERY_MS - (performance.now() - lastPointerMs);
    if (wait <= 0) report();
    else trailing ??= window.setTimeout(report, wait);
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
  map.on('click', (e) => {
    if (swallow) return;
    const hits = loaded ? map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: [...FLAG_LAYERS, ...LINE_LAYERS] }) : [];
    const numberOf = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : null);
    const stop = hits.find((h) => numberOf(h.properties?.stop) !== null);
    const line = hits.find((h) => numberOf(h.properties?.id) !== null);
    click?.([e.lngLat.lng, e.lngLat.lat], { lineId: numberOf(line?.properties?.id), stopId: numberOf(stop?.properties?.stop) });
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
      if (loaded) setLines(map, lines, stops);
      else pending.lines = { lines, stops };
    },
    setClock: (second, rate, day) => {
      fleet.setClock(second, rate, performance.now(), day);
      map.triggerRepaint();
    },
    setDepotLand: (rings) => (loaded ? setDepotLand(map, rings) : void (pending.depotLand = rings)),
    setDepots: (depots) => (loaded ? setDepots(map, depots) : void (pending.depots = depots)),
    setTint: (visible) => (loaded ? setTint(map, visible) : void (pending.tint = visible)),
    setDraft: (draft) => (loaded ? setDraft(map, draft) : void (pending.draft = draft)),
    setEvent: (event) => (loaded ? setEvent(map, event) : void (pending.event = event)),
    // Asked of both layers whatever is shown: MapLibre leaves a hidden layer out, so this counts what draws.
    dotsDrawn: () => (loaded ? map.queryRenderedFeatures({ layers: [...DOT_LAYERS] }).length : 0),
    onPointer: (listener) => void (pointer = listener),
    onClick: (listener) => void (click = listener),
    dispose: () => {
      window.clearTimeout(trailing);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(press?.timer);
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      map.remove();
    },
  };
}
