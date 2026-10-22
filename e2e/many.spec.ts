// A late game of many lines (the systems audit's seventh round, the screens with many lines): the fixture's 18 lines, drawn by
// Create's own rule along its corridors both ways (src/sim/scene.ts lateScene), imported through Saves at 1152×720, I13's
// tightest size. Each test was shown failing (TS-04) with its fix taken out.
import { createHash } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { loadCity } from '../src/sim/city/simfile';
import { toLngLat, toXY, type XY } from '../src/sim/core/geo';
import { encode } from '../src/sim/save/save';
import { FIXTURE_CORRIDORS, lateScene } from '../src/sim/scene';
import { copyProblems } from '../src/ui/copyRules';
import { lineEdges, type World } from '../src/sim/world';
import { foundCompany } from './found';
import { build, projector, toScreen } from './shell';

/** The fixture's late game of at most `lines` lines, imported over a founded company, paused. */
async function lateGame(page: Page, lines = 30) {
  await page.setViewportSize({ width: 1152, height: 720 });
  const simFile = page.waitForResponse((r) => /\/cities\/sim-[^/]+\.json$/.test(new URL(r.url()).pathname));
  await page.goto('./');
  const text = await (await simFile).text();
  const loaded = loadCity(text);
  if (!loaded.ok) throw new Error(loaded.problem);
  const { city } = loaded;
  const world = lateScene(city, { id: city.id, revision: city.extent, hash: createHash('sha256').update(text).digest('hex') }, FIXTURE_CORRIDORS, lines);
  await foundCompany(page);
  await page.getByRole('button', { name: 'Saves' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a save file' }).click();
  await page.getByRole('button', { name: 'Replace this game' }).click();
  await (await chooser).setFiles({ name: 'late.json', mimeType: 'application/json', buffer: Buffer.from(encode(world.state, { sha: 'late', version: '0.0.0' })) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await page.getByTestId('saves').getByRole('button', { name: 'Close', exact: true }).click();
  return world;
}

/** The point half way along a street's points. */
function halfway(pts: readonly XY[]): XY {
  const legs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  let left = legs.reduce((a, b) => a + b, 0) / 2;
  for (const [i, leg] of legs.entries()) {
    if (left <= leg) {
      const [a, b] = [pts[i]!, pts[i + 1]!];
      return [a[0] + ((b[0] - a[0]) * left) / leg, a[1] + ((b[1] - a[1]) * left) / leg];
    }
    left -= leg;
  }
  return pts.at(-1)!;
}

/** The middle of each street that two or more of `world`'s lines drive between their stops (lineEdges, Create's own route), more than 120 m from every stop, and those lines. */
function sharedStreets(world: World): { street: number; at: [number, number]; lineIds: number[] }[] {
  const { city, state } = world;
  const stops = state.stops.map((s) => toXY(city.frame, [s.lon, s.lat]));
  const driven = new Map<number, Set<number>>();
  for (const line of state.lines) for (const e of lineEdges(world, line)) driven.set(e, (driven.get(e) ?? new Set<number>()).add(line.id));
  return [...driven].flatMap(([street, ids]) => {
    const mid = halfway(city.streets[street]!.points as readonly XY[]);
    if (ids.size < 2 || stops.some((s) => Math.hypot(s[0] - mid[0], s[1] - mid[1]) < 120)) return [];
    return [{ street, at: [...toLngLat(city.frame, mid)] as [number, number], lineIds: [...ids] }];
  });
}

/** Where the camera shows the shared street nearest the map's middle, at least 150 px inside the map, and its lines. */
async function sharedInView(page: Page, world: World) {
  const { project, box } = await projector(page);
  const centre: [number, number] = [box.x + box.width / 2, box.y + box.height / 2];
  const inView = ([x, y]: [number, number]) => x > box.x + 150 && x < box.x + box.width - 150 && y > box.y + 150 && y < box.y + box.height - 150;
  const shared = sharedStreets(world)
    .map((s) => ({ ...s, xy: project(s.at) }))
    .filter((s) => inView(s.xy))
    .sort((a, b) => Math.hypot(a.xy[0] - centre[0], a.xy[1] - centre[1]) - Math.hypot(b.xy[0] - centre[0], b.xy[1] - centre[1]))[0];
  expect(shared).toBeDefined();
  return { ...shared!, inView: (at: readonly [number, number]) => inView(project(at)) };
}

/** Clicks `xy` until Lines here comes: the lines draw a moment after a save loads or a line is made, and the tries are far enough apart that none is taken for a double-click. */
async function openHere(page: Page, xy: [number, number]) {
  const here = page.getByTestId('lines-here');
  await expect(async () => {
    await page.mouse.click(...xy);
    await expect(here).toBeVisible({ timeout: 1_000 });
  }).toPass({ intervals: [700], timeout: 15_000 });
  return here;
}

/** Whether `el` shows whole in the part of `panel` the window shows, and how far past the panel's foot it ends. */
async function shownIn(panel: Locator, el: Locator) {
  const [p, b] = [(await panel.boundingBox())!, (await el.boundingBox())!];
  return { whole: b.y >= p.y - 1 && b.y + b.height <= p.y + p.height + 1, below: Math.round(b.y + b.height - (p.y + p.height)) };
}

test.describe('a late game of many lines', () => {
  // Lines on the same streets draw over one another, and a click there opened only the line drawn on top: the others were
  // reached only from Lines' tabs (DECISIONS, Open: many lines on the map, its recommended (b)). Such a click now lists every
  // line under it, each to open. Shown failing (TS-04) with the click opening the line on top, as before.
  test('a click on streets that several lines share lists them, and each opens its line', async ({ page }) => {
    const world = await lateGame(page);
    const shared = await sharedInView(page, world);
    const here = await openHere(page, shared.xy);
    const names = shared.lineIds.map((id) => world.state.lines.find((l) => l.id === id)!.name);
    for (const name of names) await expect(here.getByRole('button', { name, exact: true })).toBeVisible();
    expect(copyProblems(await here.locator('h2, p, button').allInnerTexts())).toEqual([]);
    for (const name of names.slice(0, 2)) {
      await here.getByRole('button', { name, exact: true }).click();
      await expect(page.getByTestId('inspector').getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    }
  });

  // An undo took back a line the card listed and freed its id, and the next line created took that id: the card listed the
  // new line as running where the click was, though it ran elsewhere, and opened it (the review of the change). The card now
  // closes with any line it lists, as the stop card closes with its stop. Shown failing (TS-04) without App's rule that closes it.
  test('Lines here closes with a line it lists, so a later line under the freed id is never listed', async ({ page }) => {
    // 16 lines of one Sparrow each leave the depots room for the two made here.
    const world = await lateGame(page, 16);
    const shared = await sharedInView(page, world);
    const { state } = world;
    const at = (id: number) => {
      const s = state.stops.find((x) => x.id === id)!;
      return [s.lon, s.lat] as [number, number];
    };
    // Each leg of a line, one stop to the next, with the streets Create drives between them.
    const legs = state.lines
      .flatMap((line) => line.stopIds.slice(1).map((b, k) => ({ lineId: line.id, a: line.stopIds[k]!, b, edges: lineEdges(world, { ...line, stopIds: [line.stopIds[k]!, b] }) })))
      .filter((leg) => shared.inView(at(leg.a)) && shared.inView(at(leg.b)));
    const on = legs.find((leg) => leg.edges.includes(shared.street));
    const off = legs.find((leg) => !leg.edges.includes(shared.street) && !shared.lineIds.includes(leg.lineId));
    expect(on && off).toBeTruthy();
    const NEW = `Line ${state.nextIds.line}`;
    const draw = async (a: number, b: number) => {
      await build(page, 'Draw a line');
      for (const id of [a, b]) await page.mouse.click(...(await toScreen(page, at(id))));
      const draft = page.getByTestId('draft-card');
      await expect(draft).toContainText('2 stops', { timeout: 10_000 });
      await draft.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByTestId('inspector').getByRole('tab', { name: NEW, exact: true })).toHaveAttribute('aria-selected', 'true');
    };
    // A new line over the shared street: the card lists it with the others.
    await draw(on!.a, on!.b);
    await page.getByTestId('inspector').getByRole('button', { name: 'Close', exact: true }).click();
    const here = await openHere(page, shared.xy);
    await expect(here.getByRole('button', { name: NEW, exact: true })).toBeVisible();
    // Undo takes it back, and the card closes with it.
    await page.keyboard.press('Control+z');
    await expect(here).toBeHidden();
    // A line made elsewhere takes the freed id, and the card stays closed: nothing lists it as a line here.
    await draw(off!.a, off!.b);
    await expect(here).toBeHidden();
  });

  // The line card's link opened Finance's Lines on its line, the row expanded but below the panel's foot, under the lines
  // before it, and nothing scrolled to it: the link seemed to do nothing. Scrolled to it, the panel's heading (its drag handle),
  // Close and views went out of reach with the rest (the review of the round's fixes): only the body scrolls now.
  test('the line card’s “Fare and money in Finance” shows that line’s money and fare band, under Finance’s heading and Close', async ({ page }) => {
    const world = await lateGame(page);
    const last = world.state.lines.at(-1)!;
    expect(world.state.lines.length).toBe(18);
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    await lines.getByRole('tab', { name: last.name, exact: true }).click();
    await lines.getByRole('button', { name: 'Fare and money in Finance' }).click();
    const finance = page.getByTestId('finance');
    await expect(finance.getByRole('button', { name: last.name, exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(finance.getByTestId('fare-band')).toBeVisible();
    const body = finance.getByTestId('finance-body');
    for (const part of [finance.getByTestId(`line-money-${last.id}`), finance.getByTestId('line-forecast'), finance.getByTestId('fare-band')]) {
      expect(await shownIn(body, part)).toMatchObject({ whole: true });
    }
    for (const part of [finance.getByRole('heading', { name: 'Finance' }), finance.getByRole('button', { name: 'Close', exact: true }), finance.getByRole('tablist', { name: 'Finance views' })]) {
      expect(await shownIn(finance, part)).toMatchObject({ whole: true });
    }
  });

  // Each change of the network asks for the band again, and each band that came scrolled Finance back to the asked line, however
  // the player had scrolled it since (the review of the round's fixes): a fare changed on the first line put its row out of view.
  test('a fare changed in Finance after scrolling it leaves the view where the player put it', async ({ page }) => {
    const world = await lateGame(page);
    const [first, last] = [world.state.lines[0]!, world.state.lines.at(-1)!];
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    await lines.getByRole('tab', { name: last.name, exact: true }).click();
    await lines.getByRole('button', { name: 'Fare and money in Finance' }).click();
    const finance = page.getByTestId('finance');
    const body = finance.getByTestId('finance-body');
    await expect(finance.getByTestId('fare-band')).toBeVisible();
    await body.evaluate((el) => void (el.scrollTop = 0));
    await finance.getByTestId(`fare-${first.id}`).click();
    await page.getByRole('option', { name: first.fareCents === 250 ? '$2.75' : '$2.50', exact: true }).click();
    await expect(finance.getByTestId(`fare-${first.id}`)).toContainText(first.fareCents === 250 ? '$2.75' : '$2.50');
    // The band asked again for the network as it now is comes, and the view stays.
    await expect(finance.getByTestId('fare-band')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await body.evaluate((el) => el.scrollTop)).toBe(0);
    expect(await shownIn(body, finance.getByTestId(`line-money-${first.id}`))).toMatchObject({ whole: true });
  });

  // A dropdown's list was placed as it opened: a wheel over Finance's body scrolled its button away and left the list open beside
  // another line's row, holding the keyboard, a pick there setting a fare out of view (the systems audit's eighth round). The
  // list now goes with its button, and closes once the button is out of the body's view, leaving the scroll where it went.
  test('a fare list open in Finance goes with its button as Finance’s body scrolls, and closes once the button is out of view', async ({ page }) => {
    const world = await lateGame(page);
    const first = world.state.lines[2]!;
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance-lines').click();
    const finance = page.getByTestId('finance');
    const body = finance.getByTestId('finance-body');
    const fare = finance.getByTestId(`fare-${first.id}`);
    await fare.click();
    const list = page.getByRole('listbox', { name: `Fare for ${first.name}` });
    await expect(list).toBeVisible();
    const b = (await body.boundingBox())!;
    await page.mouse.move(b.x + 20, b.y + b.height - 20);
    // A little: the button stays in view, and the list beside it.
    await page.mouse.wheel(0, 30);
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(list).toBeVisible();
    await expect.poll(async () => Math.abs((await list.boundingBox())!.y - ((await fare.boundingBox())!.y + (await fare.boundingBox())!.height))).toBeLessThan(10);
    // Far: the button goes under the heading, the list closes, and the body stays scrolled.
    await page.mouse.wheel(0, 600);
    await expect(list).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    await expect(fare).toContainText(`$${(first.fareCents / 100).toFixed(2)}`);
  });

  // Placed again at each scroll, the list showed the chosen option again, taking from view the one the keyboard was on: End
  // reached $5.00, a 30 px scroll hid it, and Enter set it unseen (the review of the eighth round's fixes).
  test('a fare list placed again by a scroll keeps the keyboard’s option in view', async ({ page }) => {
    const world = await lateGame(page);
    const line = world.state.lines[2]!;
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance-lines').click();
    const finance = page.getByTestId('finance');
    const body = finance.getByTestId('finance-body');
    await finance.getByTestId(`fare-${line.id}`).focus();
    await page.keyboard.press('ArrowDown');
    const list = page.getByRole('listbox', { name: `Fare for ${line.name}` });
    await expect(list).toBeVisible();
    await page.keyboard.press('End');
    const b = (await body.boundingBox())!;
    await page.mouse.move(b.x + 20, b.y + b.height - 20);
    await page.mouse.wheel(0, 30);
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(list).toBeVisible();
    const [l, o] = [(await list.boundingBox())!, (await list.getByRole('option', { name: '$5.00', exact: true }).boundingBox())!];
    expect(o.y >= l.y - 1 && o.y + o.height <= l.y + l.height + 1, `$5.00 at ${Math.round(o.y)}-${Math.round(o.y + o.height)} in the list's ${Math.round(l.y)}-${Math.round(l.y + l.height)}`).toBe(true);
  });

  // The tabs are a tablist, so the arrow keys move along them and Tab leaves them for the card (WAI-ARIA's tabs pattern):
  // before, the arrows did nothing, and the keyboard took a Tab press a tab to reach the line card. A change picked on a low
  // line showed its Run it below the panel's foot, and nothing scrolled to it (30 lines' tabs at 1152×720).
  test('the Lines tabs take the arrow keys, and a change picked on the last line shows its Run it', async ({ page }) => {
    const world = await lateGame(page);
    const [first, second, last] = [world.state.lines[0]!, world.state.lines[1]!, world.state.lines.at(-1)!];
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const panel = page.getByTestId('inspector');
    const tab = (name: string) => panel.getByRole('tab', { name, exact: true });
    await tab(first.name).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(second.name)).toBeFocused();
    await expect(tab(second.name)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(tab(first.name)).toBeFocused();
    await page.keyboard.press('End');
    await expect(tab(last.name)).toBeFocused();
    await expect(tab(last.name)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tab(first.name)).toBeFocused();
    // One Tab leaves the tabs for the card's first control.
    await page.keyboard.press('Tab');
    await expect(panel.getByTestId('line-model')).toBeFocused();

    // 600 px tall, so the fixture's 18 lines' tabs push the card past the panel's foot as 30 lines' do at 720.
    await page.setViewportSize({ width: 1152, height: 600 });
    await tab(last.name).click();
    await panel.getByTestId('headway-peak').click();
    await page.getByRole('option', { name: 'Every 30 min' }).click();
    const run = panel.getByTestId('headway-change').getByRole('button', { name: 'Run it' });
    await expect(run).toBeVisible();
    expect(await shownIn(panel, panel.getByTestId('headway-change'))).toMatchObject({ whole: true });
  });
});
