// City events (the M4 spec, item 2; PLAN §3), one at a time, each rolled a day before it starts so a
// company can plan around it. V2's rates (`Intralines_City_dep@archive/intralines-city-v1:
// Gaming/src/10-core.js:276-285`, `Gaming/src/30-sim.js:46`); fuel shock is out with fuel (PLAN §2).
// Each roll picks its kind evenly, as V2 did (`Gaming/src/30-sim.js:4592-4600`).

export const EVENT_KINDS = ['roadworks', 'festival', 'snow'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** The chance a day's start rolls an event, when none is pending, on, or within the gap after one. */
export const EVENT_CHANCE_PER_DAY = 0.18;
/** Days after an event ends on which no other is rolled. */
export const EVENT_GAP_DAYS = 2;
/** An event is rolled this many days before it starts: "Roadworks tomorrow". */
export const EVENT_WARN_DAYS = 1;

/** How long roadworks last, in whole days, both ends included. */
export const ROADWORKS_DAYS: readonly [number, number] = [3, 6];
/** A bus drives through roadworks at this share of its speed (V2's slowdown of 0.35). */
export const ROADWORKS_SPEED = 0.65;
/** The longest stretch of one named street roadworks take, metres. */
export const ROADWORKS_MAX_M = 400;

/** How long a festival lasts, in whole days (V2's, `Gaming/src/10-core.js:276-285`). */
export const FESTIVAL_DAYS: readonly [number, number] = [1, 2];
/** A festival draws more riders to and from cells within this many metres of its stop (V2's 900 m). */
export const FESTIVAL_RADIUS_M = 900;
/** And this many times as many (V2's ×2.6, `Gaming/src/30-sim.js:4617-4660`). */
export const FESTIVAL_DEMAND = 2.6;

/** How long snow lasts, in whole days (V2's). */
export const SNOW_DAYS: readonly [number, number] = [1, 2];
/** In snow every bus drives at this share of its speed, on top of the hour's traffic (V2's ÷0.72 on congestion, `Gaming/src/10-core.js:766-785`). Riders' own rides keep the street's speed, as under roadworks. */
export const SNOW_SPEED = 0.72;

/** Days each kind lasts, both ends included. */
export const EVENT_DAYS: Readonly<Record<EventKind, readonly [number, number]>> = { roadworks: ROADWORKS_DAYS, festival: FESTIVAL_DAYS, snow: SNOW_DAYS };
