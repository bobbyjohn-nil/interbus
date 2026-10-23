// Sessions merged against sessions planned (scripts/measure/sessions.mjs): PLAN §10's table read as weeks, merges dated in
// Boston's time, the archived specs' milestones, and each week's count against its sessions. Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { archivedMilestones, bostonDay, describe, isDoc, planWeeks, velocity } from './measure/sessions.mjs';

const weeks = planWeeks(readFileSync('PLAN.md', 'utf8'));
const row = (week) => weeks.find((w) => w.week === week);

test("PLAN §10's table reads as back-to-back weeks, Monday to Sunday, across the new year", () => {
  assert.deepEqual(weeks[0], { week: '1', start: '2026-10-12', end: '2026-10-18', sessions: [5.5, 5.5], milestones: ['M0'] });
  assert.deepEqual([row('3').start, row('3').end, row('3').sessions], ['2026-10-26', '2026-11-01', [5, 5]]);
  assert.deepEqual([row('11–12').start, row('11–12').end], ['2026-12-21', '2027-01-03']);
  assert.deepEqual([row('25–30').sessions, row('31–35').sessions, row('36–38').sessions], [[3, 3], [3.5, 5.75], [0.75, 1.5]]);
  assert.equal(weeks.at(-1).end, '2027-07-04');
  // A row whose dates do not follow the one before is refused, as is one that is not Monday to Sunday.
  const plan = (dates) => `\n## 10. Calendar\n| 1 | Oct 12–18 | 5.5 | **M0** | x |\n| 2 | ${dates} | 6 | y | z |\n## 11. Next\n`;
  assert.throws(() => planWeeks(plan('Oct 26–Nov 1')), /week 2 does not start the day after week 1/);
  assert.throws(() => planWeeks(plan('Oct 19–24')), /week 2: 2026-10-19 to 2026-10-24 is not Monday to Sunday/);
});

test('each milestone is due in the last row that names it', () => {
  const due = (milestone) => velocity({ weeks, merges: [], built: [{ milestone, day: '2026-10-12' }], today: '2026-10-12' })[0].built.week;
  // M3's row is week 6, its deadline week 7; M5's is week 10, its deadline the holidays'.
  assert.deepEqual(['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map(due), ['1', '3', '4', '7', '8', '11–12', '14', '16']);
});

test('a merge late on a Sunday in Boston counts in that day, before and after the clocks go back', () => {
  assert.equal(bostonDay('2026-10-19T03:30:00Z'), '2026-10-18'); // 23:30 on Sun Oct 18, daylight time
  assert.equal(bostonDay('2026-11-02T04:30:00Z'), '2026-11-01'); // 23:30 on Sun Nov 1, standard time
  assert.equal(bostonDay('2026-10-22T21:14:35-04:00'), '2026-10-22'); // as GitHub records #161's merge
});

test('docs are Markdown anywhere and anything under docs/; the rest is more than docs', () => {
  for (const path of ['docs/STATUS.md', 'CHANGELOG.md', 'docs/playtests/notes.txt', '.claude/skills/ship/SKILL.md']) assert.ok(isDoc(path), path);
  for (const path of ['src/ui/App.tsx', 'index.html', 'cities/index.json', 'e2e/boot.spec.ts']) assert.ok(!isDoc(path), path);
});

test('every archived spec says when its milestone was built', () => {
  const files = readdirSync('docs/specs')
    .filter((f) => /^m\d+-.+\.md$/.test(f))
    .map((name) => ({ name, text: readFileSync(`docs/specs/${name}`, 'utf8') }));
  const built = archivedMilestones(files).sort((a, b) => a.milestone.localeCompare(b.milestone));
  assert.deepEqual(built.slice(0, 4), ['M1', 'M2', 'M3', 'M4'].map((milestone) => ({ milestone, day: '2026-10-13' })));
  assert.throws(() => archivedMilestones([{ name: 'm9-x.md', text: '# M9\n\nArchived soon.' }]), /m9-x\.md does not say/);
});

test('each week counts its merges against its sessions, and the plan built by its end against the plan to date', () => {
  const plan = [
    { week: '1', start: '2026-10-12', end: '2026-10-18', sessions: [6, 6], milestones: ['M0'] },
    { week: '2', start: '2026-10-19', end: '2026-10-25', sessions: [6, 6], milestones: ['M1'] },
    { week: '3', start: '2026-10-26', end: '2026-11-01', sessions: [3, 4], milestones: ['M1'] },
    { week: '4', start: '2026-11-02', end: '2026-11-08', sessions: [5, 5], milestones: ['M2'] },
  ];
  const merged = (day, n, code = true) => Array.from({ length: n }, (_, i) => ({ pr: i, day, code }));
  const merges = [...merged('2026-10-12', 7), ...merged('2026-10-18', 1, false), ...merged('2026-10-21', 2), ...merged('2026-10-24', 9)];
  const rows = velocity({ weeks: plan, merges, built: [{ milestone: 'M1', day: '2026-10-20' }], today: '2026-10-22' });
  // Week 1: 8 pull requests are at least 4 sessions, two-thirds of 6 exactly; nothing was built by its end.
  assert.deepEqual(rows[0], {
    week: '1', start: '2026-10-12', to: '2026-10-18', partial: false, sessions: [6, 6], merged: 8, code: 7, holds: true, planned: [6, 6], built: null,
  });
  // Week 2, to today: 2 pull requests are 1 session, short of 4; M1 was built on Oct 20, and its deadline is week 3's.
  assert.deepEqual(rows[1], {
    week: '2', start: '2026-10-19', to: '2026-10-22', partial: true, sessions: [6, 6], merged: 2, code: 2, holds: false, planned: [12, 12],
    built: { week: '3', end: '2026-11-01', milestones: ['M0', 'M1'], sessions: [15, 16], weeksAhead: 1 },
  });
  assert.equal(rows.length, 2, 'no week that has not begun');
  const text = describe(rows, { ref: 'origin/main', sha: 'abc1234', today: '2026-10-22' });
  assert.match(text, /Week 1, Oct 12 to Oct 18: 6 sessions planned; 8 pull requests merged, 7 of them beyond the docs\./);
  assert.match(text, /Week 2, Oct 19 to Oct 22, so far: .*\n {2}Velocity falls short: 2 pull requests are at least 1 session, against two-thirds of 6, 4\.0\./);
  assert.match(text, /Built: M0–M1, the plan through week 3 \(Sun Nov 1\), 15–16 sessions against the 12 planned to date: 1 week ahead\./);
});
