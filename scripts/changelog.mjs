#!/usr/bin/env node
// CHANGELOG.md guard and release tool. Node only, no dependencies.
//
// Policy: entries collect under "## [Unreleased]" as work lands. A numbered
// version exists only when the owner types /ship <version>
// (.claude/skills/ship/SKILL.md), which runs `release` and commits
// "Release v<version>". `check` fails any version heading not added by its own
// release commit (one parent, only CHANGELOG.md and package files changed),
// any v* tag not on that commit, and any later edit to released notes. It cannot
// tell who made a commit: the owner's yes inside /ship is the real guard.
//
// Tests: node --test "scripts/*.test.mjs"
//
//   node scripts/changelog.mjs check [--base <git-ref>] [--tag <tag>]
//   node scripts/changelog.mjs release <version> [--date YYYY-MM-DD]
//   node scripts/changelog.mjs notes [<version>]

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FILE = 'CHANGELOG.md';
export const TYPES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
const IDENT = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
const SEMVER = new RegExp(`^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${IDENT}(?:\\.${IDENT})*))?$`);
const VERSION_HEADING = /^## \[([^\]]*)\] - (\S+?)( \[YANKED\])?$/;
const ITEM = /^(?:[-*+]|\d+[.)])\s/;
const LINK_DEF = /^\s{0,3}\[[^\]]+\]:\s/;
const POLICY = 'Versions are created only by the owner with /ship <version> (commit "Release v<version>").';

// ---------- semver ----------

export function parseSemver(s) {
  const m = SEMVER.exec(s);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split('.') : [] };
}

export function compareSemver(a, b) {
  const x = typeof a === 'string' ? parseSemver(a) : a;
  const y = typeof b === 'string' ? parseSemver(b) : b;
  for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) return +p < +q ? -1 : 1;
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

// ---------- dates ----------

export function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today's date where this machine is (honours TZ). Used as the default release date. */
export function localToday(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function addDays(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- parsing ----------

/** Leading indentation in columns (a tab runs to the next multiple of 4). */
function indentOf(line) {
  let col = 0;
  for (const ch of line) {
    if (ch === ' ') col++;
    else if (ch === '\t') col += 4 - (col % 4);
    else break;
  }
  return col;
}

/**
 * Classify each line as text, code (inside a fence) or comment (inside <!-- -->), the way
 * CommonMark (and so GitHub) reads them. A fence opens only with 0-3 spaces of indent, and a
 * backtick fence's info string may not contain a backtick; it closes on the same character
 * repeated at least as often. A fence indented 1-3 spaces also ends at the first line indented
 * less, as it does inside a list item. When unsure, a line counts as text, so a heading that
 * GitHub would render is never hidden from the check.
 */
function scan(lines) {
  let fence = null; // { ch, len, indent }
  let inComment = false;
  return lines.map((text) => {
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(text);
      if (close && close[1][0] === fence.ch && close[1].length >= fence.len) {
        fence = null;
        return 'code';
      }
      if (!(text.trim() && indentOf(text) < fence.indent)) return 'code';
      fence = null; // dedented: read the line as ordinary text below
    }
    if (inComment) {
      if (text.includes('-->')) inComment = false;
      return 'comment';
    }
    const open = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(text);
    if (open && !(open[2][0] === '`' && open[3].includes('`'))) {
      fence = { ch: open[2][0], len: open[2].length, indent: open[1].length };
      return 'code';
    }
    if (/^ {0,3}<!--/.test(text)) {
      if (!text.includes('-->', text.indexOf('<!--') + 4)) inComment = true;
      return 'comment';
    }
    return 'text';
  });
}

/** An ATX heading ("## Title"): indent 0-3, 1-6 #s, then a space, a tab or the end of the line. */
function atxHeading(line) {
  const m = /^( {0,3})(#{1,6})(?=[ \t]|$)(.*)$/.exec(line);
  if (!m) return null;
  return { indent: m[1].length, level: m[2].length, title: m[3].replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim() };
}

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])(?:[ \t]|$)/;
const UNDERLINE = /^[ \t]*(?:=+|-+)[ \t]*$/;
const VERSIONISH = /\d+\.\d+\.\d+/;

/** True when line i underlines the text line above it, which makes that text a (setext) heading. */
function isSetextUnderline(doc, i) {
  if (i === 0 || doc.kinds[i] !== 'text' || doc.kinds[i - 1] !== 'text') return false;
  const line = doc.lines[i];
  const above = doc.lines[i - 1];
  if (!UNDERLINE.test(line) || !above.trim() || atxHeading(above) || UNDERLINE.test(above)) return false;
  // Under a list item only a line indented into the item makes a heading; at the margin it is a rule.
  return !LIST_ITEM.test(above) || indentOf(line) >= 2;
}

/** Split the file into the header and its level-2 sections. Line numbers are 1-based. */
export function parse(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const kinds = scan(lines);
  const sections = [];
  lines.forEach((line, i) => {
    if (kinds[i] !== 'text' || atxHeading(line)?.level !== 2) return;
    const s = { line: i + 1, start: i, end: lines.length, heading: line };
    if (line === '## [Unreleased]') s.kind = 'unreleased';
    else {
      const m = VERSION_HEADING.exec(line);
      if (m) Object.assign(s, { kind: 'version', version: m[1], date: m[2], yanked: !!m[3] });
      else s.kind = 'bad';
    }
    if (sections.length) sections[sections.length - 1].end = i;
    sections.push(s);
  });
  return { lines, kinds, sections };
}

/** Released versions, newest first, as written in the file (lenient: used on old revisions too). */
export function versionsIn(text) {
  const { lines, kinds } = parse(text);
  return lines
    .filter((l, i) => kinds[i] === 'text')
    .map((l) => /^ {0,3}##[ \t]+\[([^\]]+)\][ \t]+-[ \t]/.exec(l)?.[1])
    .filter((v) => v && v !== 'Unreleased');
}

/** Lines of the Unreleased body, classified for validation and release. */
function unreleasedBody(doc, sec) {
  const out = [];
  let group = null; // current ### type
  let prev = 'blank'; // role of the previous text line: blank | heading | item | cont | prose
  let last = 'heading'; // role of the previous non-blank text line
  const inItem = (r) => r === 'item' || r === 'cont';
  for (let i = sec.start + 1; i < sec.end; i++) {
    const line = doc.lines[i];
    const kind = doc.kinds[i];
    const n = i + 1;
    if (kind !== 'text') {
      out.push({ n, line, role: kind });
      continue;
    }
    if (!line.trim()) {
      out.push({ n, line, role: 'blank' });
      prev = 'blank';
      continue;
    }
    if (LINK_DEF.test(line)) {
      out.push({ n, line, role: 'link' });
      continue;
    }
    const h = atxHeading(line);
    if (h) {
      const { level, title } = h;
      let role = 'bad-heading';
      if (level === 3 && TYPES.includes(title)) {
        role = 'type';
        group = title;
      } else if (level === 4 && group) role = 'area';
      else if (level <= 3) group = null;
      out.push({ n, line, role, level, title });
      prev = last = 'heading';
      continue;
    }
    let role;
    if (ITEM.test(line)) role = group ? 'item' : 'orphan-item';
    else if (inItem(prev)) role = 'cont'; // wrapped line of an entry
    else if (/^\s/.test(line) && inItem(last)) role = 'cont'; // indented paragraph of an entry
    else role = 'prose';
    out.push({ n, line, role, starts: role === 'prose' && prev !== 'prose' });
    prev = last = role === 'orphan-item' ? 'item' : role;
  }
  return out;
}

export function countEntries(text) {
  const doc = parse(text);
  const sec = doc.sections.find((s) => s.kind === 'unreleased');
  return sec ? unreleasedBody(doc, sec).filter((l) => l.role === 'item').length : 0;
}

// ---------- validation ----------

/** Format rules. Returns a list of error strings (empty means valid). */
export function validate(text, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [];
  const doc = parse(text);
  const first = doc.lines.find((l) => l.trim());
  if (first !== '# Changelog') errors.push('line 1: the file must start with "# Changelog"');

  // Headings GitHub renders that the section rules below would not see.
  doc.lines.forEach((line, i) => {
    if (doc.kinds[i] !== 'text') return;
    const n = i + 1;
    const h = atxHeading(line);
    if (h?.indent) errors.push(`line ${n}: remove the spaces before "#"; headings start at the beginning of the line`);
    else if (h && VERSIONISH.test(h.title) && h.level !== 2)
      errors.push(`line ${n}: "${line.trim()}" has a version number; versions are only "## [x.y.z] - YYYY-MM-DD" sections`);
    if (/<h[1-6](?=[\s>/]|$)/i.test(line)) errors.push(`line ${n}: HTML headings (<h1>-<h6>) are not allowed; use Markdown "##" and "###" headings`);
    if (isSetextUnderline(doc, i))
      errors.push(`line ${n}: a line of only "-" or "=" under text turns that text into a heading; add a blank line above it or remove it`);
  });

  const { sections } = doc;
  if (!sections.length || sections[0].kind !== 'unreleased') {
    errors.push(
      `line ${sections[0]?.line ?? 1}: the first section must be exactly "## [Unreleased]"` +
        (sections[0] && /unreleased/i.test(sections[0].heading) ? ` (found "${sections[0].heading}")` : ''),
    );
  }
  const latest = addDays(today, 1); // one day of slack for time zones
  let newer = null;
  for (const s of sections) {
    if (s.kind === 'unreleased') {
      if (s !== sections[0]) errors.push(`line ${s.line}: "## [Unreleased]" may appear only once, as the first section`);
      continue;
    }
    if (s.kind === 'bad') {
      if (!atxHeading(s.heading).indent)
        errors.push(`line ${s.line}: "${s.heading}" is not "## [Unreleased]" or "## [x.y.z] - YYYY-MM-DD"`);
      continue;
    }
    const v = parseSemver(s.version);
    if (!v) {
      const hint = /^v\d/.test(s.version) ? ' (drop the "v")' : /\+/.test(s.version) ? ' (no build metadata)' : '';
      errors.push(`line ${s.line}: "${s.version}" is not a semantic version x.y.z${hint}`);
      continue;
    }
    if (!isRealDate(s.date)) {
      errors.push(`line ${s.line}: "${s.date}" is not a real date in YYYY-MM-DD form`);
      continue;
    }
    if (s.date > latest) errors.push(`line ${s.line}: ${s.version} is dated ${s.date}, which is in the future`);
    if (newer) {
      const c = compareSemver(v, newer.v);
      if (c === 0) errors.push(`line ${s.line}: ${s.version} appears twice`);
      else if (c > 0) errors.push(`line ${s.line}: ${s.version} is listed below ${newer.version}; newest version first`);
      if (s.date > newer.date) errors.push(`line ${s.line}: ${s.version} (${s.date}) is dated after the newer ${newer.version} (${newer.date})`);
    }
    newer = { v, version: s.version, date: s.date };
  }

  const u = sections.find((s) => s.kind === 'unreleased');
  if (u) {
    const body = unreleasedBody(doc, u);
    const hasItems = body.some((l) => l.role === 'item' || l.role === 'orphan-item');
    let notesSeen = 0;
    let headingSeen = false;
    for (const l of body) {
      const heading = l.role === 'type' || l.role === 'area' || l.role === 'bad-heading';
      if (heading) headingSeen = true;
      if (l.role === 'bad-heading')
        errors.push(
          `line ${l.n}: "${l.line}" is not allowed in [Unreleased]; use ### ${TYPES.join(' / ')} (and #### for an area within one)`,
        );
      else if (l.role === 'orphan-item') errors.push(`line ${l.n}: put this entry under a ### heading (${TYPES.join(', ')})`);
      else if ((heading || l.role === 'prose') && VERSIONISH.test(l.title ?? l.line))
        errors.push(`line ${l.n}: a version number outside an entry; versions are added only by /ship`);
      else if (l.role === 'prose' && hasItems)
        errors.push(`line ${l.n}: [Unreleased] holds only "- " entries once it has any; make this an entry or delete it (and the "Nothing yet" note)`);
      else if (l.role === 'prose' && headingSeen)
        errors.push(`line ${l.n}: a note in [Unreleased] goes before the first ### heading; under a heading, write "- " entries`);
      else if (l.starts && ++notesSeen > 1)
        errors.push(`line ${l.n}: [Unreleased] may hold one short note paragraph (the "Nothing yet" note), not more`);
    }
  }
  return errors;
}

// ---------- release ----------

/** Move the Unreleased entries under "## [version] - date". Pure: returns the new text or throws. */
export function release(text, version, date, { today = date } = {}) {
  const v = parseSemver(version);
  if (!v) throw new Error(`"${version}" is not a semantic version like 1.2.3 or 1.0.0-rc.1`);
  if (!isRealDate(date)) throw new Error(`"${date}" is not a real date in YYYY-MM-DD form`);
  if (!isRealDate(today)) throw new Error(`"${today}" is not a real date in YYYY-MM-DD form`);
  const problems = validate(text, { today });
  if (problems.length) throw new Error(`${FILE} is not valid; fix it first:\n  ${problems.join('\n  ')}`);

  const doc = parse(text);
  const newest = doc.sections.find((s) => s.kind === 'version');
  if (newest && compareSemver(v, newest.version) <= 0)
    throw new Error(`${version} must be greater than the newest release, ${newest.version}`);
  if (newest && date < newest.date) throw new Error(`${date} is before the newest release's date (${newest.date})`);
  if (date > addDays(today, 1)) throw new Error(`${date} is in the future`);

  const u = doc.sections[0];
  const body = unreleasedBody(doc, u);
  if (!body.some((l) => l.role === 'item')) throw new Error('[Unreleased] has no entries; there is nothing to release');

  const keep = body.filter((l) => l.role === 'comment').map((l) => l.line);
  let moved = body.filter((l) => l.role !== 'comment');
  // Drop ### and #### groups that hold no entries.
  const drop = new Set();
  moved.forEach((l, i) => {
    if (l.role !== 'type' && l.role !== 'area') return;
    let j = i + 1;
    while (j < moved.length && !((moved[j].role === 'type' || moved[j].role === 'area') && moved[j].level <= l.level)) j++;
    if (!moved.slice(i + 1, j).some((x) => x.role === 'item')) for (let k = i; k < j; k++) drop.add(k);
  });
  moved = moved.filter((_, i) => !drop.has(i)).map((l) => l.line);
  moved = tidy(moved);

  const out = [
    ...doc.lines.slice(0, u.start),
    '## [Unreleased]',
    '',
    ...(keep.length ? [...keep, ''] : []),
    `## [${version}] - ${date}`,
    '',
    ...moved,
    '',
    ...doc.lines.slice(u.end),
  ];
  const result = `${out.join('\n').replace(/\n+$/, '')}\n`;
  const after = validate(result, { today });
  if (after.length) throw new Error(`internal error, release produced an invalid file:\n  ${after.join('\n  ')}`);
  return result;
}

/** Trim blank lines at both ends and collapse runs of blank lines. */
function tidy(lines) {
  const out = [];
  for (const l of lines) if (l.trim() || (out.length && out[out.length - 1].trim())) out.push(l);
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

/** The heading and body of one section, without HTML comments. Unreleased when no version is given. */
export function notes(text, version) {
  const doc = parse(text);
  const sec = version
    ? doc.sections.find((s) => s.kind === 'version' && s.version === version)
    : doc.sections.find((s) => s.kind === 'unreleased');
  if (!sec) throw new Error(version ? `${version} is not in ${FILE}` : `${FILE} has no [Unreleased] section`);
  const body = [];
  for (let i = sec.start + 1; i < sec.end; i++) if (doc.kinds[i] !== 'comment') body.push(doc.lines[i]);
  return [sec.heading, '', ...tidy(body)].join('\n').trimEnd();
}

// ---------- package.json ----------

const PACKAGE_FILES = ['package.json', 'package-lock.json'];

/** package.json "version" must be "0.0.0" (version not tracked there) or the newest release. */
export function checkPackageJson(root, newest) {
  const p = join(root, 'package.json');
  if (!existsSync(p)) return [];
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    return [`package.json: not valid JSON (${e.message})`];
  }
  if (pkg.version === undefined || pkg.version === '0.0.0' || pkg.version === newest) return [];
  return [
    `package.json: "version" is "${pkg.version}" but must be "0.0.0"${newest ? ` or "${newest}", the newest release in ${FILE}` : ` (nothing has been released yet)`}`,
  ];
}

/** After a release, move package.json and package-lock.json along if they tracked the previous version. */
export function syncPackageVersion(root, previous, next) {
  const changed = [];
  if (!previous) return changed;
  for (const name of PACKAGE_FILES) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, 'utf8');
    const obj = JSON.parse(raw);
    let touched = false;
    if (obj.version === previous) {
      obj.version = next;
      touched = true;
    }
    if (obj.packages?.['']?.version === previous) {
      obj.packages[''].version = next;
      touched = true;
    }
    if (!touched) continue;
    const indent = /^\{\r?\n([ \t]+)"/.exec(raw)?.[1] ?? 2;
    writeFileSync(p, JSON.stringify(obj, null, indent) + (raw.endsWith('\n') ? '\n' : ''));
    changed.push(name);
  }
  return changed;
}

// ---------- git ----------

function git(root, args, { trim = true } = {}) {
  try {
    const out = execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
    return trim ? out.trim() : out;
  } catch {
    return null;
  }
}

const fileAt = (root, rev) => git(root, ['show', `${rev}:./${FILE}`], { trim: false });
const hasVersion = (text, v) => !!text && versionsIn(text).includes(v);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Exactly "Release v1.2.3". Squash and rebase merges are off, so the release commit keeps its own subject. */
export function isReleaseSubject(subject, version) {
  return subject === `Release v${version}`;
}

/** Commits in a range as { hash, parents, subject }. */
function commits(root, range) {
  const out = git(root, ['log', '--format=%H%x1f%P%x1f%s', range]);
  if (out === null) return null;
  return out
    .split('\n')
    .filter(Boolean)
    .map((row) => {
      const [hash, parents, subject] = row.split('\x1f');
      return { hash, parents: parents ? parents.split(' ') : [], subject };
    });
}

const RELEASE_FILES = [FILE, ...PACKAGE_FILES];

/**
 * Why commit c is not the release commit that added `version`, or null when it is: titled
 * "Release v<version>", one parent, the version new in it, and nothing changed but
 * CHANGELOG.md, package.json and package-lock.json.
 */
function releaseProblem(root, c, version) {
  if (!isReleaseSubject(c.subject, version)) return 'not titled "Release v<version>"';
  if (!hasVersion(fileAt(root, c.hash), version)) return `${FILE} does not have the version`;
  if (c.parents.length > 1) return 'a merge commit cannot be a release commit';
  if (c.parents.length && hasVersion(fileAt(root, c.parents[0]), version)) return 'the version was already there';
  const changed = (git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', c.hash]) ?? '').split('\n').filter(Boolean);
  const other = changed.filter((f) => !RELEASE_FILES.includes(f));
  if (other.length) return `it also changes ${other.slice(0, 3).join(', ')}${other.length > 3 ? ' …' : ''}; a release commit changes only ${RELEASE_FILES.join(', ')}`;
  return null;
}

/** One released section as shipped: its heading without [YANKED], and its visible body. */
function releasedSection(text, version) {
  if (!text) return null;
  const doc = parse(text);
  const s = doc.sections.find((x) => x.kind === 'version' && x.version === version);
  if (!s) return null;
  const body = [];
  for (let i = s.start + 1; i < s.end; i++) {
    const line = doc.lines[i];
    if (doc.kinds[i] !== 'comment' && line.trim() && !LINK_DEF.test(line)) body.push(line.trimEnd());
  }
  return { heading: `## [${s.version}] - ${s.date}`, yanked: s.yanked, body: body.join('\n') };
}

/** Released notes stay as shipped; the only later change allowed is adding " [YANKED]". */
function sectionChange(was, now) {
  if (!was || !now) return null;
  if (was.heading !== now.heading) return `its heading changed from "${was.heading}" to "${now.heading}"`;
  if (was.yanked && !now.yanked) return '"[YANKED]" was removed';
  if (was.body !== now.body) return 'its notes changed';
  return null;
}

/**
 * Every version heading that is new since `base` must have been added by its own
 * release commit ("Release v<version>") between base and HEAD. Released versions
 * may not disappear, and their headings and notes may not change afterwards (except
 * for adding " [YANKED]"). A missing or all-zero base means the whole history of HEAD.
 */
export function checkAgainstBase(root, base, text) {
  const errors = [];
  if (git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']) === null)
    return [`--base: ${root} is not a git repository with commits`];
  let range = 'HEAD';
  let baseText = null;
  if (base && !/^0+$/.test(base)) {
    const sha = git(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
    if (!sha) return [`--base: cannot find "${base}" (in CI, check out with fetch-depth: 0)`];
    const mb = git(root, ['merge-base', sha, 'HEAD']) || sha;
    range = `${mb}..HEAD`;
    baseText = fileAt(root, mb);
  }
  const changed = (v, was) => {
    const why = sectionChange(was, releasedSection(text, v));
    if (why) errors.push(`released version ${v}: ${why} after it shipped; released notes stay as they were (the owner may only add " [YANKED]")`);
  };
  const before = baseText ? versionsIn(baseText) : [];
  const now = versionsIn(text);
  for (const v of before) {
    if (!now.includes(v)) errors.push(`released version ${v} was removed or renumbered; released versions stay (mark a bad one [YANKED])`);
    else changed(v, releasedSection(baseText, v));
  }
  const added = now.filter((v) => !before.includes(v));
  if (!added.length) return errors;
  const list = commits(root, range) ?? [];
  for (const v of added) {
    const candidates = list.filter((c) => isReleaseSubject(c.subject, v));
    const ok = candidates.find((c) => !releaseProblem(root, c, v));
    if (ok) changed(v, releasedSection(fileAt(root, ok.hash), v));
    else if (candidates.length) errors.push(`version ${v}: commit ${candidates[0].hash.slice(0, 7)} "${candidates[0].subject}" is not a valid release commit: ${releaseProblem(root, candidates[0], v)}. ${POLICY}`);
    else errors.push(`version ${v} was added without its release commit. ${POLICY}`);
  }
  return errors;
}

/** A v* tag must name the newest release and sit on that release's commit. */
export function checkTag(root, tag, text) {
  const m = /^v(.+)$/.exec(tag);
  if (!m || !parseSemver(m[1])) return [`tag "${tag}": v* tags are reserved for releases and must be v<x.y.z>`];
  const version = m[1];
  const newest = versionsIn(text)[0];
  if (newest !== version)
    return [`tag ${tag} does not match the newest release in ${FILE} (${newest ?? 'none'}). ${POLICY}`];
  const head = commits(root, '-1') ?? [];
  const why = head.length ? releaseProblem(root, head[0], version) : 'no commit';
  if (why) return [`tag ${tag} must point at the commit "Release ${tag}" that added ${version} to ${FILE} (${why})`];
  return [];
}

// ---------- CLI ----------

const USAGE = `usage:
  node scripts/changelog.mjs check [--base <git-ref>] [--tag <tag>]
  node scripts/changelog.mjs release <version> [--date YYYY-MM-DD]
  node scripts/changelog.mjs notes [<version>]`;

function parseArgs(argv, allowed) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const key = a.slice(2);
    const value = argv[i + 1];
    if (!allowed.includes(key) || value === undefined || value.startsWith('--')) throw new UsageError(`bad option ${a}`);
    opts[key] = value;
    i++;
  }
  return { positional, opts };
}

class UsageError extends Error {}

/** Runs one command. Returns the exit code: 0 ok, 1 refused or invalid, 2 usage. */
export function main(argv, { root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), now = new Date(), out = console.log, err = console.error } = {}) {
  const today = now.toISOString().slice(0, 10);
  const [command, ...rest] = argv;
  try {
    const path = join(root, FILE);
    if (!existsSync(path)) {
      err(`${FILE} not found in ${root}`);
      return 1;
    }
    const text = readFileSync(path, 'utf8');

    if (command === 'check') {
      const { positional, opts } = parseArgs(rest, ['base', 'tag']);
      if (positional.length) throw new UsageError('check takes no positional arguments');
      const errors = validate(text, { today });
      errors.push(...checkPackageJson(root, versionsIn(text)[0]));
      if (!errors.length && 'base' in opts) errors.push(...checkAgainstBase(root, opts.base, text));
      if (!errors.length && 'tag' in opts) errors.push(...checkTag(root, opts.tag, text));
      if (errors.length) {
        err(`${FILE}: ${errors.length} problem${errors.length > 1 ? 's' : ''}\n  ${errors.join('\n  ')}`);
        return 1;
      }
      const newest = versionsIn(text)[0];
      out(`${FILE} OK: ${countEntries(text)} unreleased entr${countEntries(text) === 1 ? 'y' : 'ies'}; newest release ${newest ?? 'none yet'}`);
      return 0;
    }

    if (command === 'release') {
      const { positional, opts } = parseArgs(rest, ['date']);
      if (positional.length !== 1) throw new UsageError('release takes exactly one version');
      const version = positional[0].replace(/^v(?=\d)/, '');
      const date = opts.date ?? localToday(now);
      if (git(root, ['rev-parse', '--verify', '--quiet', `refs/tags/v${version}`]))
        throw new Error(`tag v${version} already exists; versions are never reused`);
      const previous = versionsIn(text)[0];
      const next = release(text, version, date, { today });
      writeFileSync(path, next);
      const changed = [FILE, ...syncPackageVersion(root, previous, version)];
      out(`Stamped ${version} (${date}) in ${changed.join(', ')}. Nothing is committed, tagged or pushed.\n`);
      out(notes(next, version));
      return 0;
    }

    if (command === 'notes') {
      const { positional } = parseArgs(rest, []);
      if (positional.length > 1) throw new UsageError('notes takes at most one version');
      out(notes(text, positional[0]?.replace(/^v(?=\d)/, '')));
      return 0;
    }

    throw new UsageError(command ? `unknown command "${command}"` : 'no command');
  } catch (e) {
    if (e instanceof UsageError) {
      err(`${e.message}\n${USAGE}`);
      return 2;
    }
    err(e.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
