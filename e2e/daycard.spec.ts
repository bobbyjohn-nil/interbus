// The day card at PLAN's smallest window, 1152×720 (the systems audit, D26): a busy quarter's last
// close (its report card, a contract paid, a medal, snow named for tomorrow, interest and every kind of
// buying and selling) is taller than the window. The card stays inside it above the dock, as the panels
// do, what does not fit scrolls inside it, and Continue stays in view. Shown failing (TS-04) before the
// fix: the card ran from 60 px to 800, Continue lay below the window's edge where no press reached it,
// nothing scrolled, and the card lay over the dock's buttons until the next close replaced it.
import { expect, test, type Locator } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { EVENT_CHANCE_PER_DAY, EVENT_DAYS, EVENT_KINDS } from '../src/sim/config/events';
import { createRng } from '../src/sim/core/rng';
import { foundCompany } from './found';
import { city, onDepotLand, setSpeed } from './shell';

/** The events' first stream state whose next roll is one day of snow. */
function snowNext(): number {
  for (let s = 1; ; s++) {
    const rng = createRng(s);
    if (rng.next() < EVENT_CHANCE_PER_DAY && rng.pick(EVENT_KINDS) === 'snow' && rng.int(EVENT_DAYS.snow[0], EVENT_DAYS.snow[1]) === EVENT_DAYS.snow[0]) return s;
  }
}

/** Whether a press at the middle of `l` lands on it, not on something drawn over it. */
const onTop = (l: Locator) =>
  l.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });

test.describe('the day card', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('fits a 1152×720 window on a busy quarter’s last close: its rows scroll inside it, Continue stays in reach, the dock stays clear', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1152, height: 720 }); // I13's tightest size
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);

    // This game as a file, edited to 23:50 on day 8, the quarter's last: a depot, the debug line every
    // 15 minutes, a RIDERSHIP contract at Copley Square seven days met, the events' stream about to name
    // snow, and a day of buying and selling that leaves cash below zero, so the lender charges interest.
    await page.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export this game' }).click();
    const exported = (await (await (await download).createReadStream()).toArray()) as Buffer[];
    type Data = Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number>; eventRng: { state: number }; contracts: Record<string, unknown>[]; ledger: { day: number; kind: string; amountCents: number; lineId: number | null }[] };
    const save = JSON.parse(Buffer.concat(exported).toString()) as { data: Data };
    const d = save.data;
    const [lon, lat] = onDepotLand();
    d.depots = [{ id: 1, lon, lat }];
    d.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
    d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 900, offpeak: 900, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow', earlier: [] }];
    d.nextIds = { ...d.nextIds, depot: 2, stop: 5, line: 2 };
    Object.assign(d.contracts.find((c) => c.landmark === 'Copley Square')!, { kind: 'ridership', ask: 150, rewardCents: 6_000_000, acceptedDay: 1, daysMet: 7, hoursMissedToday: 0 });
    d.eventRng = { state: snowNext() };
    d.ledger.push({ day: 1, kind: 'fares', amountCents: 100_000, lineId: 1 }); // day 1 in profit, for the checklist
    d.ledger.sort((a, b) => a.day - b.day);
    for (const [kind, amountCents] of [['buses', -26_000_000], ['busSales', 4_750_000], ['stops', -1_600_000], ['stopUpgrades', -1_200_000], ['stopSales', 200_000], ['depots', -36_000_000]] as const) d.ledger.push({ day: 8, kind, amountCents, lineId: null });
    d.clock.elapsed = 7 * 86_400 + 18 * 3_600 + 50 * 60; // day 8, 23:50
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import a save file' }).click();
    await page.getByRole('button', { name: 'Replace this game' }).click();
    await (await chooser).setFiles({ name: 'busy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await expect(page.getByTestId('notice')).toContainText('Save file loaded');
    await page.getByTestId('saves').getByRole('button', { name: 'Close' }).click();

    await setSpeed(page, '600×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(card.getByTestId('report-card')).toBeVisible();
    await expect(card.getByTestId('contract-outcome')).toHaveAttribute('data-outcome', 'paid');
    await expect(card.getByTestId('event-news')).toHaveAttribute('data-news', 'tomorrow');
    await expect(card.locator('tr[data-kind="interest"]')).toHaveCount(1);
    await expect(card.getByTestId('medal-news')).toHaveCount(1);

    // The card inside the window and clear of the dock, Continue in it and taking a press.
    const dock = (await page.getByTestId('dock').boundingBox())!;
    const box = (await card.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
    const go = card.getByRole('button', { name: 'Continue' });
    const at = (await go.boundingBox())!;
    expect(at.y).toBeGreaterThanOrEqual(box.y);
    expect(at.y + at.height).toBeLessThanOrEqual(box.y + box.height);
    expect(await onTop(go)).toBe(true);
    for (const name of ['Lines', 'Finance']) expect(await onTop(page.getByTestId('dock').getByRole('button', { name, exact: true }))).toBe(true);

    // What does not fit scrolls inside the card: the wheel over it brings the cash, its last row, into
    // view, with Continue where it was.
    const cash = card.locator('tr').last();
    await expect(cash).toContainText('Cash');
    expect(await onTop(cash)).toBe(false);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 2_000);
    await expect.poll(() => onTop(cash)).toBe(true);
    expect(await go.boundingBox()).toEqual(at);

    // A press on Continue, where the player sees it, closes the card.
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await expect(card).toHaveCount(0);
  });
});
