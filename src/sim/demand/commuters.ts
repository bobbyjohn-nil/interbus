// Who commutes where: V1's gravity matrix (`Intralines@7af45b1:src/game/sim/demand.worker.ts:142-165`,
// R01), over cells instead of block groups. Each cell's workers (LODES RAC, where V1 multiplied
// residents by a workforce rate) spread over every other cell's jobs by exp(-d/β), β the city's own,
// fitted to LODES (sim.json's calib; V1 used 4 km everywhere). It does not depend on the network, so
// it is built once per city.
import { GRAVITY_CUTOFF_KM } from '../config/demand';
import { distXY, type XY } from '../core/geo';
import type { City, SubPoint } from '../city/simfile';

export interface Commuters {
  readonly n: number;
  /** flow[i * n + j]: daily one-way commuters living in cell i and working in cell j. */
  readonly flow: Float64Array;
  /** Straight-line km between the cells' home and work centres. */
  readonly km: Float64Array;
}

/** The weighted centre of some points, or null if they weigh nothing. */
export function centre(points: readonly SubPoint[]): XY | null {
  const w = points.reduce((s, p) => s + p.w, 0);
  if (w <= 0) return null;
  return [points.reduce((s, p) => s + p.x * p.w, 0) / w, points.reduce((s, p) => s + p.y * p.w, 0) / w];
}

export function buildCommuters(city: City, betaKm = city.gravityBetaM / 1000): Commuters {
  const n = city.cells.length;
  const flow = new Float64Array(n * n);
  const km = new Float64Array(n * n);
  const homes = city.cells.map((c) => centre(c.homes));
  const work = city.cells.map((c) => centre(c.work));
  for (let i = 0; i < n; i++) {
    const from = homes[i];
    const workers = city.cells[i]!.workers;
    if (!from || workers <= 0) continue;
    let weight = 0;
    for (let j = 0; j < n; j++) {
      const to = work[j];
      if (!to) continue;
      const d = distXY(from, to) / 1000;
      km[i * n + j] = d;
      // A cell's own jobs are within a walk; V1 left them out of the bus market too.
      if (i === j || d > GRAVITY_CUTOFF_KM) continue;
      const w = city.cells[j]!.jobs * Math.exp(-d / betaKm);
      flow[i * n + j] = w;
      weight += w;
    }
    if (weight <= 0) continue;
    for (let j = 0; j < n; j++) flow[i * n + j] = flow[i * n + j]! * (workers / weight);
  }
  return { n, flow, km };
}
