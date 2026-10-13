import { ROW_NAMES, usd } from '../format';
import type { Sim } from './useSim';

/** The daily close (PLAN §3): every figure a ledger row, adding up to the change in cash (I1). */
export function DayCard({ sim }: { sim: Sim }) {
  const card = sim.dayCard;
  if (!card) return null;
  const byKind = new Map<string, number>();
  for (const row of card.rows) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row.amountCents);
  const total = card.rows.reduce((s, r) => s + r.amountCents, 0);
  return (
    <section className="day-card" role="dialog" aria-label={`Day ${card.day} closed`} data-testid="day-card" data-total={total} data-change={card.cashAfterCents - card.cashBeforeCents}>
      <h2>Day {card.day} closed</h2>
      <table>
        <tbody>
          {[...byKind].map(([kind, cents]) => (
            <tr key={kind}>
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
