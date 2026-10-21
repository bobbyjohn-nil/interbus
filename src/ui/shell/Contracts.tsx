import { MEDAL_IDS, tripsToSilver } from '../../sim/rules/medal';
import { askText, capitalise, dateText, figureText, MEDAL_NAMES, medalBarText, usd } from '../format';
import type { Sim } from '../game/useSim';

/**
 * Contracts (the M3 spec, item 11; the M4 spec, item 1): each offer or held contract with today's
 * figure near its landmark against its ask, HEADWAY's headway or RIDERSHIP's paid boardings a day,
 * the figure the day's grading and the ring on the map read (sim/rules/contract.ts). Taking an offer
 * is a click; a held one shows its days met in a row and the days left to meet them. Below them the
 * medals (the M4 spec, item 3): each one's bar, the day it came, and the trips left to silver, which
 * unlocks the Goliath.
 */
export function Contracts({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const s = sim.snapshot;
  if (!s) return null;
  const toSilver = tripsToSilver(s.medals, s.tripsCarried);
  return (
    <aside className="panel contracts" aria-label="Contracts" data-testid="contracts" data-chrome="panel">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Contracts</h2>
      <ul className="contract-list">
        {s.contracts.map((c) => (
          <li key={c.id} data-testid="contract" data-landmark={c.landmark} data-kind={c.kind} data-held={c.held ? 'yes' : 'no'} data-met={c.met ? 'yes' : 'no'} data-days-met={c.daysMet}>
            <strong>
              {capitalise(askText(c.kind, c.ask))} at {c.landmark}
            </strong>
            <span>
              {c.daysNeeded} days in a row · {usd(c.rewardCents)}
            </span>
            <span className={c.met ? 'met' : 'short'}>Today: {figureText(c.kind, c.figure, c.ask)}</span>
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
      <section className="medal-ladder" aria-label="Medals" data-testid="medal-ladder" data-to-silver={toSilver}>
        <h3>Medals</h3>
        <ul className="medal-list">
          {MEDAL_IDS.map((m) => {
            const day = s.medals[m];
            const status =
              day !== null
                ? `Since ${dateText(day)}${m === 'silver' ? ' · the Goliath is for sale' : ''}`
                : m === 'silver'
                  ? // Silver is awarded at the day's close: from 25,000 trips until then the bar read "0 trips to go · unlocks the
                    // Goliath" while the Goliath stayed locked (the systems audit's eighth round).
                    toSilver > 0
                    ? `${toSilver.toLocaleString('en-US')} ${toSilver === 1 ? 'trip' : 'trips'} to go · unlocks the Goliath`
                    : 'reached · silver comes at midnight, and the Goliath with it'
                  : null;
            return (
              <li key={m} data-testid="medal" data-medal={m} data-held={day === null ? 'no' : 'yes'}>
                <span className="medal" data-medal={m} />
                <strong>{MEDAL_NAMES[m]}</strong>: {medalBarText(m)}
                {status ? <span className="status"> · {status}</span> : null}
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
