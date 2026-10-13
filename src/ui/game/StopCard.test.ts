// A stop's card names its QUIET and LOSS flags in words (the M3 spec, item 5). The fixture's
// starter stops carry no flag, so the e2e test cannot reach them; the card is rendered here.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { flagWord } from '../../render/map/overlays';
import type { Snapshot, StopView } from '../../sim/types';
import { StopCard } from './StopCard';
import type { Sim } from './useSim';

function render(stop: Partial<StopView>): string {
  const view: StopView = { id: 2, at: [-71.0857, 42.3424], lineIds: [1], boardings: 29.3, alightings: 8, netCents: 1_234, quiet: false, loss: false, ...stop };
  const snapshot = { stops: [view], lines: [{ id: 1, name: 'Line 1', colour: '#c0392b' }] } as unknown as Snapshot;
  return renderToStaticMarkup(createElement(StopCard, { sim: { snapshot } as unknown as Sim, stopId: 2, onLine: () => undefined, onClose: () => undefined }));
}

describe('a stop’s card', () => {
  it('reads its day: who boards, who gets off, what it nets, and its lines', () => {
    const html = render({});
    expect(html).toContain('≈29 board and ≈8 get off a day');
    expect(html).toContain('Nets ≈$12.34 a day');
    expect(html).toContain('Line 1');
    expect(html).not.toContain('QUIET');
    expect(html).not.toContain('LOSS');
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
});
