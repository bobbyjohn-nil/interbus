// Bus models and the timetable's fixed times, as config rows (C01). V1's numbers
// (`Intralines@7af45b1:src/game/constants.ts:161-233`) unless noted. M2 has the Sparrow alone; the
// Metro 40 and Goliath rows land in week 5 (PLAN §10).

export interface BusModel {
  readonly id: 'sparrow';
  readonly name: string;
  readonly seats: number;
  readonly priceCents: number;
  /** Cruising speed along a route, km/h. */
  readonly kmh: number;
  /** Running cost per km, cents. V1's `costPerKm`, which already includes fuel. */
  readonly perKmCents: number;
}

export const SPARROW: BusModel = { id: 'sparrow', name: 'Sparrow', seats: 28, priceCents: 9_500_000, kmh: 26, perKmCents: 90 };

/** A bus waits this long at each end of its route before turning back (V1, demand.worker.ts:211-219). */
export const LAYOVER_SECONDS = 240;
