// The one list of cities, read by the game, the deploy and the bake alike (K18).
import registry from '../cities/index.json';

export type LonLat = readonly [number, number];
/** West, south, east, north in degrees. */
export type Bbox = readonly [number, number, number, number];

export interface CityTiles {
  /** File name under cities/, content-hashed. */
  readonly file: string;
  /** Where the deploy downloads it from (a GitHub release asset). */
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly source: string;
  readonly maxzoom: number;
}

/** A city's sim.json (PLAN §5 "Pack"), published by the City sim file workflow. */
export interface CitySim {
  readonly file: string;
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
  /** Which gate profile it was baked to: the fixture until the week-3 bake. */
  readonly extent: string;
}

export interface City {
  readonly id: string;
  readonly name: string;
  /** The play area (D11: Inner Boston). */
  readonly extent: Bbox;
  readonly view: { readonly center: LonLat; readonly zoom: number };
  readonly tiles: CityTiles | null;
  readonly sim: CitySim | null;
}

export const CITIES: readonly City[] = registry.cities as unknown as City[];

/** The camera may wander 1.5 km beyond the play area (PLAN §6). */
export function paddedBounds(extent: Bbox, metres = 1500): Bbox {
  const [w, s, e, n] = extent;
  const dLat = metres / 111_320;
  const dLon = metres / (111_320 * Math.cos((((s + n) / 2) * Math.PI) / 180));
  return [w - dLon, s - dLat, e + dLon, n + dLat];
}
