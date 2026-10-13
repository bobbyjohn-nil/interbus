// Hourly congestion's config rows (the M3 spec, item 15; PLAN cut 8, R10, K06): V2's rush curve and
// its road classes' weights (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/10-core.js:171-177`),
// the classes mapped from OSM's highway values, which the bake keeps on every street.

/** V2's rush curve: [hour, factor] points, straight between them; traffic/congestion.ts normalises it. */
export const RUSH_CURVE: readonly (readonly [number, number])[] = [
  [0, 0.9],
  [6, 1.1],
  [7.5, 1.45],
  [9, 1.15],
  [12, 1.05],
  [16, 1.2],
  [17.5, 1.52],
  [19, 1.15],
  [22, 0.95],
  [24, 0.9],
];

/**
 * How much of the rush a street takes, by OSM class: V2's motorway 1.35, arterial 1.15 and collector
 * 0.55, read as motorway and trunk, primary and secondary, and tertiary; every other street, as V2's
 * local, 0.18 (STREET_RUSH).
 */
export const CLASS_RUSH: Readonly<Record<string, number>> = {
  motorway: 1.35,
  motorway_link: 1.35,
  trunk: 1.35,
  trunk_link: 1.35,
  primary: 1.15,
  primary_link: 1.15,
  secondary: 1.15,
  secondary_link: 1.15,
  tertiary: 0.55,
  tertiary_link: 0.55,
};
export const STREET_RUSH = 0.18;

/** The founding recipe's line runs on main streets: primary and secondary's weight (economy/starter.ts). */
export const STARTER_RUSH = CLASS_RUSH.primary!;
