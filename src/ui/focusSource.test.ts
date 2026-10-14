// The focus's source as App reads it for Space (focusSource.ts). Shown failing (TS-04) on the first
// attempt's rules: with the flag cleared only by Tab, an arrow key's focus read as the pointer's
// ("an arrow key"), and with every focusin taken as new, the window's return read as the keyboard's
// ("the window coming back").
import { describe, expect, it } from 'vitest';
import { focusSource } from './focusSource';

const press = { type: 'pointerdown' };
const key = (k: string) => ({ type: 'keydown', key: k });

describe('where the focus came from', () => {
  it('the pointer: a button pressed with the mouse', () => {
    const f = focusSource();
    f.input(press);
    f.arrived('finance');
    expect(f.byKey).toBe(false);
  });

  it('Tab, or an arrow key that moves a menu’s focus after a press', () => {
    const f = focusSource();
    f.input(press);
    f.arrived('homes');
    f.input(key('ArrowDown'));
    f.arrived('jobs');
    expect(f.byKey).toBe(true);
    f.input(key('Tab'));
    f.arrived('play');
    expect(f.byKey).toBe(true);
  });

  it('a modifier alone moves nothing: Alt before leaving the window', () => {
    const f = focusSource();
    f.input(press);
    f.input(key('Alt'));
    f.arrived('finance');
    expect(f.byKey).toBe(false);
  });

  it('the window coming back hands the focus back as it came, whatever key was last', () => {
    const f = focusSource();
    f.input(press);
    f.arrived('speed');
    f.input(key(' ')); // Space pauses
    f.left('speed'); // Alt-Tab away, or another browser tab
    f.arrived('speed'); // and back: the browser fires focusin on the same button
    expect(f.byKey).toBe(false);
    // A new arrival after that counts as before.
    f.input(key('Tab'));
    f.arrived('play');
    expect(f.byKey).toBe(true);
  });
});
