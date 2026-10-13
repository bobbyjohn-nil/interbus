// HEADWAY contracts in the running game (the M3 spec, item 11; GD-04, I11): offers rolled at a day's
// start by the seeded RNG near landmarks not already offered or held, their asks dealt from a shuffled
// deck of the three, so every three offers hold one of each and income cannot swing between seeds as
// V2's independent draws did ($60k–$480k for comparable play, GD-04). Each held contract is checked at
// every service hour's end, and graded at the day's close: paid once as a Contracts row after
// CONTRACT_DAYS days met in a row, or dropped once the days left cannot fit them. The rule itself is
// rules/contract.ts, shared with the card and the map.
import { CONTRACT_ASKS, CONTRACT_DAYS, CONTRACT_REACH_M, CONTRACT_SLOTS } from '../config/contracts';
import { SERVICE_DAY, SECONDS_PER_HOUR } from '../config/time';
import { distXY, toXY } from '../core/geo';
import { mint } from '../core/ids';
import { contractAlive, contractMet, landmarkHeadway, stopHeadway, type ContractPeriod, type StopService } from '../rules/contract';
import { runningHeadwayIn } from '../rules/timetable';
import type { Contract } from '../state';
import type { World } from '../world';
import { post } from './ledger';

/** Each landmark's figure today: the headway at its best stop within reach, the slower of peak and off-peak, or null. */
export function landmarkHeadways(world: World): Map<string, number | null> {
  const callers = new Map<number, (typeof world.state.lines)[number][]>();
  for (const line of world.state.lines) for (const id of line.stopIds) callers.set(id, [...(callers.get(id) ?? []), line]);
  const service = new Map<number, StopService>();
  for (const stop of world.state.stops) {
    const lines = callers.get(stop.id) ?? [];
    const at = (period: ContractPeriod) =>
      stopHeadway(lines.map((l) => {
        const s = world.services.get(l.id);
        return s ? runningHeadwayIn(s.timing, period) : null;
      }));
    service.set(stop.id, { peak: at('peak'), offpeak: at('offpeak') });
  }
  const figures = new Map<string, number | null>();
  for (const landmark of world.city.landmarks) {
    const near = world.state.stops.filter((s) => distXY(toXY(world.city.frame, [s.lon, s.lat]), landmark.at) <= CONTRACT_REACH_M);
    figures.set(landmark.name, landmarkHeadway(near.map((s) => service.get(s.id)!)));
  }
  return figures;
}

/** Fills empty slots with offers at landmarks with no contract, picked by the game's RNG, each ask dealt from the deck; drops offers at landmarks the city no longer has. */
export function rollOffers(world: World, day: number): void {
  const state = world.state;
  const names = new Set(world.city.landmarks.map((l) => l.name));
  state.contracts = state.contracts.filter((c) => c.acceptedDay !== null || names.has(c.landmark));
  while (state.contracts.length < CONTRACT_SLOTS) {
    const taken = new Set(state.contracts.map((c) => c.landmark));
    const free = world.city.landmarks.filter((l) => !taken.has(l.name));
    if (free.length === 0) return;
    const landmark = state.rng.pick(free);
    if (state.contractDeck.length === 0) state.contractDeck = state.rng.shuffle(CONTRACT_ASKS.map((a) => a.askSeconds));
    const askSeconds = state.contractDeck.shift()!;
    const ask = CONTRACT_ASKS.find((a) => a.askSeconds === askSeconds)!;
    const [id, next] = mint(state.nextIds, 'contract');
    state.nextIds = next;
    state.contracts.push({ id, landmark: landmark.name, ...ask, offeredDay: day, acceptedDay: null, daysMet: 0, hoursMissedToday: 0 });
  }
}

/** At the end of a service hour (05:00–24:00), each held contract the network does not meet misses that hour. */
export function checkHour(world: World, hour: number): void {
  const start = hour * SECONDS_PER_HOUR;
  if (start < SERVICE_DAY[0] || start >= SERVICE_DAY[1]) return;
  const held = world.state.contracts.filter((c) => c.acceptedDay !== null);
  if (held.length === 0) return;
  const figures = landmarkHeadways(world);
  for (const c of held) if (!contractMet(figures.get(c.landmark) ?? null, c.askSeconds)) c.hoursMissedToday++;
}

export interface ContractOutcome {
  readonly contract: Contract;
  readonly outcome: 'paid' | 'lapsed';
}

/**
 * Grades each held contract at `day`'s close: met if no service hour missed it, so a run of days met
 * grows or starts again. One paid after CONTRACT_DAYS in a row posts its reward as a Contracts row;
 * one whose days left cannot fit the days still needed lapses. Both leave the list; the next day's
 * start rolls offers into their slots.
 */
export function closeContracts(world: World, day: number): ContractOutcome[] {
  const outcomes: ContractOutcome[] = [];
  for (const c of world.state.contracts) {
    if (c.acceptedDay === null) continue;
    c.daysMet = c.hoursMissedToday === 0 ? c.daysMet + 1 : 0;
    c.hoursMissedToday = 0;
    if (c.daysMet >= CONTRACT_DAYS) {
      post(world.state.ledger, { day, kind: 'contract', amountCents: c.rewardCents });
      outcomes.push({ contract: c, outcome: 'paid' });
    } else if (!contractAlive(c.acceptedDay, day + 1, c.daysMet)) outcomes.push({ contract: c, outcome: 'lapsed' });
  }
  const done = new Set(outcomes.map((o) => o.contract.id));
  world.state.contracts = world.state.contracts.filter((c) => !done.has(c.id));
  return outcomes;
}
