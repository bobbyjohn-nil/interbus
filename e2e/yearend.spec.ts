// A year's last closes name next year's days with their year (the systems audit's eighteenth round): under "Year 1, Q4, Day 7
// closed", "Snow from Q1 Day 1" read as a day nine months back. format.test.ts holds the words; this holds the day card giving
// them the day it closes (the round's review). Shown failing (TS-04) with the card's day not given: the line read "from Q1 Day 1,".
import { expect, test } from './base';
import { foundCompany } from './found';
import { city, setSpeed, withBusyQuarterClose } from './shell';

test.describe('a year’s last closes', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('name next year’s days on the day card with their year', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // Day 31, Year 1's Q4 Day 7, at 23:50, ten minutes before its close (the clock starts at 05:00): snow comes named for the day
    // after the next, the next year's first.
    await withBusyQuarterClose(page, (d) => void (d.clock.elapsed = 30 * 86_400 + 18 * 3_600 + 50 * 60));
    await setSpeed(page, '600×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('h2').first()).toContainText('Year 1, Q4, Day 7');
    await expect(card.getByTestId('event-news').first()).toContainText('from Q1 Day 1 of Year 2');
  });
});
