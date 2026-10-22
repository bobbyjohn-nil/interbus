import { useEffect, useId, useRef } from 'react';
import type { HandBack } from '../focusBack';
import { focusLost } from '../focusLost';
import { askText, dateText, eventNewsText, medalNewsText, quarterText, rowName, usd } from '../format';
import { useScrollStop } from '../scrollStop';
import { runOver } from './runOver';
import type { Sim } from './useSim';

/**
 * A grade as the card shows it: its whole points, never rounded up. The grant, the fine and the
 * medals compare the unrounded grade against whole-number bars (sim/economy/reportCard.ts,
 * sim/rules/medal.ts), so a 54.7 shown as 55 sat beside no grant and no bronze.
 */
const points = (grade: number) => Math.floor(grade);

/**
 * The daily close (PLAN §3): every figure a ledger row, adding up to the change in cash (I1). A
 * quarter's last day closes with its report card above the rows (the M3 spec, item 9), whose payout
 * or fine is one of them; a contract paid or lapsed at the close says so (item 11), as does a city
 * event rolled for tomorrow or just over (the M4 spec, item 2), and a medal awarded (item 3). All of
 * it above Continue scrolls inside the card when it is taller than its cap (52vh, and the room above
 * the dock), so Continue stays in view; a long line wraps at its width (app.css, I13).
 */
export function DayCard({ sim, handBack }: { sim: Sim; handBack: HandBack }) {
  const card = sim.dayCard;
  // The close that ends the run turns off the control the keyboard was on: Continue takes the focus, rather than the page.
  // Any other close leaves the focus where it is, so Space still plays and pauses as the day's card shows.
  const over = runOver(sim);
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (over && focusLost()) go.current?.focus();
  }, [card?.day, over]);
  const [scrollBox, scrolls] = useScrollStop<HTMLDivElement>();
  // Where the keyboard had the focus as the card showed, so Continue's goes back there as the card goes (App holds the
  // hand-off). The page, or a control the mouse pressed, keeps it on the page, so Space still plays: where the focus came
  // into the card from was the Saves chip on every forward Tab (the review of the stop card's keys). At the run's end the
  // lender's card takes it instead.
  const cameFrom = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const at = document.activeElement;
    cameFrom.current = at instanceof HTMLElement && at !== document.body && at.matches(':focus-visible') ? at : null;
  }, [card?.day]);
  const heading = useId();
  if (!card) return null;
  const byKind = new Map<string, number>();
  for (const row of card.rows) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row.amountCents);
  const total = card.rows.reduce((s, r) => s + r.amountCents, 0);
  return (
    <section
      key={card.day}
      className="day-card"
      role="dialog" aria-label={`${dateText(card.day)} closed`} data-testid="day-card" data-chrome="panel" data-total={total} data-change={card.cashAfterCents - card.cashBeforeCents}>
      {/* Its rows scroll inside it on a busy close, and hold nothing focusable, so while they scroll the box takes the focus
          itself for the keyboard's arrows (useScrollStop). */}
      <div className="day-card-scroll" ref={scrollBox} {...(scrolls ? { tabIndex: 0, role: 'region', 'aria-labelledby': heading } : {})}>
        <h2 id={heading}>{dateText(card.day)} closed</h2>
        {card.report ? (
          <section className="report" aria-label={`${quarterText(card.day)} report card`} data-testid="report-card" data-overall={(Math.floor(card.report.overall * 10) / 10).toFixed(1)} data-payout={card.report.payoutCents}>
            <h3>{quarterText(card.day)} report card</h3>
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
                    <td>{points(grade)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <th scope="row">Overall</th>
                  <td>{points(card.report.overall)}</td>
                </tr>
              </tbody>
            </table>
            <p>{card.report.payoutCents > 0 ? `The city pays ${usd(card.report.payoutCents)}` : card.report.payoutCents < 0 ? `The city fines ${usd(-card.report.payoutCents)}` : 'The city neither pays nor fines'}</p>
          </section>
        ) : null}
        {card.contracts.map((c) => (
          <p key={c.landmark} className="contract-outcome" data-testid="contract-outcome" data-outcome={c.outcome}>
            {c.outcome === 'paid' ? `Contract met: ${askText(c.kind, c.ask)} at ${c.landmark}, ${usd(c.rewardCents)}` : `Contract lapsed: ${askText(c.kind, c.ask)} at ${c.landmark}`}
          </p>
        ))}
        {card.medals.map((m) => (
          <p key={m} className="medal-news" data-testid="medal-news" data-medal={m}>
            {medalNewsText(m)}
          </p>
        ))}
        {card.events.map((e) => (
          <p key={e.news} className="event-news" data-testid="event-news" data-news={e.news}>
            {eventNewsText(e)}
          </p>
        ))}
        <table>
          <tbody>
            {[...byKind].map(([kind, cents]) => (
              <tr key={kind} data-kind={kind} data-cents={cents}>
                <th scope="row">{rowName(kind)}</th>
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
      </div>
      <button
        ref={go}
        type="button"
        onClick={(e) => {
          if (!over) handBack(e.currentTarget, () => cameFrom.current);
          sim.closeDayCard();
        }}
      >
        Continue
      </button>
    </section>
  );
}
