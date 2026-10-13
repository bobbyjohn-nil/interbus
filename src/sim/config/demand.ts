// Demand config rows, V1's numbers (`Intralines@7af45b1:src/game/constants.ts`, R01) unless noted.
// M1 uses V1's β; the r1 bake fits β to LODES in week 5 (PLAN §5).
import { SPARROW } from './fleet';

/** Gravity decay length (V1's worker default, demand.worker.ts:93; the spec's call). */
export const GRAVITY_BETA_KM = 4;
/** Jobs beyond this pull no commuters (demand.worker.ts:164). */
export const GRAVITY_CUTOFF_KM = 45;
/** Walking pace, and how far anyone walks to a stop (constants.ts:124-125). */
export const WALK_MIN_PER_KM = 12;
export const MAX_WALK_M = 650;
/** A stop's dwell (constants.ts:115). */
export const DWELL_SEC = 20;
/** Riders ride at the bus model's pace, as V1 did (constants.ts:170); the Sparrow until week 5's models. */
export const BUS_KMH = SPARROW.kmh;
/** Driving: average speed, the detour and traffic factor, and the parking hunt (demand.worker.ts:93, 486; constants.ts:127). */
export const CAR_KMH = 35;
export const CAR_TIME_FACTOR = 1.3;
export const CAR_PARK_PENALTY_MIN = 10;
/** Commuters with no car, who ride whenever service is usable (constants.ts:129). */
export const CAPTIVE_SHARE = 0.13;
/** The bus–car logit's scale and temperature, in minutes (demand.worker.ts:489; constants.ts:131). */
export const LOGIT_SCALE = 0.92;
export const MODE_TAU_MIN = 9;
/** The most a mode share reaches (demand.worker.ts:491). */
export const MAX_SHARE = 0.9;
/** Nobody takes a bus trip longer than this, door to door (demand.worker.ts:482). */
export const MAX_TRANSIT_MIN = 75;
/** Waits: 70% of riders time the stop and wait 2 min; 30% turn up and wait half a headway; neither waits more than 15 (constants.ts:132, EC-08). */
export const TIMED_RIDER_SHARE = 0.7;
export const TIMED_WAIT_MIN = 2;
export const MAX_WAIT_MIN = 15;
/** The reference fare and the minutes a dollar is worth (constants.ts:418-420): each boarding's fare beyond $2.25 feels like extra ride time (K05). */
export const REFERENCE_FARE_CENTS = 225;
export const CENTS_PER_MINUTE = 18;

/**
 * Commute trips by clock hour, 00–23 (constants.ts:155-159). V1's sums to 1.001, so it is
 * normalised here to sum to exactly 1.
 */
const V1_HOURLY = [
  0.002, 0.001, 0.001, 0.002, 0.006, 0.02, 0.055, 0.095, 0.085, 0.055, 0.045, 0.045, 0.05, 0.048, 0.05, 0.065, 0.09, 0.1, 0.07, 0.045,
  0.032, 0.022, 0.012, 0.005,
];
const V1_SUM = V1_HOURLY.reduce((s, v) => s + v, 0);
export const HOURLY_PROFILE: readonly number[] = V1_HOURLY.map((v) => v / V1_SUM);
