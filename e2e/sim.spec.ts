import { expect, test } from '@playwright/test';
import { fixtureCity, gapTo, inMiddle, screenDots } from './dots';
import { foundCompany } from './found';
import { city, projector } from './shell';
import { toXY } from '../src/sim/core/geo';
import { jobsWithinWalk, peopleWithinWalk } from '../src/sim/rules/catchment';

// The fixture build's sim file (npm run build:fixture), which this page plays.
const sim = city.sim;

// PLAN §14 week 2's exit check, on the real page: dots sit where people live and work, and "people
// within a walk" is the sim's own number. M1's day card, and M2's costs on it, are in line.spec.ts.
// The owner's initial playtest (D25): the count shows only while the pointer is on a dot. Shown failing
// (TS-04) on the old card, which followed the pointer everywhere and named no dot.
test.describe('the city on the fixture', () => {
  test.skip(!sim, 'no sim file in this build yet');

  test('draws the dots, and on a dot, and only there, tells you how many live or work within a walk', async ({ page }) => {
    await page.goto('./');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => Number(await map.getAttribute('data-dots')), { timeout: 30_000 }).toBeGreaterThan(100);
    await foundCompany(page);
    await expect(page.getByTestId('sim-panel')).toBeVisible();

    const c = fixtureCity();
    const { project, box, zoom } = await projector(page);
    const dots = screenDots(c, project, zoom);
    const middle = dots.filter(inMiddle(box));
    const card = page.getByTestId('probe-card');
    const hover = async (x: number, y: number) => {
      await page.mouse.move(x - 30, y - 30);
      await page.mouse.move(x, y, { steps: 3 });
    };

    // The heaviest home dot in the middle of the map, clear of every other dot.
    const home = middle.filter((d) => d.kind === 'home' && gapTo(dots.filter((o) => o !== d), d) > 14).sort((a, b) => b.w - a.w)[0]!;
    await hover(home.x, home.y);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toHaveAttribute('data-kind', 'home');
    await expect(card).toHaveAttribute('data-at', home.at.join(','));
    await expect(card).toHaveAttribute('data-here', String(home.w));
    // The page's number is the rule's number for that very dot, on this build's sim file.
    await expect(card).toHaveAttribute('data-within', String(peopleWithinWalk(c, toXY(c.frame, home.at))));
    await expect(card).toContainText('people live here');
    await expect(card).toContainText('people within a walk');

    // A job dot: its jobs and the jobs within a walk.
    const job = middle.filter((d) => d.kind === 'job' && gapTo(dots.filter((o) => o !== d), d) > 14).sort((a, b) => b.w - a.w)[0]!;
    await hover(job.x, job.y);
    await expect(card).toHaveAttribute('data-kind', 'job', { timeout: 10_000 });
    await expect(card).toHaveAttribute('data-here', String(job.w));
    await expect(card).toHaveAttribute('data-within', String(jobsWithinWalk(c, toXY(c.frame, job.at))));
    await expect(card).toContainText('jobs here');

    // Off every dot, no card.
    let empty: { x: number; y: number } | null = null;
    for (let x = box.x + box.width * 0.3; x < box.x + box.width * 0.7 && !empty; x += 7) {
      for (let y = box.y + box.height * 0.3; y < box.y + box.height * 0.65 && !empty; y += 7) if (gapTo(dots, { x, y }) > 15) empty = { x, y };
    }
    expect(empty, 'a spot 15 px from every dot').not.toBeNull();
    await hover(empty!.x, empty!.y);
    await expect(card).toHaveCount(0, { timeout: 10_000 });

    // Homes hidden from the demand menu: the home dot gives no card.
    await page.getByTestId('demand-chip').click();
    await page.getByRole('menuitemcheckbox', { name: /Homes/ }).click();
    await page.keyboard.press('Escape');
    await hover(home.x, home.y);
    await page.waitForTimeout(400);
    await expect(card).toHaveCount(0);
  });
});
