import { useEffect, useState } from 'react';
import { LOAD_COPY, refusalText } from '../copy';
import type { Sim } from '../game/useSim';

/** How long a notice stays, in milliseconds. */
const NOTICE_MS = 6_000;

/**
 * Notices in one corner (PLAN §8, UX-05): the last thing the sim refused, in words, for a few
 * seconds; and once, when the game starts, a save it set aside (D12).
 */
export function Notices({ sim }: { sim: Sim }) {
  const refusal = sim.refusal;
  // The refusal whose time is up; a newer one shows until its own time is.
  const [expired, setExpired] = useState<typeof refusal>(null);
  useEffect(() => {
    if (!refusal) return;
    const timer = window.setTimeout(() => setExpired(refusal), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [refusal]);
  const setAside = sim.load ? LOAD_COPY[sim.load] : null;
  const [setAsideDone, setSetAsideDone] = useState(false);
  useEffect(() => {
    if (!setAside) return;
    const timer = window.setTimeout(() => setSetAsideDone(true), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [setAside]);
  const text = refusal && refusal !== expired ? refusalText(refusal) : setAside && !setAsideDone ? setAside : null;
  if (!text) return null;
  return (
    <div className="notices" role="status" data-testid="notice" data-chrome="rest">
      {text}
    </div>
  );
}
