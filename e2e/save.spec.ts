// Saves on the web preview (D12; the M2 spec, item 9). A save from an older build is set aside under a
// backup key with a one-line notice, and a new game starts; only that new game writes the live key
// again. Reload and compare, the exit check's last step, is in line.spec.ts.
import { expect, test } from '@playwright/test';
import { backupKey, saveKey } from '../src/sim/save/save';
import { foundCompany } from './found';
import { city } from './shell';

const OLD = JSON.stringify({ format: 1, build: { sha: '0'.repeat(40), version: '0.0.0' }, data: { company: { name: 'Old Line Co' } } });

test.describe('saves', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('sets aside a save from an older build with a one-line notice, and starts a new game (D12)', async ({ page }) => {
    const [live, backup] = [saveKey(city.id), backupKey(city.id, 'older')];
    await page.addInitScript(([key, text]) => localStorage.setItem(key!, text!), [live, OLD]);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(page.getByTestId('notice')).toHaveText('Save from an older build set aside', { timeout: 30_000 });
    await expect(page.getByTestId('founding-card')).toBeVisible();
    const stored = () => page.evaluate(([a, b]) => [localStorage.getItem(a!), localStorage.getItem(b!)], [live, backup]);
    expect(await stored()).toEqual([null, OLD]);
    await foundCompany(page, 'New Line Co');
    await expect.poll(async () => (await stored())[0], { timeout: 10_000 }).toContain('"New Line Co"');
    expect((await stored())[1]).toBe(OLD);
  });
});
