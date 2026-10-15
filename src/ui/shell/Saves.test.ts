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

function render(slots: readonly SlotView[], setAside: readonly SetAsideWhy[], more: Partial<Sim> = {}): string {
  const sim = { snapshot: { day: 3, hour: 9, minute: 30, company: { name: 'Back Bay Transit' } } as unknown as Snapshot, slots, setAside, send: () => undefined, ...more } as unknown as Sim;
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

  // The exit check's step 2 (the M5 spec). Shown failing (TS-04) with the autosave named only by the game's day and time.
  it('lists the autosave first, with its company, cash, lines and buses, and when it was saved', () => {
    const autosave = { day: 12, hour: 7, minute: 5, company: 'Back Bay Transit', cashCents: 12_345_600, lines: 2, buses: 5, savedAt: AT };
    const html = render([{ slot: 1, about: null, readable: true }], [], { autosave });
    expect(html).toContain('Autosave · Year 1, Q2, Day 4, 07:05 · Back Bay Transit · $123,456 · 2 lines · 5 buses');
    expect(html).toContain('data-testid="autosave-when"');
    expect(html.indexOf('Autosave')).toBeLessThan(html.indexOf('Slot 1'));
  });

  // A slot written before a format change (D12: never lost unseen). Shown failing (TS-04) with it named
  // "A save this game can’t read" and no Export.
  it('names a slot from an older build as one, to export or delete, never to load', () => {
    const html = render([{ slot: 1, about: null, readable: false, why: 'older-15' }], []);
    expect(html).toContain('Slot 1 · A save from an older build (format 15)');
    expect(html.match(/>Export</g)).toHaveLength(1);
    expect(html).toContain('>Delete<');
    expect(html).not.toContain('>Load<');
  });

  // Shown failing (TS-04) with it listed as "A save from another city", the notice having said its stops were off the new map.
  it('names a save set aside because its stops are off the new map as its notice did', () => {
    expect(render([], ['off-street'])).toContain('A save with stops off the new map, set aside');
  });

  // Shown failing (TS-04) with the panel saying the game saves itself as it plays, though nothing was kept.
  it('says when the browser is keeping no saves, and how to keep this game', () => {
    const html = render([{ slot: 1, about: null, readable: true }], [], { storeRefused: true });
    expect(html).toContain('This browser isn’t keeping saves. Export this game to keep it.');
  });

  // A save the start could not set aside (a full disk refused its backup) holds the autosave's place, the
  // live key, and the game saves nothing over it meanwhile: the autosave's row says so, with Export and
  // Delete, so the panel grows by those buttons only (I13). Shown failing (TS-04) with no row for it and
  // no word that this game isn't saving.
  it('names a save the game could not set aside in the autosave’s row, which says this game isn’t saving itself, with Export and Delete', () => {
    const html = render([{ slot: 1, about: null, readable: true }], ['other-city'], { unbacked: 'older-15' });
    expect(html).toMatch(/data-testid="autosave"[^>]*><span>Autosave · A save from an older build \(format 15\), not set aside · this game isn’t saving itself<\/span><span class="controls"><button type="button">Export<\/button><button type="button">Delete<\/button><\/span><\/li>/);
    expect(html).toContain('A save from another city, set aside');
    expect(html.match(/>Export</g)).toHaveLength(2);
    expect(html.match(/>Delete</g)).toHaveLength(2);
    expect(html).not.toContain('class="hint"');
    expect(html).not.toContain('This game saves itself as it plays');
  });

  // The way out, in that row's tooltip. Shown failing (TS-04) with the row saying this game isn't saving
  // itself and nothing saying what ends that.
  it('says in that row’s tooltip how to keep the save and how this game saves itself again', () => {
    expect(render([], [], { unbacked: 'older-15' })).toContain('data-testid="autosave" title="Export the old save to keep it, and Save here to keep this game meanwhile. Once the old save is deleted here, this game saves itself again."');
  });

  it('writes the time in words a player reads at a glance, with the year only when it is not this one', () => {
    expect(savedWhen(AT, AT)).toMatch(/^saved Oct 1[34], \d\d:\d\d$/); // the player's own time zone
    expect(savedWhen(AT, AT + 400 * 86_400_000)).toMatch(/^saved Oct 1[34], 2026, \d\d:\d\d$/);
  });
});
