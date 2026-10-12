// Tests for scripts/changelog.mjs. Run: node --test "scripts/*.test.mjs"
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkAgainstBase,
  checkPackageJson,
  checkTag,
  compareSemver,
  countEntries,
  isReleaseSubject,
  main,
  notes,
  parseSemver,
  release,
  validate,
  versionsIn,
} from './changelog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// A fixed date for the synthetic fixtures only. The repository's own CHANGELOG.md is
// checked against the real clock, so a release the owner ships later never turns CI red.
const TODAY = '2026-10-12';

const HEAD = `# Changelog

Intro text with a [link](https://example.com).

## [Unreleased]

<!-- Entries go here. -->
`;

const EMPTY = `${HEAD}
Nothing yet.
`;

const WITH_ENTRIES = `${HEAD}
### Added

- Draw bus lines on Boston's real streets.
- Tilt the map from flat 2D into 3D,
  and back again.

### Changed

### Fixed

- Buses no longer drive tail-first.
`;

const RELEASED = `${HEAD}
### Fixed

- A stop can be deleted again.

## [0.2.0] - 2026-10-10

### Added

- Depots.

## [0.1.0] - 2026-10-01 [YANKED]

- First playable.
`;

const fails = (text, pattern) => {
  const errors = validate(text, { today: TODAY });
  assert.ok(errors.some((e) => pattern.test(e)), `expected an error matching ${pattern}, got:\n${errors.join('\n')}`);
};

describe('semver', () => {
  test('accepts x.y.z and pre-releases', () => {
    for (const v of ['0.0.1', '1.2.3', '10.20.30', '1.0.0-rc.1', '1.0.0-alpha', '1.0.0-0.3.7', '1.0.0-x-y.7'])
      assert.ok(parseSemver(v), v);
  });
  test('rejects other forms', () => {
    for (const v of ['1.0', '1', 'v1.0.0', '01.0.0', '1.01.0', '1.0.0+build.1', '1.0.0-', '1.0.0-01', ' 1.0.0', 'latest'])
      assert.equal(parseSemver(v), null, v);
  });
  test('orders by precedence', () => {
    const ordered = ['0.9.0', '0.10.0', '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', '1.0.1', '2.0.0'];
    for (let i = 0; i + 1 < ordered.length; i++) {
      assert.equal(compareSemver(ordered[i], ordered[i + 1]), -1, `${ordered[i]} < ${ordered[i + 1]}`);
      assert.equal(compareSemver(ordered[i + 1], ordered[i]), 1);
    }
    assert.equal(compareSemver('1.0.0-rc.1', '1.0.0-rc.1'), 0);
  });
});

/** Runs the CLI in `dir` and collects what it prints. */
const run = (dir, argv, now = new Date(`${TODAY}T12:00:00Z`)) => {
  const lines = [];
  const code = main(argv, { root: dir, now, out: (s) => lines.push(s), err: (s) => lines.push(s) });
  return { code, text: lines.join('\n') };
};

/** What CI checks on the repository's own CHANGELOG.md: the real date, never TODAY. */
const checkRepoChangelog = (dir, now = new Date()) => run(dir, ['check'], now);

describe('check: format', () => {
  test('the repository CHANGELOG.md is valid', () => {
    const r = checkRepoChangelog(ROOT);
    assert.equal(r.code, 0, r.text);
  });
  test('a release dated after the fixed TODAY keeps the repository check green', () => {
    const later = new Date(Date.now() + 365 * 86400000);
    const laterDay = later.toISOString().slice(0, 10);
    const realDay = new Date().toISOString().slice(0, 10);
    for (const [date, now] of [[realDay, new Date()], [laterDay, later]]) {
      const r = repo();
      let text = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
      if (!countEntries(text))
        text = text.replace(/^Nothing yet\b.*\n?/m, '').replace(/^## \[Unreleased\]\n/m, '## [Unreleased]\n\n### Added\n\n- A test entry.\n');
      r.commit('Start', { 'CHANGELOG.md': text });
      const rel = run(r.dir, ['release', '999.0.0', '--date', date], now);
      assert.equal(rel.code, 0, rel.text);
      const res = checkRepoChangelog(r.dir, now);
      assert.equal(res.code, 0, `${date}: ${res.text}`);
      if (date > '2026-10-13') fails(r.read(), /in the future/); // what the old fixed-date check reported
    }
  });
  test('valid files pass', () => {
    for (const t of [EMPTY, WITH_ENTRIES, RELEASED, HEAD]) assert.deepEqual(validate(t, { today: TODAY }), []);
  });
  test('CRLF line endings are fine', () => {
    assert.deepEqual(validate(RELEASED.replace(/\n/g, '\r\n'), { today: TODAY }), []);
  });
  test('the title must be "# Changelog"', () => fails(`# Notes\n\n## [Unreleased]\n`, /must start with "# Changelog"/));
  test('Unreleased is required', () => fails(`# Changelog\n\n## [0.1.0] - 2026-10-01\n\n- x\n`, /first section must be exactly "## \[Unreleased\]"/));
  test('Unreleased must be spelled exactly', () => fails(`# Changelog\n\n## Unreleased\n`, /first section must be exactly/));
  test('Unreleased must come first', () =>
    fails(`# Changelog\n\n## [0.1.0] - 2026-10-01\n\n- x\n\n## [Unreleased]\n`, /first section must be exactly|only once/));
  test('Unreleased appears once', () => fails(`${EMPTY}\n## [Unreleased]\n`, /only once/));
  test('version headings need brackets and a date', () => {
    fails(`${EMPTY}\n## 0.1.0 - 2026-10-01\n`, /is not "## \[Unreleased\]" or "## \[x.y.z\] - YYYY-MM-DD"/);
    fails(`${EMPTY}\n## [0.1.0]\n`, /is not "## \[Unreleased\]"/);
    fails(`${EMPTY}\n## [0.1.0] – 2026-10-01\n`, /is not "## \[Unreleased\]"/);
    fails(`${EMPTY}\n## Notes\n`, /is not "## \[Unreleased\]"/);
  });
  test('versions must be semver without a v', () => {
    fails(`${EMPTY}\n## [v0.1.0] - 2026-10-01\n`, /drop the "v"/);
    fails(`${EMPTY}\n## [0.1] - 2026-10-01\n`, /not a semantic version/);
    fails(`${EMPTY}\n## [0.1.0+b1] - 2026-10-01\n`, /no build metadata/);
  });
  test('dates must be real, and not in the future', () => {
    fails(`${EMPTY}\n## [0.1.0] - 2026-02-30\n`, /not a real date/);
    fails(`${EMPTY}\n## [0.1.0] - 10/01/2026\n`, /not a real date/);
    fails(`${EMPTY}\n## [0.1.0] - 2026-10-20\n`, /in the future/);
    assert.deepEqual(validate(`${EMPTY}\n## [0.1.0] - 2026-10-13\n`, { today: TODAY }), [], 'one day of time-zone slack');
  });
  test('versions run newest first, strictly', () => {
    fails(`${EMPTY}\n## [0.1.0] - 2026-10-01\n\n## [0.2.0] - 2026-10-02\n`, /listed below 0.1.0; newest version first/);
    fails(`${EMPTY}\n## [0.1.0] - 2026-10-02\n\n## [0.1.0] - 2026-10-01\n`, /appears twice/);
    fails(`${EMPTY}\n## [1.0.0-rc.1] - 2026-10-02\n\n## [1.0.0] - 2026-10-01\n`, /newest version first/);
  });
  test('dates may not go backwards', () =>
    fails(`${EMPTY}\n## [0.2.0] - 2026-10-01\n\n## [0.1.0] - 2026-10-05\n`, /dated after the newer 0.2.0/));
  test('Unreleased entries sit under a known ### type', () => {
    fails(`${HEAD}\n- Loose entry.\n`, /under a ### heading/);
    fails(`${HEAD}\n### New stuff\n\n- x\n`, /not allowed in \[Unreleased\]/);
    fails(`${HEAD}\n#### Map\n\n- x\n`, /not allowed in \[Unreleased\]/);
    assert.deepEqual(validate(`${HEAD}\n### Added\n\n#### Map\n\n- Tilt to 3D.\n`, { today: TODAY }), [], '#### areas inside a type');
  });
  test('the "Nothing yet" note must go once there are entries', () =>
    fails(`${HEAD}\nNothing yet.\n\n### Added\n\n- x\n`, /holds only "- " entries/));
  test('headings inside code fences and comments are ignored', () => {
    assert.deepEqual(validate(`${HEAD}\n<!--\n## [9.9.9] - 2099-01-01\n-->\n\n## [0.1.0] - 2026-10-01\n\n\`\`\`\n## not a heading\n\`\`\`\n`, { today: TODAY }), []);
    assert.deepEqual(versionsIn(`${HEAD}\n~~~~\n~~~\n## [9.9.9] - 2099-01-01\n~~~~\n`), [], 'a fence closes only on its own character, at least as long');
  });
  test('headings GitHub renders are seen, wherever they hide', () => {
    fails(`${EMPTY}\n ## [0.1.0] - 2026-10-01\n`, /remove the spaces before "#"/);
    fails(`${EMPTY}\n   ### Added\n`, /remove the spaces before "#"/);
    fails(`${EMPTY}\n[0.1.0] - 2026-10-01\n---\n`, /turns that text into a heading/);
    fails(`${EMPTY}\n<h2>[0.1.0] - 2026-10-01</h2>\n`, /HTML headings/);
    fails(`${EMPTY}\n## [0.1.0] - 2026-10-01\n\n#### Map fixes in 0.2.0\n`, /has a version number/);
    assert.deepEqual(versionsIn(`${EMPTY}\n    \`\`\`\n\n## [0.1.0] - 2026-10-01\n`), ['0.1.0'], 'a fence indented four spaces is not a fence');
    assert.deepEqual(versionsIn(`${EMPTY}\n\`\`\`a\`b\n\n## [0.1.0] - 2026-10-01\n`), ['0.1.0'], 'a backtick in a backtick info string means no fence');
    assert.deepEqual(versionsIn(`${EMPTY}\n    <!--\n## [0.1.0] - 2026-10-01\n`), ['0.1.0'], 'an indented <!-- is not a comment');
    assert.deepEqual(versionsIn(`${EMPTY}\n- x\n  \`\`\`\n## [0.1.0] - 2026-10-01\n`), ['0.1.0'], 'a dedented line ends a list item fence');
  });
  test('a rule under a list item is not a heading', () => {
    assert.deepEqual(validate(`${HEAD}\n### Added\n\n- x\n---\n`, { today: TODAY }), []);
  });
  test('[Unreleased] holds at most one short note, before any heading, with no version number', () => {
    fails(`${EMPTY}\nAnd a second paragraph.\n`, /one short note paragraph/);
    fails(`${HEAD}\n### Added\n\nNothing yet.\n`, /goes before the first ### heading/);
    fails(`${HEAD}\nNothing yet; 0.1.0 is next.\n`, /version number outside an entry/);
    assert.deepEqual(validate(`${HEAD}\n### Fixed\n\n- Saves from 0.1.0 load again.\n`, { today: TODAY }), [], 'an entry may name a version');
  });
  test('counts entries', () => {
    assert.equal(countEntries(EMPTY), 0);
    assert.equal(countEntries(WITH_ENTRIES), 3);
  });
});

describe('release', () => {
  test('moves entries under a dated version and empties Unreleased', () => {
    const out = release(WITH_ENTRIES, '0.1.0', TODAY);
    assert.deepEqual(validate(out, { today: TODAY }), []);
    assert.equal(countEntries(out), 0);
    assert.equal(
      out,
      `# Changelog

Intro text with a [link](https://example.com).

## [Unreleased]

<!-- Entries go here. -->

## [0.1.0] - 2026-10-12

### Added

- Draw bus lines on Boston's real streets.
- Tilt the map from flat 2D into 3D,
  and back again.

### Fixed

- Buses no longer drive tail-first.
`,
      'empty ### Changed is dropped, the comment stays in Unreleased',
    );
  });
  test('stacks above earlier versions', () => {
    const out = release(RELEASED, '0.2.1', TODAY);
    assert.match(out, /## \[Unreleased\]\n\n<!-- Entries go here. -->\n\n## \[0.2.1\] - 2026-10-12\n\n### Fixed\n\n- A stop can be deleted again.\n\n## \[0.2.0\] - 2026-10-10\n/);
    assert.deepEqual(validate(out, { today: TODAY }), []);
  });
  test('refuses an empty Unreleased', () => {
    assert.throws(() => release(EMPTY, '0.1.0', TODAY), /no entries; there is nothing to release/);
    assert.throws(() => release(`${HEAD}\n### Added\n`, '0.1.0', TODAY), /no entries/);
  });
  test('refuses a version that is not greater than the newest', () => {
    assert.throws(() => release(RELEASED, '0.2.0', TODAY), /must be greater than the newest release, 0.2.0/);
    assert.throws(() => release(RELEASED, '0.1.5', TODAY), /must be greater/);
    assert.doesNotThrow(() => release(RELEASED, '0.2.1-rc.1', TODAY), '0.2.1-rc.1 is above 0.2.0');
  });
  test('refuses a malformed version or date', () => {
    assert.throws(() => release(WITH_ENTRIES, '1.0', TODAY), /not a semantic version/);
    assert.throws(() => release(WITH_ENTRIES, 'v1.0.0', TODAY), /not a semantic version/);
    assert.throws(() => release(WITH_ENTRIES, '0.1.0', '2026-13-01'), /not a real date/);
    assert.throws(() => release(WITH_ENTRIES, '0.1.0', '2026-12-01', { today: TODAY }), /in the future/);
    assert.throws(() => release(RELEASED, '0.3.0', '2026-10-09'), /before the newest release's date/);
  });
  test('refuses to work on an invalid file', () => {
    assert.throws(() => release(`${WITH_ENTRIES}\n## 0.0.1\n`, '0.1.0', TODAY), /not valid; fix it first/);
  });
  test('notes prints one section without comments', () => {
    assert.equal(notes(RELEASED, '0.2.0'), '## [0.2.0] - 2026-10-10\n\n### Added\n\n- Depots.');
    assert.equal(notes(RELEASED), '## [Unreleased]\n\n### Fixed\n\n- A stop can be deleted again.');
    assert.throws(() => notes(RELEASED, '9.9.9'), /not in CHANGELOG.md/);
  });
});

// ---------- git-backed rules ----------

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-test-'));
  dirs.push(dir);
  const env = {
    ...process.env,
    HOME: dir,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
  };
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8' }).trim();
  git('-c', 'init.defaultBranch=main', 'init', '-q');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  const write = (name, text) => writeFileSync(join(dir, name), text);
  const commit = (subject, files = {}) => {
    for (const [name, text] of Object.entries(files)) write(name, text);
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', subject);
    return git('rev-parse', 'HEAD');
  };
  const read = () => readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
  return { dir, git, write, commit, read };
}

const V1 = release(WITH_ENTRIES, '0.1.0', '2026-10-05');
const V1_MORE = V1.replace('<!-- Entries go here. -->\n', '<!-- Entries go here. -->\n\n### Added\n\n- Night roads.\n');
const V2 = release(V1_MORE, '0.2.0', TODAY);

describe('check --base', () => {
  test('a version added by a plain commit fails', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Polish the map and bump the version', { 'CHANGELOG.md': V1 });
    const errors = checkAgainstBase(r.dir, base, r.read());
    assert.equal(errors.length, 1);
    assert.match(errors[0], /version 0.1.0 was added without its release commit/);
  });
  test('a later commit titled "Release v…" does not bless a version added earlier', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Map polish', { 'CHANGELOG.md': V1 });
    r.commit('Release v0.1.0');
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /version 0.1.0: .* is not a valid release commit: the version was already there/);
    r.git('tag', 'v0.1.0');
    assert.match(checkTag(r.dir, 'v0.1.0', r.read())[0], /must point at the commit "Release v0.1.0"/);
  });
  test('an uncommitted version heading fails', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.write('CHANGELOG.md', V1);
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /without its release commit/);
  });
  test('the release commit passes, also with later commits and a merge on top', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    const mainBranch = r.git('rev-parse', '--abbrev-ref', 'HEAD');
    r.git('checkout', '-q', '-b', 'feature');
    r.commit('Release v0.1.0', { 'CHANGELOG.md': V1 });
    assert.deepEqual(checkAgainstBase(r.dir, base, r.read()), []);
    r.commit('Add night roads', { 'CHANGELOG.md': V1_MORE });
    assert.deepEqual(checkAgainstBase(r.dir, base, r.read()), []);
    r.git('checkout', '-q', mainBranch);
    r.commit('Unrelated work', { 'notes.txt': 'x' });
    r.git('merge', '-q', '--no-ff', '-m', 'Merge pull request #3 from feature', 'feature');
    assert.deepEqual(checkAgainstBase(r.dir, base, r.read()), []);
  });
  test('only the exact subject counts; squash and rebase merges are off', () => {
    assert.ok(isReleaseSubject('Release v0.1.0', '0.1.0'));
    for (const s of ['Release v0.1.0 (#12)', 'Release 0.1.0', 'release v0.1.0', 'Release v0.1.0 and fixes', 'Release v0.1.01', 'Release v0x1x0'])
      assert.equal(isReleaseSubject(s, '0.1.0'), false, s);
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Release v0.1.0 (#12)', { 'CHANGELOG.md': V1 });
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /without its release commit/);
  });
  test('a release commit that also changes code fails', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Release v0.1.0', { 'CHANGELOG.md': V1, 'game.js': 'cheat()\n' });
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /also changes game.js/);
    r.git('tag', 'v0.1.0');
    assert.match(checkTag(r.dir, 'v0.1.0', r.read())[0], /also changes game.js/);
  });
  test('a merge commit titled "Release v…" is not a release commit', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    const mainBranch = r.git('rev-parse', '--abbrev-ref', 'HEAD');
    r.git('checkout', '-q', '-b', 'side');
    r.commit('Map polish', { 'CHANGELOG.md': V1 });
    r.git('checkout', '-q', mainBranch);
    r.commit('Unrelated', { 'notes.txt': 'x' });
    r.git('merge', '-q', '--no-ff', '-m', 'Release v0.1.0', 'side');
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /a merge commit cannot be a release commit/);
  });
  test('released notes and dates stay as shipped; only [YANKED] may be added', () => {
    const r = repo();
    r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    const base = r.commit('Release v0.1.0', { 'CHANGELOG.md': V1 });
    r.commit('Tidy notes', { 'CHANGELOG.md': V1.replace('- Buses no longer drive tail-first.', '- Buses no longer drive tail-first.\n- And more.') });
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /released version 0.1.0: its notes changed/);
    r.commit('Redate', { 'CHANGELOG.md': V1.replace('## [0.1.0] - 2026-10-05', '## [0.1.0] - 2026-10-06') });
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /its heading changed/);
    const yanked = V1.replace('## [0.1.0] - 2026-10-05', '## [0.1.0] - 2026-10-05 [YANKED]');
    const y = r.commit('Yank 0.1.0', { 'CHANGELOG.md': yanked });
    assert.deepEqual(checkAgainstBase(r.dir, base, r.read()), []);
    r.commit('Unyank', { 'CHANGELOG.md': V1 });
    assert.match(checkAgainstBase(r.dir, y, r.read())[0], /"\[YANKED\]" was removed/);
  });
  test('notes edited after the release commit in the same push fail', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Release v0.1.0', { 'CHANGELOG.md': V1 });
    r.commit('Reword', { 'CHANGELOG.md': V1.replace('tail-first', 'backwards') });
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /released version 0.1.0: its notes changed/);
  });
  test('a release commit for one version does not cover another', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Release v0.1.0', { 'CHANGELOG.md': V2 });
    const errors = checkAgainstBase(r.dir, base, r.read());
    assert.equal(errors.length, 1);
    assert.match(errors[0], /version 0.2.0 was added without/);
  });
  test('two releases in one push each need their own commit', () => {
    const r = repo();
    const base = r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Release v0.1.0', { 'CHANGELOG.md': V1 });
    r.commit('Add night roads', { 'CHANGELOG.md': V1_MORE });
    r.commit('Release v0.2.0', { 'CHANGELOG.md': V2 });
    assert.deepEqual(checkAgainstBase(r.dir, base, r.read()), []);
  });
  test('a released version may not be removed', () => {
    const r = repo();
    r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    const base = r.commit('Release v0.1.0', { 'CHANGELOG.md': V1 });
    r.commit('Tidy', { 'CHANGELOG.md': WITH_ENTRIES });
    assert.match(checkAgainstBase(r.dir, base, r.read())[0], /released version 0.1.0 was removed/);
  });
  test('an all-zero base checks the whole history', () => {
    const r = repo();
    r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Release v0.1.0', { 'CHANGELOG.md': V1 });
    assert.deepEqual(checkAgainstBase(r.dir, '0000000000000000000000000000000000000000', r.read()), []);
    const r2 = repo();
    r2.commit('Start', { 'CHANGELOG.md': V1 });
    assert.match(checkAgainstBase(r2.dir, '0000000000000000000000000000000000000000', r2.read())[0], /without its release commit/);
  });
  test('an unknown base fails loudly', () => {
    const r = repo();
    r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    assert.match(checkAgainstBase(r.dir, 'no-such-ref', r.read())[0], /cannot find "no-such-ref"/);
  });
});

describe('check --base: a feature commit cannot slip a version past the check', () => {
  const cases = {
    'a heading indented one to three spaces': `${EMPTY}\n ## [0.1.0] - ${TODAY}\n`,
    'a setext heading': `${EMPTY}\n[0.1.0] - ${TODAY}\n---\n`,
    'an HTML heading': `${EMPTY}\n<h2>[0.1.0] - ${TODAY}</h2>\n`,
    'a fence line indented four spaces': `${EMPTY}\n    \`\`\`\n\n## [0.1.0] - ${TODAY}\n\n### Added\n\n- x\n`,
    'a backtick line that is not a fence': `${EMPTY}\n\`\`\`a\`b\n\n## [0.1.0] - ${TODAY}\n\n### Added\n\n- x\n`,
  };
  for (const [name, text] of Object.entries(cases))
    test(`${name} fails`, () => {
      const r = repo();
      const base = r.commit('Start', { 'CHANGELOG.md': EMPTY });
      r.commit('Polish the map', { 'CHANGELOG.md': text });
      const res = run(r.dir, ['check', '--base', base]);
      assert.equal(res.code, 1, res.text);
    });
});

describe('check --tag', () => {
  test('a tag on the release commit of the newest version passes', () => {
    const r = repo();
    r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Release v0.1.0', { 'CHANGELOG.md': V1 });
    assert.deepEqual(checkTag(r.dir, 'v0.1.0', r.read()), []);
  });
  test('other v* tags fail', () => {
    const r = repo();
    r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    r.commit('Release v0.1.0', { 'CHANGELOG.md': V1 });
    assert.match(checkTag(r.dir, 'v0.2.0', r.read())[0], /does not match the newest release in CHANGELOG.md \(0.1.0\)/);
    assert.match(checkTag(r.dir, 'v1', r.read())[0], /must be v<x.y.z>/);
    assert.match(checkTag(r.dir, 'very-early', r.read())[0], /must be v<x.y.z>/);
    r.commit('Fix a typo after the release', { 'notes.txt': 'x' });
    assert.match(checkTag(r.dir, 'v0.1.0', r.read())[0], /must point at the commit "Release v0.1.0"/);
  });
  test('a version tag with nothing released fails', () => {
    const r = repo();
    r.commit('Start', { 'CHANGELOG.md': WITH_ENTRIES });
    assert.match(checkTag(r.dir, 'v0.1.0', r.read())[0], /newest release in CHANGELOG.md \(none\)/);
  });
});

describe('package.json', () => {
  test('version must be 0.0.0 or the newest release', () => {
    const r = repo();
    r.write('package.json', '{ "name": "interbus", "version": "0.0.0" }\n');
    assert.deepEqual(checkPackageJson(r.dir, undefined), []);
    assert.deepEqual(checkPackageJson(r.dir, '0.2.0'), []);
    r.write('package.json', '{ "name": "interbus", "version": "1.0.0" }\n');
    assert.match(checkPackageJson(r.dir, undefined)[0], /"version" is "1.0.0" but must be "0.0.0" \(nothing has been released yet\)/);
    assert.match(checkPackageJson(r.dir, '0.2.0')[0], /must be "0.0.0" or "0.2.0"/);
    r.write('package.json', '{ "name": "interbus", "version": "0.2.0" }\n');
    assert.deepEqual(checkPackageJson(r.dir, '0.2.0'), []);
    r.write('package.json', '{ "name": "interbus", "private": true }\n');
    assert.deepEqual(checkPackageJson(r.dir, '0.2.0'), [], 'no version field is fine');
  });
});

describe('command line', () => {

  test('release, then check, end to end', () => {
    const r = repo();
    r.commit('Start', {
      'CHANGELOG.md': WITH_ENTRIES,
      'package.json': '{\n  "name": "interbus",\n  "version": "0.0.0"\n}\n',
    });
    assert.equal(run(r.dir, ['check']).code, 0);
    const rel = run(r.dir, ['release', 'v0.1.0', '--date', '2026-10-11']);
    assert.equal(rel.code, 0, rel.text);
    assert.match(rel.text, /Stamped 0.1.0 \(2026-10-11\) in CHANGELOG.md\. Nothing is committed/);
    assert.match(rel.text, /## \[0.1.0\] - 2026-10-11/);
    assert.match(r.read(), /## \[0.1.0\] - 2026-10-11/);
    assert.match(readFileSync(join(r.dir, 'package.json'), 'utf8'), /"version": "0.0.0"/, '0.0.0 is left alone');
    assert.equal(run(r.dir, ['check', '--base', 'HEAD']).code, 1, 'uncommitted version fails');
    r.commit('Release v0.1.0');
    r.git('tag', 'v0.1.0');
    assert.equal(run(r.dir, ['check', '--base', 'HEAD~1']).code, 0);
    assert.equal(run(r.dir, ['check', '--tag', 'v0.1.0']).code, 0);
    const again = run(r.dir, ['release', '0.1.0']);
    assert.equal(again.code, 1);
    assert.match(again.text, /tag v0.1.0 already exists/);
  });

  test('release keeps a tracked package.json version in step', () => {
    const r = repo();
    r.commit('Start', {
      'CHANGELOG.md': V1_MORE,
      'package.json': '{\n  "name": "interbus",\n  "version": "0.1.0"\n}\n',
      'package-lock.json': '{\n  "name": "interbus",\n  "version": "0.1.0",\n  "lockfileVersion": 3,\n  "packages": {\n    "": {\n      "name": "interbus",\n      "version": "0.1.0"\n    }\n  }\n}\n',
    });
    assert.equal(run(r.dir, ['check']).code, 0);
    const rel = run(r.dir, ['release', '0.2.0']);
    assert.equal(rel.code, 0, rel.text);
    assert.match(rel.text, /in CHANGELOG.md, package.json, package-lock.json/);
    assert.equal(JSON.parse(readFileSync(join(r.dir, 'package.json'), 'utf8')).version, '0.2.0');
    const lock = JSON.parse(readFileSync(join(r.dir, 'package-lock.json'), 'utf8'));
    assert.equal(lock.version, '0.2.0');
    assert.equal(lock.packages[''].version, '0.2.0');
    assert.equal(run(r.dir, ['check']).code, 0);
  });

  test('refusals and usage errors exit non-zero', () => {
    const r = repo();
    r.commit('Start', { 'CHANGELOG.md': EMPTY, 'package.json': '{ "version": "1.0.0" }\n' });
    const bad = run(r.dir, ['check']);
    assert.equal(bad.code, 1);
    assert.match(bad.text, /package.json: "version" is "1.0.0"/);
    assert.equal(run(r.dir, ['release', '0.1.0']).code, 1);
    assert.equal(run(r.dir, ['release']).code, 2);
    assert.equal(run(r.dir, ['check', '--bogus', 'x']).code, 2);
    assert.equal(run(r.dir, ['check', '--base']).code, 2);
    assert.equal(run(r.dir, ['nonsense']).code, 2);
    assert.equal(run(r.dir, []).code, 2);
  });
});

describe('the /ship skill', () => {
  test('only the owner can invoke it', () => {
    const skill = readFileSync(join(ROOT, '.claude/skills/ship/SKILL.md'), 'utf8');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill);
    assert.ok(front, 'SKILL.md has frontmatter');
    assert.match(front[1], /^name: ship$/m);
    assert.match(front[1], /^disable-model-invocation: true$/m);
    assert.doesNotMatch(front[1], /^user-invocable: false$/m);
    assert.match(skill, /\$ARGUMENTS/);
  });
});
