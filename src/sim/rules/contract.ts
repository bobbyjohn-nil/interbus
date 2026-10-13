// HEADWAY contracts (the M3 spec, item 11; I11): one predicate for whether a landmark is served as
// often as a contract asks, read by the contract card, the day's grading and the ring on the map
// (GD-05). A stop's headway in a period is every line calling there together, as riders scanning the
// stop see it (1 ÷ Σ 1/h); a landmark's figure is the best stop within its reach, at the slower of
// its peak and off-peak, so no contract is met by one period alone (I11; V2 averaged 16 hours across
// lines, so a line every 5 minutes at peak and hourly otherwise met a 15-minute contract).
import { CONTRACT_DAYS, CONTRACT_WINDOW_DAYS } from '../config/contracts';
import { ok, refuse, type Result } from '../core/result';

/** The periods a contract reads: the two that always run (D7). Overnight counts toward nothing but Coverage. */
export const CONTRACT_PERIODS = ['peak', 'offpeak'] as const;
export type ContractPeriod = (typeof CONTRACT_PERIODS)[number];

/** The headway at a stop from the running headways of the lines calling there, or null if none runs. */
export function stopHeadway(lineHeadways: readonly (number | null)[]): number | null {
  let perSecond = 0;
  for (const h of lineHeadways) if (h !== null && h > 0) perSecond += 1 / h;
  return perSecond > 0 ? 1 / perSecond : null;
}

/** One stop within a landmark's reach: its headway in each period the contract reads. */
export type StopService = Readonly<Record<ContractPeriod, number | null>>;

/** Today's figure for a landmark: at its best stop, the slower of peak and off-peak; null if no stop in reach is served in both. */
export function landmarkHeadway(stops: readonly StopService[]): number | null {
  let best: number | null = null;
  for (const s of stops) {
    if (s.peak === null || s.offpeak === null) continue;
    const worst = Math.max(s.peak, s.offpeak);
    if (best === null || worst < best) best = worst;
  }
  return best;
}

/** Met while the figure is at or under the ask. Headways are whole seconds per line; the sum of a few lines' is not, so a hair's tolerance. */
export function contractMet(figureSeconds: number | null, askSeconds: number): boolean {
  return figureSeconds !== null && figureSeconds <= askSeconds + 1e-6;
}

/** Days left to hold it, counting today, from the day it was taken. */
export function contractDaysLeft(acceptedDay: number, today: number): number {
  return Math.max(0, CONTRACT_WINDOW_DAYS - (today - acceptedDay));
}

/** It can still be paid: enough days left in the window for the days in a row still needed. */
export function contractAlive(acceptedDay: number, today: number, daysMet: number): boolean {
  return contractDaysLeft(acceptedDay, today) >= CONTRACT_DAYS - daysMet;
}

export type AcceptRefusal = 'no_such_contract' | 'already_held';

/** Taking an offer: a click, nothing to pay (the spec: "accepting is a click, so the player chooses"). */
export function checkAccept(contract: { readonly acceptedDay: number | null } | undefined): Result<object, AcceptRefusal> {
  if (!contract) return refuse('no_such_contract');
  if (contract.acceptedDay !== null) return refuse('already_held');
  return ok();
}
