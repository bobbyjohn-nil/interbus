import type { FinanceView } from '../../sim/types';
import { calendarOfDay } from '../../sim/rules/calendar';
import { dateText, quarterText, usd } from '../format';

const W = 400;
const CASH_TOP = 6;
const CASH_H = 40;
const BARS_TOP = 62;
const BARS_H = 70;
const LABELS_Y = 150;
const H = 154;
/**
 * About a character's width in the axis's 12px Afacad Flux, in the chart's units ("Q2 Day 1" measured 34.5 at 9px), and the
 * least room between two of its labels. Finance is 440 px wide, so a unit draws about 1.03 px and the labels about 12.4 px
 * (PLAN §8's chrome text of 12 px and more; they were 9).
 */
const LABEL_CHAR = 5.9;
const LABEL_GAP = 6;

/**
 * Finance's chart (D25: "it would be better with some visuals"), drawn by hand in SVG, no library:
 * the cash at each day's close as a line from Day 0's starting cash, and below it each day's money in
 * (above the axis) and running costs (below), today's so far and paler. A day that bought or sold
 * something has a mark under its bars. Every bar names its day and amounts on hover. A day is named as
 * the rest of the game names it (dateText; the top bar's "Q2 Day 1" on the axis), never by its count
 * since founding; Day 0, the starting cash's, comes before every quarter.
 */
export function FinanceChart({ finance: f }: { finance: FinanceView }) {
  const days = f.days;
  if (!days.length) return null;
  // Day 0's starting cash leads the line while the chart still starts on day 1.
  const points = [...(days[0]!.day === 1 ? [{ day: 0, cash: f.openingCents }] : []), ...days.map((d) => ({ day: d.day, cash: d.cashCents }))];
  const slot = W / points.length;
  const x = (k: number) => slot * (k + 0.5);
  const cashes = points.map((p) => p.cash);
  const [lo, hi] = [Math.min(0, ...cashes), Math.max(...cashes)];
  const cashY = (c: number) => CASH_TOP + CASH_H - ((c - lo) / Math.max(1, hi - lo)) * CASH_H;
  // The bars' scale: the biggest day's money in or running costs, named at the top left.
  const scale = Math.max(1, ...days.map((d) => Math.max(d.inCents, -d.outCents)));
  const barH = (cents: number) => (Math.abs(cents) / scale) * (BARS_H / 2);
  const mid = BARS_TOP + BARS_H / 2;
  const offset = points.length - days.length;
  const today = days.at(-1)!.day;
  const dayName = (day: number) => (day === 0 ? 'Day 0' : dateText(day));
  // On the axis, a day of the quarter, with its quarter once the chart holds days of more than one.
  const several = quarterText(days[0]!.day) !== quarterText(today);
  const axisName = (day: number) => {
    if (day === 0) return 'Day 0';
    const { quarter, dayOfQuarter } = calendarOfDay(day);
    return several ? `Q${quarter} Day ${dayOfQuarter}` : `Day ${dayOfQuarter}`;
  };
  // Labelled in rank: today, Day 0, each quarter's first day, then the chart's first. A label that
  // would crowd one ranked before it is left out, and each stays inside the chart.
  const firsts = points.flatMap((p, k) => (p.day > 0 && calendarOfDay(p.day).dayOfQuarter === 1 ? [k] : []));
  const labels: { k: number; text: string; at: number; w: number }[] = [];
  for (const k of [points.length - 1, ...(points[0]!.day === 0 ? [0] : []), ...firsts, 0]) {
    const text = axisName(points[k]!.day);
    const w = text.length * LABEL_CHAR;
    const at = Math.min(W - w / 2, Math.max(w / 2, x(k)));
    if (labels.every((l) => l.k !== k && Math.abs(l.at - at) >= (l.w + w) / 2 + LABEL_GAP)) labels.push({ k, text, at, w });
  }
  const summary = `Cash ${usd(days.at(-1)!.cashCents)} on ${dayName(today)}, from ${usd(points[0]!.cash)} on ${dayName(points[0]!.day)}`;
  return (
    <svg className="finance-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} data-testid="finance-chart" data-days={days.length}>
      {lo < 0 ? <line className="zero" x1={0} x2={W} y1={cashY(0)} y2={cashY(0)} /> : null}
      <polyline className="cash" points={points.map((p, k) => `${x(k)},${cashY(p.cash)}`).join(' ')} />
      {points.map((p, k) => (
        <circle key={p.day} className={p.day === 0 ? 'cash-dot opening' : 'cash-dot'} cx={x(k)} cy={cashY(p.cash)} r={p.day === 0 ? 3 : 1.6}>
          <title>{p.day === 0 ? `Day 0: starting cash ${usd(p.cash)}` : `${dayName(p.day)}: cash ${usd(p.cash)}${p.day === today ? ' so far' : ''}`}</title>
        </circle>
      ))}
      <line className="axis" x1={0} x2={W} y1={mid} y2={mid} />
      {days.map((d, k) => {
        const cx = x(k + offset);
        const w = Math.min(14, slot * 0.6);
        const soFar = d.day === today;
        return (
          <g key={d.day} className={soFar ? 'day today' : 'day'} data-day={d.day} data-in={d.inCents} data-out={d.outCents} data-capital={d.capitalCents}>
            <title>{`${dayName(d.day)}${soFar ? ' so far' : ''}: ${usd(d.inCents)} in, ${usd(-d.outCents)} running costs${d.capitalCents ? `, ${usd(-d.capitalCents)} on buying and building` : ''}`}</title>
            <rect className="in" x={cx - w / 2} y={mid - barH(d.inCents)} width={w} height={barH(d.inCents)} />
            <rect className="out" x={cx - w / 2} y={mid} width={w} height={barH(d.outCents)} />
            {d.capitalCents !== 0 ? <path className="capital" d={`M${cx} ${BARS_TOP + BARS_H + 2} l3 4 h-6 z`} /> : null}
          </g>
        );
      })}
      {[...labels]
        .sort((a, b) => a.k - b.k)
        .map((l) => (
          <text key={l.k} x={l.at} y={LABELS_Y} textAnchor="middle">
            {l.text}
          </text>
        ))}
      <text className="scale" x={2} y={BARS_TOP + 10}>
        {usd(scale)}
      </text>
    </svg>
  );
}
