// CI's fixture e2e parts (scripts/e2e-parts.mjs, .github/workflows/ci.yml): every spec file runs in exactly one part, as
// Playwright reads each part's arguments; the workflow runs every part; the seconds table names only specs that exist; and
// no part holds more than 4.5 minutes of tests by Playwright's schedule, so with about 1.4 minutes of setup a part ends
// inside the 8 on a runner a third slower than main's. And the reporter that measures the table again.
// Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { UNMEASURED, byWalk, main, measured, parallelSpecs, parts, span, specs } from './e2e-parts.mjs';
import E2eSeconds from './e2e-seconds.mjs';

const E2E = new URL('../e2e/', import.meta.url);
const CI = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

/** The parts the CI workflow's e2e job runs, from its matrix. */
const matrix = () => {
  const found = /^\s+part: \[([\d, ]+)\]$/m.exec(CI);
  assert.ok(found, 'the e2e job’s matrix of parts');
  return found[1].split(',').map(Number);
};
/** The shell of the e2e job's last step, which runs the part's files, as the runner gets it. */
const partStep = () => {
  const lines = CI.split('\n');
  const at = lines.findIndex((l, i) => l.trim() === '- run: |' && lines[i + 1]?.trim().startsWith('files=$(node scripts/e2e-parts.mjs'));
  assert.ok(at >= 0, 'the step that runs the part’s files');
  const body = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() && !line.startsWith('          ')) break;
    body.push(line.slice(10));
  }
  return body.join('\n').replace(/\n*$/, '\n');
};
/** What the CLI prints for part `k` of `n`, split into Playwright's arguments. */
const argumentsOf = (k, n) => {
  const lines = [];
  assert.equal(main([`${k}/${n}`], { out: (line) => lines.push(line) }), 0);
  assert.equal(lines.length, 1);
  return lines[0].split(' ');
};
/** Whether Playwright's filter for a command-line argument takes the file: the argument as a regular expression, its flags
 *  `gi`, tested against the file's absolute path (forceRegExp and createFileMatcher in playwright/lib/common). */
const takes = (argument, file) => new RegExp(argument, 'gi').test(fileURLToPath(new URL(file, E2E)));

test('every spec file runs in exactly one of CI’s parts, each taken by its own argument alone', () => {
  const n = matrix().length;
  // Every file under e2e/ Playwright's default testMatch takes, a session's own zz- probes among them.
  const all = readdirSync(E2E, { recursive: true })
    .map((f) => String(f).split('\\').join('/'))
    .filter((f) => /\.(spec|test)\.(c|m)?[jt]sx?$/.test(f) && !f.split('/').includes('node_modules'));
  const runs = new Map(specs().map((f) => [f, []]));
  for (let k = 1; k <= n; k++) {
    for (const argument of argumentsOf(k, n)) {
      const taken = all.filter((f) => takes(argument, f));
      assert.deepEqual(taken, [argument.replace(/^e2e\//, '')], `${argument} takes ${taken.join(', ')}`);
      runs.get(taken[0]).push(k);
    }
  }
  assert.ok(runs.size > 40, `${runs.size} specs`);
  assert.deepEqual([...runs].filter(([, ks]) => ks.length !== 1), []);
});

test('the CI workflow runs every part, each with the script’s files for it', () => {
  const ks = matrix();
  assert.deepEqual(ks, Array.from({ length: ks.length }, (_, i) => i + 1));
  assert.ok(ks.length >= 2);
  assert.match(CI, /fail-fast: false/);
  assert.match(partStep(), /^files=\$\(node scripts\/e2e-parts\.mjs \$\{\{ matrix\.part \}\}\/\$\{\{ strategy\.job-total \}\}\)\nnpm run e2e -- \$files\n$/);
  assert.doesNotMatch(CI, /--shard/);
});

test('the part’s step runs Playwright on the script’s files, and fails, running nothing, when the script fails', () => {
  // The step's own shell as a runner runs it (bash -e), with node and npm stubbed: npm records its arguments.
  const run = (nodeStub) => {
    const dir = mkdtempSync(join(tmpdir(), 'e2e-part-'));
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    for (const [name, body] of [['node', nodeStub], ['npm', 'echo "npm $*" >> "$CALLS"']]) {
      writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`);
      chmodSync(join(bin, name), 0o755);
    }
    const script = partStep().replaceAll('${{ matrix.part }}', '3').replaceAll('${{ strategy.job-total }}', '8');
    const calls = join(dir, 'calls');
    const done = spawnSync('bash', ['-e', '-c', script], { env: { PATH: `${bin}:/usr/bin:/bin`, CALLS: calls }, encoding: 'utf8' });
    return { status: done.status, calls: existsSync(calls) ? readFileSync(calls, 'utf8') : '' };
  };
  assert.deepEqual(run('[ "$*" = "scripts/e2e-parts.mjs 3/8" ] && echo "e2e/a.spec.ts e2e/b.spec.ts"'), {
    status: 0,
    calls: 'npm run e2e -- e2e/a.spec.ts e2e/b.spec.ts\n',
  });
  assert.deepEqual(run('echo "Part 3 of 8 holds no spec files" >&2; exit 1'), { status: 1, calls: '' });
});

test('the specs are the files Playwright runs under e2e/, in any folder, in the order it walks them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-specs-'));
  for (const f of ['b.spec.ts', 'a.test.ts', 'i12/main.ts', 'i12/extra.spec.ts', 'i12.spec.ts', 'z/deep/x.spec.mjs', 'zz-probe.spec.ts', 'node_modules/m.spec.ts', 'helper.ts', 'c.spec.tsx']) {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    writeFileSync(join(dir, f), '');
  }
  const found = specs(pathToFileURL(`${dir}/`));
  assert.deepEqual(found, ['a.test.ts', 'b.spec.ts', 'c.spec.tsx', 'i12/extra.spec.ts', 'i12.spec.ts', 'z/deep/x.spec.mjs']);
  // A part's files are in the same order, the folder's own before the file that shares its name.
  assert.deepEqual([...found].reverse().sort(byWalk), found);
});

test('the seconds table names only spec files that exist', () => {
  const files = new Set(specs());
  assert.deepEqual(Object.keys(measured()).filter((f) => !files.has(f)), []);
});

test('no part holds more than 4.5 minutes of tests as Playwright runs them', () => {
  const files = specs();
  const seconds = measured();
  const parallel = parallelSpecs(files);
  const minutes = parts(files, matrix().length, seconds, parallel).map((part) => span(part, seconds, parallel) / 60);
  assert.ok(Math.max(...minutes) <= 4.5, `the parts take ${minutes.map((m) => m.toFixed(2)).join(', ')} minutes`);
});

test('a part’s time is Playwright’s schedule on two workers: each file whole, in order, but a parallel one test by test', () => {
  // a and b start together; c waits for the first free worker, unless its tests are handed out one by one.
  assert.equal(span(['c.spec.ts', 'a.spec.ts', 'b.spec.ts'], { 'a.spec.ts': 10, 'b.spec.ts': 10, 'c.spec.ts': 20 }), 30);
  assert.equal(span(['a.spec.ts', 'b.spec.ts', 'c.spec.ts'], { 'a.spec.ts': 10, 'b.spec.ts': 10, 'c.spec.ts': 20 }, new Set(['c.spec.ts'])), 20);
  // The order is the files', not the list's: a long last file runs on alone.
  assert.equal(span(['z.spec.ts', 'a.spec.ts', 'b.spec.ts'], { 'a.spec.ts': 5, 'b.spec.ts': 5, 'z.spec.ts': 40 }), 45);
  assert.equal(span(['new.spec.ts'], {}), UNMEASURED);
});

test('the parts take the longest files first, each where it lengthens a part least', () => {
  const seconds = { 'a.spec.ts': 50, 'b.spec.ts': 40, 'c.spec.ts': 30, 'd.spec.ts': 20, 'e.spec.ts': 10 };
  // a and b open the two parts; c goes beside b, 40 against a's 50; d ties at 50 and takes the first; e lengthens b's none.
  assert.deepEqual(parts(Object.keys(seconds), 2, seconds), [
    ['a.spec.ts', 'd.spec.ts'],
    ['b.spec.ts', 'c.spec.ts', 'e.spec.ts'],
  ]);
  // Every file lands once, and a part may stay empty.
  assert.deepEqual(parts(['a.spec.ts'], 3, seconds), [['a.spec.ts'], [], []]);
});

test('the command line takes a part of so many, or so many, and nothing else', () => {
  const err = [];
  const quiet = { out: () => {}, err: (line) => err.push(line) };
  for (const bad of [[], ['9/8'], ['0/8'], ['3/0'], ['x'], ['1/8', '2/8']]) assert.equal(main(bad, quiet), 2, bad.join(' '));
  assert.equal(err.length, 6);
  // A part with no files fails: given none, Playwright would run every spec.
  const n = specs().length + 1;
  assert.equal(main([`${n}/${n}`], quiet), 1);
  assert.match(err[6], new RegExp(`^Part ${n} of ${n} holds no spec files`));
  const lines = [];
  assert.equal(main(['8'], { out: (line) => lines.push(line) }), 0);
  assert.equal(lines.length, 8);
  assert.match(lines[0], /^1\/8: \d+\.\d\d min {2}\S+\.spec\.ts/);
});

test('the reporter prints each file’s seconds, each test’s from its start, before its beforeAll hooks, to its end', () => {
  const lines = [];
  let clock = 0;
  const reporter = new E2eSeconds({ out: (line) => lines.push(line), now: () => clock });
  reporter.onBegin({ projects: [{ testDir: '/runner/work/interbus/e2e' }] });
  const at = (file) => ({ location: { file: `/runner/work/interbus/e2e/${file}` } });
  // Each test ends `clock` seconds in; its `duration` leaves out a beforeAll hook's 15 s, which its start comes before.
  const run = (file, start, end, duration) => ((clock = end * 1000), reporter.onTestEnd(at(file), { startTime: new Date(start * 1000), duration: duration * 1000 }));
  run('b.spec.ts', 0, 16.25, 1.25);
  run('a.spec.ts', 1, 1.3, 0.3);
  run('b.spec.ts', 16.25, 18.25, 2);
  run('i12/extra.spec.ts', 2, 2, 0);
  assert.deepEqual(lines, []);
  reporter.onEnd();
  assert.deepEqual(lines, ['e2e seconds {"a.spec.ts":0.3,"b.spec.ts":18.3,"i12/extra.spec.ts":0}']);
});
