// Help (PLAN §8's keyboard shortcuts; help.ts): it lists every key the map reads (VIEW_KEYS) and the number keys for every
// running speed, named as the speed chip names them; the game's own keys, which App.tsx's onKey reads, are held to the list
// below, which a key added there must join. It keeps the copy convention, which the copy walk cannot read in a list of terms
// (e2e/copy.spec.ts reads headings, buttons and paragraphs). Shown failing (TS-04) with N left out of the list, and with a
// description in lower case.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ALLOWED_LINKS, OWN_FILES } from '../../platform';
import { CREDITS, CREDITS_GAME } from '../credits';
import { VIEW_KEYS } from '../../render/map/tilt';
import { RUNNING_SPEEDS } from '../../sim/rules/speed';
import { copyProblems } from '../copyRules';
import { speedText } from '../format';
import { HELP_FLAT, HELP_KEYS, HELP_MAP } from '../help';
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

  it('lists the keys the game reads: Space, the number keys, undo, Escape, Backspace, ?, and Home and End in its lists', () => {
    expect(keys).toEqual(expect.arrayContaining(['Space', '1', String(RUNNING_SPEEDS.length), 'Ctrl+Z', '⌘Z', 'Escape', 'Backspace', '?', 'Home', 'End']));
  });

  it('names each speed the number keys pick as the speed chip does, slowest first', () => {
    const row = HELP_KEYS.find((r) => r.join === 'to')!;
    expect(row.keys).toEqual(['1', String(RUNNING_SPEEDS.length)]);
    expect(row.what).toBe(`Pick a speed: ${RUNNING_SPEEDS.slice(0, -1).map(speedText).join(', ')} or ${speedText(RUNNING_SPEEDS.at(-1)!)}`);
    expect(row.what).toBe('Pick a speed: 1×, 60×, 600×, 2,700× or 5,400×');
  });

  it('keeps the copy convention: every description, and every gesture, starts with a capital and shouts nothing', () => {
    expect(copyProblems([...HELP_KEYS, ...HELP_MAP].map((row) => row.what).concat(HELP_FLAT))).toEqual([]);
    expect(copyProblems(HELP_MAP.map((row) => row.keys[0]!))).toEqual([]);
  });

  it('joins two keys with "and", "or" or "to", and draws each key as a key', () => {
    expect(html).toContain('<dt><kbd>Q</kbd> and <kbd>E</kbd></dt><dd>Turn the map, in 3D</dd>');
    expect(html).toContain('<dt><kbd>Ctrl+Z</kbd> or <kbd>⌘Z</kbd></dt>');
    expect(html).toContain('<dt><kbd>1</kbd> to <kbd>5</kbd></dt>');
    expect(html).toContain('<dt>Right-drag or Ctrl+drag</dt>');
  });

  it('says that Low graphics keeps the map flat, so the view’s keys and gestures do nothing there', () => {
    expect(html).toContain(`<p class="note">${HELP_FLAT}</p>`);
    for (const key of ['T', 'Q', 'E', 'N']) expect(HELP_FLAT).toContain(key);
  });
});

// Help's Credits (PLAN §10's credits screen; credits.ts) holds every credit LICENSE-DATA.md names: each one its city files'
// table quotes, and the font's. Shown failing (TS-04) with the LODES credit left out, and with a link off the allowlist.
describe('Help’s credits', () => {
  const credits = renderToStaticMarkup(createElement(Help, { onClose: () => undefined, view: 'credits' }));
  const text = credits.replace(/<[^>]+>/g, '');
  const licenseData = readFileSync(new URL('../../../LICENSE-DATA.md', import.meta.url), 'utf8');

  it('opens on the keys unless asked for the credits, and names both views as tabs', () => {
    expect(html).toContain('data-view="keys"');
    expect(credits).toContain('data-view="credits"');
    expect(credits).toMatch(/role="tab" aria-selected="false" tabindex="-1" data-testid="help-keys">Keys and the map</);
    expect(credits).toMatch(/role="tab" aria-selected="true" tabindex="0" data-testid="help-credits">Credits</);
  });

  it('credits everything LICENSE-DATA.md’s city files and font name, in its words', () => {
    const table = licenseData.slice(licenseData.indexOf('## The city files'), licenseData.indexOf('## The font'));
    const quoted = table
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Source') && !line.startsWith('|---'))
      .flatMap((line) => [...line.split('|').at(-2)!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
    expect(quoted.length).toBeGreaterThanOrEqual(6);
    for (const credit of quoted) expect(text).toContain(credit);
    for (const credit of ['Afacad Flux', '© 2023 The Afacad Project Authors', 'SIL Open Font License 1.1']) expect(text).toContain(credit);
    expect(text).toContain(CREDITS_GAME);
  });

  it('links only pages on the platform’s allowlist and the build’s own licence texts', () => {
    const hrefs = [...credits.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBe(CREDITS.flatMap((g) => g.rows).filter((r) => r.url || r.file).length);
    for (const href of hrefs) expect([...ALLOWED_LINKS, ...OWN_FILES]).toContain(href);
    expect(hrefs).toEqual(expect.arrayContaining([...OWN_FILES]));
    expect(credits).not.toMatch(/target="_blank"(?![^>]*rel="noopener noreferrer")/);
  });

  it('keeps the copy convention in every heading, name, line and link', () => {
    const rows = CREDITS.flatMap((g) => g.rows);
    const words = [CREDITS_GAME, ...CREDITS.map((g) => g.heading), ...rows.flatMap((r) => [r.name, r.what, r.file?.text ?? 'None'])];
    expect(copyProblems(words)).toEqual([]);
  });
});
