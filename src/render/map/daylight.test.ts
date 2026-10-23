import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import type { Bbox } from '../../cities';
import { LINE_COLOURS } from '../../sim/rules/line';
import { START_SECOND_OF_DAY } from '../../sim/rules/periods';
import { darkStep, daylightPaints, dim, dimmed, louder, NIGHT_STEP, paintsAcross } from './daylight';
import { hexToOklch } from './oklch';
import { overlayLayers, restingLines, RESTING_OPACITY, restingStops, setResting } from './overlays';
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
  it('is day from 05:00 to 19:00, a step darker each half hour from 19:00, night from 20:30 to 03:30, and lighter from 03:30', () => {
    const steps = [
      [at(5), 0], [at(12), 0], [at(18, 59), 0],
      [at(19), 1], [at(19, 29), 1], [at(19, 30), 2], [at(20), 3], [at(20, 30), 4], [at(23, 59), 4],
      [at(0), 4], [at(3, 29), 4],
      [at(3, 30), 3], [at(4), 2], [at(4, 30), 1], [at(4, 59), 1],
    ] as const;
    for (const [second, step] of steps) expect(darkStep(second), `${second}`).toBe(step);
    // Any day's second, and past a day's end.
    expect(darkStep(at(19) + 86_400 * 3)).toBe(1);
    expect(darkStep(-at(1))).toBe(4);
  });

  // The review of the day and night tint: dawn from 05:00 left a new company founded, its depot placed and its first line drawn
  // on a map three quarters of the way to night, where Home and the founding card stood too.
  it('is day as a new game starts, paused at the service day’s opening', () => {
    expect(darkStep(START_SECOND_OF_DAY)).toBe(0);
    expect(darkStep(START_SECOND_OF_DAY - 1)).toBe(1);
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

  // The game's colours stay as they are on a dimmer map. The opaque marks keep at least 0.15 apart in OKLab from every base colour
  // they are drawn over (by day the nearest pair, the Amber line on a building, is 0.278 apart; at night 0.159). Water carries the
  // lines, the line being drawn and the buses over its bridges.
  const ground: (keyof MapTokens)[] = ['land', 'street', 'arterial', 'buildingFill', 'park', 'wood', 'path', 'hospital', 'school', 'industrial'];
  it('keeps every opaque game colour clear of the base it is drawn over', () => {
    const busInk = '#292624'; // vehicles.ts's glyph outline, vec3(0.16, 0.15, 0.14)
    const game: [string, string, (keyof MapTokens)[]][] = [
      ...LINE_COLOURS.map((c, k): [string, string, (keyof MapTokens)[]] => [`line ${k + 1}`, c, [...ground, 'water']]),
      ['the line being drawn', GAME_LIGHT.draft, [...ground, 'water']],
      ['a bus’s ink', busInk, [...ground, 'water']],
      ...(['depotMark', 'stopFlag'] as const).map((k): [string, string, (keyof MapTokens)[]] => [k, GAME_LIGHT[k], ground]),
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

  // The translucent marks as the map draws them, blended over the base at the opacity each step gives them (overlays.ts, louder):
  // none comes nearer the base under it at any step than the nearest comes by day, the depot land's tint on a building (0.092).
  // At their day opacities that tint fell to 0.062 at night, a home dot to 0.124 and a job's ring over water to 0.103 (the
  // review of the day and night tint). Dots stand on water at the waterfront.
  it('keeps every translucent mark as drawn no nearer the base at night than the nearest is by day', () => {
    const marks: [string, string, string, string, (keyof MapTokens)[]][] = [
      ['a home', 'dots-homes', 'circle-opacity', GAME_LIGHT.homeDot, [...ground, 'water']],
      ['a job’s ring', 'dots-jobs', 'circle-stroke-opacity', GAME_LIGHT.jobDot, [...ground, 'water']],
      ['depot land', 'depot-land-fill', 'fill-opacity', GAME_LIGHT.depotLand, ['land', 'industrial', 'buildingFill', 'street']],
      ['roadworks ahead', 'event-pending', 'line-opacity', GAME_LIGHT.stopFlag, ['street', 'arterial']],
      ['roadworks on', 'event-on', 'line-opacity', GAME_LIGHT.stopFlag, ['street', 'arterial']],
    ];
    const blend = (top: string, alpha: number, under: string) => {
      const ch = (hex: string) => [16, 8, 0].map((shift) => (Number.parseInt(hex.slice(1), 16) >> shift) & 255);
      const [a, b] = [ch(top), ch(under)];
      return `#${a.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i]!).toString(16).padStart(2, '0')).join('')}`;
    };
    const nearestAt = (step: number) => {
      const layers = overlayLayers(GAME_LIGHT, dimmed(LIGHT, step), step);
      const base = dimmed(LIGHT, step);
      return marks.map(([name, layer, property, colour, under]) => {
        const alpha = (layers.find((l) => l.id === layer) as unknown as { paint: Record<string, number> }).paint[property]!;
        return { name, d: Math.min(...under.map((b) => distance(blend(colour, alpha, base[b]), base[b]))) };
      });
    };
    const floor = Math.min(...nearestAt(0).map((m) => m.d));
    expect(floor).toBeCloseTo(0.092, 3);
    for (const step of STEPS) for (const { name, d } of nearestAt(step)) expect(d, `${name} at step ${step}`).toBeGreaterThanOrEqual(floor);
    expect(louder(0.55, NIGHT_STEP)).toBe(0.88);
    expect(louder(0.7, NIGHT_STEP)).toBe(1);
  });

  // The review of the day and night tint: in the labels' halo, which dims, the warning ink, which does not, fell from 4.20:1 to
  // 2.32:1 at night (QUIET, LOSS, roadworks ahead). The game's words in its own inks keep their own halo (wordHalo).
  it('keeps the game’s words in its own inks on their own halo at every step, as readable as by day', () => {
    const words = (step: number) => {
      const layers = overlayLayers(GAME_LIGHT, dimmed(LIGHT, step), step);
      return ['stops-flag-word', 'event-label', 'draft-order'].map((id) => {
        const paint = (layers.find((l) => l.id === id) as unknown as { paint: Record<string, string> }).paint;
        return { id, halo: paint['text-halo-color'], ratio: contrast(paint['text-color']!, paint['text-halo-color']!) };
      });
    };
    const day = words(0);
    expect(day.find((w) => w.id === 'stops-flag-word')!.ratio).toBeCloseTo(4.2, 2);
    for (const step of STEPS) {
      for (const [k, w] of words(step).entries()) {
        expect(w.halo, `${w.id} at step ${step}`).toBe(GAME_LIGHT.wordHalo);
        expect(w.ratio, `${w.id} at step ${step}`).toBe(day[k]!.ratio);
      }
    }
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

  it('take in the lines’ names in the labels’ inks and the translucent marks’ opacities, and none of the game’s own colours', () => {
    const overlays = paintsAcross(STEPS.map((step) => overlayLayers(GAME_LIGHT, dimmed(LIGHT, step), step)));
    const names = overlays.map((p) => `${p.layer} ${p.property}`).sort();
    expect(names).toEqual([
      'depot-land-fill fill-opacity',
      'dots-homes circle-opacity',
      'dots-jobs circle-stroke-opacity',
      'draft-rings fill-opacity',
      'event-on line-opacity',
      'event-pending line-opacity',
      'lines-name text-color',
      'lines-name text-halo-color',
      'lines-name-resting text-color',
      'lines-name-resting text-halo-color',
    ]);
    expect(overlays.find((p) => p.layer === 'lines-name' && p.property === 'text-color')?.values).toEqual(STEPS.map((step) => dim(LIGHT.label, step)));
  });

  // The review of the day and night tint: the parks' colour was a case on each park's kind, and a colour that depends on each
  // feature changes only by laying out again every tile of its source, the 3D buildings' too (612 ms in 3D on software GL), and
  // takes no transition. Every paint the light changes is the same for every feature now (style.ts, byColour).
  it('are the same for every feature, so a step lays out no tile again and every one of them fades', () => {
    const overlays = paintsAcross(STEPS.map((step) => overlayLayers(GAME_LIGHT, dimmed(LIGHT, step), step)));
    for (const p of [...paints, ...overlays]) {
      for (const value of p.values) expect(JSON.stringify(value), `${p.layer} ${p.property}`).not.toMatch(/"(get|has|feature-state|geometry-type|properties|id|in)"/);
    }
  });
});

describe('a line resting while it runs no service (D13)', () => {
  const lines = [
    { id: 1, headways: { peak: 900, offpeak: 1_200, overnight: null } },
    { id: 2, headways: { peak: 900, offpeak: 1_200, overnight: 3_600 } },
  ];

  it('is a line with overnight off, from 00:00 to 05:00 by the schedule’s own periods, its buses all in', () => {
    expect(restingLines(lines, at(0))).toEqual([1]);
    expect(restingLines(lines, at(4, 59))).toEqual([1]);
    expect(restingLines(lines, at(5))).toEqual([]);
    expect(restingLines(lines, at(23, 59))).toEqual([]);
  });

  // The systems audit's eleventh round: a line faded at 00:00 while its buses still ran its last trips (4 buses at 00:00 on the
  // debug line every 5 minutes, the last until 00:17; 16–18 of the busy scene's 64 at 00:10). D13 fades it "while it is stopped".
  it('rests only once no bus of it is in service on a trip begun before 00:00', () => {
    const still = new Set([1]);
    expect(restingLines(lines, at(0, 10), (id) => still.has(id))).toEqual([]);
    still.clear();
    expect(restingLines(lines, at(0, 40), (id) => still.has(id))).toEqual([1]);
  });

  // The systems audit's eleventh round: the fade was a paint of each line's id (['case', ['in', ['get', 'id'], …], 0.35, 1]). A
  // resting line drawn later on a street it shared with a running one tinted it, (34, 120, 132): 0.35 of the green over 0.65 of the
  // blue, neither line's colour. And MapLibre compiled the programs for an opacity of each feature's at the first midnight, which
  // held the page 518–1,249 ms in Low graphics on the busy scene (442 ms in getUniformBlockIndex, 371 in getProgramParameter).
  it('draws its route, name, stops and their flags in faded copies just under the running lines’, the same but their opacity', () => {
    const layers = overlayLayers(GAME_LIGHT, dimmed(LIGHT, 0), 0);
    const ids = layers.map((l) => l.id);
    const faded: Record<string, string[]> = {
      'lines-route': ['line-opacity'],
      'lines-name': ['text-opacity'],
      'lines-stops': ['circle-opacity', 'circle-stroke-opacity'],
      'stops-flag-ring': ['circle-stroke-opacity'],
      'stops-flag-word': ['text-opacity'],
    };
    for (const [id, opacities] of Object.entries(faded)) {
      const layer = layers.find((l) => l.id === id) as { paint?: Record<string, unknown>; layout?: unknown; type: string };
      const copy = layers.find((l) => l.id === `${id}-resting`) as typeof layer | undefined;
      expect(copy, `${id} has a faded copy`).toBeDefined();
      expect(ids.indexOf(`${id}-resting`), `${id}'s copy is just under it`).toBe(ids.indexOf(id) - 1);
      expect(copy!.type).toBe(layer.type);
      expect(copy!.layout).toEqual(layer.layout);
      // The same for every feature, so the copy draws with the layer's own program.
      expect(copy!.paint).toEqual({ ...layer.paint, ...Object.fromEntries(opacities.map((p) => [p, RESTING_OPACITY])) });
      for (const value of Object.values(layer.paint ?? {})) expect(JSON.stringify(value)).not.toMatch(/"in"/);
    }
    // Every name over every route, the running lines' placed first: MapLibre places the upper layer's names first.
    expect(ids.indexOf('lines-name-resting')).toBe(ids.indexOf('lines-route') + 1);
  });

  it('moves its features, and the flags of the stops only it calls at, into the copies by their filters alone', () => {
    const set: [string, string, unknown][] = [];
    const map = {
      setFilter: (layer: string, filter: unknown) => void set.push([layer, 'filter', filter]),
      setPaintProperty: (layer: string, property: string, value: unknown) => void set.push([layer, property, value]),
      setLayoutProperty: (layer: string, property: string, value: unknown) => void set.push([layer, property, value]),
    };
    setResting(map as never, [1, 3], [7]);
    // Filters only: no paint or layout changes, so no program is compiled at night.
    expect(set.every(([, property]) => property === 'filter')).toBe(true);
    const filter = (layer: string) => set.find(([l]) => l === layer)?.[2];
    const lines = ['in', ['get', 'id'], ['literal', [1, 3]]];
    const stops = ['in', ['get', 'stop'], ['literal', [7]]];
    expect(filter('lines-route-resting')).toEqual(['all', ['==', ['get', 'kind'], 'route'], lines]);
    expect(filter('lines-route')).toEqual(['all', ['==', ['get', 'kind'], 'route'], ['!', lines]]);
    expect(filter('lines-name-resting')).toEqual(['all', ['==', ['get', 'kind'], 'route'], lines]);
    expect(filter('lines-stops-resting')).toEqual(['all', ['==', ['get', 'kind'], 'stop'], lines]);
    expect(filter('stops-flag-ring-resting')).toEqual(['all', ['==', ['get', 'kind'], 'flag'], stops]);
    expect(filter('stops-flag-word')).toEqual(['all', ['==', ['get', 'kind'], 'flag'], ['!', stops]]);
    expect(set).toHaveLength(10);
    // With none resting the copies hold nothing, and each layer every feature of its kind.
    set.length = 0;
    setResting(map as never, [], []);
    expect(filter('lines-route-resting')).toEqual(['all', ['==', ['get', 'kind'], 'route'], ['in', ['get', 'id'], ['literal', []]]]);
    expect(filter('stops-flag-word')).toEqual(['all', ['==', ['get', 'kind'], 'flag'], ['!', ['in', ['get', 'stop'], ['literal', []]]]]);
  });

  // The systems audit's eleventh round: a flag is a stop's, so the fade of each line's features never reached it, and a resting
  // line's Loss rings and words stayed whole at 02:00, the eye drawn to a line that does not run.
  it('rests a stop’s flag where only resting lines call', () => {
    const stops = [
      { id: 7, lineIds: [1] },
      { id: 8, lineIds: [1, 2] },
      { id: 9, lineIds: [] },
    ];
    expect(restingStops(stops, [1])).toEqual([7]);
    expect(restingStops(stops, [1, 2])).toEqual([7, 8]);
    expect(restingStops(stops, [])).toEqual([]);
  });

  it('keeps the filters MapLibre takes, with lines resting and without', () => {
    const style = styleOf(LIGHT);
    const layers = overlayLayers(GAME_LIGHT, dimmed(LIGHT, 0), 0);
    const set = new Map<string, unknown>();
    setResting({ setFilter: (layer: string, filter: unknown) => void set.set(layer, filter) } as never, [1], [7]);
    const resting = layers.map((l) => (set.has(l.id) ? { ...l, filter: set.get(l.id) } : l));
    for (const extra of [layers, resting]) {
      const sources = { ...style.sources, ...Object.fromEntries(['dots', 'lines', 'depot-land', 'depots', 'draft', 'events'].map((id) => [id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }])) };
      expect(validateStyleMin({ ...style, sources, layers: [...style.layers, ...extra] } as never)).toEqual([]);
    }
  });
});
