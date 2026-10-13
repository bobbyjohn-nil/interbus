// Founding (the M2 spec's exit check, step 1): the player names and colours the company once, before
// anything else. One predicate for the founding card and the command (GD-05).
import { ok, refuse, type Result } from '../core/result';

export const COMPANY_NAME_MAX = 32;
/** The colours a company can found in: V1's hue family, each loud on the quiet base (PLAN §8 rule 1). */
export const COMPANY_COLOURS: readonly string[] = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#117a65'];

export type FoundingRefusal = 'already_founded' | 'name_empty' | 'name_too_long' | 'colour_not_offered';

/** Whether a company may be founded as `name` in `colour`, given the name it has (empty until founded). */
export function checkFounding(current: string, name: string, colour: string): Result<{ name: string }, FoundingRefusal, { limit?: number }> {
  if (current !== '') return refuse('already_founded');
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return refuse('name_empty');
  if ([...trimmed].length > COMPANY_NAME_MAX) return refuse('name_too_long', { limit: COMPANY_NAME_MAX });
  if (!COMPANY_COLOURS.includes(colour)) return refuse('colour_not_offered');
  return ok({ name: trimmed });
}
