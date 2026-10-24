// The keyboard tests' shared steps (keyboard.spec.ts, focusback.spec.ts): a game with Lines open, a press from the keyboard,
// and a count of the commands the page sends to the sim.
import { expect, type Locator, type Page } from './base';
import { foundCompany, leaveHome } from './found';
import { withDebugLine, type SaveData } from './shell';

/** A founded company with the debug line, edited by `edit`, past Home, and Lines open on it. */
export async function lines(page: Page, edit?: (data: SaveData) => void) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, edit);
  await page.getByRole('button', { name: 'Lines', exact: true }).click();
  return page.getByTestId('inspector');
}

/** Focuses `button` and presses it from the keyboard. */
export async function press(page: Page, button: Locator) {
  await button.focus();
  await page.keyboard.press('Enter');
}

/** Counts the commands the page posts to the sim's worker, by type, from the page's start. */
export async function countSends(page: Page) {
  await page.addInitScript(() => {
    const sent: string[] = [];
    (window as unknown as { sent: string[] }).sent = sent;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, message: unknown, ...rest: unknown[]) {
      const type = (message as { type?: unknown } | null)?.type;
      if (typeof type === 'string') sent.push(type);
      return (post as (...a: unknown[]) => void).call(this, message, ...rest);
    } as typeof Worker.prototype.postMessage;
  });
  return (type: string) => page.evaluate((t) => (window as unknown as { sent: string[] }).sent.filter((s) => s === t).length, type);
}
