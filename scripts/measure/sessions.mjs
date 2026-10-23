// Sessions merged against sessions planned (DECISIONS, "Measurements to record"), for PLAN §10's velocity check on Sun
// Oct 18 and Oct 25, where a week under two-thirds of its Sessions column holds the next week's map and look items for M3,
// and its capacity check on Sun Nov 1, more than a week behind. It reads the work two ways, both from the repo at one ref:
// - the plan built, which the verdict rests on: every week of §10's table up to the deadline row (the last naming it in
//   bold) of the furthest milestone whose spec is archived ("Archived <date>. M<n>'s work is done", docs/specs/), against
//   two-thirds of the plan to the week's end, so work done ahead of its weeks counts. Each spec was written once the one
//   before it was built, so the milestones before an archived one count as built too, M0 among them, which had no spec
//   (PLAN §14 listed its work);
// - each week's merged pull requests (the ref's first-parent merge commits), how many changed more than the docs, and the
//   sessions they make at PLAN §9's rate, a session of 2–4 hours ending in one or two.
// Weeks run Monday to Sunday (PLAN §10), here in Boston's time, as GitHub records the merges. Fetch first: the ref is read
// as it stands, and the header names its newest commit.
//
//   npm run measure:sessions [-- <ref>] [--today=YYYY-MM-DD]      (the ref defaults to origin/main, today to Boston's)
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The plan's first year. Its table names months only; every week must run Monday to Sunday, which checks it. */
export const FIRST_YEAR = 2026;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;
const noon = (day) => Date.parse(`${day}T12:00:00Z`);
const weekday = (day) => new Date(noon(day)).getUTCDay();
const dayAfter = (day) => new Date(noon(day) + DAY_MS).toISOString().slice(0, 10);
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

/** A moment's calendar day in Boston, as YYYY-MM-DD. */
export function bostonDay(at) {
  const parts = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', parts).format(new Date(at));
}

/** Whether a changed path is documentation: Markdown anywhere, or anything under docs/. */
export const isDoc = (path) => path.endsWith('.md') || path.startsWith('docs/');

/**
 * PLAN §10's weeks, in order: each row's week, first and last day, sessions as low and high ("3.5–5.75"; a bracketed
 * extra, as in "3 (+0.5–1 for a D19 trailer, §4)", is left out) and the milestones it names in bold.
 */
export function planWeeks(plan) {
  const from = plan.indexOf('\n## 10.');
  const to = plan.indexOf('\n## 11.', from);
  if (from < 0 || to < 0) throw new Error('PLAN.md has no §10');
  let year = FIRST_YEAR;
  let month = 0;
  const day = (name, date) => {
    const m = MONTHS.indexOf(name) + 1;
    if (!m) throw new Error(`PLAN §10: no month "${name}"`);
    if (m < month) year += 1;
    month = m;
    return `${year}-${String(m).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  };
  const weeks = [];
  const rows = plan.slice(from, to).matchAll(/^\| (\d+(?:–\d+)?) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gm);
  for (const [, week, dates, sessions, focus] of rows) {
    const d = /^(\w{3}) (\d+)–(?:(\w{3}) )?(\d+)$/.exec(dates.trim());
    const s = /^(\d+(?:\.\d+)?)(?:–(\d+(?:\.\d+)?))?/.exec(sessions.trim());
    if (!d || !s) throw new Error(`PLAN §10, week ${week}: no dates or sessions in "${dates.trim()}" and "${sessions.trim()}"`);
    const start = day(d[1], d[2]);
    const end = day(d[3] ?? d[1], d[4]);
    const milestones = [...focus.matchAll(/\*\*(M\d+)\b/g)].map((m) => m[1]);
    weeks.push({ week, start, end, sessions: [Number(s[1]), Number(s[2] ?? s[1])], milestones });
  }
  if (!weeks.length) throw new Error('PLAN §10 has no weeks');
  for (const [i, w] of weeks.entries()) {
    if (weekday(w.start) !== 1 || weekday(w.end) !== 0) {
      throw new Error(`PLAN §10, week ${w.week}: ${w.start} to ${w.end} is not Monday to Sunday`);
    }
    if (i > 0 && dayAfter(weeks[i - 1].end) !== w.start) {
      throw new Error(`PLAN §10, week ${w.week} does not start the day after week ${weeks[i - 1].week} ends`);
    }
  }
  return weeks;
}

/** Each archived spec's milestone and the day its work was done, from `files` ({ name, text }). */
export function archivedMilestones(files) {
  return files.map(({ name, text }) => {
    const m = /^> \*\*Archived (\d{4}-\d{2}-\d{2})\.\*\* (M\d+)'s (?:work is|items are) done/m.exec(text);
    if (!m) throw new Error(`${name} does not say "Archived <date>. M<n>'s work is done"`);
    return { milestone: m[2], day: m[1] };
  });
}

/**
 * Each week begun by `today`, to its end or to today:
 * - its sessions and merged pull requests, those beyond the docs among them;
 * - the plan built by then, set by the furthest milestone archived by then, against the plan to the week's end, and how
 *   many weeks ahead of the week's end that is;
 * - the velocity check: the plan built against two-thirds of the plan to the week's end.
 */
export function velocity({ weeks, merges, built, today }) {
  const due = new Map(); // each milestone's last row, its deadline
  weeks.forEach((w, i) => w.milestones.forEach((m) => due.set(m, i)));
  const rows = [];
  let planned = [0, 0];
  for (const w of weeks) {
    if (w.start > today) break;
    const to = today < w.end ? today : w.end;
    const merged = merges.filter((m) => m.day >= w.start && m.day <= to);
    planned = add(planned, w.sessions);
    const archived = built.filter((b) => b.day <= to && due.has(b.milestone));
    const furthest = archived.sort((a, b) => due.get(b.milestone) - due.get(a.milestone))[0];
    const through = furthest ? due.get(furthest.milestone) : -1;
    const sessions = weeks.slice(0, through + 1).reduce((sum, x) => add(sum, x.sessions), [0, 0]);
    const done = furthest && {
      milestone: furthest.milestone,
      archived: furthest.day,
      week: weeks[through].week,
      end: weeks[through].end,
      sessions,
      weeksAhead: Math.round((noon(weeks[through].end) - noon(w.end)) / (7 * DAY_MS)),
    };
    rows.push({
      week: w.week,
      start: w.start,
      to,
      end: w.end,
      partial: to < w.end,
      sessions: w.sessions,
      merged: merged.length,
      code: merged.filter((m) => m.code).length,
      planned,
      built: done || null,
      holds: 3 * sessions[0] >= 2 * planned[0], // at least two-thirds, in exact arithmetic
    });
  }
  return rows;
}

const range = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);
const short = (day) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8))}`;
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The rows as the lines DECISIONS' Measured entries quote. */
export function describe(rows, { ref, sha, newest, today }) {
  const lines = [
    `Sessions merged against sessions planned (PLAN §10), at ${ref} ${sha}, its newest commit on ${short(newest)},` +
      ` to ${short(today)} in Boston.`,
  ];
  for (const r of rows) {
    const two = ((2 / 3) * r.planned[0]).toFixed(1);
    lines.push(
      '',
      `Week ${r.week}, ${short(r.start)} to ${short(r.to)}${r.partial ? ', so far' : ''}: ${range(r.sessions)} sessions planned;` +
        ` ${count(r.merged, 'pull request')} merged, ${r.code} of them beyond the docs,` +
        ` ${count(r.merged / 2, 'session')} at PLAN §9's two a session.`,
      r.built
        ? `  Built: the plan through week ${r.built.week} (Sun ${short(r.built.end)}), ${r.built.milestone}'s deadline,` +
            ` its spec archived ${short(r.built.archived)}: ${range(r.built.sessions)} sessions, against ${range(r.planned)}` +
            ` planned through Sun ${short(r.end)}, ${count(Math.abs(r.built.weeksAhead), 'week')}` +
            ` ${r.built.weeksAhead < 0 ? 'behind' : 'ahead'}.`
        : `  Built: no milestone archived yet, against ${range(r.planned)} sessions planned through Sun ${short(r.end)}.`,
      `  Velocity ${r.holds ? 'holds' : 'falls short'}${r.partial ? ' so far' : ''}: the plan built` +
        ` ${r.holds ? 'is at least' : 'is under'} two-thirds of the plan through Sun ${short(r.end)}, ${two} sessions.`,
    );
  }
  return lines.join('\n');
}

const git = (args, cwd = '.') => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });

/**
 * The pull requests merged into `ref` in the repo at `cwd`, newest first, each with its day in Boston and whether it
 * changed more than the docs, against the merge's first parent: the branch it merged into.
 */
export function mergedPullRequests(ref, cwd = '.') {
  if (git(['rev-parse', '--is-shallow-repository'], cwd).trim() === 'true') {
    throw new Error('a shallow clone misses merges: run git fetch --unshallow first');
  }
  return git(['log', '--first-parent', '--merges', '--format=%H %cI %s', ref], cwd)
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      const [sha, at, ...subject] = line.split(' ');
      const pr = /^Merge pull request #(\d+)\b/.exec(subject.join(' '));
      if (!pr) return [];
      const files = git(['diff', '--name-only', `${sha}^1`, sha], cwd).split('\n').filter(Boolean);
      return [{ pr: Number(pr[1]), day: bostonDay(at), code: files.some((f) => !isDoc(f)) }];
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const ref = args.find((a) => !a.startsWith('--')) ?? 'origin/main';
  const today = args.find((a) => a.startsWith('--today='))?.slice('--today='.length) ?? bostonDay(Date.now());
  const specs = git(['ls-tree', '--name-only', `${ref}:docs/specs`]).split('\n').filter((f) => /^m\d+-.+\.md$/.test(f));
  const rows = velocity({
    weeks: planWeeks(git(['show', `${ref}:PLAN.md`])),
    merges: mergedPullRequests(ref),
    built: archivedMilestones(specs.map((name) => ({ name, text: git(['show', `${ref}:docs/specs/${name}`]) }))),
    today,
  });
  const sha = git(['rev-parse', '--short', ref]).trim();
  const newest = bostonDay(git(['log', '-1', '--format=%cI', ref]).trim());
  console.log(describe(rows, { ref, sha, newest, today }));
}
