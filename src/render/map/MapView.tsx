import { useEffect, useRef, useState } from 'react';
import { onReplaced } from '../../platform';
import { CITIES } from '../../cities';
import type { MountedMap } from './loadMap';
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

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const city = CITIES[0];
  const [status, setStatus] = useState<Status>(city?.tiles ? 'loading' : 'no-city-file');
  const [tileReads, setTileReads] = useState<string>('');
  const [features, setFeatures] = useState<number | null>(null);
  /** Set once the board is ready, so `T` never reaches a style still loading. */
  const ready = useRef<MountedMap | null>(null);
  const [mode, setMode] = useState<ViewMode>('2d');
  // What the camera settled on after the last mode change, for the e2e tests.
  const [settled, setSettled] = useState<{ pitch: number; buildings: number } | null>(null);

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
      dispose?.();
    };
  }, [city]);

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
    >
      {status in MESSAGES ? <p className="map-notice">{MESSAGES[status as keyof typeof MESSAGES]}</p> : null}
    </div>
  );
}
