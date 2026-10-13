// What the map says about itself (data-status). Pure, so each transition is tested on its own.
// 'no-gpu': the GPU ladder's last rung, no map at all; 'lost': the browser took the map's graphics
// away mid-game (gpu.ts).
/**
 * Performance marks for I14's first frame (e2e/first-frame.spec.ts; a browser's performance panel shows
 * them too): MapLibre's 'load', its first visually complete frame, and the board ready, the first idle
 * frame with every overlay drawn.
 */
export const MAP_LOADED_MARK = 'interbus:map-load';
export const MAP_READY_MARK = 'interbus:map-ready';

export type MapStatus = 'loading' | 'ready' | 'empty' | 'no-city-file' | 'failed' | 'replaced' | 'no-gpu' | 'lost';

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
