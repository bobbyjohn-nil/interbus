import { useEffect, useRef, useState } from 'react';
import { onReplaced } from '../../platform';
import { CITIES } from '../../cities';
import type { ContractView, DepotView, Dots, LineDraftView, LineView, LngLatPair, StopView } from '../../sim/types';
import type { MapHit, MountedMap } from './loadMap';

export type { MapHit };
import { afterIdle, afterMountError, afterTimeout, type MapStatus as Status } from './status';
import { buildingsLayer, isTiltKey, toggled, type ViewMode } from './tilt';

/** A map still loading after this long has failed; MapLibre does not always say why. */
const LOAD_TIMEOUT_MS = 60_000;

// 'replaced' has no notice of its own: the replaced-build card says it (ReplacedCard).
const MESSAGES: Record<Exclude<Status, 'loading' | 'ready' | 'replaced'>, string> = {
  'no-city-file': 'Boston’s map file is not in this build yet.',
  empty: 'Boston’s map file loaded but drew nothing.',
  failed: 'The map could not start on this computer.',
};

export interface MapViewProps {
  /** Where people live and work, from the sim worker. */
  readonly dots?: Dots | null;
  readonly lines?: readonly LineView[];
  /** Every stop and its QUIET or LOSS flag. */
  readonly stops?: readonly StopView[];
  /** Changes whenever `lines` and `stops` do (Snapshot.linesVersion). */
  readonly linesVersion?: number;
  readonly onPointer?: (at: LngLatPair | null, screen: [number, number] | null) => void;
  readonly onClick?: (at: LngLatPair, hit: MapHit) => void;
  /** Where depots may stand, tinted while `tint` is on. */
  readonly depotLand?: readonly (readonly LngLatPair[])[] | null;
  readonly tint?: boolean;
  readonly depots?: readonly DepotView[];
  /** The line being drawn, or null. */
  readonly draft?: LineDraftView | null;
  /** HEADWAY contracts, drawn as rings at their landmarks. */
  readonly contracts?: readonly ContractView[];
  /** The sim's clock at the last snapshot: seconds of the day, and game seconds per real second (0 paused). */
  readonly clock?: { readonly second: number; readonly rate: number } | null;
}

/** Sets the dots and, drawn rather than merely sent (TS-07), counts what the next settled frame shows. */
function showDots(mounted: MountedMap, dots: Dots, setDrawn: (n: number) => void): () => void {
  mounted.setDots(dots);
  const onIdle = () => setDrawn(mounted.dotsDrawn());
  mounted.map.once('idle', onIdle);
  return () => void mounted.map.off('idle', onIdle);
}

export function MapView({ dots = null, lines = [], stops = [], linesVersion = 0, onPointer, onClick, depotLand = null, tint = false, depots = [], draft = null, contracts = [], clock = null }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  /** Set as soon as the map exists, for the game's layers (which wait for the style themselves). */
  const mountedRef = useRef<MountedMap | null>(null);
  const [dotsDrawn, setDotsDrawn] = useState<number | null>(null);
  const latest = useRef({ dots, lines, stops, onPointer, onClick, depotLand, tint, depots, draft, contracts, clock });
  useEffect(() => {
    latest.current = { dots, lines, stops, onPointer, onClick, depotLand, tint, depots, draft, contracts, clock };
  });
  // Set only when what a ring shows changes (RN-04).
  const contractsKey = contracts.map((c) => `${c.id}:${c.held ? 1 : 0}:${c.daysMet}`).join(',');
  // Depots arrive with every snapshot; their layer is set only when the set of depots changes (RN-04).
  const depotsKey = depots.map((d) => d.id).join(',');
  const city = CITIES[0];
  const [status, setStatus] = useState<Status>(city?.tiles ? 'loading' : 'no-city-file');
  const [tileReads, setTileReads] = useState<string>('');
  const [features, setFeatures] = useState<number | null>(null);
  /** Set once the board is ready, so `T` never reaches a style still loading. */
  const ready = useRef<MountedMap | null>(null);
  const [mode, setMode] = useState<ViewMode>('2d');
  // What the camera settled on after the last mode change, for the e2e tests.
  const [settled, setSettled] = useState<{ pitch: number; buildings: number } | null>(null);
  // Where the camera rests after each move ("lon,lat,zoom"), so the e2e tests can aim at a place.
  const [view, setView] = useState('');

  useEffect(() => onReplaced(() => setStatus('replaced')), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isTiltKey(event) || !ready.current) return;
      event.preventDefault();
      setMode(toggled);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const mounted = ready.current;
    if (!mounted) return;
    mounted.setMode(mode);
    const { map } = mounted;
    // Idle waits for the ease to end and the swapped layer's tiles to draw.
    const onIdle = () =>
      setSettled({
        pitch: Math.round(map.getPitch()),
        buildings: map.queryRenderedFeatures({ layers: [buildingsLayer(mode)] }).length,
      });
    map.once('idle', onIdle);
    return () => void map.off('idle', onIdle);
  }, [mode]);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = window.setTimeout(() => setStatus(afterTimeout), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!city?.tiles || !container.current) return;
    const element = container.current;
    let disposed = false;
    let dispose: (() => void) | undefined;
    import('./loadMap')
      .then(({ mountMap }) => mountMap(element, city))
      .then((mounted) => {
        if (disposed) return mounted.dispose();
        dispose = mounted.dispose;
        mountedRef.current = mounted;
        const now = latest.current;
        if (now.dots) showDots(mounted, now.dots, setDotsDrawn);
        mounted.setLines(now.lines, now.stops);
        if (now.depotLand) mounted.setDepotLand(now.depotLand);
        mounted.setDepots(now.depots);
        mounted.setTint(now.tint);
        mounted.setDraft(now.draft);
        mounted.setContracts(now.contracts);
        if (now.clock) mounted.setClock(now.clock.second, now.clock.rate);
        mounted.onPointer((at, screen) => latest.current.onPointer?.(at, screen));
        mounted.onClick((at, hit) => latest.current.onClick?.(at, hit));
        const rest = () => {
          const c = mounted.map.getCenter();
          setView(`${c.lng.toFixed(6)},${c.lat.toFixed(6)},${mounted.map.getZoom().toFixed(3)}`);
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
          if (drawn > 0) ready.current = mounted;
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
      dispose?.();
    };
  }, [city]);

  useEffect(() => {
    const mounted = mountedRef.current;
    if (!mounted || !dots) return;
    return showDots(mounted, dots, setDotsDrawn);
  }, [dots]);

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
    mountedRef.current?.setContracts(latest.current.contracts);
  }, [contractsKey]);

  // A snapshot about 10 times a second while time runs; the layer runs the clock on between them.
  const clockSecond = clock?.second ?? null;
  const clockRate = clock?.rate ?? 0;
  useEffect(() => {
    if (clockSecond !== null) mountedRef.current?.setClock(clockSecond, clockRate);
  }, [clockSecond, clockRate]);

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
      data-dots={dotsDrawn ?? ''}
      data-tint={tint ? 'on' : 'off'}
      data-view={view}
      data-contracts={contractsKey}
      data-stops={stops.map((s) => `${s.id}:${s.at[0].toFixed(6)},${s.at[1].toFixed(6)}`).join(' ')}
    >
      {status in MESSAGES ? <p className="map-notice">{MESSAGES[status as keyof typeof MESSAGES]}</p> : null}
    </div>
  );
}
