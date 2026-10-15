// A browser that refuses storage (blocked site data or a full disk) is told so once, in
// the game's words, as the game starts. Shown failing (TS-04) with the refusal reported only to the
// console: the notice said nothing, and every save failed unseen.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Sim } from '../game/useSim';
import { Notices } from './Notices';

/** Notices over `more`, with a button on screen that opens Saves unless `savesButton` is false. */
const render = (more: Partial<Sim>, savesOpen = false, savesButton = true) =>
  renderToStaticMarkup(createElement(Notices, { sim: { status: 'ready', refusal: null, load: 'none', loaded: null, storeRefused: false, storeRefusals: 0, unbacked: null, backup: null, ...more } as unknown as Sim, savesButton, savesOpen }));

describe('notices', () => {
  // Any save refused says so, a slot's Save here too, though only the game's own hold Saves' line (storeRefused).
  it('says the browser is keeping no saves once the game is ready', () => {
    expect(render({ storeRefusals: 1 })).toContain('This browser isn’t keeping saves');
    expect(render({ storeRefusals: 1, storeRefused: true, status: 'loading' })).toBe('');
    expect(render({})).toBe('');
  });

  // A save the start could not set aside (a full disk refused its backup) stays under the live key: it
  // is never said to be set aside, not even once the player deletes it (unbacked 'older-15', then null).
  // Shown failing (TS-04) with the player told it was set aside.
  it('never says a save that was not set aside was, even once the player deletes it', () => {
    const held = render({ load: 'older', backup: 'not-kept', unbacked: 'older-15' });
    expect(held).toContain('Not autosaving: see Saves');
    expect(held).not.toContain('Save from an older build set aside');
    expect(render({ load: 'older', backup: 'not-kept', unbacked: null })).toBe(''); // deleted by the player
    expect(render({ load: 'older', backup: 'not-kept', unbacked: 'older-15', status: 'loading' })).toBe('');
  });

  // Not while its backup is still being read back, which may find it was not kept. Shown failing (TS-04)
  // with it said as the game started, before anything was read back.
  it('says a save was set aside only once its backup has read back', () => {
    expect(render({ load: 'older', backup: 'checking' })).toBe('');
    expect(render({ load: 'older', backup: 'kept' })).toContain('Save from an older build set aside');
    expect(render({ load: 'rebaked' })).toContain('Save carried onto the new map'); // nothing set aside, nothing to check
  });

  // Said until the player opens Saves, where the save's row is, since the game saves nothing over it
  // meanwhile: not timed (e2e/saves.spec.ts). Shown failing (TS-04) with it never said.
  it('says a save could not be set aside until the player opens Saves', () => {
    expect(render({ load: 'older', backup: 'not-kept', unbacked: 'older-15' })).toContain('Not autosaving: see Saves');
    expect(render({ load: 'older', backup: 'not-kept', unbacked: 'older-15' }, true)).toBe('');
  });

  // It says "see Saves", so only where a button opens Saves: on Home, and in the game once a company is
  // founded, not on the founding card after New game. Shown failing (TS-04) with it said there too.
  it('says a save could not be set aside only while a button on screen opens Saves', () => {
    expect(render({ load: 'older', backup: 'not-kept', unbacked: 'older-15' }, false, false)).toBe('');
    expect(render({ load: 'older', backup: 'not-kept', unbacked: 'older-15' }, false, true)).toContain('Not autosaving: see Saves');
  });

  // One failure, one notice: the store's refusal of the start's set-aside (sim.unbacked) is said by
  // the held notice alone, even beside a refusal of another write. Shown failing (TS-04) with "This
  // browser isn’t keeping saves" said for it.
  it('says a save could not be set aside, not that the browser keeps no saves, while it holds', () => {
    const html = render({ load: 'older', backup: 'not-kept', unbacked: 'older-15', storeRefused: true, storeRefusals: 1 });
    expect(html).toContain('Not autosaving: see Saves');
    expect(html).not.toContain('This browser isn’t keeping saves');
  });
});
