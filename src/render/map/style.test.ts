import { describe, expect, it } from 'vitest';
import { buildStyle, DROPPED_LAYERS, FONT_STACKS, SOURCE } from './style';
import { LIGHT, type MapTokens } from './tokens';
import { hexToOklch } from './oklch';

const ASSET_BASE = 'https://example.test/interbus/';
const style = buildStyle({ tilesUrl: 'pmtiles://cities/boston.pmtiles', assetBase: ASSET_BASE, tokens: LIGHT });

/** Every string inside a layout or paint value, however nested. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('map style', () => {
  it('draws every label in one of the two Afacad Flux stacks', () => {
    const fonts = style.layers.flatMap((l) => {
      const f = (l as { layout?: Record<string, unknown> }).layout?.['text-font'];
      return f === undefined ? [] : strings(f).filter((s) => !['case', '<=', 'get', 'min_zoom', 'literal'].includes(s));
    });
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) expect(FONT_STACKS).toContain(font);
  });

  it('asks for no font but Afacad Flux anywhere, format overrides included', () => {
    const all = style.layers.flatMap((l) => strings((l as { layout?: unknown }).layout));
    expect(all.filter((s) => s.includes('Noto'))).toEqual([]);
  });

  it('loads glyphs from this build, never from a third party', () => {
    expect(style.glyphs).toBe(`${ASSET_BASE}fonts/{fontstack}/{range}.pbf`);
    expect(style.sprite).toBeUndefined();
  });

  it('draws no transit and no icons (D17; no sprite yet)', () => {
    const ids = style.layers.map((l) => l.id);
    for (const dropped of DROPPED_LAYERS) expect(ids).not.toContain(dropped);
    for (const layer of style.layers) {
      expect((layer as { layout?: Record<string, unknown> }).layout?.['icon-image']).toBeUndefined();
    }
  });

  it('reads every vector layer from the one city source', () => {
    for (const layer of style.layers) {
      if (layer.type !== 'background') expect((layer as { source?: string }).source).toBe(SOURCE);
    }
    expect(Object.keys(style.sources)).toEqual([SOURCE]);
  });
});

describe('light tokens (PLAN §8 palette rules)', () => {
  const tokens = LIGHT as unknown as Record<keyof MapTokens, string>;
  it('keeps the base quiet: chroma ≤0.04, water ≤0.07', () => {
    for (const [name, hex] of Object.entries(tokens)) {
      const limit = name === 'water' || name === 'waterLabel' ? 0.07 : 0.04;
      expect(hexToOklch(hex).c, `${name} ${hex}`).toBeLessThanOrEqual(limit);
    }
  });
});

describe('hexToOklch', () => {
  it('matches known values', () => {
    expect(hexToOklch('#ffffff').l).toBeCloseTo(1, 3);
    expect(hexToOklch('#ffffff').c).toBeCloseTo(0, 3);
    expect(hexToOklch('#ff0000').c).toBeCloseTo(0.2577, 3);
  });
});
