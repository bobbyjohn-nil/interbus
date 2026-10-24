// Whether the page is out of sight: a tab in the background, a window minimised. The game's time holds while it is (useSim, and
// the sim host's `held`).

type Seen = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;

/** Tells `hear` whether the page is hidden, at once and at each change after; returns what stops it. */
export function watchHidden(hear: (hidden: boolean) => void, doc: Seen = document): () => void {
  const tell = () => hear(doc.visibilityState === 'hidden');
  tell();
  doc.addEventListener('visibilitychange', tell);
  return () => doc.removeEventListener('visibilitychange', tell);
}
