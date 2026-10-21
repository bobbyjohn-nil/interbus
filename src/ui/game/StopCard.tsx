import { STOP_LOSS_CENTS, STOP_QUIET_BOARDINGS } from '../../sim/rules/stopDay';
import { runOver } from './runOver';
import { checkRemoveStop, checkTakeDownStop } from '../../sim/rules/route';
import { checkStopTier, STOP_TIERS, stopUpkeepCents, type StopTier } from '../../sim/rules/stopTier';
import { refusalText } from '../copy';
import { about, usd, usdK } from '../format';
import type { Sim } from './useSim';

/**
 * A stop's card (the M3 spec, items 5, 13 and 14): who boards and gets off there a day over every
 * line that calls, how many of those boarding change from another line, what it nets, its QUIET or
 * LOSS flag in words (the same rule the map's ring draws), its tier, one step up or down at a time
 * on the tier rule the command checks, and each line's button to take the stop off it, on the route
 * rule the command checks (GD-05). A stop placed on its own (D25) says no line calls there yet, and
 * can be taken down for half its cost.
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
      data-transfers={stop.transfers.toFixed(1)}
    >
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>
        Stop {stop.id} · {STOP_TIERS[tier].name}
      </h2>
      <p className="hint" data-testid="stop-upkeep">
        Upkeep {usd(stopUpkeepCents(tier))} a day{STOP_TIERS[tier].walkBonusMin > 0 ? ` · feels ${STOP_TIERS[tier].walkBonusMin} min closer on foot` : ''}
      </p>
      {lines.length ? (
        <>
          <p>
            {about(stop.boardings)} board and {about(stop.alightings)} get off a day
          </p>
          {stop.transfers >= 0.5 ? <p>{about(stop.transfers)} of them change here from another line, on the fare they paid</p> : null}
          <p>Nets ≈{usd(stop.netCents, { cents: true })} a day</p>
        </>
      ) : (
        <p data-testid="stop-lone">No line stops here yet. Draw a line through it, or add it in a line’s Edit route.</p>
      )}
      {stop.quiet ? <p className="flag">Quiet: fewer than {STOP_QUIET_BOARDINGS} boardings a day</p> : null}
      {stop.loss ? <p className="flag">Losing money: more than {usd(-STOP_LOSS_CENTS)} a day</p> : null}
      <div className="controls">
        {upTo && up ? (
          <button type="button" disabled={!up.ok || runOver(sim)} title={`Upkeep ${usd(stopUpkeepCents(upTo))} a day`} onClick={() => sim.send({ type: 'set-stop-tier', stopId: stop.id, tier: upTo })}>
            Make it {/^[AEIOU]/.test(STOP_TIERS[upTo].name) ? 'an' : 'a'} {STOP_TIERS[upTo].name} · {usdK(STOP_TIERS[upTo].upgradeCents)}
          </button>
        ) : null}
        {downTo && down?.ok ? (
          <button type="button" disabled={runOver(sim)} onClick={() => sim.send({ type: 'set-stop-tier', stopId: stop.id, tier: downTo })}>
            Make it {/^[AEIOU]/.test(STOP_TIERS[downTo].name) ? 'an' : 'a'} {STOP_TIERS[downTo].name} · {usdK(down.saleCents)} back
          </button>
        ) : null}
      </div>
      {up && !up.ok ? (
        <p className="refusal" role="status">
          {refusalText(up)}
        </p>
      ) : null}
      {lines.length ? null : <TakeDown sim={sim} stopId={stop.id} tier={tier} />}
      <div className="lines">
        {lines.map((l) => {
          const removal = checkRemoveStop(l, { id: stop.id, tier }, stop.lineIds.length - 1);
          return (
            <div key={l.id} className="line-row">
              <button type="button" onClick={() => onLine(l.id)}>
                <span className="swatch" style={{ background: l.colour }} /> {l.name}
              </button>
              <button
                type="button"
                disabled={!removal.ok || runOver(sim)}
                title={removal.ok ? undefined : refusalText(removal)}
                onClick={() => sim.send({ type: 'remove-stop', lineId: l.id, stopId: stop.id })}
              >
                Remove from {l.name}
                {removal.ok && removal.orphaned ? ` · ${usdK(removal.refundCents)} back` : ''}
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/** Take down a stop no line calls at, on the rule the command checks (sim/rules/route.ts checkTakeDownStop). */
function TakeDown({ sim, stopId, tier }: { sim: Sim; stopId: number; tier: StopTier }) {
  const verdict = checkTakeDownStop({ tier }, 0);
  if (!verdict.ok) return null;
  return (
    <div className="controls">
      <button type="button" disabled={runOver(sim)} onClick={() => sim.send({ type: 'take-down-stop', stopId })}>
        Take it down · {usdK(verdict.refundCents)} back
      </button>
    </div>
  );
}
