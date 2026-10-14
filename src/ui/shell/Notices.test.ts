// A browser that refuses storage (blocked site data or a full disk) is told so once, in
// the game's words, as the game starts. Shown failing (TS-04) with the refusal reported only to the
// console: the notice said nothing, and every save failed unseen.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Sim } from '../game/useSim';
import { Notices } from './Notices';

const render = (more: Partial<Sim>) => renderToStaticMarkup(createElement(Notices, { sim: { status: 'ready', refusal: null, load: 'none', loaded: null, storeRefused: false, ...more } as unknown as Sim }));

describe('notices', () => {
  it('says the browser is keeping no saves once the game is ready', () => {
    expect(render({ storeRefused: true })).toContain('This browser isn’t keeping saves');
    expect(render({ storeRefused: true, status: 'loading' })).toBe('');
    expect(render({})).toBe('');
  });
});
