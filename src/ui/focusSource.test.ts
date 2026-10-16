// The focus's source as App reads it for Space (focusSource.ts). Shown failing (TS-04) on the first
// attempt's rules: with the flag cleared only by Tab, an arrow key's focus read as the pointer's
// ("an arrow key"), and with every focusin taken as new, the window's return read as the keyboard's
// ("the window coming back"); and on 5f4bce3, whose pointer press left the arrival's source as it was,
// the mouse pressing a button Tab had reached read as the keyboard's ("a mouse press on the button"). And on
// abb5f2f, whose Escape counted as a key that moves the focus, a menu the mouse opened handed its button back
// as the keyboard's as Escape closed it ("Escape ... arrows or not", its first check), as it did on the first
// fix, which took Escape for no key at all, after an arrow had moved through the menu (its second check).
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

  it('a mouse press on the button Tab reached: no focus arrives, and the pointer acts now', () => {
    const f = focusSource();
    f.input(key('Tab'));
    f.arrived('undo');
    expect(f.byKey).toBe(true);
    f.input(press); // the Undo chip pressed with the mouse: it holds the focus already
    expect(f.byKey).toBe(false);
  });

  // Escape moves no focus of the player's: the focus a menu hands back to its button as Escape closes it comes as the
  // button had it when the menu opened, by the mouse (Space plays) or by the keyboard (Space opens the menu again),
  // whatever keys moved through the menu since.
  it('Escape closing a menu hands its button back as it had the focus when the menu opened, arrows or not', () => {
    const [speed, list, demand, homes, jobs] = ['speed', 'list', 'demand', 'homes', 'jobs'].map((name) => ({ name }));
    const f = focusSource();
    f.input(press); // the speed menu opened with the mouse
    f.arrived(speed);
    f.arrived(list); // the list takes the focus as it opens
    f.input(key('Escape'));
    f.arrived(speed);
    expect(f.byKey).toBe(false);
    f.input(press); // and again, its options looked through with the keys: the list keeps the focus
    f.arrived(list);
    f.input(key('ArrowDown'));
    f.input(key('End'));
    f.input(key('Escape'));
    f.arrived(speed);
    expect(f.byKey).toBe(false);
    f.input(press); // the demand menu opened with the mouse: its items take the focus in turn
    f.arrived(demand);
    f.arrived(homes);
    f.input(key('ArrowDown'));
    f.arrived(jobs);
    expect(f.byKey).toBe(true);
    f.input(key('Escape'));
    f.arrived(demand);
    expect(f.byKey).toBe(false);
    // Reached with Tab, then opened with Space, and looked through: Escape hands it back to the keyboard.
    f.input(key('Tab'));
    f.arrived(speed);
    f.input(key(' '));
    f.arrived(list);
    f.input(key('ArrowUp'));
    f.input(key('Escape'));
    f.arrived(speed);
    expect(f.byKey).toBe(true);
    // Reached with Tab, then opened with the mouse: the press is the menu's opening, so Escape hands it back to the mouse.
    f.input(key('Tab'));
    f.arrived(demand);
    f.input(press);
    f.arrived(homes);
    f.input(key('ArrowDown'));
    f.arrived(jobs);
    f.input(key('Escape'));
    f.arrived(demand);
    expect(f.byKey).toBe(false);
  });

  // Safari, and Firefox on macOS, focus no button a press lands on: the menu takes the focus straight from the page, so
  // the press itself says its button is the pointer's. Shown failing (TS-04) without the press's record, where the
  // arrows through the list handed the speed button back to the keyboard.
  it('Escape hands a menu’s button back to the pointer where the press focused nothing', () => {
    const speed: { name: string; closest?: () => unknown } = { name: 'speed' };
    speed.closest = () => speed;
    const list = { name: 'list' };
    const f = focusSource();
    f.input({ type: 'pointerdown', target: speed });
    f.arrived(list);
    f.input(key('ArrowDown'));
    f.input(key('End'));
    f.input(key('Escape'));
    f.arrived(speed);
    expect(f.byKey).toBe(false);
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
