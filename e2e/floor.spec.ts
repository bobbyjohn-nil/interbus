// The failure floor on the page (the M3 spec, item 10; exit check 4): a game owing more than the
// credit line's −$150k counts down its day closes in a chip; the fifth ends the run, and Restart this
// quarter reopens the game where it began (here, where the file was loaded). The game is a save file
// edited to owe $200k at 23:50 with four closes already behind it, so the run ends within seconds.
import { expect, test } from '@playwright/test';
import { foundCompany } from './found';
import { city, setSpeed } from './shell';

test.describe('the failure floor', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('counts down below −$150k, ends the run on the fifth close, and restarts the quarter', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);

    // This game as a file, then owing $200k at 23:50 on day 1 with four closes below the floor.
    await page.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export this game' }).click();
    const exported = (await (await (await download).createReadStream()).toArray()) as Buffer[];
    const save = JSON.parse(Buffer.concat(exported).toString()) as {
      data: { clock: { elapsed: number }; closesBelowFloor: number; ledger: { day: number; kind: string; amountCents: number; lineId: null }[] };
    };
    save.data.clock.elapsed = 18 * 3_600 + 50 * 60;
    save.data.closesBelowFloor = 4;
    save.data.ledger.push({ day: 1, kind: 'purchase', amountCents: -62_720_000, lineId: null });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import a save file' }).click();
    await (await chooser).setFiles({ name: 'owing.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await expect(panel).toHaveAttribute('data-cash', '-20000000');
    await expect(page.getByTestId('countdown')).toHaveText('1 day to get above -$150k');

    // Midnight closes the fifth day below: the lender calls in the loan and time stops.
    await setSpeed(page, '5,400×');
    const failure = page.getByTestId('failure-card');
    await expect(failure).toBeVisible({ timeout: 30_000 });
    await expect(failure).toContainText('The lender has called in the loan');
    await expect(panel).toHaveAttribute('data-speed', '0');

    await failure.getByRole('button', { name: 'Restart this quarter' }).click();
    await expect(failure).toHaveCount(0);
    await expect(page.getByTestId('notice')).toContainText('Back to the start of the quarter');
    await expect(panel).toHaveAttribute('data-cash', '-20000000');
    await expect(page.getByTestId('countdown')).toHaveText('1 day to get above -$150k');
  });
});
