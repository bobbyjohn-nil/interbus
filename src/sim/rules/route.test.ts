// The route rule (the M3 spec, item 14): a line keeps two stops, and a stop no other line calls at
// comes down for half of what it and its fittings cost.
import { describe, expect, it } from 'vitest';
import { checkRemoveStop, stopCostCents } from './route';

const line = { stopIds: [1, 2, 3, 4] };

describe('taking a stop off a line', () => {
  it('gives back half a Sign’s $4k when no other line calls there, and nothing when one does', () => {
    expect(checkRemoveStop(line, { id: 2, tier: 1 }, 0)).toEqual({ ok: true, orphaned: true, refundCents: 200_000 });
    expect(checkRemoveStop(line, { id: 2, tier: 1 }, 1)).toEqual({ ok: true, orphaned: false, refundCents: 0 });
  });

  it('gives back half of a Station’s fittings with it: $4k, $12k and $35k, so $25.5k', () => {
    expect(stopCostCents(3)).toBe(5_100_000);
    expect(checkRemoveStop(line, { id: 3, tier: 3 }, 0)).toEqual({ ok: true, orphaned: true, refundCents: 2_550_000 });
  });

  it('keeps a line at two stops, and refuses a stop the line does not call at', () => {
    expect(checkRemoveStop({ stopIds: [1, 2] }, { id: 1, tier: 1 }, 0)).toEqual({ ok: false, reason: 'line_keeps_two', limit: 2 });
    expect(checkRemoveStop(line, { id: 9, tier: 1 }, 0)).toEqual({ ok: false, reason: 'not_on_line' });
  });
});
