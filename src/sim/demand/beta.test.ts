// The gravity decay fitted to LODES (city-boston-r1; tools/bake/beta.mjs). The bake fits β with its
// own copy of the commuter matrix's mean commute, so this holds the copy to the game's matrix: if the
// two drift apart, the fitted β describes a matrix the game does not play.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { cellKm, CUTOFF_KM, fitBeta, modelMeanKm } from '../../../tools/bake/beta.mjs';
import { loadCity } from '../city/simfile';
import { GRAVITY_CUTOFF_KM } from '../config/demand';
import { buildCommuters } from './commuters';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;
// The bake's cells: sub-points in decimetres, as sim.json holds them.
const bakeCells = city.cells.map((c) => ({ workers: c.workers, jobs: c.jobs, homes: c.homes.map((p) => ({ x: p.x * 10, y: p.y * 10, w: p.w })), work: c.work.map((p) => ({ x: p.x * 10, y: p.y * 10, w: p.w })) }));

/** The game's mean commute in km: its matrix's flows over their lengths. */
function gameMeanKm(betaM: number): number {
  const { n, flow, km } = buildCommuters(city, betaM / 1000);
  let trips = 0;
  let sum = 0;
  for (let k = 0; k < n * n; k++) {
    trips += flow[k]!;
    sum += flow[k]! * km[k]!;
  }
  return sum / trips;
}

describe('the gravity β fit', () => {
  it('plays Boston’s fitted β on the fixture: 3,260 m (V1 used 4 km)', () => {
    expect(city.gravityBetaM).toBe(3_260);
  });

  it('models the same mean commute as the game’s matrix, at any β', () => {
    const km = cellKm(bakeCells);
    for (const beta of [1_000, 3_260, 4_000, 8_000]) expect(modelMeanKm(bakeCells, km, beta), `β ${beta}`).toBeCloseTo(gameMeanKm(beta), 9);
    expect(CUTOFF_KM).toBe(GRAVITY_CUTOFF_KM);
  });

  it('recovers the β that made the commutes', () => {
    // Commutes drawn from the game's own matrix at 2,500 m, as LODES pairs: the fit finds 2,500 m.
    const { n, flow } = buildCommuters(city, 2.5);
    const pairs: [number, number, number][] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (flow[i * n + j]! > 0) pairs.push([i, j, Math.round(flow[i * n + j]! * 1_000)]);
    expect(Math.abs(fitBeta(bakeCells, pairs).betaM - 2_500)).toBeLessThanOrEqual(20);
  });
});
