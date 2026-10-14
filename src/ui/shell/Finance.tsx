import { Fragment } from 'react';
import { ROW_GROUP, type RowGroup } from '../../sim/rules/money';
import type { FinanceView } from '../../sim/types';
import { GROUP_NAMES, quarterText, ROW_HINTS, rowName, usd } from '../format';
import type { Sim } from '../game/useSim';

/** Kinds the forecast models from riders rather than knows from the day plan. */
const MODELLED = new Set(['fares', 'subsidy']);
/** The groups the table lists, in order: what comes in, then what running and building cost (sim/rules/money.ts). */
const GROUPS = ['income', 'reward', 'running', 'capital'] as const;
const groupOf = (kind: string): RowGroup | undefined => (ROW_GROUP as Readonly<Record<string, RowGroup | undefined>>)[kind];

/**
 * Finance (the M3 spec, item 6; D25): every ledger row by kind, under where the money comes from or
 * goes (money in, rewards, running costs, buying and building), for today so far, yesterday and this
 * quarter so far, beside a whole day's forecast. Capital rows are in, so each column's total is the
 * change in cash over it; the forecast's total is a day's running net, which capital never enters.
 * The starting cash sits on Day 0, above the table.
 */
export function Finance({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const f = sim.snapshot?.finance;
  if (!f) return null;
  const shown = f.rows.filter((r) => groupOf(r.kind) !== 'opening' && (r.todayCents !== 0 || r.yesterdayCents !== 0 || r.quarterCents !== 0 || (r.forecastCents ?? 0) !== 0));
  const sum = (pick: (r: FinanceView['rows'][number]) => number) => f.rows.reduce((s, r) => s + pick(r), 0);
  const money = (cents: number, modelled = false) => `${modelled ? '≈' : ''}${usd(cents)}`;
  const today = sum((r) => r.todayCents);
  const quarter = sum((r) => r.quarterCents);
  return (
    <aside className="panel finance" aria-label="Finance" data-testid="finance" data-chrome="panel" data-today={today} data-quarter={quarter} data-opening={f.openingCents}>
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Finance</h2>
      <p className="hint">Starting cash on Day 0: {usd(f.openingCents)}</p>
      <table>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Today</th>
            <th scope="col">Yesterday</th>
            <th scope="col">{quarterText(f.quarterFirstDay)}</th>
            <th scope="col" title="A whole day’s forecast, from today’s lines, fares and riders">Day forecast</th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => {
            const rows = shown.filter((r) => groupOf(r.kind) === group);
            if (!rows.length) return null;
            return (
              <Fragment key={group}>
                <tr className="group" data-group={group}>
                  <th scope="rowgroup" colSpan={5}>
                    {GROUP_NAMES[group]}
                  </th>
                </tr>
                {rows.map((r) => (
                  <tr key={r.kind} data-kind={r.kind} data-today={r.todayCents} data-yesterday={r.yesterdayCents} data-quarter={r.quarterCents} data-forecast={r.forecastCents ?? ''}>
                    <th scope="row" title={ROW_HINTS[r.kind as keyof typeof ROW_HINTS]}>
                      {rowName(r.kind)}
                    </th>
                    <td>{money(r.todayCents)}</td>
                    <td>{f.day > 1 ? money(r.yesterdayCents) : '—'}</td>
                    <td>{money(r.quarterCents)}</td>
                    <td>{r.forecastCents === null ? '—' : money(r.forecastCents, MODELLED.has(r.kind))}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
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
