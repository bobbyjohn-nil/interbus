// A stop's card names its QUIET and LOSS flags in words (the M3 spec, item 5). The fixture's
// starter stops carry no flag, so the e2e test cannot reach them; the card is rendered here.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { flagWord } from '../../render/map/overlays';
import type { Snapshot, StopView } from '../../sim/types';
import { StopCard } from './StopCard';
import type { Sim } from './useSim';

function render(stop: Partial<StopView>, lineStops: readonly number[] = [1, 2, 3], ended = false): string {
  const view: StopView = { id: 2, at: [-71.0857, 42.3424], tier: 1, lineIds: [1], boardings: 29.3, alightings: 8, transfers: 0, netCents: 1_234, quiet: false, loss: false, ...stop };
  const floor = ended ? { closesLeft: 0, ended: true } : null;
  const snapshot = { stops: [view], lines: [{ id: 1, name: 'Line 1', colour: '#c0392b', stopIds: lineStops }], cashCents: 7_120_000, floor } as unknown as Snapshot;
  return renderToStaticMarkup(createElement(StopCard, { sim: { snapshot } as unknown as Sim, stopId: 2, onLine: () => undefined, onClose: () => undefined, handBack: () => undefined }));
}

describe('a stop’s card', () => {
  it('offers one step up at its price and one step down at half back, on the tier rule', () => {
    const sign = render({});
    expect(sign).toContain('Stop 2 · Sign');
    expect(sign).toContain('Make it a Shelter · $12k');
    // Its upkeep, and the next tier's on the step up (D25: "bus stop upkeep").
    expect(sign).toContain('Upkeep $4 a day</p>');
    expect(sign).toContain('title="Upkeep $16 a day"');
    expect(sign).not.toMatch(/Make it an? [A-Za-z ]+ · \$[\d.]+k back/);
    const station = render({ tier: 3 });
    expect(station).toContain('Upkeep $51 a day · feels 1.8 min closer on foot');
    expect(station).toContain('Make it a Shelter · $17.5k back');
    // An Interchange needs three lines calling; this stop has one, so the step up is refused in words.
    expect(station).toMatch(/<button type="button" disabled="" title="Upkeep \$141 a day">Make it an Interchange · \$90k<\/button>/);
    expect(station).toContain('Needs 3 lines stopping here');
  });

  // Once the lender has ended the run, the host refuses every change (D10), so the card offers none: it offered each, a press
  // answered by a notice alone (the review of the systems audit's eighth round). Shown failing (TS-04) with the buttons as before.
  it('offers no step, no removal and no take-down once the run has ended', () => {
    const station = render({ tier: 3 }, [1, 2, 3], true);
    expect(station).toContain('<button type="button" disabled="">Make it a Shelter · $17.5k back</button>');
    expect(station).toMatch(/<button type="button" disabled="">Remove from Line 1/);
    const lone = render({ lineIds: [] }, [1, 3], true);
    expect(lone).toMatch(/<button type="button" disabled="">Take it down/);
    // Nor does a lone stop's card invite a line or an Edit route, both off (the review of #142).
    expect(lone).toContain('No line stops here.</p>');
    expect(render({ lineIds: [] }, [1, 3])).toContain('Draw a line through it');
    // Before the end, the same buttons are on offer.
    expect(render({ tier: 3 })).toContain('<button type="button">Make it a Shelter · $17.5k back</button>');
  });

  it('reads its day: who boards, who gets off, what it nets, and its lines', () => {
    const html = render({});
    expect(html).toContain('≈29 board and ≈8 get off a day');
    expect(html).toContain('Nets ≈$12.34 a day');
    expect(html).toContain('Line 1');
    expect(html).not.toContain('Quiet');
    expect(html).not.toContain('Losing money');
    expect(html).not.toContain('change here');
  });

  it('says how many of those boarding change here from another line (item 13)', () => {
    expect(render({ transfers: 12.4 })).toContain('≈12 of them change here from another line, on the fare they paid');
  });

  it('names QUIET and LOSS in words, as the map does', () => {
    expect(render({ boardings: 1.7, quiet: true })).toContain('Quiet: fewer than 5 boardings a day');
    expect(render({ netCents: -3_423, loss: true })).toContain('Losing money: more than $20 a day');
    expect([flagWord({ quiet: true, loss: false }), flagWord({ quiet: false, loss: true }), flagWord({ quiet: true, loss: true }), flagWord({ quiet: false, loss: false })]).toEqual([
      'Quiet',
      'Loss',
      'Quiet · loss',
      null,
    ]);
  });

  it('says a stop placed on its own has no line yet, and takes it down for half its cost (D25)', () => {
    const html = render({ lineIds: [], boardings: 0, alightings: 0, netCents: -400 });
    expect(html).toContain('No line stops here yet');
    expect(html).toContain('<button type="button">Take it down · $2k back</button>');
    expect(html).not.toContain('board and');
    expect(html).not.toContain('Nets');
    expect(render({})).not.toContain('Take it down');
  });

  it('takes the stop off each line on the route rule: half its price back when no other line calls, never below two stops (item 14)', () => {
    expect(render({})).toContain('<button type="button">Remove from Line 1 · $2k back</button>');
    expect(render({ lineIds: [1, 2] })).toContain('<button type="button">Remove from Line 1</button>');
    expect(render({}, [1, 2])).toContain('<button type="button" disabled="" title="A line keeps at least 2 stops">Remove from Line 1</button>');
  });
});
