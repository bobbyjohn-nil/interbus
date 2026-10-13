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
import type { DepotView, Dots, LineDraftView, LineView, LngLatPair } from '../../sim/types';
import { addOverlays, DOT_LAYERS, setDepotLand, setDepots, setDots, setDraft, setLines, setTint } from './overlays';
import { buildStyle } from './style';
import { buildingVisibility, cameraFor, MAX_PITCH, MIN_ZOOM, type ViewMode } from './tilt';
import { GAME_LIGHT, LIGHT } from './tokens';

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
  /** Tilts or flattens the board (tilt.ts); call it only once the style has loaded. */
  setMode(mode: ViewMode): void;
  /** The game's layers (overlays.ts); safe to call before the style loads. */
  setDots(dots: Dots): void;
  setLines(lines: readonly LineView[]): void;
  setDepotLand(rings: readonly (readonly LngLatPair[])[]): void;
  setDepots(depots: readonly DepotView[]): void;
  /** Shows the depot-land tint while a depot is being placed. */
  setTint(visible: boolean): void;
  setDraft(draft: LineDraftView | null): void;
  /** How many dots the last settled frame drew. */
  dotsDrawn(): number;
  /** Where the pointer is over the map (null when it leaves), at most every 100 ms. */
  onPointer(listener: (at: LngLatPair | null, screen: [number, number] | null) => void): void;
  /** Where a click lands on the map (not a drag). */
  onClick(listener: (at: LngLatPair) => void): void;
  dispose(): void;
}

/** Marks the tilt's own camera moves, so their end can be told from a drag's. */
const TILT_MOVE = 'interbusTilt';

export async function mountMap(container: HTMLElement, city: City): Promise<MountedMap> {
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
    touchPitch: false,
    attributionControl: false,
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
  const setMode = (next: ViewMode) => {
    if (next === mode) return;
    mode = next;
    // Once per mode change, never per frame (RN-04); week 10 cross-fades instead.
    for (const [id, visibility] of Object.entries(buildingVisibility(next))) map.setLayoutProperty(id, 'visibility', visibility);
    map.setMinZoom(MIN_ZOOM['2d']);
    // MapLibre jumps instead of easing when the system asks for reduced motion.
    map.easeTo({ ...cameraFor(next, map.getZoom()), duration: 600 }, { [TILT_MOVE]: next });
  };

  // The game's layers go on once the style has loaded; data set before then waits.
  let loaded = false;
  const pending: {
    dots?: Dots;
    lines?: readonly LineView[];
    depotLand?: readonly (readonly LngLatPair[])[];
    depots?: readonly DepotView[];
    tint?: boolean;
    draft?: LineDraftView | null;
  } = {};
  map.once('load', () => {
    addOverlays(map, GAME_LIGHT);
    loaded = true;
    if (pending.dots) setDots(map, pending.dots);
    if (pending.lines) setLines(map, pending.lines);
    if (pending.depotLand) setDepotLand(map, pending.depotLand);
    if (pending.depots) setDepots(map, pending.depots);
    if (pending.tint !== undefined) setTint(map, pending.tint);
    if (pending.draft !== undefined) setDraft(map, pending.draft);
  });

  let pointer: ((at: LngLatPair | null, screen: [number, number] | null) => void) | null = null;
  let lastPointerMs = 0;
  map.on('mousemove', (e) => {
    const now = e.originalEvent.timeStamp;
    if (!pointer || now - lastPointerMs < 100) return;
    lastPointerMs = now;
    pointer([e.lngLat.lng, e.lngLat.lat], [e.point.x, e.point.y]);
  });
  map.getCanvas().addEventListener('mouseleave', () => pointer?.(null, null));
  let click: ((at: LngLatPair) => void) | null = null;
  // MapLibre fires 'click' only when the pointer did not drag between press and release.
  map.on('click', (e) => click?.([e.lngLat.lng, e.lngLat.lat]));

  return {
    map,
    tileReads: file.kind,
    setMode,
    setDots: (dots) => (loaded ? setDots(map, dots) : void (pending.dots = dots)),
    setLines: (lines) => (loaded ? setLines(map, lines) : void (pending.lines = lines)),
    setDepotLand: (rings) => (loaded ? setDepotLand(map, rings) : void (pending.depotLand = rings)),
    setDepots: (depots) => (loaded ? setDepots(map, depots) : void (pending.depots = depots)),
    setTint: (visible) => (loaded ? setTint(map, visible) : void (pending.tint = visible)),
    setDraft: (draft) => (loaded ? setDraft(map, draft) : void (pending.draft = draft)),
    dotsDrawn: () => (loaded ? map.queryRenderedFeatures({ layers: [...DOT_LAYERS] }).length : 0),
    onPointer: (listener) => void (pointer = listener),
    onClick: (listener) => void (click = listener),
    dispose: () => map.remove(),
  };
}
