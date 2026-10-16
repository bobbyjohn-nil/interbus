// A browser that refuses storage (blocked site data or a full disk) is told so once, in
// the game's words, as the game starts. Shown failing (TS-04) with the refusal reported only to the
// console: the notice said nothing, and every save failed unseen.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Sim } from '../game/useSim';
import { Notices } from './Notices';

/** Notices over `more`, on Home (whose Saves button the held save's notice points at) unless `home` is false. */
const render = (more: Partial<Sim>, savesOpen = false, home = true) =>
  renderToStaticMarkup(createElement(Notices, { sim: { status: 'ready', refusal: null, load: 'none', loaded: null, storeRefused: null, storeNotice: null, unbacked: null, backup: null, ...more } as unknown as Sim, home, savesOpen }));

describe('notices', () => {
  // Any save refused says so but a Save here, said on its slot's row, though only the game's own hold Saves' line (storeRefused).
  it('says the browser is keeping no saves once the game is ready', () => {
    expect(render({ storeNotice: 'blocked' })).toContain('This browser isn’t keeping saves');
    expect(render({ storeNotice: 'blocked', storeRefused: 'blocked', status: 'loading' })).toBe('');
    expect(render({})).toBe('');
  });

  // Two tabs of the game (the systems audit's fifth round): in the game, said as it is found; on Home, which takes the newer
  // game up instead (useSim), not. Shown failing (TS-04) on 050dbdd, which said nothing.
  it('says another tab changed the autosave, in the game but not on Home', () => {
    expect(render({ newer: true }, false, false)).toContain('>Another tab changed the autosave<');
    expect(render({ newer: true, storeNotice: 'full' }, false, false)).toContain('>Another tab changed the autosave<');
    expect(render({ newer: true })).toBe('');
  });

  // A store with no room left (src/platform's `full`) is said as full, with the way out. Shown failing (TS-04) on 029387a, where
  // it read "This browser isn’t keeping saves" though the browser kept saves: the game's own copies had filled it.
  it('says a full store has no room, and how to make some', () => {
    expect(render({ storeNotice: 'full' })).toContain('>No room for saves: delete a save<');
    expect(render({ storeNotice: 'full' })).not.toContain('This browser isn’t keeping saves');
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

  // It says "see Saves", so only on Home, beside its Saves button: not on the founding card after New
  // game, where none is (shown failing, TS-04, with it said there too), nor in the game, where the Saves
  // chip says so itself (App; e2e/saves.spec.ts and e2e/i13.spec.ts, where on 029387a the notice took the
  // shell at rest past I13's 6%).
  it('says a save could not be set aside only on Home', () => {
    expect(render({ load: 'older', backup: 'not-kept', unbacked: 'older-15' }, false, false)).toBe('');
    expect(render({ load: 'older', backup: 'not-kept', unbacked: 'older-15' }, false, true)).toContain('Not autosaving: see Saves');
  });

  // One failure, one notice: the store's refusal of the start's set-aside (sim.unbacked) is said by
  // the held notice alone, even beside a refusal of another write. Shown failing (TS-04) with "This
  // browser isn’t keeping saves" said for it.
  it('says a save could not be set aside, not that the browser keeps no saves, while it holds', () => {
    const html = render({ load: 'older', backup: 'not-kept', unbacked: 'older-15', storeRefused: 'full', storeNotice: 'full' });
    expect(html).toContain('Not autosaving: see Saves');
    expect(html).not.toContain('This browser isn’t keeping saves');
  });
});
