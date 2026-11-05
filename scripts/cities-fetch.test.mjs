// The city files' download (scripts/cities/fetch.mjs) as GitHub fails a request now and then: the deploy, CI and the nightly
// all fetch them. Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { download } from './cities/fetch.mjs';

/** A fetch that gives each of `answers` in turn, a status or an error to throw, and counts the requests. */
function answering(...answers) {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return new Response(answer === 200 ? 'city' : 'busy', { status: answer });
  };
  return { get, calls };
}

const AT = 'https://example.test/sim.json';

// Deploy preview run 41999545377: GitHub's release download answered 504 for Inner Boston's sim file, and the deploy of
// #206's merge failed on that one try. Shown failing (TS-04) with one try.
test('tries a file again after GitHub answers 504, and after a dropped connection', async () => {
  for (const failure of [504, new TypeError('fetch failed')]) {
    const { get, calls } = answering(failure, 200);
    const logs = [];
    const buf = await download(AT, { get, delayMs: 0, log: (line) => logs.push(line) });
    assert.equal(buf.toString(), 'city');
    assert.equal(calls.length, 2);
    assert.match(logs[0], /for https:\/\/example\.test\/sim\.json \(try 1 of 3\), trying again$/);
  }
});

test('fails at once on a 404, the file’s own answer', async () => {
  const { get, calls } = answering(404, 200);
  await assert.rejects(download(AT, { get, delayMs: 0, log: () => {} }), /^Error: cities: HTTP 404 for https:\/\/example\.test\/sim\.json$/);
  assert.equal(calls.length, 1);
});

test('fails after three tries of GitHub’s own failures', async () => {
  const { get, calls } = answering(503, new TypeError('fetch failed'), 504, 200);
  await assert.rejects(download(AT, { get, delayMs: 0, log: () => {} }), /cities: HTTP 504 for https:\/\/example\.test\/sim\.json \(try 3 of 3\)/);
  assert.equal(calls.length, 3);
});
