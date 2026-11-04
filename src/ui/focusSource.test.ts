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
/** A key as the window hears it, on `on`, where the focus is (a silent key counts only there). */
const key = (k: string, on?: unknown) => ({ type: 'keydown', key: k, target: on });

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
    f.input(key('Escape', list));
    f.arrived(speed);
    expect(f.byKey).toBe(false);
    f.input(press); // and again, its options looked through with the keys: the list keeps the focus
    f.arrived(list);
    f.input(key('ArrowDown'));
    f.input(key('End'));
    f.input(key('Escape', list));
    f.arrived(speed);
    expect(f.byKey).toBe(false);
    f.input(press); // the demand menu opened with the mouse: its items take the focus in turn
    f.arrived(demand);
    f.arrived(homes);
    f.input(key('ArrowDown'));
    f.arrived(jobs);
    expect(f.byKey).toBe(true);
    f.input(key('Escape', jobs));
    f.arrived(demand);
    expect(f.byKey).toBe(false);
    // Reached with Tab, then opened with Space, and looked through: Escape hands it back to the keyboard.
    f.input(key('Tab'));
    f.arrived(speed);
    f.input(key(' '));
    f.arrived(list);
    f.input(key('ArrowUp'));
    f.input(key('Escape', list));
    f.arrived(speed);
    expect(f.byKey).toBe(true);
    // Reached with Tab, then opened with the mouse: the press is the menu's opening, so Escape hands it back to the mouse.
    f.input(key('Tab'));
    f.arrived(demand);
    f.input(press);
    f.arrived(homes);
    f.input(key('ArrowDown'));
    f.arrived(jobs);
    f.input(key('Escape', jobs));
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
    f.input(key('Escape', list));
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

// The systems audit's twenty-first round. Shown failing (TS-04) on 409570e: a silent key kept its silence until the next key or
// press, so the game's hand-on after it took the target's old source ("a silent key's own arrival"); the press of a drag read
// as the pointer's ("a drag of a panel by its heading"); and AltGr or Caps Lock alone read as the keyboard's ("a lock alone").
describe('where the focus came from, the twenty-first round', () => {
  /** A key as the window hears it on `on`, its dispatch running until `done`. */
  const heard = (k: string, on: unknown) => {
    const event = { type: 'keydown', key: k, target: on, eventPhase: 1 };
    return { event, done: () => void (event.eventPhase = 0) };
  };

  it('a silent key’s own arrival is silent, and one that comes once its dispatch is over is not', () => {
    const build = { name: 'build' };
    const headway = { name: 'headway' };
    const f = focusSource();
    f.input(press); // Build pressed with the mouse: its source the pointer's as the focus leaves it
    f.arrived(build);
    f.input(key('Tab'));
    f.arrived(headway); // the keyboard on Lines' headway
    f.input(key('z')); // Ctrl+Z, its answer on its way
    const shift = heard('Shift', headway);
    f.input(shift.event);
    shift.done();
    f.arrived(build); // the game's hand-on as the answer takes Lines away
    expect(f.byKey).toBe(true);
    // An Escape that closes a menu the mouse opened hands its button back as the mouse had it, arrows or not, as before: the
    // menu hands it back in the Escape's own dispatch.
    const [speed, list] = [{ name: 'speed' }, { name: 'list' }];
    f.input(press);
    f.arrived(speed);
    f.arrived(list);
    f.input(key('ArrowDown'));
    const escape = heard('Escape', list);
    f.input(escape.event);
    f.arrived(speed);
    escape.done();
    expect(f.byKey).toBe(false);
  });

  // An Escape heard on the page, its control gone with Lines as Ctrl+Z's answer took Lines away, in the gap before the game's
  // hand-on to Build: React put that waiting hand-on through in the Escape's own dispatch, ahead of the Escape's own update, so
  // Build took its source as the mouse had left it, and Space played, 3 runs of 3 with a real key (the round's review). Only
  // a key heard where the focus is is silent. Shown failing (TS-04) with every silent key silent wherever it was heard.
  it('a silent key heard where the focus is not leaves the hand-on in its dispatch to the keyboard', () => {
    const [build, headway, body] = [{ name: 'build' }, { name: 'headway' }, { name: 'body' }];
    const f = focusSource();
    f.input(press); // Build pressed with the mouse
    f.arrived(build);
    f.input(key('Tab'));
    f.arrived(headway); // the keyboard on Lines' headway
    f.input(key('z', headway)); // Ctrl+Z, its answer on its way; Lines goes with the headway, the focus on the page
    const escape = heard('Escape', body);
    f.input(escape.event);
    f.arrived(build); // the game's hand-on, run in the Escape's dispatch
    escape.done();
    expect(f.byKey).toBe(true);
  });

  it('a drag of a panel by its heading leaves the focus as it came', () => {
    const f = focusSource();
    f.input(key('Tab'));
    f.arrived('create');
    f.input(press); // the card's heading, dragged: the focus stays on Create
    f.dragged();
    expect(f.byKey).toBe(true);
    f.arrived('lines'); // Enter on Create opens Lines, which the keyboard's focus goes to
    expect(f.byKey).toBe(true);
    // A press that is no drag still says the pointer acts, and a drag after it leaves it so.
    f.input(press);
    expect(f.byKey).toBe(false);
    f.input(press);
    f.dragged();
    expect(f.byKey).toBe(false);
    // A drag told of after a key changes nothing: the key was the last input.
    f.input(key('Tab'));
    f.arrived('play');
    f.dragged();
    expect(f.byKey).toBe(true);
  });

  it('a lock or AltGr alone moves nothing, as Alt', () => {
    for (const k of ['AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn']) {
      const f = focusSource();
      f.input(press);
      f.input(key(k));
      f.arrived('finance');
      expect(f.byKey, k).toBe(false);
    }
  });
});
