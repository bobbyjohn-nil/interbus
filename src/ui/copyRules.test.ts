// The copy convention's checker (D25). Shown failing (TS-04) with each rule taken out in turn.
import { describe, expect, it } from 'vitest';
import { copyProblem, copyProblems } from './copyRules';

describe('the copy convention', () => {
  it('wants a capital, a digit or a sign first', () => {
    expect(copyProblem('every 20 min needs 2 Sparrows')).toBe('starts in lower case');
    expect(copyProblem('Every 20 min needs 2 Sparrows')).toBeNull();
    expect(copyProblem('$1.75–$2.00')).toBeNull();
    expect(copyProblem('≈9,000 people within a walk')).toBeNull();
    expect(copyProblem('3/5 Draw a line')).toBeNull();
    // A button that is only a symbol (D25's route editor): ×, ↑ and ↓ are not words.
    expect(['×', '↑', '↓'].map(copyProblem)).toEqual([null, null, null]);
    expect(copyProblem('   ')).toBeNull();
  });

  it('lets 2D and 3D be capitals, and nothing else shout', () => {
    expect(copyProblem('QUIET · fewer than 5 boardings a day')).toBe('in capitals: QUIET');
    expect(copyProblem('Tilt to 3D (T, or double-click and hold)')).toBeNull();
    expect(copyProblem('Year 1, Q2 Day 4, 08:10')).toBeNull();
  });

  it('wants curly apostrophes and no space before punctuation', () => {
    expect(copyProblem("Boston's map file")).toBe('a straight apostrophe');
    expect(copyProblem('Boston’s map file')).toBeNull();
    expect(copyProblem('Saved , then')).toBe('a space before punctuation');
  });

  it('lists each problem once', () => {
    expect(copyProblems(['off', 'off', 'On'])).toEqual(['starts in lower case: off']);
  });
});
