// The lines a click found on the same streets (LinesHere): each listed to open, the topmost first, and a line gone since the
// click left out. The e2e test (e2e/many.spec.ts) clicks such streets in the fixture's late game.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../sim/types';
import { LinesHere } from './LinesHere';
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

  it('leaves out a line gone since the click, and shows nothing once none is left', () => {
    expect(listed(render([2, 9]))).toEqual(['Line 2 #2471a3']);
    expect(render([9])).toBe('');
  });
});
