// Sessions merged against sessions planned (scripts/measure/sessions.mjs): PLAN §10's table read as weeks, merges dated in
// Boston's time, the archived specs' milestones, and each week's count against its sessions. Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { archivedMilestones, bostonDay, describe, isDoc, mergedPullRequests, planWeeks, velocity } from './measure/sessions.mjs';

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

test('the plan built by a week, not its pull requests, decides its velocity, and a week so far counts to today', () => {
  const plan = [
    { week: '1', start: '2026-10-12', end: '2026-10-18', sessions: [6, 6], milestones: ['M0'] },
    { week: '2', start: '2026-10-19', end: '2026-10-25', sessions: [6, 6], milestones: ['M1'] },
    { week: '3', start: '2026-10-26', end: '2026-11-01', sessions: [3, 4], milestones: ['M1'] },
    { week: '4', start: '2026-11-02', end: '2026-11-08', sessions: [5, 5], milestones: ['M2'] },
  ];
  const merged = (day, n, code = true) => Array.from({ length: n }, (_, i) => ({ pr: i, day, code }));
  const merges = [...merged('2026-10-12', 8), ...merged('2026-10-18', 1, false), ...merged('2026-10-19', 1), ...merged('2026-10-21', 5)];
  const rows = velocity({ weeks: plan, merges, built: [{ milestone: 'M1', day: '2026-10-20' }], today: '2026-10-20' });
  // Week 1: nine pull requests, 4.5 sessions at PLAN §9's two a session, yet nothing built by its end: short of the plan.
  assert.deepEqual(rows[0], {
    week: '1', start: '2026-10-12', to: '2026-10-18', end: '2026-10-18', partial: false, sessions: [6, 6], merged: 9, code: 8,
    planned: [6, 6], built: null, holds: false,
  });
  // Week 2 to Tue Oct 20: one pull request, and M1 archived that day, whose deadline is week 3's: 15–16 sessions built
  // against 12 planned through Sun Oct 25, a week ahead of that Sunday. The merges after today are not counted.
  assert.deepEqual(rows[1], {
    week: '2', start: '2026-10-19', to: '2026-10-20', end: '2026-10-25', partial: true, sessions: [6, 6], merged: 1, code: 1,
    planned: [12, 12], built: { milestone: 'M1', archived: '2026-10-20', week: '3', end: '2026-11-01', sessions: [15, 16], weeksAhead: 1 },
    holds: true,
  });
  assert.equal(rows.length, 2, 'no week that has not begun');
  assert.deepEqual(describe(rows, { ref: 'origin/main', sha: 'abc1234', newest: '2026-10-19', today: '2026-10-20' }).split('\n'), [
    'Sessions merged against sessions planned (PLAN §10), at origin/main abc1234, its newest commit on Oct 19, to Oct 20 in Boston.',
    '',
    "Week 1, Oct 12 to Oct 18: 6 sessions planned; 9 pull requests merged, 8 of them beyond the docs, 4.5 sessions at PLAN §9's two a session.",
    '  Built: no milestone archived yet, against 6 sessions planned through Sun Oct 18.',
    '  Velocity falls short: the plan built is under two-thirds of the plan through Sun Oct 18, 4.0 sessions.',
    '',
    "Week 2, Oct 19 to Oct 20, so far: 6 sessions planned; 1 pull request merged, 1 of them beyond the docs, 0.5 sessions at PLAN §9's two a session.",
    "  Built: the plan through week 3 (Sun Nov 1), M1's deadline, its spec archived Oct 20: 15–16 sessions, against 12 planned through Sun Oct 25, 1 week ahead.",
    '  Velocity holds so far: the plan built is at least two-thirds of the plan through Sun Oct 25, 8.0 sessions.',
  ]);
  // Exactly two-thirds holds: 12 sessions built against 18 planned.
  const even = plan.slice(0, 3).map((w) => ({ ...w, sessions: [6, 6], milestones: w.week === '2' ? ['M1'] : [] }));
  assert.equal(velocity({ weeks: even, merges: [], built: [{ milestone: 'M1', day: '2026-10-13' }], today: '2026-11-01' })[2].holds, true);
});

test("main's merges are read from git: each pull request once, dated in Boston, against the branch it merged into", () => {
  const repo = mkdtempSync(join(tmpdir(), 'sessions-'));
  const git = (args, at) =>
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...{ GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@example.com', GIT_AUTHOR_DATE: at },
        ...{ GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@example.com', GIT_COMMITTER_DATE: at },
      },
    });
  const commit = (file, at) => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), at);
    git(['add', '.'], at);
    git(['commit', '-q', '-m', `change ${file}`], at);
  };
  try {
    git(['init', '-q', '-b', 'main'], '2026-10-12T12:00:00Z');
    commit('README.md', '2026-10-12T12:00:00Z');
    // Pull request 1 changes code while main takes a docs change; merged at 23:30 on Sun Oct 18 in Boston.
    git(['checkout', '-q', '-b', 'one'], '2026-10-12T13:00:00Z');
    commit('game.js', '2026-10-12T13:00:00Z');
    git(['checkout', '-q', 'main'], '2026-10-12T14:00:00Z');
    commit('NOTES.md', '2026-10-12T14:00:00Z');
    git(['merge', '-q', '--no-ff', '-m', 'Merge pull request #1 from owner/one', 'one'], '2026-10-19T03:30:00Z');
    // Pull request 2 changes only docs, in the newer subject; a merge that is no pull request's is left out.
    git(['checkout', '-q', '-b', 'two'], '2026-10-20T12:00:00Z');
    commit('docs/plan.txt', '2026-10-20T12:00:00Z');
    git(['checkout', '-q', 'main'], '2026-10-20T12:00:00Z');
    git(['merge', '-q', '--no-ff', '-m', 'Merge pull request #2: the plan', 'two'], '2026-10-20T13:00:00Z');
    git(['checkout', '-q', '-b', 'three'], '2026-10-21T12:00:00Z');
    commit('tool.js', '2026-10-21T12:00:00Z');
    git(['checkout', '-q', 'main'], '2026-10-21T12:00:00Z');
    git(['merge', '-q', '--no-ff', '-m', "Merge branch 'three'", 'three'], '2026-10-21T13:00:00Z');
    assert.deepEqual(mergedPullRequests('main', repo), [
      { pr: 2, day: '2026-10-20', code: false },
      { pr: 1, day: '2026-10-18', code: true },
    ]);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
