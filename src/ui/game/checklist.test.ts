import { describe, expect, it } from 'vitest';
import { checklistText } from './checklist';

describe('the checklist chip', () => {
  it('names the next step of five, in order, and is gone once a contract is taken', () => {
    const start = { depots: 0, lines: 0, elapsed: 0, profitableDays: 0, contractTaken: false };
    expect(checklistText(start)).toBe('1/5 Place a depot');
    expect(checklistText({ ...start, depots: 1 })).toBe('2/5 Draw a line');
    expect(checklistText({ ...start, depots: 1, lines: 1 })).toBe('3/5 Press play');
    expect(checklistText({ ...start, depots: 1, lines: 1, elapsed: 30 })).toBe('4/5 Close a day in profit');
    expect(checklistText({ ...start, depots: 1, lines: 1, elapsed: 86_400, profitableDays: 1 })).toBe('5/5 Take a contract');
    expect(checklistText({ ...start, depots: 1, lines: 1, elapsed: 86_400, profitableDays: 1, contractTaken: true })).toBeNull();
  });

  it('keeps an earlier step first while it is undone', () => {
    expect(checklistText({ depots: 0, lines: 0, elapsed: 600, profitableDays: 0, contractTaken: true })).toBe('1/5 Place a depot');
  });
});
