import { about } from '../format';
import { useBesidePointer } from './besidePointer';
import type { Sim } from './useSim';

/** The words on a dot's card: its own count, then how many live or work within a walk (the catchment rule's own numbers). */
export function probeLines(probe: NonNullable<Sim['probe']>): readonly [string, string] {
  return probe.kind === 'home'
    ? [`${about(probe.here)} people live here`, `${about(probe.within)} people within a walk`]
    : [`${about(probe.here)} jobs here`, `${about(probe.within)} jobs within a walk`];
}

/**
 * Beside the pointer while it is on a demand dot, and only then (D25: "it should only do that when
 * hovering on a demand point"): a home dot's people and those within a walk, or a job dot's jobs
 * and those within a walk (sim/rules/catchment). Below and to the right of the pointer, or on its
 * other side where the window ends, so the whole card shows.
 */
export function ProbeCard({ sim, screen }: { sim: Sim; screen: [number, number] | null }) {
  const card = useBesidePointer(screen, screen && sim.probe);
  if (!sim.probe || !screen) return null;
  const [here, within] = probeLines(sim.probe);
  return (
    <div
      ref={card}
      className="probe-card"
      data-testid="probe-card"
      data-kind={sim.probe.kind}
      data-here={sim.probe.here}
      data-within={sim.probe.within}
      data-at={sim.probe.at.join(',')}
    >
      <strong>{here}</strong>
      <span>{within}</span>
    </div>
  );
}
