// Save slots, export and import on the page (the M3 spec, item 8): a slot holds a game and loads it
// back, the exported file imports back, and a file the game cannot read is refused in words with the
// game and its autosave kept. The save list (the M5 spec, item 4): each slot names its buses and when
// it was saved, deletes after a question, and a save set aside by a new build is listed until exported
// or deleted. A slot from an older build says so, exports, and is replaced only after a question; a
// browser that refuses storage says once that it keeps no saves. A save file replaces a founded company
// only after the question Load asks, one question at a time, and an older save the disk has no room to
// set aside is never written over.
import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { SAVE_FORMAT } from '../src/sim/save/save';
import { usd } from '../src/ui/format';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, fillStorage, onDepotLand, toScreen, zoomOutOnce } from './shell';

test.describe('saves: slots, export and import', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('saves to a slot and loads it back, exports a file and imports it, and refuses a file it cannot read', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));

    // Slot 1 holds the game with its depot; the exported file is the same game.
    await page.getByRole('button', { name: 'Saves' }).click();
    const saves = page.getByTestId('saves');
    await expect(page.getByTestId('slot-1')).toContainText('Empty');
    await page.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();
    await expect(page.getByTestId('slot-1')).toContainText(`Day 1, 05:00 · Back Bay Transit · ${usd(STARTING_CENTS - 15_000_000)} · 0 lines · 0 buses`);
    await expect(page.getByTestId('slot-1-when')).toHaveText(/^ · saved \w{3} \d{1,2}, \d\d:\d\d$/);
    // The autosave is listed too, by its company, cash, lines and buses, and when it was saved (the exit check's step 2).
    await expect(page.getByTestId('autosave')).toContainText(`Autosave · Year 1, Q1, Day 1, 05:00 · Back Bay Transit · ${usd(STARTING_CENTS - 15_000_000)} · 0 lines · 0 buses`);
    await expect(page.getByTestId('autosave-when')).toHaveText(/^ · saved \w{3} \d{1,2}, \d\d:\d\d$/);
    const download = page.waitForEvent('download');
    await saves.getByRole('button', { name: 'Export this game' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('interbus-boston-day-1.json');
    const exported = await (await file.createReadStream()).toArray();

    // A line, then slot 1 back: the line is gone and the cash is the slot's.
    await page.getByRole('button', { name: 'Close' }).click();
    await build(page, 'Draw a line');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(page.getByTestId('draft-card')).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 35_600_000));
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Load' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Replace this game' }).click();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await expect(page.getByTestId('notice')).toContainText('Slot loaded');

    // A file the game cannot read: refused in words, the game kept.
    let chooser = page.waitForEvent('filechooser');
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await saves.getByRole('button', { name: 'Replace this game' }).click();
    await (await chooser).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": "world"}') });
    await expect(page.getByTestId('notice')).toContainText('A save this game can’t read');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));

    // The exported file imports back.
    chooser = page.waitForEvent('filechooser');
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await saves.getByRole('button', { name: 'Replace this game' }).click();
    await (await chooser).setFiles({ name: 'interbus-boston-day-1.json', mimeType: 'application/json', buffer: Buffer.concat(exported as Buffer[]) });
    await expect(page.getByTestId('notice')).toContainText('Save file loaded');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));

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

  // A slot written before a format change (D12: set aside, never overwritten). Shown failing (TS-04)
  // with the slot named unreadable, no Export, and Save here writing over it without a question.
  test('names a slot from an older build, exports it, and asks before Save here replaces it', async ({ page }) => {
    test.setTimeout(60_000);
    const older = JSON.stringify({ format: SAVE_FORMAT - 1, note: 'an older build' });
    await page.addInitScript((text) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('interbus.slot.boston.1', text);
        sessionStorage.setItem('seeded', 'yes');
      }
    }, older);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await page.getByRole('button', { name: 'Saves' }).click();
    const slot = page.getByTestId('slot-1');
    await expect(slot).toContainText(`Slot 1 · A save from an older build (format ${SAVE_FORMAT - 1})`);
    await expect(slot.getByRole('button', { name: 'Load' })).toHaveCount(0);
    const download = page.waitForEvent('download');
    await slot.getByRole('button', { name: 'Export' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('interbus-boston-slot-1.json');
    expect(Buffer.concat((await (await file.createReadStream()).toArray()) as Buffer[]).toString()).toBe(older);
    // Save here asks first: Keep it keeps the older save as it was.
    await slot.getByRole('button', { name: 'Save here' }).click();
    await slot.getByRole('button', { name: 'Keep it' }).click();
    await expect(slot).toContainText('A save from an older build');
    expect(await page.evaluate(() => localStorage.getItem('interbus.slot.boston.1'))).toBe(older);
    await slot.getByRole('button', { name: 'Save here' }).click();
    await slot.getByRole('button', { name: 'Replace Slot 1' }).click();
    await expect(slot).toContainText('Slot 1 · Year 1, Q1, Day 1, 05:00 · Back Bay Transit');
  });

  // Import replaces the game, its autosave and its quarter's save, so once a company is founded it asks
  // first, as Load does (Saves' own contract); before one is, there is no game to lose, and Import asks
  // nothing (nor does Load: e2e/home.spec.ts). Shown failing (TS-04) with the file asked for and loaded
  // at once, with no question.
  test('asks before a save file replaces a founded company, in the game and from Home, as Load does, and asks nothing before one is', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    const saves = page.getByTestId('saves');
    const home = page.getByTestId('home');
    let asked = 0;
    page.on('filechooser', () => void asked++);
    const company = () => page.evaluate(() => (JSON.parse(localStorage.getItem('interbus.save.boston') ?? 'null') as { data: { company: { name: string } } } | null)?.data.company.name);

    // A first visit: no company yet, so Import asks for the file at once.
    await home.getByRole('button', { name: 'Saves' }).click();
    let chooser = page.waitForEvent('filechooser');
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await chooser;
    await expect(saves.getByRole('button', { name: 'Replace this game' })).toHaveCount(0);
    await saves.getByRole('button', { name: 'Close' }).click();

    await foundCompany(page, 'First Co');
    await page.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await saves.getByRole('button', { name: 'Export this game' }).click();
    const save = JSON.parse(Buffer.concat((await (await (await download).createReadStream()).toArray()) as Buffer[]).toString()) as { data: { company: { name: string } } };
    const file = (name: string) => {
      save.data.company.name = name;
      return { name: 'other.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) };
    };

    // Keep playing keeps the game, and no file is asked for.
    asked = 0;
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await saves.getByRole('button', { name: 'Keep playing' }).click();
    await expect(saves.getByRole('button', { name: 'Import a save file' })).toBeVisible();
    expect(asked).toBe(0);
    expect(await company()).toBe('First Co');
    // Replace this game asks for the file, which becomes the game.
    chooser = page.waitForEvent('filechooser');
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await saves.getByRole('button', { name: 'Replace this game' }).click();
    await (await chooser).setFiles(file('Other Co'));
    await expect(page.getByTestId('notice')).toContainText('Save file loaded');
    await expect.poll(company).toBe('Other Co');

    // Home's Saves asks the same while there is a company.
    await saves.getByRole('button', { name: 'Back to Home' }).click();
    await home.getByRole('button', { name: 'Saves' }).click();
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await saves.getByRole('button', { name: 'Keep playing' }).click();
    expect(await company()).toBe('Other Co');
    chooser = page.waitForEvent('filechooser');
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await saves.getByRole('button', { name: 'Replace this game' }).click();
    await (await chooser).setFiles(file('Third Co'));
    await expect(home).toBeHidden();
    await expect.poll(company).toBe('Third Co');
  });

  // One question at a time: Import's closes Save here's and Delete's, and theirs close it, as Load's and
  // Import's already did. While a slot's question is open, its row shows only its answers, as Export this
  // game hides while Import's is open, so the row never wraps (I13). Shown failing (TS-04) with both
  // questions open at once, and with Save here beside Load's question and Delete's.
  test('opens one question at a time, and a row shows only its question while it is open', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await page.getByRole('button', { name: 'Saves' }).click();
    const saves = page.getByTestId('saves');
    const slot = saves.getByTestId('slot-1');
    await slot.getByRole('button', { name: 'Save here' }).click();
    await expect(slot).toContainText('Back Bay Transit');
    // Import's question stands in place of its button, below the slots.
    const importing = saves.locator(':scope > .controls').getByRole('button', { name: 'Replace this game' });
    for (const [open, question, keep] of [['Save here', 'Replace Slot 1', 'Keep it'], ['Delete', 'Delete Slot 1', 'Keep it'], ['Load', 'Replace this game', 'Keep playing']] as const) {
      await slot.getByRole('button', { name: open }).click();
      await expect(slot.getByRole('button')).toHaveText([question, keep]);
      await saves.getByRole('button', { name: 'Import a save file' }).click();
      await expect(importing).toBeVisible();
      await expect(slot.getByRole('button', { name: question })).toHaveCount(0);
      await slot.getByRole('button', { name: open }).click();
      await expect(slot.getByRole('button', { name: question })).toBeVisible();
      await expect(importing).toHaveCount(0);
      await expect(saves.getByRole('button', { name: 'Import a save file' })).toBeVisible();
      await slot.getByRole('button', { name: keep }).click();
      await expect(slot.getByRole('button')).toHaveText(['Save here', 'Delete', 'Load']);
    }
  });

  // Before a company is founded, Load and Import go ahead without a question, and close any question
  // open in another row first, so none stays open across the change of game. Here Saves stays open from
  // Home through New game, on the founding card. Shown failing (TS-04) with slot 2's Delete question
  // still open after Import, and after Load.
  test('closes any open question before Load or Import goes ahead unasked', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await page.getByRole('button', { name: 'Saves' }).click();
    const saves = page.getByTestId('saves');
    for (const n of [1, 2]) {
      await saves.getByTestId(`slot-${n}`).getByRole('button', { name: 'Save here' }).click();
      await expect(saves.getByTestId(`slot-${n}`)).toContainText('Back Bay Transit');
    }
    await saves.getByRole('button', { name: 'Back to Home' }).click();
    const home = page.getByTestId('home');
    await home.getByRole('button', { name: 'Saves' }).click();
    await home.getByRole('button', { name: 'New game' }).click();
    await home.getByRole('button', { name: 'Start a new game' }).click();
    await expect(page.getByTestId('founding-card')).toBeVisible();
    await expect(saves).toBeVisible();
    const two = saves.getByTestId('slot-2');
    await two.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(two.getByRole('button', { name: 'Delete Slot 2' })).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await saves.getByRole('button', { name: 'Import a save file' }).click();
    await expect(two.getByRole('button', { name: 'Delete Slot 2' })).toHaveCount(0);
    await (await chooser).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": "world"}') });
    await expect(page.getByTestId('notice')).toContainText('A save this game can’t read');
    await two.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(two.getByRole('button', { name: 'Delete Slot 2' })).toBeVisible();
    await saves.getByTestId('slot-1').getByRole('button', { name: 'Load' }).click();
    await expect(page.getByTestId('notice')).toContainText('Slot loaded');
    await expect(two.getByRole('button', { name: 'Delete Slot 2' })).toHaveCount(0);
    await expect(two.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  });

  // D12 and DP-06: a save the game cannot play is set aside under a backup key before anything replaces
  // it. Here other data under the preview's origin leaves no room for the backup. Shown failing (TS-04)
  // with the start going on as if the backup had landed: the founding save wrote over the older one,
  // which was gone for good, with no row in Saves, and the only word was "This browser isn’t keeping
  // saves", though the browser kept every other save. The notice stays until Saves is opened: a player
  // who missed a few seconds' notice would play on unsaved. It says "see Saves", so it waits on the
  // founding card, where no button opens Saves (shown failing with it said there); the file it exports is
  // named as its row names it, not set aside (shown failing with "…-set-aside-older-…"); and once it is
  // deleted, the autosave's row goes from naming it to naming this game (shown failing with "Autosave ·
  // Empty" between the two, until Saves listed the slots again).
  test('never writes over an older save the disk has no room to set aside, says so until Saves is opened, and offers it to export', async ({ page }) => {
    test.setTimeout(90_000);
    const older = JSON.stringify({ format: SAVE_FORMAT - 1, build: { sha: '0'.repeat(40), version: '0.0.0' }, data: { company: { name: 'Old Line Co' } }, pad: 'p'.repeat(300_000) });
    await page.addInitScript(fillStorage, older);
    // Every notice said, as it changes, and when: kept in the page, so a read has every one so far.
    type Said = { text: string; at: number }[];
    await page.addInitScript(() => {
      const said: Said = ((window as unknown as { said: Said }).said = []);
      let last = '';
      new MutationObserver(() => {
        const text = document.querySelector('[data-testid="notice"]')?.textContent ?? '';
        if (text !== last) said.push({ text: (last = text), at: performance.now() });
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    const said = () => page.evaluate(() => (window as unknown as { said: Said }).said);
    const live = () => page.evaluate(() => localStorage.getItem('interbus.save.boston'));
    await page.goto('./');
    const notice = page.getByTestId('notice');
    await expect(notice).toHaveText('Not autosaving: see Saves', { timeout: 30_000 });
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await leaveHome(page);
    await expect(page.getByTestId('founding-card')).toBeVisible();
    await expect(notice).toHaveCount(0);
    await foundCompany(page, 'New Line Co');
    await expect(notice).toHaveText('Not autosaving: see Saves');
    // Not timed: still said half a second past a notice's 6 s (NOTICE_MS in Notices.tsx) since it showed
    // again, while the game saves nothing.
    const shownFor = await page.evaluate(() => performance.now() - (window as unknown as { said: Said }).said.at(-1)!.at);
    await page.waitForTimeout(Math.max(0, 6_500 - shownFor));
    await expect(notice).toHaveText('Not autosaving: see Saves');
    await page.getByRole('button', { name: 'Saves' }).click();
    await expect(page.getByTestId('saves')).toBeVisible();
    await expect(notice).toHaveCount(0);
    expect(await live()).toBe(older);
    // One failure, one word: this browser does keep saves (the quarter's, the slots), so neither the
    // notice nor Saves says it keeps none.
    await expect(page.getByTestId('saves-refused')).toHaveCount(0);
    // It holds the autosave's place, so the autosave's row names it.
    const row = page.getByTestId('autosave');
    await expect(row).toContainText(`Autosave · A save from an older build (format ${SAVE_FORMAT - 1}), not set aside · this game isn’t saving itself`);
    const download = page.waitForEvent('download');
    await row.getByRole('button', { name: 'Export' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`interbus-boston-not-set-aside-older-${SAVE_FORMAT - 1}.json`);
    expect(Buffer.concat((await (await file.createReadStream()).toArray()) as Buffer[]).toString()).toBe(older);
    // Deleted after a question, it leaves the live key, and the game saves there again: the row names
    // this game straight after naming the save deleted.
    await page.evaluate(() => {
      const seen: string[] = ((window as unknown as { rowSeen: string[] }).rowSeen = []);
      new MutationObserver(() => void seen.push(document.querySelector('[data-testid="autosave"]')?.textContent ?? '')).observe(document.querySelector('[data-testid="saves"]')!, { subtree: true, childList: true, characterData: true });
    });
    await row.getByRole('button', { name: 'Delete' }).click();
    await row.getByRole('button', { name: 'Delete it' }).click();
    await expect(row).toContainText('Autosave · Year 1, Q1, Day 1, 05:00 · New Line Co');
    expect((await page.evaluate(() => (window as unknown as { rowSeen: string[] }).rowSeen)).filter((t) => !t.includes('not set aside') && !t.includes('New Line Co'))).toEqual([]);
    await expect(row.getByRole('button')).toHaveCount(0);
    await expect.poll(async () => (JSON.parse((await live()) ?? 'null') as { data: { company: { name: string } } } | null)?.data.company.name).toBe('New Line Co');
    // Said on Home and once founded, never on the founding card; never said to be set aside, and never
    // that the browser keeps no saves.
    expect((await said()).map(({ text }) => text)).toEqual(['Not autosaving: see Saves', '', 'Not autosaving: see Saves', '']);
  });

  // Site data refused: here the localStorage getter throws a SecurityError. Shown failing (TS-04) with
  // the refusal reaching only the console, so every save failed unseen and a reload lost the game.
  test('says once that a browser refusing storage keeps no saves, and Saves says so too', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() =>
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      }),
    );
    await page.goto('./');
    // Said as the game is ready, over Home, while the map may still be drawing; gone after its few seconds.
    const notice = page.getByTestId('notice');
    await expect(notice).toHaveText('This browser isn’t keeping saves', { timeout: 30_000 });
    await expect(notice).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await page.getByRole('button', { name: 'Saves' }).click();
    await expect(page.getByTestId('saves-refused')).toHaveText('This browser isn’t keeping saves. Export this game to keep it.');
    await page.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();
    await expect(page.getByTestId('slot-1')).toContainText('Slot 1 · Empty');
    // Said once: the saves refused after it bring no second notice.
    await page.waitForTimeout(1_000);
    await expect(notice).toHaveCount(0);
  });
});
