// The owner's Nov 8 light token pick (PLAN §8, D13): the starting warm-neutral tokens or pure V1 paper, side by side on Boston,
// with the network hues checked against the light set and a placeholder dark land and void. What each candidate measures, each
// number DECISIONS gives the owner pinned here (Measured, 2026-10-23), so they stay true of the colours `?light=paper` draws. The
// warm set's rules as it ships are daylight.test.ts's; here it stands beside V1's paper.
import { describe, expect, it } from 'vitest';
import { LINE_COLOURS } from '../../sim/rules/line';
import { dim, dimmed, NIGHT_STEP } from './daylight';
import { hexToOklch } from './oklch';
import { overlayLayers } from './overlays';
import { blend, contrast, distance } from './testing';
import { DARK_PLACEHOLDER, GAME_LIGHT, LIGHT, lightTokens, PAPER, V1_PAPER, WARM, type LightTokens, type MapTokens } from './tokens';

const STEPS = Array.from({ length: NIGHT_STEP + 1 }, (_, step) => step);
const CANDIDATES: [string, LightTokens][] = [['the warm-neutral set', WARM], ['V1’s paper', PAPER]];
const BUS_INK = '#292624'; // vehicles.ts's glyph outline, vec3(0.16, 0.15, 0.14)

/** V1's palette as V1 wrote it (`Intralines@7af45b1:src/map/basemapStyle.ts:9-32`, and the colours its layers wrote inline). */
const V1 = {
  land: '#f3edda',
  water: '#8ec8ee',
  park: '#b7dd9a', // at 0.7
  wood: '#a3d18c', // at 0.55
  industrial: '#e4e0e8', // at 0.5
  building3d: '#e6dac4', // at 0.86, its only buildings
  motorway: '#f7b267',
  motorwayCasing: '#e08e3c',
  primary: '#fdd8a2', // and trunk roads
  primaryCasing: '#e4b56e',
  secondary: '#fff8ea', // inline at :197, cased in its streets' casing (:185)
  tertiary: '#fff3d9',
  tertiaryCasing: '#dbc9a3',
  street: '#ffffff',
  streetCasing: '#d8cfba',
  label: '#4a4636', // every road's name (:298)
  labelHalo: '#fffcf0', // rgba(255,252,240,0.85)
  suburbLabel: '#8a7f63', // inline at :341
  waterLabel: '#3d6f9e', // inline at :314
  mask: '#75746e', // overlays.ts:98
  maskEdge: '#3c3728', // overlays.ts:107
};

/** PLAN §8 rule 1: the tokens over its base chroma (0.04; water and its names 0.07), with their chroma. */
const loud = (tokens: MapTokens) =>
  Object.entries(tokens)
    .map(([name, hex]) => [name, hexToOklch(hex).c] as const)
    .filter(([name, c]) => c > (name === 'water' || name === 'waterLabel' ? 0.07 : 0.04));

/** What the lines and the game's other opaque marks are drawn over (daylight.test.ts's, with each class of road). */
const GROUND: (keyof MapTokens)[] = ['land', 'street', 'arterial', 'highway', 'secondary', 'tertiary', 'buildingFill', 'park', 'wood', 'path', 'hospital', 'school', 'industrial'];

describe('V1’s paper (the Nov 8 pick’s other candidate)', () => {
  it('draws each colour as V1 drew it: a translucent fill as its blend over V1’s land, the rest as V1 wrote them', () => {
    const v = V1_PAPER;
    expect([v.park, v.wood, v.buildingFill, v.industrial, v.labelHalo]).toEqual([
      blend(V1.park, 0.7, V1.land),
      blend(V1.wood, 0.55, V1.land),
      blend(V1.building3d, 0.86, V1.land),
      blend(V1.industrial, 0.5, V1.land),
      blend(V1.labelHalo, 0.85, V1.land),
    ]);
    expect(v).toEqual({
      ...v,
      void: V1.land,
      land: V1.land,
      water: V1.water,
      street: V1.street,
      streetCasing: V1.streetCasing,
      arterial: V1.primary,
      arterialCasing: V1.primaryCasing,
      highway: V1.motorway,
      highwayCasing: V1.motorwayCasing,
      secondary: V1.secondary,
      secondaryCasing: V1.streetCasing,
      tertiary: V1.tertiary,
      tertiaryCasing: V1.tertiaryCasing,
      // What V1 did not draw: its land, or for paths, piers and runways its tertiary roads' fill.
      hospital: V1.land,
      school: V1.land,
      aerodrome: V1.land,
      path: V1.tertiary,
      buildingOutline: V1.streetCasing,
      boundary: V1.streetCasing,
      mask: V1.mask,
      maskEdge: V1.maskEdge,
      label: V1.label,
      streetName: V1.label,
      labelMinor: V1.suburbLabel,
      waterLabel: V1.waterLabel,
    });
    // The game's own words stand on V1's land, and its resting lines on its arterials at night; every other game colour is the
    // warm set's.
    expect(PAPER.game).toEqual({ ...GAME_LIGHT, wordHalo: V1.land, restingGround: dim(V1_PAPER.arterial, NIGHT_STEP) });
  });

  it('breaks PLAN §8 rule 1 in ten colours by day, nine at dusk and eight at night, where the warm set breaks none', () => {
    const day = Object.fromEntries(loud(V1_PAPER).map(([name, c]) => [name, Number(c.toFixed(3))]));
    expect(day).toEqual({ water: 0.081, park: 0.075, wood: 0.068, arterial: 0.081, arterialCasing: 0.104, highway: 0.122, highwayCasing: 0.138, tertiaryCasing: 0.054, labelMinor: 0.043, waterLabel: 0.092 });
    const names = (step: number) => loud(dimmed(V1_PAPER, step)).map(([name]) => name);
    const dusk = ['water', 'park', 'wood', 'arterial', 'arterialCasing', 'highway', 'highwayCasing', 'tertiaryCasing', 'waterLabel'];
    expect([names(1), names(2)]).toEqual([dusk, dusk]);
    const night = dusk.filter((name) => name !== 'tertiaryCasing');
    expect([names(3), names(4)]).toEqual([night, night]);
    for (const step of STEPS) expect(loud(dimmed(LIGHT, step)), `step ${step}`).toEqual([]);
  });
});

describe('both candidates at every step of the light', () => {
  it.each([
    ['the warm-neutral set', WARM, [5.82, 3.76, 3.76], [4.7, 3.32, 3.32]],
    ['V1’s paper', PAPER, [9.04, 3.79, 9.04], [6.7, 3.4, 6.7]],
  ] as const)('%s keeps its names readable on their halos: 4.5:1 for the names, 3:1 for the minor ones', (_, { map }, day, night) => {
    const ratios = (step: number) => {
      const t = dimmed(map, step);
      return [contrast(t.label, t.labelHalo), contrast(t.labelMinor, t.labelHalo), contrast(t.streetName, t.labelHalo)];
    };
    for (const step of STEPS) {
      const [names, minor, streets] = ratios(step);
      expect(names!, `step ${step}`).toBeGreaterThanOrEqual(4.5);
      expect(Math.min(minor!, streets!), `step ${step}`).toBeGreaterThanOrEqual(3);
    }
    ratios(0).forEach((r, k) => expect(r).toBeCloseTo(day[k]!, 2));
    ratios(NIGHT_STEP).forEach((r, k) => expect(r).toBeCloseTo(night[k]!, 2));
  });

  // The network hues against each light set (D13): the opaque marks against every base colour they are drawn over, as
  // daylight.test.ts holds the warm set, 0.15 apart in OKLab. V1's paper holds it by day, nearest the Amber line on its motorways'
  // amber (0.190); from 19:30 that pair comes nearer, to 0.050 at night, where its louder base dims toward the lines' own hues.
  it('keeps every opaque game colour 0.15 clear of its base at every step on the warm set, and on V1’s paper by day only', () => {
    const pairs = (map: MapTokens, step: number) => {
      const base = dimmed(map, step);
      const game: [string, string, (keyof MapTokens)[]][] = [
        ...LINE_COLOURS.map((c, k): [string, string, (keyof MapTokens)[]] => [`line ${k + 1}`, c, [...GROUND, 'water']]),
        ['the line being drawn', GAME_LIGHT.draft, [...GROUND, 'water']],
        ['a bus’s ink', BUS_INK, [...GROUND, 'water']],
        ['depotMark', GAME_LIGHT.depotMark, GROUND],
        ['stopFlag', GAME_LIGHT.stopFlag, GROUND],
      ];
      return game.flatMap(([name, colour, under]) => under.map((b) => ({ pair: `${name} on ${b}`, d: distance(colour, base[b]) })));
    };
    const nearest = (map: MapTokens, step: number) => pairs(map, step).reduce((a, b) => (b.d < a.d ? b : a));
    const under = (map: MapTokens, step: number) => pairs(map, step).filter((p) => p.d < 0.15).map((p) => `${p.pair} ${p.d.toFixed(3)}`);
    for (const step of STEPS) expect(under(LIGHT, step), `warm, step ${step}`).toEqual([]);
    for (const [step, d] of [[0, 0.278], [NIGHT_STEP, 0.159]] as const) {
      expect(nearest(LIGHT, step).pair).toBe('line 4 on buildingFill');
      expect(nearest(LIGHT, step).d).toBeCloseTo(d, 3);
    }
    expect(nearest(V1_PAPER, 0).pair).toBe('line 4 on highway');
    expect(nearest(V1_PAPER, 0).d).toBeCloseTo(0.19, 3);
    expect([under(V1_PAPER, 0), under(V1_PAPER, 1), under(V1_PAPER, 2), under(V1_PAPER, 3)]).toEqual([[], [], ['line 4 on highway 0.120'], ['line 4 on highway 0.082']]);
    expect(under(V1_PAPER, NIGHT_STEP)).toEqual([
      'line 2 on water 0.131',
      'line 4 on arterial 0.128',
      'line 4 on highway 0.050',
      'line 4 on park 0.149',
      'line 4 on wood 0.146',
      'stopFlag on highway 0.141',
    ]);
  });

  // The translucent marks as the map draws them (overlays.ts' opacities at each step), blended over the base: daylight.test.ts
  // holds the warm set's no nearer at night than its nearest by day, the depot land's tint on a building (0.092). On V1's paper
  // only a job's ring over water comes nearer, to 0.080 at night, under that set's own nearest by day (0.098, the same tint).
  it('keeps every translucent mark as far from its base at night as by day on the warm set, and all but a job’s ring over V1’s water', () => {
    const marks = ({ map, game }: LightTokens, step: number) => {
      const layers = overlayLayers(game, dimmed(map, step), step);
      const base = dimmed(map, step);
      const alpha = (id: string, property: string) => (layers.find((l) => l.id === id) as unknown as { paint: Record<string, number> }).paint[property]!;
      const list: [string, string, string, string, (keyof MapTokens)[]][] = [
        ['a home', 'dots-homes', 'circle-opacity', game.homeDot, [...GROUND, 'water']],
        ['a job’s ring', 'dots-jobs', 'circle-stroke-opacity', game.jobDot, [...GROUND, 'water']],
        ['depot land', 'depot-land-fill', 'fill-opacity', game.depotLand, ['land', 'industrial', 'buildingFill', 'street']],
        ['roadworks ahead', 'event-pending', 'line-opacity', game.stopFlag, ['street', 'arterial', 'secondary', 'tertiary']],
        ['roadworks on', 'event-on', 'line-opacity', game.stopFlag, ['street', 'arterial', 'secondary', 'tertiary']],
      ];
      return list.map(([name, layer, property, colour, under]) => ({ name, d: Math.min(...under.map((b) => distance(blend(colour, alpha(layer, property), base[b]), base[b]))) }));
    };
    const below = (theme: LightTokens) => {
      const floor = Math.min(...marks(theme, 0).map((m) => m.d));
      return { floor, under: STEPS.flatMap((step) => marks(theme, step).filter((m) => m.d < floor).map((m) => `${m.name} at step ${step} ${m.d.toFixed(3)}`)) };
    };
    expect(below(WARM).floor).toBeCloseTo(0.092, 3);
    expect(below(WARM).under).toEqual([]);
    expect(marks(WARM, NIGHT_STEP).find((m) => m.name === 'a job’s ring')!.d).toBeCloseTo(0.127, 3);
    expect(below(PAPER).floor).toBeCloseTo(0.098, 3);
    expect(below(PAPER).under).toEqual([`a job’s ring at step ${NIGHT_STEP} 0.080`]);
  });

  it.each(CANDIDATES)('%s keeps the game’s words on their own halo, its land, as readable at night as by day', (_, theme) => {
    const words = (step: number) =>
      overlayLayers(theme.game, dimmed(theme.map, step), step)
        .filter((l) => ['stops-flag-word', 'event-label', 'draft-order'].includes(l.id))
        .map((l) => {
          const paint = (l as unknown as { paint: Record<string, string> }).paint;
          return { halo: paint['text-halo-color'], ratio: contrast(paint['text-color']!, paint['text-halo-color']!) };
        });
    expect(theme.game.wordHalo).toBe(theme.map.land);
    // One ground for a resting line in each set, the night's of the roads the map mixes it with at dawn (loadMap.ts).
    expect(theme.game.restingGround).toBe(dim(theme.map.arterial, NIGHT_STEP));
    for (const step of STEPS) expect(words(step), `step ${step}`).toEqual(words(0));
    expect(Math.min(...words(0).map((w) => w.ratio))).toBeCloseTo(theme === PAPER ? 4.42 : 4.2, 2);
  });
});

describe('the network hues against a placeholder dark land and void (D13, for January’s dark set)', () => {
  // So January adds only the dark base tokens: every line colour as clear of the dark land as of the light. Seven of the eight keep
  // 0.261 from it; Line 8's slate is 0.106 from it (1.46:1), and the inks of the line being drawn and of a bus's outline, dark on
  // the light map, are 0.031 and 0.027 from it.
  it('keeps seven of the eight line colours at least 0.261 from it, and not Line 8’s slate or the two dark inks', () => {
    const fromLand = LINE_COLOURS.map((c) => distance(c, DARK_PLACEHOLDER.land));
    const fromVoid = LINE_COLOURS.map((c) => distance(c, DARK_PLACEHOLDER.void));
    expect(Math.min(...fromLand.slice(0, 7))).toBeCloseTo(0.261, 3);
    expect(fromLand.indexOf(Math.min(...fromLand.slice(0, 7)))).toBe(4); // Line 5's purple
    expect(Math.min(...fromVoid.slice(0, 7))).toBeCloseTo(0.319, 3);
    expect(LINE_COLOURS[7]).toBe('#2e4053');
    expect(fromLand[7]).toBeCloseTo(0.106, 3);
    expect(contrast(LINE_COLOURS[7]!, DARK_PLACEHOLDER.land)).toBeCloseTo(1.46, 2);
    expect(fromVoid[7]).toBeCloseTo(0.171, 3);
    expect(distance(GAME_LIGHT.draft, DARK_PLACEHOLDER.land)).toBeCloseTo(0.031, 3);
    expect(distance(BUS_INK, DARK_PLACEHOLDER.land)).toBeCloseTo(0.027, 3);
    // The game's other marks keep at least 0.337 from it.
    const others = [GAME_LIGHT.homeDot, GAME_LIGHT.jobDot, GAME_LIGHT.depotMark, GAME_LIGHT.stopFlag].map((c) => distance(c, DARK_PLACEHOLDER.land));
    expect(Math.min(...others)).toBeCloseTo(0.337, 3);
  });

  it('is V1’s dark land, and a void as far below it as the light void is below the light land', () => {
    expect(DARK_PLACEHOLDER.land).toBe('#20242e');
    const step = (land: string, below: string) => hexToOklch(land).l - hexToOklch(below).l;
    expect(step(DARK_PLACEHOLDER.land, DARK_PLACEHOLDER.void)).toBeCloseTo(step(LIGHT.land, LIGHT.void), 3);
  });
});

describe('the light a page asks for', () => {
  it('is V1’s paper for `?light=paper`, and the warm-neutral set otherwise', () => {
    expect(lightTokens('paper')).toBe(PAPER);
    expect(lightTokens(null)).toBe(WARM);
    expect(WARM).toEqual({ map: LIGHT, game: GAME_LIGHT });
  });
});
