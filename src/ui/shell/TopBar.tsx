import type { Speed } from '../../sim/types';
import { about, clock, usd } from '../format';
import { checklistText } from '../game/checklist';
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
 * waits until the company is founded.
 */
export function TopBar({ sim }: { sim: Sim }) {
  const s = sim.snapshot;
  if (sim.status !== 'ready' || !s) return null;
  const founded = s.company.name !== '';
  const checklist = checklistText({ depots: s.depots.length, lines: s.lines.length, elapsed: s.elapsed, profitableDays: s.profitableDays });
  return (
    <header className="top-bar" aria-label="Company" data-testid="sim-panel" data-chrome="rest" data-cash={s.cashCents} data-elapsed={s.elapsed} data-costs={s.costsPerDayCents}>
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
      {founded && checklist ? (
        <span className="chip checklist" data-testid="checklist">
          {checklist}
        </span>
      ) : null}
    </header>
  );
}
