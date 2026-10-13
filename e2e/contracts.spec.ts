// A HEADWAY contract paid (the M3 spec, item 11; exit check 2): "every 15 min at Longwood, 10 days"
// held nine days, its line every 15 minutes, meets its tenth at midnight and pays as one ledger row.
// Ten game days are too long for the e2e, so the game is a save file edited to that evening: a depot,
// the debug line's four stops every 15 minutes (two Sparrows run it), and the contract nine days in.
import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany } from './found';
import { chromeShare, city, onDepotLand } from './shell';

test.describe('a HEADWAY contract', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('shows today’s headway against the ask, and pays on the tenth day in a row as a Contracts row', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1152, height: 720 }); // I13's tightest size
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);

    await page.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export this game' }).click();
    const exported = (await (await (await download).createReadStream()).toArray()) as Buffer[];
    type Data = Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number>; contracts: Record<string, unknown>[]; ledger: unknown[] };
    const save = JSON.parse(Buffer.concat(exported).toString()) as { data: Data };
    const d = save.data;
    const [lon, lat] = onDepotLand();
    d.depots = [{ id: 1, lon, lat }];
    d.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
    d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 900, offpeak: 900, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow' }];
    d.nextIds = { ...d.nextIds, depot: 2, stop: 5, line: 2 };
    d.ledger.push({ day: 1, kind: 'fares', amountCents: 100_000, lineId: 1 }); // day 1 in profit, for the checklist
    const longwood = d.contracts.find((c) => c.landmark === 'Longwood')!;
    Object.assign(longwood, { askSeconds: 900, rewardCents: 15_000_000, acceptedDay: 1, daysMet: 9, hoursMissedToday: 0 });
    d.clock.elapsed = 9 * 86_400 + 18 * 3_600 + 50 * 60; // day 10, 23:50
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import a save file' }).click();
    await (await chooser).setFiles({ name: 'contract.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await expect(page.getByTestId('notice')).toContainText('Save file loaded');
    await page.getByRole('button', { name: 'Close' }).click();

    // The card: the ask, today's figure against it, and the days held.
    await page.getByTestId('contracts-chip').click();
    const card = page.getByTestId('contracts').locator('[data-landmark="Longwood"]');
    await expect(card).toContainText('Every 15 min at Longwood');
    await expect(card).toContainText('10 days in a row · $150,000');
    await expect(card).toContainText('Today: every 15 min');
    await expect(card).toHaveAttribute('data-met', 'yes');
    await expect(card).toContainText('9 of 10 days · 11 days left');
    // I13 with Contracts: the panel within 26%, and the shell at rest with the Contracts chip within 6%.
    const withPanel = await chromeShare(page);
    await page.getByRole('button', { name: 'Close' }).click();
    const atRest = await chromeShare(page);
    test.info().annotations.push({ type: 'chrome %', description: JSON.stringify({ contracts: Math.round(withPanel * 1000) / 10, rest: Math.round(atRest * 1000) / 10 }) });
    expect(withPanel).toBeLessThanOrEqual(0.26);
    expect(atRest).toBeLessThanOrEqual(0.06);
    await page.getByTestId('contracts-chip').click();

    // Midnight: the tenth day met pays it, as one row on the day card.
    await page.getByRole('button', { name: '3×' }).click();
    const dayCard = page.getByTestId('day-card');
    await expect(dayCard).toBeVisible({ timeout: 30_000 });
    await expect(dayCard.getByTestId('report-card')).toBeVisible(); // day 10 closes quarter 1 too
    await expect(dayCard.getByTestId('contract-outcome')).toHaveText('Contract met: every 15 min at Longwood, $150,000');
    await expect(dayCard.locator('tr[data-kind="contract"]')).toHaveAttribute('data-cents', '15000000');
    expect(await dayCard.getAttribute('data-total')).toBe(await dayCard.getAttribute('data-change')); // I1
    await expect(page.getByTestId('contracts').locator('[data-landmark="Longwood"]')).toHaveAttribute('data-held', 'no'); // a new offer in its slot
  });
});
