// Home (the M5 spec, item 3; exit check 1's first step): the first screen over the paused map. New
// game leads to the founding card; Saves' Back to Home returns to it, where Continue names the game
// and goes on with it; New game asks before it replaces that game, and the slots stay.
import { expect, test, type Page } from '@playwright/test';
import { BACK_HOME_ASK_COPY, NEWER_LINE_COPY } from '../src/ui/copy';
import { usd } from '../src/ui/format';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, chromeShare, city, onDepotLand, setFare, setSpeed, toScreen, withDebugLine, zoomOutOnce } from './shell';

test.describe('Home', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('opens first, continues the game, and asks before a new game replaces it', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('./');
    const home = page.getByTestId('home');
    await expect(home).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-continue')).toHaveCount(0); // a first visit has nothing to continue
    await expect(page.getByTestId('sim-panel')).toHaveCount(0); // the chip row waits for the game
    await expect(page.getByTestId('build-chip')).toBeVisible();

    await foundCompany(page);
    const panel = page.getByTestId('sim-panel');
    await zoomOutOnce(page);
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();

    // Back to Home pauses and saves; Continue names the game and goes on with it.
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await expect(home).toBeVisible();
    await expect(page.getByTestId('home-continue')).toContainText(`Back Bay Transit · Year 1, Q1, Day 1 · ${usd(STARTING_CENTS - 15_000_000)}`);
    await leaveHome(page, 'continue');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await expect(panel).toHaveAttribute('data-speed', '0');

    // New game asks first; Keep it keeps the game.
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await home.getByRole('button', { name: 'New game' }).click();
    await expect(home).toContainText('Start over? Back Bay Transit, on Year 1, Q1, Day 1, will be replaced. Your slots stay.');
    await home.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByTestId('home-continue')).toBeVisible();

    // Start a new game: the founding card for an unnamed company, the autosave replaced, slot 1 kept.
    await home.getByRole('button', { name: 'New game' }).click();
    await home.getByRole('button', { name: 'Start a new game' }).click();
    await expect(page.getByTestId('founding-card')).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('interbus.save.boston') ?? '{}').data?.company?.name)).toBe('');
    expect(await page.evaluate(() => localStorage.getItem('interbus.slot.boston.1'))).toContain('Back Bay Transit');

    // A reload comes back to Home with nothing to continue, since the new company is not yet named.
    await page.reload();
    await expect(home).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-continue')).toHaveCount(0);

    // Slot 1 loaded from Home's Saves goes straight into that game, with no question: no company is
    // founded, so there is no game to lose. Shown failing (TS-04) with "Replace this game" asked (this
    // test pinned it).
    await home.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Load' }).click();
    await expect(home).toBeHidden();
    await expect(page.getByTestId('notice')).toContainText('Slot loaded');
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
  });

  // Every screen can be left (the M5 spec, item 3): the founding card's Back to Home returns to Home as Saves' does, on a
  // first visit (to import a save instead) and after a new game replaced a company (to load a slot instead), by the mouse or
  // the keyboard. Shown failing (TS-04) on abb5f2f, where the card held only its form, with no Saves chip and no dock beside
  // it, and Escape did nothing: only a reload left it.
  test('leaves the founding card for Home, on a first visit and after a new game', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    const home = page.getByTestId('home');
    const card = page.getByTestId('founding-card');
    await leaveHome(page);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Back to Home' }).click();
    await expect(home).toBeVisible();
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('home-continue')).toHaveCount(0);
    await home.getByRole('button', { name: 'Saves' }).click();
    const saves = page.getByTestId('saves');
    await expect(saves.getByRole('button', { name: 'Import a save file' })).toBeVisible();
    await saves.getByRole('button', { name: 'Close' }).click();

    // After a new game replaced the company, from the keyboard: back on Home, slot 1 loads.
    await foundCompany(page);
    await page.getByTestId('saves-chip').click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await home.getByRole('button', { name: 'New game' }).click();
    await home.getByRole('button', { name: 'Start a new game' }).click();
    await expect(card).toBeVisible();
    const back = card.getByRole('button', { name: 'Back to Home' });
    for (let n = 0; n < 10 && !(await back.evaluate((el) => el === document.activeElement)); n++) await page.keyboard.press('Tab');
    await expect(back).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(home).toBeVisible();
    await expect(page.getByTestId('home-continue')).toHaveCount(0);
    await home.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Load' }).click();
    await expect(home).toBeHidden();
    await expect(page.getByTestId('notice')).toContainText('Slot loaded');
    await expect(page.getByTestId('saves-chip')).toBeVisible();
  });

  // Two tabs of the game on one browser, as when the owner opens the preview again to see a deploy while an old tab stays open
  // (D12; the systems audit's fifth round). On 050dbdd the second tab's Home named and played the game it read as it opened,
  // its first pause wrote that over the first tab's newer day, fare change and cash, and nothing said so: shown failing (TS-04)
  // there, where its Home still read Day 2 after the first tab had saved Day 3. Now Home names and plays the game the browser
  // holds, and a tab whose game another tab's save has overtaken writes nothing over it, and says so; its Back to Home, which
  // goes on with the other tab's game, asks first once it has played on since (the systems audit's sixth round).
  test('names and plays the game another tab saved, and a tab another tab has overtaken writes nothing over it, and asks before Home drops its play', async ({ context }) => {
    test.setTimeout(150_000);
    const live = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('interbus.save.boston')!) as { data: { clock: { elapsed: number }; lines: { fareCents: number }[] } });
    const elapsed = async (p: Page) => Number(await p.getByTestId('sim-panel').getAttribute('data-elapsed'));
    const a = await context.newPage();
    await a.setViewportSize({ width: 1152, height: 720 }); // I13's tight size, for Saves with Back to Home's question
    await a.goto('./');
    await foundCompany(a);
    await withDebugLine(a);
    const b = await context.newPage();
    await b.goto('./');
    const continueB = b.getByTestId('home-continue');
    await expect(continueB).toContainText('Back Bay Transit · Year 1, Q1, Day 2 ·', { timeout: 30_000 });

    // A plays on into day 3 and changes a fare, paused: B's Home names that game, and Continue goes on with it.
    await a.bringToFront();
    await setSpeed(a, '5,400×');
    await expect.poll(() => elapsed(a), { timeout: 60_000 }).toBeGreaterThan(2 * 86_400);
    await a.getByTestId('play').click();
    await setFare(a, 'Line 1', '$3.00');
    await expect.poll(async () => (await live(a)).data.lines[0]!.fareCents).toBe(300);
    const fromA = await live(a);
    const cashA = Number(await a.getByTestId('sim-panel').getAttribute('data-cash'));
    await expect(continueB).toContainText(`Back Bay Transit · Year 1, Q1, Day 3 · ${usd(cashA)}`);
    await b.bringToFront();
    await continueB.click();
    await expect(b.getByTestId('sim-panel')).toHaveAttribute('data-elapsed', String(fromA.data.clock.elapsed));
    await expect(b.getByTestId('saves-chip')).toHaveText('Saves');

    // B plays on, so its saves are the newest: A, still on its game, says it is overtaken and writes nothing over them.
    await setSpeed(b, '600×');
    await expect(a.getByTestId('saves-chip')).toHaveText('Autosave off', { timeout: 10_000 });
    await expect(a.getByTestId('notice')).toHaveText('Another tab changed the autosave');
    await expect.poll(() => elapsed(b), { timeout: 30_000 }).toBeGreaterThan(fromA.data.clock.elapsed + 3_600);
    await b.getByTestId('play').click();
    await expect(b.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await expect.poll(async () => (await live(b)).data.clock.elapsed).toBe(await elapsed(b));
    const fromB = await live(b);
    expect(fromB.data.lines[0]!.fareCents).toBe(300);
    await a.bringToFront();
    await setSpeed(a, '600×');
    await expect.poll(() => elapsed(a)).toBeGreaterThan(fromA.data.clock.elapsed + 1_800);
    await a.getByTestId('play').click();
    await expect(a.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await a.waitForTimeout(500);
    expect((await live(a)).data.clock.elapsed).toBe(fromB.data.clock.elapsed);
    await expect(a.getByTestId('saves-chip')).toHaveText('Autosave off');
    const playedA = await elapsed(a);

    // A's Saves says why. A has played on since B left it behind, and Home would go on with B's game, so Back to Home asks first,
    // naming what is lost and the way to keep it, in place of its row's buttons, the focus on Keep playing from the keyboard; Keep
    // playing keeps A's game. Shown failing (TS-04) on c3c2d9a, whose Back to Home went to Home at once and took B's game up.
    // Day 2's card, from A's play into day 3, closes first: I13 measures one panel at a time.
    await a.getByTestId('day-card').getByRole('button', { name: 'Continue' }).click();
    await a.getByTestId('saves-chip').click();
    const savesA = a.getByTestId('saves');
    await expect(savesA.getByTestId('saves-refused')).toHaveText(NEWER_LINE_COPY);
    const share = { saves: await chromeShare(a), asking: 0 };
    await savesA.getByRole('button', { name: 'Back to Home' }).focus();
    await a.keyboard.press('Enter');
    await expect(savesA.getByTestId('saves-home-ask')).toHaveText(BACK_HOME_ASK_COPY);
    await expect(savesA.getByRole('button', { name: 'Keep playing' })).toBeFocused();
    await expect(savesA.getByRole('button', { name: 'Export this game' })).toBeVisible();
    // I13 at 1152×720: Saves with the question open stays within a panel's 26%.
    share.asking = await chromeShare(a);
    test.info().annotations.push({ type: 'chrome %', description: JSON.stringify(Object.fromEntries(Object.entries(share).map(([k, v]) => [k, Math.round(v * 10_000) / 100]))) });
    expect(share.asking).toBeLessThanOrEqual(0.26);
    await a.keyboard.press('Enter');
    await expect(savesA.getByRole('button', { name: 'Back to Home' })).toBeFocused();
    await expect(a.getByTestId('home')).toHaveCount(0);
    await expect(a.getByTestId('sim-panel')).toHaveAttribute('data-elapsed', String(playedA));

    // Replace this game: Home names B's game, and Continue goes on with it, saving itself again.
    await savesA.getByRole('button', { name: 'Back to Home' }).click();
    await savesA.getByRole('button', { name: 'Replace this game' }).click();
    const cashB = Number(await b.getByTestId('sim-panel').getAttribute('data-cash'));
    await expect(a.getByTestId('home-continue')).toContainText(`Back Bay Transit · Year 1, Q1, Day 3 · ${usd(cashB)}`);
    await a.getByTestId('home-continue').click();
    await expect(a.getByTestId('sim-panel')).toHaveAttribute('data-elapsed', String(fromB.data.clock.elapsed));
    await expect(a.getByTestId('saves-chip')).toHaveText('Saves');
    await setSpeed(a, '600×');
    await expect.poll(async () => (await live(a)).data.clock.elapsed, { timeout: 10_000 }).toBeGreaterThan(fromB.data.clock.elapsed);

    // A pauses, its last save kept, and opens Saves: slot 1 is empty. B, left behind in its turn, keeps its game there, saving
    // nothing else, and A's row names that save, so A's Save here asks before replacing it. Shown failing (TS-04) with the page
    // hearing the autosave's key alone: A's row read Empty, and its Save here wrote over B's game unasked (the systems audit's
    // seventh round).
    await a.getByTestId('play').click();
    await expect(a.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await expect.poll(async () => (await live(a)).data.clock.elapsed).toBe(await elapsed(a));
    await a.getByTestId('saves-chip').click();
    const slotA = a.getByTestId('slot-1');
    await expect(slotA).toHaveAttribute('data-empty', 'yes');
    await b.bringToFront();
    await expect(b.getByTestId('saves-chip')).toHaveText('Autosave off');
    await b.getByTestId('saves-chip').click();
    await b.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();
    await expect(b.getByTestId('slot-1')).toHaveAttribute('data-empty', 'no');
    await a.bringToFront();
    await expect(slotA).toHaveAttribute('data-empty', 'no');
    await slotA.getByRole('button', { name: 'Save here' }).click();
    await expect(slotA.getByRole('button', { name: 'Replace Slot 1' })).toBeVisible();
  });
});
