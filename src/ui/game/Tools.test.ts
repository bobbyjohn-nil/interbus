// Create, one press, one command (D26, the systems audit's second round): a Create on its way waits for
// its own answer, a newer line or a refused Create, so a second press meanwhile buys no second line on the
// same stops; a refresh of the lines that is not its answer (the day's close or roadworks retiming them)
// leaves it waiting, and it never outlasts the tool, the game it was pressed in or an undo after it that
// the sim did (an undo refused, as every undo is while time runs, lets nothing go). The browser shows the
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
  const now = { tool: 'line', newest: 2, refusals: 1, undos: 4, undone: 3, loadedAt: 5 } as const;

  it('waits for its own answer: a line newer than the press, or a Create refused', () => {
    expect(createWaits(press, now)).toBe(true);
    expect(createWaits(press, { ...now, newest: 3 })).toBe(false);
    expect(createWaits(press, { ...now, refusals: 2 })).toBe(false);
    // The first line of a game: none stood as it was pressed.
    expect(createWaits({ ...press, newest: 0 }, { ...now, newest: 1 })).toBe(false);
  });

  // A Create and an Undo answered together leave the newest line and the refusals as they were: the undo the sim did lets it go.
  // Shown failing (TS-04) with the undos left out of createWaits: Create stayed shut with the tool out.
  it('lets go with the tool put down, another game loaded or an undo sent after it that the sim did, so a Create undone never keeps Create shut', () => {
    expect(createWaits(press, { ...now, tool: 'none' })).toBe(false);
    expect(createWaits(press, { ...now, loadedAt: 9 })).toBe(false);
    expect(createWaits(press, { ...now, undos: 5, undone: 5 })).toBe(false);
  });

  // An undo sent after the press lets nothing go until the sim has done it, and one it refused never does,
  // so Ctrl+Z pressed while time runs leaves Create shut until the line lands. Shown failing (TS-04) on
  // 5f4bce3, which let Create go on an undo sent: the first expect read false, Create open to a second press.
  it('waits through an undo not yet answered or refused, and through one sent before the press', () => {
    expect(createWaits(press, { ...now, undos: 5 })).toBe(true); // sent: no answer yet, or refused
    expect(createWaits(press, { ...now, undos: 5, undone: 4 })).toBe(true); // the undo sent before the press, done after it
    expect(createWaits(press, { ...now, undos: 5, newest: 3 })).toBe(false); // refused, and then the line lands
  });

  it('shows Create shut while it waits', () => {
    const draft = { stops: [], route: [], routeM: 900, people: 12_000, walkM: 400, buses: 2, newStops: 2, stopsCents: 800_000, busesCents: 9_500_000, priceCents: 10_300_000, refusal: null, edit: null, detour: null } as unknown as LineDraftView;
    const render = (creating: boolean) => renderToStaticMarkup(createElement(DraftCard, { sim: { draft, snapshot: null } as unknown as Sim, clicks: 2, model: 'sparrow', creating, onModel: () => undefined, onCreate: () => undefined, onUndo: () => undefined, onCancel: () => undefined }));
    expect(render(true)).toMatch(/<button type="button" disabled="" aria-describedby="[^"]+">Create<\/button>/);
    expect(render(false)).toMatch(/<button type="button" aria-describedby="[^"]+">Create<\/button>/);
  });

  // A close that left the cash short turned Create off under the keyboard, and the focus fell to the page, where Space paused the
  // game with the day's card up (the systems audit's seventeenth round). Refused, it keeps the focus, described by the words why,
  // which are a status from the card's first render. Shown failing (TS-04) with Create disabled while refused.
  it('keeps a refused Create in reach, described by why, the words a status before they come', () => {
    const draft = (refusal: LineDraftView['refusal']) => ({ stops: [], route: [], routeM: 900, people: 12_000, walkM: 400, buses: 2, newStops: 2, stopsCents: 800_000, busesCents: 9_500_000, priceCents: 10_300_000, refusal, edit: null, detour: null }) as unknown as LineDraftView;
    const render = (d: LineDraftView | null) => renderToStaticMarkup(createElement(DraftCard, { sim: { draft: d, snapshot: null } as unknown as Sim, clicks: d ? 2 : 0, model: 'sparrow', onModel: () => undefined, onCreate: () => undefined, onUndo: () => undefined, onCancel: () => undefined }));
    const short = render(draft({ reason: 'insufficient_funds', shortCents: 8_100 } as unknown as LineDraftView['refusal']));
    const said = /<p id="([^"]+)" class="refusal" role="status">\$81 short<\/p>/.exec(short);
    expect(said).not.toBeNull();
    expect(short).toContain(`<button type="button" aria-disabled="true" aria-describedby="${said![1]}">Create</button>`);
    expect(render(null)).toMatch(/<p id="[^"]+" class="refusal" role="status"><\/p>/);
  });
});
