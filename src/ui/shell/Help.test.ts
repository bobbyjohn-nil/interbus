// Help (PLAN §8's keyboard shortcuts; help.ts): it lists every key the code reads, names the speeds as the speed chip does,
// and keeps the copy convention, which the copy walk cannot read in a list of terms (e2e/copy.spec.ts reads headings,
// buttons and paragraphs). Shown failing (TS-04) with N left out of the list, and with a description in lower case.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VIEW_KEYS } from '../../render/map/tilt';
import { RUNNING_SPEEDS } from '../../sim/rules/speed';
import { copyProblems } from '../copyRules';
import { speedText } from '../format';
import { HELP_KEYS, HELP_MAP } from '../help';
import { Help } from './Help';

const html = renderToStaticMarkup(createElement(Help, { onClose: () => undefined }));
const keys = HELP_KEYS.flatMap((row) => row.keys);

describe('Help', () => {
  it('lists every key the map reads (T, N, Q and E), each as a key', () => {
    for (const key of Object.keys(VIEW_KEYS).map((k) => k.toUpperCase())) {
      expect(keys).toContain(key);
      expect(html).toContain(`<kbd>${key}</kbd>`);
    }
  });

  it('lists the keys the game reads: Space, the number keys, undo, Escape, Backspace and ?', () => {
    expect(keys).toEqual(expect.arrayContaining(['Space', `1 to ${RUNNING_SPEEDS.length}`, 'Ctrl+Z', '⌘Z', 'Escape', 'Backspace', '?']));
  });

  it('names each speed the number keys pick as the speed chip does, slowest first', () => {
    const row = HELP_KEYS.find((r) => r.keys[0] === `1 to ${RUNNING_SPEEDS.length}`)!;
    expect(row.what).toBe(`Pick a speed: ${RUNNING_SPEEDS.slice(0, -1).map(speedText).join(', ')} or ${speedText(RUNNING_SPEEDS.at(-1)!)}`);
    expect(row.what).toBe('Pick a speed: 1×, 60×, 600×, 2,700× or 5,400×');
  });

  it('keeps the copy convention: every description, and every gesture, starts with a capital and shouts nothing', () => {
    expect(copyProblems([...HELP_KEYS, ...HELP_MAP].map((row) => row.what))).toEqual([]);
    expect(copyProblems(HELP_MAP.map((row) => row.keys[0]!))).toEqual([]);
  });

  it('joins two keys with "and" or "or", and draws each key as a key', () => {
    expect(html).toContain('<dt><kbd>Q</kbd> and <kbd>E</kbd></dt><dd>Turn the map, in 3D</dd>');
    expect(html).toContain('<dt><kbd>Ctrl+Z</kbd> or <kbd>⌘Z</kbd></dt>');
    expect(html).toContain('<dt>Right-drag or Ctrl-drag</dt>');
  });
});
