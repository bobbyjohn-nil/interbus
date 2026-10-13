import type { Speed } from '../../sim/types';
import { CREDIT_LIMIT_CENTS } from '../../sim/rules/credit';
import { MEDAL_IDS } from '../../sim/rules/medal';
import { undoText } from '../copy';
import { about, clock, MEDAL_NAMES, usd, usdK } from '../format';
import { CHECKLIST, checklistStep, checklistText } from '../game/checklist';
import type { Sim } from '../game/useSim';

const SPEEDS: readonly [Speed, string][] = [
  [0, 'Pause'],
  [1, '1×'],
  [2, '2×'],
  [3, '3×'],
];

/**
 * The calm shell's chip row (PLAN §8, the M2 spec item 7): labelled chips for the date and clock,
 * the speed, Cash, Riders/day and the day's costs, and the checklist's next step (K20). The speed
 * waits until the company is founded. While paused, Undo names the command it would take back (I9);
 * below the credit line's floor, a countdown names the day closes left (D10). The checklist's last
 * step opens Contracts, and once the checklist is done its place is the Contracts chip (the M3 spec,
 * items 11 and 12), so contracts add nothing to the shell at rest (I13). The medals held show there
 * too, a dot of each one's metal; the Contracts panel names the ladder and the trips left to silver
 * (the M4 spec, item 3), since a chip of its own broke I13 (DECISIONS, Measured).
 */
export function TopBar({ sim, onContracts }: { sim: Sim; onContracts: () => void }) {
  const s = sim.snapshot;
  if (sim.status !== 'ready' || !s) return null;
  const founded = s.company.name !== '';
  const progress = { depots: s.depots.length, lines: s.lines.length, elapsed: s.elapsed, profitableDays: s.profitableDays, contractTaken: s.contractTaken };
  const checklist = checklistText(progress);
  const toContracts = checklistStep(progress) === CHECKLIST.indexOf('Take a contract');
  const held = s.contracts.filter((c) => c.held).length;
  const medals = MEDAL_IDS.filter((m) => s.medals[m] !== null);
  return (
    <header className="top-bar" aria-label="Company" data-testid="sim-panel" data-chrome="rest" data-cash={s.cashCents} data-elapsed={s.elapsed} data-speed={s.speed} data-costs={s.costsPerDayCents}>
      <span className="chip">
        <span className="chip-label">Day {s.day}</span> {clock(s.hour, s.minute)}
      </span>
      {founded ? (
        <span className="chip speed" role="group" aria-label="Speed">
          {SPEEDS.map(([speed, label]) => (
            <button key={speed} type="button" aria-pressed={s.speed === speed} onClick={() => sim.send({ type: 'speed', speed })}>
              {label}
            </button>
          ))}
        </span>
      ) : null}
      <span className="chip">
        <span className="chip-label">Cash</span> {usd(s.cashCents)}
      </span>
      <span className="chip">
        <span className="chip-label">Riders/day</span> {about(s.ridersPerDay)}
      </span>
      {s.costsPerDayCents > 0 ? (
        <span className="chip">
          <span className="chip-label">Costs/day</span> {usd(s.costsPerDayCents)}
        </span>
      ) : null}
      {s.floor && !s.floor.ended ? (
        <span className="chip countdown" data-testid="countdown" data-left={s.floor.closesLeft}>
          {s.floor.closesLeft} {s.floor.closesLeft === 1 ? 'day' : 'days'} to get above {usdK(-CREDIT_LIMIT_CENTS)}
        </span>
      ) : null}
      {s.undo ? (
        <button type="button" className="chip undo" data-testid="undo" onClick={() => sim.send({ type: 'undo' })}>
          {undoText(s.undo)}
        </button>
      ) : null}
      {founded && checklist && !toContracts ? (
        <span className="chip checklist" data-testid="checklist">
          {checklist}
        </span>
      ) : null}
      {founded && checklist && toContracts ? (
        <button type="button" className="chip checklist" data-testid="checklist" onClick={onContracts}>
          {checklist}
        </button>
      ) : null}
      {founded && !checklist ? (
        <button type="button" className="chip contracts" data-testid="contracts-chip" onClick={onContracts}>
          <span className="chip-label">Contracts</span> {held > 0 ? `${held} held` : `${s.contracts.length} on offer`}
          {medals.length > 0 ? (
            <span className="medals" data-testid="medals" data-held={medals.join(' ')}>
              {medals.map((m) => (
                <span key={m} className="medal" data-medal={m} title={`${MEDAL_NAMES[m]} medal`} />
              ))}
            </span>
          ) : null}
        </button>
      ) : null}
    </header>
  );
}
