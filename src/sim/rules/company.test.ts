import { describe, expect, it } from 'vitest';
import { checkFounding, COMPANY_COLOURS } from './company';

describe('founding (the exit check, step 1)', () => {
  it('takes a name and an offered colour, once', () => {
    expect(checkFounding('', '  Back   Bay Transit ', COMPANY_COLOURS[0]!)).toEqual({ ok: true, name: 'Back Bay Transit' });
    expect(checkFounding('Back Bay Transit', 'Again', COMPANY_COLOURS[0]!)).toEqual({ ok: false, reason: 'already_founded' });
  });

  it('refuses an empty or overlong name, and a colour it does not offer', () => {
    expect(checkFounding('', '   ', COMPANY_COLOURS[0]!)).toEqual({ ok: false, reason: 'name_empty' });
    expect(checkFounding('', 'x'.repeat(33), COMPANY_COLOURS[0]!)).toEqual({ ok: false, reason: 'name_too_long', limit: 32 });
    expect(checkFounding('', 'x'.repeat(32), COMPANY_COLOURS[0]!).ok).toBe(true);
    expect(checkFounding('', 'Fine', '#123456')).toEqual({ ok: false, reason: 'colour_not_offered' });
  });
});
