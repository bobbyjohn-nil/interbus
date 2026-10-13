// The third-party notices (scripts/notices.mjs). Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gamePackages, NOTICES, notices } from './notices.mjs';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

test('the committed notices are what the lockfile gives: every game package, none of the tools', () => {
  // Shown failing (TS-04) with the file missing a package: "out of date".
  assert.equal(readFileSync(NOTICES, 'utf8'), notices(lock));
  const names = gamePackages(lock).map((p) => p.name);
  for (const name of ['maplibre-gl', 'pmtiles', 'react', 'react-dom', '@protomaps/basemaps']) assert.ok(names.includes(name), name);
  for (const name of ['vite', 'vitest', '@playwright/test', 'typescript']) assert.ok(!names.includes(name), name);
});

test('reproduces each licence text, and names the declared licence where a package ships none', () => {
  const root = mkdtempSync(join(tmpdir(), 'notices-'));
  try {
    mkdirSync(join(root, 'node_modules/with-text'), { recursive: true });
    mkdirSync(join(root, 'node_modules/@scope/without'), { recursive: true });
    writeFileSync(join(root, 'node_modules/with-text/LICENSE.md'), 'MIT License\r\n\r\nCopyright (c) Someone\r\n');
    const fake = {
      packages: {
        '': {},
        'node_modules/with-text': { version: '1.0.0', license: 'MIT' },
        'node_modules/@scope/without': { version: '2.0.0', license: 'ISC' },
        'node_modules/a-tool': { version: '3.0.0', license: 'MIT', dev: true },
      },
    };
    const text = notices(fake, root);
    assert.match(text, /@scope\/without 2\.0\.0 \(ISC\)\n=+\n\nThe package ships no licence file; its package\.json declares ISC\./);
    assert.match(text, /with-text 1\.0\.0 \(MIT\)\n=+\n\nMIT License\n\nCopyright \(c\) Someone\n/);
    assert.doesNotMatch(text, /a-tool/);
    assert.ok(text.indexOf('@scope/without') < text.indexOf('with-text'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
