// Bus models and the timetable's fixed times, as config rows (C01). V1's numbers, the same in V1, V2
// and V3 (`Intralines@7af45b1:src/game/constants.ts:161-233`) unless noted. A line runs one model
// (the M3 spec, item 2), so its speed, seats and cost are one row's, never V1's averaged mixed fleet.
import type { MedalId } from './medals';

export const MODEL_IDS = ['sparrow', 'metro40', 'goliath'] as const;
export type BusModelId = (typeof MODEL_IDS)[number];

export interface BusModel {
  readonly id: BusModelId;
  readonly name: string;
  readonly seats: number;
  readonly priceCents: number;
  /** Cruising speed along a route, km/h. */
  readonly kmh: number;
  /** Running cost per km, cents. V1's `costPerKm`, which already includes fuel. */
  readonly perKmCents: number;
  /** For sale only once this medal is held: the Goliath waits for silver (PLAN §3; rules/medal.ts modelLocked). */
  readonly unlockedBy: MedalId | null;
}

export const SPARROW: BusModel = { id: 'sparrow', name: 'Sparrow', seats: 28, priceCents: 9_500_000, kmh: 26, perKmCents: 90, unlockedBy: null };
export const METRO_40: BusModel = { id: 'metro40', name: 'Metro 40', seats: 70, priceCents: 26_000_000, kmh: 25, perKmCents: 150, unlockedBy: null };
export const GOLIATH: BusModel = { id: 'goliath', name: 'Goliath', seats: 115, priceCents: 44_000_000, kmh: 23, perKmCents: 220, unlockedBy: 'silver' };
export const BUS_MODELS: Readonly<Record<BusModelId, BusModel>> = { sparrow: SPARROW, metro40: METRO_40, goliath: GOLIATH };

/** A bus sold back fetches half its price (V1's resale, `Intralines@7af45b1:src/game/store.ts`, without wear: wear is out, PLAN §3). */
export const RESALE_PERMILLE = 500;

/** A bus waits this long at each end of its route before turning back (V1, demand.worker.ts:211-219). */
export const LAYOVER_SECONDS = 240;

/** A driver's wage for each hour a bus is in service (V1 `DRIVER_WAGE_PER_HOUR`, constants.ts:110-113); a parked bus costs only its depot's upkeep. */
export const WAGE_CENTS_PER_HOUR = 2_600;

/** A bus with longer than this to wait at its first stop goes back to the depot instead (a tunable). */
export const IDLE_HOME_SECONDS = 3_600;
