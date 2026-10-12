// "This build was replaced · Reload": shown when a file this build needs is gone because a newer
// deploy replaced it. Error recovery, not an update prompt (D12): the web preview has no service
// worker, so a reload always fetches the newest build.

export type ReplacedReason = 'chunk' | 'city-file' | 'worker';

type Listener = (reason: ReplacedReason) => void;

const listeners = new Set<Listener>();
let reported: ReplacedReason | null = null;

export function reportReplaced(reason: ReplacedReason): void {
  if (reported) return;
  reported = reason;
  for (const l of listeners) l(reason);
}

export function onReplaced(listener: Listener): () => void {
  listeners.add(listener);
  if (reported) listener(reported);
  return () => listeners.delete(listener);
}

/** Vite fires vite:preloadError when a lazy chunk fails to load, which is what a replaced build looks like. */
export function watchChunkFailures(target: Window): void {
  target.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reportReplaced('chunk');
  });
}

export function reload(): void {
  window.location.reload();
}
