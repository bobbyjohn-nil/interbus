import { describe, expect, it } from 'vitest';
import { checkHeadways, periodAt, runsIn, secondsPerDay } from './periods';

const at = (h: number, m = 0) => h * 3600 + m * 60;

describe('the three periods (D7)', () => {
  it('splits the day at 05:00, 06:30, 09:30, 16:00, 19:00 and 24:00', () => {
    expect(periodAt(at(0))).toBe('overnight');
    expect(periodAt(at(4, 59) + 59)).toBe('overnight');
    expect(periodAt(at(5))).toBe('offpeak');
    expect(periodAt(at(6, 29))).toBe('offpeak');
    expect(periodAt(at(6, 30))).toBe('peak');
    expect(periodAt(at(9, 29))).toBe('peak');
    expect(periodAt(at(9, 30))).toBe('offpeak');
    expect(periodAt(at(16))).toBe('peak');
    expect(periodAt(at(19))).toBe('offpeak');
    expect(periodAt(at(23, 59))).toBe('offpeak');
    expect(periodAt(at(24))).toBe('overnight');
  });

  it('gives peak 6 h, off-peak 13 h and overnight 5 h, 24 h in all', () => {
    expect(secondsPerDay('peak')).toBe(at(6));
    expect(secondsPerDay('offpeak')).toBe(at(13));
    expect(secondsPerDay('overnight')).toBe(at(5));
    let peak = 0;
    for (let s = 0; s < at(24); s += 30) if (periodAt(s) === 'peak') peak += 30;
    expect(peak).toBe(secondsPerDay('peak'));
  });
});

describe('headway limits (D7)', () => {
  const twenty = at(0, 20);
  it('accepts the founding default: every 20 min by day, overnight off', () => {
    expect(checkHeadways({ peak: twenty, offpeak: twenty, overnight: null }).ok).toBe(true);
  });

  it('keeps peak and off-peak at most an hour apart', () => {
    expect(checkHeadways({ peak: twenty, offpeak: at(1) + 1, overnight: null })).toMatchObject({ ok: false, reason: 'daytime_headway_too_long' });
    expect(checkHeadways({ peak: at(1), offpeak: at(1), overnight: null }).ok).toBe(true);
  });

  it('never lets overnight run more often than off-peak, closing the night-only exploit (EC-03)', () => {
    expect(checkHeadways({ peak: twenty, offpeak: at(0, 30), overnight: at(0, 10) })).toMatchObject({
      ok: false,
      reason: 'overnight_more_often_than_offpeak',
      limitSeconds: at(0, 30),
    });
    expect(checkHeadways({ peak: twenty, offpeak: at(0, 30), overnight: at(0, 30) }).ok).toBe(true);
  });

  it('refuses zero, negative and fractional headways', () => {
    for (const bad of [0, -60, 90.5]) expect(checkHeadways({ peak: bad, offpeak: twenty, overnight: null }).ok).toBe(false);
  });

  // The systems audit's seventh round: every second, with 2,000 buses, a save's line took 3.4 s a recompute. Shown failing
  // (TS-04) with the floor taken out, when every second and 59 seconds passed.
  it('runs no bus more often than once a minute, in any period', () => {
    for (const h of [{ peak: 1, offpeak: twenty, overnight: null }, { peak: twenty, offpeak: 59, overnight: null }, { peak: 30, offpeak: 30, overnight: 30 }]) {
      expect(checkHeadways(h)).toMatchObject({ ok: false, reason: 'headway_too_short', limitSeconds: 60 });
    }
    expect(checkHeadways({ peak: 60, offpeak: 60, overnight: 60 }).ok).toBe(true);
  });

  it('runs no overnight service when overnight is off', () => {
    const h = { peak: twenty, offpeak: twenty, overnight: null };
    expect(runsIn(h, 'overnight')).toBe(false);
    expect(runsIn(h, 'peak') && runsIn(h, 'offpeak')).toBe(true);
  });
});
