// Where a panel opens (D25: panels that move and stay open together): the top right first, then each
// next one to the left of those in the way, a row lower when a row has no room, never on top of one
// already open. Shown failing (TS-04) on a layout that put every panel at the top right.
import { describe, expect, it } from 'vitest';
import { freePlace } from './Panels';

const [W, H] = [1366, 768];

describe('a panel’s free place', () => {
  it('opens the first at the top right and the next to its left', () => {
    const first = freePlace(280, 300, [], W, H);
    expect(first).toEqual({ x: W - 12 - 280, y: 56 });
    const second = freePlace(440, 300, [{ ...first, w: 280, h: 300 }], W, H);
    expect(second).toEqual({ x: first.x - 12 - 440, y: 56 });
  });

  it('goes around a panel dragged into the way, and opens below the panels when the top row is full', () => {
    // A panel dragged to the top right corner, and another across the middle of the row.
    const taken = [
      { x: W - 12 - 320, y: 56, w: 320, h: 350 },
      { x: 400, y: 56, w: 500, h: 300 },
    ];
    const next = freePlace(280, 150, taken, W, H);
    expect(next.y).toBe(56);
    expect(next.x + 280 + 12).toBeLessThanOrEqual(400);
    // Too wide for any gap in the top row: it opens in the row below them.
    const wide = freePlace(800, 150, taken, W, H);
    expect(wide.y).toBe(56 + 300 + 12);
    for (const t of taken) expect(wide.y >= t.y + t.h + 12 || wide.x + 800 + 12 <= t.x || t.x + t.w + 12 <= wide.x).toBe(true);
  });
});
