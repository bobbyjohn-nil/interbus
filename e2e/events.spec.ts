// Roadworks a day ahead (the M4 spec, item 2; exit check 2): "Roadworks tomorrow" appears hatched on
// a street the line drives, with a notice on the day card; the next day the marker is solid and the
// line card's round trip is slower by what the works add; after the works' last day the marker clears.
// Waiting for a roll would take game weeks, so the game is a save file edited to an evening whose
// close rolls them: the events' stream at a state whose next draws roll roadworks for three days.
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { EVENT_CHANCE_PER_DAY, EVENT_DAYS, EVENT_KINDS, type EventKind } from '../src/sim/config/events';
import { createRng } from '../src/sim/core/rng';
import { foundCompany } from './found';
import { city, onDepotLand, setSpeed } from './shell';

type Data = Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number>; eventRng: { state: number }; event: Record<string, unknown> | null; ledger: { day: number }[] };

/** The first stream state whose next draws roll an event of `kind` for its fewest days (events/roll.ts: the chance, the kind, the days). */
function rollingState(kind: EventKind = 'roadworks'): number {
  for (let s = 1; ; s++) {
    const rng = createRng(s);
    if (rng.next() < EVENT_CHANCE_PER_DAY && rng.pick(EVENT_KINDS) === kind && rng.int(EVENT_DAYS[kind][0], EVENT_DAYS[kind][1]) === EVENT_DAYS[kind][0]) return s;
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
      d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow', earlier: [] }];
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
    await setSpeed(page, '5,400×');
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
    await setSpeed(page, '5,400×');
    await expect(page.getByTestId('day-card').getByTestId('event-news')).toHaveText(`Roadworks on ${street} are over`, { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-event', '');
  });
  test('snow and a festival: named the evening before, and snow slows the line card’s round trip while it falls', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const company = (d: Data, kind: EventKind, day: number) => {
      const [lon, lat] = onDepotLand();
      d.depots = [{ id: 1, lon, lat }];
      d.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
      d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow', earlier: [] }];
      d.nextIds = { ...d.nextIds, depot: 2, stop: 5, line: 2 };
      d.eventRng = { state: rollingState(kind) };
      d.event = null;
      d.clock.elapsed = eveningOf(day);
      // Back to an evening before the game had got to: no rows from days not yet played.
      d.ledger = d.ledger.filter((r) => r.day <= day);
    };
    const map = page.getByTestId('map');
    const news = page.getByTestId('day-card').getByTestId('event-news');

    // Snow rolled at day 3's close for day 5, one day: named the evening before, hatched over the city.
    await edited(page, (d) => company(d, 'snow', 3));
    await page.getByRole('button', { name: 'Lines' }).click();
    const roundTrip = page.getByTestId('round-trip');
    const calm = Number(await roundTrip.getAttribute('data-peak'));
    await setSpeed(page, '5,400×');
    await expect(news).toHaveText('Snow tomorrow, for 1 day: every bus drives slower', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-event', ':5:pending:1');
    // Day 5: it falls, and the line card's round trip says what it adds.
    await expect(map).toHaveAttribute('data-event', ':5:on:1', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(roundTrip).toContainText('snow adds');
    const snowy = Number(await roundTrip.getAttribute('data-peak'));
    expect(snowy).toBeGreaterThan(calm);
    expect(snowy - calm).toBe(Number(await roundTrip.getAttribute('data-snow-s')));
    await page.getByRole('button', { name: 'Close' }).click();

    // A festival rolled the same way gathers at one of the line's stops, a ring round it.
    await edited(page, (d) => company(d, 'festival', 3));
    await setSpeed(page, '5,400×');
    await expect(news).toHaveText(/^A festival near .+ tomorrow, for 1 day: more riders to and from there$/, { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-event', /^.+:5:pending:1$/);
  });
});
