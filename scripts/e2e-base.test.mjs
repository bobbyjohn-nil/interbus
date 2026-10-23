// The e2e specs' `test` (e2e/base.ts): every spec but the boot splash's takes it from there, in tabs whose tow has played, so no
// test's first press on Home waits out the bus pulling the splash away, about 2 s each (round 10). A spec on Playwright's own
// `test` passes, only slower, so nothing else would catch one. Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const E2E = new URL('../e2e/', import.meta.url);
/** The specs that test the tow itself, on Playwright's own `test`, as a first visit sees it. */
const OWN = ['boot.spec.ts'];

/** Where a spec takes `test` from: './base', '@playwright/test', or null when it imports neither. */
const testFrom = (source) => /^import\s*\{([^}]*)\}\s*from\s*'(\.\/base|@playwright\/test)';/m.exec(source)?.filter((_, k) => k > 0) ?? null;
const takesTest = ([names, from]) => (/(^|[\s,])test([\s,]|$)/.test(names) ? from : null);

test('every spec but the boot splash’s takes its test from e2e/base.ts', () => {
  assert.equal(takesTest(testFrom("import { expect, test, type Page } from './base';")), './base');
  assert.equal(takesTest(testFrom("import { expect, test } from '@playwright/test';")), '@playwright/test');
  assert.equal(takesTest(testFrom("import { expect, type Page } from '@playwright/test';")), null);
  const specs = readdirSync(E2E).filter((f) => f.endsWith('.spec.ts') && !f.startsWith('zz-'));
  assert.ok(specs.length > 40, `${specs.length} specs`);
  const wrong = specs.flatMap((f) => {
    const imported = testFrom(readFileSync(new URL(f, E2E), 'utf8'));
    const from = imported ? takesTest(imported) : null;
    return (OWN.includes(f) ? from === '@playwright/test' : from === './base') ? [] : [`${f}: ${from}`];
  });
  assert.deepEqual(wrong, []);
});
