// Create, one press, one command (D26, the systems audit's second round): a Create on its way waits for
// its own answer, a newer line or a refused Create, so a second press meanwhile buys no second line on the
// same stops; a refresh of the lines that is not its answer (the day's close or roadworks retiming them)
// leaves it waiting, and it never outlasts the tool or the game it was pressed in. The browser shows the
// presses (e2e/presses.spec.ts); this pins when Create opens again. Shown failing (TS-04) on 2a00661, whose
// Create had no guard: no createWaits, and the button never shut.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LineDraftView } from '../../sim/types';
import { createWaits, DraftCard, type CreatePress } from './Tools';
import type { Sim } from './useSim';

describe('Create on its way', () => {
  const press: CreatePress = { newest: 2, refusals: 1, undos: 4, loadedAt: 5 };
  const now = { tool: 'line', newest: 2, refusals: 1, undos: 4, loadedAt: 5 } as const;

  it('waits for its own answer: a line newer than the press, or a Create refused', () => {
    expect(createWaits(press, now)).toBe(true);
    expect(createWaits(press, { ...now, newest: 3 })).toBe(false);
    expect(createWaits(press, { ...now, refusals: 2 })).toBe(false);
    // The first line of a game: none stood as it was pressed.
    expect(createWaits({ ...press, newest: 0 }, { ...now, newest: 1 })).toBe(false);
  });

  // A Create and an Undo answered together leave the newest line and the refusals as they were: the undo sent lets it go.
  // Shown failing (TS-04) with the undos left out of createWaits: Create stayed shut with the tool out.
  it('lets go with the tool put down, another game loaded or an undo sent after it, so a Create undone never keeps Create shut', () => {
    expect(createWaits(press, { ...now, tool: 'none' })).toBe(false);
    expect(createWaits(press, { ...now, loadedAt: 9 })).toBe(false);
    expect(createWaits(press, { ...now, undos: 5 })).toBe(false);
  });

  it('shows Create shut while it waits', () => {
    const draft = { stops: [], route: [], routeM: 900, people: 12_000, walkM: 400, buses: 2, newStops: 2, stopsCents: 800_000, busesCents: 9_500_000, priceCents: 10_300_000, refusal: null, edit: null, detour: null } as unknown as LineDraftView;
    const render = (creating: boolean) => renderToStaticMarkup(createElement(DraftCard, { sim: { draft, snapshot: null } as unknown as Sim, clicks: 2, model: 'sparrow', creating, onModel: () => undefined, onCreate: () => undefined, onUndo: () => undefined, onCancel: () => undefined }));
    expect(render(true)).toMatch(/<button type="button" disabled="">Create<\/button>/);
    expect(render(false)).toMatch(/<button type="button">Create<\/button>/);
  });
});
