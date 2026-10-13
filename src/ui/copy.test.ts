import { describe, expect, it } from 'vitest';
import { LOAD_COPY, REFUSAL_COPY, refusalText } from './copy';

// Every code a rule or command can return (sim/rules/depot.ts, line.ts, stop.ts, periods.ts, fare.ts and the
// commands), so a new code without copy fails here.
const CODES = [
  'depot_limit', 'not_depot_land', 'too_far_from_street', 'too_close_to_depot',
  'needs_depot', 'model_locked', 'same_model', 'no_street_near', 'stop_twice', 'no_route', 'too_few_stops',
  'headway_not_whole_seconds', 'daytime_headway_too_long', 'overnight_more_often_than_offpeak',
  'depot_full', 'insufficient_funds', 'no_such_line', 'not_started',
  'already_founded', 'name_empty', 'name_too_long', 'colour_not_offered',
  'fare_out_of_range', 'fare_not_a_step', 'same_fare',
  'same_tier', 'no_such_tier', 'needs_lines', 'no_such_stop', 'not_on_line', 'line_keeps_two', 'no_new_stops',
  'time_has_run', 'nothing_to_undo',
  'empty_slot', 'no_such_slot', 'save_unreadable', 'save_newer', 'save_older', 'save_other_city', 'save_off_street', 'save_none',
  'run_ended', 'no_quarter_save',
  'no_such_contract', 'already_held', 'no_session',
];

describe('refusal copy (UX-03)', () => {
  it('has words for every code, 8 or fewer, never the code itself', () => {
    expect(Object.keys(REFUSAL_COPY).sort()).toEqual([...CODES].sort());
    for (const reason of CODES) {
      const text = refusalText({ reason, limitM: 150, nearestM: 80, room: 2, shortCents: 2_380_000 });
      expect(text.split(/\s+/).length, `${reason}: "${text}"`).toBeLessThanOrEqual(8);
      expect(text).not.toContain('_');
    }
  });

  it('says money in money', () => {
    expect(refusalText({ reason: 'insufficient_funds', shortCents: 2_380_000 })).toBe('$23,800 short');
    expect(refusalText({ reason: 'depot_full', room: 0 })).toBe('Your depots are full');
    expect(refusalText({ reason: 'too_far_from_street', limitM: 400 })).toBe('No street within 400 m');
  });

  it('reads an unknown code as a sentence', () => expect(refusalText({ reason: 'mystery_code' })).toBe('That can’t be done here'));

  it('says in one line of 8 words or fewer when a save was set aside, and nothing when it loaded (D12)', () => {
    expect(LOAD_COPY.none).toBeNull();
    expect(LOAD_COPY.ok).toBeNull();
    expect(LOAD_COPY.rebaked).toBe('Save carried onto the new map');
    for (const outcome of ['older', 'newer', 'unreadable', 'other-city', 'off-street'] as const) {
      const text = LOAD_COPY[outcome]!;
      expect(text.split(/\s+/).length, `${outcome}: "${text}"`).toBeLessThanOrEqual(8);
      expect(text).toContain('set aside');
    }
  });
});
