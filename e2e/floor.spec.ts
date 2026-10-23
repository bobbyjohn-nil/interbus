// The failure floor on the page (the M3 spec, item 10; exit check 4): a game owing more than the
// credit line's −$150k counts down its day closes in a chip; the fifth ends the run, and Restart this
// quarter reopens the game where it began (here, where the file was loaded). The game is a save file
// edited to owe $200k at 23:50 with four closes already behind it, so the run ends within seconds;
// its closing day's card is read first, then the failure card shows.
import { expect, test, type Locator } from './base';
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

  // The lender's card stays until Restart this quarter, and stood at the window's top centre over the panels: with Contracts,
  // Lines and Finance opened in turn, Finance's views and Close were under it at 1152×720 to 1440×900, and a press on its Lines
  // view landed on the card (the review of #142). It takes a free place on the panel layer now, so the panels open beside it,
  // and it beside a panel open as the run ends. No panel covers it either: at 1152×720, I13's tightest window, Finance found no
  // free place and fell back over it, hiding Restart this quarter (the review of the ninth round); it falls back below it, and
  // the card is drawn above every panel. And a narrower window keeps it whole at its width, as a panel is kept: it was squeezed
  // to 304 px, flush with the window's edge. Shown failing (TS-04) with the card where it was, with the fallback as before, with
  // the card raised as the panels are, and with its width unset.
  test('the lender’s card keeps clear of the panels, open before it or after', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page, (d) => {
      d.clock.elapsed = 86_400 + 18 * 3_600 + 50 * 60;
      (d as unknown as { closesBelowFloor: number }).closesBelowFloor = 4;
      d.ledger.push({ day: 1, kind: 'buses', amountCents: -(STARTING_CENTS + 20_000_000), lineId: null });
    });
    /** Whether a press at the middle of `l` lands on it, not on something over it. */
    const onTop = (l: Locator) =>
      l.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
    const apart = async (a: Locator, b: Locator) => {
      const [p, q] = [(await a.boundingBox())!, (await b.boundingBox())!];
      return p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y;
    };
    const finance = page.getByTestId('finance');
    const failure = page.getByTestId('failure-card');
    const restart = failure.getByRole('button', { name: 'Restart this quarter' });
    const dayCard = page.getByTestId('day-card');
    /** Time to the fifth close, then the closing day's card read. Restart this quarter goes back to where the file loaded. */
    const endTheRun = async () => {
      await setSpeed(page, '5,400×');
      await expect(dayCard).toBeVisible({ timeout: 30_000 });
      await dayCard.getByRole('button', { name: 'Continue' }).click();
      await expect(failure).toBeVisible();
    };

    // Nothing open as the run ends, then Contracts, Lines and Finance opened in turn: none over the card, and Finance's views
    // and Close in reach.
    await endTheRun();
    await page.getByTestId('contracts-chip').click();
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    for (const id of ['contracts', 'inspector', 'finance']) expect(await apart(failure, page.getByTestId(id)), id).toBe(true);
    expect(await onTop(restart)).toBe(true);
    for (const id of ['finance-overview', 'finance-breakdown', 'finance-lines']) expect(await onTop(finance.getByTestId(id)), id).toBe(true);
    expect(await onTop(finance.getByRole('button', { name: 'Close', exact: true }))).toBe(true);
    await finance.getByTestId('finance-lines').click();
    await expect(finance).toHaveAttribute('data-view', 'lines');

    // A narrower window: the card stays 380 px wide, 12 px inside its edge, and above the panels it now meets (Contracts, kept
    // whole where it was, covered its Restart).
    await page.setViewportSize({ width: 1000, height: 600 });
    await expect.poll(async () => (await failure.boundingBox())!.x).toBeLessThan(760);
    const card = (await failure.boundingBox())!;
    expect(Math.round(card.width)).toBe(380);
    expect(card.x + card.width).toBeLessThanOrEqual(1000 - 12);
    expect(await onTop(restart)).toBe(true);
    await page.setViewportSize({ width: 1152, height: 720 });

    // Saves open as the run ends again: the card opens beside it.
    await restart.click();
    await expect(failure).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('saves-chip').click();
    const saves = page.getByTestId('saves');
    await expect(saves).toBeVisible();
    await endTheRun();
    expect(await apart(failure, saves)).toBe(true);
    expect(await onTop(restart)).toBe(true);
  });

  // Once the lender has ended the run the host refuses every change (D10), and the page offered them all the same, each press
  // answered by a notice alone: Build's tools, play and the speed menu, the keys, Take it, a line's headways, model and Edit route,
  // and its fare in Finance (the review of the systems audit's eighth round). Shown failing (TS-04) with the page as before. Its
  // review (#142) found what that left: a list open as the run ended stayed open and picked, Space pressed the button the mouse
  // pressed last, Play and the speed menu still looked live, the Build menu opened again by itself after Restart, the focus fell
  // to the page, and the route editor took its line's panel with it. The commands are counted as the page sends them, so a key
  // that sends one fails here before its refusal comes back.
  test('an ended run offers nothing the lender refuses, and Restart this quarter brings it all back', async ({ page }) => {
    test.setTimeout(90_000);
    // The commands the page sends the sim, by type (presses.spec.ts counts them so).
    await page.addInitScript(() => {
      const w = window as unknown as { posted: Record<string, number> };
      w.posted = {};
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (this: Worker, message: unknown, options?: StructuredSerializeOptions) {
        const type = (message as { type?: unknown } | null)?.type;
        if (typeof type === 'string') w.posted[type] = (w.posted[type] ?? 0) + 1;
        post.call(this, message, options);
      } as typeof post;
    });
    const posted = (type: string) => page.evaluate((t) => (window as unknown as { posted: Record<string, number> }).posted[t] ?? 0, type);
    // A frame after a key, so what it pressed has drawn.
    const settled = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
    await page.goto('./');
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // The debug line, owing $199k at 23:50 on day 2 with four closes below the floor behind it. Restart this quarter goes back
    // here, so the run can end again.
    await withDebugLine(page, (d) => {
      d.clock.elapsed = 86_400 + 18 * 3_600 + 50 * 60;
      (d as unknown as { closesBelowFloor: number }).closesBelowFloor = 4;
      d.ledger.push({ day: 1, kind: 'buses', amountCents: -(STARTING_CENTS + 20_000_000), lineId: null });
    });
    const dayCard = page.getByTestId('day-card');
    const failure = page.getByTestId('failure-card');
    const restart = failure.getByRole('button', { name: 'Restart this quarter' });
    /** Time from the keys (5 is 5,400×) to the fifth close, then the closing day's card read and closed from the keyboard. */
    const endTheRun = async () => {
      await page.keyboard.press('5');
      await expect(dayCard).toBeVisible({ timeout: 30_000 });
      await expect(panel).toHaveAttribute('data-speed', '0');
    };

    // The keyboard in Finance's fare list as the run ends: the list closes, so ArrowDown and Enter pick no fare, and the focus
    // goes to the closing day's Continue, then to Restart this quarter. Time runs first, at 60× (2), so the close is about
    // 10 s away as the list opens: an open list keeps every key from the game (round 10), so 5 pressed in it runs nothing.
    await page.keyboard.press('2');
    await expect(panel).toHaveAttribute('data-speed', '2');
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    await finance.getByTestId('fare-1').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(dayCard).toBeVisible({ timeout: 30_000 });
    await expect(panel).toHaveAttribute('data-speed', '0');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(dayCard.getByRole('button', { name: 'Continue' })).toBeFocused();
    const fares = await posted('set-fare');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(failure).toBeVisible();
    await expect(restart).toBeFocused();
    expect(await posted('set-fare')).toBe(fares);

    await expect(page.getByTestId('build')).toBeDisabled();
    for (const id of ['play', 'speed-menu']) {
      await expect(page.getByTestId(id)).toBeDisabled();
      // Drawn as off, as Build is: they looked live.
      await expect(page.getByTestId(id)).toHaveCSS('opacity', '0.4');
    }
    await expect(page.getByTestId('play')).toHaveAttribute('title', 'Play');
    await expect(page.getByTestId('checklist')).toHaveCount(0);
    await expect(finance.getByTestId('fare-1')).toBeDisabled();

    // The keys send nothing: Space, 1 to 5 and Ctrl+Z. Space presses no button the mouse pressed last, either: Finance, here,
    // which Space opened again.
    const speeds = await posted('speed');
    const undos = await posted('undo');
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await expect(finance).toHaveCount(0);
    await page.keyboard.press('Space');
    await page.keyboard.press('3');
    await page.keyboard.press('ControlOrMeta+z');
    await settled();
    await expect(finance).toHaveCount(0);
    expect(await posted('speed')).toBe(speeds);
    expect(await posted('undo')).toBe(undos);

    await page.getByTestId('contracts-chip').click();
    const offers = page.getByTestId('contracts').getByRole('button', { name: 'Take it' });
    expect(await offers.count()).toBeGreaterThan(0);
    for (const take of await offers.all()) await expect(take).toBeDisabled();
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    await expect(lines.getByTestId('headway-peak')).toBeDisabled();
    await expect(lines.getByTestId('line-model')).toBeDisabled();
    await expect(lines.getByRole('button', { name: 'Edit route' })).toBeDisabled();

    await restart.click();
    await expect(failure).toHaveCount(0);
    await expect(page.getByTestId('build')).toBeEnabled();
    await expect(page.getByTestId('play')).toBeEnabled();
    await expect(page.getByTestId('play')).toHaveCSS('opacity', '1');
    // The quarter's start is loaded, its panels closed; its line's card takes changes again.
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await expect(lines.getByTestId('headway-peak')).toBeEnabled();

    // The route editor out as the run ends, opened from the keyboard: it goes down, and its line shows again in the panel it
    // stood in for, which takes no focus, as the game brought it back, not the player: the closing day's Continue takes it (the
    // review of the ninth round: brought back as the player's, the line's panel kept the focus from Continue).
    const editRoute = lines.getByRole('button', { name: 'Edit route' });
    for (let k = 0; k < 60 && !(await editRoute.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(editRoute).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('route-editor')).toBeVisible();
    await expect(lines).toHaveCount(0);
    await endTheRun();
    await expect(page.getByTestId('route-editor')).toHaveCount(0);
    await expect(lines).toBeVisible();
    await expect(dayCard.getByRole('button', { name: 'Continue' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(restart).toBeFocused();
    await restart.click();

    // The Build menu open as the run ends: it closes, Build no longer pressed, and stays closed after Restart this quarter.
    await page.getByTestId('build').click();
    await expect(page.getByTestId('build-menu')).toBeVisible();
    await endTheRun();
    await expect(page.getByTestId('build-menu')).toHaveCount(0);
    await expect(page.getByTestId('build')).toHaveAttribute('aria-expanded', 'false');
    await dayCard.getByRole('button', { name: 'Continue' }).press('Enter');
    await restart.click();
    await expect(page.getByTestId('build')).toBeEnabled();
    await expect(page.getByTestId('build-menu')).toHaveCount(0);
  });
});
