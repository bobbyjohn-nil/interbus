// How big a long game's save gets (the systems audit's third round, D26): a company kept on the fixture
// with three lines (the starting cash) and with seven ($5 million), taking every contract it meets, for
// 1,000 days. Each day's save is measured at 05:00, the day's start, and at 23:00, its largest
// (testing.ts LARGEST_SAVE_SECOND): the ledger's rows, the save's characters, and five copies (the
// autosave, the quarter's save and three slots) against the room e2e/storage.spec.ts measured in
// Chromium. `npm run bench savesize`, nightly; it exits 1 when a seven-line save reaches
// GROWN_SAVE_MOST_CHARS, the bound save/size.test.ts holds for 48 days in the PR checks.
// Measured on 001fc4a, before closed days folded, at 23:00 and at the next 05:00: three lines 4,416 and
// 4,181 rows, 266,094 and 252,272 characters at day 240; 17,594 and 17,360 rows, 1,061,292 and 1,047,297
// characters at day 1,000 (five copies 1.012 of the room). Seven lines 9,475 and 8,972 rows, 565,547 and
// 536,169 characters at day 240; 37,858 and 37,355 rows, 2,265,852 and 2,235,980 at day 1,000 (2.161).
// With the fold (economy/ledger.ts foldDays): three lines 550 and 297 rows, 34,894 and 19,981 characters
// at day 240; 549 and 298, 35,119 and 20,100 at day 1,000; the largest 36,907 (23:00 on day 410). Seven
// lines 1,138 and 597 rows, 70,519 and 38,860 characters at day 240; 1,140 and 600, 71,230 and 39,144 at
// day 1,000; the largest 73,177 (23:00 on day 522) and 41,597 at 05:00 (day 410), five copies 0.070 of the
// room. Cash at day 1,000 is the same either way: $28,049,851 with three lines, $32,008,567 with seven.
import { encode } from '../src/sim/save/save';
import { GROWN_SAVE_MOST_CHARS, grownCompany, playDay } from '../src/sim/testing';
import type { World } from '../src/sim/world';

/** An empty origin's localStorage in Chromium 141, in characters: e2e/storage.spec.ts, measured 2026-10-15. */
const CHROMIUM_STORAGE_CHARS = 5_242_880;
const DAYS = 1_000;
const SHOWN = new Set([16, 17, 240, DAYS]);
const build = { sha: 'bench', version: '0.0.0' };
const chars = (world: World) => encode(world.state, build).length;
const n = (x: number) => x.toLocaleString('en-US');
let over = false;
for (const [lines, capital] of [
  [3, undefined],
  [7, 500_000_000],
] as const) {
  const world = grownCompany(lines, capital);
  const t0 = performance.now();
  const largest = { start: { chars: 0, day: 0 }, late: { chars: 0, day: 0 } };
  for (let day = 1; day <= DAYS; day++) {
    let late = { rows: 0, chars: 0 };
    playDay(world, (w) => void (late = { rows: w.state.ledger.rows.length, chars: chars(w) }));
    const start = { rows: world.state.ledger.rows.length, chars: chars(world) };
    if (late.chars > largest.late.chars) largest.late = { chars: late.chars, day };
    if (start.chars > largest.start.chars) largest.start = { chars: start.chars, day: day + 1 };
    if (!SHOWN.has(day)) continue;
    console.log(
      `${lines} lines, day ${String(day).padStart(5)} at 23:00: ${n(late.rows).padStart(6)} rows, ${n(late.chars).padStart(9)} characters; day ${String(day + 1).padStart(5)} at 05:00: ${n(start.rows).padStart(6)} rows, ${n(start.chars).padStart(9)} characters; cash $${n(Math.round(world.state.ledger.cashCents / 100))}`,
    );
  }
  const most = largest.late.chars;
  console.log(
    `  largest at 23:00 ${n(most)} characters (day ${largest.late.day}), at 05:00 ${n(largest.start.chars)} (day ${largest.start.day}); five copies of the largest ${((5 * most) / CHROMIUM_STORAGE_CHARS).toFixed(3)} of Chromium's room; ${((performance.now() - t0) / 1000).toFixed(1)} s for ${n(DAYS)} days`,
  );
  if (lines === 7 && Math.max(most, largest.start.chars) >= GROWN_SAVE_MOST_CHARS) over = true;
}
if (over) {
  console.log(`a seven-line save reached GROWN_SAVE_MOST_CHARS, ${n(GROWN_SAVE_MOST_CHARS)} characters`);
  process.exitCode = 1;
}
