// City events (the M4 spec, item 2; PLAN §3), one at a time, each rolled a day before it starts so a
// company can plan around it. V2's rates (`Intralines_City_dep@archive/intralines-city-v1:
// Gaming/src/10-core.js:276-285`, `Gaming/src/30-sim.js:46`); fuel shock is out with fuel (PLAN §2).
// Roadworks come first; festival and snow are below the cut's second item.

export const EVENT_KINDS = ['roadworks'] as const;
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
