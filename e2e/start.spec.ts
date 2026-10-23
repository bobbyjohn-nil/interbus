// Starting and leaving a game (D26: systems that work; the audit's start-screen findings, each
// reproduced twice before it counted). Home stands over a paused game, so the game's keys stay with the
// game; a new game, or a slot loaded, starts clean, with nothing of the old game's tool, draft, route
// editor or day card; a notice shows once, not again each time the screen switches between Home and
// the game; and Home's buttons are drawn in the game's own type. Shown failing (TS-04) on main before
// the fix: Space ran time behind Home, Ctrl+Z took back the depot, the old route and day card came
// into the new game, a draft outlived a slot's load, and "Slot loaded" came back on Home.
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { usd } from '../src/ui/format';
import { gapTo, fixtureCity, inMiddle, screenDots } from './dots';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, onDepotLand, projector, setSpeed, toScreen, zoomOutOnce } from './shell';

/** Founds a company and places its depot. */
async function founded(page: Page) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  await zoomOutOnce(page);
  await build(page, 'Place a depot');
  const [dx, dy] = await toScreen(page, onDepotLand());
  await page.mouse.click(dx, dy);
  await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
}

async function backToHome(page: Page) {
  await page.getByTestId('saves-chip').click();
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await expect(page.getByTestId('home')).toBeVisible();
}

test.describe('starting and leaving a game', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('keeps the game’s keys from the game behind Home: Space, 1–5 and Ctrl+Z do nothing there', async ({ page }) => {
    test.setTimeout(90_000);
    await founded(page);
    await backToHome(page);
    const left = `Back Bay Transit · Year 1, Q1, Day 1 · ${usd(STARTING_CENTS - 15_000_000)}`;
    await expect(page.getByTestId('home-continue')).toContainText(left);
    for (const key of [' ', '5', 'Control+z']) await page.keyboard.press(key);
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId('home-continue')).toContainText(left); // the depot still bought
    await leaveHome(page, 'continue');
    const panel = page.getByTestId('sim-panel');
    await expect(panel).toHaveAttribute('data-speed', '0');
    await expect(panel).toHaveAttribute('data-elapsed', '0');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
  });

  test('starts a new game clean: no tool, route editor or day card of the old game, and a dot’s card on a dot', async ({ page }) => {
    test.setTimeout(150_000);
    await founded(page);
    await build(page, 'Draw a line');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await page.getByTestId('draft-card').getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('line-card')).toBeVisible();
    // A day's close, its card left open, then the route editor out.
    await setSpeed(page, '5,400×');
    await expect(page.getByTestId('day-card')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Edit route' }).click();
    await expect(page.getByTestId('route-editor')).toBeVisible();

    await backToHome(page);
    const home = page.getByTestId('home');
    await home.getByRole('button', { name: 'New game' }).click();
    await home.getByRole('button', { name: 'Start a new game' }).click();
    await expect(page.getByTestId('founding-card')).toBeVisible();
    await expect(page.getByTestId('day-card')).toHaveCount(0);
    await expect(page.getByTestId('route-editor')).toHaveCount(0);
    await expect(page.getByTestId('draft-card')).toHaveCount(0);
    await foundCompany(page, 'Second Co');
    await expect(page.getByTestId('build')).toHaveAttribute('aria-pressed', 'false');

    // With no tool out, a home dot shows its card (D25), as the old route editor stopped it doing.
    const { project, box, zoom } = await projector(page);
    const dots = screenDots(fixtureCity(), project, zoom);
    const dot = dots
      .filter(inMiddle(box))
      .filter((d) => d.kind === 'home' && gapTo(dots.filter((o) => o !== d), d) > 14)
      .sort((a, b) => b.w - a.w)[0]!;
    await page.mouse.move(dot.x - 30, dot.y - 30);
    await page.mouse.move(dot.x, dot.y, { steps: 3 });
    await expect(page.getByTestId('probe-card')).toBeVisible({ timeout: 10_000 });
  });

  test('puts the tool down when a slot loads, and shows its notice once, not again each time the screen switches between Home and the game', async ({ page }) => {
    test.setTimeout(90_000);
    await founded(page);
    await page.getByTestId('saves-chip').click();
    const slot = page.getByTestId('slot-1');
    await slot.getByRole('button', { name: 'Save here' }).click();
    // A draft out as the slot loads goes with the game it was drawn in.
    await build(page, 'Draw a line');
    const [x, y] = await toScreen(page, DEBUG_STOPS[0]!.at);
    await page.mouse.click(x, y);
    await expect(page.getByTestId('draft-card')).toBeVisible();
    await slot.getByRole('button', { name: 'Load' }).click();
    await slot.getByRole('button', { name: 'Replace this game' }).click();
    const notice = page.getByTestId('notice');
    await expect(notice).toContainText('Slot loaded');
    await expect(page.getByTestId('draft-card')).toHaveCount(0);
    await expect(page.getByTestId('build')).toHaveAttribute('aria-pressed', 'false');
    await expect(notice).toHaveCount(0, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await expect(page.getByTestId('home')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(notice).toHaveCount(0);
    await leaveHome(page, 'continue');
    await page.waitForTimeout(500);
    await expect(notice).toHaveCount(0);
  });

  // A game loaded with no company yet opens its founding card clean, empty and on the first colour, as a new game's does: nothing
  // of the company it replaced. Shown failing (TS-04) on abb5f2f, where the card kept the replaced company's name and Blue, and
  // one press founded the loaded game under them.
  test('opens a loaded game’s founding card clean, with nothing of the company it replaced', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    const home = page.getByTestId('home');
    await expect(home).toBeVisible({ timeout: 30_000 });
    await home.getByRole('button', { name: 'Saves' }).click();
    await leaveHome(page);
    const card = page.getByTestId('founding-card');
    const slot = page.getByTestId('saves').getByTestId('slot-1');
    await expect(card).toBeVisible();
    await slot.getByRole('button', { name: 'Save here' }).click();
    await expect(slot).toContainText('no company yet');
    await card.getByLabel('Name').fill('Back Bay Transit');
    await card.getByRole('radio', { name: 'Blue' }).check();
    await card.getByRole('button', { name: 'Found the company' }).click();
    await expect(card).toBeHidden();
    await slot.getByRole('button', { name: 'Load' }).click();
    await slot.getByRole('button', { name: 'Replace this game' }).click();
    await expect(page.getByTestId('notice')).toContainText('Slot loaded');
    await expect(card).toBeVisible();
    await expect(card.getByLabel('Name')).toHaveValue('');
    await expect(card.getByRole('radio', { name: 'Red' })).toBeChecked();
    await expect(card.getByRole('button', { name: 'Found the company' })).toBeDisabled();
  });

  test('draws Home’s buttons in the game’s own type', async ({ page }) => {
    await page.goto('./');
    const home = page.getByTestId('home');
    await expect(home).toBeVisible({ timeout: 30_000 });
    for (const name of ['New game', 'Saves']) {
      const font = await home.getByRole('button', { name }).evaluate((b) => getComputedStyle(b).fontFamily);
      expect(font).toContain('Afacad Flux');
    }
  });

  // Round 10, by the keyboard alone. In the company's name, which has the focus whenever the founding card shows, Escape closed
  // nothing, not even Saves left open beside the card; nothing showed where the keyboard was among the colours (WCAG 2.4.7); and
  // Back to Home, from the founding card or Saves, took its button with the game's screen and left the focus on the page, where
  // the next Tab went to the map's credits and Home's Continue was the sixth.
  // Round 11: Saves the keyboard opened from Home stays open over the founding card, where no Saves chip stands yet: its Escape and
  // its Close, and Escape in the Help its Help opens in its place, gave the page the focus. The card's name takes it back.
  test('over the founding card, a panel the keyboard opened gives the card’s name the focus back as it closes', async ({ page }) => {
    test.setTimeout(90_000);
    const tabOnto = async (button: Locator) => {
      await button.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(button).toBeFocused();
    };
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    const home = page.getByTestId('home');
    const card = page.getByTestId('founding-card');
    const saves = page.getByTestId('saves');
    const name = card.getByLabel('Name');
    for (const how of ['Escape in Saves', 'its Close', 'Escape in the Help its Help opens'] as const) {
      await tabOnto(home.getByTestId('home-saves'));
      await page.keyboard.press('Enter');
      await expect(saves).toBeVisible();
      await tabOnto(home.getByRole('button', { name: 'New game' }));
      await page.keyboard.press('Enter');
      await expect(card).toBeVisible();
      await expect(name).toBeFocused();
      const close = saves.getByRole('button', { name: 'Close', exact: true });
      if (how === 'Escape in Saves') {
        await tabOnto(close);
        await page.keyboard.press('Escape');
      } else if (how === 'its Close') {
        await tabOnto(close);
        await page.keyboard.press('Enter');
      } else {
        await tabOnto(saves.getByRole('button', { name: 'Help', exact: true }));
        await page.keyboard.press('Enter');
        const help = page.getByTestId('help');
        await expect(help).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(help).toHaveCount(0);
      }
      await expect(saves).toHaveCount(0);
      await expect(name, how).toBeFocused();
      await tabOnto(card.getByRole('button', { name: 'Back to Home' }));
      await page.keyboard.press('Enter');
      await expect(home).toBeVisible();
    }
  });

  test('by the keyboard: Escape in the company’s name, the colours’ focus, and Back to Home into Home’s card', async ({ page }) => {
    test.setTimeout(90_000);
    /** Puts the keyboard on `button` as Tab would. */
    const tabOnto = async (button: Locator) => {
      await button.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(button).toBeFocused();
    };
    const inHome = () => page.getByTestId('home').evaluate((el) => el.contains(document.activeElement));
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await page.getByTestId('home').getByRole('button', { name: 'Saves', exact: true }).click();
    await leaveHome(page);
    const saves = page.getByTestId('saves');
    const card = page.getByTestId('founding-card');
    await expect(saves).toBeVisible();
    await expect(card.getByLabel('Name')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(saves).toHaveCount(0);
    await expect(card).toBeVisible();
    // The colour the keyboard is on draws a ring inside its swatch.
    const swatch = (name: string) => card.locator('.swatch-choice').filter({ has: page.getByRole('radio', { name }) });
    await expect(swatch('Red')).toHaveCSS('box-shadow', 'none');
    await page.keyboard.press('Tab');
    await expect(card.getByRole('radio', { name: 'Red' })).toBeFocused();
    await expect(swatch('Red')).not.toHaveCSS('box-shadow', 'none');
    await tabOnto(card.getByRole('button', { name: 'Back to Home' }));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('home')).toBeVisible();
    await expect.poll(inHome).toBe(true);
    await foundCompany(page);
    await tabOnto(page.getByTestId('saves-chip'));
    await page.keyboard.press('Enter');
    await tabOnto(saves.getByRole('button', { name: 'Back to Home' }));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('home')).toBeVisible();
    await expect.poll(inHome).toBe(true);
  });
});
