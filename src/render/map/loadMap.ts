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
import type { ContractView, DepotView, Dots, EventView, LineDraftView, LineView, LngLatPair, StopView } from '../../sim/types';
import { Fleet } from './fleet';
import { addOverlays, DOT_LAYERS, FLAG_LAYERS, LINE_LAYERS, setContracts, setDepotLand, setDepots, setDots, setDraft, setEvent, setLines, setTint } from './overlays';
import { buildStyle } from './style';
import { BUILDINGS_2D, BUILDINGS_3D, buildingOpacity, buildingVisibility, cameraFor, CROSS_FADE_MS, draggedPitch, MAX_PITCH, MIN_ZOOM, settled, type ViewMode } from './tilt';
import { GAME_LIGHT, LIGHT } from './tokens';
import { LOW_GRAPHICS_FPS, type GraphicsRung } from './gpu';
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
  /** The mode a right-drag or a two-finger pitch settled on, when it changed (tilt.ts settled). */
  onModeChange(listener: (mode: ViewMode) => void): void;
  /** The game's layers (overlays.ts); safe to call before the style loads. */
  setDots(dots: Dots): void;
  setLines(lines: readonly LineView[], stops: readonly StopView[]): void;
  setDepotLand(rings: readonly (readonly LngLatPair[])[]): void;
  setDepots(depots: readonly DepotView[]): void;
  /** Shows the depot-land tint while a depot is being placed. */
  setTint(visible: boolean): void;
  setDraft(draft: LineDraftView | null): void;
  /** Contracts' rings at their landmarks. */
  setContracts(contracts: readonly ContractView[]): void;
  /** The city event's street, pending or on, or none. */
  setEvent(event: EventView | null): void;
  /** The sim's clock at a snapshot, for the vehicle layer: seconds of the day, game seconds per real second, and the game day. */
  setClock(second: number, rate: number, day: number): void;
  /** How many dots the last settled frame drew. */
  dotsDrawn(): number;
  /** Where the pointer is over the map (null when it leaves), at most every 100 ms and always its last position. */
  onPointer(listener: (at: LngLatPair | null, screen: [number, number] | null) => void): void;
  /** Where a click lands on the map (not a drag), and the line and the stop drawn under it, if any. */
  onClick(listener: (at: LngLatPair, hit: MapHit) => void): void;
  dispose(): void;
}

/** What a click lands on: a line and, at one of its stops, that stop. */
export interface MapHit {
  readonly lineId: number | null;
  readonly stopId: number | null;
}

/** The pointer is reported at most this often. */
const POINTER_EVERY_MS = 100;

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
    // Only the T key pitches the board until week 10's chip and right-drag (tilt.ts).
    pitch: 0,
    maxPitch: MAX_PITCH,
    dragRotate: false,
    pitchWithRotate: false,
    // Two fingers pitch the board; a right-drag does too, below (the M5 spec, item 6). Low graphics stays flat.
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
  const setMode = (next: ViewMode, pitch?: number) => {
    if (rung === 'low' && next === '3d') return;
    if (next === mode) {
      if (pitch !== undefined) map.easeTo({ pitch, duration: 300 });
      return;
    }
    mode = next;
    fadeBuildings(next);
    map.setMinZoom(MIN_ZOOM['2d']);
    // MapLibre jumps instead of easing when the system asks for reduced motion.
    map.easeTo({ ...cameraFor(next, map.getZoom()), ...(pitch === undefined ? {} : { pitch }), duration: 600 }, { [TILT_MOVE]: next });
  };

  // A right-drag pitches the board, and a two-finger pitch too; released, either settles: flat below
  // 12°, else 3D at 25–60° (tilt.ts). A change of mode is reported so the chip follows.
  let modeListener: ((mode: ViewMode) => void) | null = null;
  const settle = (pitch: number) => {
    const to = settled(pitch);
    const changed = to.mode !== mode;
    setMode(to.mode, to.pitch);
    if (changed) modeListener?.(to.mode);
  };
  let drag: { y: number; pitch: number } | null = null;
  const box = map.getCanvasContainer();
  const onContextMenu = (e: MouseEvent) => e.preventDefault();
  const onDragStart = (e: MouseEvent) => {
    if (e.button !== 2 || rung === 'low') return;
    e.preventDefault();
    drag = { y: e.clientY, pitch: map.getPitch() };
  };
  const onDragMove = (e: MouseEvent) => {
    if (drag) map.setPitch(draggedPitch(drag.pitch, drag.y, e.clientY));
  };
  const onDragEnd = (e: MouseEvent) => {
    if (!drag || e.button !== 2) return;
    drag = null;
    settle(map.getPitch());
  };
  box.addEventListener('contextmenu', onContextMenu);
  box.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
  map.on('pitchend', (e) => {
    if (e.originalEvent && 'touches' in e.originalEvent) settle(map.getPitch());
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
    contracts?: readonly ContractView[];
    event?: EventView | null;
  } = {};
  // Every bus, drawn by one custom layer from the lines' day plans (vehicles.ts).
  const fleet = new Fleet();
  map.once('load', () => {
    addOverlays(map, GAME_LIGHT, LIGHT);
    map.addLayer(createVehicleLayer(fleet, rung === 'low' ? LOW_GRAPHICS_FPS : undefined));
    loaded = true;
    if (pending.dots) setDots(map, pending.dots);
    if (pending.lines) setLines(map, pending.lines.lines, pending.lines.stops);
    if (pending.depotLand) setDepotLand(map, pending.depotLand);
    if (pending.depots) setDepots(map, pending.depots);
    if (pending.tint !== undefined) setTint(map, pending.tint);
    if (pending.draft !== undefined) setDraft(map, pending.draft);
    if (pending.contracts) setContracts(map, pending.contracts);
    if (pending.event !== undefined) setEvent(map, pending.event);
  });

  // At most one pointer report every 100 ms, and always the last one: a move inside the interval is
  // sent when it ends, so a card beside a resting pointer describes where it rests.
  let pointer: ((at: LngLatPair | null, screen: [number, number] | null) => void) | null = null;
  let lastPointerMs = -Infinity;
  let trailing: number | undefined;
  let latestMove: { at: LngLatPair; screen: [number, number] } | null = null;
  const report = () => {
    trailing = undefined;
    lastPointerMs = performance.now();
    if (latestMove) pointer?.(latestMove.at, latestMove.screen);
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
    pointer?.(null, null);
  });
  let click: ((at: LngLatPair, hit: MapHit) => void) | null = null;
  // MapLibre fires 'click' only when the pointer did not drag between press and release. A stop
  // under the pointer wins over the line it sits on.
  map.on('click', (e) => {
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
    setDots: (dots) => (loaded ? setDots(map, dots) : void (pending.dots = dots)),
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
    setContracts: (contracts) => (loaded ? setContracts(map, contracts) : void (pending.contracts = contracts)),
    setEvent: (event) => (loaded ? setEvent(map, event) : void (pending.event = event)),
    dotsDrawn: () => (loaded ? map.queryRenderedFeatures({ layers: [...DOT_LAYERS] }).length : 0),
    onPointer: (listener) => void (pointer = listener),
    onClick: (listener) => void (click = listener),
    dispose: () => {
      window.clearTimeout(trailing);
      window.clearTimeout(fadeTimer);
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      map.remove();
    },
  };
}
