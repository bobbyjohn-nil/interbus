// The stop tier rule (the M3 spec, item 5; V1's ladder): a step up at its price, a step down at half
// back, and the hub tiers only where enough lines call.
import { describe, expect, it } from 'vitest';
import { checkStopTier } from './stopTier';

const rich = { cashCents: 100_000_000, linesHere: 1 };

describe('a stop’s tier', () => {
  it('costs each step up its price: $12k, $35k, $90k, $200k', () => {
    expect(checkStopTier(rich, 1, 2)).toEqual({ ok: true, priceCents: 1_200_000, saleCents: 0 });
    expect(checkStopTier(rich, 1, 3)).toEqual({ ok: true, priceCents: 4_700_000, saleCents: 0 });
    expect(checkStopTier({ ...rich, linesHere: 5 }, 3, 5)).toEqual({ ok: true, priceCents: 29_000_000, saleCents: 0 });
  });

  it('gives back half of what the steps down cost', () => {
    expect(checkStopTier(rich, 2, 1)).toEqual({ ok: true, priceCents: 0, saleCents: 600_000 });
    expect(checkStopTier(rich, 3, 2)).toEqual({ ok: true, priceCents: 0, saleCents: 1_750_000 });
    expect(checkStopTier(rich, 5, 1)).toEqual({ ok: true, priceCents: 0, saleCents: 16_850_000 });
  });

  it('needs 3 lines calling for an Interchange and 5 for a Transfer Hub, but never to come down', () => {
    expect(checkStopTier({ ...rich, linesHere: 2 }, 3, 4)).toMatchObject({ ok: false, reason: 'needs_lines', limit: 3 });
    expect(checkStopTier({ ...rich, linesHere: 3 }, 3, 4)).toMatchObject({ ok: true });
    expect(checkStopTier({ ...rich, linesHere: 4 }, 4, 5)).toMatchObject({ ok: false, reason: 'needs_lines', limit: 5 });
    expect(checkStopTier({ ...rich, linesHere: 1 }, 5, 4)).toMatchObject({ ok: true, saleCents: 10_000_000 });
  });

  it('refuses the same tier, a tier that does not exist, and a step the cash cannot buy', () => {
    expect(checkStopTier(rich, 2, 2)).toMatchObject({ ok: false, reason: 'same_tier' });
    expect(checkStopTier(rich, 1, 6)).toMatchObject({ ok: false, reason: 'no_such_tier' });
    expect(checkStopTier(rich, 1, 0)).toMatchObject({ ok: false, reason: 'no_such_tier' });
    expect(checkStopTier({ cashCents: 1_000_000, linesHere: 1 }, 1, 2)).toMatchObject({ ok: false, reason: 'insufficient_funds', shortCents: 200_000 });
  });
});
