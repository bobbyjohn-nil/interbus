import type { Speed } from '../../sim/types';
import { about, clock, usd } from '../format';
import type { Sim } from './useSim';

const SPEED_LABELS: readonly [Speed, string][] = [
  [0, 'Pause'],
  [1, '1×'],
  [2, '2×'],
  [3, '3×'],
];

/**
 * M1's debug panel (docs/specs/m1-first-dollar.md): labelled chips for time, Cash and Riders/day (K20), the
 * speed control and the debug line; from M2, the day's forecast costs. The calm shell replaces it in week 4.
 */
export function SimPanel({ sim }: { sim: Sim }) {
  const s = sim.snapshot;
  if (sim.status !== 'ready' || !s) return null;
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
        {s.costsPerDayCents > 0 ? (
          <span className="chip">
            <span className="chip-label">Costs/day</span> {usd(s.costsPerDayCents)}
          </span>
        ) : null}
      </div>
      <div className="controls">
        {SPEED_LABELS.map(([speed, label]) => (
          <button key={speed} type="button" aria-pressed={s.speed === speed} onClick={() => sim.send({ type: 'speed', speed })}>
            {label}
          </button>
        ))}
        {s.lines.length === 0 ? (
          <button type="button" onClick={() => sim.send({ type: 'add-debug-line' })}>
            Run the debug line
          </button>
        ) : null}
      </div>
    </section>
  );
}
