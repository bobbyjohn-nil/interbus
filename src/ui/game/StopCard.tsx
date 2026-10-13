import { STOP_LOSS_CENTS, STOP_QUIET_BOARDINGS } from '../../sim/rules/stopDay';
import { about, usd } from '../format';
import type { Sim } from './useSim';

/**
 * A stop's card (the M3 spec, item 5): who boards and gets off there a day over every line that
 * calls, what it nets, and its QUIET or LOSS flag in words, the same rule the map's ring draws.
 */
export function StopCard({ sim, stopId, onLine, onClose }: { sim: Sim; stopId: number; onLine: (id: number) => void; onClose: () => void }) {
  const stop = sim.snapshot?.stops.find((s) => s.id === stopId);
  if (!stop) return null;
  const lines = (sim.snapshot?.lines ?? []).filter((l) => stop.lineIds.includes(l.id));
  return (
    <aside
      className="panel stop-card"
      aria-label={`Stop ${stop.id}`}
      data-testid="stop-card"
      data-chrome="panel"
      data-quiet={stop.quiet ? 'yes' : 'no'}
      data-loss={stop.loss ? 'yes' : 'no'}
      data-net={stop.netCents}
    >
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Stop {stop.id}</h2>
      <p>
        {about(stop.boardings)} board and {about(stop.alightings)} get off a day
      </p>
      <p>Nets ≈{usd(stop.netCents, { cents: true })} a day</p>
      {stop.quiet ? <p className="flag">QUIET · fewer than {STOP_QUIET_BOARDINGS} boardings a day</p> : null}
      {stop.loss ? <p className="flag">LOSS · losing more than {usd(-STOP_LOSS_CENTS)} a day</p> : null}
      <div className="lines">
        {lines.map((l) => (
          <button key={l.id} type="button" onClick={() => onLine(l.id)}>
            <span className="swatch" style={{ background: l.colour }} /> {l.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
