import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { foundCompany } from './found';
import { loadCity } from '../src/sim/city/simfile';
import { toXY } from '../src/sim/core/geo';
import { peopleWithinWalk } from '../src/sim/rules/catchment';

const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { sim: { file: string } | null }[] };
const sim = registry.cities[0]?.sim;

// PLAN §14 week 2's exit check, on the real page: dots sit where people live and work, and "people
// within a walk" is the sim's own number. M1's day card, and M2's costs on it, are in line.spec.ts.
test.describe('the city on the fixture', () => {
  test.skip(!sim, 'no sim file in this build yet');

  test('draws the dots and tells you how many people live within a walk', async ({ page }) => {
    await page.goto('./');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(page.getByTestId('sim-panel')).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => Number(await map.getAttribute('data-dots')), { timeout: 30_000 }).toBeGreaterThan(100);
    await foundCompany(page);

    const box = (await map.boundingBox())!;
    await page.mouse.move(box.width / 2, box.height / 2);
    await page.mouse.move(box.width / 2 + 7, box.height / 2 + 5);
    const card = page.getByTestId('probe-card');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('people within a walk');

    // The page's number is the rule's number for that very point, on this build's sim file.
    const loaded = loadCity(readFileSync(`public/cities/${sim!.file}`, 'utf8'));
    if (!loaded.ok) throw new Error(loaded.problem);
    const [lon, lat] = (await card.getAttribute('data-at'))!.split(',').map(Number) as [number, number];
    const expected = peopleWithinWalk(loaded.city, toXY(loaded.city.frame, [lon, lat]));
    expect(Number(await card.getAttribute('data-people'))).toBe(expected);
    expect(expected).toBeGreaterThan(1_000);
  });
});
