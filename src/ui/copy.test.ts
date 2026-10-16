import { describe, expect, it } from 'vitest';
import { failedText, LOAD_COPY, REFUSAL_COPY, refusalText, SLOT_REFUSED_COPY, STORE_FULL_COPY, STORE_LINE_COPY, STORE_REFUSED_COPY, AUTOSAVE_OFF_CHIP, AUTOSAVE_OFF_NAME, AUTOSAVE_OFF_TITLE, UNBACKED_COPY, UNBACKED_ROW_TITLE, unbackedRowText, undoText } from './copy';
import { copyProblems } from './copyRules';
import { eventNewsText, MEDAL_NAMES, medalNewsText, ROW_NAMES, SPEED_HINTS } from './format';
import { CHECKLIST } from './game/checklist';

// Every code a rule or command can return (sim/rules/depot.ts, line.ts, stop.ts, periods.ts, fare.ts and the
// commands), so a new code without copy fails here.
const CODES = [
  'depot_limit', 'not_depot_land', 'too_far_from_street', 'too_close_to_depot',
  'needs_depot', 'model_locked', 'same_model', 'no_street_near', 'stop_twice', 'no_route', 'too_few_stops',
  'headway_not_whole_seconds', 'daytime_headway_too_long', 'overnight_more_often_than_offpeak', 'same_headways',
  'depot_full', 'insufficient_funds', 'no_such_line', 'not_started',
  'already_founded', 'name_empty', 'name_too_long', 'colour_not_offered',
  'fare_out_of_range', 'fare_not_a_step', 'same_fare',
  'same_tier', 'no_such_tier', 'needs_lines', 'no_such_stop', 'not_on_line', 'line_keeps_two', 'no_new_stops', 'no_leg_near', 'no_change', 'stop_near', 'stop_in_use',
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

// D25's copy pass: every table of words keeps the convention (copyRules.ts). Shown failing (TS-04) on
// the tables before the pass: 'At most 32 letters' miscounted a name's spaces, and 'The stop is already
// this' stopped mid-thought.
describe('the copy convention in the word tables', () => {
  it('holds for every refusal, set-aside line, ledger row, checklist step, speed and medal', () => {
    const refusals = CODES.map((reason) => refusalText({ reason, limitM: 150, nearestM: 80, room: 2, shortCents: 2_380_000, limit: 32 }));
    const tables = [...refusals, ...Object.values(LOAD_COPY).filter((t): t is string => t !== null), STORE_REFUSED_COPY, STORE_FULL_COPY, ...Object.values(STORE_LINE_COPY), ...Object.values(SLOT_REFUSED_COPY), UNBACKED_COPY, AUTOSAVE_OFF_CHIP, AUTOSAVE_OFF_NAME, AUTOSAVE_OFF_TITLE, unbackedRowText('A save from an older build (format 15)'), UNBACKED_ROW_TITLE, failedText('start', 'Boston'), failedText('stopped', 'Boston'), ...Object.values(ROW_NAMES), ...CHECKLIST, ...Object.values(SPEED_HINTS), ...Object.values(MEDAL_NAMES)];
    for (const kind of ['roadworks', 'festival', 'snow'] as const) for (const news of ['tomorrow', 'over'] as const) tables.push(eventNewsText({ kind, street: 'Huntington Avenue', days: 2, news }));
    for (const m of ['bronze', 'silver', 'gold'] as const) tables.push(medalNewsText(m));
    expect(copyProblems(tables)).toEqual([]);
  });

  // A full store and blocked storage in words of their own, each with its way out, and the notice and a slot's line as short as
  // a refusal's (8 words or fewer, UX-03). Saves' line for a full store names Export too, since the room may be taken by other
  // data of the same origin with nothing in Saves to delete. Shown failing (TS-04) on 029387a, which had one line for both.
  it('says a full store apart from storage that keeps nothing, with the way out', () => {
    for (const text of [STORE_FULL_COPY, ...Object.values(SLOT_REFUSED_COPY)]) expect(text.split(/\s+/).length, text).toBeLessThanOrEqual(8);
    expect(STORE_LINE_COPY.full).not.toBe(STORE_LINE_COPY.blocked);
    for (const text of [STORE_FULL_COPY, STORE_LINE_COPY.full, SLOT_REFUSED_COPY.full]) expect(text, text).toMatch(/[Dd]elete a save/);
    for (const text of Object.values(STORE_LINE_COPY)) expect(text, text).toMatch(/[Ee]xport this game/);
    expect(STORE_FULL_COPY).toMatch(/delete a save$/);
    expect(AUTOSAVE_OFF_NAME.toLowerCase()).toContain(AUTOSAVE_OFF_CHIP.toLowerCase()); // its name holds its words (WCAG 2.5.3)
    expect(AUTOSAVE_OFF_NAME).toMatch(/^Saves/);
  });

  it('finishes its sentences, and counts a name in characters', () => {
    expect(undoText({ command: 'set-fare', subject: 'Line 2' })).toBe('Undo: Line 2’s fare');
    expect(refusalText({ reason: 'name_too_long', limit: 32 })).toBe('At most 32 characters');
    expect(refusalText({ reason: 'same_tier' })).toBe('The stop is already this kind');
  });
});
