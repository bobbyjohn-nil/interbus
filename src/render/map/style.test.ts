import { createExpression, featureFilter, validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import type { Bbox } from '../../cities';
import {
  asExpression,
  BOARD,
  boardFeatures,
  buildStyle,
  BUILDINGS_2D,
  BUILDINGS_3D,
  DEFAULT_HEIGHT_M,
  DROPPED_LAYERS,
  FONT_STACKS,
  MASK_LAYERS,
  SOURCE,
} from './style';
import { GAME_LIGHT, LIGHT, type MapTokens } from './tokens';
import { hexToOklch } from './oklch';

const ASSET_BASE = 'https://example.test/interbus/';
const EXTENT: Bbox = [-71.16, 42.315, -70.98, 42.405];
const style = buildStyle({ tilesUrl: 'pmtiles://cities/boston.pmtiles', assetBase: ASSET_BASE, tokens: LIGHT, extent: EXTENT });
const ids = style.layers.map((l) => l.id);

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

  it('reads the city from its one tile file and the board mask from inline data', () => {
    for (const layer of style.layers) {
      if (layer.type === 'background') continue;
      const source = (layer as { source?: string }).source;
      expect(source, layer.id).toBe(MASK_LAYERS.includes(layer.id) ? BOARD : SOURCE);
    }
    expect(Object.keys(style.sources)).toEqual([SOURCE, BOARD]);
    const board = style.sources[BOARD] as { type: string; data: unknown };
    expect(board.type).toBe('geojson');
    expect(typeof board.data, 'data, never a URL to fetch').toBe('object');
  });

  it('validates against the MapLibre style spec (I14)', () => {
    expect(validateStyleMin(style).map((e) => e.message)).toEqual([]);
  });
});

describe('3D buildings (raw tilt, PLAN §6)', () => {
  const flat = style.layers.find((l) => l.id === BUILDINGS_2D) as { filter?: unknown; layout?: Record<string, unknown> };
  const tall = style.layers.find((l) => l.id === BUILDINGS_3D) as
    | { type: string; 'source-layer': string; filter?: unknown; layout?: Record<string, unknown>; paint: Record<string, unknown> }
    | undefined;

  it('extrudes the same buildings the flat layer draws, hidden until T tilts the board', () => {
    expect(tall?.type).toBe('fill-extrusion');
    expect(tall?.['source-layer']).toBe('buildings');
    expect(tall?.filter).toEqual(flat.filter);
    expect(tall?.layout?.visibility).toBe('none');
    expect(flat.layout?.visibility ?? 'visible').toBe('visible');
  });

  it('stands a building without a height tag at the default height, from its base', () => {
    expect(tall?.paint['fill-extrusion-height']).toEqual(['coalesce', ['get', 'height'], DEFAULT_HEIGHT_M]);
    expect(tall?.paint['fill-extrusion-base']).toEqual(['coalesce', ['get', 'min_height'], 0]);
    expect(tall?.paint['fill-extrusion-color']).toBe(LIGHT.buildingFill);
  });

  it('draws above every street and below every label', () => {
    const at = ids.indexOf(BUILDINGS_3D);
    const before = style.layers.slice(0, at);
    const after = style.layers.slice(at + 1).filter((l) => !MASK_LAYERS.includes(l.id));
    expect(before.every((l) => l.type !== 'symbol')).toBe(true);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((l) => l.type === 'symbol')).toBe(true);
  });
});

describe('board mask (V1, PLAN §6)', () => {
  const { features } = boardFeatures(EXTENT);
  const panels = features.filter((f) => f.properties.kind === 'mask');
  const [w, s, e, n] = EXTENT;

  it('greys beyond the play area and leaves the play area clear', () => {
    const covered = ([x, y]: [number, number]) =>
      panels.some((p) => {
        const ring = p.geometry.coordinates[0] as [number, number][];
        const xs = ring.map((c) => c[0]);
        const ys = ring.map((c) => c[1]);
        return x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys);
      });
    const step = 0.01;
    // Inside: never covered. Just outside on every side and corner, out to 3°: always covered.
    for (let x = w + step / 2; x < e; x += step) for (let y = s + step / 2; y < n; y += step) expect(covered([x, y])).toBe(false);
    for (const d of [0.001, 0.5, 3]) {
      for (const p of [[w - d, (s + n) / 2], [e + d, (s + n) / 2], [(w + e) / 2, s - d], [(w + e) / 2, n + d], [w - d, s - d], [e + d, n + d]] as [number, number][]) {
        expect(covered(p), `${p}`).toBe(true);
      }
    }
  });

  it('dashes the edge around exactly the play area', () => {
    const edge = features.find((f) => f.properties.kind === 'edge');
    expect(edge?.geometry.coordinates).toEqual([[w, s], [e, s], [e, n], [w, n], [w, s]]);
  });

  it('lies over every other layer, labels included, as in V1', () => {
    expect(ids.slice(-MASK_LAYERS.length)).toEqual([...MASK_LAYERS]);
    const fill = style.layers.find((l) => l.id === 'board-mask') as { paint: Record<string, unknown> };
    expect(fill.paint['fill-color']).toBe(LIGHT.mask);
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

describe('game tokens (PLAN §8 rule 1)', () => {
  it('keeps the data loud: chroma ≥0.12 for every dot, depot and stop-flag colour', () => {
    const { homeDot, jobDot, depotLand, depotMark, stopFlag } = GAME_LIGHT;
    for (const [name, hex] of Object.entries({ homeDot, jobDot, depotLand, depotMark, stopFlag })) {
      expect(hexToOklch(hex).c, `${name} ${hex}`).toBeGreaterThanOrEqual(0.12);
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

// The review of the day and night tint: the parks' colour was a case on each park's kind, so the light's every step laid out every
// tile again (daylight.ts); the parks are now one layer a colour, each colour the same for every park it draws.
describe('a fill coloured by each feature, as one layer a colour (byColour)', () => {
  const parks = style.layers.filter((l) => l.id === 'landuse_park' || l.id.startsWith('landuse_park-')) as unknown as {
    id: string;
    filter: unknown[];
    paint: Record<string, unknown>;
  }[];

  it('draws every kind the parks draw from one layer, in the colour its case gave it', () => {
    expect(parks.map((l) => l.id)).toEqual(['landuse_park', 'landuse_park-2', 'landuse_park-3']);
    for (const l of parks) expect(typeof l.paint['fill-color'], l.id).toBe('string');
    const [, kept, picked] = parks[0]!.filter as [string, [string, unknown, [string, string[]]], [string, unknown, string]];
    const cased = createExpression(picked[1], 'layers.landuse_park.paint.fill-color');
    if (cased.result !== 'success') throw new Error('the parks’ case does not parse');
    const kinds = kept[2][1];
    expect(kinds.length).toBeGreaterThan(10);
    for (const kind of [...kinds, 'a kind no park has']) {
      const feature = { type: 3 as const, properties: { kind } };
      const drawing = parks.filter((l) => featureFilter(l.filter as never, `layers.${l.id}.filter`).filter({ zoom: 15 }, feature as never));
      if (!kinds.includes(kind)) {
        expect(drawing, kind).toEqual([]);
        continue;
      }
      expect(drawing, kind).toHaveLength(1);
      expect(drawing[0]!.paint['fill-color'], kind).toBe(cased.value.evaluate({ zoom: 15 }, feature as never));
    }
  });

  it('reads the legacy filters protomaps writes, and refuses one it cannot', () => {
    expect(asExpression(['in', 'kind', 'park', 'wood'])).toEqual(['in', ['get', 'kind'], ['literal', ['park', 'wood']]]);
    expect(asExpression(['all', ['==', '$type', 'Polygon'], ['!has', 'name'], ['!in', 'kind', 'sand']])).toEqual([
      'all',
      ['==', ['geometry-type'], 'Polygon'],
      ['!', ['has', 'name']],
      ['!', ['in', ['get', 'kind'], ['literal', ['sand']]]],
    ]);
    expect(asExpression(['==', ['get', 'kind'], 'park'])).toEqual(['==', ['get', 'kind'], 'park']);
    expect(() => asExpression(['<', 'rank', 3])).toThrow(/cannot read/);
  });
});
