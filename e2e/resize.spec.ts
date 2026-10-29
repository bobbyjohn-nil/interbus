// Panels through changes of the window's size, as Chrome's zoom and a drag of the window's corner make them (the systems audit's
// eighteenth round, its second lane, and the round's review): a pile a zoom made comes apart once there is room again, laid out
// afresh as the panels opened where the pass leaves one; a drag's pile goes once one of its panels is placed afresh or dragged
// clear; and the lender's card stays where it is. Each shown failing (TS-04) with its fix taken out.
import { expect, test, type Locator, type Page } from './base';
import { foundCompany, STARTING_CENTS } from './found';
import { city, resizeTo, setSpeed, withDebugLine } from './shell';

const apart = async (a: Locator, b: Locator) => {
  const [p, q] = [(await a.boundingBox())!, (await b.boundingBox())!];
  return p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y;
};
/** Drags a panel by its heading. */
const dragBy = async (page: Page, panel: Locator, heading: string, dx: number, dy: number) => {
  const h = (await panel.getByRole('heading', { name: heading }).boundingBox())!;
  await page.mouse.move(h.x + 10, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 10 + dx, h.y + h.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
};
/** Each pair of panels lying over each other, by their ids, with the overlap's size. */
const piles = (page: Page) =>
  page.evaluate(() => {
    const boxes = [...document.querySelectorAll<HTMLElement>('[data-movable]')].map((el) => ({ id: el.dataset.movable!, r: el.getBoundingClientRect() }));
    boxes.sort((a, b) => a.id.localeCompare(b.id));
    return boxes.flatMap((a, i) =>
      boxes.slice(i + 1).flatMap((b) => {
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        return w > 0 && h > 0 ? [`${a.id}/${b.id} ${Math.round(w)}×${Math.round(h)}`] : [];
      }),
    );
  });
/** Each pair of panels lying over each other but the lender's card's, which lies over the panels opened before it, as it may. */
const pilesButLender = async (page: Page) => (await piles(page)).filter((p) => !p.split(' ')[0]!.split('/').includes('lender'));
/** Each panel's place on the window, by its id. */
const places = (page: Page) =>
  page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('[data-movable]')].map((el) => [el.dataset.movable!, [Math.round(el.getBoundingClientRect().left), Math.round(el.getBoundingClientRect().top)]])));
/** The run ended on a 1152×720 window with Contracts, Lines, Finance and Saves open as it ends: the lender's card, opened last. */
async function runEnded(page: Page) {
  await page.setViewportSize({ width: 1152, height: 720 });
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  // The fifth close below the floor a few minutes away (D10), Contracts, Lines, Finance and Saves open as it comes.
  await withDebugLine(page, (d) => {
    d.clock.elapsed = 86_400 + 18 * 3_600 + 50 * 60;
    (d as unknown as { closesBelowFloor: number }).closesBelowFloor = 4;
    d.ledger.push({ day: 1, kind: 'buses', amountCents: -(STARTING_CENTS + 20_000_000), lineId: null });
  });
  await page.getByTestId('checklist').click();
  for (const name of ['Lines', 'Finance']) await page.getByRole('button', { name, exact: true }).click();
  await page.getByTestId('saves-chip').click();
  await setSpeed(page, '5,400×');
  const day = page.getByTestId('day-card');
  await expect(day).toBeVisible({ timeout: 30_000 });
  await day.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('failure-card')).toBeVisible();
  return page.locator('[data-movable="lender"]');
}
/** The debug line's game on a window `width` by `height`, with Lines, Finance (its Breakdown unfolded), Contracts and Saves opened in turn. */
async function fourPanels(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  await withDebugLine(page);
  for (const name of ['Lines', 'Finance']) await page.getByRole('button', { name, exact: true }).click();
  await page.getByTestId('checklist').click(); // "5/5 Take a contract" opens Contracts
  await page.getByRole('button', { name: 'Saves' }).click();
  for (const id of ['inspector', 'finance', 'contracts', 'saves']) await expect(page.getByTestId(id)).toBeVisible();
  const finance = page.getByTestId('finance');
  await finance.getByTestId('finance-breakdown').click();
  for (const group of await finance.locator('tr[data-open="no"] button').all()) await group.click();
}

test.describe('panels through changes of the window’s size', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  // A pile a zoom made, with no free place, comes apart once there is room again: only a drag's overlaps stay (the systems
  // audit's eighteenth round). Kept as they lay before each change, Contracts lay 280×248 px over Lines back at 100% after 150%
  // here (280×267 on Inner Boston). Shown failing (TS-04) with every overlap from before a change kept. The fixture's Finance,
  // 290 px tall with its Breakdown, stays under its 329 px cap at 632 px, so the capped panel the round saw on Inner Boston,
  // which the same change mends, is not reached here.
  test('bring panels a zoom piled up apart again as the window grows back', async ({ page }) => {
    test.setTimeout(90_000);
    await fourPanels(page, 1440, 790);
    expect(await piles(page)).toEqual([]);
    // Chrome's 150% and 125% on the owner's Mac at 1440×790, each and back.
    for (const [width, height] of [[960, 527], [1152, 632]] as const) {
      await resizeTo(page, width, height);
      await resizeTo(page, 1440, 790);
      expect(await piles(page), `back from ${width}×${height}`).toEqual([]);
    }
  });

  // Back from 175% a step at a time, the narrower windows on the way left Lines, Finance and Contracts where they kept them
  // whole, and Saves, opened last, found no free place and fell back over Finance at 100%, 215×143 px (the round's review, 18
  // runs of 18 at 1152×720, 1280×720 and 1280×800). A pile the pass leaves is laid out afresh as the panels opened, if that
  // leaves fewer. Shown failing (TS-04) with no such layout.
  test('lay panels out afresh when stepping back from 175% leaves them piled', async ({ page }) => {
    test.setTimeout(90_000);
    await fourPanels(page, 1152, 720);
    expect(await piles(page)).toEqual([]);
    for (const zoom of [1.1, 1.25, 1.5, 1.75, 1.5, 1.25, 1.1, 1]) await resizeTo(page, Math.round(1152 / zoom), Math.round(720 / zoom));
    expect(await piles(page)).toEqual([]);
  });

  // A drag's pile goes once a change of size places one of its panels afresh: Finance dragged over Saves and Contracts, 175%
  // placed Contracts afresh, and back at 100% the pair kept it under Finance, 21×290 px (the round's review, 3 runs of 3). Shown
  // failing (TS-04) with the pair kept.
  test('forget a drag’s pile once a change of size places one of its panels afresh', async ({ page }) => {
    test.setTimeout(90_000);
    await fourPanels(page, 1440, 790);
    await dragBy(page, page.getByTestId('finance'), 'Finance', -604, 100);
    expect((await piles(page)).map((p) => p.split(' ')[0])).toEqual(['contracts/finance', 'finance/saves']);
    await resizeTo(page, 823, 451);
    await resizeTo(page, 1440, 790);
    expect((await piles(page)).map((p) => p.split(' ')[0])).toEqual(['finance/saves']);
  });

  // And a drag that ends clear forgets the panels it had been left over: kept, a window narrowed to 125% slid Lines under
  // Finance, 276×302 px (the round's review, on a build that kept every pair, 3 runs of 3). Shown failing (TS-04) the same way.
  test('forget a drag’s pile once the panel is dragged clear', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 790 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    for (const name of ['Lines', 'Finance']) await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Saves' }).click();
    const finance = page.getByTestId('finance');
    await dragBy(page, finance, 'Finance', 300, 50);
    expect(await apart(finance, page.getByTestId('inspector'))).toBe(false);
    await dragBy(page, finance, 'Finance', -300, -50);
    expect(await piles(page)).toEqual([]);
    await resizeTo(page, 1152, 632);
    expect(await piles(page)).toEqual([]);
  });

  // The lender's card, opened last with no free place over the panels opened before it, is placed afresh as the window changes
  // size: with its own place among those it keeps clear of, it went below itself at each change, y 168 and 318 in turn as the
  // window grew a pixel at a time, as a drag of its corner does (the round's review, 3 runs of 3). Shown failing (TS-04) with its
  // own place kept clear of.
  test('keep the lender’s card where it is as the window grows a pixel at a time', async ({ page }) => {
    test.setTimeout(90_000);
    const lender = await runEnded(page);
    const y = Math.round((await lender.boundingBox())!.y);
    for (let k = 1; k <= 3; k++) {
      await resizeTo(page, 1152 + k, 720);
      expect(Math.round((await lender.boundingBox())!.y), `at ${1152 + k}×720`).toBe(y);
    }
  });

  // With the lender's card up, a zoom and back leaves the panels as they opened: kept whole from where the change left them,
  // Finance, kept clear of where the card stood at 150%, lay over Contracts back at 100%, 56×248 px (the systems audit's
  // nineteenth round, on Inner Boston). Shown failing (TS-04) with each panel kept whole from where it stands.
  test('leave no panel over another after a zoom and back with the lender’s card up', async ({ page }) => {
    test.setTimeout(90_000);
    await runEnded(page);
    expect(await pilesButLender(page)).toEqual([]);
    for (const zoom of [1.5, 1.25]) {
      await resizeTo(page, Math.round(1152 / zoom), Math.round(720 / zoom));
      await resizeTo(page, 1152, 720);
      expect(await pilesButLender(page), `back from ${zoom * 100}%`).toEqual([]);
    }
  });

  // Panels in free places go back where they opened after a change of size and back, kept whole from there: kept whole from
  // where the change left them, Chrome's 110% and back left Lines, Finance and Contracts 131 px to the left, and a close's card,
  // with no room left of them, stood over Finance's heading (the systems audit's nineteenth round, on Inner Boston). Shown failing
  // (TS-04) with each kept whole from where it stands.
  test('put panels in free places back where they opened after a zoom and back', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 790 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    for (const name of ['Lines', 'Finance']) await page.getByRole('button', { name, exact: true }).click();
    await page.getByTestId('checklist').click(); // "5/5 Take a contract" opens Contracts
    for (const id of ['inspector', 'finance', 'contracts']) await expect(page.getByTestId(id)).toBeVisible();
    const opened = await places(page);
    await resizeTo(page, 1309, 718);
    await resizeTo(page, 1440, 790);
    expect(await places(page)).toEqual(opened);
  });

  // A dragged panel is kept in reach of where it was dragged to, not of where the last change left it: Lines and Finance dragged
  // apart at the right, kept in reach together at 150%, stayed one on the other back at 100%, 280×244 px (the systems audit's
  // nineteenth round, on Inner Boston). Shown failing (TS-04) with a dragged panel kept in reach of where it stands.
  test('keep panels dragged apart where they were put through a zoom and back', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 790 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    for (const name of ['Lines', 'Finance']) await page.getByRole('button', { name, exact: true }).click();
    const [lines, finance] = [page.getByTestId('inspector'), page.getByTestId('finance')];
    // Lines to (1,000, 100) and Finance to (1,300, 160), side by side, Finance's right past the window's edge.
    const l = (await page.locator('[data-movable="lines"]').boundingBox())!;
    await dragBy(page, lines, 'Line 1', 1_000 - l.x, 100 - l.y);
    const f = (await page.locator('[data-movable="finance"]').boundingBox())!;
    await dragBy(page, finance, 'Finance', 1_300 - f.x, 160 - f.y);
    const put = await places(page);
    expect(await piles(page)).toEqual([]);
    await resizeTo(page, 960, 527);
    await resizeTo(page, 1440, 790);
    expect(await piles(page)).toEqual([]);
    expect(await places(page)).toEqual(put);
  });

  // A panel let go where the pointer is, though the window changed size as it was held: the change placed it as a panel in a
  // free place, and let go without a move it stayed there and opened next under the pointer's place, 244×264 px over Lines
  // (the systems audit's nineteenth round, on Inner Boston). Shown failing (TS-04) with the drag's end leaving the panel where
  // the change put it.
  test('let a panel go under the pointer though the window changed size as it was held', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 790 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    for (const name of ['Lines', 'Finance']) await page.getByRole('button', { name, exact: true }).click();
    const finance = page.getByTestId('finance');
    const h = (await finance.getByRole('heading', { name: 'Finance' }).boundingBox())!;
    await page.mouse.move(h.x + 10, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 10 - 200, h.y + h.height / 2 + 40, { steps: 8 });
    await resizeTo(page, 1152, 632);
    await page.mouse.up();
    const left = (await places(page)).finance;
    await finance.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await expect(finance).toBeVisible();
    expect((await places(page)).finance).toEqual(left);
  });
});
