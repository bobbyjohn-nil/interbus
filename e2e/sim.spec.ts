import { expect, test, type Locator } from '@playwright/test';
import { fixtureCity, gapTo, inMiddle, screenDots } from './dots';
import { foundCompany } from './found';
import { build, city, projector } from './shell';
import { toXY } from '../src/sim/core/geo';
import { jobsWithinWalk, peopleWithinWalk } from '../src/sim/rules/catchment';

// The fixture build's sim file (npm run build:fixture), which this page plays.
const sim = city.sim;

// PLAN §14 week 2's exit check, on the real page: dots sit where people live and work, and "people
// within a walk" is the sim's own number. M1's day card, and M2's costs on it, are in line.spec.ts.
// The owner's initial playtest (D25): the count shows only while the pointer is on a dot. Shown failing
// (TS-04) on the old card, which followed the pointer everywhere and named no dot. The systems audit's
// (D26) cards were shown failing before their fix: a dot's card stayed on after the keyboard panned its
// dot 100 px from a still pointer, and Place a depot's kept the place it was first asked about; beside
// a dot near the right edge, the dot's card and those of Place a stop and Place a depot ran out of the window.
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

  test('keeps the cards beside the pointer to what is under it, and whole at the window’s edge', async ({ page }) => {
    test.setTimeout(90_000);
    const [W, H] = [1152, 720]; // I13's tightest size
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect.poll(async () => Number(await map.getAttribute('data-dots')), { timeout: 30_000 }).toBeGreaterThan(100);
    await foundCompany(page);
    const c = fixtureCity();
    const card = page.getByTestId('probe-card');
    const canvas = page.locator('.maplibregl-canvas');
    const hover = async (x: number, y: number) => {
      await page.mouse.move(x - 30, y - 30);
      await page.mouse.move(x, y, { steps: 3 });
    };
    const panned = async () => {
      const view = await map.getAttribute('data-view');
      await canvas.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(async () => map.getAttribute('data-view'), { timeout: 10_000 }).not.toBe(view);
    };
    const { project, box, zoom } = await projector(page);
    const dots = screenDots(c, project, zoom);

    // The heaviest clear home dot in the middle with no dot 100 px to its right, where the pan below brings the pointer.
    const home = dots
      .filter(inMiddle(box))
      .filter((d) => d.kind === 'home' && gapTo(dots.filter((o) => o !== d), d) > 14 && gapTo(dots, { x: d.x + 100, y: d.y }) > 20)
      .sort((a, b) => b.w - a.w)[0]!;
    await hover(home.x, home.y);
    await expect(card).toHaveAttribute('data-at', home.at.join(','), { timeout: 10_000 });
    // The pointer stays still while the keyboard pans the map: the dot moves away, and so does its card.
    await panned();
    const after = await projector(page);
    const now = screenDots(c, after.project, after.zoom);
    const moved = now.find((d) => d.kind === 'home' && d.at.join(',') === home.at.join(','))!;
    expect(Math.hypot(moved.x - home.x, moved.y - home.y)).toBeGreaterThan(50);
    expect(gapTo(now, home)).toBeGreaterThan(8);
    await expect(card).toHaveCount(0, { timeout: 10_000 });
    // Place a depot's card, beside the same still pointer, follows the place under it as the map pans.
    await build(page, 'Place a depot');
    await hover(home.x, home.y);
    const depot = page.getByTestId('depot-card');
    await expect(depot).toBeVisible({ timeout: 10_000 });
    const asked = await depot.getAttribute('data-at');
    await panned();
    await expect.poll(async () => depot.getAttribute('data-at'), { timeout: 10_000 }).not.toBe(asked);
    await page.keyboard.press('Escape');
    await expect(depot).toHaveCount(0);

    // A clear dot dragged, with no fling, to 75 px from the window's right edge.
    const mid = await projector(page);
    const all = screenDots(c, mid.project, mid.zoom);
    const pick = all
      .filter((d) => d.y > box.y + box.height * 0.3 && d.y < box.y + box.height * 0.65 && d.x > 0 && d.x < W && gapTo(all.filter((o) => o !== d), d) > 14)
      .sort((a, b) => b.w - a.w)[0]!;
    const view = await map.getAttribute('data-view');
    await page.mouse.move(W / 2, H / 2);
    await page.mouse.down();
    await page.mouse.move(W / 2 + (W - 75 - pick.x), H / 2, { steps: 15 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await expect.poll(async () => map.getAttribute('data-view'), { timeout: 10_000 }).not.toBe(view);
    const last = await projector(page);
    const edge = screenDots(c, last.project, last.zoom).find((d) => d.kind === pick.kind && d.at.join(',') === pick.at.join(','))!;
    expect(edge.x, 'a dot within 120 px of the right edge').toBeGreaterThan(W - 120);
    expect(edge.x).toBeLessThan(W - 30);
    // The dot's card, and those of Place a stop and Place a depot, show whole beside it.
    const whole = async (shown: Locator) => {
      await expect(shown).toBeVisible({ timeout: 10_000 });
      const r = (await shown.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(W);
      expect(r.y + r.height).toBeLessThanOrEqual(H);
    };
    await hover(edge.x, edge.y);
    await expect(card).toHaveAttribute('data-at', edge.at.join(','), { timeout: 10_000 });
    await whole(card);
    for (const [tool, id] of [['Place a stop', 'stop-site-card'], ['Place a depot', 'depot-card']] as const) {
      await build(page, tool);
      await hover(edge.x, edge.y);
      await whole(page.getByTestId(id));
    }
  });
});
