// Contract income across seeds, HEADWAY and RIDERSHIP together (the M3 spec, item 11; the M4 spec,
// item 1; I11; GD-04): I11's company (src/sim/testing.ts: the debug line and Copley–Kenmore, both every
// 10 minutes, taking every offer they meet) for DAYS days (default 40) on each of SEEDS seeds (default 100). Prints the spread (min, median,
// max), how many seeds land more than 30% from the median, and how many runs of ten seeds would pass
// I11's test, which holds seeds 1–10. `npm run bench contracts [seeds] [days]`.
import { contractIncome } from '../src/sim/testing';

const SEEDS = Number(process.argv[3] ?? 100);
const DAYS = Number(process.argv[4] ?? 40);
const incomes = Array.from({ length: SEEDS }, (_, k) => contractIncome(k + 1, DAYS));
const sorted = [...incomes].sort((a, b) => a - b);
const mid = Math.floor(SEEDS / 2);
const median = SEEDS % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
const outside = incomes.filter((v) => Math.abs(v - median) / median > 0.3).length;
const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
console.log(`contract income over ${DAYS} days, ${SEEDS} seeds: min ${usd(sorted[0]!)}, median ${usd(median)}, max ${usd(sorted.at(-1)!)}`);
console.log(`more than 30% from the median: ${outside} of ${SEEDS}`);
let tens = 0;
for (let k = 0; k + 10 <= SEEDS; k += 10) {
  const group = incomes.slice(k, k + 10).sort((a, b) => a - b);
  const m = (group[4]! + group[5]!) / 2;
  if (group.every((v) => Math.abs(v - m) / m <= 0.3)) tens++;
}
console.log(`runs of 10 seeds (1–10, 11–20, …) all within 30% of their own median: ${tens} of ${Math.floor(SEEDS / 10)}`);
