// The owner's Nov 8 light token pick (PLAN §8, D13): the starting warm-neutral tokens or pure V1 paper, side by side on Boston,
// with the network hues checked against the light set and a placeholder dark land and void. What each candidate measures, so the
// numbers DECISIONS gives the owner stay true of the colours `?light=paper` draws (Measured, 2026-10-23). The warm set's rules as
// it ships are daylight.test.ts's; here it stands beside V1's paper.
import { describe, expect, it } from 'vitest';
import { LINE_COLOURS } from '../../sim/rules/line';
import { dimmed, NIGHT_STEP } from './daylight';
import { hexToOklch } from './oklch';
import { overlayLayers } from './overlays';
import { blend, contrast, distance } from './testing';
import { DARK_PLACEHOLDER, GAME_LIGHT, LIGHT, lightTokens, PAPER, V1_PAPER, WARM, type LightTokens, type MapTokens } from './tokens';

const STEPS = Array.from({ length: NIGHT_STEP + 1 }, (_, step) => step);
const CANDIDATES: [string, LightTokens][] = [['the warm-neutral set', WARM], ['V1’s paper', PAPER]];

/** V1's palette as V1 wrote it (`Intralines@7af45b1:src/map/basemapStyle.ts:9-32`, and the colours its layers wrote inline). */
const V1 = {
  land: '#f3edda',
  water: '#8ec8ee',
  park: '#b7dd9a', // at 0.7
  wood: '#a3d18c', // at 0.55
  commercial: '#f4e3cf', // at 0.5
  industrial: '#e4e0e8', // at 0.5
  building3d: '#e6dac4', // at 0.86, its only buildings
  primary: '#fdd8a2',
  primaryCasing: '#e4b56e',
  tertiary: '#fff3d9',
  street: '#ffffff',
  streetCasing: '#d8cfba',
  aeroway: '#e8e4da', // its runways, inline at :124
  label: '#4a4636',
  labelHalo: '#fffcf0', // rgba(255,252,240,0.85)
  suburbLabel: '#8a7f63', // inline at :335
  waterLabel: '#3d6f9e', // inline at :313
  mask: '#75746e', // overlays.ts:98
  maskEdge: '#3c3728', // overlays.ts:107
};

/** PLAN §8 rule 1: the tokens over its base chroma (0.04; water and its names 0.07). */
const loud = (tokens: MapTokens) =>
  Object.entries(tokens)
    .filter(([name, hex]) => hexToOklch(hex).c > (name === 'water' || name === 'waterLabel' ? 0.07 : 0.04))
    .map(([name]) => name);

describe('V1’s paper (the Nov 8 pick’s other candidate)', () => {
  it('draws each colour as V1 drew it: a translucent fill as its blend over V1’s land, the rest as V1 wrote them', () => {
    const v = V1_PAPER;
    expect([v.park, v.wood, v.buildingFill, v.hospital, v.school, v.industrial, v.labelHalo]).toEqual([
      blend(V1.park, 0.7, V1.land),
      blend(V1.wood, 0.55, V1.land),
      blend(V1.building3d, 0.86, V1.land),
      blend(V1.commercial, 0.5, V1.land),
      blend(V1.commercial, 0.5, V1.land),
      blend(V1.industrial, 0.5, V1.land),
      blend(V1.labelHalo, 0.85, V1.land),
    ]);
    expect(v).toMatchObject({
      void: V1.land,
      land: V1.land,
      water: V1.water,
      street: V1.street,
      streetCasing: V1.streetCasing,
      arterial: V1.primary,
      arterialCasing: V1.primaryCasing,
      path: V1.tertiary,
      aerodrome: V1.aeroway,
      buildingOutline: V1.streetCasing,
      boundary: V1.streetCasing,
      mask: V1.mask,
      maskEdge: V1.maskEdge,
      label: V1.label,
      labelMinor: V1.suburbLabel,
      waterLabel: V1.waterLabel,
    });
    // The game's own words stand on V1's land; every other game colour is the warm set's.
    expect(PAPER.game).toEqual({ ...GAME_LIGHT, wordHalo: V1.land });
  });

  it('breaks PLAN §8 rule 1 in seven colours by day, and in six at every step of the light after, where the warm set breaks none', () => {
    expect(loud(V1_PAPER)).toEqual(['water', 'park', 'wood', 'arterial', 'arterialCasing', 'labelMinor', 'waterLabel']);
    expect(hexToOklch(V1_PAPER.arterialCasing).c).toBeCloseTo(0.104, 3);
    for (const step of STEPS.slice(1)) expect(loud(dimmed(V1_PAPER, step)), `step ${step}`).toEqual(['water', 'park', 'wood', 'arterial', 'arterialCasing', 'waterLabel']);
    for (const step of STEPS) expect(loud(dimmed(LIGHT, step)), `step ${step}`).toEqual([]);
  });
});

describe('both candidates at every step of the light', () => {
  it.each(CANDIDATES)('%s keeps its names readable on their halos: 4.5:1 for the names, 3:1 for the minor ones', (_, { map }) => {
    for (const step of STEPS) {
      const t = dimmed(map, step);
      expect(contrast(t.label, t.labelHalo), `step ${step}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.labelMinor, t.labelHalo), `step ${step}`).toBeGreaterThanOrEqual(3);
    }
  });

  // The network hues against each light set (D13): the opaque marks against every base colour they are drawn over, as
  // daylight.test.ts holds the warm set, 0.15 apart in OKLab. V1's paper holds it by day, nearest the Amber line on its wood
  // (0.272); at night four pairs come nearer, where its louder base dims toward the lines' own hues.
  it('keeps every opaque game colour 0.15 clear of its base by day on both, and at night on the warm set only', () => {
    const ground: (keyof MapTokens)[] = ['land', 'street', 'arterial', 'buildingFill', 'park', 'wood', 'path', 'hospital', 'school', 'industrial'];
    const near = (map: MapTokens, step: number) => {
      const base = dimmed(map, step);
      const game: [string, string, (keyof MapTokens)[]][] = [
        ...LINE_COLOURS.map((c, k): [string, string, (keyof MapTokens)[]] => [`line ${k + 1}`, c, [...ground, 'water']]),
        ['the line being drawn', GAME_LIGHT.draft, [...ground, 'water']],
        ['a bus’s ink', '#292624', [...ground, 'water']],
        ['depotMark', GAME_LIGHT.depotMark, ground],
        ['stopFlag', GAME_LIGHT.stopFlag, ground],
      ];
      return game.flatMap(([name, colour, under]) => under.map((b) => ({ pair: `${name} on ${b}`, d: distance(colour, base[b]) })));
    };
    const under = (map: MapTokens, step: number) => near(map, step).filter((p) => p.d < 0.15).map((p) => `${p.pair} ${p.d.toFixed(3)}`);
    for (const step of STEPS) expect(under(LIGHT, step), `warm, step ${step}`).toEqual([]);
    expect(Math.min(...near(V1_PAPER, 0).map((p) => p.d))).toBeCloseTo(0.272, 3);
    for (const step of STEPS.slice(0, -1)) expect(under(V1_PAPER, step), `paper, step ${step}`).toEqual([]);
    expect(under(V1_PAPER, NIGHT_STEP)).toEqual(['line 2 on water 0.131', 'line 4 on arterial 0.128', 'line 4 on park 0.149', 'line 4 on wood 0.146']);
  });

  // The translucent marks as the map draws them (overlays.ts' opacities at each step), blended over the base: daylight.test.ts
  // holds the warm set's no nearer at night than its nearest by day, the depot land's tint on a building (0.092). On V1's paper
  // a job's ring over water comes to 0.080 at night, under that set's own nearest by day (0.098).
  it('keeps every translucent mark as far from its base at night as by day on the warm set, and not a job’s ring over V1’s water', () => {
    const nearest = ({ map, game }: LightTokens, step: number) => {
      const layers = overlayLayers(game, dimmed(map, step), step);
      const base = dimmed(map, step);
      const alpha = (id: string, property: string) => (layers.find((l) => l.id === id) as unknown as { paint: Record<string, number> }).paint[property]!;
      const ring = distance(blend(game.jobDot, alpha('dots-jobs', 'circle-stroke-opacity'), base.water), base.water);
      const tint = Math.min(...(['land', 'industrial', 'buildingFill', 'street'] as const).map((b) => distance(blend(game.depotLand, alpha('depot-land-fill', 'fill-opacity'), base[b]), base[b])));
      return { ring, tint };
    };
    expect(nearest(WARM, 0).tint).toBeCloseTo(0.092, 3);
    expect(nearest(WARM, NIGHT_STEP).ring).toBeCloseTo(0.127, 3);
    expect(nearest(PAPER, 0).tint).toBeCloseTo(0.098, 3);
    expect(nearest(PAPER, NIGHT_STEP).ring).toBeCloseTo(0.08, 3);
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
    for (const step of STEPS) expect(words(step), `step ${step}`).toEqual(words(0));
    expect(Math.min(...words(0).map((w) => w.ratio))).toBeCloseTo(theme === PAPER ? 4.42 : 4.2, 2);
  });
});

describe('the network hues against a placeholder dark land and void (D13, for January’s dark set)', () => {
  // So January adds only the dark base tokens: every line colour as clear of the dark land as of the light. Seven of the eight
  // keep 0.26 from it; Line 8's slate is 0.106 from it (1.46:1), so the dark set needs Line 8 lighter or a colour of its own.
  it('keeps seven of the eight line colours at least 0.26 from it, and Line 8’s slate 0.106', () => {
    const fromLand = LINE_COLOURS.map((c) => distance(c, DARK_PLACEHOLDER.land));
    const fromVoid = LINE_COLOURS.map((c) => distance(c, DARK_PLACEHOLDER.void));
    expect(Math.min(...fromLand.slice(0, 7))).toBeCloseTo(0.261, 3);
    expect(Math.min(...fromVoid.slice(0, 7))).toBeGreaterThan(0.3);
    expect(LINE_COLOURS[7]).toBe('#2e4053');
    expect(fromLand[7]).toBeCloseTo(0.106, 3);
    expect(contrast(LINE_COLOURS[7]!, DARK_PLACEHOLDER.land)).toBeCloseTo(1.46, 2);
    expect(fromVoid[7]).toBeCloseTo(0.171, 3);
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
