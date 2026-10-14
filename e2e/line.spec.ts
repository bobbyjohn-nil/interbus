import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome } from './found';
import { city, onDepotLand, setSpeed, toScreen, zoomOutOnce } from './shell';

// The M2 spec's exit check as one game (I15): found, a depot on the green tint, four stops from
// Copley to Longwood, Create, its buses running, a day whose cost rows land on the card and add up to
// the change in cash (I1), then a reload that carries on from the save where the game was paused.
test.describe('the line tool on the fixture', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('places a depot, draws Copley to Longwood, creates it, and a day of costs adds up', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    const map = page.getByTestId('map');
    const panel = page.getByTestId('sim-panel');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    // Home first (the M5 spec, item 3), then step 1: name and colour the company; cash reads the founding capital.
    await leaveHome(page);
    await expect(page.getByTestId('founding-card')).toContainText('Founding capital $427,200');
    await foundCompany(page);
    await expect(panel).toHaveAttribute('data-cash', '42720000');
    await expect(page.getByTestId('checklist')).toHaveText('1/5 Place a depot');
    // One step out from the opening view, so the depot land and Longwood both fit on screen.
    await zoomOutOnce(page);

    // A depot: the tint shows, the card reads the rule, a click buys it for $150k.
    await page.getByRole('button', { name: 'Place a depot' }).click();
    await expect(map).toHaveAttribute('data-tint', 'on');
    const spot = onDepotLand();
    const [dx, dy] = await toScreen(page, spot);
    // Two moves in the same moment, from 40 px away onto the spot: the card must describe where the
    // pointer rests, not where it passed (CI's runner once moved fast enough to drop the last move).
    await page.evaluate(
      ([moves]) => {
        const canvas = document.querySelector('.maplibregl-canvas')!;
        for (const [x, y] of moves!) canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
      },
      [[[dx - 40, dy], [dx, dy]]] as const,
    );
    const depotCard = page.getByTestId('depot-card');
    await expect(depotCard).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    const [lon, lat] = (await depotCard.getAttribute('data-at'))!.split(',').map(Number) as [number, number];
    expect(Math.abs(lon - spot[0]) * 82_000 + Math.abs(lat - spot[1]) * 111_000).toBeLessThan(15); // metres, about 2 px
    await expect(depotCard).toContainText('Industrial ✓');
    await expect(depotCard).toContainText('$150k');
    await page.mouse.click(dx, dy);
    await expect(panel).toHaveAttribute('data-cash', '27720000');
    await expect(map).toHaveAttribute('data-tint', 'off');
    await expect(page.getByTestId('checklist')).toHaveText('2/5 Draw a line');

    // The line: four clicks, the card's price, Create.
    await page.getByRole('button', { name: 'Draw a line' }).click();
    const draft = page.getByTestId('draft-card');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(draft).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '');
    await expect(draft).toContainText('4 stops');
    await expect(draft).toContainText('every 20 min needs 2 Sparrows · $190k');
    // Metro 40s on the same draft: the card prices them, and the starter's cash and credit cannot buy them yet.
    await draft.getByLabel('Buses').selectOption('metro40');
    await expect(draft).toContainText('every 20 min needs 2 Metro 40s · $520k');
    await expect(draft).toHaveAttribute('data-refusal', 'insufficient_funds');
    await expect(draft).toContainText('$108,800 short'); // past the $150k credit line too (D10)
    await draft.getByLabel('Buses').selectOption('sparrow');
    await expect(draft).toHaveAttribute('data-refusal', '');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('line-card')).toBeVisible();
    await expect(panel).toHaveAttribute('data-cash', '7120000');
    await expect(page.getByTestId('checklist')).toHaveText('3/5 Press play');
    const running = Number(await page.getByTestId('line-card').getAttribute('data-running'));

    // Its buses: drawn while time runs (TS-07), and the layer asks for no frame while paused (I14).
    await setSpeed(page, '600×');
    await expect.poll(async () => Number(await map.getAttribute('data-buses')), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(async () => Number(await map.getAttribute('data-asked')), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId('checklist')).toHaveText('4/5 Close a day in profit');
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.waitForTimeout(500);
    const asked = await map.getAttribute('data-asked');
    await page.waitForTimeout(1_000);
    expect(await map.getAttribute('data-asked')).toBe(asked);

    // A day: every cost is a row, and the rows add up to the change in cash.
    await setSpeed(page, '5,400×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 90_000 });
    for (const name of ['Fares', 'Running (per km)', 'Driver wages', 'Deadhead', 'Depot upkeep']) await expect(card).toContainText(name);
    expect(await card.getAttribute('data-total')).toBe(await card.getAttribute('data-change'));
    const cents = async (kind: string) => Number(await card.locator(`tr[data-kind="${kind}"]`).getAttribute('data-cents'));
    // Day 1 opens at 05:00: every run of the line is on it, so its running cost is the forecast to the
    // cent; the depot's upkeep is 19 hours of 24. (A whole day's wages and deadhead meet the forecast in
    // the host and sim tests: day 1 starts after the first bus left the depot.)
    expect(await cents('running')).toBe(-running);
    expect(await cents('upkeep')).toBe(-19 * 1_250);
    // About $1,400 ahead on its running rows: the checklist moves on to contracts (M3).
    await expect(page.getByTestId('checklist')).toHaveText('5/5 Take a contract');

    // Reload and compare: paused, the game is saved where it stands, and a reload carries on from it.
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(panel).toHaveAttribute('data-speed', '0');
    const kept = { cash: await panel.getAttribute('data-cash'), elapsed: await panel.getAttribute('data-elapsed') };
    expect(Number(kept.elapsed)).toBeGreaterThan(19 * 3_600);
    await page.reload();
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    // Home names the game and Continue goes on with it (the M5 spec, item 3).
    await expect(page.getByTestId('home-continue')).toContainText('Back Bay Transit · Year 1, Q1, Day 2');
    await leaveHome(page, 'continue');
    await expect(panel).toHaveAttribute('data-elapsed', kept.elapsed!, { timeout: 30_000 });
    await expect(panel).toHaveAttribute('data-cash', kept.cash!);
    await expect(page.getByTestId('founding-card')).toHaveCount(0);
    await expect(page.getByTestId('checklist')).toHaveText('5/5 Take a contract');
    await expect(page.getByTestId('notice')).toHaveCount(0);
    await page.getByRole('button', { name: 'Lines' }).click();
    await expect(page.getByTestId('line-card')).toHaveAttribute('data-running', String(running));
    // The fare: the card names the fares that net the most (the M3 spec, item 4), and a pick sets it.
    const lineCard = page.getByTestId('line-card');
    await expect(page.getByTestId('fare-band')).toHaveAttribute('data-from', '175', { timeout: 10_000 });
    await expect(page.getByTestId('fare-band')).toContainText('Best net at $1.75');
    await lineCard.getByLabel('Fare').selectOption('175');
    await expect(lineCard.getByLabel('Fare')).toHaveValue('175');
    // A stop's card: with the inspector closed (it covers the map's right side), a click on
    // Symphony's stop shows its day and no flag (the M3 spec, item 5).
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('inspector')).toHaveCount(0);
    // Where Symphony's stop stands: its click snapped to the nearest street.
    const placed = (await map.getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number) as [number, number, number]);
    const [sx, sy] = await toScreen(page, [placed[1]![1], placed[1]![2]]);
    await page.mouse.click(sx, sy);
    const stopCard = page.getByTestId('stop-card');
    await expect(stopCard).toBeVisible();
    await expect(stopCard).toContainText('board and');
    await expect(stopCard).toHaveAttribute('data-quiet', 'no');
    await expect(stopCard).toHaveAttribute('data-loss', 'no');
    expect(Number(await stopCard.getAttribute('data-net'))).toBeGreaterThan(0);
    // A Shelter there: $12k off the cash, paused, and the stop's tier on its card.
    const cashBefore = Number(await panel.getAttribute('data-cash'));
    await stopCard.getByRole('button', { name: 'Make it a Shelter · $12k' }).click();
    await expect(stopCard).toHaveAttribute('data-tier', '2');
    await expect(panel).toHaveAttribute('data-cash', String(cashBefore - 1_200_000));
    await expect(stopCard).toContainText('Back to Sign · $6k back');
    await stopCard.getByRole('button', { name: 'Line 1', exact: true }).click();
    await expect(page.getByTestId('line-card')).toBeVisible();
    // The checklist's last step opens Contracts (the M3 spec, items 11 and 12; exit check 2): the line
    // every 20 minutes serves Longwood, whose offer shows that against its ask, a headway or boardings
    // a day as the deck dealt it (the M4 spec, item 1); taking it ends the checklist and the Contracts
    // chip takes its place. The map draws no contract rings (D25).
    await page.getByTestId('checklist').click();
    const longwood = page.getByTestId('contracts').locator('[data-landmark="Longwood"]');
    if ((await longwood.getAttribute('data-kind')) === 'headway') {
      await expect(longwood).toContainText('Today: every 20 min');
      await expect(longwood).toContainText(/Every (10|15|20) min at Longwood/);
    } else {
      await expect(longwood).toContainText(/Today: \d+ boardings a day/);
      await expect(longwood).toContainText(/(150|400|800) boardings a day at Longwood/);
    }
    await longwood.getByRole('button', { name: 'Take it' }).click();
    await expect(longwood).toHaveAttribute('data-held', 'yes');
    await expect(longwood).toContainText('0 of 8 days · 16 days left');
    await expect(page.getByTestId('checklist')).toHaveCount(0);
    await expect(page.getByTestId('contracts-chip')).toHaveText('Contracts 1 held');
    await page.getByRole('button', { name: 'Close' }).click();
    // It runs on from there (overnight, so no buses until about 05:00).
    await setSpeed(page, '600×');
    await expect.poll(async () => Number(await panel.getAttribute('data-elapsed')), { timeout: 10_000 }).toBeGreaterThan(Number(kept.elapsed));
    expect(errors).toEqual([]);
  });
});
