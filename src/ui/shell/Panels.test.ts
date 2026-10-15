// Where a panel opens (D25: panels that move and stay open together): the top right first, then each
// next one to the left of those in the way, a row lower when a row has no room, never on top of one
// already open. Shown failing (TS-04) on a layout that put every panel at the top right. A panel's
// row needs room for 160 px of it down to the dock, and the panel is never taller than the room
// there (roomBelow), so it covers neither the dock, the map's credit nor another panel; a window that
// changes size keeps it whole (keptWhole). Shown failing on the layout before the systems audit
// (D26), which put Contracts at (96, 417) in the audit's layout below at its full 510 px, 207 px past
// the 720 px window, and left a panel where it opened when the window narrowed. A panel dragged low
// stops whole above the dock (inReach): shown failing on 5f4bce3 (its rule exported), which let Saves
// down to 600 px of a 720 px window, its 160 px running 40 px off the bottom (the systems audit's third round). So
// does a short panel that opens or is kept low (freePlace, keptWhole): shown failing on 5f4bce3, which
// opened a 100 px panel at 532 px of 720, where growing to 160 px took it 44 px over the dock and the
// drag's floor above would jump it 44 px up when grabbed, and kept one at 478 px of a 650 px window.
import { describe, expect, it } from 'vitest';
import { freePlace, inReach, keptWhole, roomBelow } from './Panels';

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

  it('opens above the dock beside every panel open, no taller than the room down to the dock', () => {
    // At 1152 × 720: Lines, Finance and Saves across the top and a stop's card under Lines, as the audit had them.
    const [w, h] = [1152, 720];
    const taken = [
      { x: 860, y: 56, w: 280, h: 275 },
      { x: 408, y: 56, w: 440, h: 374 },
      { x: 76, y: 56, w: 320, h: 349 },
      { x: 860, y: 343, w: 280, h: 250 },
    ];
    /** A panel `pw` by `ph` as it shows at `p`: its height cut to the room below its top. */
    const shown = (p: { x: number; y: number }, pw: number, ph: number) => ({ ...p, w: pw, h: Math.min(ph, roomBelow(p.y, h)) });
    const apart = (p: { x: number; y: number; w: number; h: number }) =>
      taken.every((t) => p.y >= t.y + t.h + 12 || p.y + p.h + 12 <= t.y || p.x + p.w + 12 <= t.x || t.x + t.w + 12 <= p.x);
    // A short panel fits whole in a row below them.
    const short = shown(freePlace(300, 200, taken, w, h), 300, 200);
    expect(short.h).toBe(200);
    expect(short.y + short.h).toBeLessThanOrEqual(h - 72);
    expect(apart(short)).toBe(true);
    // Contracts, 510 px tall, opens there too, beside Saves and under Finance, with 231 px of it showing above the dock; the rest scrolls.
    const contracts = shown(freePlace(300, 510, taken, w, h), 300, 510);
    expect(contracts).toEqual({ x: 96, y: 417, w: 300, h: 231 });
    expect(contracts.y + contracts.h).toBe(h - 72);
    expect(apart(contracts)).toBe(true);
  });

  it('opens a short panel no lower than 160 px above the dock, where it can grow and be dragged without a jump', () => {
    // At 1152 × 720 under a panel across the window down to 520 px: 160 px below the row at 532 run into the dock, so a
    // 100 px panel opens at the top right a step down, as with room in no row, not in that gap.
    const [w, h] = [1152, 720];
    expect(freePlace(300, 100, [{ x: 12, y: 56, w: 1128, h: 464 }], w, h)).toEqual({ x: w - 12 - 300, y: 56 + 28 });
    // With 160 px of room it opens there, as low as 160 px above the dock.
    expect(freePlace(300, 100, [{ x: 12, y: 56, w: 1128, h: 420 }], w, h)).toEqual({ x: w - 12 - 300, y: h - 72 - 160 });
    // A short panel low in a window that gets shorter keeps 160 px above the dock too.
    expect(keptWhole({ x: 96, y: 540 }, 300, w, 650)).toEqual({ x: 96, y: 650 - 72 - 160 });
  });

  it('with room in no row, opens at the top right, as far down as a step while 160 px stay above the dock', () => {
    // A window 300 px tall with one panel across it: 160 px of a new one fits only over it.
    const at = freePlace(300, 400, [{ x: 12, y: 56, w: 1128, h: 160 }], 1152, 300);
    expect(at).toEqual({ x: 1152 - 12 - 300, y: 300 - 72 - 160 });
    expect(at.y + roomBelow(at.y, 300)).toBe(300 - 72);
  });

  it('keeps a panel whole when the window changes size, and above the dock', () => {
    // Finance, 440 px wide, opened at the top right of a 1366 px window: the window narrows to 1152.
    expect(keptWhole({ x: 914, y: 56 }, 440, 1152, 720)).toEqual({ x: 1152 - 12 - 440, y: 56 });
    // A panel low in the window, which then gets shorter: it moves up as far as keeps 160 px of it above the dock.
    const low = keptWhole({ x: 96, y: 417 }, 300, 1152, 600);
    expect(low).toEqual({ x: 96, y: 600 - 72 - 160 });
    expect(low.y + roomBelow(low.y, 600)).toBe(600 - 72);
    // Where it is whole already, it stays.
    expect(keptWhole({ x: 96, y: 417 }, 300, 1366, 768)).toEqual({ x: 96, y: 417 });
  });
});

describe('a dragged panel’s place', () => {
  it('stops whole above the dock and the map’s credit, however low it is dragged, as short as 160 px there', () => {
    // At 1152 × 720, Saves (320 px wide, opened at the top right) dragged 900 px down, and 700 px left or 400 px right.
    const [w, h] = [1152, 720];
    for (const dx of [-700, 400]) {
      const at = inReach({ x: 820 + dx, y: 56 + 900 }, 320, w, h);
      expect(at.y).toBe(h - 72 - 160);
      expect(at.y + roomBelow(at.y, h)).toBe(h - 72);
    }
    // Dragged only a little low, it stays where it was let go, whole and taller.
    expect(inReach({ x: 400, y: 300 }, 320, w, h)).toEqual({ x: 400, y: 300 });
    expect(300 + roomBelow(300, h)).toBe(h - 72);
    // Above the window's top it stops at the top; sideways 48 px stay on screen, as before.
    expect(inReach({ x: -1000, y: -50 }, 320, w, h)).toEqual({ x: 48 - 320, y: 0 });
    expect(inReach({ x: 2000, y: 100 }, 320, w, h)).toEqual({ x: w - 48, y: 100 });
    // A window too short for 160 px of it above the dock keeps the panel's top, its heading, on screen.
    expect(inReach({ x: 400, y: 300 }, 320, w, 200).y).toBe(0);
  });
});
