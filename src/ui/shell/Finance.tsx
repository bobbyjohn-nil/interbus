import type { FinanceView } from '../../sim/types';
import { quarterText, ROW_NAMES, usd } from '../format';
import type { Sim } from '../game/useSim';

/** Kinds the forecast models from riders rather than knows from the day plan. */
const MODELLED = new Set(['fares', 'subsidy']);

/**
 * Finance (the M3 spec, item 6): every ledger row by kind, for today so far, yesterday and this
 * quarter so far, beside a whole day's forecast. Capital rows are in, so each column's total is the
 * change in cash over it; the forecast's total is a day's running net, which capital never enters.
 */
export function Finance({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const f = sim.snapshot?.finance;
  if (!f) return null;
  const shown = f.rows.filter((r) => r.todayCents !== 0 || r.yesterdayCents !== 0 || r.quarterCents !== 0 || (r.forecastCents ?? 0) !== 0);
  const sum = (pick: (r: FinanceView['rows'][number]) => number) => f.rows.reduce((s, r) => s + pick(r), 0);
  const money = (cents: number, modelled = false) => `${modelled ? '≈' : ''}${usd(cents)}`;
  const today = sum((r) => r.todayCents);
  const quarter = sum((r) => r.quarterCents);
  return (
    <aside className="panel finance" aria-label="Finance" data-testid="finance" data-chrome="panel" data-today={today} data-quarter={quarter}>
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Finance</h2>
      <table>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Today</th>
            <th scope="col">Yesterday</th>
            <th scope="col">
              {quarterText(f.quarterFirstDay)}
            </th>
            <th scope="col">A day’s forecast</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.kind} data-kind={r.kind} data-today={r.todayCents} data-yesterday={r.yesterdayCents} data-quarter={r.quarterCents} data-forecast={r.forecastCents ?? ''}>
              <th scope="row">{ROW_NAMES[r.kind] ?? r.kind}</th>
              <td>{money(r.todayCents)}</td>
              <td>{f.day > 1 ? money(r.yesterdayCents) : '—'}</td>
              <td>{money(r.quarterCents)}</td>
              <td>{r.forecastCents === null ? '—' : money(r.forecastCents, MODELLED.has(r.kind))}</td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">Change in cash</th>
            <td>{money(today)}</td>
            <td>{f.day > 1 ? money(sum((r) => r.yesterdayCents)) : '—'}</td>
            <td>{money(quarter)}</td>
            <td>{money(sum((r) => r.forecastCents ?? 0), true)}</td>
          </tr>
        </tbody>
      </table>
    </aside>
  );
}
