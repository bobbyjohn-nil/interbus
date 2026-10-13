// Roadworks a day ahead (the M4 spec, item 2; exit check 2): "Roadworks tomorrow" appears hatched on
// a street the line drives, with a notice on the day card; the next day the marker is solid and the
// line card's round trip is slower by what the works add; after the works' last day the marker clears.
// Waiting for a roll would take game weeks, so the game is a save file edited to an evening whose
// close rolls them: the events' stream at a state whose next draws roll roadworks for three days.
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { EVENT_CHANCE_PER_DAY, ROADWORKS_DAYS } from '../src/sim/config/events';
import { createRng } from '../src/sim/core/rng';
import { foundCompany } from './found';
import { city, onDepotLand } from './shell';

type Data = Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number>; eventRng: { state: number }; event: Record<string, unknown> | null };

/** The first stream state whose next two draws roll an event and give it the shortest roadworks. */
function rollingState(): number {
  for (let s = 1; ; s++) {
    const rng = createRng(s);
    if (rng.next() < EVENT_CHANCE_PER_DAY && rng.int(ROADWORKS_DAYS[0], ROADWORKS_DAYS[1]) === ROADWORKS_DAYS[0]) return s;
  }
}

/** This game, exported, edited by `edit`, and imported back. */
async function edited(page: Page, edit: (d: Data) => void): Promise<void> {
  await page.getByRole('button', { name: 'Saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export this game' }).click();
  const exported = (await (await (await download).createReadStream()).toArray()) as Buffer[];
  const save = JSON.parse(Buffer.concat(exported).toString()) as { data: Data };
  edit(save.data);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a save file' }).click();
  await (await chooser).setFiles({ name: 'events.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await page.getByRole('button', { name: 'Close' }).click();
}

/** 23:50 on `day`, ten game minutes before its close. */
const eveningOf = (day: number) => (day - 1) * 86_400 + 18 * 3_600 + 50 * 60;

test.describe('roadworks a day ahead', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('are hatched the day they are rolled, solid and slower the next, and gone after their last', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // Day 3 at 23:50: a depot and the debug line every 20 minutes, and the events' stream about to roll.
    await edited(page, (d) => {
      const [lon, lat] = onDepotLand();
      d.depots = [{ id: 1, lon, lat }];
      d.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
      d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow' }];
      d.nextIds = { ...d.nextIds, depot: 2, stop: 5, line: 2 };
      d.eventRng = { state: rollingState() };
      d.event = null;
      d.clock.elapsed = eveningOf(3);
    });
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-event', '');
    await page.getByRole('button', { name: 'Lines' }).click();
    const roundTrip = page.getByTestId('round-trip');
    await expect(roundTrip).toHaveAttribute('data-works-s', '0');
    const calm = Number(await roundTrip.getAttribute('data-peak'));

    // Day 3's close rolls them for day 5: hatched on day 4, with the notice on the day card.
    await page.getByRole('button', { name: '3×' }).click();
    const news = page.getByTestId('day-card').getByTestId('event-news');
    await expect(news).toHaveText(/^Roadworks on .+ tomorrow, for 3 days$/, { timeout: 30_000 });
    const street = (await news.textContent())!.replace(/^Roadworks on (.+) tomorrow, for 3 days$/, '$1');
    await expect(map).toHaveAttribute('data-event', `${street}:5:pending:3`);

    // Day 5: solid, and the line card's round trip is slower by what the works add.
    await expect(map).toHaveAttribute('data-event', `${street}:5:on:3`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    // The line card opened on day 3 is still open, its round trip timed again at the works' start.
    await expect(roundTrip).toContainText(`roadworks on ${street} add`);
    const slowed = Number(await roundTrip.getAttribute('data-peak'));
    expect(slowed).toBeGreaterThan(calm);
    expect(slowed - calm).toBe(Number(await roundTrip.getAttribute('data-works-s')));

    // Their last day, day 7, at 23:50: its close ends them, and the marker clears.
    await edited(page, (d) => void (d.clock.elapsed = eveningOf(7)));
    await expect(map).toHaveAttribute('data-event', `${street}:5:on:1`);
    await page.getByRole('button', { name: '3×' }).click();
    await expect(page.getByTestId('day-card').getByTestId('event-news')).toHaveText(`Roadworks on ${street} are over`, { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-event', '');
  });
});
