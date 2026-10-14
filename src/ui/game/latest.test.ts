// Only the newest question's answer counts (D25's probe). Shown failing (TS-04) with the probe's old
// rule, which kept every question open until its answer came and a cleared card did not withdraw it.
import { describe, expect, it } from 'vitest';
import { LatestAsk } from './latest';

describe('the newest question', () => {
  it('drops an older answer that arrives late', () => {
    const asks = new LatestAsk<string>();
    const a = asks.ask('a');
    const b = asks.ask('b');
    expect(asks.answer(a)).toBeNull();
    expect(asks.answer(b)).toBe('b');
  });

  it('drops the answer to a question withdrawn while in flight', () => {
    const asks = new LatestAsk<string>();
    const a = asks.ask('a');
    asks.withdraw();
    expect(asks.answer(a)).toBeNull();
    expect(asks.answer(0)).toBeNull();
  });
});
