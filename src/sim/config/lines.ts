// Line tool rows (the M2 spec, items 3 and 4). Stops snap to the street graph and join a stop
// already standing nearby (EC-10; V2's `STOP_SNAP_EXISTING_M`,
// `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/10-core.js:108`).

/** A click within this distance of an existing stop joins it, as a transfer. */
export const STOP_JOIN_M = 250;
/** A new stop stands on the nearest street node within this distance of the click (a tunable). */
export const STOP_STREET_REACH_M = 150;
/**
 * Street classes no stop or depot stands on: motorways and every ramp. A click by the Mass Pike or
 * the I-93 tunnel put its stop on the highway, so its buses drove to the next exit and back: 8.6 km
 * for a 271 m leg in Back Bay (DECISIONS, Measured, 2026-10-14). Buses still drive these streets
 * between stops.
 */
export const NO_STOP_CLASSES: ReadonlySet<string> = new Set(['motorway', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
/**
 * Whether buses keep to one-way streets. They do not: a line runs both ways along the streets the
 * player picks, and the way back already drove the way out in reverse (rules/position.ts), so
 * keeping one-way streets on the way out only sent buses round the block. Back Bay legs over twice
 * the straight line fell from 29% to 2% (DECISIONS, Measured, 2026-10-14).
 */
export const BUSES_KEEP_ONE_WAY = false;
/** A line needs at least this many stops. */
export const MIN_LINE_STOPS = 2;
/** Founding headways: peak and off-peak alike, overnight off (D7). */
export const FOUNDING_HEADWAYS = { peak: 1_200, offpeak: 1_200, overnight: null } as const;
/** The headways the line card offers, in minutes, and so the ones I3's full sweep tries (the M4 spec, item 5). */
export const HEADWAY_MINUTES: readonly number[] = [5, 6, 8, 10, 12, 15, 20, 30, 45, 60];
/** Line colours in order of creation; the line card can change them later. */
export const LINE_COLOURS: readonly string[] = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#117a65', '#a04000', '#2e4053'];
/** A stop inserted into a line goes into the leg nearest the click, which must be within this distance of the leg's streets (the M4 spec, item 4). */
export const INSERT_REACH_M = 300;
/** An insertion lengthening its leg by more than this share warns on the card, never blocks (V2's LINE_DETOUR_WARN_SHARE). */
export const DETOUR_WARN_SHARE = 0.15;
