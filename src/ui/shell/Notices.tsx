import { useEffect, useState } from 'react';
import { LOAD_COPY, loadedText, refusalText, STORE_REFUSED_COPY, UNBACKED_COPY } from '../copy';
import type { Sim } from '../game/useSim';

/** How long a notice stays, in milliseconds. */
const NOTICE_MS = 6_000;

/**
 * Notices in one corner (PLAN §8, UX-05): the last thing the sim refused, in words, for a few
 * seconds; once, when the game starts, a save it set aside (D12), or, until the player opens Saves, one
 * it could not set aside; once, that the browser keeps no saves, if it refuses one; and a slot or a
 * file that became the game. `savesButton` is whether a button on screen opens Saves (Home's, or the
 * game's once a company is founded), and `savesOpen` whether the Saves panel is open.
 */
export function Notices({ sim, savesButton, savesOpen = false }: { sim: Sim; savesButton: boolean; savesOpen?: boolean }) {
  const refusal = sim.refusal;
  // The refusal whose time is up; a newer one shows until its own time is.
  const [expired, setExpired] = useState<typeof refusal>(null);
  useEffect(() => {
    if (!refusal) return;
    const timer = window.setTimeout(() => setExpired(refusal), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [refusal]);
  // Said to be set aside only once its backup has read back, and never if it did not: then it was not.
  const setAside = sim.load && (sim.backup === null || sim.backup === 'kept') ? LOAD_COPY[sim.load] : null;
  const [setAsideDone, setSetAsideDone] = useState(false);
  useEffect(() => {
    if (!setAside) return;
    const timer = window.setTimeout(() => setSetAsideDone(true), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [setAside]);
  // A save the game could not set aside comes first, and is not timed: the game saves nothing over it
  // meanwhile, so it is said until the player opens Saves, where its row is, or deletes it there. It
  // says "see Saves", so it waits while no button opens Saves (the founding card after New game).
  const [savesSeen, setSavesSeen] = useState(false);
  if (savesOpen && sim.unbacked && !savesSeen) setSavesSeen(true);
  const heldShows = Boolean(sim.unbacked) && sim.status === 'ready' && savesButton && !savesSeen && !(refusal && refusal !== expired);
  // Said once the game is on screen, so it is said when someone can see it, and timed only while it
  // shows: a refusal on screen first holds it back without using up its few seconds.
  const unsaved = sim.storeRefused && sim.status === 'ready';
  const [unsavedDone, setUnsavedDone] = useState(false);
  const unsavedShows = unsaved && !unsavedDone && !(refusal && refusal !== expired) && !heldShows;
  useEffect(() => {
    if (!unsavedShows) return;
    const timer = window.setTimeout(() => setUnsavedDone(true), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [unsavedShows]);
  const loaded = sim.loaded;
  const [loadedDone, setLoadedDone] = useState<typeof loaded>(null);
  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => setLoadedDone(loaded), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [loaded]);
  const text =
    refusal && refusal !== expired
      ? refusalText(refusal)
      : heldShows
        ? UNBACKED_COPY
        : unsaved && !unsavedDone
          ? STORE_REFUSED_COPY
          : loaded && loaded !== loadedDone
            ? loadedText(loaded)
            : setAside && !setAsideDone
              ? setAside
              : null;
  if (!text) return null;
  return (
    <div className="notices" role="status" data-testid="notice" data-chrome="rest">
      {text}
    </div>
  );
}
