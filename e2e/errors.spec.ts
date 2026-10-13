import { expect, test } from '@playwright/test';

// The error bus is installed at boot (V3 never registered a sink, so its reports reached only the
// console, S07): an uncaught error anywhere on the page lands on the bus as ui/uncaught.
test('an uncaught error on the page reaches the error bus', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.goto('./');
  await expect(page.getByTestId('build-chip')).toBeVisible();
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('probe from e2e/errors.spec.ts');
    });
  });
  await expect.poll(() => warnings.some((w) => w.startsWith('[ui/uncaught]'))).toBe(true);
});
