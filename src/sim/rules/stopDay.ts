// A stop's flags (the M3 spec, item 5): one predicate for the map's ring and word, the stop card and
// the stop's day (economy/stops.ts, GD-05).
import { STOP_LOSS_CENTS, STOP_QUIET_BOARDINGS } from '../config/economy';

export { STOP_LOSS_CENTS, STOP_QUIET_BOARDINGS };

/** QUIET under 5 boardings a day at a stop a line calls at (one standing alone is waiting for a line, D25); LOSS under −$20 a day. */
export function stopFlags(boardings: number, netCents: number, served = true): { readonly quiet: boolean; readonly loss: boolean } {
  return { quiet: served && boardings < STOP_QUIET_BOARDINGS, loss: netCents < STOP_LOSS_CENTS };
}
