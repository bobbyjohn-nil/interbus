import { useLayoutEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { MEDAL_IDS, tripsToSilver } from '../../sim/rules/medal';
import type { ContractView } from '../../sim/types';
import { useFocusBack } from '../focusBack';
import { focusLost } from '../focusLost';
import { runOver } from '../game/runOver';
import { askText, capitalise, dateText, figureText, MEDAL_NAMES, medalBarText, usd } from '../format';
import type { Sim } from '../game/useSim';

/**
 * Contracts (the M3 spec, item 11; the M4 spec, item 1): each offer or held contract with today's
 * figure near its landmark against its ask, HEADWAY's headway or RIDERSHIP's paid boardings a day,
 * the figure the day's grading and the ring on the map read (sim/rules/contract.ts). Taking an offer
 * is a click; a held one shows its days met in a row and the days left to meet them. Below them the
 * medals (the M4 spec, item 3): each one's bar, the day it came, and the trips left to silver, which
 * unlocks the Goliath.
 */
export function Contracts({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  // Take it goes as its contract is held, so the focus goes to that contract's row, which now says its days met (useFocusBack).
  // The row takes the focus only then, as Panels' box does, so a press on a row's text still leaves the arrows to the panel.
  const handBack = useFocusBack();
  const root = useRef<HTMLElement>(null);
  const toRow = (id: number) => () => {
    const row = root.current?.querySelector<HTMLElement>(`[data-contract="${id}"]`);
    return row && focusable(row);
  };
  // A close takes rows away (an offer withdrawn, a contract paid or lapsed): one going with the keyboard's focus in it says where
  // it stood, and the row now there takes the focus, or the one above, or the panel, rather than the page (the systems audit's
  // fourteenth round).
  const gone = useRef<number | null>(null);
  useLayoutEffect(() => {
    const at = gone.current;
    gone.current = null;
    if (at === null || !focusLost() || !root.current) return;
    const rows = root.current.querySelectorAll<HTMLElement>('[data-contract]');
    focusable(rows[Math.min(at, rows.length - 1)] ?? root.current).focus();
  });
  const s = sim.snapshot;
  if (!s) return null;
  const toSilver = tripsToSilver(s.medals, s.tripsCarried);
  return (
    <aside ref={root} className="panel contracts" aria-label="Contracts" data-testid="contracts" data-chrome="panel">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Contracts</h2>
      <ul className="contract-list">
        {s.contracts.map((c, k) => (
          <Row key={c.id} c={c} at={k} gone={gone}>
            <strong>
              {capitalise(askText(c.kind, c.ask))} at {c.landmark}
            </strong>
            <span>
              {c.daysNeeded} days in a row · {usd(c.rewardCents)}
            </span>
            {/* Met or not, now, in words beside the colour (PLAN §8: shape plus colour); a held one that missed an hour today says so below. */}
            <span className={c.met ? 'met' : 'short'}>
              Today: {figureText(c.kind, c.figure, c.ask)} · {c.met ? 'met now' : 'not met now'}
            </span>
            {c.held ? (
              <span>
                {c.daysMet} of {c.daysNeeded} days · {c.daysLeft} {c.daysLeft === 1 ? 'day' : 'days'} left{c.onTrack ? '' : ' · missed today'}
              </span>
            ) : (
              <span className="controls">
                <button
                  type="button"
                  disabled={runOver(sim)}
                  onClick={(e) => {
                    handBack(e.currentTarget, toRow(c.id));
                    sim.send({ type: 'accept-contract', contractId: c.id });
                  }}
                >
                  Take it
                </button>
              </span>
            )}
          </Row>
        ))}
      </ul>
      <section className="medal-ladder" aria-label="Medals" data-testid="medal-ladder" data-to-silver={toSilver}>
        <h3>Medals</h3>
        <ul className="medal-list">
          {MEDAL_IDS.map((m) => {
            const day = s.medals[m];
            const status =
              day !== null
                ? `Since ${dateText(day)}${m === 'silver' ? ' · the Goliath is for sale' : ''}`
                : m === 'silver'
                  ? // Silver is awarded at the day's close: from 25,000 trips until then the bar read "0 trips to go · unlocks the
                    // Goliath" while the Goliath stayed locked (the systems audit's eighth round).
                    toSilver > 0
                    ? `${toSilver.toLocaleString('en-US')} ${toSilver === 1 ? 'trip' : 'trips'} to go · unlocks the Goliath`
                    : 'reached · silver comes at midnight, and the Goliath with it'
                  : null;
            return (
              <li key={m} data-testid="medal" data-medal={m} data-held={day === null ? 'no' : 'yes'}>
                <span className="medal" data-medal={m} />
                <strong>{MEDAL_NAMES[m]}</strong>: {medalBarText(m)}
                {status ? <span className="status"> · {status}</span> : null}
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

/** Makes `el` take the focus until the focus leaves it, as Panels' box does: a row or the panel is no stop of its own. */
function focusable(el: HTMLElement): HTMLElement {
  el.tabIndex = -1;
  el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
  return el;
}

/**
 * A contract's row, `at` in the list. Going with the keyboard's focus in it, it says where it stood (`gone`), while it is still
 * on the page: its cleanup runs before React takes it off.
 */
function Row({ c, at, gone, children }: { c: ContractView; at: number; gone: MutableRefObject<number | null>; children: ReactNode }) {
  const row = useRef<HTMLLIElement>(null);
  const place = useRef(at);
  useLayoutEffect(() => {
    place.current = at;
  });
  useLayoutEffect(
    () => () => {
      if (row.current?.contains(document.activeElement)) gone.current = place.current;
    },
    [gone],
  );
  return (
    <li ref={row} data-contract={c.id} data-testid="contract" data-landmark={c.landmark} data-kind={c.kind} data-held={c.held ? 'yes' : 'no'} data-met={c.met ? 'yes' : 'no'} data-days-met={c.daysMet}>
      {children}
    </li>
  );
}
