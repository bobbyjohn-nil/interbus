import { useEffect, useRef, useState } from 'react';
import { onReplaced } from '../../platform';
import { CITIES } from '../../cities';

type Status = 'loading' | 'ready' | 'empty' | 'no-city-file' | 'failed' | 'replaced';

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

  useEffect(() => onReplaced(() => setStatus('replaced')), []);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = window.setTimeout(() => setStatus('failed'), LOAD_TIMEOUT_MS);
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
        // ready means the first idle frame holds at least one feature.
        mounted.map.once('idle', () => {
          const drawn = mounted.map.queryRenderedFeatures().length;
          setFeatures(drawn);
          setStatus((now) => (now === 'loading' ? (drawn > 0 ? 'ready' : 'empty') : now));
        });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!disposed) setStatus((now) => (now === 'replaced' ? now : 'failed'));
      });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [city]);

  return (
    <div className="map" ref={container} data-testid="map" data-status={status} data-tile-reads={tileReads} data-features={features ?? ''}>
      {status in MESSAGES ? <p className="map-notice">{MESSAGES[status as keyof typeof MESSAGES]}</p> : null}
    </div>
  );
}
