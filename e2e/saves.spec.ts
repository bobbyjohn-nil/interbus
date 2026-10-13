// Save slots, export and import on the page (the M3 spec, item 8): a slot holds a game and loads it
// back, the exported file imports back, and a file the game cannot read is refused in words with the
// game and its autosave kept. The save list (the M5 spec, item 4): each slot names its buses and when
// it was saved, deletes after a question, and a save set aside by a new build is listed until exported
// or deleted.
import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany } from './found';
import { city, onDepotLand, toScreen, zoomOutOnce } from './shell';

test.describe('saves: slots, export and import', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('saves to a slot and loads it back, exports a file and imports it, and refuses a file it cannot read', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);
    await page.getByRole('button', { name: 'Place a depot' }).click();
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await expect(panel).toHaveAttribute('data-cash', '27720000');

    // Slot 1 holds the game with its depot; the exported file is the same game.
    await page.getByRole('button', { name: 'Saves' }).click();
    const saves = page.getByTestId('saves');
    await expect(page.getByTestId('slot-1')).toContainText('Empty');
    await page.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();
    await expect(page.getByTestId('slot-1')).toContainText('Day 1, 05:00 · Back Bay Transit · $277,200 · 0 lines · 0 buses');
    await expect(page.getByTestId('slot-1-when')).toHaveText(/^ · saved \w{3} \d{1,2}, \d\d:\d\d$/);
    const download = page.waitForEvent('download');
    await saves.getByRole('button', { name: 'Export this game' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('interbus-boston-day-1.json');
    const exported = await (await file.createReadStream()).toArray();

    // A line, then slot 1 back: the line is gone and the cash is the slot's.
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Draw a line' }).click();
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(page.getByTestId('draft-card')).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(panel).toHaveAttribute('data-cash', '7120000');
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Load' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Replace this game' }).click();
    await expect(panel).toHaveAttribute('data-cash', '27720000');
    await expect(page.getByTestId('notice')).toContainText('Slot loaded');

    // A file the game cannot read: refused in words, the game kept.
    let chooser = page.waitForEvent('filechooser');
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await (await chooser).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": "world"}') });
    await expect(page.getByTestId('notice')).toContainText('Not a save this game can read');
    await expect(panel).toHaveAttribute('data-cash', '27720000');

    // The exported file imports back.
    chooser = page.waitForEvent('filechooser');
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await (await chooser).setFiles({ name: 'interbus-boston-day-1.json', mimeType: 'application/json', buffer: Buffer.concat(exported as Buffer[]) });
    await expect(page.getByTestId('notice')).toContainText('Save file loaded');
    await expect(panel).toHaveAttribute('data-cash', '27720000');

    // Slot 1 deleted, after a question (the M5 spec, item 4).
    await page.getByTestId('slot-1').getByRole('button', { name: 'Delete' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByTestId('slot-1')).toContainText('Back Bay Transit');
    await page.getByTestId('slot-1').getByRole('button', { name: 'Delete' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Delete Slot 1' }).click();
    await expect(page.getByTestId('slot-1')).toContainText('Slot 1 · Empty');
  });

  test('lists a save set aside by a new build until it is exported and deleted (the M5 spec, item 4)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('interbus.backup.boston.older', '{"format":1,"note":"an older build"}');
        sessionStorage.setItem('seeded', 'yes');
      }
    });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await page.getByRole('button', { name: 'Saves' }).click();
    const row = page.getByTestId('set-aside-older');
    await expect(row).toContainText('A save from an older build, set aside');
    const download = page.waitForEvent('download');
    await row.getByRole('button', { name: 'Export' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('interbus-boston-set-aside-older.json');
    expect(Buffer.concat((await (await file.createReadStream()).toArray()) as Buffer[]).toString()).toBe('{"format":1,"note":"an older build"}');
    await row.getByRole('button', { name: 'Delete' }).click();
    await row.getByRole('button', { name: 'Delete it' }).click();
    await expect(row).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('interbus.backup.boston.older'))).toBeNull();
  });
});
