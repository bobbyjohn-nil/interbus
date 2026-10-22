// The chrome's text at 12 px and more (PLAN §8; e2e/a11y.ts measures it on the copy walk's screens): every font size the game's
// style sheet sets, so text that no end-to-end scene reaches is held too, such as an express line's tag, which mini-Boston cannot
// build. Shown failing (TS-04) on the style sheet the review of the accessibility floor read, whose Express tag was 11 px.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('the chrome’s text', () => {
  it('is set at 12 px or more everywhere in the style sheet, in pixels', () => {
    const css = readFileSync(join(__dirname, 'app.css'), 'utf8');
    // A shorthand would hide a size from this reading, so none may carry one.
    expect(css.match(/\bfont:\s*(?!inherit;)[^;]*\d+(\.\d+)?px/g) ?? []).toEqual([]);
    const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(sizes.length).toBeGreaterThan(30);
    expect(sizes.filter((v) => !/^\d+(\.\d+)?px$/.test(v) || parseFloat(v) < 12)).toEqual([]);
  });
});
