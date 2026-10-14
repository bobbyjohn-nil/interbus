// One list of money kinds and their groups (D25's Finance). Shown failing (TS-04) with Finance's old
// capital set, which left the contract kind out and so forecast a contract's reward as $0 a day.
import { describe, expect, it } from 'vitest';
import { isOperating, ROW_GROUP, ROW_KINDS } from './money';

describe('the money kinds', () => {
  it('gives every kind exactly one group', () => {
    expect(Object.keys(ROW_GROUP).sort()).toEqual([...ROW_KINDS].sort());
  });

  it('counts only income and running costs as a day’s running', () => {
    expect(ROW_KINDS.filter(isOperating)).toEqual(['fares', 'subsidy', 'running', 'wages', 'deadhead', 'upkeep', 'stopUpkeep', 'interest']);
    for (const kind of ['founding', 'contract', 'card', 'buses', 'busSales', 'stops', 'stopUpgrades', 'stopSales', 'depots'] as const) expect(isOperating(kind)).toBe(false);
  });
});
