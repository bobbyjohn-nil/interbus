// What the map says about itself (data-status). Pure, so each transition is tested on its own.
export type MapStatus = 'loading' | 'ready' | 'empty' | 'no-city-file' | 'failed' | 'replaced';

/**
 * The first idle frame decides: a frame with features is ready, an empty one is broken. It also
 * overrides the load timer, which fires in a background tab while MapLibre waits for frames.
 * Only a replaced build stays as it is.
 */
export function afterIdle(now: MapStatus, featuresDrawn: number): MapStatus {
  if (now === 'replaced') return now;
  return featuresDrawn > 0 ? 'ready' : 'empty';
}

/** A map still loading when the timer fires has failed, for now. */
export function afterTimeout(now: MapStatus): MapStatus {
  return now === 'loading' ? 'failed' : now;
}

/** Mounting threw: failed, unless the replaced-build card already explains it. */
export function afterMountError(now: MapStatus): MapStatus {
  return now === 'replaced' ? now : 'failed';
}
