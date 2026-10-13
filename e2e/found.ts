import { expect, type Page } from '@playwright/test';

/** The exit check's step 1 (the M2 spec): name the company on the founding card and found it. */
export async function foundCompany(page: Page, name = 'Back Bay Transit'): Promise<void> {
  const card = page.getByTestId('founding-card');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByLabel('Name').fill(name);
  await card.getByRole('button', { name: 'Found' }).click();
  await expect(card).toBeHidden();
}
