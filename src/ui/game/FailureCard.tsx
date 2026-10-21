import { useEffect, useRef } from 'react';
import { CREDIT_LIMIT_CENTS, FAILURE_CLOSES } from '../../sim/rules/credit';
import { focusLost } from '../focusLost';
import { usdK } from '../format';
import { runOver } from './runOver';
import type { Sim } from './useSim';

/**
 * The end of a run (the M3 spec, item 10; D10): five day closes in a row below the credit line's
 * floor, and the lender calls in the loan. Time stays stopped; Restart this quarter reopens the save
 * written as the quarter began. It shows once the day card of the close that ended the run is read
 * and closed, rather than over it in the same spot, hiding its rows.
 */
export function FailureCard({ sim }: { sim: Sim }) {
  const shown = runOver(sim) && !sim.dayCard;
  // Shown as the day card's Continue goes, or over a control the end turned off: Restart this quarter takes the focus.
  const restart = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (shown && focusLost()) restart.current?.focus();
  }, [shown]);
  if (!shown) return null;
  return (
    <section className="day-card failure" role="dialog" aria-label="The run is over" data-testid="failure-card" data-chrome="panel">
      <div className="day-card-scroll">
        <h2>The lender has called in the loan</h2>
        <p>
          {FAILURE_CLOSES} days closed below {usdK(-CREDIT_LIMIT_CENTS)}. Start this quarter again from where it began.
        </p>
      </div>
      <button ref={restart} type="button" onClick={() => sim.send({ type: 'restart-quarter' })}>
        Restart this quarter
      </button>
    </section>
  );
}
