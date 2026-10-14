// "People within a walk" (PLAN §3: "≈9,000 people within a walk"): the residents whose homes lie
// within the walk to a stop at `at`, or to any of a line's stops, and the jobs within a walk of a job
// dot (D25). One predicate for the probe, the walk ring and the line tool (GD-05), so the number on
// screen is the number the demand model uses.
import { MAX_WALK_M } from '../config/demand';
import { distXY, type XY } from '../core/geo';
import type { City } from '../city/simfile';

export function peopleWithinWalk(city: City, at: XY, walkM = MAX_WALK_M): number {
  let people = 0;
  for (const cell of city.cells) for (const p of cell.homes) if (distXY(at, [p.x, p.y]) <= walkM) people += p.w;
  return people;
}

/** The jobs whose places lie within the walk to `at`: a job dot's card. */
export function jobsWithinWalk(city: City, at: XY, walkM = MAX_WALK_M): number {
  let jobs = 0;
  for (const cell of city.cells) for (const p of cell.work) if (distXY(at, [p.x, p.y]) <= walkM) jobs += p.w;
  return jobs;
}

/** Residents within a walk of any of `stops`, each counted once. */
export function peopleNearStops(city: City, stops: readonly XY[], walkM = MAX_WALK_M): number {
  if (!stops.length) return 0;
  let people = 0;
  for (const cell of city.cells) for (const p of cell.homes) if (stops.some((s) => distXY(s, [p.x, p.y]) <= walkM)) people += p.w;
  return people;
}
