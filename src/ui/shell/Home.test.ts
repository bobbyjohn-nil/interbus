// Home (the M5 spec, item 3): Continue names the game that saves itself as it plays; a first visit
// offers New game only. Shown failing (TS-04) with Continue offered for an unnamed company.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../sim/types';
import type { Sim } from '../game/useSim';
import { Home } from './Home';

function render(company: string): string {
  const snapshot = { company: { name: company, colour: '#2471a3' }, day: 12, cashCents: 12_345_600 } as unknown as Snapshot;
  const sim = { status: 'ready', snapshot } as unknown as Sim;
  return renderToStaticMarkup(createElement(Home, { sim, onContinue: () => undefined, onNewGame: () => undefined, onSaves: () => undefined }));
}

describe('Home', () => {
  it('offers Continue with the game’s company, day and cash, then New game and Saves', () => {
    const html = render('Back Bay Transit');
    expect(html).toContain('data-testid="home-continue"');
    expect(html).toContain('Back Bay Transit · Year 1, Q2, Day 4 · $123,456'); // day 12 since founding
    expect(html.indexOf('Continue')).toBeLessThan(html.indexOf('New game'));
    expect(html).toContain('>Saves<');
  });

  it('offers New game first when no company has been founded', () => {
    const html = render('');
    expect(html).not.toContain('home-continue');
    expect(html).toMatch(/class="primary"[^>]*>New game</);
  });
});
