// The keyboard's way to a stop, and the focus after a stop's, a contract's and a day's buttons (useFocusBack; DayCard's
// Continue), apart from keyboard.spec.ts so that CI's fifths, which share the tests out by file, can run the two on runners
// of their own: as one file of 37 tests, its fifth's job took 7.6 minutes of the 8 on #184's push run. Its tests share nothing
// between them, so they run in parallel mode, shared out among the workers of its seventh: run whole on one worker, they
// started after errors.spec.ts and ran 4.5 minutes alone, the other worker standing idle for 3, so that the second seventh's
// tests took 6.6 minutes, in a job of 7.25 of the 8, on #191's push run.
import { expect, test, type Locator, type Page } from './base';
import { foundCompany, leaveHome } from './found';
import { lines, press } from './keys';
import { city, holdAnswers, setSpeed, toScreen, withBusyQuarterClose, withDebugLine, type SaveData } from './shell';

test.describe.configure({ mode: 'parallel' });

// The keyboard's way to a stop (the accessibility pass): the map opens a stop's card only on a press on it, so each line's card
// lists its stops, and the buttons that go with their card hand the focus on: a stop card's, the day card's Continue and
// Contracts' Take it. A hand-off waits only until the player's next key or press. Shown failing (TS-04) with no stops on the
// line card, the focus left where it fell, and a hand-off left waiting (the review of the stop card's keys).
test.describe('the keyboard’s way to a stop, and the focus after a stop’s, a contract’s and a day’s buttons', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('a line’s stops open their cards; a stop taken off a line hands the focus to its next line, then to the line’s stops', async ({ page }) => {
    // Line 2 calls at stops 2 to 4 too, so stop 2 stays up as it leaves Line 1, and comes down as it leaves Line 2.
    const panel = await lines(page, (d) => {
      const one = (d.lines as Record<string, unknown>[])[0]!;
      (d.lines as Record<string, unknown>[]).push({ ...one, id: 2, name: 'Line 2', stopIds: [2, 3, 4] });
      d.nextIds = { ...d.nextIds, line: 3 };
    });
    // The stops come after the line's controls, so one Tab still goes from the tabs to Buses.
    await panel.getByRole('tab', { name: 'Line 1', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(panel.getByTestId('line-model')).toBeFocused();
    const stops = panel.getByTestId('line-stops');
    await expect(stops.getByRole('button')).toHaveText(['1', '2', '3', '4']);
    // Tab reaches it, so the stop's card takes the keyboard with it, as a panel the keyboard opens does (focusSource).
    await stops.getByRole('button', { name: 'Stop 1', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(stops.getByRole('button', { name: 'Stop 2', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    const card = page.getByTestId('stop-card');
    await expect(card).toHaveAttribute('aria-label', 'Stop 2');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const shown = document.querySelector('[data-testid="stop-card"]');
          const at = document.activeElement;
          return !!shown && !!at && (at.contains(shown) || shown.contains(at));
        }),
      )
      .toBe(true);

    await press(page, card.getByRole('button', { name: /^Remove from Line 1/ }));
    await expect(card.getByRole('button', { name: /^Remove from Line 1/ })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Line 2', exact: true })).toBeFocused();
    await press(page, card.getByRole('button', { name: /^Remove from Line 2/ }));
    await expect(card).toHaveCount(0);
    await expect(stops.getByRole('button')).toHaveText(['1', '3', '4']);
    await expect(stops.getByRole('button', { name: 'Stop 1', exact: true })).toBeFocused();
  });

  test('a tier that goes hands the focus to the other; one that stays leaves no hand-off waiting for an Escape', async ({ page }) => {
    // Stop 2 a Shelter, and stop 1 off the line, alone (stops 3 and 4 lie below a 720 px window's foot).
    const panel = await lines(page, (d) => {
      (d.stops as { id: number; tier: number }[]).find((s) => s.id === 2)!.tier = 2;
      (d.lines as { stopIds: number[] }[])[0]!.stopIds = [2, 3, 4];
    });
    const card = page.getByTestId('stop-card');
    await panel.getByTestId('line-stops').getByRole('button', { name: 'Stop 2', exact: true }).click();
    // Down to a Sign, the lowest: its button goes, and the focus goes to the step up.
    await press(page, card.getByRole('button', { name: /^Make it a Sign/ }));
    await expect(card).toHaveAttribute('data-tier', '1');
    await expect(card.getByRole('button', { name: /^Make it a Shelter/ })).toBeFocused();
    // Up to a Shelter: its button stays, now for a Station. An Escape later closes the card and moves the focus nowhere, so
    // Space plays; a hand-off left waiting gave Build the focus, and Space opened the Build menu.
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('data-tier', '2');
    await expect(card.getByRole('button', { name: /^Make it a Station/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('build')).not.toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(page.getByTestId('build-menu')).toHaveCount(0);

    // Stop 1, on no line, opened from the map: Take it down closes its card, and the focus goes to Build.
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((t) => t.split(/[:,]/).map(Number));
    const one = placed.find(([id]) => id === 1)!;
    const [x, y] = await toScreen(page, [one[1]!, one[2]!]);
    await expect(async () => {
      await page.mouse.click(x, y);
      await expect(card).toHaveAttribute('aria-label', 'Stop 1', { timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await press(page, card.getByRole('button', { name: /^Take it down/ }));
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('build')).toBeFocused();
  });

  test('Take it hands the focus to the contract it took', async ({ page }) => {
    await lines(page);
    // The checklist's last step, Take a contract, opens Contracts (shell.ts: day 1 in profit).
    await page.getByTestId('checklist').click();
    const contracts = page.getByTestId('contracts');
    const offer = contracts.getByTestId('contract').filter({ has: page.getByRole('button', { name: 'Take it' }) }).first();
    const id = await offer.getAttribute('data-contract');
    await press(page, offer.getByRole('button', { name: 'Take it' }));
    const taken = contracts.locator(`[data-contract="${id}"]`);
    await expect(taken).toHaveAttribute('data-held', 'yes');
    await expect(taken).toBeFocused();
    // Help opened there with ? and closed gives the row the focus back, which takes it only until it leaves: it fell to the
    // page (round 11).
    await page.keyboard.press('?');
    const help = page.getByTestId('help');
    await expect(help).toBeVisible();
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    await expect(taken).toBeFocused();
  });

  /** The busy quarter's close ten minutes off (shell.ts), `edit` on it, paused, with Contracts open from the keyboard on its first offer's Take it. */
  async function onTakeIt(page: Page, edit?: (data: SaveData) => void) {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await leaveHome(page);
    await foundCompany(page);
    await withBusyQuarterClose(page, edit);
    const chip = page.getByTestId('contracts-chip');
    await chip.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(chip).toBeFocused();
    await page.keyboard.press('Enter');
    const contracts = page.getByTestId('contracts');
    const offer = contracts.getByTestId('contract').filter({ has: page.getByRole('button', { name: 'Take it' }) }).first();
    const id = (await offer.getAttribute('data-contract'))!;
    await tabTo(page, offer.getByRole('button', { name: 'Take it' }));
    return { contracts, id, day: page.getByTestId('day-card') };
  }

  /** onTakeIt's game played on at 60× to the close, which withdraws that offer. */
  async function onTheOfferWithdrawn(page: Page, edit?: (data: SaveData) => void) {
    const { contracts, id, day } = await onTakeIt(page, edit);
    await page.keyboard.press('2'); // 60×: the close in 10 s
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(contracts.locator(`[data-contract="${id}"]`)).toHaveCount(0);
    return { contracts, day };
  }

  test('a close that withdraws the offer the keyboard is on hands the focus to the row in its place', async ({ page }) => {
    // The close took the row and its Take it away, and the focus fell to the page with Contracts open (the systems audit's
    // fourteenth round). Shown failing (TS-04) with the focus left where it fell.
    test.setTimeout(90_000);
    const { contracts } = await onTheOfferWithdrawn(page);
    await expect(contracts.locator('[data-contract]:focus')).toHaveCount(1);
  });

  test('the close that ends the run, withdrawing the offer the keyboard is on, gives the focus to Continue', async ({ page }) => {
    // Contracts' hand-off ran before the day card's, so the row in the offer's place took the focus, its Take it turned off, and
    // Continue, which takes the focus at the run's end, had none (the review of the fourteenth round's fixes). Shown failing
    // (TS-04) with the hand-off at the run's end too.
    test.setTimeout(90_000);
    const { day } = await onTheOfferWithdrawn(page, (d) => {
      d.closesBelowFloor = 4; // the fifth close below the floor
      d.ledger.push({ day: 8, kind: 'buses', amountCents: -100_000_000, lineId: null });
    });
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await expect(day.getByRole('button', { name: 'Continue' })).toBeFocused();
  });

  // Continue gave the focus to the page from the row a close put in a withdrawn offer's place and from the row Take it gave it to,
  // each of which let its tabindex go as the focus left it for Continue, and from a Take it the next close withdrew with the card
  // kept (the systems audit's fifteenth round). Continue makes its row focusable again, and, the place gone, hands the focus to
  // its panel. A close's card often shows a render before the snapshot that withdraws the offer (the host sends one every 100 ms
  // at most), and the second test holds each answer apart so that it always does: the row takes the focus after the card has
  // shown, and Continue hands it back there. Shown failing (TS-04) on main, each to the page; with the card's following taken
  // out, the second to Contracts' box (and the first too at 60×, 4 runs of 4).
  for (const apart of [false, true]) {
    test(`Continue hands the focus back to the row in a withdrawn offer’s place${apart ? ', the close’s snapshot after its card' : ''}`, async ({ page }) => {
      test.setTimeout(90_000);
      if (apart) await page.addInitScript(holdAnswers);
      const { contracts, id, day } = await onTakeIt(page);
      // Each of the worker's answers on its own from here: the card shows, and the offer goes a render later.
      if (apart) await page.evaluate(() => void ((window as unknown as { apartMs: number }).apartMs = 20));
      await page.keyboard.press('3'); // 600×: the close in a second
      await expect(day).toBeVisible({ timeout: 30_000 });
      await expect(contracts.locator(`[data-contract="${id}"]`)).toHaveCount(0);
      const row = contracts.locator('[data-contract]:focus');
      await expect(row).toHaveCount(1);
      const there = (await row.getAttribute('data-contract'))!;
      await page.keyboard.press(' '); // paused, so nothing else moves
      await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
      await tabTo(page, day.getByRole('button', { name: 'Continue' }));
      await page.keyboard.press('Enter');
      await expect(day).toHaveCount(0);
      await expect(contracts.locator(`[data-contract="${there}"]`)).toBeFocused();
    });
  }

  test('Continue hands the focus back to the row Take it gave it to', async ({ page }) => {
    test.setTimeout(90_000);
    const { contracts, id, day } = await onTakeIt(page);
    await page.keyboard.press('Enter'); // Take it
    const taken = contracts.locator(`[data-contract="${id}"]`);
    await expect(taken).toHaveAttribute('data-held', 'yes');
    await expect(taken).toBeFocused();
    await page.keyboard.press('3'); // 600×: the close in a second
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(taken).toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await tabTo(page, day.getByRole('button', { name: 'Continue' }));
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(taken).toBeFocused();
  });

  test('Continue hands the focus to Contracts, the Take it it came from withdrawn by the next close', async ({ page }) => {
    test.setTimeout(120_000);
    // Offered on day 2, the offers stay at the quarter's close, on day 8, and go at the next.
    const { contracts, id, day } = await onTakeIt(page, (d) => {
      for (const c of d.contracts as { acceptedDay: number | null; offeredDay: number }[]) if (c.acceptedDay === null) c.offeredDay = 2;
    });
    await page.keyboard.press('3'); // 600×: the close in a second
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(contracts.locator(`[data-contract="${id}"]`)).toHaveCount(1);
    const go = day.getByRole('button', { name: 'Continue' });
    await tabTo(page, go);
    const first = (await day.getAttribute('aria-label'))!;
    await page.keyboard.press('5'); // 5,400×: the next close in about 16 s
    await expect(day).not.toHaveAttribute('aria-label', first, { timeout: 40_000 });
    await expect(contracts.locator(`[data-contract="${id}"]`)).toHaveCount(0);
    await expect(go).toBeFocused();
    await page.keyboard.press(' '); // Space presses Continue
    await expect(day).toHaveCount(0);
    await expect(page.locator('[data-movable="contracts"]')).toBeFocused();
  });

  test('Continue hands the focus to Contracts after Help over the card, the Take it it came from withdrawn by the close that came', async ({ page }) => {
    // Help, opened from Continue as the next close came, was taken for where the focus came from, and gone as Continue handed it
    // back: the focus went to the page (the review of the fifteenth round's fixes). Shown failing (TS-04) on main and before the
    // fix, and with either half of it taken out: the place kept through Help, or followed only with the focus on it as it went.
    test.setTimeout(120_000);
    const { contracts, id, day } = await onTakeIt(page, (d) => {
      for (const c of d.contracts as { acceptedDay: number | null; offeredDay: number }[]) if (c.acceptedDay === null) c.offeredDay = 2;
    });
    await page.keyboard.press('3'); // 600×: the close in a second
    await expect(day).toBeVisible({ timeout: 30_000 });
    const go = day.getByRole('button', { name: 'Continue' });
    await tabTo(page, go);
    const first = (await day.getAttribute('aria-label'))!;
    await page.keyboard.press('?');
    const help = page.getByTestId('help');
    await expect(help).toBeVisible();
    await page.keyboard.press('5'); // 5,400×: the next close in about 16 s
    await expect(day).not.toHaveAttribute('aria-label', first, { timeout: 40_000 });
    await expect(contracts.locator(`[data-contract="${id}"]`)).toHaveCount(0);
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    await expect(go).toBeFocused();
    await page.keyboard.press(' '); // Space presses Continue
    await expect(day).toHaveCount(0);
    await expect(page.locator('[data-movable="contracts"]')).toBeFocused();
  });

  /** The debug line's game at 23:30, half an hour before its day closes (shell.ts), at 600×, or paused at 23:`minute`; the day card and its Continue. */
  async function toTheClose(page: Page, minute?: number) {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await leaveHome(page);
    await foundCompany(page);
    await withDebugLine(page, (d) => void (d.clock.elapsed = 86_400 + 18 * 3_600 + (minute ?? 30) * 60));
    if (minute === undefined) await setSpeed(page, '600×');
    const day = page.getByTestId('day-card');
    return { day, go: day.getByRole('button', { name: 'Continue' }) };
  }

  /** Tabs on from where the focus is until `go` has it, as a keyboard player reaches it. */
  async function tabTo(page: Page, go: Locator) {
    for (let k = 0; k < 60 && !(await go.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(go).toBeFocused();
  }

  test('Continue hands the focus back where the keyboard had it as the day card showed', async ({ page }) => {
    const { day, go } = await toTheClose(page);
    // The keyboard on the dock's Lines as the card shows, three game minutes' wait or more ahead of it.
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await dockLines.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(dockLines).toBeFocused();
    await expect(day).toBeVisible({ timeout: 30_000 });
    await tabTo(page, go);
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(dockLines).toBeFocused();
  });

  test('the next close’s card keeps the focus on Continue, which hands it back where it came from', async ({ page }) => {
    // The next close built its card anew, and the focus on the last one's Continue fell to the page, where Enter did nothing and
    // Space paused (the systems audit's fourteenth round). Shown failing (TS-04) with the card built anew at each close.
    test.setTimeout(90_000);
    const { day, go } = await toTheClose(page);
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await dockLines.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(dockLines).toBeFocused();
    await expect(day).toBeVisible({ timeout: 30_000 });
    const first = (await day.getAttribute('aria-label'))!;
    await tabTo(page, go);
    await page.keyboard.press('5'); // 5,400×: the next close in about 16 s
    await expect(day).not.toHaveAttribute('aria-label', first, { timeout: 40_000 });
    await expect(go).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(dockLines).toBeFocused();
  });

  test('Continue leaves the page’s focus on the page as the card goes, so Space plays', async ({ page }) => {
    // Where the focus came into the card from was the Saves chip on every forward Tab, and Space opened Saves.
    const { day, go } = await toTheClose(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(day).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await tabTo(page, go);
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(page.getByTestId('saves')).toHaveCount(0);
  });

  /** The keyboard on a stop card's first step as the day card shows: Lines and the card opened from the keyboard, or by the mouse. */
  async function stepAtTheClose(page: Page, mouse = false) {
    const { day, go } = await toTheClose(page, 58);
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    const stop2 = page.getByTestId('line-stops').getByRole('button', { name: 'Stop 2', exact: true });
    if (mouse) {
      await dockLines.click();
      await stop2.click();
    } else {
      await dockLines.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await tabTo(page, stop2);
      await page.keyboard.press('Enter');
    }
    const card = page.getByTestId('stop-card');
    const step = card.locator('.tiers button').first();
    await tabTo(page, step);
    await page.keyboard.press('2'); // 60×: the close in two game minutes
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(step).toBeFocused();
    return { day, go, card, dockLines, stop2 };
  }

  // Where the focus came from, gone with its panel, left Continue nothing to hand it to: from a stop's card closed with the card
  // up, the focus fell to the page (the systems audit's sixteenth round). Continue hands it where the stop card's own close does
  // (Panels' handBackTo): to Stop 2 while Lines is open, and to the dock's Lines once Escape has closed Lines too. The round's
  // fix gave Build for both, the first once the card had drawn again with the keyboard on the stop card's × (its review). Shown
  // failing (TS-04) on main, the focus on the page, and with Build in place of Panels' hand-back.
  test('Continue hands the focus to the stop’s button in Lines, once the stop card it came from has closed by its ×', async ({ page }) => {
    test.setTimeout(90_000);
    const at = await stepAtTheClose(page);
    const close = at.card.getByRole('button', { name: 'Close', exact: true });
    for (let k = 0; k < 20 && !(await close.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    // The day card drawn again since, with the keyboard on the ×.
    const date = page.getByTestId('date');
    await expect(date).not.toHaveText((await date.textContent())!, { timeout: 10_000 });
    await page.keyboard.press('Enter');
    await expect(at.card).toHaveCount(0);
    await expect(at.stop2).toBeFocused();
    await tabTo(page, at.go);
    await page.keyboard.press('Enter');
    await expect(at.day).toHaveCount(0);
    await expect(at.stop2).toBeFocused();
  });

  test('Continue hands the focus to the dock’s Lines, once Escape has closed the stop card it came from and Lines', async ({ page }) => {
    test.setTimeout(90_000);
    const at = await stepAtTheClose(page);
    await tabTo(page, at.go);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-movable]')).toHaveCount(0);
    await expect(at.day).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(at.day).toHaveCount(0);
    await expect(at.dockLines).toBeFocused();
  });

  // The route editor stands in for Lines, so Escape from Continue closes both, as from a stop's card: the dock's Lines, as Escape
  // from the editor gives (the review of the systems audit's sixteenth round, which found Build). Shown failing (TS-04) on main,
  // the focus on the page, and with Build in place of Panels' hand-back.
  test('Continue hands the focus to the dock’s Lines, once Escape has closed the route editor it came from', async ({ page }) => {
    test.setTimeout(90_000);
    const { day, go } = await toTheClose(page, 58);
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await dockLines.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByTestId('inspector').getByRole('button', { name: 'Edit route' }));
    await page.keyboard.press('Enter');
    const editor = page.getByTestId('route-editor');
    await expect(editor).toBeVisible();
    const cancel = editor.getByRole('button', { name: 'Cancel' });
    await tabTo(page, cancel);
    await page.keyboard.press('2'); // 60×: the close in two game minutes
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(cancel).toBeFocused();
    await tabTo(page, go);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-movable]')).toHaveCount(0);
    await expect(day).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(dockLines).toBeFocused();
  });

  // A stop card the mouse opened left no opener to go back to (Panels keeps none for it): Continue gives Build, as the stop
  // card's own hand-back does with nothing else, where the focus fell to the page (the systems audit's sixteenth round). Shown
  // failing (TS-04) on main, the focus on the page.
  test('Continue hands the focus to Build once a stop card the mouse opened has closed', async ({ page }) => {
    test.setTimeout(90_000);
    const at = await stepAtTheClose(page, true);
    await tabTo(page, at.go);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-movable]')).toHaveCount(0);
    await expect(at.day).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(at.day).toHaveCount(0);
    await expect(page.getByTestId('build')).toBeFocused();
  });

  // A step the mouse pressed is no place of the keyboard's, however many keys since: Continue pressed by the mouse gave Build the
  // focus from it once a speed key had made the step match :focus-visible, and Enter then opened the Build menu (the review of
  // the systems audit's sixteenth round). Shown failing (TS-04) with :focus-visible in place of App's focusSource.
  test('Continue leaves the focus on the page after a step the mouse pressed, whatever key came since', async ({ page }) => {
    test.setTimeout(90_000);
    const { day, go } = await toTheClose(page, 58);
    await page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true }).click();
    await page.getByTestId('line-stops').getByRole('button', { name: 'Stop 2', exact: true }).click();
    const step = page.getByTestId('stop-card').locator('.tiers button').first();
    // A press that keeps the stop as it is: the step's mouse down and up, off the button before the up (no click).
    const box = (await step.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 40);
    await page.mouse.up();
    await expect(step).toBeFocused();
    await page.keyboard.press('2'); // 60×: the close in two game minutes
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => step.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-movable]')).toHaveCount(0);
    await go.click();
    await expect(day).toHaveCount(0);
    await expect(page.getByTestId('build')).not.toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });

  test('Continue hands the focus to the Contracts chip when the checklist step it came from was completed', async ({ page }) => {
    test.setTimeout(90_000);
    const { day, go } = await toTheClose(page, 58);
    const checklist = page.getByTestId('checklist');
    await expect(checklist).toHaveJSProperty('tagName', 'BUTTON');
    await checklist.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(checklist).toBeFocused();
    await page.keyboard.press('2'); // 60×: the close in two game minutes
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(checklist).toBeFocused();
    await page.keyboard.press('Enter');
    const contracts = page.getByTestId('contracts');
    await expect(contracts).toBeVisible();
    await tabTo(page, contracts.getByRole('button', { name: 'Take it' }).first());
    await page.keyboard.press('Enter');
    await expect(contracts.locator('[data-held="yes"]')).toHaveCount(1);
    const chip = page.getByTestId('contracts-chip');
    await expect(chip).toBeVisible();
    await expect(checklist).toHaveCount(0);
    await tabTo(page, go);
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(chip).toBeFocused();
  });
});
