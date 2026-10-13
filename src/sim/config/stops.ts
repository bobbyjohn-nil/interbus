// Stop tiers, as config rows (the M3 spec, item 5; V1's ladder, `Intralines@7af45b1:src/game/
// constants.ts:46-71`). Every stop starts a Sign (economy's STOP_COST_CENTS); each step up costs its
// row's price on top, and a step down or a removal gives back half of what the steps cost. A nicer
// stop feels closer: its walk bonus comes off the minutes walked to it, never below 0.2 (V1,
// `src/game/sim/demand.worker.ts:313-316`), and the 650 m reach does not grow. The two hub tiers need
// that many lines calling. The transfer penalty waits for transfers (week 7, EC-10).

export const STOP_TIER_IDS = [1, 2, 3, 4, 5] as const;
export type StopTier = (typeof STOP_TIER_IDS)[number];

export interface StopTierRow {
  readonly tier: StopTier;
  readonly name: string;
  /** What the step up to this tier costs, in cents (0 for the Sign every stop starts as). */
  readonly upgradeCents: number;
  readonly walkBonusMin: number;
  /** Lines that must call at the stop before it may become this tier. */
  readonly minLines: number;
  readonly transferPenaltyMin: number;
}

export const STOP_TIERS: Readonly<Record<StopTier, StopTierRow>> = {
  1: { tier: 1, name: 'Sign', upgradeCents: 0, walkBonusMin: 0, minLines: 0, transferPenaltyMin: 6 },
  2: { tier: 2, name: 'Shelter', upgradeCents: 1_200_000, walkBonusMin: 0.8, minLines: 0, transferPenaltyMin: 6 },
  3: { tier: 3, name: 'Station', upgradeCents: 3_500_000, walkBonusMin: 1.8, minLines: 0, transferPenaltyMin: 5 },
  4: { tier: 4, name: 'Interchange', upgradeCents: 9_000_000, walkBonusMin: 2.6, minLines: 3, transferPenaltyMin: 3.5 },
  5: { tier: 5, name: 'Transfer Hub', upgradeCents: 20_000_000, walkBonusMin: 3.4, minLines: 5, transferPenaltyMin: 2 },
};

/** The fewest minutes a walk bonus leaves a walk at (V1's floor). */
export const MIN_WALK_MIN = 0.2;
