// The day and night tint (PLAN §4's charm moments, §8 rule 8; D13; src/render/map/daylight.ts): the map dims from 19:00 a
// step each half hour to night at 20:30, and lightens from 05:00, its paints set once a step and never per frame (RN-04), each
// step carried by MapLibre's transition, at once with less motion asked for. A line with overnight off rests, faded, from 00:00
// to 05:00, so the time of day never rests on the tint alone.
import { expect, test, type Page } from './base';
import { foundCompany, leaveHome } from './found';
import { city, withDebugLine, type SaveData } from './shell';

/** The debug line's game past Home, paused at `second` of day 2's clock (a second past 24:00 is the night after it). */
async function at(page: Page, second: number, edit?: (d: SaveData) => void) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, (d) => {
    d.clock.elapsed = 86_400 + second - 5 * 3_600;
    edit?.(d);
  });
}

const hour = (h: number, m = 0) => h * 3_600 + m * 60;

test.describe('the day and night tint', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('dims from 19:00 a step each half hour to night at 20:30, its paints set once a step while the map draws on', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => void (m.type() === 'error' && errors.push(m.text())));
    await at(page, hour(18, 55));
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-daylight', '0');
    const sets = Number((await map.getAttribute('data-daylight-sets')) ?? 0);
    const asked = Number((await map.getAttribute('data-asked')) ?? 0);
    await page.keyboard.press('3'); // 600×: 19:00 in half a second, night at 20:30 in about ten
    for (const step of ['1', '2', '3', '4']) await expect(map).toHaveAttribute('data-daylight', step, { timeout: 30_000 });
    // Four steps, four sets of the paints, while the map drew on: 39 frames here in software GL's Low graphics.
    expect(Number(await map.getAttribute('data-daylight-sets')) - sets).toBe(4);
    expect(Number(await map.getAttribute('data-asked')) - asked).toBeGreaterThan(8);
    await expect(map).toHaveAttribute('data-daylight-fade', '1500');
    // MapLibre takes every paint: a value it refused would be logged.
    expect(errors).toEqual([]);
  });

  test('with less motion asked for, each step comes at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await at(page, hour(18, 58));
    const map = page.getByTestId('map');
    await page.keyboard.press('3');
    await expect(map).toHaveAttribute('data-daylight', '1', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-daylight-fade', '0');
  });

  test('the clock names the period, so the time of day never rests on the tint: Off-peak, then Peak from 06:30 (D13)', async ({ page }) => {
    await at(page, hour(6, 28));
    const period = page.getByTestId('period');
    await expect(period).toHaveText('Off-peak');
    await page.keyboard.press('2'); // 60×: 06:30 in about two seconds
    await expect(period).toHaveText('Peak', { timeout: 30_000 });
    await expect(page.getByTestId('map')).toHaveAttribute('data-daylight', '0');
  });

  test('a line with overnight off rests, faded, from 00:00 to 05:00, and runs whole from 05:00 (D13)', async ({ page }) => {
    await at(page, hour(23, 58), (d) => {
      (d.lines as { headways: { overnight: number | null } }[])[0]!.headways.overnight = null;
    });
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-daylight', '4');
    await expect(page.getByTestId('period')).toHaveText('Off-peak');
    expect(await map.getAttribute('data-resting')).toBeNull();
    await page.keyboard.press('3');
    // Midnight closes day 2, and its card waits with time paused.
    const day = page.getByTestId('day-card');
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(map).toHaveAttribute('data-resting', '1');
    await expect(page.getByTestId('period')).toHaveText('Overnight');
    await day.getByRole('button', { name: 'Continue' }).click();
    await page.keyboard.press('5'); // 5,400×: 05:00 in about three seconds
    await expect(map).toHaveAttribute('data-resting', '', { timeout: 30_000 });
    // Lighter than night: at 5,400× the half hour of each step passes in a third of a second.
    await expect(map).toHaveAttribute('data-daylight', /^[0-3]$/);
  });
});
