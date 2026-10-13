// Takes a HEADWAY contract on offer (the M3 spec, item 11): a click, nothing paid. From today its
// days are counted at each close (economy/contracts.ts).
import { toCalendarTime } from '../core/calendar';
import type { ContractId } from '../core/ids';
import { checkAccept, type AcceptRefusal } from '../rules/contract';
import type { Result } from '../core/result';
import type { World } from '../world';

export function acceptContract(world: World, id: ContractId): Result<object, AcceptRefusal> {
  const contract = world.state.contracts.find((c) => c.id === id);
  const verdict = checkAccept(contract);
  if (!verdict.ok) return verdict;
  contract!.acceptedDay = toCalendarTime(world.state.elapsed).day;
  contract!.daysMet = 0;
  contract!.hoursMissedToday = 0;
  return verdict;
}
