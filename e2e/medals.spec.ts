// Medals (the M4 spec, item 3; exit check 4): a quarter graded 55 or better gives the bronze medal,
// and the Contracts panel names the trips left to unlock the Goliath; silver puts it on sale on the
// line card. The medals held are dots on the Contracts chip, and the shell keeps to I13's budget at
// 1152×720, the tightest screen. A quarter is eight game days (D25), so the game is a save file edited to the
// evening of its last, its checklist done (a day in profit and a contract paid).
import { expect, test, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany } from './found';
import { chromeShare, city, onDepotLand, setFare, setSpeed } from './shell';

type Data = Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number>; ledger: unknown[] };

/** This game, exported, edited by `edit`, and imported back: on once the game is at `elapsed`, since an earlier import's notice may still show. */
async function edited(page: Page, edit: (d: Data) => void, elapsed: number): Promise<void> {
  await page.getByRole('button', { name: 'Saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export this game' }).click();
  const exported = (await (await (await download).createReadStream()).toArray()) as Buffer[];
  const save = JSON.parse(Buffer.concat(exported).toString()) as { data: Data };
  edit(save.data);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a save file' }).click();
  await page.getByRole('button', { name: 'Replace this game' }).click();
  await (await chooser).setFiles({ name: 'medals.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-elapsed', String(elapsed));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}

/** 23:50 on `day`, ten game minutes before its close. */
const eveningOf = (day: number) => (day - 1) * 86_400 + 18 * 3_600 + 50 * 60;

/** A depot and the debug line every 20 minutes, at 23:50 on `day`, with `trips` carried and `medals` held. */
const company = (day: number, trips: number, medals: Record<string, number | null>) => (d: Data) => {
  const [lon, lat] = onDepotLand();
  d.depots = [{ id: 1, lon, lat }];
  d.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
  d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow', earlier: [] }];
  d.nextIds = { ...d.nextIds, depot: 2, stop: 5, line: 2 };
  d.clock.elapsed = eveningOf(day);
  // A day in profit and a contract paid, the day before: in day order, after any row of that day,
  // since the game may have run on into the next before the edit (a close refuses rows out of order).
  const before = d.ledger.filter((r) => (r as { day: number }).day < day);
  const after = d.ledger.filter((r) => (r as { day: number }).day >= day);
  d.ledger = [...before, { day: day - 1, kind: 'fares', amountCents: 100_000, lineId: 1 }, { day: day - 1, kind: 'contract', amountCents: 6_000_000, lineId: null }, ...after];
  d.tripsCarried = trips;
  d.tripsToday = 0;
  d.medals = { bronze: null, silver: null, gold: null, ...medals };
};

test.describe('medals', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('a quarter graded 55 or better gives bronze, the panel counts down to silver, and silver puts the Goliath on sale', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const contracts = page.getByTestId('contracts-chip');
    const dots = page.getByTestId('medals');
    const ladder = page.getByTestId('medal-ladder');
    const silver = ladder.locator('li[data-medal="silver"]');

    // The quarter's last evening, 5,000 trips short of silver: no medal yet, and the Goliath locked.
    await edited(page, company(8, 20_000, {}), eveningOf(8)); // a quarter is eight days (D25)
    await expect(dots).toHaveCount(0);
    await contracts.click();
    await expect(ladder).toHaveAttribute('data-to-silver', '5000');
    await expect(silver).toContainText('5,000 trips to go · unlocks the Goliath');
    expect(await chromeShare(page)).toBeLessThanOrEqual(0.26);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Lines' }).click();
    // The line card's bus menu, the game's own dropdown (D25): the Goliath listed but locked.
    const models = page.getByTestId('inspector').getByRole('button', { name: 'Buses' });
    const goliath = page.getByRole('option', { name: /^Goliath/ });
    await models.click();
    await expect(goliath).toHaveAttribute('aria-disabled', 'true');
    await expect(goliath).toContainText('locked');
    await page.keyboard.press('Escape');
    await expect(goliath).toHaveCount(0);
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // Its close grades the quarter at 55 or better: bronze, on the day card, the chip and the panel.
    await setSpeed(page, '5,400×');
    const card = page.getByTestId('day-card');
    await expect(card.getByTestId('medal-news')).toHaveText('Bronze medal: a quarter graded 55 or better', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    expect(Number(await card.getByTestId('report-card').getAttribute('data-overall'))).toBeGreaterThanOrEqual(55);
    await card.getByRole('button', { name: 'Continue' }).click();
    await expect(dots).toHaveAttribute('data-held', 'bronze');
    await contracts.click();
    await expect(ladder.locator('li[data-medal="bronze"]')).toContainText('Since Year 1, Q1, Day 8');
    const left = Number(await ladder.getAttribute('data-to-silver'));
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(5_000); // the evening's trips counted
    await expect(silver).toContainText(`${left.toLocaleString('en-US')} trips to go · unlocks the Goliath`);
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // One trip short, the next evening: its close gives silver, and the Goliath is for sale.
    await edited(page, company(9, 24_999, { bronze: 8 }), eveningOf(9));
    await setSpeed(page, '5,400×');
    await expect(card.getByTestId('medal-news')).toHaveText('Silver medal: 25,000 trips carried · the Goliath is for sale', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await card.getByRole('button', { name: 'Continue' }).click();
    await expect(dots).toHaveAttribute('data-held', 'bronze silver');
    await contracts.click();
    await expect(silver).toContainText('Since Year 1, Q2, Day 1 · the Goliath is for sale');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Lines' }).click();
    await models.click();
    await expect(goliath).not.toHaveAttribute('aria-disabled', 'true');
    await expect(goliath).not.toContainText('locked');
    await page.keyboard.press('Escape');

    // At rest, paused with an undo to offer and the notices gone, as I13 measures it: still within 6%.
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await setFare(page, 'Line 1', '$2.50');
    await expect(page.getByTestId('undo')).toBeVisible();
    await expect(page.getByTestId('notice')).toHaveCount(0, { timeout: 10_000 });
    const rest = await chromeShare(page);
    test.info().annotations.push({ type: 'chrome %', description: JSON.stringify({ restLate: Math.round(rest * 10_000) / 100, viewport: page.viewportSize() }) });
    expect(rest).toBeLessThanOrEqual(0.06);
  });
});
