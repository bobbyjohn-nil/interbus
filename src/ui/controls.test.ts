// The game's own controls (D25: "I don't like the default dropdown menus, there should be custom
// ones"): no screen draws the browser's <select>; every choice is the game's Dropdown. Shown failing
// (TS-04) on the line card and the new-line card before this change, which each drew <select>s.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx') ? [join(dir, e.name)] : []));
}

describe('the game’s controls', () => {
  it('draws no browser <select> on any screen', () => {
    const files = sources(join(__dirname));
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((f) => /<select[\s>]/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(f.indexOf('src/')))).toEqual([]);
  });
});
