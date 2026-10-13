// A synthetic Inner-Boston-sized city for the recompute bench (PLAN §10 week 3): about 800 cells of
// 350 m on a 10 × 9.8 km grid, a street every 175 m (an arterial every 700 m), and the T03 network
// of 10 lines and 116 stops (salvage-matrix T03). People and jobs come from the seeded RNG, at about
// Inner Boston's totals (0.6 M residents). Nothing here ships.
import { buildGraph, type EdgeInput } from '../src/sim/city/graph';
import type { Cell, City, Street, SubPoint } from '../src/sim/city/simfile';
import type { LinePlan } from '../src/sim/demand/assign';
import { createRng } from '../src/sim/core/rng';
import type { LineId } from '../src/sim/core/ids';

export const CELL_M = 350;
export const COLS = 29;
export const ROWS = 28;
const STREET_M = 175;

export function syntheticCity(seed = 1): City {
  const rng = createRng(seed);
  const nx = (COLS * CELL_M) / STREET_M + 1;
  const ny = (ROWS * CELL_M) / STREET_M + 1;
  const nodes: [number, number][] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) nodes.push([i * STREET_M, j * STREET_M]);
  const edges: EdgeInput[] = [];
  const streets: Street[] = [];
  const link = (a: number, b: number, arterial: boolean) => {
    const kmh = arterial ? 48 : 30;
    edges.push({ a, b, dm: STREET_M * 10, cs: Math.round((STREET_M / (kmh / 3.6)) * 100) });
    streets.push({ cls: arterial ? 'primary' : 'residential', name: '', oneway: 0, points: [nodes[a]!, nodes[b]!] });
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (i + 1 < nx) link(j * nx + i, j * nx + i + 1, j % 4 === 0);
      if (j + 1 < ny) link(j * nx + i, (j + 1) * nx + i, i % 4 === 0);
    }
  }
  const cells: Cell[] = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      // Denser toward the middle, as a city is; jobs bunch harder than homes.
      const centre = Math.exp(-(((i - COLS / 2) / 9) ** 2 + ((j - ROWS / 2) / 9) ** 2));
      const residents = Math.round(rng.range(200, 900) * (0.4 + centre));
      const jobs = Math.round(rng.range(50, 900) * (0.2 + 2.5 * centre * centre));
      const points = (total: number): SubPoint[] => {
        const w = Array.from({ length: 8 }, () => rng.range(0.5, 1.5));
        const sum = w.reduce((s, v) => s + v, 0);
        const out = w.map((v) => ({ x: i * CELL_M + rng.range(20, CELL_M - 20), y: j * CELL_M + rng.range(20, CELL_M - 20), w: Math.floor((total * v) / sum) }));
        out[0] = { ...out[0]!, w: out[0]!.w + total - out.reduce((s, p) => s + p.w, 0) };
        return out;
      };
      cells.push({ i, j, residents, workers: Math.round(residents * 0.48), jobs, sectors: new Array(20).fill(0), homes: points(residents), work: points(jobs) });
    }
  }
  return {
    id: 'synthetic',
    extent: 'synthetic',
    frame: { origin: [0, 0], metresPerDegLon: 82_385, metresPerDegLat: 111_080 },
    cellMetres: CELL_M,
    graph: buildGraph(nodes, edges),
    streets,
    cells,
    tripScalePermille: 111,
  };
}

/** T03's network: 10 lines, 116 stops, along the arterials, a stop every 700 m. */
export function t03Network(): LinePlan[] {
  const plans: LinePlan[] = [];
  const width = COLS * CELL_M;
  const height = ROWS * CELL_M;
  const line = (n: number, stops: [number, number][]) => {
    const dist = [0];
    for (let k = 1; k < stops.length; k++) dist.push(dist[k - 1]! + Math.abs(stops[k]![0] - stops[k - 1]![0]) + Math.abs(stops[k]![1] - stops[k - 1]![1]));
    plans.push({ id: n as LineId, stops, stopDistM: dist, headways: { peak: 600, offpeak: 900, overnight: n % 3 === 0 ? 1800 : null }, fareCents: 225 });
  };
  const stopsPerLine = [12, 12, 12, 12, 12, 11, 11, 11, 11, 12]; // 116 in all
  for (let n = 0; n < 10; n++) {
    const count = stopsPerLine[n]!;
    const horizontal = n < 5;
    const offset = 700 * (2 + 3 * (n % 5));
    const span = horizontal ? width : height;
    const step = Math.floor((span - 700) / (count - 1) / 175) * 175;
    const stops: [number, number][] = [];
    for (let k = 0; k < count; k++) stops.push(horizontal ? [350 + k * step, offset] : [offset, 350 + k * step]);
    line(n + 1, stops);
  }
  return plans;
}
