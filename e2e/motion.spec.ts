// Reduced motion (PLAN §8, the accessibility pass): when the system asks for it, nothing in the chrome eases, the compass's
// turn included, and it eases as before when the system does not. The map's camera and the tilt's cross-fade read the same
// setting (loadMap.ts; its tests). Shown failing (TS-04) on the style sheet before it, whose compass turned over 200 ms.
import { expect, test, type Page } from './base';
import { foundCompany } from './found';

/** Every element whose style eases or animates, by its test id, or its tag and class. */
function moving(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('*')].flatMap((el) => {
      const style = getComputedStyle(el);
      const eases = style.transitionDuration.split(',').some((d) => parseFloat(d) > 0) || style.animationName.split(',').some((n) => n.trim() !== 'none');
      return eases ? [el.getAttribute('data-testid') ?? `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`] : [];
    }),
  );
}

test('nothing in the chrome eases under reduced motion, and the compass turns at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  const needle = page.getByTestId('compass').locator('svg');
  await expect(needle).toBeVisible();
  expect(await moving(page)).toEqual([]);
  await expect(needle).toHaveCSS('transition-duration', '0s');
  // Without the request the compass eases as before.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(needle).toHaveCSS('transition-duration', '0.2s');
});
