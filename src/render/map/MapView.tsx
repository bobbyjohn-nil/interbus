import { useEffect, useRef, useState } from 'react';
import { fpsSwitch, gpuSwitch, onReplaced, reload } from '../../platform';
import { CITIES } from '../../cities';
import type { DepotView, Dots, EventView, LineDraftView, LineView, LngLatPair, StopView } from '../../sim/types';
import type { HoveredDot, MapHit, MountedMap } from './loadMap';
import type { DotKinds } from './overlays';

export type { DotKinds, HoveredDot, MapHit };
import { afterIdle, afterMountError, afterTimeout, MAP_READY_MARK, type MapStatus as Status } from './status';
import { FpsMeter, probeWebGL, rungFor, type GraphicsRung } from './gpu';
import { buildingsLayer, toggled, TURN_STEP_DEG, viewKey, type ViewMode } from './tilt';

/** A map still loading after this long has failed; MapLibre does not always say why. */
const LOAD_TIMEOUT_MS = 60_000;

// 'replaced' has no notice of its own: the replaced-build card says it (ReplacedCard).
const MESSAGES: Record<Exclude<Status, 'loading' | 'ready' | 'replaced'>, string> = {
  'no-city-file': 'Boston’s map file is not in this build yet.',
  empty: 'Boston’s map file loaded but drew nothing.',
  failed: 'The map could not start on this computer.',
  // The GPU ladder's last rungs (gpu.ts): the game itself plays on, so its saves and Export stay a click away.
  'no-gpu': 'Turn on hardware acceleration to see the map. This browser has none for it; turn it on in its settings and reload. Your game is saved, and Saves and Export still work.',
  lost: 'The browser took the map’s graphics away. Reload to bring them back; your game is saved.',
};

/** How long Low graphics' word on a refused tilt stays. */
const FLAT_NOTICE_MS = 4_000;

export interface MapViewProps {
  /** Where people live and work, from the sim worker. */
  readonly dots?: Dots | null;
  readonly lines?: readonly LineView[];
  /** Every stop and its QUIET or LOSS flag. */
  readonly stops?: readonly StopView[];
  /** Changes whenever `lines` and `stops` do (Snapshot.linesVersion). */
  readonly linesVersion?: number;
  /** Which kinds of dot show (D25: the player turns each on and off). */
  readonly dotKinds?: DotKinds;
  /** The pointer over the map, and the shown dot it is on, if any. */
  readonly onPointer?: (at: LngLatPair | null, screen: [number, number] | null, dot: HoveredDot | null) => void;
  readonly onClick?: (at: LngLatPair, hit: MapHit) => void;
  /** Where depots may stand, tinted while `tint` is on. */
  readonly depotLand?: readonly (readonly LngLatPair[])[] | null;
  readonly tint?: boolean;
  readonly depots?: readonly DepotView[];
  /** The line being drawn, or null. */
  readonly draft?: LineDraftView | null;
  /** Whether a double-click held on the map tilts it: only while no tool is out (loadMap.ts). */
  readonly tiltGesture?: boolean;
  /** The city event pending or on, drawn on its street. */
  readonly event?: EventView | null;
  /** The sim's clock at the last snapshot: seconds of the day, game seconds per real second (0 paused), and the game day. */
  readonly clock?: { readonly second: number; readonly rate: number; readonly day: number } | null;
}

/** Sets the dots and, drawn rather than merely sent (TS-07), counts what the next settled frame shows. */
function showDots(mounted: MountedMap, dots: Dots, setDrawn: (n: number) => void): () => void {
  mounted.setDots(dots);
  const onIdle = () => setDrawn(mounted.dotsDrawn());
  mounted.map.once('idle', onIdle);
  return () => void mounted.map.off('idle', onIdle);
}

const BOTH: DotKinds = { home: true, job: true };

export function MapView({ dots = null, dotKinds = BOTH, lines = [], stops = [], linesVersion = 0, onPointer, onClick, depotLand = null, tint = false, depots = [], draft = null, tiltGesture = true, event = null, clock = null }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  /** Set as soon as the map exists, for the game's layers (which wait for the style themselves). */
  const mountedRef = useRef<MountedMap | null>(null);
  const [dotsDrawn, setDotsDrawn] = useState<number | null>(null);
  const latest = useRef({ dots, dotKinds, lines, stops, onPointer, onClick, depotLand, tint, depots, draft, tiltGesture, event, clock });
  useEffect(() => {
    latest.current = { dots, dotKinds, lines, stops, onPointer, onClick, depotLand, tint, depots, draft, tiltGesture, event, clock };
  });
  const dotKindsKey = (['home', 'job'] as const).filter((k) => dotKinds[k]).join(',');
  const eventKey = event ? `${event.street}:${event.startDay}:${event.phase}:${event.daysLeft}` : '';
  // Depots arrive with every snapshot; their layer is set only when the set of depots changes (RN-04).
  const depotsKey = depots.map((d) => d.id).join(',');
  const city = CITIES[0];
  // The GPU ladder's rung, once, before the map mounts (gpu.ts); `?gpu=` can pick one.
  const [rung] = useState<GraphicsRung>(() => rungFor(probeWebGL(), gpuSwitch()));
  const [status, setStatus] = useState<Status>(rung === 'none' ? 'no-gpu' : city?.tiles ? 'loading' : 'no-city-file');
  // Low graphics keeps the map flat; `T` says so for a moment instead.
  const [flatNotice, setFlatNotice] = useState(false);
  // The `?fps` readout: frames a second and the slowest twentieth's frame time.
  const [fps, setFps] = useState<{ fps: number; p95Ms: number; zoom: number; pitch: number } | null>(null);
  const [tileReads, setTileReads] = useState<string>('');
  const [features, setFeatures] = useState<number | null>(null);
  /** Set once the board is ready, so `T` never reaches a style still loading. */
  const ready = useRef<MountedMap | null>(null);
  const [mode, setMode] = useState<ViewMode>('2d');
  // What the camera settled on after the last mode change, for the e2e tests.
  const [settled, setSettled] = useState<{ pitch: number; buildings: number; measured: number } | null>(null);
  // Where the camera rests after each move ("lon,lat,zoom"), so the e2e tests can aim at a place, and
  // which way it faces and how far it leans, for the compass.
  const [view, setView] = useState('');
  const [camera, setCamera] = useState({ bearing: 0, pitch: 0 });

  useEffect(() => onReplaced(() => setStatus('replaced')), []);

  // T tilts and flattens; in 3D, Q and E turn the board and N faces north (D25). Low graphics says why not.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = viewKey(event);
      const mounted = ready.current;
      if (!key || !mounted) return;
      if (key !== 'tilt' && modeRef.current !== '3d') return;
      event.preventDefault();
      if (rung === 'low') setFlatNotice(true);
      else if (key === 'tilt') setMode(toggled);
      else if (key === 'north') mounted.faceNorth();
      else mounted.turn(key === 'left' ? -TURN_STEP_DEG : TURN_STEP_DEG);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rung]);

  useEffect(() => {
    if (!flatNotice) return;
    const timer = window.setTimeout(() => setFlatNotice(false), FLAT_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [flatNotice]);

  useEffect(() => {
    const mounted = ready.current;
    if (!mounted) return;
    mounted.setMode(mode);
    const { map } = mounted;
    // Idle waits for the ease to end and the swapped layer's tiles to draw. Measured: those in view
    // with a height of their own, OSM's or Overture's (PLAN §5), not the style's default.
    const onIdle = () => {
      const drawn = map.queryRenderedFeatures({ layers: [buildingsLayer(mode)] });
      setSettled({ pitch: Math.round(map.getPitch()), buildings: drawn.length, measured: drawn.filter((f) => typeof f.properties.height === 'number').length });
    };
    map.once('idle', onIdle);
    return () => void map.off('idle', onIdle);
  }, [mode]);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = window.setTimeout(() => setStatus(afterTimeout), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!city?.tiles || !container.current || rung === 'none') return;
    const element = container.current;
    let disposed = false;
    let dispose: (() => void) | undefined;
    let stopMeter: (() => void) | undefined;
    import('./loadMap')
      .then(({ mountMap }) => mountMap(element, city, rung))
      .then((mounted) => {
        if (disposed) return mounted.dispose();
        dispose = mounted.dispose;
        mountedRef.current = mounted;
        // A right-drag or a two-finger pitch that settles in the other mode moves the chip with it.
        mounted.onModeChange((next) => setMode(next));
        // A context lost and not given back leaves a blank board: say so, with Reload (gpu.ts).
        mounted.map.on('webglcontextlost', () => setStatus((now) => (now === 'replaced' ? now : 'lost')));
        mounted.map.on('webglcontextrestored', () => setStatus((now) => (now === 'lost' ? 'ready' : now)));
        if (fpsSwitch()) {
          const meter = new FpsMeter();
          mounted.map.on('render', () => meter.frame(performance.now()));
          // With the camera's zoom and pitch, so a reading names where it was taken (PLAN §6: 3D at zoom 17, pitch 60).
          const timer = window.setInterval(() => {
            const summary = meter.summary(performance.now());
            setFps(summary && { ...summary, zoom: mounted.map.getZoom(), pitch: mounted.map.getPitch() });
          }, 500);
          stopMeter = () => window.clearInterval(timer);
        }
        const now = latest.current;
        mounted.setDotKinds(now.dotKinds);
        mounted.setTiltGesture(now.tiltGesture);
        if (now.dots) showDots(mounted, now.dots, setDotsDrawn);
        mounted.setLines(now.lines, now.stops);
        if (now.depotLand) mounted.setDepotLand(now.depotLand);
        mounted.setDepots(now.depots);
        mounted.setTint(now.tint);
        mounted.setDraft(now.draft);
        mounted.setEvent(now.event);
        if (now.clock) mounted.setClock(now.clock.second, now.clock.rate, now.clock.day);
        mounted.onPointer((at, screen, dot) => latest.current.onPointer?.(at, screen, dot));
        mounted.onClick((at, hit) => latest.current.onClick?.(at, hit));
        const rest = () => {
          const c = mounted.map.getCenter();
          setView(`${c.lng.toFixed(6)},${c.lat.toFixed(6)},${mounted.map.getZoom().toFixed(3)}`);
          setCamera({ bearing: Math.round(mounted.map.getBearing()), pitch: Math.round(mounted.map.getPitch()) });
        };
        rest();
        mounted.map.on('moveend', rest);
        setTileReads(mounted.tileReads);
        // 'idle' also fires when nothing was drawn (a style that names layers the tiles lack), so
        // ready means the first idle frame holds at least one feature (status.ts).
        mounted.map.once('idle', () => {
          const drawn = mounted.map.queryRenderedFeatures().length;
          setFeatures(drawn);
          setStatus((now) => afterIdle(now, drawn));
          if (drawn > 0) {
            ready.current = mounted;
            performance.mark(MAP_READY_MARK);
          }
        });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!disposed) setStatus(afterMountError);
      });
    return () => {
      disposed = true;
      ready.current = null;
      mountedRef.current = null;
      stopMeter?.();
      dispose?.();
    };
  }, [city, rung]);

  useEffect(() => {
    const mounted = mountedRef.current;
    if (!mounted || !dots) return;
    return showDots(mounted, dots, setDotsDrawn);
  }, [dots]);

  // Shown or hidden by kind, and counted again once drawn (data-dots follows what shows).
  useEffect(() => {
    const mounted = mountedRef.current;
    if (!mounted) return;
    mounted.setDotKinds(latest.current.dotKinds);
    const onIdle = () => setDotsDrawn(mounted.dotsDrawn());
    mounted.map.once('idle', onIdle);
    mounted.map.triggerRepaint();
    return () => void mounted.map.off('idle', onIdle);
  }, [dotKindsKey]);

  useEffect(() => {
    mountedRef.current?.setTiltGesture(tiltGesture);
  }, [tiltGesture]);

  useEffect(() => {
    mountedRef.current?.setLines(latest.current.lines, latest.current.stops);
  }, [linesVersion]);

  useEffect(() => {
    if (depotLand) mountedRef.current?.setDepotLand(depotLand);
  }, [depotLand]);

  useEffect(() => {
    mountedRef.current?.setDepots(latest.current.depots);
  }, [depotsKey]);

  useEffect(() => {
    mountedRef.current?.setTint(tint);
  }, [tint]);

  useEffect(() => {
    mountedRef.current?.setDraft(draft);
  }, [draft]);

  useEffect(() => {
    mountedRef.current?.setEvent(latest.current.event);
  }, [eventKey]);

  // A snapshot about 10 times a second while time runs; the layer runs the clock on between them.
  const clockSecond = clock?.second ?? null;
  const clockRate = clock?.rate ?? 0;
  const clockDay = clock?.day ?? 0;
  useEffect(() => {
    if (clockSecond !== null) mountedRef.current?.setClock(clockSecond, clockRate, clockDay);
  }, [clockSecond, clockRate, clockDay]);

  return (
    <div
      className="map"
      ref={container}
      data-testid="map"
      data-status={status}
      data-tile-reads={tileReads}
      data-features={features ?? ''}
      data-mode={mode}
      data-pitch={settled?.pitch ?? ''}
      data-buildings={settled?.buildings ?? ''}
      data-measured={settled?.measured ?? ''}
      data-dots={dotsDrawn ?? ''}
      data-tint={tint ? 'on' : 'off'}
      data-view={view}
      data-bearing={camera.bearing}
      data-dot-kinds={dotKindsKey}
      data-event={eventKey}
      data-stops={stops.map((s) => `${s.id}:${s.at[0].toFixed(6)},${s.at[1].toFixed(6)}`).join(' ')}
      data-graphics={rung}
      data-fps={fps ? Math.round(fps.fps) : ''}
    >
      {status === 'no-gpu' || status === 'lost' ? (
        <div className="map-notice top" role="alert" data-testid="gpu-card">
          <p>{MESSAGES[status]}</p>
          {status === 'lost' ? (
            <button type="button" onClick={reload}>
              Reload
            </button>
          ) : null}
        </div>
      ) : status in MESSAGES ? (
        <p className="map-notice">{MESSAGES[status as keyof typeof MESSAGES]}</p>
      ) : null}
      {flatNotice ? (
        <p className="map-notice top" role="status" data-testid="flat-notice">
          Low graphics: the map stays flat on this computer.
        </p>
      ) : null}
      {status === 'ready' ? (
        <Compass
          mode={mode}
          bearing={camera.bearing}
          pitch={camera.pitch}
          low={rung === 'low'}
          onPress={() => {
            if (mode === '3d' && camera.bearing !== 0) ready.current?.faceNorth();
            else setMode(toggled);
          }}
        />
      ) : null}
      {fps ? (
        <p className="fps" data-testid="fps">
          {Math.round(fps.fps)} fps · p95 {Math.round(fps.p95Ms)} ms · zoom {fps.zoom.toFixed(1)} · {Math.round(fps.pitch)}° · {rung === 'low' ? 'Low graphics' : 'full graphics'}
        </p>
      ) : null}
    </div>
  );
}

/** What the compass does when pressed, in the words its label uses. */
export function compassLabel(mode: ViewMode, bearing: number, low: boolean): string {
  if (low) return 'Low graphics: the map stays flat on this computer';
  if (mode === '2d') return 'Tilt to 3D (T, or double-click and hold)';
  return bearing === 0 ? 'Flatten to 2D (T)' : 'Face north (N)';
}

/**
 * The compass (D25; it replaced the 2D/3D chip and takes half its room, which the demand menu took):
 * its needle points north, turning with the board and leaning with its tilt. Pressed, it tilts the
 * flat board, faces a turned one north, and flattens one that faces north. PLAN §8 counts it in I13.
 */
function Compass({ mode, bearing, pitch, low, onPress }: { mode: ViewMode; bearing: number; pitch: number; low: boolean; onPress: () => void }) {
  const label = compassLabel(mode, bearing, low);
  return (
    <button
      type="button"
      className="compass"
      data-chrome="rest"
      data-testid="compass"
      data-mode={mode}
      aria-label={label}
      title={label}
      disabled={low}
      onClick={onPress}
    >
      <svg viewBox="-10 -10 20 20" width="18" height="18" aria-hidden="true" style={{ transform: `rotateX(${pitch}deg) rotate(${-bearing}deg)` }}>
        <path className="compass-north" d="M0 -9 L3.5 0 L-3.5 0 Z" />
        <path className="compass-south" d="M0 9 L3.5 0 L-3.5 0 Z" />
      </svg>
    </button>
  );
}
