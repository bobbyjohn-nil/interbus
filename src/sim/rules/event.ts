// A city event's phase (the M4 spec, item 2): pending from the day it is rolled until it starts the
// next day, on from its first day to its last, then over. One predicate for the map's marker (hatched
// while pending, solid while on), the day card's notice and the round trips the sim times (GD-05).

export type EventPhase = 'pending' | 'on' | 'over';

/** An event's days, both ends included. */
export interface EventDays {
  readonly startDay: number;
  readonly endDay: number;
}

export function eventPhase(e: EventDays, day: number): EventPhase {
  return day < e.startDay ? 'pending' : day <= e.endDay ? 'on' : 'over';
}

/** Days it is still on, today included while it is on; all its days while pending; 0 once over. */
export function eventDaysLeft(e: EventDays, day: number): number {
  return Math.max(0, e.endDay - Math.max(day, e.startDay) + 1);
}

/** The street edges roadworks hold on `day`: their stretch while they are on, else none. */
export function worksOn(e: (EventDays & { readonly kind: string; readonly edges: readonly number[] }) | null, day: number): ReadonlySet<number> | null {
  return e && e.kind === 'roadworks' && eventPhase(e, day) === 'on' && e.edges.length > 0 ? new Set(e.edges) : null;
}
