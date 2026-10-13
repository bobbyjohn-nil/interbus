import { describe, expect, it } from 'vitest';
import { createRng, hashString, seedFor } from './rng';

// Outputs of V2's own code (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/10-core.js:
// 427-460`), run under Node on 2026-10-13: the port must give the same numbers.
describe('seeded RNG (ported from V2)', () => {
  it("matches V2's IL.hash", () => {
    expect(hashString('interbus')).toBe(1807368973);
    expect(hashString('')).toBe(2166136261);
  });

  it("matches V2's IL.rng sequences, salted by purpose", () => {
    const r = createRng(seedFor(42, 'demand'));
    expect([r.next(), r.next(), r.next(), r.next(), r.next()]).toEqual([
      0.4077326478436589, 0.6613358070608228, 0.7183200856670737, 0.22233414556831121, 0.0890065673738718,
    ]);
    const s = createRng(7);
    expect([s.next(), s.next(), s.next()]).toEqual([0.011704753153026104, 0.06195825757458806, 0.97690763277933]);
  });

  it("matches V2's int and shuffle helpers", () => {
    const r = createRng(seedFor(9, 'int'));
    expect(Array.from({ length: 6 }, () => r.int(1, 6))).toEqual([5, 2, 1, 2, 6, 3]);
    expect(createRng(seedFor(9, 'shuffle')).shuffle([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([3, 7, 4, 2, 5, 8, 6, 1]);
  });

  it('continues the same sequence from its saved state (PLAN §6: the save holds the RNG)', () => {
    const a = createRng(seedFor(42, 'demand'));
    for (let i = 0; i < 1000; i++) a.next();
    const b = createRng(a.state);
    for (let i = 0; i < 100; i++) expect(b.next()).toBe(a.next());
  });

  it('gives each purpose its own stream', () => {
    expect(seedFor(1, 'demand')).not.toBe(seedFor(1, 'events'));
  });
});
