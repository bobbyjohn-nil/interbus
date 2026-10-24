import { useEffect, useState } from 'react';
import { watchHidden } from '../../platform';
import { LOAD_COPY, loadedText, NEWER_COPY, refusalText, STORE_FULL_COPY, STORE_REFUSED_COPY, UNBACKED_COPY } from '../copy';
import type { Sim } from '../game/useSim';

/** How long a notice stays, in milliseconds of the page in sight. */
const NOTICE_MS = 6_000;

/**
 * Notices in one corner (PLAN §8, UX-05): the last thing the sim refused, in words, for a few
 * seconds; once, when the game starts, a save it set aside (D12), or, on Home until the player opens
 * Saves, one it could not set aside (in the game the Saves chip says so itself, App); once, that the
 * browser keeps no saves or has no room for one, if it refuses one (a Save here is said on its slot's
 * row instead, Saves); in the game, once each time another tab is found to have changed the autosave
 * since this one last read or wrote it (Home takes that game up instead, useSim); and a slot or a
 * file that became the game. `home` is
 * whether Home is on screen, whose Saves button the held save's notice points at, and `savesOpen`
 * whether the Saves panel is open. A notice's few seconds run only while the page is in sight, and
 * start again in full as it shows: in a tab out of sight, where the game holds its time (useSim),
 * another tab's change to the autosave and a save set aside as the game opened came and went unseen
 * (the systems audit's fifteenth round).
 */
export function Notices({ sim, home, savesOpen = false }: { sim: Sim; home: boolean; savesOpen?: boolean }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => watchHidden(setHidden), []);
  const refusal = sim.refusal;
  // The refusal whose time is up; a newer one shows until its own time is.
  const [expired, setExpired] = useState<typeof refusal>(null);
  useEffect(() => {
    if (!refusal || hidden) return;
    const timer = window.setTimeout(() => setExpired(refusal), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [refusal, hidden]);
  // Said to be set aside only once its backup has read back, and never if it did not: then it was not.
  const setAside = sim.load && (sim.backup === null || sim.backup === 'kept') ? LOAD_COPY[sim.load] : null;
  const [setAsideDone, setSetAsideDone] = useState(false);
  useEffect(() => {
    if (!setAside || hidden) return;
    const timer = window.setTimeout(() => setSetAsideDone(true), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [setAside, hidden]);
  // A save the game could not set aside comes first, and is not timed: the game saves nothing over it
  // meanwhile, so it is said until the player opens Saves, where its row is, or deletes it there. It
  // says "see Saves", so it is said on Home, beside its Saves button; in the game the Saves chip says it.
  const [savesSeen, setSavesSeen] = useState(false);
  if (savesOpen && sim.unbacked && !savesSeen) setSavesSeen(true);
  const heldShows = Boolean(sim.unbacked) && sim.status === 'ready' && home && !savesSeen && !(refusal && refusal !== expired);
  // Said once each time this tab is left behind, for a few seconds; the Saves chip says it while it lasts.
  const [newerDone, setNewerDone] = useState(false);
  if (!sim.newer && newerDone) setNewerDone(false);
  const newerShows = sim.newer && !home && !newerDone && !(refusal && refusal !== expired) && !heldShows;
  useEffect(() => {
    if (!newerShows || hidden) return;
    const timer = window.setTimeout(() => setNewerDone(true), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [newerShows, hidden]);
  // Said once the game is on screen, so it is said when someone can see it, and timed only while it
  // shows: a refusal on screen first holds it back without using up its few seconds. In the words for
  // why the store first refused (a full one names the way out), though Saves' own line waits only on the
  // game's saves (useSim).
  const unsaved = sim.storeNotice !== null && sim.status === 'ready';
  const [unsavedDone, setUnsavedDone] = useState(false);
  const unsavedShows = unsaved && !unsavedDone && !(refusal && refusal !== expired) && !heldShows && !newerShows;
  useEffect(() => {
    if (!unsavedShows || hidden) return;
    const timer = window.setTimeout(() => setUnsavedDone(true), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [unsavedShows, hidden]);
  const loaded = sim.loaded;
  const [loadedDone, setLoadedDone] = useState<typeof loaded>(null);
  useEffect(() => {
    if (!loaded || hidden) return;
    const timer = window.setTimeout(() => setLoadedDone(loaded), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [loaded, hidden]);
  const text =
    refusal && refusal !== expired
      ? refusalText(refusal)
      : heldShows
        ? UNBACKED_COPY
        : newerShows
          ? NEWER_COPY
          : unsaved && !unsavedDone
            ? sim.storeNotice === 'full'
              ? STORE_FULL_COPY
              : STORE_REFUSED_COPY
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
