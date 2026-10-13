// A fare change (the M3 spec, item 4): any 25¢ step from $1.00 to $5.00, free, felt by riders from
// the recompute it triggers and banked at the new fare from the next hour's rows.
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { checkFare, type FareRefusal } from '../rules/fare';
import { recompute, type World } from '../world';

export function setFare(world: World, lineId: LineId, fareCents: number): Result<object, FareRefusal | 'no_such_line', { limit?: number }> {
  const line = world.state.lines.find((l) => l.id === lineId);
  if (!line) return refuse('no_such_line');
  const verdict = checkFare(line.fareCents, fareCents);
  if (!verdict.ok) return verdict;
  line.fareCents = fareCents;
  recompute(world);
  return ok({});
}
