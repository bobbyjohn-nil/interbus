// The CI action that installs Playwright's Chromium (.github/actions/chromium/action.yml): its install step's own shell,
// run as a runner runs it (bash -e -o pipefail), with sudo, dpkg, apt-get and npx stubbed and apt's folder in a temporary
// one, through each way a run can go. Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ACTION = new URL('../.github/actions/chromium/action.yml', import.meta.url);

/** The install step's script as the runner gets it: its expressions filled in, and apt's folder moved to `archives`. */
function installScript(hit, matched, archives) {
  const lines = readFileSync(ACTION, 'utf8').split('\n');
  const step = lines.findIndex((l) => l.trim() === "- name: Install Playwright's Chromium and its system packages");
  const run = lines.findIndex((l, i) => i > step && l.trim() === 'run: |');
  assert.ok(step >= 0 && run > step, 'the install step and its script');
  const body = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && !line.startsWith('        ')) break;
    body.push(line.slice(8));
  }
  const script = body
    .join('\n')
    .replaceAll("${{ steps.restore.outputs.cache-matched-key || 'no set' }}", matched || 'no set')
    .replaceAll('${{ steps.restore.outputs.cache-hit }}', hit)
    .replaceAll('/var/cache/apt/archives', archives);
  assert.ok(!script.includes('${{'), 'every expression in the step is filled in');
  return script;
}

// Each stub records its call. dpkg sets up each package it is given, or fails as one with an unmet dependency; npx's dry
// run and browser download pass or fail as asked, and its install with the system packages fetches one more into apt's
// folder, as apt would.
const STUBS = {
  sudo: 'exec "$@"',
  'apt-get': 'echo "apt-get $*" >> "$CALLS"',
  dpkg: [
    'echo "dpkg $*" >> "$CALLS"',
    'if [ -n "${DPKG_FAILS:-}" ]; then echo "dpkg: dependency problems prevent configuration of libnss3:amd64:"; exit 1; fi',
    'for f in "$@"; do case "$f" in *.deb) echo "Setting up $(basename "$f" .deb) ...";; esac; done',
  ].join('\n'),
  npx: [
    'echo "npx $*" >> "$CALLS"',
    'case "$*" in',
    '  "playwright install-deps --dry-run chromium") exit "${DRY_RUN_EXIT:-0}";;',
    '  "playwright install chromium") exit "${BROWSER_EXIT:-0}";;',
    '  "playwright install --with-deps chromium") touch "$ARCHIVES/fonts-fetched_1.0_all.deb"; exit 0;;',
    'esac',
    'exit 2',
  ].join('\n'),
};

/** Runs the step once: `debs` restored into ~/apt-archives under `hit` ('true' for an exact match, 'false' for a partial one, '' for none). */
function runStep({ hit, debs = [], imageVersion = '20261012.334.1', env = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'chromium-action-'));
  const [home, runnerTemp, archives, bin] = ['home', 'runner-temp', 'archives', 'bin'].map((d) => join(dir, d));
  for (const d of [join(home, 'apt-archives'), runnerTemp, archives, bin]) mkdirSync(d, { recursive: true });
  for (const deb of debs) writeFileSync(join(home, 'apt-archives', deb), '');
  for (const [name, body] of Object.entries(STUBS)) {
    writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const calls = join(dir, 'calls.log');
  writeFileSync(calls, '');
  const script = join(dir, 'step.sh');
  writeFileSync(script, installScript(hit, hit === '' ? '' : 'apt-chromium-ubuntu24-20261012.334.1-X64', archives));
  const vars = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: home, RUNNER_TEMP: runnerTemp, CALLS: calls, ARCHIVES: archives, ...env };
  if (imageVersion) vars.ImageVersion = imageVersion;
  else delete vars.ImageVersion;
  const out = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', script], { env: vars, encoding: 'utf8' });
  return { status: out.status, stdout: out.stdout, calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean), home, archives };
}

const SET = ['fonts-liberation_1.07.4-11_all.deb', 'libnss3_3.98-1build1_amd64.deb', 'xvfb_21.1.12-1ubuntu1.9_amd64.deb'];

test("an exact match installs the image's own set with dpkg, refusing downgrades, checks it, and fetches only the browser", () => {
  const run = runStep({ hit: 'true', debs: SET });
  assert.equal(run.status, 0, run.stdout);
  assert.match(run.calls[0], /^dpkg -i -G .*fonts-liberation.*libnss3.*xvfb/);
  assert.deepEqual(run.calls.slice(1), ['npx playwright install-deps --dry-run chromium', 'npx playwright install chromium']);
  assert.match(run.stdout, /installed with dpkg, no apt-get update: 3 packages set up/);
});

test('a set that leaves out a package this Playwright names goes through apt, with the set in apt’s folder', () => {
  const run = runStep({ hit: 'true', debs: SET, env: { DRY_RUN_EXIT: '1' } });
  assert.equal(run.status, 0, run.stdout);
  assert.match(run.stdout, /leaves out packages this Playwright names; apt from here/);
  assert.ok(run.calls.includes('npx playwright install --with-deps chromium'), run.calls.join('\n'));
  assert.ok(!run.calls.some((c) => c.startsWith('apt-get install -f')), 'nothing to mend');
  for (const deb of SET) assert.ok(existsSync(join(run.archives, deb)), deb);
});

test('a set dpkg cannot install prints why, and apt mends what it left before installing Playwright’s list', () => {
  const run = runStep({ hit: 'true', debs: SET, env: { DPKG_FAILS: '1' } });
  assert.equal(run.status, 0, run.stdout);
  assert.match(run.stdout, /did not install with dpkg; apt from here:\ndpkg: dependency problems/);
  const at = (call) => run.calls.indexOf(call);
  assert.ok(at('apt-get update -qq') >= 0 && at('apt-get update -qq') < at('apt-get install -f -y -qq'), run.calls.join('\n'));
  assert.ok(at('apt-get install -f -y -qq') < at('npx playwright install --with-deps chromium'), run.calls.join('\n'));
});

test("an exact match where the image names no version is no image's own set, so it never reaches dpkg", () => {
  const run = runStep({ hit: 'true', debs: SET, imageVersion: '' });
  assert.equal(run.status, 0, run.stdout);
  assert.ok(!run.calls.some((c) => c.startsWith('dpkg')), run.calls.join('\n'));
  assert.ok(run.calls.includes('npx playwright install --with-deps chromium'));
});

test('a partial match or a miss goes through apt and keeps the set restored and what apt fetched', () => {
  for (const [hit, debs] of [['false', SET], ['', []]]) {
    const run = runStep({ hit, debs });
    assert.equal(run.status, 0, run.stdout);
    assert.ok(!run.calls.some((c) => c.startsWith('dpkg')), `${hit}: ${run.calls.join('\n')}`);
    assert.ok(run.calls.includes('npx playwright install --with-deps chromium'));
    assert.deepEqual(readdirSync(join(run.home, 'apt-archives')).sort(), [...debs, 'fonts-fetched_1.0_all.deb'].sort());
  }
});

test('a browser that fails to download fails the step on the dpkg path too', () => {
  const run = runStep({ hit: 'true', debs: SET, env: { BROWSER_EXIT: '1' } });
  assert.notEqual(run.status, 0);
});

test('every workflow installs Chromium through the action, so no job waits on apt alone', () => {
  const workflows = new URL('../.github/workflows/', import.meta.url);
  const raw = readdirSync(workflows)
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => readFileSync(new URL(f, workflows), 'utf8').split('\n').map((line, i) => ({ at: `${f}:${i + 1}`, line })))
    .filter(({ line }) => /playwright install/.test(line) && !line.trim().startsWith('#'))
    .map(({ at }) => at);
  assert.deepEqual(raw, []);
});
