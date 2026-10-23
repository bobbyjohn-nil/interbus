// The day and night tint (PLAN §4's charm moments; §8 rule 8; D13), after V1's (`Intralines@7af45b1:src/map/MapView.tsx:341-413`):
// the light map dims toward a cool dusk from 19:00 and is day again as the service day opens at 05:00. V1 blended it every 1.5 s;
// here it moves in half-hour steps of the sim's clock and never per frame (RN-04), and MapLibre's own transition carries each
// step. Only the base dims: the game's colours stay as they are, loud on a quieter map at night (its translucent marks grow more
// opaque, overlays.ts), and the clock and the lines' fade say the time without it (D13). One generator still builds every step,
// from the light tokens dimmed (style.ts).
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { SERVICE_DAY } from '../../sim/rules/periods';
import type { MapTokens } from './tokens';

/** Steps of darkness: 0 by day, NIGHT_STEP all night. */
export const NIGHT_STEP = 4;

/** How long MapLibre carries the map from one step to the next; none with less motion asked for. */
export const DAYLIGHT_FADE_MS = 1_500;

/**
 * The share of each colour's red, green and blue, in linear light, that stays at night: a cool dusk. Measured
 * (daylight.test.ts): the darkest step keeps the base within PLAN §8's chroma limits, every opaque game colour at least 0.15
 * from each base colour it is drawn over in OKLab (0.159, the Amber line on a building, against 0.278 by day), every
 * translucent mark as drawn no nearer than the nearest by day (louder), and the labels 4.7:1 against their halos (5.8 by day).
 * A filter at 0.9 of this one, [0.45, 0.468, 0.5625], fails three: 0.147 apart, the depot land's tint nearer than by day, and
 * 4.49:1.
 */
export const NIGHT_LIGHT: readonly [number, number, number] = [0.5, 0.52, 0.625];

const HALF_HOUR = 1_800;
const DAY = 86_400;
/**
 * Dusk starts as the evening peak ends (D7's periods, rules/periods.ts), and day comes as the service day opens, when a new game
 * starts: dawn at 05:00 left a new company founded, and its first line drawn, on a map three quarters of the way to night (the
 * review of the day and night tint).
 */
const DUSK_FROM = 19 * 3_600;
const DAY_FROM = SERVICE_DAY[0];
const DAWN_FROM = DAY_FROM - (NIGHT_STEP - 1) * HALF_HOUR;

/**
 * The step of darkness at `secondOfDay`: day from 05:00 to 19:00, a step darker each half hour from 19:00, night from 20:30 to
 * 03:30, and a step lighter each half hour from 03:30.
 */
export function darkStep(secondOfDay: number): number {
  const s = ((secondOfDay % DAY) + DAY) % DAY;
  if (s >= DUSK_FROM) return Math.min(NIGHT_STEP, 1 + Math.floor((s - DUSK_FROM) / HALF_HOUR));
  if (s < DAWN_FROM) return NIGHT_STEP;
  if (s < DAY_FROM) return NIGHT_STEP - 1 - Math.floor((s - DAWN_FROM) / HALF_HOUR);
  return 0;
}

/** How much more opaque the game's translucent marks grow by night, so none comes nearer the dimmed base than the nearest does by day. */
export const LOUDER_BY_NIGHT = 0.6;

/** A translucent mark's opacity `step` steps toward night: up to 1.6 times its day's, and never past 1. */
export function louder(opacity: number, step: number): number {
  return Math.min(1, Math.round(opacity * (1 + (LOUDER_BY_NIGHT * step) / NIGHT_STEP) * 1_000) / 1_000);
}

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const encoded = (v: number) => {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

/** `hex` dimmed `step` steps toward night: each channel keeps its share of NIGHT_LIGHT, in linear light, in proportion. */
export function dim(hex: string, step: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  const t = step / NIGHT_STEP;
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c, i) => encoded(linear(c) * (1 - t + t * NIGHT_LIGHT[i]!)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Every base token dimmed `step` steps toward night. */
export function dimmed<T extends object>(tokens: T, step: number): T {
  return Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, typeof v === 'string' ? dim(v, step) : v])) as T;
}

/** A paint property that changes with the light: its layer, its name, and its value at each step from day to night. */
export interface DaylightPaint {
  readonly layer: string;
  readonly property: string;
  readonly values: readonly unknown[];
}

/**
 * What changes with the light in a style built from dimmed tokens (`build`), step by step: every paint property whose value is
 * not the same at every step, which is every colour the tokens give and nothing else, as only the tokens change.
 */
export function daylightPaints(build: (tokens: MapTokens) => StyleSpecification, tokens: MapTokens): DaylightPaint[] {
  const steps = Array.from({ length: NIGHT_STEP + 1 }, (_, step) => build(dimmed(tokens, step)).layers);
  return paintsAcross(steps);
}

/** The paints that differ among `steps`, each the same layers in the same order. */
export function paintsAcross(steps: readonly (readonly LayerSpecification[])[]): DaylightPaint[] {
  const first = steps[0] ?? [];
  return first.flatMap((layer, i) => {
    const paint = (layer as { paint?: Record<string, unknown> }).paint ?? {};
    return Object.keys(paint).flatMap((property) => {
      const values = steps.map((layers) => ((layers[i] as { paint?: Record<string, unknown> }).paint ?? {})[property]);
      const same = values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]));
      return same ? [] : [{ layer: layer.id, property, values }];
    });
  });
}
