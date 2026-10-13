// Line tool rows (the M2 spec, items 3 and 4). Stops snap to the street graph and join a stop
// already standing nearby (EC-10; V2's `STOP_SNAP_EXISTING_M`,
// `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/10-core.js:108`).

/** A click within this distance of an existing stop joins it, as a transfer. */
export const STOP_JOIN_M = 250;
/** A new stop stands on the nearest street node within this distance of the click (a tunable). */
export const STOP_STREET_REACH_M = 150;
/** A line needs at least this many stops. */
export const MIN_LINE_STOPS = 2;
/** Founding headways: peak and off-peak alike, overnight off (D7). */
export const FOUNDING_HEADWAYS = { peak: 1_200, offpeak: 1_200, overnight: null } as const;
/** Line colours in order of creation; the line card can change them later. */
export const LINE_COLOURS: readonly string[] = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#117a65', '#a04000', '#2e4053'];
/** A stop inserted into a line goes into the leg nearest the click, which must be within this distance of the leg's streets (the M4 spec, item 4). */
export const INSERT_REACH_M = 300;
/** An insertion lengthening its leg by more than this share warns on the card, never blocks (V2's LINE_DETOUR_WARN_SHARE). */
export const DETOUR_WARN_SHARE = 0.15;
