// The deploy's asset retention (scripts/deploy/retain-assets.mjs) under a flaky live site.
// The happy path across three deploys is the e2e swap test (I15). Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retain } from './deploy/retain-assets.mjs';

const MANIFEST = { builds: [{ id: 'old', files: ['assets/old-a1.js', 'assets/old-b2.js'] }] };

/** A live site whose manifest fails `failures` times first; old-b2.js is cut off mid-stream. */
async function site(failures, status = 503) {
  let left = failures;
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/asset-manifest.json') {
      if (left-- > 0) return void res.writeHead(status).end('busy');
      return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(MANIFEST));
    }
    if (path === '/assets/old-a1.js') return void res.writeHead(200).end('export const a = 1;\n');
    if (path === '/assets/old-b2.js') {
      res.writeHead(200, { 'content-length': '1000' });
      res.write('export const b = ');
      return void setTimeout(() => res.destroy(), 20);
    }
    res.writeHead(404).end();
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) };
}

function dist() {
  const dir = mkdtempSync(join(tmpdir(), 'retain-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets/new-c3.js'), 'export const c = 3;\n');
  return dir;
}

test('a passing 5xx on the manifest is retried, not taken for a first deploy', async () => {
  const live = await site(2);
  const dir = dist();
  try {
    const manifest = await retain({ dist: dir, live: live.url, id: 'new', log: () => {}, tries: 3, delayMs: 1 });
    assert.deepEqual(manifest.builds.map((b) => b.id), ['new', 'old']);
    assert.equal(existsSync(join(dir, 'assets/old-a1.js')), true);
  } finally {
    await live.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a manifest that stays unavailable warns and keeps nothing, without failing the deploy', async () => {
  const live = await site(5);
  const dir = dist();
  const lines = [];
  try {
    const manifest = await retain({ dist: dir, live: live.url, id: 'new', log: (l) => lines.push(l), tries: 3, delayMs: 1 });
    assert.deepEqual(manifest.builds.map((b) => b.id), ['new']);
    assert.ok(lines.some((l) => l.startsWith('::warning::')), lines.join('\n'));
  } finally {
    await live.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a 404 manifest is a first deploy: no retries', async () => {
  const live = await site(99, 404);
  const dir = dist();
  const lines = [];
  try {
    const manifest = await retain({ dist: dir, live: live.url, id: 'new', log: (l) => lines.push(l), tries: 3, delayMs: 1 });
    assert.deepEqual(manifest.builds.map((b) => b.id), ['new']);
    assert.equal(lines.filter((l) => l.includes('try')).length, 0);
  } finally {
    await live.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a file cut off mid-copy is not left in the new deploy', async () => {
  const live = await site(0);
  const dir = dist();
  try {
    const manifest = await retain({ dist: dir, live: live.url, id: 'new', log: () => {}, tries: 1, delayMs: 1 });
    assert.equal(existsSync(join(dir, 'assets/old-b2.js')), false);
    assert.deepEqual(manifest.builds[1].files, ['assets/old-a1.js']);
  } finally {
    await live.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
