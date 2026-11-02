// The fixture e2e's parts on CI (.github/workflows/ci.yml): every spec file runs in one part, and the parts share the files
// out by their measured seconds (e2e/seconds.json), so that each, as Playwright runs it on a runner's two workers, takes
// about as long as the others. Playwright's own --shard shares the tests out by their count, in the files' order, which left
// the first of eight with the copy walk, the day card's and Close line's tests: 5.6 minutes of tests by main 5ae4f48's times,
// to 2.7 for the lightest. Run: node scripts/e2e-parts.mjs 3/8 (part 3's files, as Playwright's arguments), or
// node scripts/e2e-parts.mjs 8 (every part's files and minutes).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const E2E = new URL('../e2e/', import.meta.url);
/** Playwright's workers on a CI runner: half its four processors. */
export const WORKERS = 2;
/** The seconds a spec the table has not measured yet counts for: about the mean of those it has. */
export const UNMEASURED = 60;
/** A spec in parallel mode hands its tests out one by one; they take about this many seconds each. */
const PIECE = 10;

// Playwright's default testMatch, `**/*.@(spec|test).?(c|m)[jt]s?(x)`: the files it runs, in any folder under e2e/.
const TEST_FILE = /\.(spec|test)\.(c|m)?[jt]sx?$/;

/** Two paths under e2e/ in Playwright's order: it walks the folder, each folder's entries sorted by localeCompare. */
export const byWalk = (a, b) => {
  const [x, y] = [a.split('/'), b.split('/')];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const c = x[i].localeCompare(y[i]);
    if (c) return c;
  }
  return x.length - y.length;
};

/**
 * The test files Playwright finds under `dir` (e2e/), as paths from it, in its order: every folder but node_modules, which
 * it never searches, and every file but a session's own `zz-` probes, which git never sees.
 */
export function specs(dir = E2E) {
  const walk = (at) =>
    readdirSync(new URL(at, dir), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((e) => {
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(`${at}${e.name}/`);
        return TEST_FILE.test(e.name) && !e.name.startsWith('zz-') ? [`${at}${e.name}`] : [];
      });
  return walk('');
}

/** The specs whose tests run in parallel mode, each its own piece of work for a free worker. */
export const parallelSpecs = (files) =>
  new Set(files.filter((f) => /test\.describe\.configure\(\{\s*mode:\s*'parallel'/.test(readFileSync(new URL(f, E2E), 'utf8'))));

/** The seconds e2e/seconds.json holds for each spec file. */
export const measured = () => JSON.parse(readFileSync(new URL('seconds.json', E2E), 'utf8')).seconds;

const secondsOf = (seconds, file) => seconds[file] ?? UNMEASURED;

/**
 * How long a part takes, in seconds: Playwright hands each worker, as it comes free, the next file in order, whole, or the
 * next test of a file in parallel mode.
 */
export function span(files, seconds, parallel = new Set()) {
  const workers = Array(WORKERS).fill(0);
  for (const file of [...files].sort(byWalk)) {
    const total = secondsOf(seconds, file);
    const pieces = parallel.has(file) ? Math.max(1, Math.round(total / PIECE)) : 1;
    for (let k = 0; k < pieces; k++) workers[workers.indexOf(Math.min(...workers))] += total / pieces;
  }
  return Math.max(...workers);
}

/** The spec files in `n` parts: the longest first, each into the part it lengthens least, the first such part on a tie. */
export function parts(files, n, seconds, parallel = new Set()) {
  const out = Array.from({ length: n }, () => []);
  const longestFirst = [...files].sort((a, b) => secondsOf(seconds, b) - secondsOf(seconds, a) || a.localeCompare(b));
  for (const file of longestFirst) {
    let best = 0;
    let least = Infinity;
    out.forEach((part, k) => {
      const s = span([...part, file], seconds, parallel);
      if (s < least) [least, best] = [s, k];
    });
    out[best].push(file);
  }
  return out.map((part) => part.sort(byWalk));
}

/** `3/8` → part 3's files as Playwright's arguments; `8` → every part's minutes and files. */
export function main(argv, { out = console.log, err = console.error } = {}) {
  const one = /^(\d+)\/(\d+)$/.exec(argv[0] ?? '');
  const all = /^(\d+)$/.exec(argv[0] ?? '');
  const n = Number(one?.[2] ?? all?.[1]);
  const k = Number(one?.[1] ?? 1);
  if (argv.length !== 1 || !(n >= 1) || !(k >= 1 && k <= n)) {
    err('Usage: node scripts/e2e-parts.mjs <part>/<parts> | <parts>');
    return 2;
  }
  const files = specs();
  const seconds = measured();
  const parallel = parallelSpecs(files);
  const shared = parts(files, n, seconds, parallel);
  if (!one) {
    shared.forEach((part, i) => out(`${i + 1}/${n}: ${(span(part, seconds, parallel) / 60).toFixed(2)} min  ${part.join(' ')}`));
    return 0;
  }
  // Given no files, Playwright would run every spec, so an empty part is an error, as is any other failure here.
  if (!shared[k - 1].length) {
    err(`Part ${k} of ${n} holds no spec files: ${files.length} specs fill at most ${files.length} parts.`);
    return 1;
  }
  out(shared[k - 1].map((f) => `e2e/${f}`).join(' '));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
