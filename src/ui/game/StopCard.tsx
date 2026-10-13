import { STOP_LOSS_CENTS, STOP_QUIET_BOARDINGS } from '../../sim/rules/stopDay';
import { checkStopTier, STOP_TIERS, type StopTier } from '../../sim/rules/stopTier';
import { refusalText } from '../copy';
import { about, usd, usdK } from '../format';
import type { Sim } from './useSim';

/**
 * A stop's card (the M3 spec, item 5): who boards and gets off there a day over every line that
 * calls, what it nets, its QUIET or LOSS flag in words (the same rule the map's ring draws), and its
 * tier, one step up or down at a time on the tier rule the command checks (GD-05).
 */
export function StopCard({ sim, stopId, onLine, onClose }: { sim: Sim; stopId: number; onLine: (id: number) => void; onClose: () => void }) {
  const stop = sim.snapshot?.stops.find((s) => s.id === stopId);
  if (!stop) return null;
  const lines = (sim.snapshot?.lines ?? []).filter((l) => stop.lineIds.includes(l.id));
  const tier = stop.tier as StopTier;
  const here = { cashCents: sim.snapshot?.cashCents ?? 0, linesHere: stop.lineIds.length };
  const upTo = tier < 5 ? ((tier + 1) as StopTier) : null;
  const downTo = tier > 1 ? ((tier - 1) as StopTier) : null;
  const up = upTo ? checkStopTier(here, tier, upTo) : null;
  const down = downTo ? checkStopTier(here, tier, downTo) : null;
  return (
    <aside
      className="panel stop-card"
      aria-label={`Stop ${stop.id}`}
      data-testid="stop-card"
      data-chrome="panel"
      data-quiet={stop.quiet ? 'yes' : 'no'}
      data-loss={stop.loss ? 'yes' : 'no'}
      data-net={stop.netCents}
      data-tier={stop.tier}
    >
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>
        Stop {stop.id} · {STOP_TIERS[tier].name}
      </h2>
      {STOP_TIERS[tier].walkBonusMin > 0 ? <p className="hint">Feels {STOP_TIERS[tier].walkBonusMin} min nearer on foot</p> : null}
      <p>
        {about(stop.boardings)} board and {about(stop.alightings)} get off a day
      </p>
      <p>Nets ≈{usd(stop.netCents, { cents: true })} a day</p>
      {stop.quiet ? <p className="flag">QUIET · fewer than {STOP_QUIET_BOARDINGS} boardings a day</p> : null}
      {stop.loss ? <p className="flag">LOSS · losing more than {usd(-STOP_LOSS_CENTS)} a day</p> : null}
      <div className="controls">
        {upTo && up ? (
          <button type="button" disabled={!up.ok} onClick={() => sim.send({ type: 'set-stop-tier', stopId: stop.id, tier: upTo })}>
            Make it {/^[AEIOU]/.test(STOP_TIERS[upTo].name) ? 'an' : 'a'} {STOP_TIERS[upTo].name} · {usdK(STOP_TIERS[upTo].upgradeCents)}
          </button>
        ) : null}
        {downTo && down?.ok ? (
          <button type="button" onClick={() => sim.send({ type: 'set-stop-tier', stopId: stop.id, tier: downTo })}>
            Back to {STOP_TIERS[downTo].name} · {usdK(down.saleCents)} back
          </button>
        ) : null}
      </div>
      {up && !up.ok ? (
        <p className="refusal" role="status">
          {refusalText(up)}
        </p>
      ) : null}
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
