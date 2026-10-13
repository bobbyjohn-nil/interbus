import { describe, expect, it } from 'vitest';
import { FIRST_IDS, ID_KINDS, mint, type NextIds } from './ids';
import { createRng } from './rng';

describe('ids', () => {
  it('never hands out the same id twice, whatever is deleted in between (K01)', () => {
    // V1 minted `length + 1` and V3 never saved its bus counter; minting from a live count
    // re-issues the id of the newest deleted item. Here each kind mints from its own counter.
    const rng = createRng(2026);
    let next: NextIds = FIRST_IDS;
    const live = new Map<string, number[]>(ID_KINDS.map((k) => [k, []]));
    const issued = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const kind = rng.pick(ID_KINDS);
      const ids = live.get(kind)!;
      if (ids.length > 0 && rng.next() < 0.45) {
        ids.splice(rng.int(0, ids.length - 1), 1);
        continue;
      }
      const [id, after] = mint(next, kind);
      next = after;
      expect(issued.has(`${kind}:${id}`), `${kind} ${id} reissued`).toBe(false);
      issued.add(`${kind}:${id}`);
      ids.push(id);
    }
  });

  it('starts every kind at 1 and leaves the other counters alone', () => {
    const [stop, next] = mint(FIRST_IDS, 'stop');
    expect(stop).toBe(1);
    expect(next).toEqual({ ...FIRST_IDS, stop: 2 });
  });

  it('refuses a broken counter instead of reissuing ids', () => {
    expect(() => mint({ ...FIRST_IDS, bus: 0 }, 'bus')).toThrow(RangeError);
    expect(() => mint({ ...FIRST_IDS, line: Number.NaN }, 'line')).toThrow(RangeError);
  });
});
