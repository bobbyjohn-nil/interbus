// The day card in the middle at the top lay over the second panel opened: with Lines open, 73.5% of Finance at 1152×720, its views
// among it (the systems audit's fifteenth round). It goes beside the panels where a gap holds it, nearest the middle, and stays in
// the middle where nothing is in its way or no gap holds it.
import { describe, expect, it } from 'vitest';
import { besidePanels } from './besidePanels';

describe('the day card beside the open panels', () => {
  it('stays in the middle with nothing in its way: no panels, or one beside the middle', () => {
    expect(besidePanels(380, [], 1152)).toBeNull();
    // Lines alone at the right: the card's 386 to 766 px are clear of it.
    expect(besidePanels(380, [{ left: 840, right: 1140 }], 1152)).toBeNull();
  });

  it('goes into the gap nearest the middle that holds it, as wide as fits, down to its narrowest', () => {
    // Lines at the right and Finance beside it, over the middle: at 1366 px the card fits whole left of Finance, as near the
    // middle as it can be; at 1152 px the 388 px left of Finance hold 364 px inside their gaps, and the card narrows to that.
    expect(besidePanels(380, [{ left: 1054, right: 1354 }, { left: 602, right: 1042 }], 1366)).toEqual({ x: 210, w: 380 });
    expect(besidePanels(380, [{ left: 840, right: 1140 }, { left: 388, right: 828 }], 1152)).toEqual({ x: 12, w: 364 });
    // A gap of 316 px holds the card at its narrowest, 292 px, 12 px inside it.
    expect(besidePanels(380, [{ left: 840, right: 1140 }, { left: 316, right: 828 }], 1152)).toEqual({ x: 12, w: 292 });
  });

  it('stays in the middle where no gap holds even its narrowest', () => {
    expect(besidePanels(380, [{ left: 840, right: 1140 }, { left: 315, right: 828 }], 1152)).toBeNull();
    expect(besidePanels(380, [{ left: 0, right: 1152 }], 1152)).toBeNull();
  });
});
