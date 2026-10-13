// A stop's card names its QUIET and LOSS flags in words (the M3 spec, item 5). The fixture's
// starter stops carry no flag, so the e2e test cannot reach them; the card is rendered here.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { flagWord } from '../../render/map/overlays';
import type { Snapshot, StopView } from '../../sim/types';
import { StopCard } from './StopCard';
import type { Sim } from './useSim';

function render(stop: Partial<StopView>, lineStops: readonly number[] = [1, 2, 3]): string {
  const view: StopView = { id: 2, at: [-71.0857, 42.3424], tier: 1, lineIds: [1], boardings: 29.3, alightings: 8, transfers: 0, netCents: 1_234, quiet: false, loss: false, ...stop };
  const snapshot = { stops: [view], lines: [{ id: 1, name: 'Line 1', colour: '#c0392b', stopIds: lineStops }], cashCents: 7_120_000 } as unknown as Snapshot;
  return renderToStaticMarkup(createElement(StopCard, { sim: { snapshot } as unknown as Sim, stopId: 2, onLine: () => undefined, onClose: () => undefined }));
}

describe('a stop’s card', () => {
  it('offers one step up at its price and one step down at half back, on the tier rule', () => {
    const sign = render({});
    expect(sign).toContain('Stop 2 · Sign');
    expect(sign).toContain('Make it a Shelter · $12k');
    expect(sign).not.toContain('Back to');
    const station = render({ tier: 3 });
    expect(station).toContain('Feels 1.8 min nearer on foot');
    expect(station).toContain('Back to Shelter · $17.5k back');
    // An Interchange needs three lines calling; this stop has one, so the step up is refused in words.
    expect(station).toMatch(/<button type="button" disabled="">Make it an Interchange · \$90k<\/button>/);
    expect(station).toContain('Needs 3 lines calling here');
  });

  it('reads its day: who boards, who gets off, what it nets, and its lines', () => {
    const html = render({});
    expect(html).toContain('≈29 board and ≈8 get off a day');
    expect(html).toContain('Nets ≈$12.34 a day');
    expect(html).toContain('Line 1');
    expect(html).not.toContain('QUIET');
    expect(html).not.toContain('LOSS');
    expect(html).not.toContain('change here');
  });

  it('says how many of those boarding change here from another line (item 13)', () => {
    expect(render({ transfers: 12.4 })).toContain('≈12 of them change here from another line, on the fare they paid');
  });

  it('names QUIET and LOSS in words, as the map does', () => {
    expect(render({ boardings: 1.7, quiet: true })).toContain('QUIET · fewer than 5 boardings a day');
    expect(render({ netCents: -3_423, loss: true })).toContain('LOSS · losing more than $20 a day');
    expect([flagWord({ quiet: true, loss: false }), flagWord({ quiet: false, loss: true }), flagWord({ quiet: true, loss: true }), flagWord({ quiet: false, loss: false })]).toEqual([
      'QUIET',
      'LOSS',
      'QUIET · LOSS',
      null,
    ]);
  });

  it('takes the stop off each line on the route rule: half its price back when no other line calls, never below two stops (item 14)', () => {
    expect(render({})).toContain('<button type="button">Remove from Line 1 · $2k back</button>');
    expect(render({ lineIds: [1, 2] })).toContain('<button type="button">Remove from Line 1</button>');
    expect(render({}, [1, 2])).toContain('<button type="button" disabled="" title="A line keeps at least 2 stops">Remove from Line 1</button>');
  });
});
