// "People within a walk" (PLAN §3: "≈9,000 people within a walk"): the residents whose homes lie
// within the walk to a stop at `at`. One predicate for the probe now and the walk ring and line
// tool later (GD-05), so the number on screen is the number the demand model uses.
import { MAX_WALK_M } from '../config/demand';
import { distXY, type XY } from '../core/geo';
import type { City } from '../city/simfile';

export function peopleWithinWalk(city: City, at: XY, walkM = MAX_WALK_M): number {
  let people = 0;
  for (const cell of city.cells) for (const p of cell.homes) if (distXY(at, [p.x, p.y]) <= walkM) people += p.w;
  return people;
}
