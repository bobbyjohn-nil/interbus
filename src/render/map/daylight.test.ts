import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import type { Bbox } from '../../cities';
import { LINE_COLOURS } from '../../sim/rules/line';
import { darkStep, daylightPaints, dim, dimmed, NIGHT_STEP, paintsAcross } from './daylight';
import { hexToOklch } from './oklch';
import { overlayLayers, restingLines, RESTING_OPACITY, setResting } from './overlays';
import { buildStyle, MASK_LAYERS } from './style';
import { GAME_LIGHT, LIGHT, type MapTokens } from './tokens';

const EXTENT: Bbox = [-71.16, 42.315, -70.98, 42.405];
const styleOf = (tokens: MapTokens) => buildStyle({ tilesUrl: 'pmtiles://cities/boston.pmtiles', assetBase: 'https://example.test/interbus/', tokens, extent: EXTENT });
const STEPS = Array.from({ length: NIGHT_STEP + 1 }, (_, step) => step);
const at = (h: number, m = 0) => h * 3_600 + m * 60;

/** OKLab distance between two colours (×100 is about one just-noticeable step). */
function distance(x: string, y: string): number {
  const [p, q] = [hexToOklch(x), hexToOklch(y)];
  const ab = (c: { c: number; h: number }) => [c.c * Math.cos((c.h * Math.PI) / 180), c.c * Math.sin((c.h * Math.PI) / 180)];
  const [pa, pb] = ab(p);
  const [qa, qb] = ab(q);
  return Math.hypot(p.l - q.l, pa! - qa!, pb! - qb!);
}

/** WCAG 2's contrast ratio. */
function contrast(x: string, y: string): number {
  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [a, b] = [luminance(x), luminance(y)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('the light by the sim’s clock', () => {
  it('is day from 06:30 to 19:00, a step darker each half hour from 19:00, night from 20:30 to 05:00, and lighter from 05:00', () => {
    const steps = [
      [at(6, 30), 0], [at(12), 0], [at(18, 59), 0],
      [at(19), 1], [at(19, 29), 1], [at(19, 30), 2], [at(20), 3], [at(20, 30), 4], [at(23, 59), 4],
      [at(0), 4], [at(4, 59), 4],
      [at(5), 3], [at(5, 30), 2], [at(6), 1], [at(6, 29), 1],
    ] as const;
    for (const [second, step] of steps) expect(darkStep(second), `${second}`).toBe(step);
    // Any day's second, and past a day's end.
    expect(darkStep(at(19) + 86_400 * 3)).toBe(1);
    expect(darkStep(-at(1))).toBe(4);
  });

  it('changes eight times a day, so the paints are set eight times a day at most (RN-04)', () => {
    let changes = 0;
    for (let s = 1; s < 86_400; s++) if (darkStep(s) !== darkStep(s - 1)) changes++;
    expect(changes).toBe(8);
    expect(darkStep(0)).toBe(darkStep(86_399));
  });

  it('dims each colour step by step, and leaves it as it is by day', () => {
    expect(dim('#ebe7df', 0)).toBe('#ebe7df');
    const land = STEPS.map((step) => hexToOklch(dim(LIGHT.land, step)).l);
    for (let k = 1; k < land.length; k++) expect(land[k]!).toBeLessThan(land[k - 1]!);
    // A cool dusk: blue keeps more of its light than red.
    const night = Number.parseInt(dim('#ffffff', NIGHT_STEP).slice(1), 16);
    expect(night & 255).toBeGreaterThan((night >> 16) & 255);
  });
});

describe('the palette at every step (D13: light by day and at its darkest)', () => {
  it('keeps the base quiet: chroma ≤0.04, water ≤0.07 (PLAN §8 rule 1)', () => {
    for (const step of STEPS) {
      for (const [name, hex] of Object.entries(dimmed(LIGHT, step))) {
        const limit = name === 'water' || name === 'waterLabel' ? 0.07 : 0.04;
        expect(hexToOklch(hex).c, `${name} ${hex} at step ${step}`).toBeLessThanOrEqual(limit);
      }
    }
  });

  // The game's colours stay as they are on a dimmer map: each at least 0.15 apart in OKLab from every base colour it is drawn
  // over (by day the nearest pair, the Amber line on a building, is 0.278 apart; at night 0.159). Water carries the lines,
  // the line being drawn and the buses over its bridges; the dots, depots and flags stand on land.
  it('keeps every game colour clear of the base it is drawn over', () => {
    const ground: (keyof MapTokens)[] = ['land', 'street', 'arterial', 'buildingFill', 'park', 'wood', 'path', 'hospital', 'school', 'industrial'];
    const busInk = '#292624'; // vehicles.ts's glyph outline, vec3(0.16, 0.15, 0.14)
    const game: [string, string, (keyof MapTokens)[]][] = [
      ...LINE_COLOURS.map((c, k): [string, string, (keyof MapTokens)[]] => [`line ${k + 1}`, c, [...ground, 'water']]),
      ['the line being drawn', GAME_LIGHT.draft, [...ground, 'water']],
      ['a bus’s ink', busInk, [...ground, 'water']],
      ...(['homeDot', 'jobDot', 'depotLand', 'depotMark', 'stopFlag'] as const).map((k): [string, string, (keyof MapTokens)[]] => [k, GAME_LIGHT[k], ground]),
    ];
    let nearest = Infinity;
    for (const step of STEPS) {
      const base = dimmed(LIGHT, step);
      for (const [name, colour, under] of game) {
        for (const b of under) {
          const d = distance(colour, base[b]);
          nearest = Math.min(nearest, d);
          expect(d, `${name} on ${b} at step ${step}`).toBeGreaterThanOrEqual(0.15);
        }
      }
    }
    expect(nearest).toBeLessThan(0.17);
  });

  it('keeps the labels readable on their halos: 4.5:1 for the names, 3:1 for the minor ones', () => {
    for (const step of STEPS) {
      const t = dimmed(LIGHT, step);
      expect(contrast(t.label, t.labelHalo), `step ${step}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.labelMinor, t.labelHalo), `step ${step}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the paints the light changes', () => {
  const paints = daylightPaints(styleOf, LIGHT);

  it('are the style’s colours alone, each from its light value by day, and every step’s style validates', () => {
    expect(paints.length).toBeGreaterThan(20);
    for (const p of paints) expect(p.property, `${p.layer} ${p.property}`).toMatch(/-color$/);
    const day = styleOf(LIGHT);
    for (const p of paints) {
      const layer = day.layers.find((l) => l.id === p.layer) as { paint?: Record<string, unknown> } | undefined;
      expect(p.values[0], `${p.layer} ${p.property}`).toEqual(layer?.paint?.[p.property]);
      expect(p.values).toHaveLength(NIGHT_STEP + 1);
    }
    for (const step of STEPS) expect(validateStyleMin(styleOf(dimmed(LIGHT, step))).map((e) => e.message)).toEqual([]);
  });

  it('take in the ground, the buildings flat and tall, the labels and the board mask', () => {
    const at = (layer: string, property: string) => paints.find((p) => p.layer === layer && p.property === property);
    expect(at('background', 'background-color')?.values).toEqual(STEPS.map((step) => dim(LIGHT.void, step)));
    expect(at('earth', 'fill-color')?.values).toEqual(STEPS.map((step) => dim(LIGHT.land, step)));
    expect(at('buildings-3d', 'fill-extrusion-color')?.values).toEqual(STEPS.map((step) => dim(LIGHT.buildingFill, step)));
    expect(at(MASK_LAYERS[0]!, 'fill-color')?.values).toEqual(STEPS.map((step) => dim(LIGHT.mask, step)));
    expect(paints.some((p) => p.property === 'text-halo-color')).toBe(true);
  });

  it('take in the game’s words worn in the labels’ inks, and none of the game’s own colours', () => {
    const overlays = paintsAcross(STEPS.map((step) => overlayLayers(GAME_LIGHT, dimmed(LIGHT, step))));
    const names = overlays.map((p) => `${p.layer} ${p.property}`).sort();
    expect(names).toEqual(['draft-order text-halo-color', 'event-label text-halo-color', 'lines-name text-color', 'lines-name text-halo-color', 'stops-flag-word text-halo-color']);
    expect(overlays.find((p) => p.layer === 'lines-name' && p.property === 'text-color')?.values).toEqual(STEPS.map((step) => dim(LIGHT.label, step)));
  });
});

describe('a line resting while it runs no service (D13)', () => {
  const lines = [
    { id: 1, headways: { peak: 900, offpeak: 1_200, overnight: null } },
    { id: 2, headways: { peak: 900, offpeak: 1_200, overnight: 3_600 } },
  ];

  it('is a line with overnight off, from 00:00 to 05:00, by the schedule’s own periods', () => {
    expect(restingLines(lines, at(0))).toEqual([1]);
    expect(restingLines(lines, at(4, 59))).toEqual([1]);
    expect(restingLines(lines, at(5))).toEqual([]);
    expect(restingLines(lines, at(23, 59))).toEqual([]);
  });

  it('fades its route, its name and its stops, and with none resting every line shows whole', () => {
    const set: [string, string, unknown][] = [];
    const map = { setPaintProperty: (layer: string, property: string, value: unknown) => void set.push([layer, property, value]) };
    setResting(map as never, [1, 3]);
    expect(set.map(([layer, property]) => `${layer} ${property}`)).toEqual(['lines-route line-opacity', 'lines-name text-opacity', 'lines-stops circle-opacity', 'lines-stops circle-stroke-opacity']);
    for (const [, , value] of set) expect(value).toEqual(['case', ['in', ['get', 'id'], ['literal', [1, 3]]], RESTING_OPACITY, 1]);
    set.length = 0;
    setResting(map as never, []);
    for (const [, , value] of set) expect(value).toBe(1);
  });
});
