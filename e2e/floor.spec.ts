// The failure floor on the page (the M3 spec, item 10; exit check 4): a game owing more than the
// credit line's −$150k counts down its day closes in a chip; the fifth ends the run, and Restart this
// quarter reopens the game where it began (here, where the file was loaded). The game is a save file
// edited to owe $200k at 23:50 with four closes already behind it, so the run ends within seconds;
// its closing day's card is read first, then the failure card shows.
import { expect, test } from '@playwright/test';
import { foundCompany, STARTING_CENTS } from './found';
import { city, setSpeed, withDebugLine } from './shell';

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
    save.data.ledger.push({ day: 1, kind: 'buses', amountCents: -(STARTING_CENTS + 20_000_000), lineId: null });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import a save file' }).click();
    await page.getByRole('button', { name: 'Replace this game' }).click();
    await (await chooser).setFiles({ name: 'owing.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await expect(panel).toHaveAttribute('data-cash', '-20000000');
    await expect(page.getByTestId('countdown')).toHaveText('1 day to get above -$150k');

    // Midnight closes the fifth day below: the lender calls in the loan and time stops. The closing
    // day's card comes first, every row of it in sight, and the failure card after Continue: it used
    // to take the same spot, over the day card's rows.
    await setSpeed(page, '5,400×');
    const dayCard = page.getByTestId('day-card');
    await expect(dayCard).toBeVisible({ timeout: 30_000 });
    await expect(panel).toHaveAttribute('data-speed', '0');
    // The day card's heading, rows and button that something else is drawn over, at their middles.
    const hidden = () =>
      dayCard.evaluate((card) =>
        [...card.querySelectorAll('h2, tr, button')].filter((el) => {
          const r = el.getBoundingClientRect();
          return !card.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }).length,
      );
    await expect.poll(hidden).toBe(0);
    const failure = page.getByTestId('failure-card');
    await expect(failure).toHaveCount(0);
    await dayCard.getByRole('button', { name: 'Continue' }).click();
    await expect(failure).toBeVisible();
    await expect(failure).toContainText('The lender has called in the loan');

    await failure.getByRole('button', { name: 'Restart this quarter' }).click();
    await expect(failure).toHaveCount(0);
    await expect(page.getByTestId('notice')).toContainText('Back to the start of the quarter');
    await expect(panel).toHaveAttribute('data-cash', '-20000000');
    await expect(page.getByTestId('countdown')).toHaveText('1 day to get above -$150k');
  });

  // Once the lender has ended the run the host refuses every change (D10), and the page offered them all the same, each press
  // answered by a notice alone: Build's tools, play and the speed menu, the keys, Take it, a line's headways, model and Edit route,
  // and its fare in Finance (the review of the systems audit's eighth round). Shown failing (TS-04) with the page as before.
  test('an ended run offers nothing the lender refuses, and Restart this quarter brings it all back', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // The debug line, owing $199k at 23:50 on day 2 with four closes below the floor behind it.
    await withDebugLine(page, (d) => {
      d.clock.elapsed = 86_400 + 18 * 3_600 + 50 * 60;
      (d as unknown as { closesBelowFloor: number }).closesBelowFloor = 4;
      d.ledger.push({ day: 1, kind: 'buses', amountCents: -(STARTING_CENTS + 20_000_000), lineId: null });
    });
    await setSpeed(page, '5,400×');
    const dayCard = page.getByTestId('day-card');
    await expect(dayCard).toBeVisible({ timeout: 30_000 });
    await dayCard.getByRole('button', { name: 'Continue' }).click();
    const failure = page.getByTestId('failure-card');
    await expect(failure).toBeVisible();

    await expect(page.getByTestId('build')).toBeDisabled();
    await expect(page.getByTestId('play')).toBeDisabled();
    await expect(page.getByTestId('speed-menu')).toBeDisabled();
    await expect(page.getByTestId('undo')).toHaveCount(0);
    await expect(page.getByTestId('checklist')).toHaveCount(0);
    // Space and 1 to 5 play nothing.
    await page.locator('body').press('Space');
    await page.locator('body').press('3');
    await expect(panel).toHaveAttribute('data-speed', '0');
    await expect(page.getByTestId('notice')).not.toContainText('The lender has called in the loan');

    await page.getByTestId('contracts-chip').click();
    const contracts = page.getByTestId('contracts');
    for (const take of await contracts.getByRole('button', { name: 'Take it' }).all()) await expect(take).toBeDisabled();
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    await expect(lines.getByTestId('headway-peak')).toBeDisabled();
    await expect(lines.getByTestId('line-model')).toBeDisabled();
    await expect(lines.getByRole('button', { name: 'Edit route' })).toBeDisabled();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    // The lender's card stands over Finance's views, so the keyboard picks Lines.
    await finance.getByTestId('finance-lines').focus();
    await page.keyboard.press('Enter');
    await expect(finance.getByTestId('fare-1')).toBeDisabled();

    await failure.getByRole('button', { name: 'Restart this quarter' }).click();
    await expect(failure).toHaveCount(0);
    await expect(page.getByTestId('build')).toBeEnabled();
    await expect(page.getByTestId('play')).toBeEnabled();
    // The quarter's start is loaded, its panels closed; its line's card takes changes again.
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await expect(lines.getByTestId('headway-peak')).toBeEnabled();
  });
});
