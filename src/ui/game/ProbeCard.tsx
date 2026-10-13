import { about } from '../format';
import type { Sim } from './useSim';

/** "≈9,000 people within a walk" beside the pointer: the catchment rule's own number (sim/rules/catchment). */
export function ProbeCard({ sim, screen }: { sim: Sim; screen: [number, number] | null }) {
  if (!sim.probe || !screen) return null;
  return (
    <div
      className="probe-card"
      style={{ left: screen[0] + 14, top: screen[1] + 14 }}
      data-testid="probe-card"
      data-people={sim.probe.people}
      data-at={sim.probe.at.join(',')}
    >
      {about(sim.probe.people)} people within a walk
    </div>
  );
}
