// Proves each architecture fence in eslint.config.js flags what it fences (TS-04: a guard is only
// trusted once it has been seen to bite). Run: node --test "scripts/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..') });

async function problems(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId?.startsWith('no-restricted')).map((m) => m.ruleId);
}

const OUTSIDE_PLATFORM = [
  ['window.location.reload()', 'window.location.reload();'],
  ['location.reload()', 'location.reload();'],
  ['document.documentElement.requestFullscreen()', 'void document.documentElement.requestFullscreen();'],
  ['fetch()', "void fetch('x');"],
  ['globalThis.fetch()', "void globalThis.fetch('x');"],
  ['localStorage', "localStorage.setItem('a', 'b');"],
  ['globalThis.localStorage', "globalThis.localStorage.setItem('a', 'b');"],
  ['caches', "void caches.open('x');"],
  ['navigator.serviceWorker', "void navigator.serviceWorker.register('sw.js');"],
  ['navigator.storage', 'void navigator.storage.estimate();'],
  ['window.open()', "window.open('https://example.com');"],
  ['version.json', "export const v = './version.json';"],
  ['window.location.href = …', "window.location.href = 'https://example.com';"],
  ['location.assign()', 'location.assign(location.href);'],
  ['destructured localStorage', "const { localStorage: store } = window;\nstore.setItem('a', 'b');"],
  ['destructured fetch', "const { fetch: get } = globalThis;\nvoid get('x');"],
  ['window.navigator.storage', 'void window.navigator.storage.persist();'],
  ['bare open()', "open('https://example.com');"],
];

for (const [name, code] of OUTSIDE_PLATFORM) {
  test(`src/ui may not use ${name}`, async () => {
    assert.notEqual((await problems(code, 'src/ui/Fence.ts')).length, 0);
  });
  test(`src/platform may use ${name}`, async () => {
    assert.deepEqual(await problems(code, 'src/platform/web/Fence.ts'), []);
  });
}

test('src/ui links only through externalLink, or to a #place on the page', async () => {
  for (const code of [
    'export const A = () => <a href="https://example.com">x</a>;',
    "const STEAM = 'https://store.steampowered.com/';\nexport const A = () => <a href={STEAM}>x</a>;",
    "export const A = () => <a href={'https://example.com'}>x</a>;",
    'export const A = () => <a href={`https://example.com`}>x</a>;',
  ]) {
    assert.notEqual((await problems(code, 'src/ui/Fence.tsx')).length, 0, code);
  }
  for (const code of [
    'export const A = () => <a href="#top">x</a>;',
    "import { externalLink } from '../platform';\nexport const A = () => <a {...externalLink('https://www.openstreetmap.org/copyright')}>x</a>;",
  ]) {
    assert.deepEqual(await problems(code, 'src/ui/Fence.tsx'), [], code);
  }
});

test('ui and render import the sim only through rules and types', async () => {
  for (const path of ['../sim', '../sim/economy', '../../sim/demand/model']) {
    assert.notEqual((await problems(`import { x } from '${path}';\nexport { x };`, 'src/render/map/Fence.ts')).length, 0, path);
  }
  for (const path of ['../sim/rules', '../sim/rules/depots', '../sim/types']) {
    assert.deepEqual(await problems(`import { x } from '${path}';\nexport { x };`, 'src/ui/Fence.ts'), [], path);
  }
  // import() too: a lazy chunk is still an import.
  assert.notEqual((await problems("export const m = import('../sim/economy');", 'src/render/map/Fence.ts')).length, 0);
  for (const path of ['../sim/rules/depots', './loadMap']) {
    assert.deepEqual(await problems(`export const m = import('${path}');`, 'src/render/map/Fence.ts'), [], path);
  }
});

test('src/sim has no clock, randomness, DOM or platform powers', async () => {
  for (const code of [
    'export const t = new Date();',
    'export const t = Date();',
    'export const t = Date.now();',
    'export const r = Math.random();',
    'export const w = window.innerWidth;',
    "localStorage.setItem('a', 'b');",
    "void fetch('x');",
    "import React from 'react';\nexport { React };",
    "import { x } from '../ui/App';\nexport { x };",
    'export const id = crypto.randomUUID();',
    'export const r = globalThis.crypto.getRandomValues(new Uint8Array(4));',
    "export const m = import('react');",
    "export const m = import('../render/map/loadMap');",
    "import { jsx } from 'react/jsx-runtime';\nexport { jsx };",
  ]) {
    assert.notEqual((await problems(code, 'src/sim/economy/Fence.ts')).length, 0, code);
  }
  // A .tsx file in the sim is fenced the same way.
  for (const code of ["import React from 'react';\nexport { React };", 'export const t = Date.now();', 'export const r = Math.random();', 'export const w = window.innerWidth;']) {
    assert.notEqual((await problems(code, 'src/sim/economy/Fence.tsx')).length, 0, code);
  }
  assert.deepEqual(await problems('export const ok = Math.floor(1.5);', 'src/sim/economy/Fence.ts'), []);
});
