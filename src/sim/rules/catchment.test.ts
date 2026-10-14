// Jobs within a walk (D25: a job dot's card): the jobs whose places lie within the walk, the same
// predicate as people within a walk, on the other side of each cell.
import { describe, expect, it } from 'vitest';
import { MAX_WALK_M } from '../config/demand';
import { fixtureCity } from '../testing';
import { jobsWithinWalk, peopleWithinWalk } from './catchment';

describe('jobs within a walk', () => {
  const city = fixtureCity();
  const all = city.cells.flatMap((c) => c.work);
  const busiest = [...all].sort((a, b) => b.w - a.w)[0]!;

  it('counts the job places within the walk of a point, the place itself included', () => {
    const at = [busiest.x, busiest.y] as const;
    const near = all.filter((p) => Math.hypot(p.x - at[0], p.y - at[1]) <= MAX_WALK_M).reduce((s, p) => s + p.w, 0);
    expect(jobsWithinWalk(city, at)).toBe(near);
    expect(jobsWithinWalk(city, at)).toBeGreaterThanOrEqual(busiest.w);
    expect(jobsWithinWalk(city, at, 0)).toBe(all.filter((p) => p.x === at[0] && p.y === at[1]).reduce((s, p) => s + p.w, 0));
  });

  it('reads jobs, not homes, and reaches every job with a walk across the city', () => {
    const at = [busiest.x, busiest.y] as const;
    expect(jobsWithinWalk(city, at)).not.toBe(peopleWithinWalk(city, at));
    expect(jobsWithinWalk(city, at, 1e9)).toBe(city.cells.reduce((s, c) => s + c.jobs, 0));
  });
});
