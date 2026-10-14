import { expect, type Page } from '@playwright/test';
import { foundingCapitalCents } from '../src/sim/economy/ledger';

/** A new company's starting cash in cents (k × the founding recipe, D7), so a retune of k pins nothing here. */
export const STARTING_CENTS = foundingCapitalCents();

/**
 * Home, the first screen (the M5 spec, item 3): New game, or Continue with the game that saves itself
 * as it plays.
 */
export async function leaveHome(page: Page, how: 'new' | 'continue' = 'new'): Promise<void> {
  const home = page.getByTestId('home');
  await expect(home).toBeVisible({ timeout: 30_000 });
  await (how === 'new' ? home.getByRole('button', { name: 'New game' }) : home.getByTestId('home-continue')).click();
  await expect(home).toBeHidden();
}

/** The exit check's step 1 (the M2 spec): from Home's New game, name the company on the founding card and found it. */
export async function foundCompany(page: Page, name = 'Back Bay Transit'): Promise<void> {
  const card = page.getByTestId('founding-card');
  await expect(page.getByTestId('home').or(card)).toBeVisible({ timeout: 30_000 });
  if (await page.getByTestId('home').isVisible()) await leaveHome(page);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByLabel('Name').fill(name);
  await card.getByRole('button', { name: 'Found the company', exact: true }).click();
  await expect(card).toBeHidden();
}
