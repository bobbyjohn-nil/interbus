import { every, usd } from '../format';
import type { Sim } from '../game/useSim';

/**
 * HEADWAY contracts (the M3 spec, item 11; exit check 2): each offer or held contract with today's
 * headway near its landmark against its ask, the figure the day's grading and the ring on the map
 * read (sim/rules/contract.ts). Taking an offer is a click; a held one shows its days met in a row
 * and the days left to meet them.
 */
export function Contracts({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const s = sim.snapshot;
  if (!s) return null;
  return (
    <aside className="panel contracts" aria-label="Contracts" data-testid="contracts" data-chrome="panel">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Contracts</h2>
      <ul className="contract-list">
        {s.contracts.map((c) => (
          <li key={c.id} data-testid="contract" data-landmark={c.landmark} data-held={c.held ? 'yes' : 'no'} data-met={c.met ? 'yes' : 'no'} data-days-met={c.daysMet}>
            <strong>
              {every(c.askSeconds)[0]!.toUpperCase() + every(c.askSeconds).slice(1)} at {c.landmark}
            </strong>
            <span>
              {c.daysNeeded} days in a row · {usd(c.rewardCents)}
            </span>
            <span className={c.met ? 'met' : 'short'}>Today: {c.figureSeconds === null ? 'no bus within a walk' : every(Math.round(c.figureSeconds))}</span>
            {c.held ? (
              <span>
                {c.daysMet} of {c.daysNeeded} days · {c.daysLeft} {c.daysLeft === 1 ? 'day' : 'days'} left{c.onTrack ? '' : ' · missed today'}
              </span>
            ) : (
              <span className="controls">
                <button type="button" onClick={() => sim.send({ type: 'accept-contract', contractId: c.id })}>
                  Take it
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
