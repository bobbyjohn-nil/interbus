// The lines a click found on the same streets (LinesHere): each listed to open, the topmost first, and nothing once a line it
// lists is gone, which closes the card (App). The e2e tests (e2e/many.spec.ts) click such streets in the fixture's late game.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../sim/types';
import { LinesHere, linesHere } from './LinesHere';
import type { Sim } from './useSim';

const lines = [
  { id: 1, name: 'Line 1', colour: '#c0392b' },
  { id: 2, name: 'Line 2', colour: '#2471a3' },
  { id: 5, name: 'Line 5', colour: '#1e8449' },
];
const render = (lineIds: readonly number[]) =>
  renderToStaticMarkup(createElement(LinesHere, { sim: { snapshot: { lines } as unknown as Snapshot } as unknown as Sim, lineIds, onLine: () => undefined, onClose: () => undefined }));
const listed = (html: string) => [...html.matchAll(/<span class="swatch" style="background:([^"]+)"><\/span> ([^<]+)<\/button>/g)].map((m) => `${m[2]} ${m[1]}`);

describe('the lines on the streets a click found', () => {
  it('lists each to open in its colour, the topmost first', () => {
    expect(listed(render([5, 1]))).toEqual(['Line 5 #1e8449', 'Line 1 #c0392b']);
  });

  it('shows nothing once any line it lists is gone, and that closes it', () => {
    expect(linesHere([5, 1], lines as never)?.map((l) => l.id)).toEqual([5, 1]);
    expect(linesHere([2, 9], lines as never)).toBeNull();
    expect(render([2, 9])).toBe('');
  });
});
