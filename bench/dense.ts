// Lines between Inner Boston's densest neighbourhoods, wider than T03's ten corridors (bench/inner.ts),
// for the medal ladder's question (DECISIONS, Open): each peopled cell at its home points' weighted
// middle, densest first and at least 1.5 km from those already taken, up to 24 of them; then each pair
// 2–7 km apart, laid along the streets as the pacing run lays a corridor (sim/sweep.ts corridorStops),
// with stops about 600 m and 1 km apart. bench/coverage.ts measures what they reach and founds the
// best of them; bench/pacing.ts adds them to its candidates with PACING_CANDIDATES=wide.
import { FOUNDING_HEADWAYS } from '../src/sim/config/lines';
import { distXY, toLngLat, type LngLat, type XY } from '../src/sim/core/geo';
import type { PacingCandidate } from '../src/sim/pacing';
import { corridorStops } from '../src/sim/sweep';
import type { World } from '../src/sim/world';

/** Neighbourhood middles at least this far apart. */
const APART_M = 1_500;
const NEIGHBOURHOODS = 24;
/** A line joins two neighbourhoods this far apart, as the crow flies. */
const PAIR_M = [2_000, 7_000] as const;
const SPACINGS_M = [600, 1_000] as const;

/** The densest neighbourhoods' middles, densest first. */
export function denseCentres(world: World): XY[] {
  const centres: XY[] = [];
  for (const c of [...world.city.cells].filter((c) => c.homes.length > 0).sort((a, b) => b.residents - a.residents)) {
    const w = c.homes.reduce((s, p) => s + p.w, 0) || 1;
    const at: XY = [c.homes.reduce((s, p) => s + p.x * p.w, 0) / w, c.homes.reduce((s, p) => s + p.y * p.w, 0) / w];
    if (centres.every((o) => distXY(o, at) >= APART_M)) centres.push(at);
    if (centres.length >= NEIGHBOURHOODS) break;
  }
  return centres;
}

/** Lines between each pair of the densest neighbourhoods, at each stop spacing, named by the pair's places in density order. */
export function denseLines(world: World): { name: string; stops: LngLat[] }[] {
  const centres = denseCentres(world);
  const out: { name: string; stops: LngLat[] }[] = [];
  for (let a = 0; a < centres.length; a++)
    for (let b = a + 1; b < centres.length; b++) {
      const d = distXY(centres[a]!, centres[b]!);
      if (d < PAIR_M[0] || d > PAIR_M[1]) continue;
      for (const spacing of SPACINGS_M) {
        const stops = corridorStops(world, toLngLat(world.city.frame, centres[a]!), toLngLat(world.city.frame, centres[b]!), spacing);
        if (stops && stops.length >= 2) out.push({ name: `dense ${a + 1} to ${b + 1}, every ${spacing} m`, stops });
      }
    }
  return out;
}

/** The dense lines as the pacing run's candidates, at the founding headways as its corridor parts are. */
export function denseCandidates(world: World): PacingCandidate[] {
  return denseLines(world).map((l) => ({ name: `${l.name}, ${l.stops.length} stops`, stops: l.stops, headways: FOUNDING_HEADWAYS }));
}
