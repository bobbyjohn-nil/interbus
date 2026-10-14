import { readFileSync } from 'node:fs';
import { loadCity, type City } from '../src/sim/city/simfile';
import { toLngLat } from '../src/sim/core/geo';
import { dotRadiusPx } from '../src/render/map/pick';
import { city } from './shell';

/** The fixture's sim file, as the page plays it. */
export function fixtureCity(): City {
  const loaded = loadCity(readFileSync(`public/cities/${city.sim!.file}`, 'utf8'));
  if (!loaded.ok) throw new Error(loaded.problem);
  return loaded.city;
}

export interface ScreenDot {
  readonly kind: 'home' | 'job';
  /** Where the sim puts it, as the worker sends it (host.ts dotsOf). */
  readonly at: [number, number];
  readonly w: number;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Every demand dot on screen, flat and facing north, with its drawn radius at `zoom` (pick.ts). */
export function screenDots(c: City, project: (at: readonly [number, number]) => [number, number], zoom: number): ScreenDot[] {
  return c.cells.flatMap((cell) =>
    (['home', 'job'] as const).flatMap((kind) =>
      (kind === 'home' ? cell.homes : cell.work).map((p) => {
        const at = [...toLngLat(c.frame, [p.x, p.y])] as [number, number];
        const [x, y] = project(at);
        return { kind, at, w: p.w, x, y, r: dotRadiusPx(p.w, zoom) };
      }),
    ),
  );
}

/** Within the middle of the map's box, away from the chip row, the dock and the corner. */
export const inMiddle = (box: { x: number; y: number; width: number; height: number }) => (p: { x: number; y: number }) =>
  p.x > box.x + box.width * 0.3 && p.x < box.x + box.width * 0.7 && p.y > box.y + box.height * 0.3 && p.y < box.y + box.height * 0.65;

/** How far `p` is from the edge of the nearest dot's circle, of those in `dots`. */
export const gapTo = (dots: readonly ScreenDot[], p: { x: number; y: number }) => Math.min(...dots.map((d) => Math.hypot(d.x - p.x, d.y - p.y) - d.r));
