// Where the money goes (D25: Finance "would be better with some visuals and better labeling with more
// information about where the money is going, eg bus maintenance or bus stop upkeep"): every kind of
// ledger row, and the group each belongs to. One list for the ledger, the day card, Finance, the
// report card, the checklist's "a day in profit" and the pacing run, so they never disagree on what
// counts as running the company (before, five copies of the capital set did, and Finance forecast a
// contract's reward as $0).

/** Every kind of row, in the order a closed day lists them: money in, running costs, buying and selling. */
export const ROW_KINDS = [
  'founding',
  'fares',
  'subsidy',
  'contract',
  'card',
  'running',
  'wages',
  'deadhead',
  'upkeep',
  'stopUpkeep',
  'interest',
  'buses',
  'busSales',
  'stops',
  'stopUpgrades',
  'stopSales',
  'depots',
] as const;
export type RowKind = (typeof ROW_KINDS)[number];

/**
 * - **opening:** the starting cash, on Day 0.
 * - **income:** what riders and the city pay for the service, every hour.
 * - **reward:** a contract's reward and a quarter's grant or fine, now and then.
 * - **running:** what running the company costs, every hour.
 * - **capital:** buying and building, and selling back.
 */
export type RowGroup = 'opening' | 'income' | 'reward' | 'running' | 'capital';

export const ROW_GROUP: Readonly<Record<RowKind, RowGroup>> = {
  founding: 'opening',
  fares: 'income',
  subsidy: 'income',
  contract: 'reward',
  card: 'reward',
  running: 'running',
  wages: 'running',
  deadhead: 'running',
  upkeep: 'running',
  stopUpkeep: 'running',
  interest: 'running',
  buses: 'capital',
  busSales: 'capital',
  stops: 'capital',
  stopUpgrades: 'capital',
  stopSales: 'capital',
  depots: 'capital',
};

/** A row of the company's day-to-day running: income and running costs, not capital, rewards or the opening (the checklist's "a day in profit", the report card's Money grade). */
export function isOperating(kind: RowKind): boolean {
  return ROW_GROUP[kind] === 'income' || ROW_GROUP[kind] === 'running';
}
