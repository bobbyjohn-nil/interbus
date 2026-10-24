// Roadworks a day ahead (the M4 spec, item 2; exit check 2): "Roadworks tomorrow" appears hatched on
// a street the line drives, with a notice on the day card; the next day the marker is solid and the
// line card's round trip is slower by what the works add; after the works' last day the marker clears.
// Waiting for a roll would take game weeks, so the game is a save file edited to an evening whose
// close rolls them: the events' stream at a state whose next draws roll roadworks for three days.
import { expect, test, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { EVENT_CHANCE_PER_DAY, EVENT_DAYS, EVENT_KINDS, type EventKind } from '../src/sim/config/events';
import { createRng } from '../src/sim/core/rng';
import { foundCompany } from './found';
import { city, onDepotLand, setSpeed, withDebugLine } from './shell';

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
  await page.getByRole('button', { name: 'Replace this game' }).click();
  await (await chooser).setFiles({ name: 'events.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await page.getByTestId('saves').getByRole('button', { name: 'Close', exact: true }).click();
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

    // Day 3's close rolls them for day 5: hatched on day 4, with the notice on the day card, which names day 5 (the systems
    // audit's seventeenth round: its "tomorrow" read as day 4).
    await setSpeed(page, '5,400×');
    const news = page.getByTestId('day-card').getByTestId('event-news');
    await expect(news).toHaveText(/^Roadworks on .+ from Q1 Day 5, for 3 days$/, { timeout: 30_000 });
    const street = (await news.textContent())!.replace(/^Roadworks on (.+) from Q1 Day 5, for 3 days$/, '$1');
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
  test('snow and a festival: named a day ahead, and snow slows the line card’s round trip while it falls', async ({ page }) => {
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

    // Snow rolled at day 3's close for day 5, one day: named on day 3's card, hatched over the city on day 4.
    await edited(page, (d) => company(d, 'snow', 3));
    await page.getByRole('button', { name: 'Lines' }).click();
    const roundTrip = page.getByTestId('round-trip');
    const calm = Number(await roundTrip.getAttribute('data-peak'));
    await setSpeed(page, '5,400×');
    await expect(news).toHaveText('Snow from Q1 Day 5, for 1 day: every bus drives slower', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-event', ':5:pending:1');
    // Day 5: it falls, and the line card's round trip says what it adds.
    await expect(map).toHaveAttribute('data-event', ':5:on:1', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(roundTrip).toContainText('snow adds');
    const snowy = Number(await roundTrip.getAttribute('data-peak'));
    expect(snowy).toBeGreaterThan(calm);
    expect(snowy - calm).toBe(Number(await roundTrip.getAttribute('data-snow-s')));
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // A festival rolled the same way gathers at one of the line's stops, a ring round it.
    await edited(page, (d) => company(d, 'festival', 3));
    await setSpeed(page, '5,400×');
    await expect(news).toHaveText(/^A festival near .+ from Q1 Day 5, for 1 day: more riders to and from there$/, { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-event', /^.+:5:pending:1$/);
  });

  // Snow lengthens a round trip and buys no bus: the line card showed the headways set while the line ran slower (the systems
  // audit's fourteenth round), and then said so in words of its own, "every 10.8 min", where Contracts said "every 10 min 45 s"
  // of the same 645 s (the review of its fixes). Shown failing (TS-04) with the card's own words.
  test('a line snow leaves a bus short says the headway it runs, in Contracts’ words for the same seconds', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // The debug line every 10 minutes with the 3 Sparrows that needs on a clear day, snow falling on day 2, and a contract held
    // for a bus every 10 minutes at Copley Square, where it calls.
    await withDebugLine(page, (d) => {
      const data = d as typeof d & { lines: { headways: unknown; buses: number }[]; contracts: Record<string, unknown>[] };
      data.lines[0]!.headways = { peak: 600, offpeak: 600, overnight: null };
      data.lines[0]!.buses = 3;
      data.event = { kind: 'snow', startDay: 2, endDay: 2, street: '', edges: [], at: null };
      Object.assign(data.contracts[0]!, { landmark: 'Copley Square', kind: 'headway', ask: 600, rewardCents: 15_000_000, acceptedDay: 2, daysMet: 0, hoursMissedToday: 0 });
    });
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await expect(page.getByTestId('line-short')).toHaveText('A bus short in the snow: runs every 10 min 45 s at peak and off-peak');
    await page.getByTestId('checklist').or(page.getByTestId('contracts-chip')).click();
    const held = page.getByTestId('contracts').locator('[data-landmark="Copley Square"][data-held="yes"]');
    await expect(held).toContainText('Today: every 10 min 45 s · not met now');
  });
});
