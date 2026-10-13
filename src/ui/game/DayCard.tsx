import { ROW_NAMES, usd } from '../format';
import type { Sim } from './useSim';

/**
 * The daily close (PLAN §3): every figure a ledger row, adding up to the change in cash (I1). A
 * quarter's last day closes with its report card above the rows (the M3 spec, item 9), whose payout
 * or fine is one of them.
 */
export function DayCard({ sim }: { sim: Sim }) {
  const card = sim.dayCard;
  if (!card) return null;
  const byKind = new Map<string, number>();
  for (const row of card.rows) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row.amountCents);
  const total = card.rows.reduce((s, r) => s + r.amountCents, 0);
  return (
    <section className="day-card" role="dialog" aria-label={`Day ${card.day} closed`} data-testid="day-card" data-chrome="panel" data-total={total} data-change={card.cashAfterCents - card.cashBeforeCents}>
      <h2>Day {card.day} closed</h2>
      {card.report ? (
        <section className="report" aria-label={`Quarter ${card.report.quarter} report card`} data-testid="report-card" data-overall={card.report.overall.toFixed(1)} data-payout={card.report.payoutCents}>
          <h3>Quarter {card.report.quarter} report card</h3>
          <table>
            <tbody>
              {(
                [
                  ['Coverage', card.report.coverage],
                  ['Reliability', card.report.reliability],
                  ['Comfort', card.report.comfort],
                  ['Money', card.report.money],
                ] as const
              ).map(([name, grade]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{Math.round(grade)}</td>
                </tr>
              ))}
              <tr className="total">
                <th scope="row">Overall</th>
                <td>{Math.round(card.report.overall)}</td>
              </tr>
            </tbody>
          </table>
          <p>{card.report.payoutCents > 0 ? `The city pays ${usd(card.report.payoutCents)}` : card.report.payoutCents < 0 ? `The city fines ${usd(-card.report.payoutCents)}` : 'No grant and no fine'}</p>
        </section>
      ) : null}
      <table>
        <tbody>
          {[...byKind].map(([kind, cents]) => (
            <tr key={kind} data-kind={kind} data-cents={cents}>
              <th scope="row">{ROW_NAMES[kind] ?? kind}</th>
              <td>{usd(cents, { cents: true })}</td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">Day total</th>
            <td>{usd(total, { cents: true })}</td>
          </tr>
          <tr>
            <th scope="row">Cash</th>
            <td>
              {usd(card.cashBeforeCents, { cents: true })} → {usd(card.cashAfterCents, { cents: true })}
            </td>
          </tr>
        </tbody>
      </table>
      <button type="button" onClick={sim.closeDayCard}>
        Continue
      </button>
    </section>
  );
}
