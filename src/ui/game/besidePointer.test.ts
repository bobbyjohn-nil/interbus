// Where a card beside the pointer goes (a dot's card, and those of Place a stop and Place a depot):
// below and to the right of the pointer, or on its other side where the window ends, so the whole
// card shows. Shown failing (TS-04) on the cards before the systems audit (D26), which sat 14 px
// below and right of the pointer whatever the window: a dot's card 155 px wide, beside a dot 111 px
// from the right edge of a 1152 px window, ran 58 px out of it (sim.spec.ts shows it on the page).
import { describe, expect, it } from 'vitest';
import { besidePointer } from './besidePointer';

const WINDOW = [1152, 720] as const;

describe('a card beside the pointer', () => {
  it('sits below and to the right of the pointer where the window has room', () => {
    expect(besidePointer([400, 300], [155, 40], WINDOW)).toEqual({ left: 414, top: 314 });
  });

  it('goes to the pointer’s other side at the window’s right and bottom edges, the whole card inside', () => {
    const card = besidePointer([1041, 690], [155, 40], WINDOW);
    expect(card).toEqual({ left: 1041 - 14 - 155, top: 690 - 14 - 40 });
    expect(card.left + 155).toBeLessThanOrEqual(1152);
    expect(card.top + 40).toBeLessThanOrEqual(720);
  });

  it('never leaves the window at its left or top, even for a card too wide for either side', () => {
    expect(besidePointer([300, 20], [900, 40], WINDOW)).toEqual({ left: 8, top: 34 });
  });
});
