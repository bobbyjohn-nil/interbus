// Medals (the M4 spec, item 3; PLAN §3: three for Boston, and silver unlocks the Goliath). No earlier
// version had medals, so the ladder is new and the owner's call (DECISIONS, Open); these are the
// recommended bars until the owner answers, each one the game already measures. Week 9's pacing
// script tunes them to PLAN's 2–4 hours to gold.
import { REPORT_GRANT_THRESHOLD } from './report';

export const MEDAL_IDS = ['bronze', 'silver', 'gold'] as const;
export type MedalId = (typeof MEDAL_IDS)[number];

/** Bronze: a quarter's report card at this overall or more, the grant's bar (config/report.ts). */
export const BRONZE_OVERALL = REPORT_GRANT_THRESHOLD;

/**
 * Silver: this many trips carried since founding. Trips, not boardings: a change onto a second line
 * boards free (EC-04), so a paid boarding is one trip, and a split line cannot reach it at half the
 * riders (V3's fix, `Intralines_City@dc63602:studio/docs/design/fleet-and-staff.md:22-40`; V1 and V2
 * counted 25,000 boardings).
 */
export const SILVER_TRIPS = 25_000;

/** Gold: a quarter graded this overall or more, no grade under GOLD_GRADE_MIN, on a closing day that carried GOLD_TRIPS_PER_DAY trips. */
export const GOLD_OVERALL = 75;
export const GOLD_GRADE_MIN = 60;
export const GOLD_TRIPS_PER_DAY = 5_000;
