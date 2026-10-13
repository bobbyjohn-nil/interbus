// Founds the company (the M2 spec's exit check, step 1): its name and colour, once. Its money is the
// founding capital row a new game already holds (D7). Day 1's contract offers are rolled now.
import { ok, type Result } from '../core/result';
import { rollOffers } from '../economy/contracts';
import { checkFounding, type FoundingRefusal } from '../rules/company';
import type { World } from '../world';

export function found(world: World, name: string, colour: string): Result<object, FoundingRefusal, { limit?: number }> {
  const verdict = checkFounding(world.state.company.name, name, colour);
  if (!verdict.ok) return verdict;
  world.state.company = { name: verdict.name, colour };
  rollOffers(world, 1); // day 1's contract offers (the M3 spec, item 11)
  return ok();
}
