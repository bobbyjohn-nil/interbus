import type { Speed } from '../../sim/types';
import { refusalText } from '../copy';
import { about, clock, usd } from '../format';
import { checklistText } from './checklist';
import type { Tool } from './Tools';
import type { Sim } from './useSim';

const SPEED_LABELS: readonly [Speed, string][] = [
  [0, 'Pause'],
  [1, '1×'],
  [2, '2×'],
  [3, '3×'],
];

/**
 * M1's debug panel (docs/specs/m1-first-dollar.md): labelled chips for time, Cash and Riders/day (K20), the
 * speed control; from M2, the day's forecast costs and the depot and line tools, which replace M1's debug
 * line. The calm shell replaces it in week 4.
 */
export function SimPanel({ sim, tool, onTool }: { sim: Sim; tool: Tool; onTool: (tool: Tool) => void }) {
  const s = sim.snapshot;
  if (sim.status !== 'ready' || !s) return null;
  // Nothing to run or build until the company is founded.
  const founded = s.company.name !== '';
  const checklist = checklistText({ depots: s.depots.length, lines: s.lines.length, elapsed: s.elapsed, profitableDays: s.profitableDays });
  return (
    <section className="sim-panel" aria-label="Simulation" data-testid="sim-panel" data-cash={s.cashCents} data-elapsed={s.elapsed} data-costs={s.costsPerDayCents}>
      <div className="chips">
        <span className="chip">
          <span className="chip-label">Day {s.day}</span> {clock(s.hour, s.minute)}
        </span>
        <span className="chip">
          <span className="chip-label">Cash</span> {usd(s.cashCents)}
        </span>
        <span className="chip">
          <span className="chip-label">Riders/day</span> {about(s.ridersPerDay)}
        </span>
        {founded && checklist ? (
          <span className="chip checklist" data-testid="checklist">
            {checklist}
          </span>
        ) : null}
        {s.costsPerDayCents > 0 ? (
          <span className="chip">
            <span className="chip-label">Costs/day</span> {usd(s.costsPerDayCents)}
          </span>
        ) : null}
      </div>
      {founded ? (
        <div className="controls">
          {SPEED_LABELS.map(([speed, label]) => (
            <button key={speed} type="button" aria-pressed={s.speed === speed} onClick={() => sim.send({ type: 'speed', speed })}>
              {label}
            </button>
          ))}
          <button type="button" aria-pressed={tool === 'depot'} onClick={() => onTool('depot')}>
            Place a depot
          </button>
          <button type="button" aria-pressed={tool === 'line'} onClick={() => onTool('line')}>
            Draw a line
          </button>
        </div>
      ) : null}
      {sim.refusal?.command === 'place-depot' ? (
        <p className="refusal" role="status">
          {refusalText(sim.refusal)}
        </p>
      ) : null}
    </section>
  );
}
