// The save list (the M5 spec, item 4): each slot names its game, its buses and when it was saved, and
// a save set aside by a new build is listed until exported or deleted. Shown failing (TS-04) with the
// time and the buses left out of a slot's row, and with the set-aside saves not listed.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SetAsideWhy, SlotView, Snapshot } from '../../sim/types';
import type { Sim } from '../game/useSim';
import { savedWhen } from '../format';
import { Saves } from './Saves';

function render(slots: readonly SlotView[], setAside: readonly SetAsideWhy[]): string {
  const sim = { snapshot: { day: 3, hour: 9, minute: 30 } as unknown as Snapshot, slots, setAside, send: () => undefined } as unknown as Sim;
  return renderToStaticMarkup(createElement(Saves, { sim, onClose: () => undefined }));
}

const AT = Date.UTC(2026, 9, 13, 20, 41);

describe('the save list', () => {
  it('names each slot’s day, company, cash, lines and buses, and when it was saved', () => {
    const html = render(
      [
        { slot: 1, about: { day: 12, hour: 7, minute: 5, company: 'Back Bay Transit', cashCents: 12_345_600, lines: 2, buses: 5, savedAt: AT }, readable: true },
        { slot: 2, about: { day: 2, hour: 5, minute: 0, company: 'Kenmore Lines', cashCents: 100, lines: 1, buses: 1, savedAt: null }, readable: true },
        { slot: 3, about: null, readable: true },
      ],
      [],
    );
    expect(html).toContain('Slot 1 · Year 1, Q2, Day 4, 07:05 · Back Bay Transit · $123,456 · 2 lines · 5 buses');
    expect(html).toContain(savedWhen(AT));
    expect(html).toContain('1 line · 1 bus');
    expect(html).not.toContain('data-testid="slot-2-when"'); // saved before the time was kept
    expect(html).toContain('Slot 3 · Empty');
    expect(html.match(/>Delete</g)).toHaveLength(2); // an empty slot has nothing to delete
  });

  it('lists a save set aside by a new build, with Export and Delete', () => {
    const html = render([{ slot: 1, about: null, readable: true }], ['older', 'other-city']);
    expect(html).toContain('data-testid="set-aside-older"');
    expect(html).toContain('A save from an older build, set aside');
    expect(html).toContain('A save from another city, set aside');
    expect(html.match(/>Export</g)).toHaveLength(2);
  });

  it('writes the time in words a player reads at a glance, with the year only when it is not this one', () => {
    expect(savedWhen(AT, AT)).toMatch(/^saved Oct 1[34], \d\d:\d\d$/); // the player's own time zone
    expect(savedWhen(AT, AT + 400 * 86_400_000)).toMatch(/^saved Oct 1[34], 2026, \d\d:\d\d$/);
  });
});
